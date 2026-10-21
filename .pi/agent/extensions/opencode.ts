import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	getApiProvider,
	getCurrentTools,
	normalizeContext,
	Type,
	type TranscriptContext,
} from "@earendil-works/pi-ai";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

const OC_PROVIDER = "oc";
const OC_BASE_URL = "https://opencode.ai/zen/v1";
const OC_BASE_URL_ANTHROPIC = "https://opencode.ai/zen";

// How opencode v2 (2.0.x) talks to the API: it fetches per-workspace routing
// from Console (`GET {console}/api/v2/config` with the API key) and then uses
// the returned inference baseURL plus the `x-opencode-org-id` workspace header.
// The old hardcoded Zen base URL above is only a fallback for anonymous use.
const OC_CONSOLE_CONFIG_URL = "https://opencode.ai/console/api/v2/config";
// The free tier requires an `opencode`-containing User-Agent (else
// FreeTierError). This mirrors the official CLI's `opencode/<channel>/<version>/<name>`.
const OC_USER_AGENT = "opencode/latest/2.0.30/cli";
const OC_REMOTE_CACHE_PATH = join(
	homedir(),
	".pi",
	"agent",
	"opencode-remote.json",
);
const OC_REMOTE_CACHE_TTL_MS = 24 * 3600 * 1000;
// Pi refreshes its pi.dev-backed catalog independently of this extension. That
// makes models-store.json the freshest source when Console routing is missing
// or stale (e.g. OAuth login instead of an API key, expired routing cache).
const MODELS_STORE_PATH = join(
	homedir(),
	".pi",
	"agent",
	"models-store.json",
);

const REGISTRY_PATHS = [
	join(homedir(), ".cache", "opencode", "models.json"),
	join(homedir(), ".config", "opencode", "models.json"),
];

const AUTH_PATHS = [
	join(homedir(), ".local", "share", "opencode", "auth.json"),
	join(homedir(), ".pi", "agent", "auth.json"),
];
const OPENCODE_AUTH_PATH = join(
	homedir(),
	".local",
	"share",
	"opencode",
	"auth.json",
);
const PI_AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

// Session/message IDs in v2 client format: `ses_`/`msg_` + 26 chars (12 hex
// timestamp + 14 base62 random). Verified against v2's local session database;
// this matches what the official client sends in `x-opencode-session`.
const OC_ID_CHARS =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
let ocLastTimestamp = 0;
let ocCounter = 0;
function ocIdentifier(descending: boolean): string {
	const now = Date.now();
	if (now !== ocLastTimestamp) {
		ocLastTimestamp = now;
		ocCounter = 0;
	}
	ocCounter++;
	const current = BigInt(ocLastTimestamp) * 0x1000n + BigInt(ocCounter);
	const value = descending ? ~current : current;
	const time = Array.from({ length: 6 }, (_, i) =>
		Number((value >> BigInt(40 - 8 * i)) & 0xffn)
			.toString(16)
			.padStart(2, "0"),
	).join("");
	const bytes = crypto.getRandomValues(new Uint8Array(14));
	return time + Array.from(bytes, (b) => OC_ID_CHARS[b % 62]).join("");
}

const OC_SESSION_ID = `ses_${ocIdentifier(true)}`;

// The free tier rejects any request that does not declare a tool named exactly
// `read` (403 FreeTierError), regardless of headers. Chat requests carry Pi's
// real read tool, but summarization/compaction sends none, so inject this
// placeholder when the transcript has no read tool. Without it every
// auto-compaction and branch summary fails.
const FREE_TIER_READ_TOOL = {
	name: "read",
	description: "Placeholder tool. Do not call; use only the transcript to write the summary.",
	parameters: Type.Object({
		filePath: Type.Optional(Type.String({ description: "Path to read" })),
	}),
};

