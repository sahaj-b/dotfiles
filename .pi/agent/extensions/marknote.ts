import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

import { Type } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

// ─── Template engine ─────────────────────────────────────────────────────────

function resolveTemplate(
	template: string,
	vars: Record<string, string | undefined>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		const val = vars[key];
		return val !== undefined ? val : match;
	});
}

// ─── Prompt templates ────────────────────────────────────────────────────────

const PLAN_SUBMIT_TOOL = "submit_for_review";

function buildPlanFileRule(planFilePath?: string): string {
	if (!planFilePath) return "";
	return `- Your plan is saved at: ${planFilePath}\n  You can edit this file to make targeted changes, then pass its path to ${PLAN_SUBMIT_TOOL} again.\n`;
}

const DEFAULT_ANNOTATE_FILE_FEEDBACK =
	"# Markdown Annotations\n\n{{fileHeader}}: {{filePath}}\n\n{{feedback}}\n\nPlease address the annotation feedback above.";

const DEFAULT_REVIEW_DENIED =
	"Your changes were not approved.\n\nAddress ALL of the feedback below before calling {{toolName}} again.\n\nRules:\n{{planFileRule}}- Do not resubmit the same content unchanged.\n\n{{feedback}}";

const DEFAULT_REVIEW_APPROVED =
	"PLAN APPROVED. HALT EXECUTION. Do not write any code.";

const DEFAULT_REVIEW_APPROVED_WITH_NOTES =
	"PLAN APPROVED WITH NOTES. HALT EXECUTION. Do not write any code..\n\n## Review Notes\n\n{{feedback}}";

const DEFAULT_REVIEW_AUTO_APPROVED =
	"Content auto-approved (non-interactive mode). HALT EXECUTION.";

function resolveUserPath(input: string, baseDir = process.cwd()): string {
	let p = input.trim().replace(/^['"]|['"]$/g, "");
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
	return isAbsolute(p) ? p : resolve(baseDir, p);
}

function getStartupErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function readSessionResult(
	marknoteAction: string,
	marknoteOutput: string,
): { exit: boolean; approved: boolean; feedback?: string } {
	if (!existsSync(marknoteAction) || !existsSync(marknoteOutput)) {
		return { exit: true, approved: false };
	}

	const action = readFileSync(marknoteAction, "utf-8").trim();
	const feedback = readFileSync(marknoteOutput, "utf-8").trim();

	if (action === "approve") {
		return { exit: false, approved: true, feedback: feedback || undefined };
	}
	if (action === "feedback") {
		return { exit: false, approved: false, feedback };
	}
	return { exit: true, approved: false };
}

function waitForTmuxChannel(
	channel: string,
	timeoutMs: number,
	abortSignal?: () => Error | null,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const waitChild = spawn("tmux", ["wait-for", channel], {
			stdio: "ignore",
		});

		waitChild.on("error", reject);

		waitChild.on("close", (code) => {
			const aborted = abortSignal?.();
			if (aborted) return reject(aborted);
			if (code === 0) return resolve();
			reject(new Error(`tmux wait-for exited with code ${code}`));
		});

		const timer = setTimeout(() => {
			waitChild.kill();
			reject(new Error("timeout waiting for nvim session to complete"));
		}, timeoutMs);

		waitChild.on("close", () => clearTimeout(timer));
	});
}

