import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";

import { readOutputMode, settingNumber } from "./settings.js";
import { stackPrefix, toolLabel, treeConnector } from "./theme.js";
import {
	clearBlink,
	lineCount,
	makeEmpty,
	makeTruncatedLines,
	readCallText,
	readResultSummary,
	renderPendingCall,
	renderPendingDetail,
	resultTruncated,
	textContent,
} from "./text.js";

export type BuiltInToolName = "read" | "bash" | "grep" | "find" | "ls" | "edit" | "write";
export type BuiltInToolSet = Partial<Record<BuiltInToolName, any>>;

const builtInToolCache = new Map<string, BuiltInToolSet>();

export function normalizedCwd(cwd?: string): string {
	return resolve(cwd || process.cwd());
}

function createBuiltInToolSet(agent: any, cwd: string): BuiltInToolSet {
	return {
		read: agent.createReadTool?.(cwd),
		bash: agent.createBashTool?.(cwd),
		edit: agent.createEditTool?.(cwd),
		write: agent.createWriteTool?.(cwd),
		grep: agent.createGrepTool?.(cwd),
		find: agent.createFindTool?.(cwd),
		ls: agent.createLsTool?.(cwd),
	};
}

export function getBuiltInTool(agent: any, cwd: string, toolName: BuiltInToolName): any {
	const key = normalizedCwd(cwd);
	let tools = builtInToolCache.get(key);
	if (!tools) {
		tools = createBuiltInToolSet(agent, key);
		builtInToolCache.set(key, tools);
	}
	return tools[toolName];
}

export function contextCwd(context: any, fallback: string): string {
	return context?.cwd ?? fallback;
}

export function registerRead(pi: ExtensionAPI, agent: any, cwd: string): void {
	const original = getBuiltInTool(agent, cwd, "read");
	if (!original) return;
	pi.registerTool({
		renderShell: "self",
		name: "read",
		label: "read",
		description: original.description,
		parameters: original.parameters,
		async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: unknown, context: any) {
			return getBuiltInTool(agent, contextCwd(context, cwd), "read").execute(id, params, signal, onUpdate);
		},
		renderCall(args: any, theme: any, context: any) {
			return renderPendingCall(readCallText(args ?? {}, theme), theme, context, cwd);
		},
		renderResult(result: any, { expanded, isPartial }: any, theme: any, context: any) {
			const call = readCallText(context?.args ?? {}, theme);
			if (isPartial) return renderPendingDetail("reading…", theme);
			clearBlink(context);
			const mode = readOutputMode(context?.cwd ?? cwd);
			if (mode === "hidden") return makeEmpty();
			if (context?.isError || result?.isError) {
				const firstLine = textContent(result).split(/\r?\n/)[0] || "";
				const isNotFound = /ENOENT|no such file|not found/i.test(firstLine);
				const label = isNotFound ? "not found" : firstLine;
				let text = `${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${theme.fg("error", label)}`;
				if (expanded && firstLine) {
					text += `\n${treeConnector(theme, "│")}${theme.fg("dim", firstLine)}`;
				}
				return makeTruncatedLines(text);
			}
			const content = textContent(result);
			const count = lineCount(content);
			const summary = readResultSummary(result, context?.args ?? {}, theme);
			let text = `${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${summary}`;
			if (mode === "preview" && expanded && content) {
				const limit = Math.max(1, Math.floor(settingNumber("readPreviewLines", 80, context?.cwd)));
				text += `\n${content.split(/\r?\n/).slice(0, limit)
					.map((line) => `${treeConnector(theme, "│")}${theme.fg("dim", line)}`)
					.join("\n")}`;
				if (count > limit) text += `\n${treeConnector(theme, "│")}${theme.fg("muted", `… ${count - limit} more line(s)`)}`;
			}
			return makeTruncatedLines(text);
		},
	});
}
