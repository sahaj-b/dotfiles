import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	Input,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { terminalWidth } from "./tool-beautify/ansi.js";

// Lightweight state tracking. (Cleaned up in renderResult so it stops memory leaking).
const toolStateMap = new Map<
	string,
	{ uiActive?: boolean; cancelled?: boolean }
>();

function clearSpinner(rc: any): void {
	if (rc.state._spin) {
		clearInterval(rc.state._spin);
		rc.state._spin = null;
	}
}

function getBullet(theme: any, rc: any, state: any): string {
	if (!rc.isPartial) {
		clearSpinner(rc);
		return theme.fg(state?.cancelled ? "error" : "accent", "●");
	}
	if (state?.uiActive) {
		clearSpinner(rc);
		return theme.fg("warning", "●");
	}
	if (!rc.state._spin) {
		rc.state._fi = 0;
		rc.state._spin = setInterval(() => {
			rc.state._fi = (rc.state._fi + 1) % 4;
			rc.invalidate();
		}, 60);
	}
	return theme.fg("warning", ["◐", "◓", "◑", "◒"][rc.state._fi]);
}

const OptionSchema = Type.Object({
	label: Type.String({
		maxLength: 100,
		description: "Display text. Concise (1-5 words). Unique.",
	}),
	description: Type.Optional(
		Type.String({ description: "Optional explanation of trade-offs." }),
	),
});

const AskQuestionParams = Type.Object({
	question: Type.String({
		description: "The full question. Clear and concise.",
	}),
	options: Type.Optional(
		Type.Array(OptionSchema, { minItems: 2, maxItems: 10 }),
	),
	multiSelect: Type.Optional(Type.Boolean({ default: false })),
});

async function askQuestionDialog(ctx: any, params: any): Promise<any> {
	return ctx.ui.custom(
		(tui: any, theme: any, _kb: any, done: (result: any) => void) => {
			const options = params.options || [];
			const isFree = options.length === 0;
			const inputIdx = options.length;
			const maxIdx = isFree ? 0 : options.length;

			let sel = 0;
			const checked = new Set<number>();
			const input = new Input();

			if (ctx.ui.getEditorText) {
				input.setValue(ctx.ui.getEditorText() || "");
			}

			function handleInput(data: string) {
				if (matchesKey(data, Key.escape) || matchesKey(data, "ctrl+c")) {
					return done({ cancelled: true });
				}

				if (!isFree) {
					if (matchesKey(data, Key.up)) {
						sel = sel > 0 ? sel - 1 : maxIdx;
						return tui.requestRender();
					}
					if (matchesKey(data, Key.down)) {
						sel = sel < maxIdx ? sel + 1 : 0;
						return tui.requestRender();
					}
				}

				const isInputRow = sel === inputIdx;

				if (
					params.multiSelect &&
					matchesKey(data, Key.space) &&
					!isInputRow &&
					!isFree
				) {
					checked.has(sel) ? checked.delete(sel) : checked.add(sel);
					return tui.requestRender();
				}

				if (matchesKey(data, Key.enter)) {
					const txt = input.getValue().trim();

					if (isFree) {
						return done(
							txt ? { kind: "custom", text: txt } : { cancelled: true },
						);
					}

					if (params.multiSelect) {
						const vals = Array.from(checked).map((i) => options[i].label);
						if (txt) vals.push(txt);
						if (vals.length > 0) done({ kind: "multi", selected: vals });
						return;
					}

					if (isInputRow) {
						if (txt) done({ kind: "custom", text: txt });
					} else {
						done({ kind: "option", label: options[sel].label });
					}
					return;
				}

				if (isFree || isInputRow) {
					input.handleInput(data);
					tui.requestRender();
				}
			}

			function render(w: number): string[] {
				const out: string[] = [theme.fg("accent", "─".repeat(w))];

				wrapTextWithAnsi(` ${params.question}`, Math.max(1, w)).forEach((l) =>
					out.push(truncateToWidth(theme.fg("text", l), w)),
				);
				out.push("");

				const getSearch = (subW: number) => {
					const s = input.render(subW)[0] || "";
					return s.startsWith("> ") ? s.slice(2) : s;
				};

				if (isFree) {
					out.push(
						`  ${theme.fg("text", "")}  ${getSearch(Math.max(1, w - 5))}`,
					);

				} else {
					options.forEach((opt: any, i: number) => {
						const focus = i === sel;
						const pre = focus ? theme.fg("accent", " ") : "  ";
						let ico;

						if (params.multiSelect) {
							ico = checked.has(i)
								? theme.fg("success", "")
								: theme.fg("text", "");
						} else {
							ico = focus ? theme.fg("success", "") : theme.fg("text", "");
						}

						out.push(
							truncateToWidth(
								`${pre}${ico}  ${theme.fg(focus ? "accent" : "text", opt.label)}`,
								w,
							),
						);

						if (opt.description) {
							wrapTextWithAnsi(opt.description, Math.max(1, w - 4)).forEach(
								(l) =>
									out.push(truncateToWidth(`    ${theme.fg("muted", l)}`, w)),
							);
						}
					});

					const focus = sel === inputIdx;
					const pre = focus ? theme.fg("accent", " ") : "  ";
					const val = focus
						? getSearch(Math.max(1, w - 7))
						: theme.fg("dim", input.getValue() || "Type something...");

					out.push(
						truncateToWidth(`${pre}${theme.fg("text", "")}  ${val}`, w),
					);

				}

				out.push("");
				return out;
			}

			return { render, invalidate: () => input.invalidate(), handleInput };
		},
	);
}

