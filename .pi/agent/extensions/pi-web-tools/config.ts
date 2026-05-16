// ── Config loading and credential resolution ──

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderId, ToolConfig, WebToolsConfig } from "./types.ts";

const CONFIG_PATH = join(homedir(), ".pi", "agent", "web-tools.json");

const commandCache = new Map<string, { value?: string; error?: string }>();

// ── Default fallback chains ──

const DEFAULT_TOOL_PROVIDERS: Record<string, ProviderId[]> = {
	web_search: ["exa", "firecrawl", "tavily", "exa-free"],
	code_search: ["exa"],
	web_crawl: ["firecrawl", "tavily"],
	web_extract: ["firecrawl", "tavily"],
};

const DEFAULT_TOOL_CONFIG: Record<string, Partial<ToolConfig>> = {
	web_search: { maxResults: 8, timeoutSeconds: 30 },
	code_search: { maxTokens: 5000, timeoutSeconds: 30 },
	web_fetch: { timeoutSeconds: 30, maxResponseMB: 5, defaultFormat: "markdown" },
	web_crawl: { maxDepth: 2, maxPages: 10, timeoutSeconds: 60 },
	web_extract: { timeoutSeconds: 30 },
};

// ── Config resolution ──

/**
 * Resolve a config value that can be:
 * - An UPPER_SNAKE_CASE string → treated as env var name
 * - A "!command" string → executed, result cached
 * - Any other string → used as literal value
 */
export function resolveConfigValue(reference: string | undefined): string | undefined {
	if (!reference) return undefined;

	// Shell command
	if (reference.startsWith("!")) {
		const cached = commandCache.get(reference);
		if (cached) {
			if (cached.error) throw new Error(cached.error);
			return cached.value;
		}
		try {
			const output = execSync(reference.slice(1), {
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim();
			const value = output.length > 0 ? output : undefined;
			commandCache.set(reference, { value });
			return value;
		} catch (error) {
			const errorMessage = (error as Error).message;
			commandCache.set(reference, { error: errorMessage });
			throw error;
		}
	}

	// Environment variable
	const envValue = process.env[reference];
	if (envValue !== undefined) return envValue;

	// If it looks like an env var name but isn't set, return undefined
	if (/^[A-Z][A-Z0-9_]*$/.test(reference)) return undefined;

	// Literal value
	return reference;
}

/**
 * Resolve an API key for a provider. Checks env var directly, then config.
 */
export function resolveApiKey(providerId: ProviderId, config: WebToolsConfig): string | undefined {
	// Default env var names
	const envVarMap: Record<string, string> = {
		exa: "EXA_API_KEY",
		firecrawl: "FIRECRAWL_API_KEY",
		tavily: "TAVILY_API_KEY",
	};

	// Config override
	const configKey = config.providers?.[providerId]?.apiKey;
	if (configKey) {
		return resolveConfigValue(configKey);
	}

	// Default env var
	const envVar = envVarMap[providerId];
	if (envVar) {
		return process.env[envVar] || undefined;
	}

	return undefined;
}

/**
 * Get the provider list for a tool, falling back to defaults.
 */
export function getToolProviders(toolId: string, config: WebToolsConfig): ProviderId[] {
	const toolConfig = config.tools?.[toolId as keyof typeof config.tools];
	if (toolConfig?.providers && toolConfig.providers.length > 0) {
		return toolConfig.providers;
	}
	return DEFAULT_TOOL_PROVIDERS[toolId] ?? [];
}

/**
 * Get merged tool config with defaults.
 */
export function getToolConfig(toolId: string, config: WebToolsConfig): ToolConfig {
	const defaults = DEFAULT_TOOL_CONFIG[toolId] ?? {};
	const userConfig = config.tools?.[toolId as keyof typeof config.tools] ?? {};
	return { ...defaults, ...userConfig };
}

/**
 * Load config from ~/.pi/agent/web-tools.json
 */
export function loadConfig(): WebToolsConfig {
	if (!existsSync(CONFIG_PATH)) return {};

	try {
		const raw = readFileSync(CONFIG_PATH, "utf-8");
		return JSON.parse(raw) as WebToolsConfig;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[web-tools] Failed to parse config at ${CONFIG_PATH}: ${message}`);
		return {};
	}
}

/**
 * Get a human-readable provider status summary.
 */
export function getProviderStatus(config: WebToolsConfig): string {
	const lines: string[] = ["Web Tools — Provider Status", ""];

	const providerIds: ProviderId[] = ["exa", "exa-free", "firecrawl", "tavily"];
	for (const id of providerIds) {
		if (id === "exa-free") {
			lines.push(`  ${id}: ✓ available (free, no key needed)`);
			continue;
		}
		const key = resolveApiKey(id, config);
		const status = key ? "✓ configured" : "✗ no API key";
		lines.push(`  ${id}: ${status}`);
	}

	lines.push("");
	lines.push("Default chains:");
	for (const [tool, providers] of Object.entries(DEFAULT_TOOL_PROVIDERS)) {
		const userProviders = getToolProviders(tool, config);
		const chain = userProviders.join(" → ");
		lines.push(`  ${tool}: ${chain}`);
	}

	return lines.join("\n");
}
