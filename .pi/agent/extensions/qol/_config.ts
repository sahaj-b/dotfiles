import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type QolConfig = Record<string, unknown>;

export function expandHome(input: string): string {
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

function piSettingsPaths(cwd = process.cwd()): string[] {
  const userDir = resolve(expandHome(process.env.PI_CODING_AGENT_DIR?.trim() || "~/.pi/agent"));
  return [join(userDir, "settings.json"), projectSettingsPath(cwd)];
}

function readQolConfig(cwd?: string): QolConfig {
  const merged: QolConfig = {};
  for (const path of piSettingsPaths(cwd)) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      const config = parsed?.["pi-qol"];
      if (config && typeof config === "object" && !Array.isArray(config)) Object.assign(merged, config);
    } catch {}
  }
  return merged;
}

export function settingBoolean(key: string, fallback: boolean, cwd?: string): boolean {
  const value = readQolConfig(cwd)[key];
  return typeof value === "boolean" ? value : fallback;
}

export function settingString(key: string, fallback: string, cwd?: string): string {
  const value = readQolConfig(cwd)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function settingStringAllowEmpty(key: string, fallback: string, cwd?: string): string {
  const value = readQolConfig(cwd)[key];
  return typeof value === "string" ? value.trim() : fallback;
}

export function settingNumber(key: string, fallback: number, cwd?: string): number {
  const value = readQolConfig(cwd)[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function boundedSettingNumber(key: string, fallback: number, min: number, max: number, cwd?: string): number {
  return Math.max(min, Math.min(max, Math.floor(settingNumber(key, fallback, cwd))));
}