async function startMarknoteSession(
	ctx: ExtensionContext,
	absolutePath: string,
): Promise<{ exit: boolean; approved: boolean; feedback?: string }> {
	const tempId = randomBytes(4).toString("hex");
	const tempDir = resolve("/tmp", `marknote-${tempId}`);
	mkdirSync(tempDir, { recursive: true });

	const marknoteOutput = resolve(tempDir, "feedback.md");
	const marknoteAction = resolve(tempDir, "action.txt");
	const luaCmd = `lua require('marknote').start_session({ output_file = '${marknoteOutput}', action_file = '${marknoteAction}' })`;

	const cleanup = () => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {}
	};

	const term = process.env.PI_TERMINAL || process.env.TERMINAL;
	const tmux = process.env.TMUX;

	try {
		if (tmux) {
			let inPiPane = false;
			let sessionName: string | undefined;
			try {
				sessionName = ctx?.sessionManager?.getSessionName() ?? undefined;
			} catch {}
			if (sessionName) {
				try {
					const paneTitle = execFileSync(
						"tmux",
						["display-message", "-p", "#T"],
						{
							encoding: "utf-8",
							timeout: 2000,
							stdio: ["ignore", "pipe", "ignore"],
						},
					).trim();
					const pattern = `^π - ${sessionName.slice(0, 30)}`;
					inPiPane = new RegExp(pattern, "i").test(paneTitle);
				} catch {}
			}

			const channelId = `marknote-${tempId}`;

			let tmuxSpawnError: Error | null = null;
			const waitPromise = waitForTmuxChannel(
				channelId,
				30 * 60 * 1000,
				() => tmuxSpawnError,
			);

			const tmuxArgs: string[] = [
				"new-window",
				...(inPiPane ? [] : ["-d"]),
				"-n",
				"Marknote Review",
				"bash",
				"-c",
				'nvim "$1" -c "$2"; tmux wait-for -S "$3"',
				"--",
				absolutePath,
				luaCmd,
				channelId,
			];

			const tmuxChild = spawn("tmux", tmuxArgs, {
				stdio: "ignore",
			});
			tmuxChild.on("error", (err) => {
				tmuxSpawnError = err;
			});

			if (!inPiPane) {
				spawn("tput", ["bel"], { stdio: "inherit" }).unref();
			}

			await waitPromise;

			return readSessionResult(marknoteAction, marknoteOutput);
		}

		return await new Promise((resolvePromise, rejectPromise) => {
			let child;
			if (term) {
				child = spawn(term, ["-e", "nvim", absolutePath, "-c", luaCmd], {
					stdio: "inherit",
				});
			} else {
				child = spawn("nvim", [absolutePath, "-c", luaCmd], {
					stdio: "inherit",
				});
			}

			child.on("error", rejectPromise);
			child.on("close", () => {
				resolvePromise(readSessionResult(marknoteAction, marknoteOutput));
			});
		});
	} finally {
		cleanup();
	}
}

