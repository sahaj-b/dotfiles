/**
 * Minimal subagents extension.
 * Modified version of https://github.com/amosblomqvist/pi-config/tree/main/extensions/subagents
 * Registers a single `subagent` tool with three agents: scout, researcher, worker.
 * Supports single and parallel execution. Output is verbal only (no file handoff).
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	getMarkdownTheme,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import {
	Container,
	Markdown,
	Spacer,
	Text,
	visibleWidth,
} from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ── Types ──────────────────────────────────────────────────────────────

interface AgentEntry {
	name?: string;
	model: string;
	commands: string[];
	systemPrompt?: string;
	thinking?: string;
}

const AGENTS: Record<string, AgentEntry> = {
	scout: {
		name: "scout",
		model: "oc/deepseek-v4-flash-free",
		commands: ["/mode ro"],
		systemPrompt:
			"You are a codebase explorer. Explore the codebase extensively and deeply to find the relevant information needed, using tools provided",
		thinking: "medium",
	},
	researcher: {
		name: "researcher",
		model: "oc/deepseek-v4-flash-free",
		commands: [],
		systemPrompt: "~/.pi/agent/prompts/research.md",
		thinking: "medium",
	},
	worker: {
		name: "worker",
		model: "oc/deepseek-v4-flash-free",
		commands: [],
		thinking: "medium",
	},
};

interface ToolEvent {
	tool: string;
	args: string;
	/** Matches the producing tool_execution_start/update/end event. */
	toolCallId?: string;
	/**
	 * "running" while between tool_execution_start and tool_execution_end; flipped
	 * to "done" on end. We store every in-flight call in recentTools (keyed by
	 * toolCallId) rather than a single current-tool slot, because pi-agent-core
	 * dispatches a turn's tool calls in parallel via Promise.all — a single slot
	 * would let the second start overwrite the first.
	 */
	status: "running" | "done";
	/**
	 * Live progress of subagents spawned by this tool call. Populated only for
	 * `subagent` tool calls, from the `partialResult.details.results` payload of
	 * `tool_execution_update` events (and refreshed once more from the end
	 * event's final results). Recursive: each child's own progress may carry
	 * further children via its `recentTools[i].children`.
	 */
	children?: AgentResult[];
}

interface AgentProgress {
	agent: string;
	status: "pending" | "running" | "completed" | "failed";
	task: string;
	/**
	 * Chronological log of tool calls — running and done interleaved. The
	 * renderer prefixes running entries with `▸` and done ones with `  `.
	 */
	recentTools: ToolEvent[];
	toolCount: number;
	tokens: number;
	durationMs: number;
	lastMessage: string;
	error?: string;
}

interface AgentResult {
	agent: string;
	task: string;
	output: string;
	exitCode: number;
	progress: AgentProgress;
	model?: string;
	contextWindow?: number;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		turns: number;
	};
}

interface Details {
	results: AgentResult[];
}

// ── Pi Binary Resolution ──────────────────────────────────────────────

function resolvePiBinary(): { command: string; baseArgs: string[] } {
	const entry = process.argv[1];
	if (entry) {
		try {
			const realEntry = fs.realpathSync(entry);
			if (/\.(?:mjs|cjs|js)$/i.test(realEntry)) {
				return { command: process.execPath, baseArgs: [realEntry] };
			}
		} catch {}
	}
	return { command: "pi", baseArgs: [] };
}

// ── Formatting Utilities ──────────────────────────────────────────────

