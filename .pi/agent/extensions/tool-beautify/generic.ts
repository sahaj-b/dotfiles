import { mcpOutputMode, settingBoolean, settingNumber } from "./settings.js";
import { stackPrefix, toolLabel, treeConnector, treeStem } from "./theme.js";
import {
	clearBlink,
	clipLine,
	makeEmpty,
	makeTruncatedLines,
	pendingStatusPrefix,
	renderPendingDetail,
	textContent,
	type TruncatedLines,
} from "./text.js";

export const CORE_TOOL_RENDERERS = new Set(["read", "bash", "grep", "find", "ls", "edit", "write", "tool_batch", "tasks_write", "bg_task", "bg_status", "question", "subagent"]);
export const OPENAI_STYLE_TOOL_NAMES = new Set([
	"webfetch",
	"web_fetch",
	"web_search",
	"fetch_content",
	"get_search_content",
	"code_search",
	"context_tag",
	"context_log",
	"context_checkout",
	"annotate",
	"Skill",
	"EnterPlanMode",
	"ExitPlanMode",
	"Agent",
	"get_subagent_result",
	"steer_subagent",
	"TaskCreate",
	"TaskList",
	"TaskGet",
	"TaskUpdate",
	"TaskOutput",
	"TaskStop",
	"TaskExecute",
]);

export function isMcpToolName(name: string): boolean {
	return name === "mcp" || name.startsWith("mcp__") || name.startsWith("mcp_") || /(^|[_-])mcp([_-]|$)/i.test(name);
}

export function shouldUseGenericRenderer(name: string): boolean {
	if (!name || CORE_TOOL_RENDERERS.has(name) || name === "apply_patch") return false;
	if (isMcpToolName(name)) return true;
	if (OPENAI_STYLE_TOOL_NAMES.has(name)) return true;
	return /^Task[A-Z]/.test(name);
}

export function isUnknownToolComponent(component: any): boolean {
	return component?.toolDefinition === undefined && component?.builtInToolDefinition === undefined;
}

export function shouldUseUnknownToolRenderer(component: any, name: string): boolean {
	return Boolean(name) && settingBoolean("genericToolRenderers", true) && isUnknownToolComponent(component);
}

export function componentDefinesRenderer(component: any, slot: "renderCall" | "renderResult"): boolean {
	for (const key of ["tool", "toolDefinition", "definition", "toolDef", "toolConfig"]) {
		const candidate = component?.[key];
		if (candidate && typeof candidate[slot] === "function") return true;
	}
	return false;
}