export default function plannotator(pi: ExtensionAPI): void {
	// ── Commands & Shortcuts ─────────────────────────────────────────────

	pi.registerCommand("annotate", {
		description: "Open markdown file in neovim annotation UI",
		handler: async (args, ctx) => {
			const filePath = args?.trim();
			if (!filePath) {
				ctx.ui.notify("Usage: /annotate <file.md>", "error");
				return;
			}

			const absolutePath = resolveUserPath(filePath, ctx.cwd);
			if (!existsSync(absolutePath)) {
				ctx.ui.notify(`File not found: ${absolutePath}`, "error");
				return;
			}

			ctx.ui.notify(`Opening neovim for ${filePath}...`, "info");

			try {
				const result = await startMarknoteSession(ctx, absolutePath);
				if (result.exit) {
					// If nvim closed without marknote action, check if file has content.
					// If it does, treat it as follow-up feedback.
					const raw = readFileSync(absolutePath, "utf-8");
					if (raw.trim().length > 0) {
						ctx.ui.notify(
							"Annotation session closed with content.",
							"info",
						);
						pi.sendUserMessage(
							resolveTemplate(DEFAULT_ANNOTATE_FILE_FEEDBACK, {
								fileHeader: "File",
								filePath: absolutePath,
								feedback: raw,
							}),
							{ deliverAs: "followUp" },
						);
						return;
					}

					ctx.ui.notify(
						"Annotation session closed without submitting.",
						"info",
					);
					return;
				}
				if (result.approved) {
					ctx.ui.notify(
						"Annotation approved. Feed it to your next session.",
						"info",
					);
					return;
				}
				if (!result.feedback) {
					ctx.ui.notify("Annotation closed (no feedback).", "info");
					return;
				}
				pi.sendUserMessage(
					resolveTemplate(DEFAULT_ANNOTATE_FILE_FEEDBACK, {
						fileHeader: "File",
						filePath: absolutePath,
						feedback: result.feedback,
					}),
					{ deliverAs: "followUp" },
				);
			} catch (err) {
				ctx.ui.notify(
					`Failed to start annotation UI: ${getStartupErrorMessage(err)}`,
					"error",
				);
			}
		},
	});

	// ── submit_for_review Tool ────────────────────────────────────

	pi.registerTool({
		name: PLAN_SUBMIT_TOOL,
		label: "Submit for Review",
		description:
			"Submit a markdown file for review. The user will review it in neovim and can approve, deny with feedback, or annotate it",
		promptGuidelines: [
			"ONLY use this when you have written or updated the plan and need the user's feedback or approval.",
		],
		parameters: Type.Object({
			filePath: Type.String({
				description:
					"Relative path to the markdown file. Must end in .md or .mdx.",
			}),
		}) as any,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const inputPath = (params as { filePath?: string })?.filePath?.trim();
			if (!inputPath) {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${PLAN_SUBMIT_TOOL} requires a filePath argument pointing to a markdown file.`,
						},
					],
					details: { approved: false },
				};
			}

			const fullPath = resolve(ctx.cwd, inputPath);

			try {
				if (!statSync(fullPath).isFile()) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${inputPath} is not a regular file. Write the markdown file first.`,
							},
						],
						details: { approved: false },
					};
				}
			} catch {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${inputPath} does not exist. Write the markdown file first.`,
						},
					],
					details: { approved: false },
				};
			}

			let planContent: string;
			try {
				planContent = readFileSync(fullPath, "utf-8");
			} catch (err) {
				return {
					content: [
						{
							type: "text",
							text: `Error: failed to read ${inputPath}: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					details: { approved: false },
				};
			}

			if (planContent.trim().length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${inputPath} is empty. Write content first.`,
						},
					],
					details: { approved: false },
				};
			}

			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: DEFAULT_REVIEW_AUTO_APPROVED }],
					details: { approved: true },
				};
			}

			let result: Awaited<ReturnType<typeof startMarknoteSession>>;
			try {
				result = await startMarknoteSession(ctx, fullPath);
			} catch (err) {
				const message = `Failed to start review UI: ${getStartupErrorMessage(err)}`;
				ctx.ui.notify(message, "error");
				return {
					content: [{ type: "text", text: message }],
					details: { approved: false },
				};
			}

			if (result.exit) {
				// If nvim closed without marknote action, check if the file has content.
				// If it does, treat it as approved (user read/reviewed and walked away).
				const raw = readFileSync(fullPath, "utf-8");
				if (raw.trim().length > 0) {
					return {
						content: [
							{
								type: "text",
								text: resolveTemplate(DEFAULT_REVIEW_APPROVED, {
									filePath: inputPath,
								}),
							},
						],
						details: { approved: true },
					};
				}

				return {
					content: [
						{
							type: "text",
							text: `Error: user closed without submitting.`,
						},
					],
					details: { approved: false },
				};
			}

			if (result.approved) {
				if (result.feedback) {
					return {
						content: [
							{
								type: "text",
								text: resolveTemplate(DEFAULT_REVIEW_APPROVED_WITH_NOTES, {
									filePath: inputPath,
									feedback: result.feedback,
								}),
							},
						],
						details: { approved: true, feedback: result.feedback },
					};
				}

				return {
					content: [
						{
							type: "text",
							text: resolveTemplate(DEFAULT_REVIEW_APPROVED, {
								filePath: inputPath,
							}),
						},
					],
					details: { approved: true },
				};
			}

			// Denied - Loop continues
			const feedbackText =
				result.feedback || "Content not approved. Please revise.";

			return {
				content: [
					{
						type: "text",
						text: resolveTemplate(DEFAULT_REVIEW_DENIED, {
							toolName: PLAN_SUBMIT_TOOL,
							planFileRule: buildPlanFileRule(inputPath),
							feedback: feedbackText,
						}),
					},
				],
				details: { approved: false, feedback: feedbackText },
			};
		},
	});
}
