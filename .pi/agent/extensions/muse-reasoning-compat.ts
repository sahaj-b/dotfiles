import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// OpenCode's Zen gateway serves Muse Spark from a pool of Meta "Console"
// callers. `reasoning.encrypted_content` is only readable by the caller that
// issued it, so replaying a blob the next request lands away from gives:
//   "reasoning `encrypted_content` was not issued to this caller"
// Because the blob stays in the transcript, every later turn fails too, and the
// only way out is switching models (pi skips reasoning replay cross-model).
//
// Rather than pay the quality cost up front, this watches for that failure and
// then degrades the current session to replaying plaintext reasoning summaries
// with no opaque payload. Full-fidelity reasoning replay stays the default.
const AFFECTED_PROVIDERS = new Set(["opencode", "opencode-go", "oc"]);
const AFFECTED_MODEL_PATTERN = /muse-spark/i;

const CALLER_BOUND_REASONING_ERROR = [
	/encrypted_content/i,
	/was not issued to this caller/i,
	/invalid_encrypted_content/i,
	/Referenced reasoning item/i,
	/encrypted content could not be (?:verified|decrypted)/i,
];

type Mode = "auto" | "always" | "off";

interface ResponseItem {
	type?: string;
	id?: string;
	encrypted_content?: unknown;
	summary?: unknown;
	content?: unknown;
	[key: string]: unknown;
}

interface ResponsesPayload {
	input?: unknown;
	include?: unknown;
}

let mode: Mode = process.env.PI_MUSE_REASONING === "auto" ||
	process.env.PI_MUSE_REASONING === "always" ||
	process.env.PI_MUSE_REASONING === "off"
	? (process.env.PI_MUSE_REASONING as Mode)
	: "auto";

// Sticky per process: once Zen has rejected a blob, do not put one back on
// the wire for the rest of this session.
let degraded = false;

const debug = (msg: string) => {
	if (process.env.PI_MUSE_STRIP_DEBUG) console.error(`[muse-reasoning-compat] ${msg}`);
};

function isAffectedModel(model: { provider: string; api: string; id: string } | undefined): boolean {
	if (!model || model.api !== "openai-responses") return false;
	return AFFECTED_PROVIDERS.has(model.provider) && AFFECTED_MODEL_PATTERN.test(model.id);
}

function hasSummaryText(item: ResponseItem): boolean {
	const parts = [...(Array.isArray(item.summary) ? item.summary : []),
		...(Array.isArray(item.content) ? item.content : [])];
	return parts.some((p) => typeof (p as { text?: unknown })?.text === "string"
		&& (p as { text: string }).text.trim().length > 0);
}

// Keep the digest of what the model thought, drop everything that is bound to a
// specific upstream caller: the blob and the item id that would be dereferenced
// against state the next caller does not have.
function toSummaryItem(item: ResponseItem): ResponseItem | undefined {
	const { id: _id, encrypted_content: _blob, ...rest } = item;
	return hasSummaryText(rest) ? rest : undefined;
}

function degradePayload(payload: ResponsesPayload): {
	payload: ResponsesPayload;
	droppedBlobs: number;
	keptSummaries: number;
} {
	const input = payload.input as ResponseItem[];
	const items: ResponseItem[] = [];
	let droppedBlobs = 0;
	let keptSummaries = 0;
	for (const item of input) {
		if (item?.type === "reasoning") {
			if (item.encrypted_content || item.id) droppedBlobs += 1;
			const summary = toSummaryItem(item);
			if (summary) {
				keptSummaries += 1;
				items.push(summary);
			}
			continue;
		}
		// Tool-call item ids are also upstream handles once reasoning is gone.
		if (item?.type === "function_call" || item?.type === "custom_tool_call") {
			const { id: _id, ...rest } = item;
			items.push(rest);
			continue;
		}
		items.push(item);
	}
	return { payload: { ...payload, input: items, include: [] }, droppedBlobs, keptSummaries };
}

export default function (pi: ExtensionAPI) {
	pi.on("before_provider_request", (event, ctx) => {
		if (mode === "off" || !isAffectedModel(ctx.model)) return;
		if (mode !== "always" && !degraded) return;

		const payload = event.payload as ResponsesPayload | undefined;
		if (!payload || !Array.isArray(payload.input)) return;

		const { payload: next, droppedBlobs, keptSummaries } = degradePayload(payload);
		debug(`degraded replay: ${droppedBlobs} blob/item-id refs removed, `
			+ `${keptSummaries} summary item(s) kept`);
		return next;
	});

	// Arm the fallback only on the caller-bound-reasoning signature, so an
	// unrelated 400 does not silently cost reasoning continuity.
	pi.on("message_end", (event, ctx) => {
		const message = event.message as {
			role?: string;
			stopReason?: string;
			errorMessage?: string;
		};
		if (message?.role !== "assistant" || message.stopReason !== "error") return;
		if (mode === "off" || !isAffectedModel(ctx.model)) return;
		const text = message.errorMessage ?? "";
		if (process.env.PI_MUSE_STRIP_DEBUG && text) debug(`error message seen: ${text.slice(0, 200)}`);
		if (degraded || !CALLER_BOUND_REASONING_ERROR.some((re) => re.test(text))) return;
		degraded = true;
		ctx.ui.notify(
			"Muse Spark rejected encrypted reasoning replay. This session now replays "
			+ "plaintext thinking summaries instead. Retry your last message.",
			"warning",
		);
		debug(`degraded mode armed by: ${text.slice(0, 160)}`);
	});

	pi.registerCommand("muse-reasoning", {
		description: "Reasoning replay mode for Muse Spark (status | auto | always | off | reset)",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();
			if (!arg) {
				ctx.ui.notify(
					`mode=${mode} degraded=${degraded ? "yes" : "no"} `
					+ `(always = summaries only, auto = full replay until Zen rejects it, off = never intervene)`,
					"info",
				);
				return;
			}
			if (arg === "reset") {
				degraded = false;
				ctx.ui.notify("Reasoning replay reset to full fidelity", "info");
				return;
			}
			if (arg === "auto" || arg === "always" || arg === "off") {
				mode = arg;
				if (arg !== "always") degraded = false;
				ctx.ui.notify(`Reasoning replay mode: ${mode}`, "info");
				return;
			}
			ctx.ui.notify("Usage: /muse-reasoning [auto|always|off|reset]", "warning");
		},
	});
}