function withFreeTierReadTool(context: TranscriptContext): TranscriptContext {
	if (getCurrentTools(context.messages).some((tool) => tool.name === "read"))
		return context;

	const messages = [...context.messages];
	const first = messages[0];
	if (first?.role === "system") {
		messages[0] = {
			...first,
			toolsAdded: [...(first.toolsAdded ?? []), FREE_TIER_READ_TOOL],
		};
	} else {
		messages.unshift({
			role: "system",
			content: "",
			timestamp: Date.now(),
			toolsAdded: [FREE_TIER_READ_TOOL],
		});
	}
	return normalizeContext({ messages });
}

function ocHeaders(): Record<string, string> {
	return {
		"User-Agent": OC_USER_AGENT,
		Accept: "*/*",
		"x-opencode-session": OC_SESSION_ID,
		"x-opencode-request": `msg_${ocIdentifier(false)}`,
		"x-opencode-project": "global",
		"x-opencode-client": "cli",
	};
}

function resolveRegistryPath(): string {
	for (const p of REGISTRY_PATHS) {
		if (existsSync(p)) return p;
	}
	return "";
}

function resolveApiKey(provider: string): string {
	if (process.env.OPENCODE_API_KEY) return process.env.OPENCODE_API_KEY;

	for (const p of AUTH_PATHS) {
		if (!existsSync(p)) continue;
		try {
			const auth = JSON.parse(readFileSync(p, "utf-8"));
			const key = auth?.[provider]?.key;
			if (key) return key;
			const fallback = auth?.["opencode-go"]?.key;
			if (fallback) return fallback;
		} catch {}
	}

	return "public";
}

function setOpencodeGoApiKey(apiKey: string): void {
	const opencodeDir = join(homedir(), ".local", "share", "opencode");
	const piDir = join(homedir(), ".pi", "agent");

	if (!existsSync(opencodeDir)) {
		mkdirSync(opencodeDir, { recursive: true, mode: 0o700 });
	}
	let data: Record<string, unknown> = {};
	if (existsSync(OPENCODE_AUTH_PATH)) {
		try {
			data = JSON.parse(readFileSync(OPENCODE_AUTH_PATH, "utf-8"));
		} catch {
			throw new Error(
				`opencode auth.json is malformed. Fix manually: ${OPENCODE_AUTH_PATH}`,
			);
		}
	}
	data["opencode-go"] = { type: "api", key: apiKey };
	writeFileSync(OPENCODE_AUTH_PATH, JSON.stringify(data, null, 2), {
		encoding: "utf-8",
		mode: 0o600,
	});
	try {
		chmodSync(OPENCODE_AUTH_PATH, 0o600);
	} catch {}

	if (!existsSync(piDir)) {
		mkdirSync(piDir, { recursive: true, mode: 0o700 });
	}
	let piData: Record<string, unknown> = {};
	if (existsSync(PI_AUTH_PATH)) {
		try {
			piData = JSON.parse(readFileSync(PI_AUTH_PATH, "utf-8"));
		} catch {}
	}
	piData["opencode-go"] = { type: "api_key", key: apiKey };
	writeFileSync(PI_AUTH_PATH, JSON.stringify(piData, null, 2), {
		encoding: "utf-8",
		mode: 0o600,
	});
	try {
		chmodSync(PI_AUTH_PATH, 0o600);
	} catch {}
}

type RawModel = {
	id: string;
	name: string;
	baseUrl: string;
	meta: Record<string, unknown>;
};

function discoverModels(): RawModel[] {
	const zen: RawModel[] = [];

	const path = resolveRegistryPath();
	if (!path) return zen;

	let raw: string;
	try {
		raw = readFileSync(path, "utf-8");
	} catch {
		return zen;
	}

	let data: Record<string, any>;
	try {
		data = JSON.parse(raw);
	} catch {
		return zen;
	}

	for (const [provId, prov] of Object.entries(data)) {
		if (provId !== "opencode") continue;
		if (!prov || typeof prov !== "object") continue;

		const baseUrl: string = OC_BASE_URL;
		const models: Record<string, Record<string, unknown>> = prov.models;
		if (!models || typeof models !== "object") continue;

		for (const [modelId, meta] of Object.entries(models)) {
			if (!meta || typeof meta !== "object") continue;
			if (!modelId.endsWith("-free")) continue;
			zen.push({
				id: modelId,
				name: (meta.name as string) || modelId,
				baseUrl,
				meta,
			});
		}
	}

	return zen;
}

