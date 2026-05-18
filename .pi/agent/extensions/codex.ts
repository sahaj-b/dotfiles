import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync, writeFileSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { spawn, execSync } from "child_process";

// ============================================================================
// Config
// ============================================================================

const CODEX_AUTH_PATH = join(homedir(), ".codex", "auth.json");
const CODEX_MODELS_CACHE = join(homedir(), ".codex", "models_cache.json");
const CODEX_VERSION = "0.130.0";
const CODEX_API_BASE = "https://chatgpt.com/backend-api";
const CODEX_RESPONSES_URL = `${CODEX_API_BASE}/codex/responses`;
const REG_KEY = Symbol("pi-codex:registered");

// ============================================================================
// Auth
// ============================================================================

interface CodexAuth {
  tokens: { access_token: string; refresh_token: string; account_id: string };
  last_refresh: string;
}

function readCodexAuth(): CodexAuth | null {
  try {
    if (!existsSync(CODEX_AUTH_PATH)) return null;
    const raw = readFileSync(CODEX_AUTH_PATH, "utf-8");
    const auth = JSON.parse(raw);
    if (!auth.tokens?.access_token || !auth.tokens?.account_id) return null;
    return auth;
  } catch {
    return null;
  }
}

function readCodexAccessToken(): string | null {
  return readCodexAuth()?.tokens.access_token ?? null;
}

function readCodexAccountId(): string | null {
  return readCodexAuth()?.tokens.account_id ?? null;
}

function isTokenExpired(auth: CodexAuth): boolean {
  try {
    const payload = JSON.parse(atob(auth.tokens.access_token.split(".")[1]));
    return (payload.exp * 1000 - 60000) < Date.now();
  } catch {
    return false;
  }
}

async function refreshToken(auth: CodexAuth): Promise<boolean> {
  try {
    const resp = await fetch("https://auth.openai.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.tokens.refresh_token,
        client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
      }),
    });
    if (!resp.ok) return false;
    const json = await resp.json();
    if (!json.access_token) return false;
    auth.tokens.access_token = json.access_token;
    auth.tokens.refresh_token = json.refresh_token || auth.tokens.refresh_token;
    auth.last_refresh = new Date().toISOString();
    writeFileSync(CODEX_AUTH_PATH, JSON.stringify(auth, null, 2), { encoding: "utf-8", mode: 0o600 });
    try { chmodSync(CODEX_AUTH_PATH, 0o600); } catch {}
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Models
// ============================================================================

function discoverModels(): ProviderModelConfig[] {
  const models: ProviderModelConfig[] = [];
  let raw: any[] = [];

  if (existsSync(CODEX_MODELS_CACHE)) {
    try { raw = JSON.parse(readFileSync(CODEX_MODELS_CACHE, "utf-8")).models || []; } catch {}
  }
  if (!raw.length) {
    try { raw = JSON.parse(execSync("codex debug models --bundled 2>/dev/null", { encoding: "utf-8", timeout: 10000 })).models || []; } catch {}
  }

  for (const m of raw) {
    if (!m.supported_in_api || m.slug === "codex-auto-review") continue;
    const ctx = m.context_window || m.max_context_window || 128000;
    models.push({
      id: m.slug,
      name: m.display_name || m.slug,
      reasoning: (m.supported_reasoning_levels || []).length > 1,
      input: m.input_modalities?.includes("image") ? ["text", "image"] : ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: ctx,
      maxTokens: ctx,
    });
  }
  return models;
}

// ============================================================================
// Rate Limit Parsing (from response headers)
// ============================================================================

interface RateLimitInfo {
  planType: string;
  activeLimit: string;
  limitName: string;
  primaryUsedPercent: number;
  primaryWindowMinutes: number;
  primaryResetAt: number | null;
  primaryResetAfterSeconds: number | null;
  primaryOverSecondaryPercent: number;
  secondaryUsedPercent: number;
  hasCredits: boolean;
  creditsUnlimited: boolean;
  creditsBalance: string;
}

