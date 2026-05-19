import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const CONFIG_KEY = "toolBeautify";

function expandHome(input: string): string {
	if (input === "~") return homedir();
	if (input.startsWith("~/")) return join(homedir(), input.slice(2));
	return input;
}

function projectSettingsPath(cwd: string): string {
	let current = resolve(cwd);
	while (true) {
		const candidate = join(current, ".pi", "settings.json");
		if (existsSync(candidate)) return candidate;
		if (existsSync(join(current, ".pi")) || existsSync(join(current, ".git"))) return candidate;
		const parent = dirname(current);
		if (parent === current) return join(resolve(cwd), ".pi", "settings.json");
		current = parent;
	}
}

function settingsPaths(cwd = process.cwd()): string[] {
	const userDir = resolve(expandHome(process.env.PI_CODING_AGENT_DIR?.trim() || "~/.pi/agent"));
	return [join(userDir, "settings.json"), projectSettingsPath(cwd)];
}

interface CacheEntry {
	config: Record<string, unknown>;
	mtimes: Map<string, number>;
}

let cache: CacheEntry | null = null;

function isCacheStale(cwd?: string): boolean {
	if (!cache) return true;
	for (const path of settingsPaths(cwd)) {
		if (!existsSync(path)) {
			if (cache.mtimes.has(path)) return true;
			continue;
		}
		try {
			const mtime = statSync(path).mtimeMs;
			if (cache.mtimes.get(path) !== mtime) return true;
		} catch {
			return true;
		}
	}
	return false;
}

function readConfig(cwd?: string): Record<string, unknown> {
	if (!isCacheStale(cwd)) return cache!.config;

	const merged: Record<string, unknown> = {};
	const mtimes = new Map<string, number>();
	for (const path of settingsPaths(cwd)) {
		if (!existsSync(path)) continue;
		try {
			mtimes.set(path, statSync(path).mtimeMs);
			const parsed = JSON.parse(readFileSync(path, "utf8"));
			const config = parsed?.[CONFIG_KEY];
			if (config && typeof config === "object" && !Array.isArray(config)) Object.assign(merged, config);
		} catch {
			// ignore
		}
	}
	cache = { config: merged, mtimes };
	return merged;
}

export function invalidateConfigCache(): void {
	cache = null;
}

export function settingNumber(key: string, fallback: number, cwd?: string): number {
	const value = readConfig(cwd)[key];
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function settingBoolean(key: string, fallback: boolean, cwd?: string): boolean {
	const value = readConfig(cwd)[key];
	return typeof value === "boolean" ? value : fallback;
}

export function settingString(key: string, fallback: string, cwd?: string): string {
	const value = readConfig(cwd)[key];
	return typeof value === "string" ? value : fallback;
}

export function settingEnum<T extends string>(key: string, allowed: readonly T[], fallback: T, cwd?: string): T {
	const value = readConfig(cwd)[key];
	return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export type ReadOutputMode = "hidden" | "summary" | "preview";
export type SearchOutputMode = "hidden" | "count" | "preview";
export type McpOutputMode = "hidden" | "summary" | "preview";

export function readOutputMode(cwd?: string): ReadOutputMode {
	return settingEnum("readOutputMode", ["hidden", "summary", "preview"] as const, "preview", cwd);
}

export function searchOutputMode(cwd?: string): SearchOutputMode {
	return settingEnum("searchOutputMode", ["hidden", "count", "preview"] as const, "preview", cwd);
}

export function bashLiveOutputDelayMs(cwd?: string): number {
	return Math.max(0, Math.floor(settingNumber("bashLiveOutputDelayMs", 1000, cwd)));
}

export function bashLiveTailLines(cwd?: string): number {
	return Math.max(1, Math.floor(settingNumber("bashLiveTailLines", 4, cwd)));
}

export function bashCompletedTailLines(cwd?: string): number {
	return Math.max(0, Math.floor(settingNumber("bashCompletedTailLines", 4, cwd)));
}

export function mcpOutputMode(cwd?: string): McpOutputMode {
	return settingEnum("mcpOutputMode", ["hidden", "summary", "preview"] as const, "preview", cwd);
}