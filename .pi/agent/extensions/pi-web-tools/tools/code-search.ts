// ── code_search tool (Exa-only, errors on failure) ──

import type { TextContent } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { getToolConfig, getToolProviders } from "../config.ts";
import type { Provider } from "../providers/types.ts";
import { isCodeSearchCapable } from "../providers/types.ts";
import { animatedBullet, cleanupSpinner, connectorText } from "../spinner.ts";
import type { CodeSearchDetails, WebToolsConfig } from "../types.ts";

function textContent(text: string): TextContent {
	return { type: "text", text };
}

export function createCodeSearchTool(
	config: WebToolsConfig,
	providers: Provider[],
) {
	const toolConfig = getToolConfig("code_search", config);
	const providerOrder = getToolProviders("code_search", config);

	const orderedProviders = providerOrder
		.map((id) => providers.find((p) => p.id === id))
		.filter((p): p is Provider => !!p && isCodeSearchCapable(p));

	return {
		name: "code_search",
		label: "Code Search",
		description:
			"Search code-specific sources (GitHub, Stack Overflow, docs). Errors directly on failure — use web_search as an alternative if this fails.",
		parameters: Type.Object({
			query: Type.String({ description: "Code/API/docs search query." }),
			maxTokens: Type.Optional(
				Type.Number({ description: "Approximate max tokens in response." }),
			),
		}),

		renderShell: "self",

		async execute(
			_toolCallId: string,
			params: { query: string; maxTokens?: number },
			signal?: AbortSignal,
			onUpdate?: (...args: any[]) => void,
		) {
			const query = params.query.trim();
			if (!query) throw new Error("Search query cannot be empty");

			const maxTokens = params.maxTokens ?? toolConfig.maxTokens ?? 5000;

			onUpdate?.({
				content: [
					textContent(`Searching code for ${JSON.stringify(query)}...`),
				],
				details: { query, maxTokens, provider: "" },
			});

			if (orderedProviders.length === 0) {
				throw new Error(
					"No code search providers configured. Use web_search with a code-oriented query instead.",
				);
			}

			let lastError: Error | null = null;
			for (const provider of orderedProviders) {
				if (!provider.isAvailable() || !isCodeSearchCapable(provider)) continue;

				try {
					const text = await provider.codeSearch(query, maxTokens, signal);
					const details: CodeSearchDetails = {
						query,
						maxTokens,
						provider: provider.id,
					};
					return { content: [textContent(text)], details };
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));
				}
			}

			throw (
				lastError ??
				new Error(
					"code_search failed: all providers exhausted. Use web_search with a code-oriented query instead.",
				)
			);
		},

		renderCall(
			args: { query: string; maxTokens?: number },
			theme: any,
			ctx: any,
		) {
			let text = `${animatedBullet(ctx, theme)} ${theme.fg("toolTitle", theme.bold(theme.fg("border", "󰖟 ") + "Code Search "))}`;
			text += theme.fg("accent", JSON.stringify(String(args.query)));
			if (args.maxTokens) text += theme.fg("dim", ` tokens=${args.maxTokens}`);
			return new Text(text, 0, 0);
		},

		renderResult(
			result: any,
			options: { expanded: boolean; isPartial: boolean },
			theme: any,
			ctx: any,
		) {
			if (options.isPartial)
				return connectorText(ctx, theme, "Searching code...");
			cleanupSpinner(ctx);
			if (result.isError)
				return connectorText(
					ctx,
					theme,
					theme.fg(
						"error",
						`Code search failed: ${result.content?.[0]?.text || "Unknown error"}`,
					),
				);
			const d = result.details as CodeSearchDetails | undefined;
			let text = theme.fg("success", `Code results`);
			if (d?.provider) text += theme.fg("muted", ` (${d.provider})`);
			if (options.expanded && result.content?.[0]?.text) {
				const lines = result.content[0].text.split("\n").slice(0, 20);
				for (const line of lines)
					text += `\n${theme.fg("dim", line.slice(0, 220))}`;
			}
			return connectorText(ctx, theme, text);
		},
	};
}