function parseRateLimitHeaders(headers: Record<string, string>): RateLimitInfo {
  const get = (name: string) => headers[name.toLowerCase()] ?? "";
  return {
    planType: get("x-codex-plan-type"),
    activeLimit: get("x-codex-active-limit"),
    limitName: get("x-codex-limit-name") || get("x-codex-codex-limit-name"),
    primaryUsedPercent: parseFloat(get("x-codex-primary-used-percent")) || 0,
    primaryWindowMinutes: parseInt(get("x-codex-primary-window-minutes")) || 0,
    primaryResetAt: parseInt(get("x-codex-primary-reset-at")) || null,
    primaryResetAfterSeconds: parseInt(get("x-codex-primary-reset-after-seconds")) || null,
    primaryOverSecondaryPercent: parseFloat(get("x-codex-primary-over-secondary-limit-percent")) || 0,
    secondaryUsedPercent: parseFloat(get("x-codex-secondary-used-percent")) || 0,
    hasCredits: get("x-codex-credits-has-credits") === "True",
    creditsUnlimited: get("x-codex-credits-unlimited") === "True",
    creditsBalance: get("x-codex-credits-balance"),
  };
}

function formatRateLimitInfo(info: RateLimitInfo): string {
  const lines: string[] = [];
  const pct = info.primaryUsedPercent;
  const barLen = 20;
  const filled = Math.round((pct / 100) * barLen);
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, barLen - filled));

  lines.push(`\x1b[1mPlan:\x1b[0m ${info.planType} (${info.activeLimit})`);
  if (info.limitName) lines.push(`\x1b[1mLimit:\x1b[0m ${info.limitName}`);
  lines.push(`\x1b[1mPrimary:\x1b[0m ${bar} \x1b[33m${pct.toFixed(1)}%\x1b[0m used`);

  if (info.primaryResetAfterSeconds) {
    let remaining = info.primaryResetAfterSeconds;
    const days = Math.floor(remaining / 86400);
    remaining %= 86400;
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const mins = Math.floor(remaining / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
    lines.push(`  Resets in ${parts.join(" ")}`);
  }

  if (info.primaryOverSecondaryPercent > 0) {
    lines.push(`  \x1b[33mOverflow:\x1b[0m ${info.primaryOverSecondaryPercent.toFixed(1)}% into secondary`);
  }

  if (info.secondaryUsedPercent > 0) {
    lines.push(`\x1b[1mSecondary:\x1b[0m ${info.secondaryUsedPercent.toFixed(1)}% used`);
  } else if (info.primaryOverSecondaryPercent > 0) {
    // Show secondary even at 0% if there's overflow
  }

  if (info.hasCredits) {
    lines.push(`\x1b[1mCredits:\x1b[0m ${info.creditsUnlimited ? "\x1b[32mUnlimited\x1b[0m" : info.creditsBalance || "Available"}`);
  } else if (info.activeLimit === "premium" || info.activeLimit === "plus") {
    lines.push(`\x1b[1mCredits:\x1b[0m \x1b[32mIncluded with plan\x1b[0m`);
  }

  return lines.join("\n");
}

// ============================================================================
// Extension Entry
// ============================================================================