function formatTokens(n: number): string {
	return n < 1000
		? String(n)
		: n < 10000
			? `${(n / 1000).toFixed(1)}k`
			: `${Math.round(n / 1000)}k`;
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function formatContextUsage(
	tokens: number,
	contextWindow: number | undefined,
): string {
	if (!contextWindow) return `${formatTokens(tokens)} ctx`;
	const pct = (tokens / contextWindow) * 100;
	const maxStr =
		contextWindow >= 1_000_000
			? `${(contextWindow / 1_000_000).toFixed(1)}M`
			: `${Math.round(contextWindow / 1000)}k`;
	return `${pct.toFixed(1)}%/${maxStr}`;
}

function truncLine(text: string, maxWidth: number): string {
	// Collapse embedded newlines to keep tool events on one visual line.
	if (text.includes("\n") || text.includes("\r")) {
		text = text.replace(/\r?\n/g, "↵ ");
	}
	if (visibleWidth(text) <= maxWidth) return text;
	let result = "";
	let width = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		// Skip ANSI escape sequences (zero-width)
		if (ch === "\x1b") {
			const match = text.slice(i).match(/^\x1b\[[0-9;]*m/);
			if (match) {
				result += match[0];
				i += match[0].length - 1;
				continue;
			}
		}
		if (width >= maxWidth - 1) {
			return result + "…";
		}
		result += ch;
		width++;
	}
	return result;
}

// ── Subagent Execution ────────────────────────────────────────────────

async function buildPiArgs(
	agent: AgentEntry,
	task: string,
	cwd: string,
): Promise<{ args: string[] }> {
	const piBin = resolvePiBinary();

	const args = [
		...piBin.baseArgs,
		"--mode",
		"rpc",
		"--no-session",
		"--no-context-files",
	];

	args.push("--model", agent.model);
	if (agent.thinking) args.push("--thinking", agent.thinking);

	if (agent.systemPrompt) {
		const resolvedPath = agent.systemPrompt.replace(
			/^~(?=$|\/|\\)/,
			os.homedir(),
		);
		args.push("--append-system-prompt", resolvedPath);
	}

	return { args: [piBin.command, ...args] };
}

function extractTextFromContent(content: unknown): string {
	if (!content) return "";
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join("\n");
	}
	return "";
}

/** Collapse whitespace (incl. newlines) into a single space for inline previews. */
function flatten(s: string): string {
	return s.replace(/\s+/g, " ").trim();
}

// Per-event hard cap on stored arg previews. Even in expanded view we don't
// want a 50KB bash heredoc sitting in memory per tool call across last-20
// `recentTools` slots per agent across N agents.
const MAX_ARG_PREVIEW = 4000;

function extractToolArgsPreview(args: Record<string, unknown>): string {
	const cap = (s: string) =>
		s.length > MAX_ARG_PREVIEW ? s.slice(0, MAX_ARG_PREVIEW) + "…" : s;
	if (args.command) return cap(flatten(String(args.command)));
	if (args.path) return cap(flatten(String(args.path)));
	if (args.query) return `"${cap(flatten(String(args.query)))}"`;
	if (args.url) return cap(flatten(String(args.url)));
	if (args.pattern) return cap(flatten(String(args.pattern)));
	if (args.agent) return flatten(String(args.agent));
	if (Array.isArray(args.tasks)) {
		const names = (args.tasks as Array<{ agent?: string }>)
			.map((t) => t?.agent || "?")
			.join(", ");
		return `parallel(${names})`;
	}
	return cap(flatten(JSON.stringify(args)));
}

