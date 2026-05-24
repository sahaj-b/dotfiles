import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED,
  DEFAULT_FOCUS_DETECTION_SCRIPT,
  DEFAULT_NOTIFICATION_BODY_MAX_CHARS,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
  DEFAULT_NOTIFICATION_TIMEOUT_SECONDS,
  DEFAULT_NOTIFICATION_TITLE,
  DEFAULT_SOUND_ENABLED,
  DEFAULT_SUPPRESS_WHEN_FOCUSED,
  DEFAULT_TERM_INITIAL_TITLE,
  QUESTION_NOTIFY_DEDUP_MS,
} from "./constants";
import { settingBoolean, settingNumber, settingString, settingStringAllowEmpty } from "./_config";

export type QolNotificationKind = "ready" | "direction" | "question" | "task-complete" | "critical" | "test";
export type QolNotificationLevel = "info" | "warning" | "error";
export type SoundKind = "complete" | "error" | "permission" | "question" | "subagent_complete";

// ===== Sound Support =====

const SOUND_KIND_MAP: Partial<Record<QolNotificationKind, SoundKind>> = {
  "task-complete": "complete",
  critical: "error",
  question: "question",
  ready: "complete",
  direction: "complete",
  test: "complete",
};

function qolKindToSoundKind(kind: QolNotificationKind): SoundKind | undefined {
  return SOUND_KIND_MAP[kind];
}

let _lastSoundTime = 0;
const SOUND_DEBOUNCE_MS = 1000;

function findSoundsDir(): string | undefined {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidate = join(here, "sounds");
    if (existsSync(candidate)) return candidate;
  } catch {}
  const fallback = join(homedir(), "projects", "opencode-notifier", "sounds");
  if (existsSync(fallback)) return fallback;
  return undefined;
}

function getSoundPath(soundKind: SoundKind, cwd?: string): string | undefined {
  const customKey = `notification.sound.${soundKind}`;
  const customPath = settingStringAllowEmpty(customKey, "", cwd);
  if (customPath && existsSync(customPath)) return customPath;
  const dir = findSoundsDir();
  if (!dir) return undefined;
  const p = join(dir, `${soundKind}.wav`);
  return existsSync(p) ? p : undefined;
}

async function _runSoundCmd(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "ignore", detached: false });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

async function _wakeUpEarbuds(): Promise<void> {
  const dir = findSoundsDir();
  if (!dir) return;
  const silence = join(dir, "silence.wav");
  if (!existsSync(silence)) return;
  await _runSoundCmd("paplay", [silence]);
}

async function _playOnLinux(soundPath: string): Promise<void> {
  await _wakeUpEarbuds();
  await _runSoundCmd("paplay", [soundPath]);
}

async function _playOnWindows(soundPath: string): Promise<void> {
  await _runSoundCmd("powershell", ["-c", `(New-Object Media.SoundPlayer '${soundPath.replace(/'/g, "''")}').PlaySync()`]);
}

export async function playQolNotificationSound(soundKind: SoundKind, cwd?: string): Promise<void> {
  if (!settingBoolean("notification.sound", DEFAULT_SOUND_ENABLED, cwd)) return;
  const now = Date.now();
  if (now - _lastSoundTime < SOUND_DEBOUNCE_MS) return;
  _lastSoundTime = now;
  const soundPath = getSoundPath(soundKind, cwd);
  if (!soundPath) return;
  try {
    switch (platform()) {
      case "linux":
        await _playOnLinux(soundPath);
        break;
      case "win32":
        await _playOnWindows(soundPath);
        break;
    }
  } catch {}
}

// ===== Focus Detection =====

const _focusCache = new Map<string, { at: number; focused: boolean }>();
const FOCUS_CACHE_MS = 2000;

function _hyprctlActiveWindow(sessionName?: string): boolean {
  const result = execFileSync("hyprctl", ["activewindow", "-j"], {
    encoding: "utf8",
    timeout: 2000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (!result) return false;

  let w: any;
  try {
    w = JSON.parse(result);
  } catch {
    return false;
  }
  if (!w?.title) return false;

  const title: string = w.title;
  if (!/^π /i.test(title)) return false;

  if (sessionName) {
    const pattern = `π - ${sessionName.slice(0, 30)}`;
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`^${escaped}`, "i").test(title)) return false;
  }

  return true;
}

export function piWindowFocused(sessionName?: string, cwd?: string): boolean {
  const cacheKey = sessionName ?? "";
  const now = Date.now();
  const cached = _focusCache.get(cacheKey);
  if (cached && now - cached.at < FOCUS_CACHE_MS) return cached.focused;

  if (platform() === "linux") {
    try {
      const focused = _hyprctlActiveWindow(sessionName);
      _focusCache.set(cacheKey, { at: now, focused });
      return focused;
    } catch {
      // hyprctl not available — fall through to external script
    }
  }

  // Fallback: external focus detection script for non-Hyprland environments
  const scriptPath = settingStringAllowEmpty("notification.focusDetectionScript", DEFAULT_FOCUS_DETECTION_SCRIPT, cwd);
  if (!scriptPath || !existsSync(scriptPath)) return false;
  const termTitle = settingStringAllowEmpty("notification.termInitialTitle", DEFAULT_TERM_INITIAL_TITLE, cwd);
  const args = termTitle ? [sessionName ?? "", termTitle] : [sessionName ?? ""];
  try {
    const result = spawnSync(scriptPath, args, { stdio: "ignore", timeout: 2000, windowsHide: true });
    _focusCache.set(cacheKey, { at: now, focused: result.status === 0 });
  } catch {
    _focusCache.set(cacheKey, { at: now, focused: false });
  }
  return _focusCache.get(cacheKey)!.focused;
}

