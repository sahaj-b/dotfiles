// ── Browserbase Provider (requires BROWSERBASE_API_KEY) ──
// Free plan: 1,000 Fetch + 1,000 Search calls/mo, no credit card.
// Fetch = raw HTML ($1/1k overage) or markdown ($4/1k overage, needs project
// enabled — degrades to raw + local conversion on 403). No JS execution,
// 5 MB / 60 s caps → falls through to JS-capable providers on 502/504.

import type {
	ExtractOptions, ExtractResponse, FetchOptions, FetchResponse,
	SearchOptions, SearchResponse,
} from "../types.ts";
import type { Capability, ExtractCapable, FetchCapable, Provider, SearchCapable } from "./types.ts";
import { httpError, ProviderError } from "../fallback.ts";
import { htmlToMarkdown, htmlToText, markdownToText } from "../html.ts";

const BASE = "https://api.browserbase.com";

export class BrowserbaseProvider implements Provider, SearchCapable, FetchCapable, ExtractCapable {
	readonly id = "browserbase" as const;
	readonly name = "Browserbase";
	readonly capabilities: Capability[] = ["search", "fetch", "extract"];

	constructor(private readonly apiKey: string) {}

	isAvailable(): boolean { return this.apiKey.length > 0; }

	private headers() {
		return { "X-BB-API-Key": this.apiKey, "Content-Type": "application/json" };
	}

	async search(options: SearchOptions, signal?: AbortSignal): Promise<SearchResponse> {
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
		const res = await fetch(`${BASE}/v1/search`, {
			method: "POST", headers: this.headers(),
			body: JSON.stringify({ query: options.query, numResults: Math.min(25, Math.max(1, options.maxResults)) }),
			signal: sig,
		});
		if (!res.ok) throw await httpError(this.id, res, "Browserbase");
		const data = await res.json() as BrowserbaseSearchResponse;
		return {
			results: (data.results ?? []).filter((r): r is NonNullable<typeof r> & { url: string } => !!r?.url).map((r, i) => ({
				title: r.title || `Result ${i + 1}`,
				url: r.url,
				snippet: "",
				publishedAt: r.publishedDate || undefined,
				source: r.author || undefined,
			})),
		};
	}

	async fetch(options: FetchOptions, signal?: AbortSignal): Promise<FetchResponse> {
		// Server caps at 60 s; give the request headroom to hit the 504 first
		const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000);

		const wantConverted = options.format === "markdown" || options.format === "text";
		let apiFormat: "markdown" | "raw" = wantConverted ? "markdown" : "raw";
		let res = await this.postFetch(options.url, apiFormat, sig);

		// Fetch Extract (markdown) requires the project to be enabled; degrade to raw + local conversion
		if (!res.ok && res.status === 403 && wantConverted) {
			await res.body?.cancel().catch(() => {});
			apiFormat = "raw";
			res = await this.postFetch(options.url, apiFormat, sig);
		}
		if (!res.ok) throw await httpError(this.id, res, "Browserbase");

		const body = await res.json() as BrowserbaseFetchResponse;
		if (body.statusCode >= 400) {
			throw new ProviderError({
				providerId: this.id,
				status: body.statusCode,
				message: `Browserbase fetch ${body.statusCode} for ${options.url}`,
			});
		}

		const raw = body.encoding === "base64"
			? Buffer.from(String(body.content ?? ""), "base64").toString("utf-8")
			: String(body.content ?? "");
		const isHtml = (body.contentType ?? "").toLowerCase().includes("html");

		let content: string;
		if (apiFormat === "markdown") {
			content = options.format === "text" ? markdownToText(raw) : raw;
		} else if (isHtml) {
			content = options.format === "html" ? raw
				: options.format === "text" ? htmlToText(raw, options.url)
				: htmlToMarkdown(raw, options.url);
		} else {
			content = raw;
		}

		return {
			url: options.url,
			content,
			contentType: body.contentType,
			mime: body.contentType?.split(";")[0]?.trim(),
			status: body.statusCode,
			bytes: Buffer.byteLength(content),
		};
	}

	async extract(options: ExtractOptions, signal?: AbortSignal): Promise<ExtractResponse> {
		const results = await Promise.all(options.urls.map(async (url) => {
			try {
				const r = await this.fetch({ url, format: "markdown" }, signal);
				return { url, content: r.content, title: undefined };
			} catch (e) {
				return { url, content: "", error: e instanceof Error ? e.message : String(e) };
			}
		}));
		return { results };
	}

	private postFetch(url: string, format: "raw" | "markdown", signal: AbortSignal): Promise<Response> {
		return fetch(`${BASE}/v1/fetch`, {
			method: "POST", headers: this.headers(),
			body: JSON.stringify({ url, format, allowRedirects: true }),
			signal,
		});
	}
}

interface BrowserbaseSearchResponse {
	results?: Array<{
		id?: string; url?: string; title?: string; author?: string;
		publishedDate?: string; image?: string; favicon?: string;
	}>;
}

interface BrowserbaseFetchResponse {
	statusCode: number;
	headers?: Record<string, string>;
	content?: string | Record<string, unknown>;
	contentType?: string;
	encoding?: string;
}
