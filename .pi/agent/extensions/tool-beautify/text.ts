import { basename, extname } from "node:path";
import { wrapTextWithAnsi } from "@earendil-works/pi-tui";

import { stableRenderWidth, stripAnsi } from "./ansi.js";
import { settingNumber } from "./settings.js";
import { toolLabel, treeConnector } from "./theme.js";

export class TruncatedLines {
	private cachedLines?: string[];
	private cachedWidth?: number;
	private readonly lines: string[];

	constructor(text: string) {
		this.lines = text ? text.split(/\r?\n/) : [];
	}

	invalidate(): void {
		this.cachedLines = undefined;
		this.cachedWidth = undefined;
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const targetWidth = stableRenderWidth(width);
		const lines = this.lines.flatMap((line) => {
			const wrapped = wrapTextWithAnsi(line, targetWidth);
			return wrapped.length > 0 ? wrapped : [""];
		});
		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}
}

export function makeTruncatedLines(text: string): TruncatedLines {
	return new TruncatedLines(text);
}

export function makeEmpty() {
	return {
		invalidate() {},
		render(): string[] {
			return [];
		},
	};
}

export function componentHasVisibleLines(component: unknown): boolean {
	try {
		const render = (component as any)?.render;
		return (
			typeof render === "function" && render.call(component, 120).length > 0
		);
	} catch {
		return false;
	}
}

export function lineCount(text: string): number {
	if (!text) return 0;
	return text.split(/\r?\n/).length;
}

export function textContent(result: any): string {
	const part = result?.content?.find?.(
		(candidate: any) =>
			candidate?.type === "text" && typeof candidate.text === "string",
	);
	return part?.text ?? "";
}