// ===== Bell =====

function writeTerminalBell(): void {
  try {
    process.stdout.write("\x07");
  } catch {}
}

// ===== Desktop Notifications =====

export function notifyDesktop(title: string, body: string, cwd?: string): void {
  if (!settingBoolean("notification.desktop", DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED, cwd)) return;
  const os = platform();
  const timeout = Math.max(0, Math.floor(settingNumber("notification.timeout", DEFAULT_NOTIFICATION_TIMEOUT_SECONDS, cwd) * 1000));
  try {
    if (os === "linux") {
      const args = timeout > 0 ? ["-t", String(timeout), title, body] : [title, body];
      spawn("notify-send", args, { stdio: "ignore", detached: true }).unref();
    } else if (os === "darwin") {
      const st = title.replace(/"/g, '\\"');
      const sb = body.replace(/"/g, '\\"');
      spawn("osascript", ["-e", `display notification "${sb}" with title "${st}"`], {
        stdio: "ignore",
        detached: true,
      }).unref();
    }
  } catch {}
}

const lastNotificationAt = new Map<string, number>();
const lastQuestionNotificationAt = new Map<string, number>();

export function sanitizeNotificationPart(input: string, maxChars = DEFAULT_NOTIFICATION_BODY_MAX_CHARS): string {
  const cleaned = input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxChars ? `${cleaned.slice(0, Math.max(0, maxChars - 1))}…` : cleaned;
}

function notificationEnabledFor(kind: QolNotificationKind, cwd?: string): boolean {
  if (!settingBoolean("notification.enabled", true, cwd)) return false;
  switch (kind) {
    case "ready": return settingBoolean("notification.onAgentReady", true, cwd);
    case "direction": return settingBoolean("notification.onDirectionNeeded", true, cwd);
    case "question": return settingBoolean("notification.onQuestion", true, cwd);
    case "task-complete": return settingBoolean("notification.onTaskComplete", true, cwd);
    case "critical": return settingBoolean("notification.onCritical", true, cwd);
    case "test": return true;
  }
}

export function sendQolNotification(
  ctx: ExtensionContext | undefined,
  kind: QolNotificationKind,
  body: string,
  level: QolNotificationLevel = "info",
  key: string = kind,
  options?: { sound?: SoundKind | false; desktop?: boolean },
): void {
  const cwd = ctx?.cwd;
  if (ctx && !ctx.hasUI) return;
  if (!notificationEnabledFor(kind, cwd)) return;
  const cooldownMs = Math.max(0, settingNumber("notification.cooldownSeconds", DEFAULT_NOTIFICATION_COOLDOWN_SECONDS, cwd) * 1000);
  const now = Date.now();
  const last = lastNotificationAt.get(key) ?? 0;
  if (cooldownMs > 0 && now - last < cooldownMs) return;
  lastNotificationAt.set(key, now);

  // Focus detection
  const suppressWhenFocused = settingBoolean("notification.suppressWhenFocused", DEFAULT_SUPPRESS_WHEN_FOCUSED, cwd);
  let sessionName: string | undefined;
  try { sessionName = ctx?.sessionManager?.getSessionName() ?? undefined; } catch {}
  const isFocused = suppressWhenFocused ? piWindowFocused(sessionName, cwd) : false;

  // Play sound (unless suppressed by focus)
  const suppressSoundWhenFocused = settingBoolean("notification.suppressSoundWhenFocused", false, cwd);
  const soundKind = options?.sound !== undefined ? options.sound : qolKindToSoundKind(kind);
  if (soundKind && (!isFocused || !suppressSoundWhenFocused)) {
    playQolNotificationSound(soundKind, cwd);
  }

  // Skip notification delivery when Pi window is focused
  if (isFocused) return;

  const title = sanitizeNotificationPart(settingString("notification.title", DEFAULT_NOTIFICATION_TITLE, cwd), 80) || DEFAULT_NOTIFICATION_TITLE;
  const text = sanitizeNotificationPart(body, Math.max(40, Math.floor(settingNumber("notification.bodyMaxChars", DEFAULT_NOTIFICATION_BODY_MAX_CHARS, cwd))));

  // Bell — in tmux the bell marks the window automatically
  if (settingBoolean("notification.bell", true, cwd)) writeTerminalBell();

  // Desktop notification
  if (options?.desktop !== false && settingBoolean("notification.desktop", DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED, cwd)) {
    notifyDesktop(title, text, cwd);
  }

  // Pi UI notification
  if (ctx?.hasUI && settingBoolean("notification.piUi", false, cwd)) ctx.ui.notify(text, level);
}

export function notifyQuestionOpened(ctx: ExtensionContext | undefined, title: string): void {
  const key = `question:${title}`;
  const now = Date.now();
  const last = lastQuestionNotificationAt.get(key) ?? 0;
  if (now - last < QUESTION_NOTIFY_DEDUP_MS) return;
  lastQuestionNotificationAt.set(key, now);
  for (const [storedKey, timestamp] of lastQuestionNotificationAt) {
    if (now - timestamp > 60_000) lastQuestionNotificationAt.delete(storedKey);
  }
  sendQolNotification(ctx, "question", `Input required: ${title}`, "warning", key);
}
