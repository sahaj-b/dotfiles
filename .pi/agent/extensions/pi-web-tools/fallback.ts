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

function cooldownDuration(kind: ErrorKind): number {
	switch (kind) {
		case "quota": return QUOTA_COOLDOWN_MS;
		case "auth": return QUOTA_COOLDOWN_MS; // don't retry auth errors quickly
		case "network": return NETWORK_COOLDOWN_MS;
		case "timeout": return NETWORK_COOLDOWN_MS;
		case "other": return 0; // no cooldown for unknown errors
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

			// Record cooldown
			const duration = cooldownDuration(kind);
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
