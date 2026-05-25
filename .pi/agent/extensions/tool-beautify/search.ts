import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { searchOutputMode, settingNumber } from "./settings.js";
import { stackPrefix, toolLabel, treeConnector } from "./theme.js";
import {
	clearSpinner,
	lineCount,
	makeEmpty,
	makeTruncatedLines,
	preview,
	readOnlyCallText,
	renderPathListPreview,
	renderPendingCall,
	renderPendingDetail,
	resultTruncated,
	textContent,
} from "./text.js";
import { contextCwd, getBuiltInTool } from "./read.js";

/** Known informational messages the built-in tools return when they find nothing */
const NO_RESULT_MSG = /^(no files? found matching pattern|no matches? found|\(empty directory\))$/i;

export function registerReadOnly(pi: ExtensionAPI, agent: any, cwd: string, toolName: "grep" | "find" | "ls"): void {
	const original = getBuiltInTool(agent, cwd, toolName);
	if (!original) return;
	pi.registerTool({
		renderShell: "self",
		name: toolName,
		label: toolName,
		description: original.description,
		parameters: original.parameters,
		async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: unknown, context: any) {
			return getBuiltInTool(agent, contextCwd(context, cwd), toolName).execute(id, params, signal, onUpdate);
		},
		renderCall(args: any, theme: any, context: any) {
			return renderPendingCall(readOnlyCallText(toolName, args ?? {}, theme, context?.cwd ?? cwd), theme, context);
		},
		renderResult(result: any, { expanded, isPartial }: any, theme: any, context: any) {
			const call = readOnlyCallText(toolName, context?.args ?? {}, theme, context?.cwd ?? cwd);
			if (isPartial) return renderPendingDetail(`${toolName}…`, theme);
			clearSpinner(context);
			const output = textContent(result);
			const firstLine = output.split(/\r?\n/)[0] || "";
			if (context?.isError || result?.isError) {
				const isNotFound = /ENOENT|no such file|not found/i.test(firstLine);
				const label = isNotFound ? "not found" : firstLine;
				let text = `${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${theme.fg("error", label)}`;
				if (expanded && firstLine) {
					text += `\n${treeConnector(theme, "│")}${theme.fg("dim", firstLine)}`;
				}
				return makeTruncatedLines(text);
			}
			// Built-in tools return an informational message (not an error) when they
			// find nothing — treat it as zero results instead of counting the message
			const noResult = NO_RESULT_MSG.test(output.trim());
			const count = noResult ? 0 : (output.trim() ? lineCount(output) : 0);
			const label = toolName === "grep"
				? `${count} match${count === 1 ? "" : "es"}`
				: toolName === "ls"
					? `${count} entr${count === 1 ? "y" : "ies"}`
					: `${count} file${count === 1 ? "" : "s"}`;
			let summary = count === 0 ? theme.fg("muted", toolName === "grep" ? "no matches" : toolName === "ls" ? "empty" : "no files") : theme.fg("success", label);
			if (resultTruncated(result)) summary += theme.fg("warning", " · truncated");
			const mode = searchOutputMode(context?.cwd ?? cwd);
			if (mode === "hidden") return makeEmpty();
			let text = `${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${summary}`;
			if (mode === "preview" && expanded && output) {
				if (noResult) {
					// Show the tool's own message (e.g. "No files found matching pattern")
					// dimmed on a sub-line, same pattern as read.ts for errors
					text += `\n${treeConnector(theme, "│")}${theme.fg("dim", output.trim())}`;
				} else if (toolName === "find" || toolName === "ls") {
					text += `\n${renderPathListPreview(output, toolName, theme, expanded, context?.cwd)}`;
				} else {
					const limit = Math.max(1, Math.floor(settingNumber("searchPreviewLines", 80, context?.cwd)));
					text += `\n${preview(output, limit, "head", context?.cwd)
						.split(/\r?\n/)
						.map((line) => `${treeConnector(theme, "│")}${theme.fg("dim", line)}`)
						.join("\n")}`;
					if (count > limit) text += `\n${treeConnector(theme, "│")}${theme.fg("muted", `… ${count - limit} more result line(s)`)}`;
				}
			}
			return makeTruncatedLines(text);
		},
	});
}
