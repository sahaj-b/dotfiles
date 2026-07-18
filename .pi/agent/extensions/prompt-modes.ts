/**
 * Prompt Modes — configurable mode toggles that inject prompt files.
 *
 * Alt+P → cycle through prompt modes: off → mode1 → mode2 → ... → off
 * /pmode <name|off> → set mode explicitly
 *
 * Modes are defined in the CONFIG below. Each mode maps a name to a prompt
 * file path (resolved relative to ~/.pi/agent/prompts/ if not absolute).
 *
 * Prompt is injected once per session (not every turn). On resume/reload
 * the dedup check skips re-injection if already present.
 *
 * Emits "promptmode:changed" with { label, color }
 * so the statusline can render the indicator.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

// ═══════════════════════════════════════════════════════════
//  CONFIG — edit this to add/remove prompt modes
// ═══════════════════════════════════════════════════════════

const PROMPT_DIR = path.join(os.homedir(), ".pi", "agent", "prompts");

const MODE_CONFIG: Record<string, string> = {
	// mode name → prompt file path (absolute, or filename inside ~/.pi/agent/prompts/)
	research: path.join(PROMPT_DIR, "research.md"),
	plan: path.join(PROMPT_DIR, "plan.md"),
	// add more modes here, e.g.:
	// audit: "audit.md",           // resolves to ~/.pi/agent/prompts/audit.md
	// translate: "/full/path/to/translate.md",
};

const MODE_COLOR = "success";
const CUSTOM_TYPE_PREFIX = "promptmode:";

// ═══════════════════════════════════════════════════════════

const MODE_LIST = Object.keys(MODE_CONFIG);
let activeMode: string | null = null;
let injectedThisSession = false;

function resolvePromptPath(filePath: string): string {
	return path.isAbsolute(filePath) ? filePath : path.join(PROMPT_DIR, filePath);
}

function loadPrompt(name: string): string | null {
	const configPath = MODE_CONFIG[name];
	if (!configPath) return null;

	try {
		let content = fs
			.readFileSync(resolvePromptPath(configPath), "utf-8")
			.trim();
		// Strip trailing $@ placeholder (used in prompt files for user input injection)
		if (content.endsWith("\n$@")) content = content.slice(0, -3).trim();
		else if (content.endsWith("$@")) content = content.slice(0, -2).trim();
		return content;
	} catch {
		return null;
	}
}

function emitChanged(): void {
	pi?.events.emit("promptmode:changed", {
		label: activeMode ?? "",
		color: activeMode ? MODE_COLOR : "muted",
	});
}

function isAlreadyInjected(ctx: ExtensionContext): boolean {
	return ctx.sessionManager
		.getEntries()
		.some(
			(e: any) =>
				e.type === "custom_message" &&
				typeof e.customType === "string" &&
				e.customType.startsWith(CUSTOM_TYPE_PREFIX),
		);
}

let pi: ExtensionAPI | null = null;

// ═══════════════════════════════════════════════════════════
//  Extension Entry Point
// ═══════════════════════════════════════════════════════════

export default function promptModes(p: ExtensionAPI): void {
	pi = p;

	p.on("session_start", async (_event, ctx) => {
		injectedThisSession = false;

		// Restore mode from session entries
		activeMode = null;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (
				entry.type === "custom" &&
				typeof entry.customType === "string" &&
				entry.customType === "promptmode:state"
			) {
				const data = entry.data as { mode?: string } | undefined;
				if (data?.mode && MODE_CONFIG[data.mode]) activeMode = data.mode;
			}
		}
		emitChanged();

		if (!activeMode) return;
		if (isAlreadyInjected(ctx)) {
			injectedThisSession = true;
			return;
		}

		const content = loadPrompt(activeMode);
		if (!content) return;

		p.sendMessage(
			{
				customType: `${CUSTOM_TYPE_PREFIX}${activeMode}`,
				content,
				display: false,
			},
			{ deliverAs: "nextTurn" },
		);
		injectedThisSession = true;
	});

	p.on("session_shutdown", async () => {
		activeMode = null;
		injectedThisSession = false;
	});

	p.registerCommand("pmode", {
		description: `Set prompt mode: /pmode ${[...MODE_LIST, "off"].join(" | ")}`,
		handler: async (args, _ctx) => {
			const trimmed = (args ?? "").trim().toLowerCase();
			if (trimmed === "off" || trimmed === "") activeMode = null;
			else if (MODE_CONFIG[trimmed]) activeMode = trimmed;
			p.appendEntry("promptmode:state", { mode: activeMode ?? "" });
			emitChanged();
		},
	});

	p.registerShortcut("alt+m", {
		description: `Cycle prompt modes (Alt+M): off → ${MODE_LIST.join(" → ")} → off`,
		handler: async (ctx) => {
			const idx = MODE_LIST.indexOf(activeMode ?? "");
			const nextIdx = idx === -1 ? 0 : idx === MODE_LIST.length - 1 ? -1 : idx + 1;
			activeMode = nextIdx === -1 ? null : MODE_LIST[nextIdx];
			p.appendEntry("promptmode:state", { mode: activeMode ?? "" });
			emitChanged();
		},
	});
}