function buildThinkingLevelMap(
	meta: Record<string, unknown>,
): Record<string, string | null> | undefined {
	if (meta.reasoning !== true) return undefined;
	const options = meta.reasoning_options;
	if (!Array.isArray(options)) return undefined;

	const values = new Set<string>();
	let hasToggle = false;
	for (const opt of options) {
		if (!opt || typeof opt !== "object") continue;
		const o = opt as Record<string, unknown>;
		if (o.type === "toggle") hasToggle = true;
		if (o.type === "effort" && Array.isArray(o.values)) {
			for (const v of o.values) {
				if (typeof v === "string") values.add(v);
			}
		}
	}
	if (values.size === 0) return undefined;

	const map: Record<string, string | null> = {
		minimal: null,
		low: values.has("low") ? "low" : null,
		medium: values.has("medium") ? "medium" : null,
		high: values.has("high") ? "high" : null,
		xhigh: values.has("xhigh") ? "xhigh" : null,
		max: values.has("max") ? "max" : null,
	};
	// No toggle => thinking can't be disabled, hide the off level.
	if (!hasToggle) map.off = null;
	return map;
}

function getModelConfig(meta: Record<string, unknown>): {
	api: string;
	baseUrl: string;
} {
	const providerNpm =
		(meta.provider as Record<string, string> | undefined)?.npm ?? "";
	// Mirrors oh-my-pi/packages/ai/src/provider-models/openai-compat.ts::createOpenCodeApiResolution
	// - @ai-sdk/anthropic -> anthropic-messages at bare /zen (SDK appends /v1/messages)
	// - @ai-sdk/google    -> google-generative-ai at /zen/v1
	// - @ai-sdk/openai    -> openai-responses at /zen/v1 (Muse Spark, GPT-5.x, etc need Responses API, not Chat Completions)
	// - no npm / other    -> openai-completions at /zen/v1 (DeepSeek, GLM, Kimi etc)
	if (providerNpm === "@ai-sdk/anthropic")
		return { api: "anthropic-messages", baseUrl: OC_BASE_URL_ANTHROPIC };
	if (providerNpm === "@ai-sdk/google")
		return { api: "google-generative-ai", baseUrl: OC_BASE_URL };
	if (providerNpm === "@ai-sdk/openai")
		return { api: "openai-responses", baseUrl: OC_BASE_URL };
	return { api: "openai-completions", baseUrl: OC_BASE_URL };
}

function buildPiModels(rawModels: RawModel[], provider: string): any[] {
	return rawModels.map((m) => {
		const limit = (m.meta.limit ?? {}) as Record<string, number>;
		const thinkingLevelMap = buildThinkingLevelMap(m.meta);
		const cost = (m.meta.cost ?? {}) as Record<string, number>;
		const mods = (m.meta.modalities ?? {}) as Record<string, string[]>;
		const family = (m.meta.family as string) || "";

		const needsReasoningCompat =
			family.includes("deepseek") || family.includes("kimi");

		const contextWindow =
			family.includes("deepseek") ||
			m.id.includes("deepseek") ||
			family.includes("qwen") ||
			m.id.includes("qwen")
				? 1000000
				: ((limit.context as number) ?? (limit.maxInput as number) ?? 204800);

		const modelCfg = getModelConfig(m.meta);
		return {
			id: m.id,
			name: m.name,
			api: modelCfg.api,
			provider,
			baseUrl: modelCfg.baseUrl,
			contextWindow,
			maxTokens:
				(limit.output as number) ?? (limit.maxOutput as number) ?? 131072,
			maxOutput:
				(limit.output as number) ?? (limit.maxOutput as number) ?? 131072,
			reasoning: (m.meta.reasoning as boolean) ?? false,
			cost: {
				input: (cost.input as number) ?? 0,
				output: (cost.output as number) ?? 0,
				cacheRead: (cost.cacheRead as number) ?? 0,
				cacheWrite: (cost.cacheWrite as number) ?? 0,
			},
			input: mods.input ?? ["text"],
			...(thinkingLevelMap ? { thinkingLevelMap } : {}),
			...(needsReasoningCompat
				? {
						compat: {
							requiresReasoningContentOnAssistantMessages: true,
							thinkingFormat: family.includes("deepseek")
								? "deepseek"
								: undefined,
						},
					}
				: {}),
		};
	});
}

