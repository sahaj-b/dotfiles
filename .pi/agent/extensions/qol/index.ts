import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { settingBoolean, settingNumber, settingString } from "./_config";
import {
	CONTEXT_USAGE_MESSAGE_TYPE,
	INSTALL_SYMBOL,
	THINKING_TIMER_STORE_SYMBOL,
} from "./constants";
import {
	buildQolContextUsageDetails,
	renderQolContextUsageMessage,
} from "./context-usage";
import {
	currentEditorText,
	getQolArgumentCompletions,
	installAutocompleteHintStyling,
	QolCompactPromptEditor,
} from "./editor";
import {
	attachmentLabels,
	imageContentForPath,
	resolveSubmittedImagePaths,
} from "./images";
import {
	notifyDesktop,
	notifyQuestionOpened,
	playQolNotificationSound,
	sendQolNotification,
} from "./notifications";
import {
	permissionGateCommands,
	permissionGateMatch,
	permissionGatePrompt,
} from "./permission-gate";
import {
	autoRenameEnabled,
	conversationTranscriptText,
	deterministicAutoRenameName,
	firstUserMessageText,
	generateAutoRenameName,
	withAutoRenamePrefix,
} from "./session-rename";
import {
	makeFallbackGitState,
	refreshGitState,
	renderStatusLine,
	setSpinnerActive,
	registerPlanProgressListener,
} from "./statusline";
import {
	getThinkingTimerStore,
	hiddenThinkingLabel,
	installThinkingTimerPatch,
	thinkingTimerLabel,
} from "./thinking-timer";

