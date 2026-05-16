// ── web_search tool ──

import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import type { TextContent } from "@earendil-works/pi-ai";
import type { WebToolsConfig, WebSearchDetails } from "../types.ts";
import { getToolConfig, getToolProviders } from "../config.ts";
import { executeWithFallback } from "../fallback.ts";
import { isSearchCapable } from "../providers/types.ts";
import type { Provider } from "../providers/types.ts";

function textContent(text: string): TextContent { return { type: "text", text }; }

export function createWebSearchTool(config: WebToolsConfig, providers: Provider[]) {
	const toolConfig = getToolConfig("web_search", config);
	const providerOrder = getToolProviders("web_search", config);

	const orderedProviders = providerOrder
		.map(id => providers.find(p => p.id === id))
		.filter((p): p is Provider => !!p && isSearchCapable(p));

	return {
		name: "web_search",
		label: "Web Search",
		description: "Search the public web for current information and relevant URLs.",
		parameters: Type.Object({
			query: Type.String({ description: "Search query." }),
			maxResults: Type.Optional(Type.Number({ description: "Maximum results to return (1-20)." })),
			provider: Type.Optional(Type.String({ description: "Force a specific provider (skip fallback chain)." })),
		}),

		async execute(
			_toolCallId: string,
			params: { query: string; maxResults?: number; provider?: string },
			signal?: AbortSignal,
			onUpdate?: (...args: any[]) => void,
		) {
			const query = params.query.trim();
			if (!query) throw new Error("Search query cannot be empty");

			const maxResults = Math.max(1, Math.min(20, params.maxResults ?? toolConfig.maxResults ?? 8));

			onUpdate?.({
				content: [textContent(`Searching for ${JSON.stringify(query)}...`)],
				details: { query, maxResults, provider: "", resultCount: 0, results: [] },
			});

			// Filter to specific provider if requested
			const chain = params.provider
				? orderedProviders.filter(p => p.id === params.provider)
				: orderedProviders;

			if (chain.length === 0) {
				throw new Error(params.provider
					? `Provider '${params.provider}' is not available for web_search`
					: "No search providers configured");
			}

			const { result, provider, fallbacksUsed } = await executeWithFallback(
				chain, "search",
				async (p) => {
					if (!isSearchCapable(p)) throw new Error(`${p.id} doesn't support search`);
					return p.search({ query, maxResults }, signal);
				},
				signal,
			);

			const output = formatSearchResults(query, result.results);
			const details: WebSearchDetails = {
				query, maxResults, provider,
				resultCount: result.results.length,
				fallbacksUsed,
				results: result.results,
			};

			return { content: [textContent(output)], details };
		},

		renderCall(args: { query: string; maxResults?: number; provider?: string }, theme: any) {
			let text = theme.fg("toolTitle", theme.bold("web_search "));
			text += theme.fg("accent", JSON.stringify(String(args.query)));
			if (args.maxResults) text += theme.fg("dim", ` limit=${args.maxResults}`);
			if (args.provider) text += theme.fg("muted", ` (${args.provider})`);
			return new Text(text, 0, 0);
		},

		renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
			if (options.isPartial) return new Text(theme.fg("warning", "Searching..."), 0, 0);
			if (result.isError) return new Text(theme.fg("error", `✗ ${result.content?.[0]?.text || "Search failed"}`), 0, 0);
			const d = result.details as WebSearchDetails | undefined;
			let text = theme.fg("success", `✓ ${d?.resultCount ?? 0} results`);
			if (d?.provider) text += theme.fg("muted", ` (${d.provider})`);
			if (d?.fallbacksUsed?.length) text += theme.fg("dim", ` [fallbacks: ${d.fallbacksUsed.join(", ")}]`);
			if (options.expanded && result.content?.[0]?.text) {
				const lines = result.content[0].text.split("\n").slice(0, 16);
				for (const line of lines) text += `\n${theme.fg("dim", line.slice(0, 220))}`;
			}
			return new Text(text, 0, 0);
		},
	};
}

function formatSearchResults(query: string, results: { title: string; url: string; snippet: string; publishedAt?: string; source?: string; score?: number }[]): string {
	if (results.length === 0) return `Search results for: ${query}\n\nNo results found.`;
	const lines = [`Search results for: ${query}`, ""];
	for (const [i, r] of results.entries()) {
		lines.push(`${i + 1}. ${r.title}`);
		lines.push(`   URL: ${r.url}`);
		if (r.publishedAt) lines.push(`   Published: ${r.publishedAt}`);
		if (r.source) lines.push(`   Source: ${r.source}`);
		if (r.snippet) lines.push(`   ${r.snippet}`);
		lines.push("");
	}
	return lines.join("\n").trimEnd();
}
