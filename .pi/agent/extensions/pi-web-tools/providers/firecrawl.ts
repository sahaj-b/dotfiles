// ── Firecrawl Provider (requires FIRECRAWL_API_KEY) ──

import type {
	CrawlOptions, CrawlResponse, ExtractOptions, ExtractResponse,
	SearchOptions, SearchResponse,
} from "../types.ts";
import type { Capability, CrawlCapable, ExtractCapable, Provider, SearchCapable } from "./types.ts";
import { httpError } from "../fallback.ts";

const BASE = "https://api.firecrawl.dev";

export class FirecrawlProvider implements Provider, SearchCapable, CrawlCapable, ExtractCapable {
	readonly id = "firecrawl" as const;
	readonly name = "Firecrawl";
	readonly capabilities: Capability[] = ["search", "crawl", "extract"];

	constructor(private readonly apiKey: string) {}

	isAvailable(): boolean { return this.apiKey.length > 0; }

	private headers() {
		return { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
	}

	async search(options: SearchOptions, signal?: AbortSignal): Promise<SearchResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
		const res = await fetch(`${BASE}/v1/search`, {
			method: "POST", headers: this.headers(),
			body: JSON.stringify({ query: options.query, limit: options.maxResults, scrapeOptions: { formats: ["markdown"] } }),
			signal: sig,
		});
		if (!res.ok) throw await httpError(this.id, res, "Firecrawl");
		const data = await res.json() as { data?: Array<{ url: string; title?: string; description?: string; markdown?: string; metadata?: { title?: string } }> };
		return {
			results: (data.data ?? []).filter(r => r.url).map((r, i) => ({
				title: r.title || r.metadata?.title || `Result ${i + 1}`,
				url: r.url,
				snippet: r.markdown?.slice(0, 280) ?? r.description ?? "",
			})),
		};
	}

	async crawl(options: CrawlOptions, signal?: AbortSignal): Promise<CrawlResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
		const startRes = await fetch(`${BASE}/v1/crawl`, {
			method: "POST", headers: this.headers(),
			body: JSON.stringify({ url: options.url, maxDepth: options.maxDepth, limit: options.maxPages, scrapeOptions: { formats: ["markdown"] } }),
			signal: sig,
		});
		if (!startRes.ok) throw await httpError(this.id, startRes, "Firecrawl");
		const { id } = await startRes.json() as { success: boolean; id?: string };
		if (!id) throw new Error("Firecrawl crawl failed to start");

		while (true) {
			if (sig.aborted) throw new Error("Crawl timed out");
			await new Promise(r => setTimeout(r, 2000));
			const pollRes = await fetch(`${BASE}/v1/crawl/${id}`, { headers: this.headers(), signal: sig });
			if (!pollRes.ok) throw new Error(`Firecrawl poll ${pollRes.status}`);
			const status = await pollRes.json() as { status: string; total?: number; data?: Array<{ markdown?: string; metadata?: { title?: string; sourceURL?: string; url?: string } }> };
			if (status.status === "completed") {
				return {
					results: (status.data ?? []).map((p, i) => ({ url: p.metadata?.sourceURL || p.metadata?.url || options.url, content: p.markdown || "", title: p.metadata?.title, depth: i })),
					totalPages: status.total ?? status.data?.length ?? 0,
				};
			}
			if (status.status === "failed" || status.status === "cancelled") throw new Error(`Firecrawl crawl ${status.status}`);
		}
	}

	async extract(options: ExtractOptions, signal?: AbortSignal): Promise<ExtractResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
		const results = await Promise.all(options.urls.map(async (url) => {
			try {
				const body: Record<string, unknown> = { url, formats: ["markdown"] };
				if (options.prompt) { body.formats = ["markdown", "extract"]; body.extract = { prompt: options.prompt }; }
				const res = await fetch(`${BASE}/v1/scrape`, { method: "POST", headers: this.headers(), body: JSON.stringify(body), signal: sig });
				if (!res.ok) return { url, content: "", error: `HTTP ${res.status}` };
				const data = await res.json() as { data?: { markdown?: string; content?: string; metadata?: { title?: string } } };
				return { url, content: data.data?.markdown || data.data?.content || "", title: data.data?.metadata?.title };
			} catch (e) { return { url, content: "", error: e instanceof Error ? e.message : String(e) }; }
		}));
		return { results };
	}
}