export function clipLine(line: string, cwd?: string): string {
	const max = Math.max(
		40,
		Math.floor(settingNumber("maxLineWidth", 1000, cwd)),
	);
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function preview(
	text: string,
	count: number,
	direction: "head" | "tail",
	cwd?: string,
): string {
	const lines = text.split(/\r?\n/);
	const selected =
		direction === "head" ? lines.slice(0, count) : lines.slice(-count);
	return selected.map((line) => clipLine(line, cwd)).join("\n");
}

export function commandExit(text: string): number | null {
	const match =
		text.match(/exit code:\s*(\d+)/i) ?? text.match(/exit\s+(\d+)/i);
	return match ? Number.parseInt(match[1]!, 10) : null;
}

export function truncatedMarker(text: string): boolean {
	return /^\s*\[(?:Output|Full output|Read output|Search output|Bash output)[^\n\]]*truncated|^\s*\[[^\n\]]*Full output saved to:/im.test(
		text,
	);
}

export function resultTruncated(result: any): boolean {
	const details = result?.details;
	if (typeof details?.truncation?.truncated === "boolean")
		return details.truncation.truncated;
	if (typeof details?.truncated === "boolean") return details.truncated;
	return truncatedMarker(textContent(result));
}

export function readResultSummary(result: any, args: any, theme: any): string {
	const truncation = result?.details?.truncation;
	if (
		truncation?.truncated &&
		typeof truncation.outputLines === "number" &&
		typeof truncation.totalLines === "number"
	) {
		let summary =
			theme.fg(
				"success",
				`${truncation.outputLines}/${truncation.totalLines} lines`,
			) + theme.fg("warning", " · truncated");
		if (!truncation.firstLineExceedsLimit && truncation.outputLines > 0) {
			const startLine = Math.max(1, Math.floor(Number(args?.offset) || 1));
			summary += theme.fg(
				"dim",
				` · continue offset=${startLine + truncation.outputLines}`,
			);
		}
		return summary;
	}
	const count = lineCount(textContent(result));
	let summary = theme.fg("success", `${count} line${count === 1 ? "" : "s"}`);
	if (resultTruncated(result)) summary += theme.fg("warning", " · truncated");
	return summary;
}

interface BlinkEntry {
	invalidate: () => void;
}

const blinkEntries = new Map<unknown, BlinkEntry>();
let blinkTimer: ReturnType<typeof setInterval> | undefined;

function blinkKey(context: any): unknown {
	return context?.toolCallId ?? context?.id ?? context;
}

function startBlinkTimer(): void {
	if (blinkTimer) return;
	blinkTimer = setInterval(() => {
		for (const entry of blinkEntries.values()) {
			try {
				entry.invalidate();
			} catch {
				// best-effort
			}
		}
		if (blinkEntries.size === 0 && blinkTimer) {
			clearInterval(blinkTimer);
			blinkTimer = undefined;
		}
	}, 450);
	blinkTimer.unref?.();
}

const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
const SPINNER_INTERVAL = 60;

function startSpinner(context: any): void {
	if (context.state._spinStarted) return;
	context.state._spinStarted = true;
	context.state._fi = 0;
	context.state._spinInterval = setInterval(() => {
		context.state._fi = (context.state._fi + 1) % SPINNER_FRAMES.length;
		context.invalidate();
	}, SPINNER_INTERVAL);
}

export function cleanupSpinner(context: any): void {
	const state = context?.state;
	if (!state) return;
	if (state._spinInterval) {
		clearInterval(state._spinInterval);
		state._spinInterval = null;
	}
	state._spinStarted = false;
	state._fi = 0;
}

export function clearBlink(context: any): void {
	cleanupSpinner(context);
	const key = blinkKey(context);
	if (key) blinkEntries.delete(key);
	if (blinkEntries.size === 0 && blinkTimer) {
		clearInterval(blinkTimer);
		blinkTimer = undefined;
	}
}

export function spinnerPrefix(theme: any, context: any): string {
	if (!context?.invalidate) return theme.fg("warning", "● ");
	startSpinner(context);
	const frame = SPINNER_FRAMES[context.state._fi] ?? SPINNER_FRAMES[0];
	return theme.fg("warning", `${frame} `);
}

export function pendingStatusPrefix(
	theme: any,
	context: any,
	cwd?: string,
): string {
	return spinnerPrefix(theme, context);
}

export function renderPendingCall(
	call: string,
	theme: any,
	context: any,
	cwd?: string,
): TruncatedLines | ReturnType<typeof makeEmpty> {
	if (!context?.executionStarted || !context?.isPartial) return makeEmpty();
	return makeTruncatedLines(
		`${pendingStatusPrefix(theme, context, cwd)}${call}`,
	);
}

export function renderPendingDetail(text: string, theme: any): TruncatedLines {
	return makeTruncatedLines(
		`${treeConnector(theme, "╰")}${theme.fg("warning", text)}`,
	);
}

const NF_DIR = "";
const NF_FILE = "";
const ICON_BY_NAME: Record<string, string> = {
	dockerfile: "",
	license: "",
	makefile: "",
	"package.json": "",
	"readme.md": "󰂺",
	"tsconfig.json": "",
};
const ICON_BY_EXT: Record<string, string> = {
	bash: "",
	c: "",
	cpp: "",
	css: "",
	gif: "",
	go: "",
	graphql: "󰡷",
	html: "",
	java: "",
	jpg: "",
	jpeg: "",
	js: "",
	json: "",
	jsx: "",
	lock: "",
	lua: "",
	md: "󰍔",
	png: "",
	py: "",
	rb: "",
	rs: "",
	scss: "",
	sh: "",
	sql: "",
	svg: "󰜡",
	svelte: "",
	toml: "",
	ts: "",
	tsx: "",
	vue: "",
	xml: "󰗀",
	yaml: "",
	yml: "",
	zsh: "",
};

export function nerdIcon(
	pathText: string,
	isDirectory = false,
	theme?: any,
): string {
	if (isDirectory) return theme?.fg ? theme.fg("accent", NF_DIR) : NF_DIR;
	const clean = stripAnsi(pathText).trim().replace(/\/$/, "");
	const name = basename(clean).toLowerCase();
	const icon =
		ICON_BY_NAME[name] ??
		ICON_BY_EXT[extname(name).replace(/^\./, "").toLowerCase()] ??
		NF_FILE;
	const token = icon === NF_FILE ? "muted" : "accent";
	return theme?.fg ? theme.fg(token, icon) : icon;
}

export function renderPathListPreview(
	output: string,
	toolName: "find" | "ls",
	theme: any,
	expanded: boolean,
	cwd?: string,
): string {
	const rawItems = output
		.split(/\r?\n/)
		.filter((line) => line.trim().length > 0);
	if (rawItems.length === 0)
		return theme.fg(
			"muted",
			toolName === "ls" ? "empty directory" : "no files found",
		);
	const limit = Math.max(
		1,
		Math.floor(settingNumber("searchPreviewLines", 80, cwd)),
	);
	const shown = rawItems.slice(0, expanded ? limit : Math.min(limit, 12));
	const lines = shown.map((item, index) => {
		const clean = stripAnsi(item).trim();
		const isDir = clean.endsWith("/");
		const branch =
			index === shown.length - 1 && shown.length === rawItems.length
				? "└"
				: "├";
		const icon = nerdIcon(clean, isDir, theme);
		const label = isDir
			? theme.fg("accent", theme.bold(clean))
			: theme.fg("dim", clean);
		return `${treeConnector(theme, branch as "├" | "└", cwd)}${icon} ${label}`;
	});
	const remaining = rawItems.length - shown.length;
	if (remaining > 0) {
		const noun =
			toolName === "ls"
				? remaining === 1
					? "entry"
					: "entries"
				: `file${remaining === 1 ? "" : "s"}`;
		lines.push(
			`${treeConnector(theme, "└", cwd)}${theme.fg("muted", `… ${remaining} more ${noun}`)}`,
		);
	}
	return lines.join("\n");
}

export function readCallText(args: any, theme: any): string {
	const range =
		args?.offset || args?.limit
			? `:${args.offset ?? 1}${args.limit ? `-${Number(args.offset ?? 1) + Number(args.limit) - 1}` : ""}`
			: "";
	return `${theme.fg("text", theme.bold("  "))}${theme.fg("accent", `${args?.path ?? ""}${range}`)}`;
}

export function bashCallText(args: any, theme: any, cwd?: string): string {
	const max = Math.max(
		20,
		Math.floor(settingNumber("commandPreviewChars", 96, cwd)),
	);
	const maxLines = Math.max(
		1,
		Math.floor(settingNumber("commandMaxLines", 3, cwd)),
	);
	const rawCommand = typeof args?.command === "string" ? args.command : "";
	const commandLines = rawCommand.split(/\r?\n/).slice(0, maxLines);
	const styledLines = commandLines.map((line) => {
		const clipped = line.length > max ? `${line.slice(0, max - 1)}…` : line;
		return theme.fg("accent", clipped);
	});
	return `${theme.fg("text", theme.bold("$ "))}${styledLines.join("\n")}`;
}

export function readOnlyCallText(
	toolName: string,
	args: any,
	theme: any,
	cwd?: string,
): string {
	const query = args?.pattern ?? args?.glob ?? args?.path ?? args?.query ?? "";
	const icon = toolName === "find" ? "  " : `${toolName} `;
	return `${theme.fg("text", theme.bold(icon))}${theme.fg("accent", clipLine(String(query), cwd))}`;
}

export function plural(
	count: number,
	singular: string,
	pluralText = `${singular}s`,
): string {
	return `${count} ${count === 1 ? singular : pluralText}`;
}

export function joinPhrases(parts: string[]): string {
	if (parts.length <= 1) return parts[0] ?? "";
	if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
	return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