export function humanizeToolName(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function oneLine(value: string, max = 72): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1))}…` : normalized;
}

function stringArg(args: any, ...keys: string[]): string {
	for (const key of keys) {
		const value = args?.[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}

function stringArrayArg(args: any, ...keys: string[]): string[] {
	for (const key of keys) {
		const value = args?.[key];
		if (!Array.isArray(value)) continue;
		const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
		if (strings.length > 0) return strings;
	}
	return [];
}

export function genericStatusPrefix(context: any, theme: any): string {
	if (!context?.executionStarted || context?.isPartial) return pendingStatusPrefix(theme, context);
	clearBlink(context);
	return theme.fg(context?.isError ? "error" : "success", "● ");
}

function summarizeScheduleWakeupCall(args: any, theme: any): string {
	const delay = formatScheduleWakeupDelay(args?.delaySeconds ?? args?.delay_seconds ?? args?.delay ?? args?.seconds);
	const reason = stringArg(args, "reason", "prompt", "description") || "scheduled wakeup";
	return `${theme.fg("accent", delay)}${theme.fg("dim", " · ")}${theme.fg("muted", oneLine(reason, 56))}`;
}

function formatScheduleWakeupDelay(value: unknown): string {
	const seconds = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
	if (!Number.isFinite(seconds) || seconds <= 0) return "later";
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = seconds / 60;
	if (minutes < 60) return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)}m`;
	const hours = minutes / 60;
	return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function summarizeGenericCall(name: string, args: any, theme: any): string {
	if (isMcpToolName(name)) {
		const parts = name.split("__").filter(Boolean);
		const label = parts.length >= 2 ? `${parts[0]}/${parts.slice(1).join("/")}` : humanizeToolName(name);
		const arg = stringArg(args, "path", "file_path", "query", "url", "name", "prompt", "description");
		return arg ? `${theme.fg("accent", label)} ${theme.fg("muted", oneLine(arg, 48))}` : theme.fg("accent", label);
	}
	switch (name) {
		case "webfetch":
		case "web_fetch":
		case "fetch_content": {
			const url = stringArg(args, "url") || stringArrayArg(args, "urls")[0] || "fetch";
			return theme.fg("accent", oneLine(url, 72));
		}
		case "web_search":
		case "code_search": return theme.fg("accent", oneLine(stringArg(args, "query") || stringArrayArg(args, "queries")[0] || "search", 72));
		case "Agent": return theme.fg("accent", oneLine(stringArg(args, "description", "prompt") || "launch agent", 72));
		case "TaskCreate": return theme.fg("accent", oneLine(stringArg(args, "subject", "description") || "create task", 72));
		case "TaskGet":
		case "TaskUpdate":
		case "TaskOutput":
		case "TaskStop": return theme.fg("accent", stringArg(args, "taskId", "task_id") || "task");
		case "TaskList": return theme.fg("muted", "task list");
		case "TaskExecute": {
			const ids = stringArrayArg(args, "taskIds", "task_ids");
			return ids.length <= 1 ? theme.fg("accent", ids[0] ?? "start tasks") : `${theme.fg("accent", ids[0]!)}${theme.fg("muted", ` +${ids.length - 1} tasks`)}`;
		}
		case "ScheduleWakeup": return summarizeScheduleWakeupCall(args, theme);
		default: return theme.fg("accent", oneLine(stringArg(args, "path", "file_path", "url", "query", "name", "subject", "tool", "description", "prompt") || humanizeToolName(name), 72));
	}
}

function summarizeUnknownToolCall(name: string, args: any, theme: any): string {
	if (name === "ScheduleWakeup") return summarizeScheduleWakeupCall(args, theme);
	return summarizeGenericCall(name, args, theme);
}

function unknownToolStatus(name: string, raw: string, isError: boolean, theme: any): string {
	if (!isError) return theme.fg("success", "done");
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	if (/not found/i.test(raw) || new RegExp(`\\b${escapedName}\\b.*not found`, "i").test(raw)) return theme.fg("error", "x not found");
	return theme.fg("error", "x error");
}

export function renderGenericToolCall(name: string, args: any, theme: any, context: any): TruncatedLines {
	return makeTruncatedLines(`${genericStatusPrefix(context, theme)}${toolLabel(theme, `${humanizeToolName(name)} `)}${summarizeGenericCall(name, args, theme)}`);
}

export function renderUnknownToolCall(name: string, args: any, theme: any, context: any): TruncatedLines | ReturnType<typeof makeEmpty> {
	if (context?.executionStarted) return makeEmpty();
	return makeTruncatedLines(`${genericStatusPrefix(context, theme)}${toolLabel(theme, `${humanizeToolName(name)} `)}${summarizeUnknownToolCall(name, args, theme)}`);
}

export function renderUnknownToolResult(name: string, result: any, { expanded, isPartial }: any, theme: any, context: any): TruncatedLines | ReturnType<typeof makeEmpty> {
	if (isPartial) return makeEmpty();
	clearBlink(context);
	const raw = textContent(result).trim();
	const args = context?.args ?? {};
	const status = unknownToolStatus(name, raw, Boolean(context?.isError), theme);
	let text = `${stackPrefix(theme)}${toolLabel(theme, `${humanizeToolName(name)} `)}${summarizeUnknownToolCall(name, args, theme)}${theme.fg("dim", " · ")}${status}`;
	if (!expanded) return makeTruncatedLines(`${text}${theme.fg("dim", " · ctrl+o to expand")}`);
	const json = JSON.stringify(args, null, 2).split(/\r?\n/);
	text += `\n${treeConnector(theme, raw ? "├" : "└")}${theme.fg("muted", "args")}`;
	text += `\n${json.map((line) => `${treeStem(theme, raw ? "├" : "└")}${theme.fg("dim", clipLine(line, context?.cwd))}`).join("\n")}`;
	if (raw) {
		const lines = raw.split(/\r?\n/);
		text += `\n${treeConnector(theme, "└")}${theme.fg(context?.isError ? "error" : "muted", clipLine(lines[0] ?? raw, context?.cwd))}`;
		for (const line of lines.slice(1, 8)) text += `\n${treeStem(theme, "└")}${theme.fg("dim", clipLine(line, context?.cwd))}`;
		if (lines.length > 8) text += `\n${treeStem(theme, "└")}${theme.fg("muted", `… ${lines.length - 8} more line(s)`)}`;
	}
	return makeTruncatedLines(text);
}

