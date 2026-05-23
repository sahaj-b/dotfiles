/**
 * Mode toggles: RO and Plan.
 *
 * Alt+m → cycle through modes: off → RO → Plan → off
 * /mode <ro|plan|off> → set mode explicitly
 *
 * Emits "mode:changed" events with { mode: string, color: ThemeColor }
 * so other extensions (e.g. statusline) can render the indicator.
 *
 * ── RO mode ──
 *   write/edit tools: BLOCKED entirely (no markdown gatekeeping)
 *   bash write-like commands: BLOCKED
 *
 * ── Plan mode ──
 *   write tool: ALLOWED only for new .md/.mdx files or those created this session
 *   edit tool: ALLOWED only for .md/.mdx files created this session
 *   bash write-like commands: BLOCKED
 *   Everything else remains available.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

// Mode identifiers
const RO = "RO";
const PLAN = "Plan";

// Theme colors for each active mode
const MODE_COLORS: Record<string, string> = {
	[RO]: "warning",
	[PLAN]: "mdCodeBlock",
};

// Messages sent to the LLM when mode changes (via mode:tool-change)
const MODE_PROMPTS: Record<string, string> = {
	[RO]: `[READ-ONLY MODE ACTIVE. write and edit tools are BLOCKED. Bash write/delete commands are also BLOCKED]`,
	[PLAN]: `[PLAN MODE ACTIVE. You CAN create/edit .md/.mdx files (if needed). All other writes/edits are BLOCKED. Bash write/delete commands are also BLOCKED.]`,
};

const OFF_PROMPT = `[MODES OFF. You CAN write, edit, and execute any commands now]`;

// Block messages shown to the LLM when violating restrictions
const BLOCK_MSG =
	"BLOCKED: tryna be oversmart dawg? You are in READ-ONLY MODE. This command was blocked because it would write/modify/delete files.";

const TOOL_BLOCK_MSG_RO =
	"BLOCKED: u have dyslexia? You are in READ-ONLY MODE. you don't have access to that tool";

const TOOL_BLOCK_MSG_PLAN =
	"BLOCKED: u have dyslexia? You are in PLAN MODE. you don't have access to that tool";

const ALLOWED_MARKDOWN_EXT = new Set([".md", ".mdx"]);

// ═══════════════════════════════════════════════════════════
//  BASH WRITE PATTERNS
// ═══════════════════════════════════════════════════════════

const WRITE_PATTERNS = [
	{ re: /(?<![=<>|&])>>?\s+\S/, label: "output redirect (> or >>)" },
	{ re: /cat\s*>\s*\S/, label: "cat redirect" },
	{ re: /\btee\b/, label: "tee" },
	{ re: /\bcp\b/, label: "cp" },
	{ re: /\bmv\b/, label: "mv" },
	{ re: /\btouch\b/, label: "touch" },
	{ re: /\bmkdir\b/, label: "mkdir" },
	{ re: /\bdd\b/, label: "dd" },
	{ re: /\brm\b/, label: "rm" },
	{ re: /\bsed\s+-i\b/, label: "sed -i" },
	{ re: /\bawk\s+-i\b/, label: "awk -i inplace" },
	{ re: /\bcurl\b.*\s-(\w*)o\b/, label: "curl -o" },
	{ re: /\bcurl\s+-O\b/, label: "curl -O" },
	{ re: /\bcurl\b.*--output\b/, label: "curl --output" },
	{ re: /\bwget\b/, label: "wget" },
	{
		re: /\bnpm\s+(install|i|add|remove|uninstall)\b/,
		label: "npm install/add",
	},
	{ re: /\bpnpm\s+(install|i|add|remove)\b/, label: "pnpm install/add" },
	{ re: /\byarn\s+(install|add|remove)\b/, label: "yarn install/add" },
	{ re: /\bbun\s+(install|i|add|remove)\b/, label: "bun install/add" },
	{ re: /\bpip3?\s+install\b/, label: "pip install" },
	{ re: /\bapt\s+(install|remove|purge)\b/, label: "apt install" },
	{ re: /\bmicrodnf\s+(install|remove)\b/, label: "microdnf install" },
	{ re: /\bchmod\b/, label: "chmod" },
	{ re: /\bchown\b/, label: "chown" },
	{ re: /\bln\s+(-s|-h|--symlink)\b/, label: "ln -s" },
	{ re: /\bmake\s+install\b/, label: "make install" },
];

let activeMode: string | null = null; // null = off, "RO", or "Plan"
const createdFiles = new Set<string>();

function isMarkdownPath(p: string): boolean {
	const ext = path.extname(p).toLowerCase();
	return ALLOWED_MARKDOWN_EXT.has(ext);
}

function isWriteLikeCommand(cmd: string): string | null {
	for (const { re, label } of WRITE_PATTERNS) {
		re.lastIndex = 0;
		if (re.test(cmd)) return label;
	}
	return null;
}

export default function modes(pi: ExtensionAPI): void {
	// ── Tool call interception ──

	pi.on("tool_call", async (event, _ctx) => {
		if (!activeMode) return;

		// ── RO mode: block write & edit entirely ──
		if (activeMode === RO) {
			if (event.toolName === "write" || event.toolName === "edit") {
				return { block: true, reason: TOOL_BLOCK_MSG_RO };
			}

			if (isToolCallEventType("bash", event)) {
				const cmd = event.input.command as string;
				const matched = isWriteLikeCommand(cmd);
				if (matched) {
					return { block: true, reason: BLOCK_MSG };
				}
			}
			return;
		}

		// ── Plan mode: md-gatekeeping (original RO behavior) ──
		if (activeMode === PLAN) {
			if (event.toolName === "write") {
				const filePath = event.input.path as string;
				if (!filePath || !isMarkdownPath(filePath)) {
					return { block: true, reason: TOOL_BLOCK_MSG_PLAN };
				}
				const absPath = path.resolve(filePath);
				if (fs.existsSync(absPath) && !createdFiles.has(absPath)) {
					return {
						block: true,
						reason:
							"BLOCKED: that file already exists and wasn't created by you this session. You can only write .md/.mdx files you created, or make a new one.",
					};
				}
				createdFiles.add(absPath);
				return;
			}

			if (event.toolName === "edit") {
				const filePath = event.input.path as string;
				if (!filePath) {
					return { block: true, reason: TOOL_BLOCK_MSG_PLAN };
				}
				const absPath = path.resolve(filePath);
				if (!createdFiles.has(absPath)) {
					return {
						block: true,
						reason:
							"BLOCKED: you can only edit .md/.mdx files YOU created this session.",
					};
				}
				return;
			}

			if (isToolCallEventType("bash", event)) {
				const cmd = event.input.command as string;
				const matched = isWriteLikeCommand(cmd);
				if (matched) {
					return { block: true, reason: BLOCK_MSG };
				}
			}
		}
	});

	// ── Mode change messaging ──

	function fireModeChangeMessage(mode: string | null): void {
		const key = mode ?? "off";
		const content =
			key === "off" ? OFF_PROMPT : (MODE_PROMPTS[key] ?? OFF_PROMPT);

		pi.sendMessage(
			{
				customType: "mode:tool-change",
				content,
				display: false,
			},
			{ deliverAs: "nextTurn" },
		);
	}

	function emitModeChanged(mode: string | null): void {
		if (mode) {
			pi.events.emit("mode:changed", {
				mode,
				color: MODE_COLORS[mode] ?? "warning",
			});
		} else {
			pi.events.emit("mode:changed", { mode: "", color: "muted" });
		}
	}

	// ── Mode setter ──

	function setMode(mode: string | null): void {
		if (mode === activeMode) return;

		activeMode = mode;
		emitModeChanged(mode);
		fireModeChangeMessage(mode);
	}

	// ── Commands ──

	pi.registerCommand("mode", {
		description: "Set mode: /mode ro | plan | off",
		handler: async (args, _ctx) => {
			const trimmed = (args ?? "").trim().toLowerCase();
			if (trimmed === RO.toLowerCase()) {
				setMode(RO);
			} else if (trimmed === PLAN.toLowerCase()) {
				setMode(PLAN);
			} else if (trimmed === "off" || trimmed === "") {
				setMode(null);
			}
		},
	});

	// ── Shortcuts ──

	pi.registerShortcut(Key.alt("m"), {
		description: "Cycle modes: off → RO → Plan → off",
		handler: async (_ctx) => {
			const cycle: Array<string | null> = [null, RO, PLAN];
			const idx = cycle.indexOf(activeMode);
			const next = cycle[(idx + 1) % cycle.length];
			setMode(next);
		},
	});

	// ── Session lifecycle ──

	pi.on("session_start", async () => {
		activeMode = null;
		createdFiles.clear();
		pi.events.emit("mode:changed", { mode: "", color: "muted" });
	});
}
