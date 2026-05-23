import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { bashLiveOutputDelayMs, bashLiveTailLines, bashCompletedTailLines, bashOutputPreviewLines, settingBoolean } from "./settings.js";
import { stackPrefix, treeConnector } from "./theme.js";
import {
	bashCallText,
	clearBlink,
	lineCount,
	makeEmpty,
	makeTruncatedLines,
	pendingStatusPrefix,
	preview,
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
	if (state.timer || typeof context?.invalidate !== "function") return;
	state.timer = setTimeout(() => {
		state.timer = undefined;
		try {
			context.invalidate();
		} catch {
			// best-effort
		}
	}, delayMs);
	state.timer.unref?.();
}

function renderBashTail(output: string, limit: number, theme: any, cwd?: string): string {
	const trimmed = output.replace(/(?:\r?\n)+$/, "");
	if (!trimmed) return "";
	const tailLines = preview(trimmed, limit, "tail", cwd).split(/\r?\n/);
	const connector = treeConnector(theme, "│");
	return tailLines.map((line) => `${connector}${theme.fg("dim", line)}`).join("\n");
}

function extractPiExitCode(text: string): number | null {
	const match = text.match(/Command exited with code (\d+)/i);
	return match ? Number.parseInt(match[1]!, 10) : null;
}

function stripPiNoOutputWrapper(text: string): { output: string; exitCode: number | null } {
	const exitCode = extractPiExitCode(text);
	if (/^\(no[- ]output\)\s*\n+\s*Command exited with code \d+\s*$/i.test(text)) return { output: "", exitCode };
	if (/^\(no[- ]output\)\s*$/i.test(text)) return { output: "", exitCode: null };
	return { output: text, exitCode };
}

function bashFullCallText(args: any, theme: any, cwd?: string): string {
	const rawCommand = typeof args?.command === "string" ? args.command : "";
	const commandLines = rawCommand.split(/\r?\n/);
	const [firstLine = "", ...continuationLines] = commandLines;
	const styledFirstLine = theme.fg("accent", firstLine);
	const styledContinuation = continuationLines.length > 0
		? `\n${continuationLines.map((line) => theme.fg("accent", line)).join("\n")}`
		: "";
	return `${theme.fg("text", theme.bold("$ "))}${styledFirstLine}${styledContinuation}`;
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
			if (!context?.executionStarted || !context?.isPartial) return makeEmpty();

			markBashStarted(context);
			const effectiveCwd = context?.cwd ?? cwd;
			const liveTailState = bashLiveTailState(context);
			const call = context?.expanded
				? bashFullCallText(args ?? {}, theme, effectiveCwd)
				: bashCallText(args ?? {}, theme, effectiveCwd);
			const prefix = pendingStatusPrefix(theme, context, effectiveCwd);
			const partialOutput = context.state?._tbBashPartialOutput as string | undefined;
			const trimmedOutput = partialOutput?.trim();

			if (trimmedOutput) {
				const delayMs = bashLiveOutputDelayMs(effectiveCwd);
				const delayElapsed = Date.now() - (liveTailState.startedAt ?? Date.now()) >= delayMs;
				const shouldShow = context?.expanded || delayElapsed || liveTailState.tailShown;

				if (shouldShow) {
					liveTailState.tailShown = true;
					const tailLines = context?.expanded
						? bashOutputPreviewLines(effectiveCwd)
						: bashLiveTailLines(effectiveCwd);
					const tailText = renderBashTail(partialOutput, tailLines, theme, effectiveCwd);
					if (tailText) {
						scheduleBashLiveTailRerender(liveTailState, context, delayMs);
						return makeTruncatedLines(`${prefix}${call}\n${tailText}`);
					}
				}

				scheduleBashLiveTailRerender(liveTailState, context, delayMs);
				return makeTruncatedLines(`${prefix}${call}`);
			}

			scheduleBashLiveTailRerender(liveTailState, context, bashLiveOutputDelayMs(effectiveCwd));
			return makeTruncatedLines(`${prefix}${call}`);
		},
		renderResult(result: any, _options: any, theme: any, context: any) {
			const effectiveCwd = context?.cwd ?? cwd;
			const raw = textContent(result);
			const { output, exitCode } = stripPiNoOutputWrapper(raw);

			/* stash partial output so renderCall can pick it up on the next cycle */
			if (context?.isPartial) {
				context.state._tbBashPartialOutput = output;
				return makeEmpty();
			}

			/* command finished */
			clearBlink(context);
			clearBashLiveTailTimer(bashLiveTailState(context));
			delete context.state._tbBashPartialOutput;

			const count = lineCount(output);
			const exitLabel = exitCode != null && exitCode !== 0 ? `exit ${exitCode}` : null;
			const parts: string[] = [];
			if (exitLabel) parts.push(theme.fg("error", exitLabel));
			parts.push(theme.fg(exitLabel ? "dim" : "success", `${count} line${count === 1 ? "" : "s"}`));
			if (resultTruncated(result)) parts.push(theme.fg("warning", "truncated"));
			const sep = theme.fg("muted", " · ");
			const summary = parts.length ? `${sep}${parts.join(sep)}` : "";

			const call = context?.expanded
				? bashFullCallText(context?.args ?? {}, theme, effectiveCwd)
				: bashCallText(context?.args ?? {}, theme, effectiveCwd);
			let text = `${stackPrefix(theme)}${call}${summary}`;

			if (context?.expanded && output) {
				const limit = bashOutputPreviewLines(effectiveCwd);
				const lines = output.split(/\r?\n/);
				const shown = lines.slice(0, limit);
				for (const line of shown) {
					text += `\n${treeConnector(theme, "│", effectiveCwd)}${theme.fg("dim", line)}`;
				}
				if (count > limit) {
					text += `\n${treeConnector(theme, "│", effectiveCwd)}${theme.fg("muted", `… ${count - limit} more line(s)`)}`;
				}
			} else if (settingBoolean("tailAfterComplete", false, effectiveCwd) && output.trim()) {
				const tailText = renderBashTail(output, bashCompletedTailLines(effectiveCwd), theme, effectiveCwd);
				if (tailText) text += `\n${tailText}`;
			}

			return makeTruncatedLines(text);
		},
	});
}
