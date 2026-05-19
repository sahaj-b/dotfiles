import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const DEFAULT_MAX = 20;
const MAX_ITER = 1000;
const COMPLETE_MARKER = "<ralph-done>";
const RALPH_DIRNAME = ".ralph";
const STATE_FILENAME = "state.json";
const LEGACY_PROMPT_FILENAME = "PROMPT.md";

const DEFAULT_PROMPT_BUILD = `You are in a Ralph loop (iteration {iter} of {max}).
Your task is defined in {taskFile}.

0a. Study specs/* if they exist to learn the application specifications.
0b. Study {taskFile} to understand current task state and checklist.
0c. For reference, the application source code is in src/*.

1. Your task is to implement functionality per the specifications. Follow the task file and choose the most important item to address. Before making changes, search the codebase — don't assume not implemented.

2. After implementing functionality, run tests for that unit of code. If functionality is missing then it's your job to add it per the specifications.

3. When you discover issues, update {taskFile} with your findings. When resolved, mark the item complete.

4. When tests pass, update {taskFile}, then call the ralph_done tool to advance to the next fresh-session iteration.

999. Important: When authoring code or tests, capture the why — explain what it's testing and why it matters. Future loops will read this.
9999. Don't assume not implemented — always search the codebase first.
99999. Single sources of truth. No stubs or placeholders — implement fully.
999999. When {taskFile} becomes large, periodically clean out completed items.
9999999. Output ${COMPLETE_MARKER} on your final line when ALL items are complete. If work remains, do NOT output the marker — call ralph_done instead.`;

const DEFAULT_PROMPT_PLAN = `You are in a Ralph planning loop (iteration {iter} of {max}).
Your task is defined in {taskFile}.

0a. Study specs/* if they exist to learn the application specifications.
0b. Study {taskFile} to understand current plan state.
0c. For reference, the application source code is in src/*.

1. Study existing source code and compare it against specs/*. Create or update IMPLEMENTATION_PLAN.md as a prioritized bullet-point list of tasks remaining. Consider searching for TODOs, minimal implementations, placeholders, and skipped tests.

2. Update {taskFile} with discoveries, then call the ralph_done tool to advance to the next fresh-session iteration.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing — confirm with code search first.
IMPORTANT: Output ${COMPLETE_MARKER} on your final line only when planning is fully complete. Otherwise call ralph_done.`;

const DEFAULT_TASK_BUILD = `# Task

## Goal
[Describe what to build]

## Checklist
- [ ] Item 1
- [ ] Item 2

## Notes
(Update as you work)
`;

const DEFAULT_TASK_PLAN = `# Plan

## Goal
[Describe what you're planning]

## Checklist
- [ ] Study specs/* and src/*
- [ ] Create IMPLEMENTATION_PLAN.md

## Notes
(Update as you work)
`;

type RalphMode = "build" | "plan";
type RalphStatus = "active" | "paused" | "completed";

interface StartArgs {
	taskPath?: string;
	max: number;
	mode: RalphMode;
	error?: string;
}

interface RalphState {
	version: 3;
	status: RalphStatus;
	taskFile: string;
	mode: RalphMode;
	iteration: number;
	maxIterations: number;
	awaitingAgent: boolean;
	readyForNextIteration: boolean;
	advanceQueued: boolean;
	stopRequested: boolean;
	startedAt: string;
	updatedAt: string;
	summaryPath: string;
}

function tokenizeArgs(raw: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: string | null = null;

	for (const ch of raw) {
		if (quote) {
			if (ch === quote) quote = null;
			else current += ch;
			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}

		if (ch === " " || ch === "\t") {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += ch;
	}

	if (current) tokens.push(current);
	return tokens;
}

function parseStartArgs(raw: string): StartArgs {
	const tokens = tokenizeArgs(raw);
	let taskPath: string | undefined;
	let max = DEFAULT_MAX;
	let mode: RalphMode = "build";

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === "--max" && tokens[i + 1]) {
			max = Number(tokens[++i]) || DEFAULT_MAX;
			continue;
		}
		if (token === "--plan") {
			mode = "plan";
			continue;
		}
		if (!token.startsWith("--")) taskPath = token;
	}

	if (!taskPath) return { max, mode, error: "Usage: /ralph <task-file> [--max N] [--plan]" };
	if (!Number.isInteger(max) || max < 1 || max > MAX_ITER) {
		return { max, mode, error: `--max must be an integer between 1 and ${MAX_ITER}` };
	}
	return { taskPath, max, mode };
}