type RemoteModelEntry = {
	name?: string;
	family?: string;
	package?: string;
	settings?: { baseURL?: string };
	capabilities?: { input?: string[] };
	cost?: Array<{
		input?: number;
		output?: number;
		cache?: { read?: number; write?: number };
	}>;
	limit?: { context?: number; input?: number; output?: number };
};

type RemoteRouting = {
	baseUrl: string;
	headers: Record<string, string>;
	models: Record<string, RemoteModelEntry>;
};

function keyFingerprint(apiKey: string): string {
	return `${apiKey.length}:${apiKey.slice(0, 4)}:${apiKey.slice(-4)}`;
}

function loadRemoteCache(apiKey: string): RemoteRouting | null {
	if (!existsSync(OC_REMOTE_CACHE_PATH)) return null;
	try {
		const cached = JSON.parse(readFileSync(OC_REMOTE_CACHE_PATH, "utf-8"));
		if (cached?.fp !== keyFingerprint(apiKey)) return null;
		if (typeof cached?.at !== "number") return null;
		if (Date.now() - cached.at > OC_REMOTE_CACHE_TTL_MS) return null;
		const routing = cached?.routing;
		if (!routing || typeof routing !== "object") return null;
		if (typeof routing.baseUrl !== "string") return null;
		if (!routing.models || typeof routing.models !== "object") return null;
		return routing as RemoteRouting;
	} catch {
		return null;
	}
}

function saveRemoteCache(apiKey: string, routing: RemoteRouting): void {
	try {
		const dir = join(homedir(), ".pi", "agent");
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
		writeFileSync(
			OC_REMOTE_CACHE_PATH,
			JSON.stringify(
				{ fp: keyFingerprint(apiKey), at: Date.now(), routing },
				null,
				2,
			),
			{ encoding: "utf-8", mode: 0o600 },
		);
		try {
			chmodSync(OC_REMOTE_CACHE_PATH, 0o600);
		} catch {}
	} catch {}
}

