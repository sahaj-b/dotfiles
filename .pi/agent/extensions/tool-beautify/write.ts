import {
	type ExtensionAPI,
	getLanguageFromPath,
	highlightCode,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { getBuiltInTool } from "./read.js";
import { writeCompletedLines, writeLiveLines } from "./settings.js";
import {
	clearBlink,
	displayPath,
	lineCount,
	makeEmpty,
	makeTruncatedLines,
	spinnerPrefix,
	textContent,
} from "./text.js";
import { stackPrefix, toolLabel, treeConnector } from "./theme.js";

const WRITE_PARTIAL_FULL_HIGHLIGHT_LINES = 50;

const writeSchema = Type.Object({
	path: Type.String({
		description:
			"Path to the file to write (relative or absolute). ALWAYS specify this argument FIRST, before content",
	}),
	content: Type.String({ description: "Content to write to the file" }), // ALWAYS specify this argument AFTER path.
});
const INVALID_CONTENT_ARG = "[invalid content arg - expected string]";
const INVALID_ARG = "[invalid arg]";

interface HighlightCache {
	rawPath: string;
	lang: string;
	rawContent: string;
	normalizedLines: string[];
	highlightedLines: string[];
}

class WriteRenderComponent {
	readonly _wrc = true; // brand for hot-reload-safe duck typing
	cache?: HighlightCache;
	private _text = "";
	private _bgFn?: (text: string) => string;
	private _cachedWidth?: number;
	private _cachedLines?: string[];

	setText(text: string): void {
		this._text = text;
		this._cachedWidth = undefined;
		this._cachedLines = undefined;
	}

	setBgFn(bgFn: (text: string) => string): void {
		this._bgFn = bgFn;
		this._cachedWidth = undefined;
		this._cachedLines = undefined;
	}

	invalidate(): void {
		this._cachedWidth = undefined;
		this._cachedLines = undefined;
	}

	render(width: number): string[] {
		if (this._cachedLines && this._cachedWidth === width) {
			return this._cachedLines;
		}
		if (!this._text) return [];

		const rawLines = this._text.split("\n");
		this._cachedLines = rawLines.map((line, idx) => {
			const visibleLen = visibleWidth(line);
			if (visibleLen > width) {
				line = truncateToWidth(line, width, "");
			}
			if (!this._bgFn || idx === 0) return line;
			const finalLen = visibleWidth(line);
			const padding = Math.max(0, width - finalLen);
			return this._bgFn(padding > 0 ? line + " ".repeat(padding) : line);
		});
		this._cachedWidth = width;
		return this._cachedLines;
	}
}

function argString(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (value == null) return "";
	return null;
}

function normalizeDisplayText(text: string): string {
	return text.replace(/\r/g, "");
}

function replaceTabs(text: string): string {
	return text.replace(/\t/g, "    ");
}

function trimTrailingEmptyLines(lines: string[]): string[] {
	let end = lines.length;
	while (end > 0 && lines[end - 1] === "") end -= 1;
	return lines.slice(0, end);
}

function highlightSingleLine(line: string, lang: string): string {
	try {
		const highlighted = highlightCode(line, lang);
		return highlighted[0] ?? line;
	} catch {
		return line;
	}
}

function refreshHighlightPrefix(cache: HighlightCache): void {
	const prefixCount = Math.min(
		WRITE_PARTIAL_FULL_HIGHLIGHT_LINES,
		cache.normalizedLines.length,
	);
	if (prefixCount === 0) return;
	const prefixSource = cache.normalizedLines.slice(0, prefixCount).join("\n");
	const prefixHighlighted = highlightCode(prefixSource, cache.lang);
	for (let i = 0; i < prefixCount; i += 1) {
		cache.highlightedLines[i] =
			prefixHighlighted[i] ??
			highlightSingleLine(cache.normalizedLines[i] ?? "", cache.lang);
	}
}

function rebuildHighlightCache(
	rawPath: string,
	fileContent: string,
): HighlightCache | undefined {
	const lang = rawPath ? getLanguageFromPath(rawPath) : undefined;
	if (!lang) return undefined;
	const normalized = replaceTabs(normalizeDisplayText(fileContent));
	return {
		rawPath,
		lang,
		rawContent: fileContent,
		normalizedLines: normalized.split("\n"),
		highlightedLines: highlightCode(normalized, lang),
	};
}

function updateHighlightCacheIncremental(
	cache: HighlightCache | undefined,
	rawPath: string,
	fileContent: string,
): HighlightCache | undefined {
	const lang = rawPath ? getLanguageFromPath(rawPath) : undefined;
	if (!lang) return undefined;
	if (!cache) return rebuildHighlightCache(rawPath, fileContent);
	if (cache.lang !== lang || cache.rawPath !== rawPath)
		return rebuildHighlightCache(rawPath, fileContent);
	if (!fileContent.startsWith(cache.rawContent))
		return rebuildHighlightCache(rawPath, fileContent);
	if (fileContent.length === cache.rawContent.length) return cache;

	const deltaNormalized = replaceTabs(
		normalizeDisplayText(fileContent.slice(cache.rawContent.length)),
	);
	cache.rawContent = fileContent;

	if (cache.normalizedLines.length === 0) {
		cache.normalizedLines.push("");
		cache.highlightedLines.push("");
	}

	const lastIndex = cache.normalizedLines.length - 1;
	const segments = deltaNormalized.split("\n");
	cache.normalizedLines[lastIndex] += segments[0];
	cache.highlightedLines[lastIndex] = highlightSingleLine(
		cache.normalizedLines[lastIndex],
		cache.lang,
	);
	for (let i = 1; i < segments.length; i += 1) {
		cache.normalizedLines.push(segments[i]);
		cache.highlightedLines.push(highlightSingleLine(segments[i], cache.lang));
	}
	refreshHighlightPrefix(cache);
	return cache;
}

function getHighlightedLines(
	cache: HighlightCache | undefined,
	rawContent: string,
	rawPath: string,
): string[] {
	if (cache) return cache.highlightedLines;
	const lang = rawPath ? getLanguageFromPath(rawPath) : undefined;
	if (!lang || rawContent.length > 50_000)
		return normalizeDisplayText(rawContent).split("\n");
	try {
		const normalized = replaceTabs(normalizeDisplayText(rawContent));
		const highlighted = highlightCode(normalized, lang);
		return Array.isArray(highlighted)
			? highlighted
			: normalizeDisplayText(String(highlighted)).split("\n");
	} catch {
		return normalizeDisplayText(rawContent).split("\n");
	}
}

function renderPath(theme: any, rawPath: string | null, cwd?: string): string {
	if (rawPath === null) return theme.fg("error", INVALID_ARG);
	if (!rawPath) return theme.fg("dim", "...");
	return theme.fg("accent", displayPath(rawPath, cwd));
}

function previewLines(
	rawPath: string,
	fileContent: string,
	cache: HighlightCache | undefined,
	maxLines: number,
): string {
	const lines = trimTrailingEmptyLines(
		getHighlightedLines(cache, fileContent, rawPath),
	);
	// const stem = treeConnector(theme, "│");
	return (
		lines
			.slice(-maxLines)
			.map((line) => `${line}`)
			.join("\n")
	);
}

function writePreviewLineLimit(context: any): number {
	if (context?.expanded)
		return context?.isPartial ? Number.POSITIVE_INFINITY : 200;
	return context?.isPartial
		? writeLiveLines(context?.cwd)
		: writeCompletedLines(context?.cwd);
}

function formatWriteCall(
	args: any,
	theme: any,
	context: any,
	cache: HighlightCache | undefined,
): string {
	const rawPath = argString(args?.file_path ?? args?.path);
	const fileContent = argString(args?.content);
	const pathText = renderPath(theme, rawPath, context?.cwd);
	const contentText = fileContent ?? "";
	const label = contentText.length > 0 ? "Write " : "Create ";
	let text = `${toolLabel(theme, label)}${pathText} ${theme.fg("toolOutput", `· ${lineCount(contentText)} lines`)}`;

	if (fileContent === null) {
		return `${text}\n${treeConnector(theme, "│")} ${theme.fg("error", INVALID_CONTENT_ARG)}`;
	}
	if (contentText.length > 0) {
		text += `\n${previewLines(rawPath ?? "", contentText, cache, writePreviewLineLimit(context))}`;
	} else if (context?.isPartial) {
		text += ` ${theme.fg("dim", "…")}`;
	}

	return text;
}

export function registerWrite(pi: ExtensionAPI, agent: any, cwd: string): void {
	const original = getBuiltInTool(agent, cwd, "write");
	if (!original) return;

	pi.registerTool({
		renderShell: "self",
		name: "write",
		label: "write",
		description: original.description,
		parameters: writeSchema,
		promptGuidelines: [
			"Use write only for new files or complete rewrites.",
			"When using write, always provide the `path` argument before `content`.",
		],
		async execute(
			id: string,
			params: any,
			signal: AbortSignal | undefined,
			onUpdate: unknown,
		) {
			return original.execute(id, params, signal, onUpdate);
		},
		renderCall(args: any, theme: any, context: any) {
			const isSame = (context.lastComponent as any)?._wrc === true;
			// Clean up stale spinner interval if class identity broke (hot-reload)
			if (!isSame && context.lastComponent) clearBlink(context);
			const component = isSame
				? context.lastComponent
				: new WriteRenderComponent();
			const rawPath = argString(args?.file_path ?? args?.path);
			const fileContent = argString(args?.content);

			if (rawPath !== null && fileContent !== null) {
				component.cache = context.argsComplete
					? rebuildHighlightCache(rawPath, fileContent)
					: updateHighlightCacheIncremental(
							component.cache,
							rawPath,
							fileContent,
						);
			} else {
				component.cache = undefined;
			}

			component.setBgFn((s: string) => theme.bg("userMessageBg", s));

			const prefix = context?.isPartial
				? spinnerPrefix(theme, context)
				: `${theme.fg("accent", "●")} `;
			component.setText(
				`${prefix}${formatWriteCall(args, theme, context, component.cache)}`,
			);
			return component;
		},
		renderResult(result: any, _options: any, theme: any, context: any) {
			const args = context?.args ?? {};
			const rawPath = argString(args.path ?? args.file_path);
			const pathText = renderPath(theme, rawPath, context?.cwd);
			clearBlink(context);

			if (context?.isError || result?.isError) {
				const errorText =
					textContent(result).split(/\r?\n/)[0] || "write failed";
				return makeTruncatedLines(
					`${stackPrefix(theme)}${toolLabel(theme, "Write ")}${pathText}${theme.fg("dim", " · ")}${theme.fg("error", errorText)}`,
				);
			}

			return makeEmpty();
		},
	});
}
