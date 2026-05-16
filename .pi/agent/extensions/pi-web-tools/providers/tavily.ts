// ── Tavily Provider (requires TAVILY_API_KEY) ──

import type {
	CrawlOptions, CrawlResponse, ExtractOptions, ExtractResponse,
	SearchOptions, SearchResponse,
} from "../types.ts";
import type { Capability, CrawlCapable, ExtractCapable, Provider, SearchCapable } from "./types.ts";

const BASE = "https://api.tavily.com";

export class TavilyProvider implements Provider, SearchCapable, CrawlCapable, ExtractCapable {
	readonly id = "tavily" as const;
	readonly name = "Tavily";
	readonly capabilities: Capability[] = ["search", "crawl", "extract"];

	constructor(private readonly apiKey: string) {}

	isAvailable(): boolean { return this.apiKey.length > 0; }

	async search(options: SearchOptions, signal?: AbortSignal): Promise<SearchResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
		const res = await fetch(`${BASE}/search`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
			body: JSON.stringify({ query: options.query, max_results: options.maxResults, include_answer: true }),
			signal: sig,
		});
		if (!res.ok) throw new Error(`Tavily search ${res.status}: ${(await res.text()).slice(0, 300)}`);
		const data = await res.json() as TavilySearchResponse;
		return {
			answer: data.answer || undefined,
			results: (data.results ?? []).filter(r => r.url).map((r, i) => ({
				title: r.title || `Result ${i + 1}`,
				url: r.url,
				snippet: r.content?.slice(0, 280) ?? "",
				publishedAt: r.published_date,
			})),
		};
	}

	async crawl(options: CrawlOptions, signal?: AbortSignal): Promise<CrawlResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
		const body: Record<string, unknown> = {
			url: options.url,
			max_depth: options.maxDepth,
			max_breadth: options.maxPages,
			limit: options.maxPages,
		};
		if (options.instructions) body.instructions = options.instructions;

		const res = await fetch(`${BASE}/crawl`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
			body: JSON.stringify(body),
			signal: sig,
		});
		if (!res.ok) throw new Error(`Tavily crawl ${res.status}: ${(await res.text()).slice(0, 300)}`);
		const data = await res.json() as TavilyCrawlResponse;
		return {
			results: (data.results ?? []).map((p, i) => ({
				url: p.url || options.url,
				content: p.raw_content || "",
				title: p.title,
				depth: i,
			})),
			totalPages: data.results?.length ?? 0,
		};
	}

	async extract(options: ExtractOptions, signal?: AbortSignal): Promise<ExtractResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
		const res = await fetch(`${BASE}/extract`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
			body: JSON.stringify({ urls: options.urls }),
			signal: sig,
		});
		if (!res.ok) throw new Error(`Tavily extract ${res.status}: ${(await res.text()).slice(0, 300)}`);
		const data = await res.json() as TavilyExtractResponse;
		return {
			results: (data.results ?? []).map(r => ({
				url: r.url || "",
				content: r.raw_content || "",
				title: undefined,
			})),
		};
	}
}

interface TavilySearchResponse {
	answer?: string;
	results?: Array<{ title?: string; url: string; content?: string; published_date?: string }>;
}

interface TavilyCrawlResponse {
	results?: Array<{ url?: string; title?: string; raw_content?: string }>;
}

interface TavilyExtractResponse {
	results?: Array<{ url?: string; raw_content?: string }>;
}
