/**
 * Mode toggles: RO and MD.
 *
 * Ctrl+Shift+X → cycle through modes: off → RO → MD → off
 * /mode <ro|md|off> → set mode explicitly
 *
 * Emits "mode:changed" events with { mode: string, color: ThemeColor }
 * so other extensions (e.g. statusline) can render the indicator.
 *
 * ── RO mode ──
 *   write/edit tools: BLOCKED entirely (no markdown gatekeeping)
 *   bash write-like commands: BLOCKED
 *
 * ── MD mode ──
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
const MD = "MD";

// Theme colors for each active mode
const MODE_COLORS: Record<string, string> = {
	[RO]: "warning",
	[MD]: "warning",
};

// Messages sent to the LLM when mode changes (via mode:tool-change)
const MODE_PROMPTS: Record<string, string> = {
	[RO]: `[READ-ONLY MODE ACTIVE. write and edit tools are BLOCKED. Bash write/delete commands are also BLOCKED]`,
};

const OFF_PROMPT = `[MODES OFF. You CAN write, edit, and execute any commands now]`;

// Block messages shown to the LLM when violating restrictions
const BLOCK_MSG =
	"BLOCKED: tryna be oversmart dawg? You are in READ-ONLY MODE. This command was blocked because it would write/modify/delete files.";

const TOOL_BLOCK_MSG_RO =
	"BLOCKED: u have dyslexia? You are in READ-ONLY MODE. you don't have access to that tool";

const TOOL_BLOCK_MSG_MD =
	"BLOCKED: u have dyslexia? You are in MD MODE. you don't have access to that tool";

const ALLOWED_MARKDOWN_EXT = new Set([".md", ".mdx"]);

// ═══════════════════════════════════════════════════════════
//  BASH WRITE PATTERNS
// ═══════════════════════════════════════════════════════════

const WRITE_PATTERNS = [
	// ── Output redirection ──
	{ re: /(?<![=<>|&])>>?\s+\S/, label: "output redirect (> or >>)" },
	{ re: /cat\s*>\s*\S/, label: "cat redirect" },
	{ re: /\btee\b/, label: "tee" },

	// ── File manipulation ──
	{ re: /\bcp\b/, label: "cp" },
	{ re: /\bmv\b/, label: "mv" },
	{ re: /\btouch\b/, label: "touch" },
	{ re: /\bmkdir\b/, label: "mkdir" },
	{ re: /\bdd\b/, label: "dd" },
	{ re: /\brm\b/, label: "rm" },
	{ re: /\brmdir\b/, label: "rmdir" },
	{ re: /\bln\s+(-s|-h|--symlink)\b/, label: "ln -s" },
	{ re: /\bchmod\b/, label: "chmod" },
	{ re: /\bchown\b/, label: "chown" },
	{ re: /\bchgrp\b/, label: "chgrp" },
	{ re: /\btruncate\b/, label: "truncate" },
	{ re: /\bshred\b/, label: "shred" },
	{ re: /\bsync\b/, label: "sync" },

	// ── Text processing (in-place) ──
	{ re: /\bsed\s+-i\b/, label: "sed -i" },
	{ re: /\bawk\s+-i\b/, label: "awk -i inplace" },

	// ── Network downloads ──
	{ re: /\bcurl\b.*\s-(\w*)o\b/, label: "curl -o" },
	{ re: /\bcurl\s+-O\b/, label: "curl -O" },
	{ re: /\bcurl\b.*--output\b/, label: "curl --output" },
	{ re: /\bwget\b/, label: "wget" },

	// ── Package managers ──
	{ re: /\bnpm\s+(install|i|add|remove|uninstall|update|upgrade|ci)\b/, label: "npm install/add" },
	{ re: /\bpnpm\s+(install|i|add|remove|update|upgrade)\b/, label: "pnpm install/add" },
	{ re: /\byarn\s+(install|add|remove|update|upgrade)\b/, label: "yarn install/add" },
	{ re: /\bbun\s+(install|i|add|remove|update|upgrade)\b/, label: "bun install/add" },
	{ re: /\bpip3?\s+install\b/, label: "pip install" },
	{ re: /\bgem\s+install\b/, label: "gem install" },
	{ re: /\bcargo\s+(install|update)\b/, label: "cargo install" },
	{ re: /\bgo\s+install\b/, label: "go install" },

	// ── System package managers ──
	{ re: /\bapt\s+(install|remove|purge|upgrade)\b/, label: "apt install" },
	{ re: /\bmicrodnf\s+(install|remove)\b/, label: "microdnf install" },
	{ re: /\byum\s+(install|remove|update)\b/, label: "yum install" },
	{ re: /\bdnf\s+(install|remove|update)\b/, label: "dnf install" },
	{ re: /\bpacman\s+(-S|--sync)\b/, label: "pacman install" },
	{ re: /\bbrew\s+(install|uninstall|upgrade)\b/, label: "brew install" },
	{ re: /\bsnap\s+(install|remove)\b/, label: "snap install" },

	// ── Git (destructive/state-changing) ──
	{ re: /\bgit\s+push\b/, label: "git push" },
	{ re: /\bgit\s+push\s+.*--force\b/, label: "git push --force" },
	{ re: /\bgit\s+push\s+.*-f\b/, label: "git push -f" },
	{ re: /\bgit\s+commit\b/, label: "git commit" },
	{ re: /\bgit\s+reset\b/, label: "git reset" },
	{ re: /\bgit\s+clean\b/, label: "git clean" },
	{ re: /\bgit\s+stash\s+(drop|clear)\b/, label: "git stash drop/clear" },
	{ re: /\bgit\s+branch\s+(-d|-D)\b/, label: "git branch -d/-D" },
	{ re: /\bgit\s+checkout\s+--\s+\./, label: "git checkout -- ." },
	{ re: /\bgit\s+restore\s+\./, label: "git restore ." },
	{ re: /\bgit\s+merge\b/, label: "git merge" },
	{ re: /\bgit\s+rebase\b/, label: "git rebase" },
	{ re: /\bgit\s+filter-branch\b/, label: "git filter-branch" },
	{ re: /\bgit\s+reflog\s+expire\b/, label: "git reflog expire" },
	{ re: /\bgit\s+gc\s+--prune\b/, label: "git gc --prune" },
	{ re: /\bgit\s+tag\s+(-d|-f)\b/, label: "git tag -d/-f" },
	{ re: /\bgit\s+push\s+.*--delete\b/, label: "git push --delete" },

	// ── Docker / Containers ──
	{ re: /\bdocker\s+(rm|stop|kill|rmi|volume\s+rm|volume\s+prune|system\s+prune)\b/, label: "docker destructive" },
	{ re: /\bkubectl\s+delete\b/, label: "kubectl delete" },
	{ re: /\bhelm\s+uninstall\b/, label: "helm uninstall" },

	// ── Cloud / Infrastructure ──
	{ re: /\bterraform\s+(destroy|apply)\b/, label: "terraform destroy/apply" },
	{ re: /\bpulumi\s+destroy\b/, label: "pulumi destroy" },
	{ re: /\baws\s+s3\s+(rm|rb)\b/, label: "aws s3 rm/rb" },
	{ re: /\baws\s+(ec2\s+terminate|rds\s+delete|cloudformation\s+delete|iam\s+delete)\b/, label: "aws destructive" },
	{ re: /\bgcloud\s+(compute\s+instances\s+delete|sql\s+instances\s+delete|storage\s+rm)\b/, label: "gcloud destructive" },
	{ re: /\bdoctl\s+(compute\s+droplet\s+delete|databases\s+delete)\b/, label: "doctl destructive" },

	// ── Databases ──
	{ re: /\bredis-cli\s+FLUSH(ALL|DB)\b/, label: "redis flush" },
	{ re: /\bdropdb\b/, label: "dropdb" },
	{ re: /\bmysqladmin\s+drop\b/, label: "mysqladmin drop" },
	{ re: /\bmongo(?:osh)?\s+.*dropDatabase\b/, label: "mongo dropDatabase" },

	// ── Deployment / Hosting ──
	{ re: /\bvercel\s+(remove|projects?\s+rm)\b/, label: "vercel remove" },
	{ re: /\bnetlify\s+(sites?:delete|functions?:delete)\b/, label: "netlify delete" },
	{ re: /\bheroku\s+(apps?:destroy|pg:reset)\b/, label: "heroku destroy" },
	{ re: /\bfly\s+(apps?\s+destroy|destroy)\b/, label: "fly destroy" },
	{ re: /\bwrangler\s+(delete|r2\s+bucket\s+delete|d1\s+delete)\b/, label: "wrangler delete" },
	{ re: /\bfirebase\s+(projects?:delete|hosting:disable|functions?:delete)\b/, label: "firebase delete" },
	{ re: /\b(serverless|sls)\s+remove\b/, label: "serverless remove" },
	{ re: /\bsam\s+delete\b/, label: "sam delete" },
	{ re: /\bsupabase\s+db\s+reset\b/, label: "supabase db reset" },

	// ── Process / System ──
	{ re: /\bkill\b/, label: "kill" },
	{ re: /\bpkill\b/, label: "pkill" },
	{ re: /\bkillall\b/, label: "killall" },
	{ re: /\bsystemctl\s+(stop|disable|mask|restart|reload)\b/, label: "systemctl" },
	{ re: /\bshutdown\b/, label: "shutdown" },
	{ re: /\breboot\b/, label: "reboot" },
	{ re: /\bcrontab\s+(-r|-e)\b/, label: "crontab" },
	{ re: /\biptables\b/, label: "iptables" },
	{ re: /\bmkfs\b/, label: "mkfs" },
	{ re: /\bumount\b/, label: "umount" },

	// ── Package unpublishing / Registry ──
	{ re: /\bnpm\s+unpublish\b/, label: "npm unpublish" },
	{ re: /\bgh\s+repo\s+delete\b/, label: "gh repo delete" },

	// ── Misc destructive ──
	{ re: /\bhistory\s+-c\b/, label: "history -c" },
	{ re: /\bsetenforce\s+0\b/, label: "setenforce 0" },
	{ re: /\bufw\s+disable\b/, label: "ufw disable" },
];

let activeMode: string | null = null; // null = off, "RO", or "MD"
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

		// ── MD mode: md-gatekeeping ──
		if (activeMode === MD) {
			if (event.toolName === "write") {
				const filePath = event.input.path as string;
				if (!filePath || !isMarkdownPath(filePath)) {
					return { block: true, reason: TOOL_BLOCK_MSG_MD };
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
					return { block: true, reason: TOOL_BLOCK_MSG_MD };
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
		pi.appendEntry("mode:state", { mode: mode ?? "" });
		emitModeChanged(mode);
		fireModeChangeMessage(mode);
	}

	// ── Commands ──

	pi.registerCommand("mode", {
		description: "Set mode: /mode ro | md | off",
		handler: async (args, _ctx) => {
			const trimmed = (args ?? "").trim().toLowerCase();
			if (trimmed === RO.toLowerCase()) {
				setMode(RO);
			} else if (trimmed === MD.toLowerCase()) {
				setMode(MD);
			} else if (trimmed === "off" || trimmed === "") {
				setMode(null);
			}
		},
	});

	// ── Shortcuts ──

	pi.registerShortcut(Key.ctrlShift("x"), {
		description: "Cycle modes: off → RO → MD → off (Ctrl+Shift+X)",
		handler: async (_ctx) => {
			const cycle: Array<string | null> = [null, RO, MD];
			const idx = cycle.indexOf(activeMode);
			const next = cycle[(idx + 1) % cycle.length];
			setMode(next);
		},
	});

	// ── Session lifecycle ──

	pi.on("session_start", async (_event, ctx) => {
		// Restore mode from session entries
		activeMode = null;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (
				entry.type === "custom" &&
				typeof entry.customType === "string" &&
				entry.customType === "mode:state"
			) {
				const data = entry.data as { mode?: string } | undefined;
				if (data?.mode) activeMode = data.mode;
			}
		}
		createdFiles.clear();
		pi.events.emit("mode:changed", {
			mode: activeMode ?? "",
			color: activeMode ? (MODE_COLORS[activeMode] ?? "warning") : "muted",
		});
	});

	pi.on("session_shutdown", async () => {
		activeMode = null;
		createdFiles.clear();
	});
}
