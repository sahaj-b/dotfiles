// ── web_crawl tool ──

import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import type { TextContent } from "@earendil-works/pi-ai";
import type { WebToolsConfig, WebCrawlDetails } from "../types.ts";
import { getToolConfig, getToolProviders } from "../config.ts";
import { executeWithFallback } from "../fallback.ts";
import { isCrawlCapable } from "../providers/types.ts";
import type { Provider } from "../providers/types.ts";
import { animatedBullet, cleanupSpinner, treeConnector, connectorText } from "../spinner.ts";

function textContent(text: string): TextContent { return { type: "text", text }; }

export function createWebCrawlTool(config: WebToolsConfig, providers: Provider[]) {
	const toolConfig = getToolConfig("web_crawl", config);
	const providerOrder = getToolProviders("web_crawl", config);

	const orderedProviders = providerOrder
		.map(id => providers.find(p => p.id === id))
		.filter((p): p is Provider => !!p && isCrawlCapable(p));

	return {
		name: "web_crawl",
		label: "󰖟 Crawl",
		description: "Crawl a website starting from a URL, discovering and extracting content from linked pages. Useful for documentation sites.",
		parameters: Type.Object({
			url: Type.String({ description: "Starting URL to crawl." }),
			maxDepth: Type.Optional(Type.Number({ description: "Max link depth (default 2)." })),
			maxPages: Type.Optional(Type.Number({ description: "Max pages to crawl (default 10)." })),
			instructions: Type.Optional(Type.String({ description: "Natural language instructions to guide the crawler." })),
		}),

		renderShell: "self",

		async execute(
			_toolCallId: string,
			params: { url: string; maxDepth?: number; maxPages?: number; instructions?: string },
			signal?: AbortSignal,
			onUpdate?: (...args: any[]) => void,
		) {
			const url = params.url.trim();
			if (!url) throw new Error("URL cannot be empty");

			const maxDepth = params.maxDepth ?? toolConfig.maxDepth ?? 2;
			const maxPages = params.maxPages ?? toolConfig.maxPages ?? 10;

			onUpdate?.({
				content: [textContent(`Crawling ${url}...`)],
				details: { url, maxDepth, maxPages, provider: "", pageCount: 0 },
			});

			if (orderedProviders.length === 0) throw new Error("No crawl providers configured");

			const { result, provider } = await executeWithFallback(
				orderedProviders, "crawl",
				async (p) => {
					if (!isCrawlCapable(p)) throw new Error(`${p.id} doesn't support crawl`);
					return p.crawl({ url, maxDepth, maxPages, instructions: params.instructions }, signal);
				},
				signal,
			);

			const lines = [`Crawled ${result.results.length} pages from ${url}`, ""];
			for (const page of result.results) {
				lines.push(`## ${page.title || page.url}`);
				lines.push(`URL: ${page.url}`);
				if (page.content) lines.push(page.content.slice(0, 2000));
				lines.push("");
			}

			const details: WebCrawlDetails = { url, maxDepth, maxPages, provider, pageCount: result.results.length };
			return { content: [textContent(lines.join("\n").trimEnd())], details };
		},

		renderCall(args: { url: string; maxDepth?: number; maxPages?: number }, theme: any, ctx: any) {
			let text = `${animatedBullet(ctx, theme)} ${theme.fg("toolTitle", theme.bold("󰖟 Crawl "))}`;
			text += theme.fg("accent", args.url);
			if (args.maxDepth) text += theme.fg("dim", ` depth=${args.maxDepth}`);
			if (args.maxPages) text += theme.fg("dim", ` pages=${args.maxPages}`);
			return new Text(text, 0, 0);
		},

		renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any, ctx: any) {
			if (options.isPartial) return connectorText(ctx, theme, "Crawling...");
			cleanupSpinner(ctx);
			if (result.isError) return connectorText(ctx, theme, theme.fg("error", `✗ ${result.content?.[0]?.text || "Crawl failed"}`));
			const d = result.details as WebCrawlDetails | undefined;
			let text = theme.fg("success", `${d?.pageCount ?? 0} pages`);
			if (d?.provider) text += theme.fg("muted", ` (${d.provider})`);
			return connectorText(ctx, theme, text);
		},
	};
}
