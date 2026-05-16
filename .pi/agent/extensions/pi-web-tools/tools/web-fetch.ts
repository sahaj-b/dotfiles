// ── web_fetch tool (direct HTTP fetch, no provider) ──

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize } from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import type { WebToolsConfig, FetchDetails, FetchFormat } from "../types.ts";
import { getToolConfig } from "../config.ts";
import { htmlToMarkdown, htmlToText, isPoorMarkdownConversion } from "../html.ts";
import {
	normalizeAndValidateUrl, fetchWithRedirects, readBodyWithLimit,
	parseContentType, decodeTextBuffer, createOperationSignal,
	shouldRetryWithFallbackUserAgent, DEFAULT_USER_AGENT, FALLBACK_USER_AGENT,
} from "../network.ts";

function textContent(text: string): TextContent { return { type: "text", text }; }

export function createWebFetchTool(config: WebToolsConfig) {
	const toolConfig = getToolConfig("web_fetch", config);

	return {
		name: "web_fetch",
		label: "Web Fetch",
		description: "Fetch a single URL and return its content as markdown, text, or raw HTML",
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch." }),
			format: Type.Optional(Type.Union([Type.Literal("markdown"), Type.Literal("text"), Type.Literal("html")], { description: "Return format." })),
			timeout: Type.Optional(Type.Number({ description: "Timeout in seconds." })),
		}),

		async execute(
			_toolCallId: string,
			params: { url: string; format?: FetchFormat; timeout?: number },
			signal?: AbortSignal,
			onUpdate?: (...args: any[]) => void,
		) {
			const url = normalizeAndValidateUrl(params.url);
			const format = params.format ?? (toolConfig.defaultFormat as FetchFormat) ?? "markdown";
			const timeoutMs = (params.timeout ?? toolConfig.timeoutSeconds ?? 30) * 1000;
			const maxBytes = (toolConfig.maxResponseMB ?? 5) * 1024 * 1024;

			onUpdate?.({
				content: [textContent(`Fetching ${url.href}...`)],
				details: { requestedUrl: params.url, finalUrl: url.href, format, status: 0, mime: "", contentType: "", bytes: 0 },
			});

			const op = createOperationSignal(timeoutMs, signal);
			try {
				return await doFetch(url, format, maxBytes, op.signal);
			} finally { op.cleanup(); }
		},

		renderCall(args: { url: string; format?: string }, theme: any) {
			let text = theme.fg("toolTitle", theme.bold("web_fetch "));
			text += theme.fg("accent", args.url);
			if (args.format && args.format !== "markdown") text += theme.fg("dim", ` (${args.format})`);
			return new Text(text, 0, 0);
		},

		renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
			if (options.isPartial) return new Text(theme.fg("warning", "Fetching..."), 0, 0);
			if (result.isError) return new Text(theme.fg("error", `✗ ${result.content?.[0]?.text || "Fetch failed"}`), 0, 0);
			const d = result.details as FetchDetails | undefined;
			let text = theme.fg("success", `✓ ${d?.mime || "content"} (${formatSize(d?.bytes ?? 0)})`);
			if (d?.truncated) text += theme.fg("warning", " [truncated]");
			if (options.expanded && result.content?.[0]?.text) {
				const lines = result.content[0].text.split("\n").slice(0, 12);
				for (const line of lines) text += `\n${theme.fg("dim", line.slice(0, 200))}`;
			}
			return new Text(text, 0, 0);
		},
	};
}

async function doFetch(url: URL, format: FetchFormat, maxBytes: number, signal: AbortSignal) {
	const headers: Record<string, string> = { "User-Agent": DEFAULT_USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
	let { response, finalUrl } = await fetchWithRedirects(url, { headers, signal, maxRedirects: 10, blockPrivateHosts: true });

	// Retry on Cloudflare challenge
	if (shouldRetryWithFallbackUserAgent(response)) {
		await response.body?.cancel().catch(() => { });
		headers["User-Agent"] = FALLBACK_USER_AGENT;
		({ response, finalUrl } = await fetchWithRedirects(url, { headers, signal, maxRedirects: 10, blockPrivateHosts: true }));
	}

	if (!response.ok) { await response.body?.cancel().catch(() => { }); throw new Error(`HTTP ${response.status} fetching ${finalUrl.href}`); }

	const ct = parseContentType(response.headers.get("content-type"));
	const { buffer, bytes } = await readBodyWithLimit(response, maxBytes, signal);

	// Raster images → base64
	if (ct.kind === "raster-image") {
		const b64 = buffer.toString("base64");
		const details: FetchDetails = { requestedUrl: url.href, finalUrl: finalUrl.href, format, status: response.status, mime: ct.mime, contentType: ct.contentType, bytes, image: true };
		return { content: [{ type: "image" as const, source: { type: "base64" as const, media_type: ct.mime, data: b64 } }], details };
	}

	// Text/HTML
	const { text: rawText, decoder } = decodeTextBuffer(buffer, ct.charset);
	let content: string;
	if (ct.kind === "html") {
		if (format === "html") { content = rawText; }
		else if (format === "text") { content = htmlToText(rawText, finalUrl.href); }
		else {
			content = htmlToMarkdown(rawText, finalUrl.href);
			if (isPoorMarkdownConversion(content)) content = htmlToText(rawText, finalUrl.href);
		}
	} else { content = rawText; }

	// Truncation
	const truncation = truncateHead(content, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
	let truncated = false;
	let fullOutputPath: string | undefined;
	if (truncation.truncated) {
		truncated = true;
		const dir = await mkdtemp(join(tmpdir(), "pi-web-fetch-"));
		fullOutputPath = join(dir, "output.txt");
		await writeFile(fullOutputPath, content, "utf8");
		content = `${truncation.content}\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). Full output saved to: ${fullOutputPath}]`;
	}

	const details: FetchDetails = { requestedUrl: url.href, finalUrl: finalUrl.href, format, status: response.status, mime: ct.mime, contentType: ct.contentType, charset: ct.charset, decoder, bytes, truncated, fullOutputPath };
	return { content: [textContent(content)], details };
}