async function runSubagent(
	agent: AgentEntry,
	task: string,
	cwd: string,
	contextWindow: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate?: (result: AgentResult) => void,
): Promise<AgentResult> {
	const { args } = await buildPiArgs(agent, task, cwd);
	const command = args[0];
	const spawnArgs = args.slice(1);

	const result: AgentResult = {
		agent: agent.name || "unknown",
		task,
		output: "",
		exitCode: 0,
		model: agent.model,
		contextWindow,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0,
			turns: 0,
		},
		progress: {
			agent: agent.name || "unknown",
			status: "running",
			task,
			recentTools: [],
			toolCount: 0,
			tokens: 0,
			durationMs: 0,
			lastMessage: "",
		},
	};

	const startTime = Date.now();
	const progress = result.progress;

	const fireUpdate = throttle(() => {
		progress.durationMs = Date.now() - startTime;
		onUpdate?.(result);
	}, 150);

	const exitCode = await new Promise<number>((resolve) => {
		const proc = spawn(command, spawnArgs, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
		});

		if (agent.commands && agent.commands.length > 0) {
			for (let i = 0; i < agent.commands.length; i++) {
				proc.stdin.write(
					JSON.stringify({
						id: `cmd-${i}`,
						type: "prompt",
						message: agent.commands[i],
					}) + "\n",
				);
			}
		}
		proc.stdin.write(
			JSON.stringify({ id: "task", type: "prompt", message: task }) + "\n",
		);

		let buf = "";
		let stderrBuf = "";

		const processLine = (line: string) => {
			if (!line.trim()) return;
			try {
				const evt = JSON.parse(line) as any;
				progress.durationMs = Date.now() - startTime;

				if (evt.type === "agent_end") {
					proc.stdin.end();
				}

				if (evt.type === "tool_execution_start") {
					progress.toolCount++;
					progress.recentTools.push({
						tool: evt.toolName,
						args: extractToolArgsPreview(
							(evt.args || {}) as Record<string, unknown>,
						),
						toolCallId: evt.toolCallId,
						status: "running",
					});
					fireUpdate();
				}

				if (evt.type === "tool_execution_update") {
					const partial = evt.partialResult as
						| { details?: { results?: unknown } }
						| undefined;
					const nested = partial?.details?.results;
					if (
						evt.toolName === "subagent" &&
						Array.isArray(nested) &&
						evt.toolCallId
					) {
						const hit = progress.recentTools.find(
							(t) => t.toolCallId === evt.toolCallId,
						);
						if (hit) {
							hit.children = nested as AgentResult[];
							fireUpdate();
						}
					}
				}

				if (evt.type === "tool_execution_end") {
					const hit = evt.toolCallId
						? progress.recentTools.find((t) => t.toolCallId === evt.toolCallId)
						: undefined;
					if (hit) {
						hit.status = "done";
						// Override children from the end event's final results — the
						// throttle may have dropped the trailing update, leaving stale
						// children on a completed tool.
						const finalResult = evt.result as
							| { details?: { results?: unknown } }
							| undefined;
						const finalChildren = finalResult?.details?.results;
						if (evt.toolName === "subagent" && Array.isArray(finalChildren)) {
							hit.children = finalChildren as AgentResult[];
						}
					}
					fireUpdate();
				}

				if (evt.type === "tool_result_end") {
					fireUpdate();
				}

				if (evt.type === "message_end" && evt.message) {
					if (evt.message.role === "assistant") {
						result.usage.turns++;
						const u = evt.message.usage;
						if (u) {
							result.usage.input += u.input || 0;
							result.usage.output += u.output || 0;
							result.usage.cacheRead += u.cacheRead || 0;
							result.usage.cacheWrite += u.cacheWrite || 0;
							result.usage.cost += u.cost?.total || 0;
							// Context token gauge uses the latest assistant turn's usage,
							// not a cumulative sum. Each turn re-sends the whole conversation
							// as input + cacheRead, so one message already represents the
							// current context. Summing across turns would inflate by ~Nx.
							progress.tokens =
								(u as { totalTokens?: number }).totalTokens ||
								(u.input || 0) +
									(u.output || 0) +
									(u.cacheRead || 0) +
									(u.cacheWrite || 0);
						}
						if (evt.message.model) result.model = evt.message.model;
						if (evt.message.errorMessage)
							progress.error = evt.message.errorMessage;

						const text = extractTextFromContent(evt.message.content);
						if (text) {
							result.output = text;
							// Extract prose (non-code-block) lines for the live preview
							const proseLines: string[] = [];
							let inCodeBlock = false;
							for (const line of text.split("\n")) {
								if (line.trimStart().startsWith("```")) {
									inCodeBlock = !inCodeBlock;
									continue;
								}
								if (!inCodeBlock && line.trim()) {
									proseLines.push(line.trim());
								}
							}
							if (proseLines.length > 0) {
								progress.lastMessage = proseLines.slice(0, 3).join(" ");
							}
						}
					}

					fireUpdate();
				}
			} catch {
				// Non-JSON lines are expected
			}
		};

		proc.stdout.on("data", (d: Buffer) => {
			buf += d.toString();
			const lines = buf.split("\n");
			buf = lines.pop() || "";
			lines.forEach(processLine);
		});

		proc.stderr.on("data", (d: Buffer) => {
			stderrBuf += d.toString();
		});

		proc.on("close", (code) => {
			if (buf.trim()) processLine(buf);
			if (code !== 0 && stderrBuf.trim() && !progress.error) {
				progress.error = stderrBuf.trim();
			}
			resolve(code ?? 1);
		});

		proc.on("error", () => resolve(1));

		if (signal) {
			const kill = () => {
				proc.kill("SIGTERM");
				setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 3000);
			};
			if (signal.aborted) kill();
			else signal.addEventListener("abort", kill, { once: true });
		}
	});

	result.exitCode = exitCode;
	progress.status = exitCode === 0 && !progress.error ? "completed" : "failed";
	progress.durationMs = Date.now() - startTime;
	if (progress.error)
		result.output = result.output || `Error: ${progress.error}`;

	if (result.output.length > DEFAULT_MAX_BYTES) {
		const trunc = truncateHead(result.output, {
			maxLines: DEFAULT_MAX_LINES,
			maxBytes: DEFAULT_MAX_BYTES,
		});
		result.output = trunc.content;
		if (trunc.truncated) {
			result.output += "\n\n[Output truncated]";
		}
	}

	return result;
}

