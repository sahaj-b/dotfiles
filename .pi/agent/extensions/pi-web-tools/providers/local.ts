// ── Local Fetch Provider (direct HTTP from this machine, always available) ──
// Final fallback for web_fetch. Never goes on cooldown: every failure is
// rethrown as ProviderError { kind: "other", no status } so a blocked site
// can't take down fetches for other URLs.

import type { FetchOptions, FetchResponse } from "../types.ts";
import type { Capability, FetchCapable, Provider } from "./types.ts";
import { ProviderError } from "../fallback.ts";
import { htmlToMarkdown, htmlToText, isPoorMarkdownConversion } from "../html.ts";
import {
	normalizeAndValidateUrl, fetchWithRedirects, readBodyWithLimit,
	parseContentType, decodeTextBuffer, shouldRetryWithFallbackUserAgent,
	DEFAULT_USER_AGENT, FALLBACK_USER_AGENT,
} from "../network.ts";

export class LocalFetchProvider implements Provider, FetchCapable {
	readonly id = "local" as const;
	readonly name = "Local Fetch";
	readonly capabilities: Capability[] = ["fetch"];

	isAvailable(): boolean { return true; }

	async fetch(options: FetchOptions, signal?: AbortSignal): Promise<FetchResponse> {
		try {
			return await doLocalFetch(options, signal);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new ProviderError({ providerId: "local", kind: "other", message });
		}
	}
}

async function doLocalFetch(options: FetchOptions, signal?: AbortSignal): Promise<FetchResponse> {
	const url = normalizeAndValidateUrl(options.url);
	const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;

	const headers: Record<string, string> = {
		"User-Agent": DEFAULT_USER_AGENT,
		"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	};
	let { response, finalUrl } = await fetchWithRedirects(url, { headers, signal, maxRedirects: 10, blockPrivateHosts: true });

	// Retry on Cloudflare challenge
	if (shouldRetryWithFallbackUserAgent(response)) {
		await response.body?.cancel().catch(() => { });
		headers["User-Agent"] = FALLBACK_USER_AGENT;
		({ response, finalUrl } = await fetchWithRedirects(url, { headers, signal, maxRedirects: 10, blockPrivateHosts: true }));
	}

	if (!response.ok) {
		await response.body?.cancel().catch(() => { });
		throw new Error(`HTTP ${response.status} fetching ${finalUrl.href}`);
	}

	const ct = parseContentType(response.headers.get("content-type"));
	const { buffer, bytes } = await readBodyWithLimit(response, maxBytes, signal);

	// Raster images → base64
	if (ct.kind === "raster-image") {
		return {
			url: finalUrl.href,
			content: "",
			contentType: ct.contentType,
			mime: ct.mime,
			status: response.status,
			bytes,
			image: { mediaType: ct.mime, data: buffer.toString("base64") },
		};
	}

	const { text: rawText } = decodeTextBuffer(buffer, ct.charset);
	let content: string;
	if (ct.kind === "html") {
		if (options.format === "html") { content = rawText; }
		else if (options.format === "text") { content = htmlToText(rawText, finalUrl.href); }
		else {
			content = htmlToMarkdown(rawText, finalUrl.href);
			if (isPoorMarkdownConversion(content)) content = htmlToText(rawText, finalUrl.href);
		}
	} else { content = rawText; }

	return {
		url: finalUrl.href,
		content,
		contentType: ct.contentType,
		mime: ct.mime,
		status: response.status,
		bytes,
	};
}
