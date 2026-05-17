import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { bashLiveOutputDelayMs, bashLiveTailLines, bashOutputMode, settingNumber } from "./settings.js";
import { stackPrefix, toolLabel, treeConnector } from "./theme.js";
import {
	bashCallText,
	clearBlink,
	commandExit,
	lineCount,
	makeEmpty,
	makeTruncatedLines,
	preview,
	renderPendingCall,
	renderPendingDetail,
	resultTruncated,
	textContent,
} from "./text.js";
import { contextCwd, getBuiltInTool } from "./read.js";

interface BashLiveTailState {
	startedAt?: number;
	tailShown?: boolean;
	timer?: ReturnType<typeof setTimeout>;
}

function bashLiveTailState(context: any): BashLiveTailState {
	const state = context?.state;
	if (!state || typeof state !== "object") return {};
	const record = state as Record<string, unknown>;
	if (!record._tbBashLiveTail || typeof record._tbBashLiveTail !== "object") record._tbBashLiveTail = {};
	return record._tbBashLiveTail as BashLiveTailState;
}

function markBashStarted(context: any): BashLiveTailState {
	const state = bashLiveTailState(context);
	if (!state.startedAt && context?.executionStarted) state.startedAt = Date.now();
	return state;
}

function clearBashLiveTailTimer(state: BashLiveTailState): void {
	if (!state.timer) return;
	clearTimeout(state.timer);
	state.timer = undefined;
}

function scheduleBashLiveTailRerender(state: BashLiveTailState, context: any, delayMs: number): void {
	if (state.tailShown || state.timer || typeof context?.invalidate !== "function") return;
	const startedAt = state.startedAt ?? Date.now();
	const remaining = Math.max(0, startedAt + delayMs - Date.now());
	state.timer = setTimeout(() => {
		state.timer = undefined;
		try {
			context.invalidate();
		} catch {
			// best-effort
		}
	}, remaining);
	state.timer.unref?.();
}

function renderBashTail(output: string, limit: number, theme: any, cwd?: string): string {
	const trimmed = output.replace(/(?:\r?\n)+$/, "");
	if (!trimmed) return "";
	const tailLines = preview(trimmed, limit, "tail", cwd).split(/\r?\n/);
	const connector = treeConnector(theme, "│", cwd);
	return tailLines.map((line) => `${connector}${theme.fg("dim", line)}`).join("\n");
}

export function registerBash(pi: ExtensionAPI, agent: any, cwd: string): void {
	const original = getBuiltInTool(agent, cwd, "bash");
	if (!original) return;
	pi.registerTool({
		renderShell: "self",
		name: "bash",
		label: "bash",
		description: original.description,
		parameters: original.parameters,
		async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: unknown, context: any) {
			return getBuiltInTool(agent, contextCwd(context, cwd), "bash").execute(id, params, signal, onUpdate);
		},
		renderCall(args: any, theme: any, context: any) {
			markBashStarted(context);
			return renderPendingCall(bashCallText(args ?? {}, theme, context?.cwd ?? cwd), theme, context, cwd);
		},
		renderResult(result: any, { expanded, isPartial }: any, theme: any, context: any) {
			const effectiveCwd = context?.cwd ?? cwd;
			const call = bashCallText(context?.args ?? {}, theme, effectiveCwd);
			const output = textContent(result);
			const liveTailState = markBashStarted(context);
			if (isPartial) {
				const trimmedOutput = output.trim();
				const partialMode = bashOutputMode(effectiveCwd);
				if (partialMode !== "summary" && partialMode !== "hidden" && trimmedOutput) {
					const delayMs = bashLiveOutputDelayMs(effectiveCwd);
					const startedAt = liveTailState.startedAt ?? Date.now();
					if (Date.now() - startedAt >= delayMs) {
						clearBashLiveTailTimer(liveTailState);
						liveTailState.tailShown = true;
						const tailText = renderBashTail(output, bashLiveTailLines(effectiveCwd), theme, effectiveCwd);
						if (tailText) return makeTruncatedLines(tailText);
					}
					scheduleBashLiveTailRerender(liveTailState, context, delayMs);
				}
				return makeEmpty();
			}
			clearBlink(context);
			clearBashLiveTailTimer(liveTailState);
			const exit = commandExit(output);
			const count = lineCount(output);
			const exitLabel = exit != null && exit !== 0 ? `exit ${exit}` : null;
			const parts = [];
			if (exitLabel) parts.push(theme.fg("error", exitLabel));
			parts.push(theme.fg(exitLabel ? "dim" : "success", `${count} line${count === 1 ? "" : "s"}`));
			if (resultTruncated(result)) parts.push(theme.fg("warning", "truncated"));
			const summary = parts.length ? ` · ${parts.join(" · ")}` : "";
			const mode = bashOutputMode(effectiveCwd);
			if (mode === "hidden") return makeEmpty();
			let text = `${stackPrefix(theme)}${call}${summary}`;
			if (mode === "preview" && output) {
				const limit = Math.max(1, Math.floor(settingNumber(expanded ? "bashPreviewLines" : "bashCollapsedLines", expanded ? 80 : 10, effectiveCwd)));
				text += `\n${preview(output, limit, "tail", effectiveCwd)
					.split(/\r?\n/)
					.map((line) => `${treeConnector(theme, "│")}${theme.fg("dim", line)}`)
					.join("\n")}`;
				if (count > limit) text += `\n${treeConnector(theme, "│")}${theme.fg("muted", `… ${count - limit} older line(s)`)}`;
			} else if (mode === "opencode" && expanded && output) {
				const limit = Math.max(1, Math.floor(settingNumber("bashPreviewLines", 80, effectiveCwd)));
				text += `\n${preview(output, limit, "tail", effectiveCwd)
					.split(/\r?\n/)
					.map((line) => `${treeConnector(theme, "│")}${theme.fg("dim", line)}`)
					.join("\n")}`;
				if (count > limit) text += `\n${treeConnector(theme, "│")}${theme.fg("muted", `… ${count - limit} older line(s)`)}`;
			} else if (mode === "opencode" && liveTailState.tailShown && output) {
				const tailText = renderBashTail(output, bashLiveTailLines(effectiveCwd), theme, effectiveCwd);
				if (tailText) text += `\n${tailText}`;
			}
			return makeTruncatedLines(text);
		},
	});
}
