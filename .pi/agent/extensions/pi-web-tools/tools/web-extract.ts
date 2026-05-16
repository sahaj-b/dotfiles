// ── web_extract tool ──

import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import type { TextContent } from "@earendil-works/pi-ai";
import type { WebToolsConfig, WebExtractDetails } from "../types.ts";
import { getToolConfig, getToolProviders } from "../config.ts";
import { executeWithFallback } from "../fallback.ts";
import { isExtractCapable } from "../providers/types.ts";
import type { Provider } from "../providers/types.ts";

function textContent(text: string): TextContent { return { type: "text", text }; }

export function createWebExtractTool(config: WebToolsConfig, providers: Provider[]) {
	const toolConfig = getToolConfig("web_extract", config);
	const providerOrder = getToolProviders("web_extract", config);

	const orderedProviders = providerOrder
		.map(id => providers.find(p => p.id === id))
		.filter((p): p is Provider => !!p && isExtractCapable(p));

	return {
		name: "web_extract",
		label: "Web Extract",
		description: "Extract clean content from URLs using a provider's extraction engine. Better than web_fetch for JS-heavy or protected pages.",
		parameters: Type.Object({
			urls: Type.Array(Type.String(), { description: "URLs to extract content from." }),
			prompt: Type.Optional(Type.String({ description: "What to extract (for LLM-based extraction via Firecrawl)." })),
		}),

		async execute(
			_toolCallId: string,
			params: { urls: string[]; prompt?: string },
			signal?: AbortSignal,
			onUpdate?: (...args: any[]) => void,
		) {
			if (!params.urls.length) throw new Error("At least one URL is required");

			onUpdate?.({
				content: [textContent(`Extracting from ${params.urls.length} URL(s)...`)],
				details: { urls: params.urls, provider: "", resultCount: 0 },
			});

			if (orderedProviders.length === 0) throw new Error("No extract providers configured");

			const { result, provider } = await executeWithFallback(
				orderedProviders, "extract",
				async (p) => {
					if (!isExtractCapable(p)) throw new Error(`${p.id} doesn't support extract`);
					return p.extract({ urls: params.urls, prompt: params.prompt }, signal);
				},
				signal,
			);

			const lines: string[] = [];
			for (const r of result.results) {
				lines.push(`## ${r.title || r.url}`);
				lines.push(`URL: ${r.url}`);
				if (r.error) { lines.push(`Error: ${r.error}`); }
				else if (r.content) { lines.push(r.content); }
				lines.push("");
			}

			const details: WebExtractDetails = { urls: params.urls, provider, resultCount: result.results.length };
			return { content: [textContent(lines.join("\n").trimEnd())], details };
		},

		renderCall(args: { urls: string[]; prompt?: string }, theme: any) {
			let text = theme.fg("toolTitle", theme.bold("web_extract "));
			text += theme.fg("accent", args.urls.length === 1 ? args.urls[0] : `${args.urls.length} URLs`);
			if (args.prompt) text += theme.fg("dim", ` "${args.prompt.slice(0, 40)}..."`);
			return new Text(text, 0, 0);
		},

		renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
			if (options.isPartial) return new Text(theme.fg("warning", "Extracting..."), 0, 0);
			if (result.isError) return new Text(theme.fg("error", `✗ ${result.content?.[0]?.text || "Extract failed"}`), 0, 0);
			const d = result.details as WebExtractDetails | undefined;
			let text = theme.fg("success", `✓ ${d?.resultCount ?? 0} extractions`);
			if (d?.provider) text += theme.fg("muted", ` (${d.provider})`);
			return new Text(text, 0, 0);
		},
	};
}
