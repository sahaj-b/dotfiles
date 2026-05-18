// ── Provider fallback engine with cooldown tracking ──

import type { Provider, Capability } from "./providers/types.ts";

// ── Cooldown state ──

interface CooldownEntry {
	until: number;
	reason: string;
}

const cooldowns = new Map<string, CooldownEntry>();

const QUOTA_COOLDOWN_MS = 10 * 60 * 1000;   // 10 min for rate limits / quota
const NETWORK_COOLDOWN_MS = 2 * 60 * 1000;  // 2 min for network errors
const MAX_RETRY_AFTER_MS = 60 * 60 * 1000;  // 1 hour cap for retry-after headers

// ── Provider error class ──

/**
 * Structured error thrown by providers so the fallback engine can
 * extract status codes, Retry-After hints, and classify precisely.
 */
export class ProviderError extends Error {
	/** HTTP status code (if from an HTTP response). */
	readonly status?: number;

	/**
	 * Parsed Retry-After value in seconds (if the provider sent one).
	 * Undefined means no retry-after was advertised — use hardcoded defaults.
	 */
	readonly retryAfter?: number;

	/** Which provider produced this error. */
	readonly providerId: string;

	/** Truncated response body (if available). */
	readonly body?: string;

	/**
	 * Explicit error classification. When set to anything other than "other"
	 * it short-circuits the classifyError heuristic.
	 */
	readonly kind: ErrorKind;

	constructor(opts: {
		providerId: string;
		status?: number;
		retryAfter?: number;
		message?: string;
		body?: string;
		kind?: ErrorKind;
	}) {
		const msg = opts.message || `Provider '${opts.providerId}' error${opts.status ? ` (${opts.status})` : ""}`;
		super(msg);
		this.name = "ProviderError";
		this.providerId = opts.providerId;
		this.status = opts.status;
		this.retryAfter = opts.retryAfter;
		this.body = opts.body;
		this.kind = opts.kind ?? "other";
	}
}

/**
 * Parse the Retry-After header value (RFC 7231 §7.1.3).
 * Returns delay in seconds, or undefined if unparseable.
 */
export function parseRetryAfter(headerValue: string | null | undefined): number | undefined {
	if (!headerValue) return undefined;
	const trimmed = headerValue.trim();
	// Try delay-seconds (integer)
	const seconds = parseInt(trimmed, 10);
	if (!isNaN(seconds) && seconds >= 0 && String(seconds) === trimmed) return seconds;
	// Try HTTP-date (RFC 1123)
	const date = new Date(trimmed);
	if (!isNaN(date.getTime())) {
		return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
	}
	return undefined;
}

/**
 * Convenience helper for providers: reads a non-ok HTTP Response and
 * returns a ProviderError with status, retry-after, and body captured.
 */
export async function httpError(
	providerId: string,
	response: Response,
	context?: string,
): Promise<ProviderError> {
	const body = await response.text().catch(() => "");
	const label = context ?? providerId;
	return new ProviderError({
		providerId,
		status: response.status,
		retryAfter: parseRetryAfter(response.headers.get("retry-after")),
		message: `${label} error ${response.status}: ${body.slice(0, 300)}`,
		body: body.slice(0, 300),
	});
}

export function resetAllCooldowns(): void {
	cooldowns.clear();
}

export function isOnCooldown(providerId: string): boolean {
	const entry = cooldowns.get(providerId);
	if (!entry) return false;
	if (Date.now() >= entry.until) {
		cooldowns.delete(providerId);
		return false;
	}
	return true;
}

function recordCooldown(providerId: string, reason: string, durationMs: number): void {
	cooldowns.set(providerId, { until: Date.now() + durationMs, reason });
}

// ── Error classification ──

export type ErrorKind = "quota" | "auth" | "network" | "timeout" | "other";