export default function (pi: ExtensionAPI) {
  if ((globalThis as any)[REG_KEY]) return;
  (globalThis as any)[REG_KEY] = true;

  const models = discoverModels();
  if (!models.length) return;

  // Try to refresh expired token on startup
  const auth = readCodexAuth();
  if (auth && isTokenExpired(auth)) refreshToken(auth);

  // Register provider using pi-ai's built-in openai-codex-responses provider.
  pi.registerProvider("codex", {
    apiKey: readCodexAccessToken() || undefined,
    api: "openai-codex-responses",
    baseUrl: CODEX_API_BASE,
    headers: {
      "Originator": "codex_cli_rs",
      "Version": CODEX_VERSION,
      "User-Agent": `codex-cli/${CODEX_VERSION}`,
      "OpenAI-Beta": "responses=experimental",
    },
    models,
  });

  // Periodically check token expiry (tokens last ~10 days)
  setInterval(async () => {
    const a = readCodexAuth();
    if (a && isTokenExpired(a)) await refreshToken(a);
  }, 60 * 60 * 1000);

  // === Commands ===

  pi.registerCommand("codex-login", {
    description: "Log in to Codex (opens browser for ChatGPT OAuth)",
    handler: async (_args, ctx) => {
      try {
        ctx.ui.notify("Opening browser for Codex login...", "info");
        const child = spawn("codex", ["login"], { stdio: "inherit", env: process.env });
        child.on("exit", (code) => {
          ctx.ui.notify(
            code === 0 ? "Codex login complete!" : `Codex login exited with code ${code}`,
            code === 0 ? "info" : "error",
          );
        });
      } catch (err: any) {
        ctx.ui.notify(err.message ?? "Failed to run codex login", "error");
      }
    },
  });

  pi.registerCommand("codex-status", {
    description: "Check Codex authentication status",
    handler: async (_args, ctx) => {
      try { execSync("codex --version", { encoding: "utf-8", timeout: 5000 }); }
      catch {
        ctx.ui.notify("codex CLI not found. Install from https://github.com/openai/codex", "error");
        return;
      }
      const auth = readCodexAuth();
      if (!auth) {
        ctx.ui.notify("Not authenticated. Run `codex-login` or `codex login`.", "warning");
        return;
      }
      const expired = isTokenExpired(auth);
      const planType = parseJwtPayload(auth.tokens.access_token)?.["https://api.openai.com/auth"]?.chatgpt_plan_type;
      ctx.ui.notify(
        expired ? "Codex token expired. Run `codex-login` to refresh." : `Authenticated (Plan: ${planType || "unknown"})`,
        expired ? "warning" : "info",
      );
      if (expired) {
        ctx.ui.notify("Attempting token refresh...", "info");
        const refreshed = await refreshToken(auth);
        ctx.ui.notify(
          refreshed ? "Token refreshed!" : "Token refresh failed. Run `codex-login`.",
          refreshed ? "info" : "error",
        );
      }
    },
  });

  pi.registerCommand("codex-models", {
    description: "List available Codex models",
    handler: async (_args, ctx) => {
      const ms = discoverModels();
      ctx.ui.notify(
        ms.length
          ? `Available Codex models:\n${ms.map((m) => `  ${m.id} — ${m.name}`).join("\n")}`
          : "No Codex models found.",
        ms.length ? "info" : "warning",
      );
    },
  });

  pi.registerCommand("codex-ratelimit", {
    description: "Show Codex rate limit usage and plan info",
    handler: async (_args, ctx) => {
      const auth = readCodexAuth();
      if (!auth) {
        ctx.ui.notify("Not authenticated. Run `codex-login` first.", "warning");
        return;
      }

      try {
        // Make a lightweight probe request to get rate limit headers
        const token = auth.tokens.access_token;
        const accountId = auth.tokens.account_id;

        const body = JSON.stringify({
          model: "gpt-5.3-codex",
          instructions: "",
          input: [{ role: "user", content: [{ type: "input_text", text: "ping" }] }],
          tools: [],
          tool_choice: "auto",
          parallel_tool_calls: true,
          store: false,
          stream: true,
        });

        const resp = await fetch(CODEX_RESPONSES_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "ChatGPT-Account-ID": accountId,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "OpenAI-Beta": "responses=experimental",
            "User-Agent": `codex-cli/${CODEX_VERSION}`,
            "Originator": "codex_cli_rs",
            "Version": CODEX_VERSION,
          },
          body,
        });

        // Collect headers
        const headerMap: Record<string, string> = {};
        resp.headers.forEach((value, key) => { headerMap[key.toLowerCase()] = value; });

        // Abort the response body (we only need headers)
        const reader = resp.body?.getReader();
        if (reader) {
          // Cancel immediately — we only care about the headers
          reader.cancel().catch(() => {});
        }

        const info = parseRateLimitHeaders(headerMap);
        let output = formatRateLimitInfo(info);

        const promo = headerMap["x-codex-promo-message"];
        if (promo) {
          output += `\n\n\x1b[36m${promo}\x1b[0m`;
        }

        ctx.ui.notify(output, "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed to get rate limits: ${err.message || err}`, "error");
      }
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}
