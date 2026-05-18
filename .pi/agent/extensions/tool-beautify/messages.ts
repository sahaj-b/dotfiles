import { getMarkdownTheme, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";

import {
	applyBaseTextFg,
	isThinkingOnlyAssistantMessage,
	stableRenderWidth,
	trimOuterBlankLinesAroundRules,
	trimThinkingOnlyAssistantLines,
	trimTrailingBlankLines,
	truncateAnsi,
	visibleWidth,
	wrapTextWithAnsi,
} from "./ansi.js";
import { settingBoolean } from "./settings.js";
import { FALLBACK_THEME, stackPrefix, toolLabel, treeConnector } from "./theme.js";
import { makeTruncatedLines } from "./text.js";

const USER_MESSAGE_PATCH_SYMBOL = Symbol.for("tb.user-message-patch");
const ASSISTANT_MESSAGE_PATCH_SYMBOL = Symbol.for("tb.assistant-message-patch");
const CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL = Symbol.for("tb.custom-message-spacing-patch");
const COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL = Symbol.for("tb.compaction-summary-renderer-patch");
const SKILL_INVOCATION_RENDERER_PATCH_SYMBOL = Symbol.for("tb.skill-invocation-renderer-patch");
const MARKDOWN_CODE_BLOCK_PATCH_SYMBOL = Symbol.for("tb.markdown-code-block-patch");

interface UserMessagePatchState {
	activeCtx?: ExtensionContext;
	originalRender: (width: number) => string[];
}

export function installUserMessageRenderer(pi: ExtensionAPI, UserMessageComponent: any): void {
	const prototype = UserMessageComponent?.prototype as Record<PropertyKey, unknown> | undefined;
	if (!prototype || typeof prototype.render !== "function") return;

	let state = prototype[USER_MESSAGE_PATCH_SYMBOL] as UserMessagePatchState | undefined;
	if (!state) {
		state = {
			originalRender: prototype.render as (width: number) => string[],
		};
		prototype[USER_MESSAGE_PATCH_SYMBOL] = state;
		prototype.render = function compactUserMessageRender(this: any, width: number): string[] {
			const ctx = state?.activeCtx;
			const cwd = ctx?.cwd ?? process.cwd();
			const compact = settingBoolean("compactUserMessages", true, cwd);
			if (compact && ctx?.hasUI) {
				const theme = ctx.ui?.theme ?? FALLBACK_THEME;
				const frameWidth = stableRenderWidth(width, cwd);
				const lines = state!.originalRender.call(this, Math.max(1, frameWidth));
				const trimmed = trimUserMessagePadding(lines, theme, frameWidth, cwd);
				const result = addUserMessageBorders(trimmed, frameWidth, theme, cwd);
				return appendUserMessageBreak(result);
			}
			return appendUserMessageBreak(state!.originalRender.call(this, width));
		};
	}

	pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
		state!.activeCtx = ctx;
	});
	pi.on("session_shutdown", () => {
		if (prototype[USER_MESSAGE_PATCH_SYMBOL] === state) {
			prototype.render = state!.originalRender as unknown;
			delete prototype[USER_MESSAGE_PATCH_SYMBOL];
		}
		state!.activeCtx = undefined;
	});
}

const BG_ANSI_RE = /\x1b\[48(?:;[0-9;]*)?m|\x1b\[49m/g;

function trimUserMessagePadding(lines: string[], theme: any, width: number, cwd?: string): string[] {
	if (lines.length === 0) return lines;
	const innerWidth = stableRenderWidth(width, cwd);
	return lines.map((line) => {
		const trimmed = line.trimEnd();
		const clipped = truncateAnsi(trimmed, innerWidth);
		const noBg = clipped.replace(BG_ANSI_RE, "");
		return applyBaseTextFg(noBg, theme) + " ".repeat(Math.max(0, innerWidth - visibleWidth(noBg)));
	});
}

const OSC_START_RE = /^\x1b\]133;A\x07/;
const OSC_END_RE = /\x1b\]133;B\x07\x1b\]133;C\x07$/;

