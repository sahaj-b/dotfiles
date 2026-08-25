/**
 * Kills the pi startup screen. Replaces the logo + keybinding hints + loaded-resources
 * listing with two lines:
 *
 *   CWD: ~/projects/foo
 *   Context: .pi/SYSTEM.md, AGENTS.md
 *
 * To get there, it also persists `quietStartup: true` (and `collapseChangelog: true`)
 * into the global settings file, because pi builds the startup header and the
 * `[Context]`/`[Skills]`/... listing from that setting *before* extensions load.
 * The extension header swap handles the current session; the setting makes every
 * future launch clean (no spacer lines, no resource listing).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

// --- context file discovery (mirrors pi's resource loader) ---

const CONTEXT_FILE_CANDIDATES = ["AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"];

function loadContextFileFromDir(dir: string): string | null {
  try {
    for (const filename of CONTEXT_FILE_CANDIDATES) {
      const filePath = join(dir, filename);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        return filePath;
      }
    }
  } catch {
    // Unreadable dir (EACCES etc.) — treat as no context file.
  }
  return null;
}

function collectContextFiles(cwd: string, agentDir: string, projectTrusted: boolean): string[] {
  const files: string[] = [];
  const seen = new Set<string>();

  // Global AGENTS.md, then AGENTS.md/CLAUDE.md walking up from cwd to the root.
  const globalContext = loadContextFileFromDir(agentDir);
  if (globalContext) {
    files.push(globalContext);
    seen.add(resolve(globalContext));
  }
  const ancestors: string[] = [];
  let current = resolve(cwd);
  while (true) {
    const file = loadContextFileFromDir(current);
    if (file && !seen.has(resolve(file))) {
      ancestors.unshift(file);
      seen.add(resolve(file));
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  files.push(...ancestors);

  // System prompt override: project `.pi/SYSTEM.md` (trusted only) else global SYSTEM.md.
  const projectSystem = join(cwd, CONFIG_DIR_NAME, "SYSTEM.md");
  const globalSystem = join(agentDir, "SYSTEM.md");
  if (projectTrusted && existsSync(projectSystem)) files.push(projectSystem);
  else if (existsSync(globalSystem)) files.push(globalSystem);

  // Appended system prompt: project `.pi/APPEND_SYSTEM.md` (trusted only) else global.
  const projectAppend = join(cwd, CONFIG_DIR_NAME, "APPEND_SYSTEM.md");
  const globalAppend = join(agentDir, "APPEND_SYSTEM.md");
  if (projectTrusted && existsSync(projectAppend)) files.push(projectAppend);
  else if (existsSync(globalAppend)) files.push(globalAppend);

  return files;
}

// --- path display helpers (same style as pi's startup listing) ---

function shortenPath(p: string, cwd: string): string {
  const absolute = resolve(p);
  const relativePath = relative(resolve(cwd), absolute);
  if (relativePath && !relativePath.startsWith("..")) {
    return relativePath;
  }
  const home = homedir();
  return absolute.startsWith(home) ? `~${absolute.slice(home.length)}` : absolute;
}

function formatCwd(cwd: string): string {
  const home = homedir();
  return cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}

// --- settings persistence ---

function setQuietStartup(quiet: boolean, collapseChangelog: boolean) {
  try {
    const settingsPath = join(getAgentDir(), "settings.json");
    const current = existsSync(settingsPath)
      ? (JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, unknown>)
      : {};
    if (current.quietStartup === quiet && current.collapseChangelog === collapseChangelog) {
      return;
    }
    if (!existsSync(settingsPath)) {
      mkdirSync(dirname(settingsPath), { recursive: true });
    }
    writeFileSync(
      settingsPath,
      JSON.stringify({ ...current, quietStartup: quiet, collapseChangelog }, null, 2) + "\n",
      "utf-8",
    );
  } catch {
    // Never let startup crash over cosmetics.
  }
}

export default function (pi: ExtensionAPI) {
  // Fires at extension load, before the UI is up. Takes effect next launch.
  setQuietStartup(true, true);

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const cwd = ctx.cwd;
    const contextFiles = collectContextFiles(cwd, getAgentDir(), ctx.isProjectTrusted());

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        // Rebuild every render: `theme` is a live proxy, so this recolors
        // correctly on theme hot-swaps. Lines must never exceed width.
        const cwdLine = `${theme.fg("warning", "CWD:")} ${theme.fg("text", formatCwd(cwd))}`;
        const contextList = contextFiles.length
          ? theme.fg("muted", contextFiles.map((file) => shortenPath(file, cwd)).join(", "))
          : theme.fg("dim", "—");
        const contextLine = `${theme.fg("warning", "Context:")} ${contextList}`;
        return [cwdLine, contextLine].map((line) => truncateToWidth(line, width));
      },
      invalidate() {},
    }));
  });
}