export default function (pi: ExtensionAPI) {
	if ((globalThis as any)[INSTALL_SYMBOL]) return;
	(globalThis as any)[INSTALL_SYMBOL] = true;

	registerPlanProgressListener(pi);

	let currentTui: any;
	let currentCtx: any;
	let currentGitState = makeFallbackGitState(process.cwd());
	let statuslineText = "";
	let thinkingTicker: ReturnType<typeof setInterval> | undefined;

	function refreshUI() {
		if (currentTui) currentTui.requestRender();
	}

	function updateStatusline(ctx: any, width?: number) {
		statuslineText = renderStatusLine(
			width ?? currentTui?.width ?? 80,
			ctx,
			currentGitState,
			pi,
			ctx.ui.theme,
		);
		refreshUI();
	}

	pi.registerCommand("qol", {
		description: "Pi QOL status and commands",
		getArgumentCompletions: getQolArgumentCompletions,
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const cwd = ctx.cwd;
			const trimmed = args.trim().toLowerCase();
			if (trimmed === "status" || !trimmed) {
				const labels = attachmentLabels(currentEditorText(ctx), ctx.cwd);
				const lines = [
					"Pi QOL status",
					`Statusline: replaces footer · prompt: ${settingBoolean("compactPrompt", true, cwd) ? "π compact" : "default chrome"}`,
					`Image chips: ${settingBoolean("showImageChips", true, cwd) ? "on" : "off"}`,
					`Image placeholders/paths in draft: ${labels.length ? labels.join(", ") : "none"}`,
					`Auto session rename: ${autoRenameEnabled(cwd) ? "enabled" : "disabled"},`
					`Notifications: ${settingBoolean("notification.enabled", true, cwd) ? "enabled" : "disabled"}`,
					`Permission gate: ${settingBoolean("permissionGate.enabled", false, cwd) ? `enabled (${permissionGateCommands(cwd).join(", ") || "none configured"})` : "disabled"}`,
					`Thinking timer: ${settingBoolean("thinkingTimer.enabled", true, cwd) ? "enabled" : "disabled"}`,
				];
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}
			if (trimmed === "rename" || trimmed === "rename full") {
				const full = trimmed === "rename full";
				const branch = ctx.sessionManager.getBranch();
				const text = full
					? conversationTranscriptText(branch, 2000)
					: firstUserMessageText(branch);
				if (!text) {
					ctx.ui.notify("No messages to rename from", "warning");
					return;
				}
				ctx.ui.notify("Generating session name...", "info");
				const result = await generateAutoRenameName(text);
				if (result.name) {
					pi.setSessionName(withAutoRenamePrefix(result.name, ctx.cwd));
					ctx.ui.notify(
						`Session renamed: ${result.name} (${result.source})`,
						"info",
					);
				} else {
					ctx.ui.notify("Could not generate session name", "warning");
				}
				return;
			}
			if (trimmed === "notify-test") {
				sendQolNotification(ctx, "test", "QOL notification test", "info");
				return;
			}
			ctx.ui.notify(
				"Usage: /qol [status|rename|rename full|notify-test]",
				"info",
			);
		},
	});

	pi.registerCommand("context", {
		description: "Show detailed context usage breakdown",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/context requires interactive mode", "error");
				return;
			}
			if (!buildQolContextUsageDetails) return;
			const timer = setTimeout(
				() => ctx.ui.notify("Analyzing context...", "info"),
				500,
			);
			timer.unref?.();
			const details = buildQolContextUsageDetails(
				pi,
				ctx,
				ctx.getSystemPromptOptions?.(),
			);
			clearTimeout(timer);
			if (!details) {
				ctx.ui.notify("No context usage data available", "warning");
				return;
			}
			pi.sendMessage({
				customType: CONTEXT_USAGE_MESSAGE_TYPE,
				content: "Context usage breakdown",
				display: true,
				details,
			});
		},
	});

	pi.registerMessageRenderer(
		CONTEXT_USAGE_MESSAGE_TYPE,
		renderQolContextUsageMessage,
	);

	// Thinking timer: track thinking block start times via stream events, with live refresh
	{
		const timerStore = {
			cwd: undefined as string | undefined,
			enabled: true,
			starts: new Map<string, number>(),
			durations: new Map<string, number>(),
			labels: new Map(),
			theme: undefined as any,
		};
		(globalThis as any)[THINKING_TIMER_STORE_SYMBOL] = timerStore;
		installThinkingTimerPatch();

		function finalizeThinkingBlock(key: string, endTimeMs = Date.now()) {
			const start = timerStore.starts.get(key);
			if (start === undefined) return;
			const duration = Math.max(0, endTimeMs - start);
			timerStore.starts.delete(key);
			timerStore.durations.set(key, duration);
			const label = timerStore.labels.get(key);
			if (label)
				label.setText(
					thinkingTimerLabel(timerStore.theme, duration, timerStore.cwd),
				);
			if (timerStore.starts.size === 0) {
				if (thinkingTicker) {
					clearInterval(thinkingTicker);
					thinkingTicker = undefined;
				}
			}
		}

		function tickLabels() {
			if (timerStore.starts.size === 0) return;
			for (const [key, start] of timerStore.starts) {
				const label = timerStore.labels.get(key);
				if (label)
					label.setText(
						thinkingTimerLabel(
							timerStore.theme,
							Date.now() - start,
							timerStore.cwd,
						),
					);
			}
		}

		function startTicker() {
			if (thinkingTicker) return;
			thinkingTicker = setInterval(tickLabels, 250);
			thinkingTicker.unref?.();
		}

		pi.on("message_update", (event: any, ctx: any) => {
			if (!settingBoolean("thinkingTimer.enabled", true, ctx.cwd)) return;
			timerStore.cwd = ctx.cwd;
			timerStore.theme = ctx.ui?.theme;
			const streamEvent = event.assistantMessageEvent as any;
			if (!streamEvent || typeof streamEvent.type !== "string") return;
			if (
				streamEvent.type === "thinking_start" ||
				streamEvent.type === "thinking_delta"
			) {
				const partial = streamEvent.partial;
				if (
					!partial ||
					typeof partial.timestamp !== "number" ||
					typeof streamEvent.contentIndex !== "number"
				)
					return;
				const key = `${partial.timestamp}:${streamEvent.contentIndex}`;
				if (!timerStore.starts.has(key) && !timerStore.durations.has(key))
					timerStore.starts.set(key, Date.now());
				startTicker();
				tickLabels();
				return;
			}
			if (streamEvent.type === "thinking_end") {
				const partial = streamEvent.partial;
				if (
					!partial ||
					typeof partial.timestamp !== "number" ||
					typeof streamEvent.contentIndex !== "number"
				)
					return;
				finalizeThinkingBlock(
					`${partial.timestamp}:${streamEvent.contentIndex}`,
				);
			}
		});

		pi.on("message_end", (event: any, _ctx: any) => {
			if (event.message.role !== "assistant") return;
			if (!Array.isArray(event.message.content)) return;
			for (let i = 0; i < event.message.content.length; i++) {
				if (event.message.content[i]?.type !== "thinking") continue;
				finalizeThinkingBlock(`${event.message.timestamp}:${i}`);
			}
		});
	}

	pi.on("session_start", async (event: any, ctx: any) => {
		if (!ctx.hasUI) return;
		currentCtx = ctx;

		ctx.ui.setWorkingVisible(false);
		ctx.ui.setHiddenThinkingLabel(hiddenThinkingLabel(ctx.ui.theme, ctx.cwd));

		// Statusline widget above editor
		currentGitState = makeFallbackGitState(ctx.cwd);
		refreshGitState(pi, ctx)
			.then((state) => {
				currentGitState = state;
				updateStatusline(ctx);
			})
			.catch(() => {});

		// Replace default footer with empty render to hide pi's built-in statusline
		ctx.ui.setFooter((_: any, _theme: any, _footerData: any) => ({
			render: () => [],
			invalidate() {},
			dispose() {},
		}));

		ctx.ui.setWidget("qol-statusline", (tui: any, theme: any) => {
			currentTui = tui;
			updateStatusline(ctx);
			return {
				render(width: number) {
					return [renderStatusLine(width, ctx, currentGitState, pi, theme)];
				},
				invalidate() {},
			};
		});

		// Compact prompt editor
		if (settingBoolean("compactPrompt", true, ctx.cwd)) {
			const paddingLines = Math.max(
				0,
				Math.floor(settingNumber("editor.inputBottomPaddingLines", 0, ctx.cwd)),
			);
			ctx.ui.setEditorComponent(
				(tui: any, editorTheme: any, keybindings: any) =>
					new QolCompactPromptEditor(
						tui,
						editorTheme,
						keybindings,
						paddingLines,
						ctx,
					),
			);
		}

		// Autocomplete hint styling
		installAutocompleteHintStyling(ctx);

		// Auto-rename: for resumed/forked sessions where text already exists
		if (event.reason !== "reload" && event.reason !== "new" && autoRenameEnabled(ctx.cwd)) {
			const branch = ctx.sessionManager.getBranch();
			const text = firstUserMessageText(branch);
			if (text && !pi.getSessionName()) {
				generateAutoRenameName(text)
					.then((result) => {
						if (result.name)
							pi.setSessionName(withAutoRenamePrefix(result.name, ctx.cwd));
					})
					.catch(() => {});
			}
		}

		// Periodic git state refresh
		const gitInterval = setInterval(() => {
			refreshGitState(pi, ctx)
				.then((state) => {
					currentGitState = state;
					updateStatusline(ctx);
				})
				.catch(() => {});
		}, 30000);
		gitInterval.unref?.();
	});

	// Session shutdown: clean up state so nothing leaks across sessions
	pi.on("session_shutdown", async (_event: any, ctx: any) => {
		currentCtx = undefined;
		ctx.ui.setWidget("qol-statusline", undefined);
		ctx.ui.setFooter(undefined);
		ctx.ui.setEditorComponent(undefined);
		ctx.ui.setStatus("qol-attachments", undefined);
		setSpinnerActive(false, () => {});
		if (thinkingTicker) {
			clearInterval(thinkingTicker);
			thinkingTicker = undefined;
		}
		const timerStore = getThinkingTimerStore();
		if (timerStore) {
			timerStore.starts.clear();
			timerStore.durations.clear();
			timerStore.labels.clear();
			timerStore.enabled = false;
		}
	});

	// Permission gate
	pi.on("tool_call", async (event: any, ctx: any) => {
		if (event.toolName !== "bash") return;
		if (!settingBoolean("permissionGate.enabled", false, ctx.cwd)) return;
		const command = event.input?.command ?? "";
		const matched = permissionGateMatch(command, ctx.cwd);
		if (!matched) return;
		// Notify + sound before blocking dialog (always fire regardless of focus — user needs to respond)
		const cwd = ctx.cwd;
		playQolNotificationSound("permission", cwd);
		notifyDesktop("Pi — Permission Required", `Blocked: ${matched}`, cwd);
		sendQolNotification(
			ctx,
			"critical",
			`Permission needed: ${matched}`,
			"warning",
			`permission:${matched}`,
			{ sound: false, desktop: false },
		);
		const choice = await ctx.ui.select(
			permissionGatePrompt(matched, command, ctx.cwd),
			["Allow once", "Block"],
		);
		if (choice !== "Allow once")
			return {
				block: true,
				reason: `Blocked by QOL permission gate (${matched})`,
			};
	});

	// Question notification via tool_call interception
	pi.on("tool_call", async (event: any, ctx: any) => {
		if (event.toolName !== "ask_user_question") return;
		if (!settingBoolean("notification.enabled", true, ctx.cwd)) return;
		// rpiv nests params under questions[0]
		const questions = event.input?.questions;
		const header =
			Array.isArray(questions) && questions.length > 0 && questions[0]?.header
				? questions[0].header
				: event.input?.header || "Input required";
		notifyQuestionOpened(ctx, header);
	});

	// Deterministic session name from first prompt (for new sessions where auto-rename can't run yet)
	pi.on("before_agent_start", async (event: any, ctx: any) => {
		if (pi.getSessionName()) return;
		if (!autoRenameEnabled(ctx.cwd)) return;
		const name = deterministicAutoRenameName(event.prompt, ctx.cwd);
		if (name) pi.setSessionName(withAutoRenamePrefix(name, ctx.cwd));
	});

	// Agent lifecycle: spinner + notifications
	pi.on("agent_start", async (_event: any, ctx: any) => {
		setSpinnerActive(true, () => updateStatusline(ctx));
	});

	// Tool errors: play error sound + notify
	pi.on("agent_end", async (event: any, ctx: any) => {
		setSpinnerActive(false, () => updateStatusline(ctx));

		const messages = Array.isArray(event.messages) ? event.messages : [];
		let lastText = "";
		for (let i = messages.length - 1; i >= 0; i--) {
			const m = messages[i];
			if (m?.role === "assistant") {
				const content = Array.isArray(m.content) ? m.content : [];
				lastText = content
					.filter((c: any) => c?.type === "text" && typeof c.text === "string")
					.map((c: any) => c.text)
					.join("\n");
				break;
			}
		}

		if (lastText) {
			const criticalMatch = lastText.match(
				/\b(critical|urgent|warning|blocked|cannot proceed|security|vulnerab|secret|credential|rate limit|context (overflow|full)|manual action required)\b/i,
			);
			if (criticalMatch) {
				sendQolNotification(
					ctx,
					"critical",
					`Critical: ${criticalMatch[0]}`,
					"error",
				);
				return;
			}
			const needsDir =
				/\?\s*$|\b(let me know|tell me|which (one|option)|choose|confirm|approve|should i|would you like|do you want|need your input|awaiting|next step)\b/i.test(
					lastText,
				);
			if (needsDir) {
				sendQolNotification(ctx, "direction", "Agent needs direction", "info");
				return;
			}
		}

		sendQolNotification(ctx, "ready", "Agent ready", "info");
	});

	// Input handler: resolve @path images
	pi.on("input", async (event: any, ctx: any) => {
		if (!settingBoolean("showImageChips", true, ctx.cwd))
			return { action: "continue" };
		const paths = resolveSubmittedImagePaths(event.text, ctx.cwd);
		if (paths.length === 0) return { action: "continue" };
		const existingImages = Array.isArray(event.images) ? event.images : [];
		const newImages = paths
			.map((path) => imageContentForPath(path))
			.filter(Boolean);
		if (newImages.length === 0) return { action: "continue" };
		return {
			action: "transform",
			text: event.text,
			images: [...existingImages, ...newImages],
		};
	});
}
