/**
 * Read-only mode toggle.
 *
 * /ro OR Alt+m → toggle read-only mode on/off
 *
 * Emits "mode:changed" events with { mode: string, color: ThemeColor }
 * so other extensions (e.g. statusline) can render the indicator.
 *
 * Tools are NOT restricted — write/edit are blocked at call time,
 * and bash write-like commands are intercepted. All other tools remain available.
 *
 * In RO mode, the agent CAN:
 *   - create new .md / .mdx files (write tool)
 *   - edit .md / .mdx files it created this session (write / edit tools)
 * Everything else (bash writes, non-.md writes, editing pre-existing files) stays blocked.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

const ALLOWED_MARKDOWN_EXT = new Set([".md", ".mdx"]);

// Tracks files the agent created during this session.
// Gates write/edit permission for .md/.mdx files.
const createdFiles = new Set<string>();

function isMarkdownPath(p: string): boolean {
	const ext = path.extname(p).toLowerCase();
	return ALLOWED_MARKDOWN_EXT.has(ext);
}

const WRITE_PATTERNS = [
	// Output redirection: > or >> (but not >> inside words or === comparisons)
	{ re: /(?<![=<>|&])>>?\s+\S/, label: "output redirect (> or >>)" },
	// Heredoc writing to file
	{ re: /cat\s*>\s*\S/, label: "cat redirect" },
	// File writers
	{ re: /\btee\b/, label: "tee" },
	{ re: /\bcp\b/, label: "cp" },
	{ re: /\bmv\b/, label: "mv" },
	{ re: /\btouch\b/, label: "touch" },
	{ re: /\bmkdir\b/, label: "mkdir" },
	{ re: /\bdd\b/, label: "dd" },
	{ re: /\brm\b/, label: "rm" },
	// In-place edits
	{ re: /\bsed\s+-i\b/, label: "sed -i" },
	{ re: /\bawk\s+-i\b/, label: "awk -i inplace" },
	// Network writes
	{ re: /\bcurl\b.*\s-(\w*)o\b/, label: "curl -o" },
	{ re: /\bcurl\s+-O\b/, label: "curl -O" },
	{ re: /\bcurl\b.*--output\b/, label: "curl --output" },
	{ re: /\bwget\b/, label: "wget" },
	// Package installs
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
	// Permissions / links
	{ re: /\bchmod\b/, label: "chmod" },
	{ re: /\bchown\b/, label: "chown" },
	{ re: /\bln\s+(-s|-h|--symlink)\b/, label: "ln -s" },
	// Build install
	{ re: /\bmake\s+install\b/, label: "make install" },
];

const BLOCK_MSG =
	"BLOCKED: you tryna be oversmart dawg? You are in READ-ONLY MODE. This command was blocked because it would write, modify, or delete files.";

const TOOL_BLOCK_MSG =
	"BLOCKED: do u have dyslexia? You are in READ-ONLY MODE. you don't have access to that tool";

function isWriteLikeCommand(cmd: string): string | null {
	for (const { re, label } of WRITE_PATTERNS) {
		re.lastIndex = 0;
		if (re.test(cmd)) return label;
	}
	return null;
}

export default function readOnly(pi: ExtensionAPI): void {
	let roActive = false;

	pi.on("tool_call", async (event, ctx) => {
		if (!roActive) return;

		// --- write tool: allow only new/existing .md/.mdx files we created ---
		if (event.toolName === "write") {
			const filePath = event.input.path as string;
			if (!filePath || !isMarkdownPath(filePath)) {
				return { block: true, reason: TOOL_BLOCK_MSG };
			}
			const absPath = path.resolve(filePath);
			// If the file already exists and wasn't created by us this session, block
			if (fs.existsSync(absPath) && !createdFiles.has(absPath)) {
				return {
					block: true,
					reason:
						"BLOCKED: that file already exists and wasn't created by you this session. You can only write .md/.mdx files you created, or make a new one.",
				};
			}
			createdFiles.add(absPath);
			return; // allow
		}

		// --- edit tool: allow only .md/.mdx files we created ---
		if (event.toolName === "edit") {
			const filePath = event.input.path as string;
			if (!filePath) {
				return { block: true, reason: TOOL_BLOCK_MSG };
			}
			const absPath = path.resolve(filePath);
			if (!createdFiles.has(absPath)) {
				return {
					block: true,
					reason:
						"BLOCKED: you can only edit .md/.mdx files YOU created this session.",
				};
			}
			return; // allow
		}

		// Block write-like bash commands
		if (isToolCallEventType("bash", event)) {
			const cmd = event.input.command as string;
			const matched = isWriteLikeCommand(cmd);
			if (matched) {
				return { block: true, reason: BLOCK_MSG };
			}
		}
	});

	function fireToolChangeMessage(active: boolean): void {
		if (active) {
			pi.sendMessage(
				{
					customType: "mode:tool-change",
					content: `[READ-ONLY MODE ACTIVE. You CAN create/edit .md/.mdx files. All other writes/edits are BLOCKED. Bash write/delete commands are also BLOCKED. dont write md/mdx files unless user EXPLICITLY say so]`,
					display: false,
				},
				{ deliverAs: "nextTurn" },
			);
		} else {
			pi.sendMessage(
				{
					customType: "mode:tool-change",
					content: `[READ-ONLY MODE OFF. You CAN write, edit, and execute any commands now]`,
					display: false,
				},
				{ deliverAs: "nextTurn" },
			);
		}
	}

	function setReadOnly(on: boolean, ctx: ExtensionContext): void {
		if (on === roActive) return;

		roActive = on;
		pi.events.emit("mode:changed", {
			mode: on ? "RO" : "",
			color: on ? "warning" : "muted",
		});

		fireToolChangeMessage(on);
	}

	pi.registerCommand("ro", {
		description: "Toggle read-only mode",
		handler: async (_args, ctx) => {
			setReadOnly(!roActive, ctx);
		},
	});

	pi.registerShortcut(Key.alt("m"), {
		description: "Toggle read-only mode",
		handler: async (ctx) => {
			setReadOnly(!roActive, ctx);
		},
	});

	pi.on("session_start", async () => {
		roActive = false;
		createdFiles.clear();
		pi.events.emit("mode:changed", { mode: "", color: "muted" });
	});
}