function addUserMessageBorders(lines: string[], _width: number, theme: any, _cwd?: string): string[] {
	if (lines.length < 3) return lines;

	// Drop Box(1,1) top/bottom padding, keep only content
	const content = lines.slice(1, -1);
	if (content.length === 0) return lines;

	// Measure actual visible width of the widest content line (strip ANSI, then measure)
	const ansiStripRe = /\x1b\[[0-9;]*[a-zA-Z]/g;
	const borderLen = Math.max(1, ...content.map((ln) => visibleWidth(ln.replace(ansiStripRe, ""))));

	const first = lines[0] ?? "";
	const last = lines[lines.length - 1] ?? "";
	const oscStart = first.match(OSC_START_RE)?.[0] ?? "";
	const oscEnd = last.match(OSC_END_RE)?.[0] ?? "";

	const border = theme.fg("accent", "─".repeat(borderLen));
	return [oscStart + border, ...content, border + oscEnd];
}

function appendUserMessageBreak(lines: string[]): string[] {
	return lines;
}

interface AssistantMessagePatchState {
	activeCtx?: ExtensionContext;
	originalRender: (width: number) => string[];
	originalUpdateContent: (message: any) => void;
}

function alignAssistantContent(component: any): void {
	const children = component?.contentContainer?.children;
	if (!Array.isArray(children)) return;
	for (const child of children) {
		if (child instanceof Markdown || child instanceof Text) {
			child.paddingX = 0;
			child.invalidate?.();
		}
	}
}

export function installAssistantMessageRenderer(pi: ExtensionAPI, AssistantMessageComponent: any): void {
	const prototype = AssistantMessageComponent?.prototype as Record<PropertyKey, unknown> | undefined;
	if (!prototype || typeof prototype.render !== "function" || typeof prototype.updateContent !== "function") return;

	let state = prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL] as AssistantMessagePatchState | undefined;
	if (!state) {
		state = {
			originalRender: prototype.render as (width: number) => string[],
			originalUpdateContent: prototype.updateContent as (message: any) => void,
		};
		prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL] = state;
		prototype.render = function spacedAssistantRender(this: any, width: number): string[] {
			const rendered = state!.originalRender.call(this, width);
			if (!Array.isArray(rendered) || rendered.length === 0) return rendered;
			if (isThinkingOnlyAssistantMessage(this?.lastMessage)) return trimThinkingOnlyAssistantLines(rendered);
			if (this?.hasToolCalls) return rendered;
			const end = trimTrailingBlankLines(rendered);
			if (end.length === 0) return rendered;
			return [...end, ""];
		};
		prototype.updateContent = function alignedAssistantUpdateContent(this: any, message: any): void {
			state!.originalUpdateContent.call(this, message);
			const cwd = state?.activeCtx?.cwd ?? process.cwd();
			if (settingBoolean("alignAssistantMessages", true, cwd)) alignAssistantContent(this);
		};
	}

	pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
		state!.activeCtx = ctx;
	});
	pi.on("session_shutdown", () => {
		if (prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL] === state) {
			prototype.render = state!.originalRender as unknown;
			prototype.updateContent = state!.originalUpdateContent as unknown;
			delete prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL];
		}
		state!.activeCtx = undefined;
	});
}

interface CompactionSummaryPatchState {
	activeCtx?: ExtensionContext;
	originalUpdateDisplay: () => void;
}