// Mirrors v2's OpencodePlugin.fetchConfig: per-workspace routing (inference
// baseURL, org header, model catalog) for the given API key. Returns null when
// there is no key or the Console cannot be reached, in which case the caller
// falls back to the anonymous Zen path.
async function fetchRemoteRouting(
	apiKey: string,
): Promise<RemoteRouting | null> {
	if (!apiKey || apiKey === "public") return null;
	try {
		const res = await fetch(OC_CONSOLE_CONFIG_URL, {
			method: "GET",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${apiKey}`,
				"User-Agent": OC_USER_AGENT,
			},
			signal: AbortSignal.timeout(20000),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			providers?: Record<
				string,
				{
					settings?: { baseURL?: string };
					headers?: Record<string, string>;
					models?: Record<string, RemoteModelEntry>;
				}
			>;
		};
		const entry = data?.providers?.["opencode"];
		const baseUrl = entry?.settings?.baseURL;
		const models = entry?.models;
		if (!baseUrl || !models || typeof models !== "object") return null;
		return {
			baseUrl,
			headers:
				entry.headers && typeof entry.headers === "object"
					? { ...entry.headers }
					: {},
			models,
		};
	} catch {
		return null;
	}
}

// v2 remote packages look like `aisdk:@ai-sdk/anthropic`; the local models.json
// registry uses bare `provider.npm`. Both map to Pi APIs the same way.
function remotePackageToApi(pkg: string | undefined): string {
	const name = (pkg ?? "").replace(/^aisdk:/, "");
	if (name === "@ai-sdk/anthropic") return "anthropic-messages";
	if (name === "@ai-sdk/google") return "google-generative-ai";
	if (name === "@ai-sdk/openai") return "openai-responses";
	return "openai-completions";
}

function readRegistryMeta(): Record<string, Record<string, unknown>> {
	const path = resolveRegistryPath();
	if (!path) return {};
	try {
		const data = JSON.parse(readFileSync(path, "utf-8")) as Record<
			string,
			{ models?: Record<string, Record<string, unknown>> }
		>;
		return data?.["opencode"]?.models ?? {};
	} catch {
		return {};
	}
}

type StoreModel = {
	id: string;
	name?: string;
	api?: string;
	baseUrl?: string;
	reasoning?: boolean;
	input?: string[];
	inputLimits?: Record<string, unknown>;
	thinkingLevelMap?: Record<string, string | null>;
	compat?: Record<string, unknown>;
	contextWindow?: number;
	maxTokens?: number;
	cost?: Record<string, number>;
	type?: string;
	[key: string]: unknown;
};

// Reads Pi's own refreshed copy of the OpenCode catalog. Models are already in
// Pi's model shape (api/baseUrl/limits/compat), so they can be registered as-is.
// Mirrors the old fallback behaviour: free models only when there is no routing.
function readModelsStore(freeOnly: boolean): StoreModel[] {
	try {
		const data = JSON.parse(readFileSync(MODELS_STORE_PATH, "utf-8")) as Record<
			string,
			{ models?: StoreModel[] }
		>;
		const models = data?.["opencode"]?.models;
		if (!Array.isArray(models)) return [];
		return models
			.filter(
				(m) =>
					m &&
					typeof m === "object" &&
					typeof m.id === "string" &&
					m.id.length > 0 &&
					(m.type === undefined || m.type === "chat") &&
					(!freeOnly || m.id.endsWith("-free")),
			)
			.map((m) => ({ ...m, provider: OC_PROVIDER }));
	} catch {
		return [];
	}
}

// Earlier lists win on duplicate ids; later lists only fill gaps.
function mergeModels(...lists: StoreModel[][]): StoreModel[] {
	const merged = new Map<string, StoreModel>();
	for (const list of lists) {
		for (const model of list) {
			if (!model || typeof model.id !== "string" || !model.id) continue;
			if (!merged.has(model.id)) merged.set(model.id, model);
		}
	}
	return [...merged.values()];
}

function buildRemoteModels(
	routing: RemoteRouting,
	provider: string,
	zenMeta: Record<string, Record<string, unknown>>,
	storeMeta: Map<string, StoreModel>,
): StoreModel[] {
	return Object.entries(routing.models).map(([id, cfg]) => {
		const stored = storeMeta.get(id);
		const meta = (zenMeta[id] ?? stored ?? {}) as Record<string, unknown>;
		const limit = cfg.limit ?? {};
		const cost = cfg.cost?.[0] ?? {};
		const family = (cfg.family as string) || (meta.family as string) || "";
		const needsReasoningCompat =
			family.includes("deepseek") ||
			family.includes("kimi") ||
			id.includes("deepseek") ||
			id.includes("kimi");
		const thinkingLevelMap =
			stored?.thinkingLevelMap ?? buildThinkingLevelMap(meta);
		const compat = {
			...(stored?.compat ?? {}),
			...(needsReasoningCompat
				? {
						requiresReasoningContentOnAssistantMessages: true,
						thinkingFormat:
							family.includes("deepseek") || id.includes("deepseek")
								? "deepseek"
								: undefined,
					}
				: {}),
		};
		return {
			id,
			name: cfg.name || stored?.name || (meta.name as string) || id,
			api: remotePackageToApi(cfg.package),
			provider,
			baseUrl: cfg.settings?.baseURL ?? routing.baseUrl,
			contextWindow:
				limit.context ?? limit.input ?? stored?.contextWindow ?? 204800,
			maxTokens: limit.output ?? stored?.maxTokens ?? 131072,
			maxOutput: limit.output ?? stored?.maxTokens ?? 131072,
			// Prefer the catalog's real reasoning metadata; the Console routing
			// response carries none, so fall back to true for unknowns (as the
			// old Zen free models were) to keep thinking levels offered.
			reasoning: stored?.reasoning ?? true,
			cost: {
				input: cost.input ?? 0,
				output: cost.output ?? 0,
				cacheRead: cost.cache?.read ?? 0,
				cacheWrite: cost.cache?.write ?? 0,
			},
			input: cfg.capabilities?.input ?? stored?.input ?? ["text"],
			...(stored?.inputLimits ? { inputLimits: stored.inputLimits } : {}),
			...(thinkingLevelMap ? { thinkingLevelMap } : {}),
			...(Object.keys(compat).length > 0 ? { compat } : {}),
		};
	});
}

export default async function (pi: ExtensionAPI) {
	const apiKey = resolveApiKey("opencode");
	let mode = "catalog";
	let modelCount = 0;

	// Mimic v2: with an API key, use the Console-provided routing (inference
	// baseURL + workspace org header + full model catalog). v2 ignores the
	// catalog's own apiKey and authenticates with the user's key instead.
	const live = apiKey === "public" ? null : await fetchRemoteRouting(apiKey);
	const routing = live ?? loadRemoteCache(apiKey);
	if (live) saveRemoteCache(apiKey, live);

	// Catalog sources, most authoritative first:
	//   1. Console routing for this key/workspace (per-model base URLs + api)
	//   2. Pi's pi.dev-backed models-store.json, refreshed independently of this
	//      extension, so new models appear even when routing is stale/missing
	//   3. The local OpenCode registry snapshot (last resort only)
	// Without routing, stay free-only like the original fallback did.
	const storeModels = readModelsStore(routing === null);
	const storeMeta = new Map(storeModels.map((m) => [m.id, m]));
	const routingModels = routing
		? buildRemoteModels(routing, OC_PROVIDER, readRegistryMeta(), storeMeta)
		: [];
	// Fallback also keeps the local registry's free list, so older free models
	// that predate the last models-store refresh don't disappear.
	const registryModels =
		routing === null ? buildPiModels(discoverModels(), OC_PROVIDER) : [];
	const models = mergeModels(routingModels, storeModels, registryModels);

	if (models.length > 0) {
		modelCount = models.length;
		mode = routing
			? `inference (${routingModels.length} routed, ${modelCount} total)`
			: `catalog (${modelCount} models)`;
		pi.registerProvider(OC_PROVIDER, {
			apiKey,
			api: "openai-completions" as const,
			baseUrl: routing?.baseUrl ?? OC_BASE_URL,
			headers: { ...ocHeaders(), ...(routing?.headers ?? {}) },
			models,
			streamSimple: (model, context, options) => {
				const api = getApiProvider(model.api);
				if (!api) throw new Error(`No API provider for ${model.api}`);
				const transcript = model.id.endsWith("-free")
					? withFreeTierReadTool(context)
					: context;
				return api.streamSimple(model, transcript, options);
			},
		});
	}

	pi.registerCommand("opencode-go-key", {
		description: "Set your OpenCode Go API key directly (no CLI required)",
		handler: async (args: string, ctx) => {
			let apiKey = args.trim();
			if (!apiKey) {
				apiKey =
					(await ctx.ui.input("Enter your OpenCode Go API Key", "sk-...")) ??
					"";
			}
			if (!apiKey) {
				ctx.ui.notify("No API key provided", "warning");
				return;
			}
			try {
				setOpencodeGoApiKey(apiKey);
			} catch (err: any) {
				ctx.ui.notify(err.message ?? "Failed to save API key", "error");
				return;
			}
			ctx.ui.notify("OpenCode Go API key saved and active!", "info");
		},
	});
	pi.registerCommand("opencode-status", {
		description: "Check OpenCode authentication status",
		handler: async (_args, ctx) => {
			const key = resolveApiKey("opencode");
			ctx.ui.notify(
				key === "public"
					? "Using public auth (no API Key found)"
					: `Authenticated [${mode}, ${modelCount} models]`,
				"info",
			);
		},
	});
}
