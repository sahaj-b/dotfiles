// ── Exa API Provider (requires EXA_API_KEY) ──

import type { SearchOptions, SearchResponse, SearchResult } from "../types.ts";
import type { Capability, CodeSearchCapable, Provider, SearchCapable } from "./types.ts";

const EXA_SEARCH_URL = "https://api.exa.ai/search";

export class ExaApiProvider implements Provider, SearchCapable, CodeSearchCapable {
	readonly id = "exa" as const;
	readonly name = "Exa (API)";
	readonly capabilities: Capability[] = ["search", "codeSearch"];

	constructor(private readonly apiKey: string) {}

	isAvailable(): boolean {
		return this.apiKey.length > 0;
	}

	async search(options: SearchOptions, signal?: AbortSignal): Promise<SearchResponse> {
		const timeout = AbortSignal.timeout(60000);
		const composedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

		return this.searchViaSearch(options, composedSignal);
	}

	async codeSearch(query: string, maxTokens: number, signal?: AbortSignal): Promise<string> {
		const timeout = AbortSignal.timeout(60000);
		const composedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

		try {
			const numResults = Math.min(20, Math.max(5, Math.ceil(maxTokens / 1000)));
			const response = await fetch(EXA_SEARCH_URL, {
				method: "POST",
				headers: {
					"x-api-key": this.apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: enrichCodeQuery(query),
					type: "auto",
					numResults,
					contents: {
						text: { maxCharacters: Math.min(50000, Math.max(1000, maxTokens * 4)) },
						highlights: true,
					},
				}),
				signal: composedSignal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Exa API error ${response.status}: ${errorText.slice(0, 300)}`);
			}

			const data = await response.json() as ExaSearchResponse;
			const text = formatSearchResultsAsText(data.results);
			return trimApproxTokens(text, maxTokens);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(
				`code_search failed: ${message}. ` +
				`Use web_search with a code-oriented query as an alternative.`
			);
		}
	}



	private async searchViaSearch(options: SearchOptions, signal: AbortSignal): Promise<SearchResponse> {
		const response = await fetch(EXA_SEARCH_URL, {
			method: "POST",
			headers: {
				"x-api-key": this.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: options.query,
				type: "auto",
				numResults: options.maxResults,
				contents: {
					text: { maxCharacters: 3000 },
					highlights: true,
				},
			}),
			signal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Exa API error ${response.status}: ${errorText.slice(0, 300)}`);
		}

		const data = await response.json() as ExaSearchResponse;
		return {
			results: mapExaSearchResults(data.results),
		};
	}
}

// ── Exa API response types ──

interface ExaSearchResponse {
	results?: Array<{
		title?: string;
		url?: string;
		publishedDate?: string;
		author?: string;
		text?: string;
		highlights?: string[];
		highlightScores?: number[];
	}>;
}

// ── Helpers ──

function mapExaSearchResults(results: ExaSearchResponse["results"]): SearchResult[] {
	if (!Array.isArray(results)) return [];
	return results
		.filter((r): r is NonNullable<typeof r> & { url: string } => !!r?.url)
		.map((r, i) => {
			const highlights = Array.isArray(r.highlights) ? r.highlights.filter(h => typeof h === "string" && h.trim()) : [];
			const snippet = highlights.length > 0
				? highlights.join(" ").slice(0, 280)
				: (r.text?.trim().slice(0, 280) ?? "");

			return {
				title: r.title || `Source ${i + 1}`,
				url: r.url,
				snippet,
				publishedAt: r.publishedDate || undefined,
				source: r.author || undefined,
			};
		});
}

function enrichCodeQuery(query: string): string {
	const lower = query.toLowerCase();
	const hasCodeTerms = /\b(api|code|docs?|documentation|example|github|implementation|library|source|stackoverflow|stack overflow)\b/.test(lower);
	return hasCodeTerms ? query : `${query} code examples documentation GitHub Stack Overflow official docs`;
}

function formatSearchResultsAsText(results: ExaSearchResponse["results"]): string {
	if (!Array.isArray(results) || results.length === 0) return "No results found.";
	const lines: string[] = [];
	for (const [i, r] of results.entries()) {
		if (!r?.url) continue;
		lines.push(`${i + 1}. ${r.title || "Untitled"}`);
		lines.push(`   URL: ${r.url}`);
		if (r.text) {
			lines.push(`   ${r.text.trim().slice(0, 500)}`);
		}
		lines.push("");
	}
	return lines.join("\n").trimEnd();
}

function trimApproxTokens(text: string, maxTokens: number): string {
	const maxChars = Math.max(1000, maxTokens * 4);
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars).trimEnd()}\n\n[Truncated to approximately ${maxTokens} tokens.]`;
}
