import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Loader } from "@earendil-works/pi-tui";

import {
	stableRenderWidth,
	stripAnsi,
	wrapTextWithAnsi,
} from "./ansi.js";
import { subtleRule } from "./theme.js";

const TOOL_CHROME_PATCH_SYMBOL = Symbol.for("tb.tool-chrome-patch");
const TOOL_CHROME_THEME_SYMBOL = Symbol.for("tb.tool-chrome-theme");
const WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL = Symbol.for("tb.working-loader-alignment-patch");

export function rememberToolChromeTheme(component: any, theme: any): void {
	if (theme?.fg) component[TOOL_CHROME_THEME_SYMBOL] = theme;
}

function mutedHorizontalRule(theme: any, width: number, cwd?: string): string {
	return subtleRule(theme, "─".repeat(stableRenderWidth(width, cwd)));
}

function shouldOmitBottomToolChromeRule(core: string[]): boolean {
	return core.some((line) => /└─+(?:┴─+)?┘/.test(stripAnsi(line ?? "")));
}

export function installToolChromePatch(): void {
	const proto = Container?.prototype as any;
	if (!proto || proto[TOOL_CHROME_PATCH_SYMBOL]) return;
	const originalRender = proto.render;
	if (typeof originalRender !== "function") return;
	proto.render = function patchedToolChromeRender(this: any, width: number): string[] {
		const rendered = originalRender.call(this, width);
		if (!Array.isArray(rendered) || rendered.length === 0) return rendered;
		if (typeof this?.toolName !== "string" || typeof this?.toolCallId !== "string") return rendered;
		return rendered;
		let start = 0;
		while (start < rendered.length && stripAnsi(rendered[start] ?? "").trim().length === 0) start++;
		let end = rendered.length - 1;
		while (end >= start && stripAnsi(rendered[end] ?? "").trim().length === 0) end--;
		if (start > end) return rendered;
		const effectiveCwd = this?.cwd ?? process.cwd();
		const renderWidth = stableRenderWidth(width, effectiveCwd);
		const core = rendered.slice(start, end + 1).flatMap((line) => {
			const wrapped = wrapTextWithAnsi(line.trimEnd(), renderWidth);
			return wrapped.length > 0 ? wrapped : [""];
		});
		if (mode === "transparent") return core;
		const activeTheme = this?.[TOOL_CHROME_THEME_SYMBOL] ?? this?.ui?.theme ?? (activeToolChromeCtx?.hasUI ? activeToolChromeCtx.ui.theme : undefined);
		const rule = mutedHorizontalRule(activeTheme, width, effectiveCwd);
		return shouldOmitBottomToolChromeRule(core) ? [rule, ...core] : [rule, ...core, rule];
	};
	proto[TOOL_CHROME_PATCH_SYMBOL] = true;
}

let activeToolChromeCtx: ExtensionContext | undefined;

export function registerToolChromeEvents(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		activeToolChromeCtx = ctx;
	});
	pi.on("turn_start", (_event, ctx) => {
		activeToolChromeCtx = ctx;
	});
	pi.on("session_shutdown", () => {
		activeToolChromeCtx = undefined;
	});
}

export function installWorkingIndicator(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWorkingIndicator({
			frames: [ctx.ui.theme.fg("dim", "·"), ctx.ui.theme.fg("muted", "•"), ctx.ui.theme.fg("accent", "●"), ctx.ui.theme.fg("muted", "•")],
			intervalMs: 120,
		});
	});
	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setWorkingIndicator();
	});
}

export function installWorkingLoaderAlignmentPatch(): void {
	const proto = Loader.prototype as unknown as Record<PropertyKey, any>;
	if (proto[WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL]) return;
	const originalRender = proto.render;
	if (typeof originalRender !== "function") return;
	proto[WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL] = true;
	proto.render = function patchedWorkingLoaderRender(this: any, width: number): string[] {
		const message = typeof this?.message === "string" ? this.message : "";
		if (!message.startsWith("Working...")) return originalRender.call(this, width);
		const originalPaddingX = this.paddingX;
		try {
			this.paddingX = 0;
			this.invalidate?.();
			return originalRender.call(this, width);
		} finally {
			this.paddingX = originalPaddingX;
			this.invalidate?.();
		}
	};
}