export function classifyError(error: unknown): ErrorKind {
	// ProviderError with explicit status gives precise classification
	if (error instanceof ProviderError) {
		if (error.kind !== "other") return error.kind;
		if (error.status) {
			if (error.status === 401 || error.status === 403) return "auth";
			if (error.status === 429 || error.status === 402) return "quota";
			if (error.status >= 500) return "network";
		}
		// Fall through to message-based classification
	}
	if (!(error instanceof Error)) return "other";
	const msg = error.message.toLowerCase();

	// Timeout
	if (msg.includes("timed out") || msg.includes("timeout") || error.name === "TimeoutError") {
		return "timeout";
	}

	// Network
	if (
		msg.includes("econnrefused") ||
		msg.includes("ehostunreach") ||
		msg.includes("enetunreach") ||
		msg.includes("connection refused") ||
		msg.includes("connection reset") ||
		msg.includes("fetch failed") ||
		msg.includes("enotfound") ||
		msg.includes("getaddrinfo")
	) {
		return "network";
	}

	// Check for HTTP status codes in the message
	const statusMatch = msg.match(/\b(4\d{2}|5\d{2})\b/);
	if (statusMatch) {
		const status = parseInt(statusMatch[1], 10);
		if (status === 401 || status === 403) return "auth";
		if (status === 429 || status === 402) return "quota";
	}

	// Keyword-based
	if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("credits") || msg.includes("limit reached") || msg.includes("monthly limit")) {
		return "quota";
	}
	if (msg.includes("invalid api key") || msg.includes("unauthorized") || msg.includes("authentication")) {
		return "auth";
	}

	return "other";
}

function cooldownDuration(kind: ErrorKind, retryAfter?: number): number {
	// Prefer a provider-advertised retry-after (capped), falling back to hardcoded defaults
	if (retryAfter !== undefined && retryAfter > 0) {
		return Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
	}
	switch (kind) {
		case "quota": return QUOTA_COOLDOWN_MS;
		case "auth": return QUOTA_COOLDOWN_MS;
		case "network": return NETWORK_COOLDOWN_MS;
		case "timeout": return NETWORK_COOLDOWN_MS;
		case "other": return 0;
	}
}

// ── Fallback execution ──

export interface FallbackResult<T> {
	result: T;
	provider: string;
	fallbacksUsed: string[];
}

export interface FallbackFailure {
	provider: string;
	reason: string;
	kind: ErrorKind;
}

export async function executeWithFallback<T>(
	providers: Provider[],
	capability: Capability,
	execute: (provider: Provider) => Promise<T>,
	signal?: AbortSignal,
): Promise<FallbackResult<T>> {
	const failures: FallbackFailure[] = [];

	for (const provider of providers) {
		// Skip providers on cooldown
		if (isOnCooldown(provider.id)) {
			failures.push({ provider: provider.id, reason: "on cooldown", kind: "other" });
			continue;
		}

		// Skip providers that aren't available (no API key, etc.)
		if (!provider.isAvailable()) {
			failures.push({ provider: provider.id, reason: "not available", kind: "other" });
			continue;
		}

		// Check if cancelled
		if (signal?.aborted) {
			throw new Error("Operation cancelled");
		}

		try {
			const result = await execute(provider);
			return {
				result,
				provider: provider.id,
				fallbacksUsed: failures.map(f => f.provider),
			};
		} catch (error) {
			const kind = classifyError(error);
			const reason = error instanceof Error ? error.message : String(error);
			failures.push({ provider: provider.id, reason, kind });

			// Pull retry-after from ProviderError if available
			const retryAfter = error instanceof ProviderError ? error.retryAfter : undefined;

			// Record cooldown — prefers provider-advertised retry-after over hardcoded defaults
			const duration = cooldownDuration(kind, retryAfter);
			if (duration > 0) {
				recordCooldown(provider.id, reason, duration);
			}

			// Don't continue on abort
			if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
				throw new Error("Operation cancelled");
			}
		}
	}

	// All providers failed
	const attempted = failures.map(f => `${f.provider} (${f.reason})`).join(", ");
	throw new Error(`All providers failed: ${attempted}`);
}