export function renderGenericToolResult(name: string, result: any, { expanded, isPartial }: any, theme: any, context: any): TruncatedLines | ReturnType<typeof makeEmpty> {
	if (isPartial) return renderPendingDetail(`${humanizeToolName(name)}…`, theme);
	clearBlink(context);
	const raw = textContent(result).trim();
	const lines = raw ? raw.split(/\r?\n/) : [];
	const mode = isMcpToolName(name) ? mcpOutputMode(context?.cwd) : "preview";
	if (mode === "hidden") return makeEmpty();
	if (context?.isError) {
		const first = lines[0] || `${humanizeToolName(name)} failed`;
		return makeTruncatedLines(`${treeConnector(theme, "└")}${theme.fg("error", first)}`);
	}
	if (lines.length === 0) return makeTruncatedLines(`${treeConnector(theme, "└")}${theme.fg("success", "done")}`);
	if (lines.length === 1) return makeTruncatedLines(`${treeConnector(theme, "└")}${theme.fg("muted", oneLine(lines[0]!, 120))}`);
	let text = `${treeConnector(theme, "└")}${theme.fg("success", `${lines.length} lines returned`)}`;
	if (mode === "preview" && expanded) {
		const limit = Math.max(1, Math.floor(settingNumber(isMcpToolName(name) ? "mcpPreviewLines" : "searchPreviewLines", 80, context?.cwd)));
		text += `\n${lines.slice(0, limit).map((line) => `${treeConnector(theme, "│")}${theme.fg("dim", clipLine(line, context?.cwd))}`).join("\n")}`;
		if (lines.length > limit) text += `\n${treeConnector(theme, "│")}${theme.fg("muted", `… ${lines.length - limit} more line(s)`)}`;
	} else if (mode === "preview") {
		text += theme.fg("dim", " · ctrl+o to expand");
	}
	return makeTruncatedLines(text);
}

// apply_patch
function extractApplyPatchFiles(patchText: string): string[] {
	const files = new Set<string>();
	for (const match of patchText.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) {
		const file = match[1]?.trim();
		if (file) files.add(file);
	}
	return [...files];
}

export function renderApplyPatchCall(args: any, theme: any, context: any): TruncatedLines | ReturnType<typeof makeEmpty> {
	if (context?.executionStarted) return makeEmpty();
	const patchText = stringArg(args, "patch", "patchText", "patch_text", "input");
	const files = extractApplyPatchFiles(patchText);
	const multiFile = files.length > 1;
	const summary = multiFile ? theme.fg("muted", `${files.length} files changed`) : theme.fg("muted", "patch");
	return makeTruncatedLines(`${genericStatusPrefix(context, theme)}${theme.fg("text", theme.bold("  "))}${summary}`);
}

export function renderApplyPatchResult(result: any, { expanded, isPartial }: any, theme: any, context: any): TruncatedLines | ReturnType<typeof makeEmpty> {
	if (isPartial) return makeEmpty();
	clearBlink(context);
	const call = `${theme.fg("text", theme.bold("  "))}${theme.fg("muted", "patch")}`;
	if (context?.isError) {
		const first = textContent(result).split(/\r?\n/)[0] || "apply_patch failed";
		return makeTruncatedLines(`${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${theme.fg("error", first)}`);
	}
	return makeTruncatedLines(`${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${theme.fg("success", "applied")}`);
}
