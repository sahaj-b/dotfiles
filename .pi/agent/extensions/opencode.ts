import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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

const OC_SESSION_ID = `ses_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

function ocHeaders(): Record<string, string> {
	return {
		"User-Agent": "opencode/1.14.50 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.13",
		"Accept": "*/*",
		"x-opencode-session": OC_SESSION_ID,
		"x-opencode-request": `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
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

function getModelConfig(meta: Record<string, unknown>): {
	api: string;
	baseUrl: string;
} {
	const providerNpm =
		(meta.provider as Record<string, string> | undefined)?.npm ?? "";
	// Anthropic-backed models (Qwen, MiniMax, Claude) return Anthropic SSE at
	// the unified /chat/completions endpoint; route them through anthropic-messages
	// so pi parses content_block_* / message_* events correctly.
	// Also: Anthropic SDK hardcodes the path as /v1/messages, while OpenAI SDK
	// uses /chat/completions. Strip the trailing /v1 so we don't get
	// /zen/v1/v1/messages (404).
	if (providerNpm === "@ai-sdk/anthropic")
		return { api: "anthropic-messages", baseUrl: OC_BASE_URL_ANTHROPIC };
	return { api: "openai-completions", baseUrl: OC_BASE_URL };
}

function buildPiModels(rawModels: RawModel[], provider: string): any[] {
	return rawModels.map((m) => {
		const limit = (m.meta.limit ?? {}) as Record<string, number>;
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

const REG_KEY = Symbol("pi-oc-sdk:registered");

export default function (pi: ExtensionAPI) {
	const g = globalThis as Record<symbol, any>;
	if (g[REG_KEY]) return;

	const zen = discoverModels();
	if (zen.length > 0) {
		const apiKey = resolveApiKey("opencode");
		pi.registerProvider(OC_PROVIDER, {
			apiKey,
			api: "openai-completions" as const,
			baseUrl: OC_BASE_URL,
			headers: ocHeaders(),
			models: buildPiModels(zen, OC_PROVIDER),
		});
	}

	g[REG_KEY] = true;

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
					: "Authenticated",
				"info",
			);
		},
	});
}