// ── Throttle ──────────────────────────────────────────────────────────

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
	let lastCall = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	return ((...args: any[]) => {
		const now = Date.now();
		const remaining = ms - (now - lastCall);
		if (remaining <= 0) {
			lastCall = now;
			if (timer) {
				clearTimeout(timer);
				timer = undefined;
			}
			fn(...args);
		} else if (!timer) {
			timer = setTimeout(() => {
				lastCall = Date.now();
				timer = undefined;
				fn(...args);
			}, remaining);
		}
	}) as T;
}

// ── Rendering ─────────────────────────────────────────────────────────

type Theme = ExtensionContext["ui"]["theme"];

function getTermWidth(): number {
	return process.stdout.columns || 120;
}

function renderAgentProgress(
	r: AgentResult,
	theme: Theme,
	expanded: boolean,
	w: number,
	depth: number = 0,
): Container {
	const c = new Container();
	const prog = r.progress;
	const isRunning = prog.status === "running";
	const isPending = prog.status === "pending";
	const nested = depth > 0;

	// Children are visually offset by 2 spaces per depth level.
	const indent = nested ? "  ".repeat(depth) : "";
	const innerW = Math.max(20, w - indent.length);

	const addLine = (content: string) => {
		if (expanded) {
			c.addChild(new Text(indent + content, 0, 0));
		} else {
			c.addChild(new Text(indent + truncLine(content, innerW), 0, 0));
		}
	};

	// Header: icon + agent + stats
	const icon = isRunning
		? theme.fg("warning", "⟳")
		: isPending
			? theme.fg("dim", "○")
			: r.exitCode === 0
				? theme.fg("success", "✓")
				: theme.fg("error", "✗");
	const stats = `${prog.toolCount} tools · ${formatDuration(prog.durationMs)}`;
	const modelStr = r.model ? theme.fg("dim", ` (${r.model})`) : "";
	addLine(
		`${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${modelStr} — ${theme.fg("dim", stats)}`,
	);

	// Tool rows + recursive children
	const renderToolRow = (
		toolName: string,
		args: string,
		children: AgentResult[] | undefined,
		isCurrent: boolean,
	) => {
		const body = args ? `${toolName}: ${args}` : toolName;
		if (isCurrent) {
			addLine(theme.fg("warning", `▸ ${body}`));
		} else {
			addLine(theme.fg("muted", `  ${body}`));
		}
		if (children && children.length > 0) {
			for (const child of children) {
				c.addChild(renderAgentProgress(child, theme, expanded, w, depth + 1));
			}
		}
	};

	for (const t of prog.recentTools) {
		renderToolRow(t.tool, t.args, t.children, t.status === "running");
	}

	// Latest prose "thinking" preview
	if (prog.lastMessage) {
		if (!nested) c.addChild(new Spacer(1));
		addLine(theme.fg("text", prog.lastMessage));
	}

	// Expanded final output (depth 0 only)
	if (!nested && !isRunning && r.output && expanded) {
		c.addChild(new Spacer(1));
		const mdTheme = getMarkdownTheme();
		c.addChild(new Markdown(r.output, 0, 0, mdTheme));
	}

	if (!nested) c.addChild(new Spacer(1));
	const usageParts: string[] = [];
	if (prog.tokens > 0) {
		const ctxStr = formatContextUsage(prog.tokens, r.contextWindow);
		const pct = r.contextWindow ? (prog.tokens / r.contextWindow) * 100 : 0;
		const coloredCtx =
			pct > 90
				? theme.fg("error", ctxStr)
				: pct > 70
					? theme.fg("warning", ctxStr)
					: theme.fg("dim", ctxStr);
		usageParts.push(coloredCtx);
	}
	if (usageParts.length) {
		addLine(usageParts.join(" "));
	}

	if (prog.error) {
		addLine(theme.fg("error", `Error: ${prog.error}`));
	}

	return c;
}

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const agents = Object.values(AGENTS);

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description:
			"Run a subagent to complete a task. Subagents have NO context from the current conversation — include all necessary context in the task description.",
		promptSnippet: "Run subagents for delegated tasks",
		promptGuidelines: [
			"Use subagent to delegate *reasoning and decisions*: codebase exploration (scout), web research (researcher), or isolated code changes (worker)",
			"For multiple independent subagent tasks, emit multiple `subagent` tool calls in the same turn — they run in parallel automatically.",
			"Subagents have NO context from the current conversation — include ALL necessary context in the task description",
		],
		parameters: Type.Object({
			agent: Type.String({
				description:
					"Name of the agent to invoke(scout, researcher, or worker)",
			}),
			task: Type.String({ description: "Task description" }),
			cwd: Type.Optional(
				Type.String({ description: "Working directory for the agent process" }),
			),
		}),

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const cwd = ctx.cwd;

			if (!params.agent || !params.task) {
				throw new Error(
					"`subagent` requires both `agent` and `task`. To fan out work, emit multiple `subagent` tool calls in the same turn — they run in parallel.",
				);
			}

			const agent = agents.find((a) => a.name === params.agent);
			if (!agent) {
				const available = agents.map((a) => a.name).join(", ") || "none";
				throw new Error(
					`Unknown agent: ${params.agent}. Available agents: ${available}`,
				);
			}

			const [provider, modelId] = (agent.model || "").split("/");
			const contextWindow =
				provider && modelId
					? ctx.modelRegistry.find(provider, modelId)?.contextWindow
					: undefined;

			const result = await runSubagent(
				agent,
				params.task!,
				params.cwd ?? cwd,
				contextWindow,
				signal,
				onUpdate
					? (r) => {
							onUpdate({
								content: [{ type: "text", text: "(running...)" }],
								details: { results: [r] },
							});
						}
					: undefined,
			);

			const isError = result.exitCode !== 0 || !!result.progress.error;
			return {
				content: [{ type: "text", text: result.output || "(no output)" }],
				details: { results: [result] },
				...(isError ? { isError: true } : {}),
			};
		},

		// ── Render: tool call header ──
		renderCall(args, theme, context) {
			if (!context.expanded) {
				if (!args.agent) {
					return new Text(theme.fg("toolTitle", theme.bold("subagent")), 0, 0);
				}
				const taskPreview = args.task
					? (args.task.length > 60
							? args.task.slice(0, 60) + "…"
							: args.task
						).replace(/\n/g, " ")
					: "";
				return new Text(
					`${theme.fg("toolTitle", theme.bold("subagent"))} ${theme.fg("accent", args.agent)} ${theme.fg("dim", taskPreview)}`,
					0,
					0,
				);
			}

			const c =
				context.lastComponent instanceof Container
					? (context.lastComponent.clear(), context.lastComponent)
					: new Container();
			const agentLabel = args.agent ? ` ${theme.fg("accent", args.agent)}` : "";
			const cwdLabel = args.cwd ? theme.fg("dim", ` (cwd: ${args.cwd})`) : "";
			c.addChild(
				new Text(
					`${theme.fg("toolTitle", theme.bold("subagent"))}${agentLabel}${cwdLabel}`,
					0,
					0,
				),
			);
			if (args.task) {
				c.addChild(new Spacer(1));
				c.addChild(new Text(theme.fg("text", args.task), 0, 0));
			}
			return c;
		},

		// ── Render: result ──
		renderResult(result, options, theme, context) {
			const details = result.details as Details | undefined;
			if (!details?.results?.length) {
				const t = result.content[0];
				const text = t?.type === "text" ? t.text : "(no output)";
				return new Text(text.slice(0, 200), 0, 0);
			}

			const w = getTermWidth() - 4;
			const expanded = options.expanded;
			const c = new Container();
			c.addChild(renderAgentProgress(details.results[0], theme, expanded, w));
			return c;
		},
	});
}