export function installCompactionSummaryRenderer(pi: ExtensionAPI, Component: any): void {
	const prototype = Component?.prototype as Record<PropertyKey, unknown> | undefined;
	if (!prototype || typeof prototype.updateDisplay !== "function") return;

	let state = prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL] as CompactionSummaryPatchState | undefined;
	if (!state) {
		state = {
			originalUpdateDisplay: prototype.updateDisplay as () => void,
		};
		prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL] = state;
		prototype.updateDisplay = function compactCompactionSummaryDisplay(this: any): void {
			const ctx = state?.activeCtx;
			const cwd = ctx?.cwd ?? process.cwd();
			if (!settingBoolean("compactCompactionMessages", true, cwd)) {
				state!.originalUpdateDisplay.call(this);
				return;
			}

			const theme = ctx?.ui?.theme ?? FALLBACK_THEME;
			const message = this?.message ?? {};
			const tokensBefore = Number.isFinite(Number(message.tokensBefore)) ? Number(message.tokensBefore) : 0;
			const tokenStr = tokensBefore.toLocaleString();
			const expanded = Boolean(this?.expanded);
			const summary = typeof message.summary === "string" && message.summary.trim() ? message.summary.trim() : "No summary was recorded.";

			this.paddingX = 0;
			this.paddingY = 0;
			this.setBgFn?.(undefined);
			this.clear?.();

			const hint = expanded ? "" : theme.fg("dim", " · ctrl+o to expand");
			this.addChild?.(makeTruncatedLines(`${stackPrefix(theme)}${toolLabel(theme, "Compacted ")}${theme.fg("success", `${tokenStr} tokens`)}${hint}`));

			if (expanded) {
				this.addChild?.(makeTruncatedLines(`${treeConnector(theme, "└", cwd)}${theme.fg("muted", "Summary")}`));
				this.addChild?.(new Markdown(summary, 0, 0, this?.markdownTheme ?? getMarkdownTheme(), {
					color: (text: string) => theme.fg("customMessageText", text),
				}));
			}
		};
	}

	pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
		state!.activeCtx = ctx;
	});
	pi.on("session_shutdown", () => {
		if (prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL] === state) {
			prototype.updateDisplay = state!.originalUpdateDisplay as unknown;
			delete prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL];
		}
		state!.activeCtx = undefined;
	});
}

interface SkillInvocationPatchState {
	activeCtx?: ExtensionContext;
	originalUpdateDisplay: () => void;
}

export function installSkillInvocationRenderer(pi: ExtensionAPI, Component: any): void {
	const prototype = Component?.prototype as Record<PropertyKey, unknown> | undefined;
	if (!prototype || typeof prototype.updateDisplay !== "function") return;

	let state = prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL] as SkillInvocationPatchState | undefined;
	if (!state) {
		state = {
			originalUpdateDisplay: prototype.updateDisplay as () => void,
		};
		prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL] = state;
		prototype.updateDisplay = function compactSkillInvocationDisplay(this: any): void {
			const ctx = state?.activeCtx;
			const cwd = ctx?.cwd ?? process.cwd();
			if (!settingBoolean("compactSkillMessages", true, cwd)) {
				state!.originalUpdateDisplay.call(this);
				return;
			}

			const th = ctx?.ui?.theme ?? FALLBACK_THEME;
			const skillBlock = this?.skillBlock ?? {};
			const name = typeof skillBlock.name === "string" && skillBlock.name.trim() ? skillBlock.name.trim() : "skill";
			const content = typeof skillBlock.content === "string" ? skillBlock.content : "";
			const expanded = Boolean(this?.expanded);

			this.paddingX = 0;
			this.paddingY = 0;
			this.setBgFn?.(undefined);
			this.clear?.();

			const keyText = (key: string) => key;
			const hint = expanded ? "" : th.fg("dim", ` · ctrl+o expand`);
			this.addChild?.(makeTruncatedLines(`${stackPrefix(th)}${toolLabel(th, "Skill ")}${th.fg("accent", name)}${hint}`));

			if (expanded) {
				this.addChild?.(makeTruncatedLines(`${treeConnector(th, "└", cwd)}${th.fg("muted", "Content")}`));
				this.addChild?.(new Markdown(`**${name}**\n\n${content}`, 0, 0, this?.markdownTheme ?? getMarkdownTheme(), {
					color: (text: string) => th.fg("customMessageText", text),
				}));
			}
		};
	}

	pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
		state!.activeCtx = ctx;
	});
	pi.on("session_shutdown", () => {
		if (prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL] === state) {
			prototype.updateDisplay = state!.originalUpdateDisplay as unknown;
			delete prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL];
		}
		state!.activeCtx = undefined;
	});
}

interface CustomMessageSpacingPatchState {
	originalRender: (width: number) => string[];
}

