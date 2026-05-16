// ── Network utilities (ported from dotfiles/web-tools) ──

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ContentKind, ParsedContentType } from "./types.ts";

const HTML_MIMES = new Set(["text/html", "application/xhtml+xml"]);
const TEXT_MIMES = new Set(["application/json", "application/ld+json", "application/xml", "application/rss+xml", "application/atom+xml", "application/javascript", "image/svg+xml"]);
const RASTER_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
export const FALLBACK_USER_AGENT = "pi-web-tools";

export interface ComposedSignal { signal: AbortSignal; cleanup: () => void; }

export function createOperationSignal(timeoutMs: number, outerSignal?: AbortSignal): ComposedSignal {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(new Error(`Timed out after ${Math.ceil(timeoutMs / 1000)}s`)), timeoutMs);
	const signal = outerSignal ? AbortSignal.any([outerSignal, controller.signal]) : controller.signal;
	return { signal, cleanup: () => clearTimeout(timeoutId) };
}

export function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

export function normalizeAndValidateUrl(rawUrl: string): URL {
	const trimmed = rawUrl.trim();
	if (!trimmed) throw new Error("URL cannot be empty");
	if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) throw new Error("URL must start with http:// or https://");
	let url: URL;
	try { url = new URL(trimmed); } catch { throw new Error(`Invalid URL: ${trimmed}`); }
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http/https URLs supported");
	return url;
}

export async function fetchWithRedirects(initialUrl: URL, options: {
	headers: Record<string, string>; signal?: AbortSignal; maxRedirects: number; blockPrivateHosts: boolean;
}): Promise<{ response: Response; finalUrl: URL }> {
	let currentUrl = initialUrl;
	let redirects = 0;
	while (true) {
		if (options.blockPrivateHosts) await assertPublicUrl(currentUrl);
		const response = await fetch(currentUrl, { method: "GET", headers: options.headers, signal: options.signal, redirect: "manual" });
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			await response.body?.cancel().catch(() => {});
			const location = response.headers.get("location");
			if (!location) throw new Error(`Redirect from ${currentUrl} missing Location header`);
			if (redirects >= options.maxRedirects) throw new Error(`Too many redirects fetching ${initialUrl}`);
			const nextUrl = new URL(location, currentUrl);
			if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") throw new Error(`Redirected to unsupported protocol: ${nextUrl.protocol}`);
			currentUrl = nextUrl;
			redirects++;
			continue;
		}
		return { response, finalUrl: currentUrl };
	}
}

export async function readBodyWithLimit(response: Response, maxBytes: number, signal?: AbortSignal): Promise<{ buffer: Buffer; bytes: number }> {
	if (!response.body) return { buffer: Buffer.alloc(0), bytes: 0 };
	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let bytes = 0;
	try {
		while (true) {
			if (signal?.aborted) { await reader.cancel(signal.reason).catch(() => {}); throw signal.reason instanceof Error ? signal.reason : new Error("Cancelled"); }
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			bytes += value.byteLength;
			if (bytes > maxBytes) { await reader.cancel().catch(() => {}); throw new Error(`Response too large (exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB)`); }
			chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
		}
	} finally { reader.releaseLock(); }
	return { buffer: Buffer.concat(chunks), bytes };
}

export function parseContentType(header: string | null | undefined): ParsedContentType {
	const ct = header?.trim() ?? "";
	const [mimePart = ""] = ct.split(";");
	const mime = mimePart.trim().toLowerCase();
	const charsetMatch = ct.match(/charset\s*=\s*['"]?([^;'"]+)/i);
	return { contentType: ct, mime, charset: charsetMatch?.[1]?.trim().toLowerCase(), kind: classifyMime(mime) };
}

function classifyMime(mime: string): ContentKind {
	if (!mime) return "binary";
	if (HTML_MIMES.has(mime)) return "html";
	if (RASTER_MIMES.has(mime)) return "raster-image";
	if (mime === "image/svg+xml") return "svg";
	if (mime.startsWith("text/")) return mime === "text/html" ? "html" : "text";
	if (TEXT_MIMES.has(mime) || mime.endsWith("+xml") || mime.endsWith("+json")) return "text";
	return "binary";
}

export function decodeTextBuffer(buffer: Buffer, charset?: string): { text: string; decoder: string } {
	const norm = charset?.trim().toLowerCase();
	if (norm) { try { return { text: new TextDecoder(norm === "utf8" ? "utf-8" : norm).decode(buffer), decoder: norm }; } catch {} }
	return { text: new TextDecoder("utf-8").decode(buffer), decoder: "utf-8" };
}

export function shouldRetryWithFallbackUserAgent(response: Pick<Response, "status" | "headers">): boolean {
	return response.status === 403 && response.headers.get("cf-mitigated") === "challenge";
}

async function assertPublicUrl(url: URL): Promise<void> {
	const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
	if (hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error(`Blocked: ${url}`);
	if (isPrivateIp(hostname)) throw new Error(`Blocked private IP: ${url}`);
	try {
		const records = await lookup(hostname, { all: true, verbatim: true });
		for (const r of records) { if (isPrivateIp(r.address)) throw new Error(`Blocked private IP: ${url}`); }
	} catch (e) { if (e instanceof Error && e.message.startsWith("Blocked")) throw e; }
}

function isPrivateIp(ip: string): boolean {
	const stripped = ip.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
	if (stripped.startsWith("::ffff:")) return isPrivateIp(stripped.slice(7));
	const v = isIP(stripped);
	if (v === 4) {
		const [a, b] = stripped.split(".").map(p => parseInt(p, 10));
		return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
	}
	if (v === 6) return stripped === "::1" || stripped === "::" || stripped.startsWith("fc") || stripped.startsWith("fd") || /^fe[89ab]/.test(stripped);
	return false;
}
