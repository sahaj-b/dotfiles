// ── pi-web-tools extension entry point ──

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveApiKey, getProviderStatus } from "./config.ts";
import type { Provider } from "./providers/types.ts";
import { ExaApiProvider } from "./providers/exa.ts";
import { ExaFreeProvider } from "./providers/exa-free.ts";
import { FirecrawlProvider } from "./providers/firecrawl.ts";
import { TavilyProvider } from "./providers/tavily.ts";
import { createWebSearchTool } from "./tools/web-search.ts";
import { createCodeSearchTool } from "./tools/code-search.ts";
import { createWebFetchTool } from "./tools/web-fetch.ts";
import { createWebCrawlTool } from "./tools/web-crawl.ts";
import { createWebExtractTool } from "./tools/web-extract.ts";

export default function (pi: ExtensionAPI) {
	const config = loadConfig();

	// ── Initialize providers ──

	const providers: Provider[] = [];

	// Exa API (paid) — only if key is available
	const exaApiKey = resolveApiKey("exa", config);
	if (exaApiKey) {
		providers.push(new ExaApiProvider(exaApiKey));
	}

	// Exa Free (MCP) — always available
	providers.push(new ExaFreeProvider());

	// Firecrawl — only if key is available
	const firecrawlApiKey = resolveApiKey("firecrawl", config);
	if (firecrawlApiKey) {
		providers.push(new FirecrawlProvider(firecrawlApiKey));
	}

	// Tavily — only if key is available
	const tavilyApiKey = resolveApiKey("tavily", config);
	if (tavilyApiKey) {
		providers.push(new TavilyProvider(tavilyApiKey));
	}

	// ── Register tools ──

	pi.registerTool(createWebSearchTool(config, providers) as any);
	pi.registerTool(createCodeSearchTool(config, providers) as any);
	pi.registerTool(createWebFetchTool(config) as any);
	pi.registerTool(createWebCrawlTool(config, providers) as any);
	pi.registerTool(createWebExtractTool(config, providers) as any);

	// ── /web-tools command ──

	pi.registerCommand("web-tools", {
		description: "Show web-tools provider status and configuration",
		handler: async (_args: string[], ctx: any) => {
			const status = getProviderStatus(config);
			ctx.ui.notify(status, "info");
		},
	});
}