let uiLock: Promise<void> = Promise.resolve();

function withUILock<T>(fn: () => Promise<T>): Promise<T> {
	const prev = uiLock;
	let release: () => void;
	uiLock = new Promise<void>((r) => {
		release = r;
	});
	return prev.then(fn).finally(() => release());
}

export default function askQuestion(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_question",
		label: "Ask Question",
		description:
			"Ask the user a question with optional predefined options. Use this when you need the user to pick/select from choices. User HAS the option to type a custom answer.",
		promptSnippet:
			"Ask the user a question and present options for them to choose from.",
		promptGuidelines: [
			"To ask MULTIPLE questions, invoke this tool multiple times in the SAME response.",
			"options range: [2,10]",
			"label max length: 100 chars",
			"Optionally provide a description for each option (explaining trade-offs, etc).",
			"Do NOT include a 'Type something/Custom' option coz its builtin",
		],
		parameters: AskQuestionParams,
		renderShell: "self",

		async execute(toolCallId, params, signal, _onUpdate, ctx) {
			const q = params.question?.trim();
			if (!q)
				throw new Error("empty_question: cannot be empty or whitespace-only");

			const opts = params.options || [];
			if (opts.length === 1 || opts.length > 10) {
				throw new Error("invalid_options: must provide 0, or 2-10 options");
			}

			if (opts.length > 0) {
				const labels = new Set(opts.map((o) => o.label?.trim()));
				if (labels.has("") || labels.has(undefined))
					throw new Error("empty_label: option label cannot be empty");
				if (labels.size !== opts.length)
					throw new Error("duplicate_label: options must have unique labels");
				if (opts.some((o) => o.label.length > 100))
					throw new Error("label_too_long: option label exceeds 100 chars");
			}

			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: '{"cancelled":true}' }],
					details: { cancelled: true },
				};
			}

			toolStateMap.set(toolCallId, { uiActive: false });
			const originalText = ctx.ui.getEditorText?.() || "";

			const answer = await withUILock(async () => {
				toolStateMap.set(toolCallId, { uiActive: true });
				_onUpdate?.({ content: [], details: { _uiActive: true } });
				return await askQuestionDialog(ctx, params);
			});

			toolStateMap.set(toolCallId, {
				uiActive: false,
				cancelled: !!answer?.cancelled,
			});

			if (ctx.ui.setEditorText) {
				ctx.ui.setEditorText(originalText);
			}

			return {
				content: [{ type: "text", text: JSON.stringify(answer) }],
				details: answer,
			};
		},

		renderCall(args, theme, renderCtx) {
			const state = toolStateMap.get(renderCtx.toolCallId);
			const bulletStr = getBullet(theme, renderCtx, state);
			let text = `${bulletStr} ${theme.fg("warning", "")}  ${theme.fg("accent", args.question || "Asking question...")}`;

			if (!renderCtx.isPartial && state?.cancelled) {
				text += theme.fg("muted", " · ") + theme.fg("error", "Aborted");
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, options, theme, renderCtx) {
			clearSpinner(renderCtx);
			toolStateMap.delete(renderCtx.toolCallId); // Kill the leak

			if (result?.isError) {
				return new Text(
					`${theme.fg("muted", "╰─ ")}${theme.fg("error", `✗ Error: ${result.content?.[0]?.text || "Execution Failed"}`)}`,
					0,
					0,
				);
			}

			const answer = result?.details || result;
			if (options.isPartial || answer?.cancelled || answer?._uiActive) {
				return new Text("", 0, 0);
			}

			let answerText = "";
			if (answer.kind === "option") answerText = answer.label;
			else if (answer.kind === "custom") answerText = answer.text;
			else if (answer.kind === "multi")
				answerText = (answer.selected || []).join(", ");

			const maxCollapsed = Math.max(
				40,
				Math.floor(terminalWidth() * 0.85),
			);
			const displayText = answerText.length > maxCollapsed
				? answerText.slice(0, maxCollapsed) + "…"
				: answerText;

			return new Text(
				`${theme.fg("muted", "╰─ ")}${theme.fg("text", displayText)}`,
				0,
				0,
			);
		},
	});
}
