// ── Jina Reader Provider (https://r.jina.ai) ──
// Keyless: 20 RPM per IP, no token cost. With JINA_API_KEY: 500 RPM,
// charged against the key's token pool (output tokens counted).
// Renders JS, parses PDFs and MS Office docs — covers what local can't.

import type { FetchOptions, FetchResponse } from "../types.ts";
import type { Capability, FetchCapable, Provider } from "./types.ts";
import { httpError, ProviderError } from "../fallback.ts";
import { normalizeAndValidateUrl } from "../network.ts";

const READER_URL = "https://r.jina.ai";

export class JinaProvider implements Provider, FetchCapable {
	readonly id = "jina" as const;
	readonly name = "Jina Reader";
	readonly capabilities: Capability[] = ["fetch"];

	constructor(private readonly apiKey?: string) {}

	isAvailable(): boolean {
		return true; // Keyless-capable, like exa-free and local
	}

	async fetch(options: FetchOptions, signal?: AbortSignal): Promise<FetchResponse> {
		const targetUrl = normalizeAndValidateUrl(options.url).href;
		const timeout = AbortSignal.timeout((options.timeoutSeconds ?? 30) * 1000);
		const composedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

		const respondWith = options.format === "html" ? "html" : options.format === "text" ? "text" : "markdown";
		const headers: Record<string, string> = {
			"Accept": "application/json",
			"X-Respond-With": respondWith,
		};
		if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

		// Fragments never reach the server, so hash-routed SPAs must send the
		// URL in the POST body instead of the path.
		let res: Response;
		if (targetUrl.includes("#")) {
			res = await fetch(READER_URL, {
				method: "POST",
				headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
				body: `url=${encodeURIComponent(targetUrl)}`,
				signal: composedSignal,
			});
		} else {
			res = await fetch(`${READER_URL}/${targetUrl}`, { headers, signal: composedSignal });
		}

		if (!res.ok) throw await httpError(this.id, res, "Jina Reader");

		const parsed = await res.json() as JinaReaderResponse;
		const data = parsed?.data;
		// The JSON field holding the content depends on the respond format:
		// markdown→content, text→text, html→html.
		const content = data?.[respondWith === "markdown" ? "content" : respondWith];
		if (!data || typeof content !== "string" || !content.trim()) {
			throw new Error("Jina Reader returned empty content");
		}

		// Outer status is 200 even when the target page 4xx/5xx'd; surface that
		// as a provider error so the fallback chain can move on.
		if (data.httpStatus && data.httpStatus >= 400) {
			throw new ProviderError({
				providerId: this.id,
				status: data.httpStatus,
				message: `Jina Reader: target returned HTTP ${data.httpStatus} for ${targetUrl}`,
			});
		}

		const mime = options.format === "html" ? "text/html" : "text/markdown";
		return {
			url: data.url || targetUrl,
			content,
			contentType: mime,
			mime,
			status: data.httpStatus ?? 200,
			bytes: Buffer.byteLength(content),
		};
	}
}

interface JinaReaderResponse {
	code?: number;
	data?: {
		title?: string;
		url?: string;
		content?: string;
		text?: string;
		html?: string;
		publishedTime?: string;
		httpStatus?: number;
		usage?: { tokens?: number };
	};
}