function ralphDir(cwd: string): string {
	return path.join(cwd, RALPH_DIRNAME);
}

function statePath(cwd: string): string {
	return path.join(ralphDir(cwd), STATE_FILENAME);
}

function modePromptFilename(mode: RalphMode): string {
	return mode === "plan" ? "PROMPT.plan.md" : "PROMPT.build.md";
}

function displayPath(cwd: string, target: string): string {
	const rel = path.relative(cwd, target);
	return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : target;
}

function canAccessTaskPath(target: string, cwd: string): boolean {
	const resolved = path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target);
	const roots = [path.resolve(cwd), path.join(os.homedir(), ".pi"), path.join(os.homedir(), ".local")];
	return roots.some((root) => {
		const rel = path.relative(root, resolved);
		return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
	});
}

function substitute(template: string, state: RalphState): string {
	return template
		.replace(/{iter}/g, String(state.iteration))
		.replace(/{max}/g, String(state.maxIterations))
		.replace(/{taskFile}/g, state.taskFile);
}

function extractAssistantText(messages: unknown[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i] as { role?: string; content?: unknown } | undefined;
		if (message?.role !== "assistant" || !Array.isArray(message.content)) continue;

		const text = message.content
			.filter(
				(part): part is { type: "text"; text: string } =>
					!!part && typeof part === "object" && "type" in part && part.type === "text" && typeof part.text === "string",
			)
			.map((part) => part.text)
			.join("");

		if (text.trim()) return text.trim();
	}

	return "";
}

function getFinalNonEmptyLine(text: string): string {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	return lines.at(-1) ?? "";
}

async function ensureParentDir(filePath: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readTextIfExists(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch {
		return null;
	}
}

async function loadState(cwd: string): Promise<RalphState | null> {
	const raw = await readTextIfExists(statePath(cwd));
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<RalphState>;
		if (
			typeof parsed.taskFile !== "string" ||
			(parsed.mode !== "build" && parsed.mode !== "plan") ||
			(parsed.status !== "active" && parsed.status !== "paused" && parsed.status !== "completed") ||
			typeof parsed.iteration !== "number" ||
			typeof parsed.maxIterations !== "number" ||
			typeof parsed.summaryPath !== "string"
		) {
			return null;
		}

		return {
			version: 3,
			status: parsed.status,
			taskFile: parsed.taskFile,
			mode: parsed.mode,
			iteration: parsed.iteration,
			maxIterations: parsed.maxIterations,
			awaitingAgent: parsed.awaitingAgent === true,
			readyForNextIteration: parsed.readyForNextIteration === true,
			advanceQueued: parsed.advanceQueued === true,
			stopRequested: parsed.stopRequested === true,
			startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
			updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
			summaryPath: parsed.summaryPath,
		};
	} catch {
		return null;
	}
}

