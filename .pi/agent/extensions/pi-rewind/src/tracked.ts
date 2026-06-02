import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import { join } from "path";

function getTrackedFilePath(): string {
  const piDir = join(homedir(), ".pi");
  if (!existsSync(piDir)) {
    mkdirSync(piDir, { recursive: true });
  }
  return join(piDir, "rewind-tracked.json");
}

export function loadTrackedDirs(): string[] {
  const path = getTrackedFilePath();
  if (!existsSync(path)) return [];
  try {
    const data = readFileSync(path, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addTrackedDir(dir: string): void {
  const dirs = loadTrackedDirs();
  if (!dirs.includes(dir)) {
    dirs.push(dir);
    writeFileSync(getTrackedFilePath(), JSON.stringify(dirs, null, 2));
  }
}

/**
 * Deterministic shadow repo path for a tracked directory.
 * The `.git` lives here instead of inside the user's project.
 */
export function getShadowRepoPath(dir: string): string {
  const hash = createHash("sha256").update(dir).digest("hex").slice(0, 16);
  return join(homedir(), ".pi", "rewind-repos", hash);
}
