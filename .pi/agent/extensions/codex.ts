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
const CODEX_VERSION = "0.138.0";
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
// Rate Limit Parsing (from /backend-api/wham/usage)
// ============================================================================

interface UsageWindow {
  used_percent: number;
  reset_at?: number;
  limit_window_seconds?: number;
}

interface UsageCredits {
  has_credits: boolean;
  unlimited: boolean;
  balance?: number;
}

interface UsageResetCredits {
  available_count?: number;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit?: {
    primary_window?: UsageWindow;
    secondary_window?: UsageWindow;
  };
  additional_rate_limits?: Record<string, { primary_window?: UsageWindow; secondary_window?: UsageWindow }>;
  credits?: UsageCredits;
  rate_limit_reset_credits?: UsageResetCredits;
  code_review_rate_limit?: { primary_window?: UsageWindow };
}

function formatUsageInfo(data: CodexUsageResponse): string {
  const lines: string[] = [];

  if (data.plan_type) {
    lines.push(`\x1b[1mPlan:\x1b[0m ${data.plan_type}`);
  }

  const primary = data.rate_limit?.primary_window;
  const secondary = data.rate_limit?.secondary_window;

  if (primary) {
    const pct = primary.used_percent;
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, barLen - filled));
    lines.push(`\x1b[1mPrimary:\x1b[0m ${bar} \x1b[33m${pct}%\x1b[0m used`);

    if (primary.reset_at) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, primary.reset_at - now);
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;
      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
      if (parts.length <= 1) parts.push(`${secs}s`);
      lines.push(`  Resets in ${parts.join(" ")}`);
    }
  }

  if (secondary) {
    const pct = secondary.used_percent;
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, barLen - filled));
    lines.push(`\x1b[1mSecondary:\x1b[0m ${bar} \x1b[33m${pct}%\x1b[0m used`);

    if (secondary.reset_at) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, secondary.reset_at - now);
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
      lines.push(`  Resets in ${parts.join(" ")}`);
    }
  }

  if (data.credits) {
    if (data.credits.unlimited) {
      lines.push(`\x1b[1mCredits:\x1b[0m \x1b[32mUnlimited\x1b[0m`);
    } else if (data.credits.has_credits) {
      const bal = data.credits.balance != null ? Math.floor(data.credits.balance) : "?";
      const usd = data.credits.balance != null ? (data.credits.balance * 0.04).toFixed(2) : "?";
      lines.push(`\x1b[1mCredits:\x1b[0m ${bal} ($${usd})`);
    }
  }

  if (data.rate_limit_reset_credits?.available_count) {
    lines.push(`\x1b[1mResets:\x1b[0m ${data.rate_limit_reset_credits.available_count} available`);
  }

  // Show any additional rate limit buckets (e.g. code_review, bengalfox, etc.)
  if (data.additional_rate_limits) {
    for (const [name, limit] of Object.entries(data.additional_rate_limits)) {
      if (limit.primary_window && limit.primary_window.used_percent > 0) {
        lines.push(`\x1b[1m${name}:\x1b[0m ${limit.primary_window.used_percent}% used`);
      }
    }
  }

  if (data.code_review_rate_limit?.primary_window) {
    const pct = data.code_review_rate_limit.primary_window.used_percent;
    lines.push(`\x1b[1mCode Review:\x1b[0m ${pct}% used`);
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
        const token = auth.tokens.access_token;
        const accountId = auth.tokens.account_id;

        const resp = await fetch(`${CODEX_API_BASE}/wham/usage`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "ChatGPT-Account-ID": accountId,
            "Accept": "application/json",
            "User-Agent": `codex-cli/${CODEX_VERSION}`,
          },
        });

        if (!resp.ok) {
          ctx.ui.notify(`Usage endpoint returned ${resp.status}`, "error");
          return;
        }

        const data: CodexUsageResponse = await resp.json();
        const output = formatUsageInfo(data);
        ctx.ui.notify(output || "No rate limit data available", "info");
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