async function saveState(cwd: string, state: RalphState): Promise<void> {
	state.updatedAt = new Date().toISOString();
	const filePath = statePath(cwd);
	await ensureParentDir(filePath);
	await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

async function readAgentsFile(cwd: string): Promise<string | null> {
	const raw = await readTextIfExists(path.join(cwd, "AGENTS.md"));
	const trimmed = raw?.trim();
	return trimmed ? trimmed : null;
}

async function ensurePromptTemplate(cwd: string, mode: RalphMode): Promise<string> {
	const dir = ralphDir(cwd);
	await fs.mkdir(dir, { recursive: true });

	const specificPath = path.join(dir, modePromptFilename(mode));
	const specific = await readTextIfExists(specificPath);
	if (specific?.trim()) return specific;

	const legacyPath = path.join(dir, LEGACY_PROMPT_FILENAME);
	const legacy = await readTextIfExists(legacyPath);
	if (legacy?.trim()) return legacy;

	const fallback = mode === "plan" ? DEFAULT_PROMPT_PLAN : DEFAULT_PROMPT_BUILD;
	await fs.writeFile(specificPath, fallback, "utf8");
	return fallback;
}

async function ensureTaskFile(taskFile: string, mode: RalphMode): Promise<string> {
	const existing = await readTextIfExists(taskFile);
	if (existing !== null) return existing;

	await ensureParentDir(taskFile);
	const template = mode === "plan" ? DEFAULT_TASK_PLAN : DEFAULT_TASK_BUILD;
	await fs.writeFile(taskFile, template, "utf8");
	return template;
}

async function createSummaryFile(cwd: string, taskFile: string, mode: RalphMode, maxIterations: number): Promise<string> {
	const startedAt = new Date();
	const dateTag = startedAt.toISOString().slice(0, 10).replace(/-/g, "");
	const timeTag = startedAt.toTimeString().slice(0, 8).replace(/:/g, "-");
	const summaryPath = path.join(ralphDir(cwd), dateTag, `ralph-${timeTag}.md`);
	await ensureParentDir(summaryPath);
	await fs.writeFile(
		summaryPath,
		[
			`# Ralph Loop — ${mode}`,
			`- Task: ${taskFile}`,
			`- Started: ${startedAt.toISOString()}`,
			`- Max iterations: ${maxIterations}`,
			"",
		].join("\n"),
		"utf8",
	);
	return summaryPath;
}

async function appendSummary(summaryPath: string, iteration: number, outcome: string, lastMessage: string): Promise<void> {
	await ensureParentDir(summaryPath);
	await fs.appendFile(
		summaryPath,
		[
			`## Iteration ${iteration}`,
			`- Outcome: ${outcome}`,
			`- Ended: ${new Date().toISOString()}`,
			"",
			"```",
			lastMessage || "(no text captured)",
			"```",
			"",
		].join("\n"),
		"utf8",
	);
}

async function appendRunFooter(summaryPath: string, outcome: string): Promise<void> {
	await ensureParentDir(summaryPath);
	await fs.appendFile(
		summaryPath,
		[`## Final status`, `- Outcome: ${outcome}`, `- Ended: ${new Date().toISOString()}`, ""].join("\n"),
		"utf8",
	);
}

function buildPrompt(template: string, state: RalphState, taskContent: string): string {
	return `${substitute(template, state)}\n\n---\n\n${taskContent}`;
}

function statusLine(state: RalphState): string {
	const icon = state.status === "completed" ? "✅" : state.status === "paused" ? "⏸" : state.awaitingAgent ? "🔄" : "🟡";
	return `${icon} ${state.status} · iteration ${state.iteration}/${state.maxIterations}`;
}

function updateUI(ctx: ExtensionContext, state: RalphState | null): void {
	if (!ctx.hasUI) return;
	if (!state) {
		ctx.ui.setStatus("ralph", "");
		return;
	}

	const label = `${statusLine(state)} · ${displayPath(ctx.cwd, state.taskFile)}`;
	ctx.ui.setStatus("ralph", label);
}

async function completeState(cwd: string, reason: string): Promise<RalphState | null> {
	const state = await loadState(cwd);
	if (!state) return null;
	state.status = "completed";
	state.awaitingAgent = false;
	state.advanceQueued = false;
	state.readyForNextIteration = false;
	state.stopRequested = false;
	await saveState(cwd, state);
	await appendRunFooter(state.summaryPath, reason);
	return state;
}

export default function (pi: ExtensionAPI) {
	async function launchIteration(ctx: ExtensionContext, state: RalphState): Promise<void> {
		if (state.awaitingAgent) {
			updateUI(ctx, state);
			ctx.ui.notify("Ralph loop is already running", "warning");
			return;
		}

		if (state.stopRequested) {
			state.status = "paused";
			state.advanceQueued = false;
			await saveState(ctx.cwd, state);
			updateUI(ctx, state);
			ctx.ui.notify("Ralph loop is paused. Run /ralph resume to continue.", "info");
			return;
		}

		if (state.readyForNextIteration) {
			if (state.maxIterations > 0 && state.iteration >= state.maxIterations) {
				const completed = await completeState(ctx.cwd, `max iterations (${state.maxIterations}) reached`);
				updateUI(ctx, completed);
				ctx.ui.notify(`Ralph loop hit max iterations (${state.maxIterations})`, "warning");
				return;
			}
			state.iteration += 1;
			state.readyForNextIteration = false;
		}

		const taskContent = await readTextIfExists(state.taskFile);
		if (!taskContent?.trim()) {
			state.status = "paused";
			state.awaitingAgent = false;
			state.advanceQueued = false;
			await saveState(ctx.cwd, state);
			updateUI(ctx, state);
			ctx.ui.notify(`Task file missing or empty: ${displayPath(ctx.cwd, state.taskFile)}`, "error");
			return;
		}

		const promptTemplate = await ensurePromptTemplate(ctx.cwd, state.mode);
		const prompt = buildPrompt(promptTemplate, state, taskContent);

		state.status = "active";
		state.awaitingAgent = true;
		state.advanceQueued = false;
		await saveState(ctx.cwd, state);
		updateUI(ctx, state);

		const result = await ctx.newSession({
			withSession: async (replacementCtx) => {
				try {
					await replacementCtx.sendUserMessage(prompt);
				} catch (error) {
					const latest = await loadState(replacementCtx.cwd);
					if (latest) {
						latest.status = "paused";
						latest.awaitingAgent = false;
						latest.advanceQueued = false;
						await saveState(replacementCtx.cwd, latest);
						updateUI(replacementCtx, latest);
					}
					replacementCtx.ui.notify(`Ralph failed to send iteration prompt: ${(error as Error).message}`, "error");
				}
			},
		});

		if (result.cancelled) {
			const latest = await loadState(ctx.cwd);
			if (latest) {
				latest.status = "paused";
				latest.awaitingAgent = false;
				latest.advanceQueued = false;
				await saveState(ctx.cwd, latest);
				updateUI(ctx, latest);
			}
			ctx.ui.notify("Ralph loop cancelled before the fresh session started", "warning");
		}
	}

	async function startLoop(rawArgs: string, ctx: ExtensionContext): Promise<void> {
		const parsed = parseStartArgs(rawArgs);
		if (parsed.error || !parsed.taskPath) {
			ctx.ui.notify(parsed.error ?? "Usage: /ralph <task-file> [--max N] [--plan]", "warning");
			return;
		}

		const existing = await loadState(ctx.cwd);
		if (existing?.status === "active" && existing.awaitingAgent) {
			ctx.ui.notify("A Ralph loop is already running. Stop or finish it first.", "warning");
			return;
		}

		if (!canAccessTaskPath(parsed.taskPath, ctx.cwd)) {
			ctx.ui.notify("Task file must be inside cwd, ~/.pi, or ~/.local", "error");
			return;
		}

		const taskFile = path.isAbsolute(parsed.taskPath) ? path.resolve(parsed.taskPath) : path.resolve(ctx.cwd, parsed.taskPath);
		const taskContent = await ensureTaskFile(taskFile, parsed.mode);
		if (!taskContent.trim()) {
			ctx.ui.notify("Task file is empty", "warning");
			return;
		}

		const summaryPath = await createSummaryFile(ctx.cwd, taskFile, parsed.mode, parsed.max);
		const now = new Date().toISOString();
		const state: RalphState = {
			version: 3,
			status: "active",
			taskFile,
			mode: parsed.mode,
			iteration: 1,
			maxIterations: parsed.max,
			awaitingAgent: false,
			readyForNextIteration: false,
			advanceQueued: false,
			stopRequested: false,
			startedAt: now,
			updatedAt: now,
			summaryPath,
		};

		await saveState(ctx.cwd, state);
		ctx.ui.notify(
			`Ralph loop started: ${displayPath(ctx.cwd, taskFile)} (${parsed.mode}, max ${parsed.max})`,
			"info",
		);
		await launchIteration(ctx, state);
	}

	async function continueLoop(ctx: ExtensionContext, manual: boolean): Promise<void> {
		const state = await loadState(ctx.cwd);
		if (!state) {
			ctx.ui.notify("No Ralph loop found", "warning");
			return;
		}

		if (state.status === "completed") {
			updateUI(ctx, state);
			ctx.ui.notify("Ralph loop is already completed", "info");
			return;
		}

		if (manual) state.stopRequested = false;
		await launchIteration(ctx, state);
	}

	pi.registerTool({
		name: "ralph_done",
		label: "Ralph Iteration Done",
		description: "Signal that the current Ralph iteration is complete and the next fresh-session pass should start. Do not call this if you are fully done — output the final completion marker instead.",
		promptSnippet: "Advance an active Ralph loop after completing the current iteration.",
		promptGuidelines: [
			"Call ralph_done only after making real progress and updating the task file so the next fresh-session pass can continue from disk.",
			"Do not call ralph_done if the task is fully complete — output the exact final-line marker instead.",
		],
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const state = await loadState(ctx.cwd);
			if (!state) {
				return { content: [{ type: "text", text: "No Ralph loop found." }], details: {} };
			}

			if (state.status !== "active" || !state.awaitingAgent) {
				return { content: [{ type: "text", text: "Ralph is not waiting on an active iteration." }], details: {} };
			}

			if (state.advanceQueued) {
				return { content: [{ type: "text", text: "Next Ralph iteration is already queued." }], details: {} };
			}

			state.readyForNextIteration = true;
			await saveState(ctx.cwd, state);

			if (state.stopRequested) {
				return {
					content: [{ type: "text", text: "Iteration recorded. Stop requested, so Ralph will pause after this turn." }],
					details: {},
				};
			}

			if (state.maxIterations > 0 && state.iteration >= state.maxIterations) {
				return {
					content: [{ type: "text", text: `Iteration recorded. This was the final allowed iteration (${state.maxIterations}).` }],
					details: {},
				};
			}

			state.advanceQueued = true;
			await saveState(ctx.cwd, state);

			// Tools cannot open replacement sessions safely, so they queue a slash command
			// that will run once the current turn is truly finished and idle.
			pi.sendUserMessage("/ralph continue", { deliverAs: "followUp" });

			return {
				content: [{ type: "text", text: `Iteration ${state.iteration} recorded. Next fresh-session pass queued.` }],
				details: {},
			};
		},
	});

	pi.registerCommand("ralph", {
		description: "Fresh-session Ralph loop: /ralph <task-file> [--max N] [--plan] | /ralph stop | /ralph resume | /ralph status",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (!trimmed) {
				ctx.ui.notify(
					[
						"Usage:",
						"  /ralph <task-file> [--max N] [--plan]",
						"  /ralph start <task-file> [--max N] [--plan]",
						"  /ralph continue",
						"  /ralph resume",
						"  /ralph stop",
						"  /ralph status",
					].join("\n"),
					"info",
				);
				return;
			}

			const firstSpace = trimmed.search(/\s/);
			const command = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
			const rest = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();

			if (command === "start") {
				await startLoop(rest, ctx);
				return;
			}

			if (command === "continue") {
				await continueLoop(ctx, false);
				return;
			}

			if (command === "resume") {
				await continueLoop(ctx, true);
				return;
			}

			if (command === "stop") {
				const state = await loadState(ctx.cwd);
				if (!state || state.status === "completed") {
					ctx.ui.notify("No active Ralph loop", "warning");
					return;
				}

				state.stopRequested = true;
				if (!state.awaitingAgent) state.status = "paused";
				state.advanceQueued = false;
				await saveState(ctx.cwd, state);
				updateUI(ctx, state);
				ctx.ui.notify(
					state.awaitingAgent
						? "Ralph will stop after the current iteration ends"
						: "Ralph loop paused. Run /ralph resume when you want it back.",
					"info",
				);
				return;
			}

			if (command === "status") {
				const state = await loadState(ctx.cwd);
				if (!state) {
					ctx.ui.notify("No Ralph loop found", "info");
					return;
				}

				updateUI(ctx, state);
				ctx.ui.notify(
					[
						`Status: ${statusLine(state)}`,
						`Task: ${displayPath(ctx.cwd, state.taskFile)}`,
						`Mode: ${state.mode}`,
						`Awaiting agent: ${state.awaitingAgent ? "yes" : "no"}`,
						`Ready for next iteration: ${state.readyForNextIteration ? "yes" : "no"}`,
						`Stop requested: ${state.stopRequested ? "yes" : "no"}`,
						`Log: ${displayPath(ctx.cwd, state.summaryPath)}`,
					].join("\n"),
					"info",
				);
				return;
			}

			await startLoop(args, ctx);
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const state = await loadState(ctx.cwd);
		if (!state || state.status !== "active" || !state.awaitingAgent) return;

		const agents = await readAgentsFile(ctx.cwd);
		let injected = `\n[RALPH LOOP — ${state.mode.toUpperCase()} — Iteration ${state.iteration}/${state.maxIterations}]\n`;
		injected += `Task file: ${state.taskFile}\n`;
		injected += `If work remains at the end of this pass, call ralph_done.\n`;
		injected += `If everything is done, put ${COMPLETE_MARKER} on the final non-empty line and do not call ralph_done.\n`;

		if (agents) injected += `\n--- AGENTS.md ---\n${agents}\n---\n`;

		return { systemPrompt: event.systemPrompt + injected };
	});

	pi.on("agent_end", async (event, ctx) => {
		const state = await loadState(ctx.cwd);
		if (!state || state.status !== "active" || !state.awaitingAgent) return;

		const lastMessage = extractAssistantText(event.messages);
		const finalLine = getFinalNonEmptyLine(lastMessage);
		const isComplete = finalLine === COMPLETE_MARKER;

		if (isComplete) {
			await appendSummary(state.summaryPath, state.iteration, "completed", lastMessage);
			const completed = await completeState(ctx.cwd, `completed after iteration ${state.iteration}`);
			updateUI(ctx, completed);
			ctx.ui.notify(`Ralph loop complete after ${state.iteration} iterations`, "success");
			return;
		}

		if (state.advanceQueued) {
			state.awaitingAgent = false;
			await saveState(ctx.cwd, state);
			await appendSummary(state.summaryPath, state.iteration, "advance queued", lastMessage);
			updateUI(ctx, state);
			return;
		}

		if (state.readyForNextIteration) {
			state.awaitingAgent = false;

			if (state.maxIterations > 0 && state.iteration >= state.maxIterations) {
				await appendSummary(state.summaryPath, state.iteration, "max iterations reached", lastMessage);
				const completed = await completeState(ctx.cwd, `max iterations (${state.maxIterations}) reached`);
				updateUI(ctx, completed);
				ctx.ui.notify(`Ralph loop hit max iterations (${state.maxIterations})`, "warning");
				return;
			}

			state.status = state.stopRequested ? "paused" : state.status;
			await saveState(ctx.cwd, state);
			await appendSummary(
				state.summaryPath,
				state.iteration,
				state.stopRequested ? "paused after requested stop" : "iteration recorded",
				lastMessage,
			);
			updateUI(ctx, state);
			if (state.stopRequested) ctx.ui.notify("Ralph paused after the current iteration", "info");
			return;
		}

		// Fresh-session loops are only trustworthy when each pass explicitly signals
		// whether it should continue. Silent auto-advance would just compound agent drift.
		state.awaitingAgent = false;
		state.status = "paused";
		state.advanceQueued = false;
		await saveState(ctx.cwd, state);
		await appendSummary(state.summaryPath, state.iteration, "paused: missing ralph_done or final marker", lastMessage);
		updateUI(ctx, state);
		ctx.ui.notify("Ralph paused because the iteration ended without ralph_done or the final completion marker", "warning");
	});

	pi.on("session_start", async (_event, ctx) => {
		const state = await loadState(ctx.cwd);
		updateUI(ctx, state);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		const state = await loadState(ctx.cwd);
		updateUI(ctx, state);
	});
}