export function installCustomMessageSpacingPatch(pi: ExtensionAPI, CustomMessageComponent: any): void {
	const prototype = CustomMessageComponent?.prototype as Record<PropertyKey, unknown> | undefined;
	if (!prototype || typeof prototype.render !== "function") return;

	let state = prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL] as CustomMessageSpacingPatchState | undefined;
	if (!state) {
		state = { originalRender: prototype.render as (width: number) => string[] };
		prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL] = state;
		prototype.render = function compactRuledCustomMessageRender(this: any, width: number): string[] {
			const rendered = state!.originalRender.call(this, width);
			if (!Array.isArray(rendered) || rendered.length === 0) return rendered;
			return trimOuterBlankLinesAroundRules(rendered);
		};
	}

	pi.on("session_shutdown", () => {
		if (prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL] === state) {
			prototype.render = state!.originalRender as unknown;
			delete prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL];
		}
	});
}

interface MarkdownCodeBlockPatchState {
	activeCtx?: ExtensionContext;
	originalRenderToken: (token: any, width: number, nextTokenType?: string, styleContext?: unknown) => string[];
}

function codeBlockBgParts(ctx?: ExtensionContext): { open: string; close: string } {
	const marker = "\uE000";
	try {
		const theme = ctx?.hasUI ? ctx.ui.theme : undefined;
		if (theme?.bg) {
			const styled = theme.bg("userMessageBg", marker);
			const index = styled.indexOf(marker);
			if (index >= 0) return { open: styled.slice(0, index), close: styled.slice(index + marker.length) };
		}
	} catch {
		// ignore
	}
	return { open: "\x1b[48;5;236m", close: "\x1b[49m" };
}

function applyCodeBlockBg(line: string, _contentWidth: number, _ctx?: ExtensionContext): string {
	return line;
}

function renderStyledCodeBlock(token: any, width: number, markdownTheme: any, ctx?: ExtensionContext): string[] {
	const contentWidth = stableRenderWidth(width, ctx?.cwd);
	const rawLang = typeof token?.lang === "string" ? token.lang.trim() : "";
	const lang = rawLang.split(/\s+/)[0] || undefined;
	const code = typeof token?.text === "string" ? token.text : "";

	if (contentWidth < 8) {
		return code.split("\n").map((line) => (markdownTheme?.codeBlock ? markdownTheme.codeBlock(line) : line));
	}

	let highlightedLines: string[];
	try {
		highlightedLines = markdownTheme?.highlightCode ? markdownTheme.highlightCode(code, lang) : code.split("\n").map((line: string) => (markdownTheme?.codeBlock ? markdownTheme.codeBlock(line) : line));
	} catch {
		highlightedLines = code.split("\n").map((line: string) => (markdownTheme?.codeBlock ? markdownTheme.codeBlock(line) : line));
	}

	const lines: string[] = [];
	for (const highlightedLine of highlightedLines) {
		const wrapped = wrapTextWithAnsi(highlightedLine, contentWidth);
		const segments = wrapped.length > 0 ? wrapped : [""];
		for (const segment of segments) {
			lines.push(applyCodeBlockBg(segment, contentWidth, ctx));
		}
	}
	return lines;
}

export function installMarkdownCodeBlockRenderer(pi: ExtensionAPI): void {
	const prototype = Markdown?.prototype as Record<PropertyKey, unknown> | undefined;
	if (!prototype || typeof prototype.renderToken !== "function") return;

	let state = prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL] as MarkdownCodeBlockPatchState | undefined;
	if (!state) {
		state = {
			originalRenderToken: prototype.renderToken as MarkdownCodeBlockPatchState["originalRenderToken"],
		};
		prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL] = state;
		prototype.renderToken = function styledCodeBlockRenderToken(this: any, token: any, width: number, nextTokenType?: string, styleContext?: unknown): string[] {
			if (token?.type === "code" && settingBoolean("styledCodeBlocks", true, state?.activeCtx?.cwd)) {
				const codeLines = renderStyledCodeBlock(token, width, this?.theme, state?.activeCtx);
				if (nextTokenType && nextTokenType !== "space") return [...codeLines, ""];
				return codeLines;
			}
			return state!.originalRenderToken.call(this, token, width, nextTokenType, styleContext);
		};
	}

	pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
		state!.activeCtx = ctx;
	});
	pi.on("session_shutdown", () => {
		if (prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL] === state) {
			prototype.renderToken = state!.originalRenderToken as unknown;
			delete prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL];
		}
		state!.activeCtx = undefined;
	});
}
