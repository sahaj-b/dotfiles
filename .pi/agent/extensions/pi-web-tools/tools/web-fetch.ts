// ── web_fetch tool (provider fallback chain, ends with local fetch) ──

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize } from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import type { FetchDetails, FetchFormat, WebToolsConfig } from "../types.ts";
import { getToolConfig, getToolProviders } from "../config.ts";
import { executeWithFallback } from "../fallback.ts";
import type { Provider } from "../providers/types.ts";
import { isFetchCapable } from "../providers/types.ts";
import { normalizeAndValidateUrl, createOperationSignal } from "../network.ts";
import { animatedBullet, connectorText, cleanupSpinner } from "../spinner.ts";

function textContent(text: string): TextContent { return { type: "text", text }; }

/** Below this a provider result is treated as a failed extraction → next fallback. */
const MIN_CONTENT_CHARS = 20;

export function createWebFetchTool(config: WebToolsConfig, providers: Provider[]) {
	const toolConfig = getToolConfig("web_fetch", config);
	const providerOrder = getToolProviders("web_fetch", config);

	const orderedProviders = providerOrder
		.map((id) => providers.find((p) => p.id === id))
		.filter((p): p is Provider => !!p && isFetchCapable(p));

	return {
		name: "web_fetch",
		label: "󰖟 Fetch",
		description: "Fetch a single URL and return its content as markdown, text, or raw HTML. Routes through the provider fallback chain (e.g. Browserbase → Firecrawl → Tavily) and ends with a direct local fetch when everything else fails.",
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch." }),
			format: Type.Optional(Type.Union([Type.Literal("markdown"), Type.Literal("text"), Type.Literal("html")], { description: "Return format." })),
			timeout: Type.Optional(Type.Number({ description: "Timeout in seconds." })),
		}),

			renderShell: "self",

		async execute(
			_toolCallId: string,
			params: { url: string; format?: FetchFormat; timeout?: number },
			signal?: AbortSignal,
			onUpdate?: (...args: any[]) => void,
		) {
			const url = normalizeAndValidateUrl(params.url).href;
			const format = params.format ?? (toolConfig.defaultFormat as FetchFormat) ?? "markdown";
			const timeoutMs = (params.timeout ?? toolConfig.timeoutSeconds ?? 30) * 1000;
			const maxBytes = (toolConfig.maxResponseMB ?? 5) * 1024 * 1024;

			onUpdate?.({
				content: [textContent(`Fetching ${url}...`)],
				details: { requestedUrl: params.url, finalUrl: url, format, status: 0, mime: "", contentType: "", bytes: 0 },
			});

			if (orderedProviders.length === 0) throw new Error("No fetch providers configured");

			const op = createOperationSignal(timeoutMs, signal);
			try {
				const { result, provider, fallbacksUsed } = await executeWithFallback(
					orderedProviders,
					"fetch",
					async (p) => {
						if (!isFetchCapable(p)) throw new Error(`${p.id} doesn't support fetch`);
						const r = await p.fetch({ url, format, maxBytes, timeoutSeconds: Math.ceil(timeoutMs / 1000) }, op.signal);
						if (!r.image && r.content.trim().length < MIN_CONTENT_CHARS) {
							throw new Error(`empty content from ${p.id}`);
						}
						return r;
					},
					op.signal,
				);

				// Raster image (local fetch only)
				if (result.image) {
					const details: FetchDetails = {
						requestedUrl: params.url, finalUrl: result.url, format,
						status: result.status ?? 200,
						mime: result.mime ?? result.image.mediaType,
						contentType: result.contentType ?? result.image.mediaType,
						bytes: result.bytes ?? 0, image: true,
						provider, fallbacksUsed,
					};
					return {
						content: [{ type: "image" as const, source: { type: "base64" as const, media_type: result.image.mediaType, data: result.image.data } }],
						details,
					};
				}

				// Truncation
				const truncation = truncateHead(result.content, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
				let content = truncation.content;
				let truncated = false;
				let fullOutputPath: string | undefined;
				if (truncation.truncated) {
					truncated = true;
					const dir = await mkdtemp(join(tmpdir(), "pi-web-fetch-"));
					fullOutputPath = join(dir, "output.txt");
					await writeFile(fullOutputPath, result.content, "utf8");
					content = `${truncation.content}\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). Full output saved to: ${fullOutputPath}]`;
				}

				const details: FetchDetails = {
					requestedUrl: params.url, finalUrl: result.url, format,
					status: result.status ?? 200,
					mime: result.mime ?? "",
					contentType: result.contentType ?? "",
					bytes: result.bytes ?? Buffer.byteLength(result.content),
					truncated, fullOutputPath,
					provider, fallbacksUsed,
				};
				return { content: [textContent(content)], details };
			} finally { op.cleanup(); }
		},

		renderCall(args: { url: string; format?: string }, theme: any, ctx: any) {
			let text = `${animatedBullet(ctx, theme)} ${theme.fg("toolTitle", theme.bold(theme.fg("border", "󰖟 ") + "Fetch "))}`;
			text += theme.fg("accent", args.url);
			if (args.format && args.format !== "markdown") text += theme.fg("dim", ` (${args.format})`);
			return new Text(text, 0, 0);
		},

		renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any, ctx: any) {
			if (options.isPartial) return connectorText(ctx, theme, "Fetching...");
			cleanupSpinner(ctx);
			if (result.isError) return connectorText(ctx, theme, theme.fg("error", `✗ ${result.content?.[0]?.text || "Fetch failed"}`));
			const d = result.details as FetchDetails | undefined;
			let text = theme.fg("success", `${d?.mime || "content"} (${formatSize(d?.bytes ?? 0)})`);
			if (d?.provider) text += theme.fg("muted", ` (${d.provider})`);
			if (d?.fallbacksUsed?.length) text += theme.fg("dim", ` [fallbacks: ${d.fallbacksUsed.join(", ")}]`);
			if (d?.truncated) text += theme.fg("warning", " [truncated]");
			if (options.expanded && result.content?.[0]?.text) {
				const lines = result.content[0].text.split("\n").slice(0, 12);
				for (const line of lines) text += `\n${theme.fg("dim", line.slice(0, 200))}`;
			}
			return connectorText(ctx, theme, text);
		},
	};
}
