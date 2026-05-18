// ── Exa Free (MCP) Provider ──
// Uses the free hosted MCP endpoint at mcp.exa.ai/mcp — no API key needed.

import type { SearchOptions, SearchResponse, SearchResult } from "../types.ts";
import type { Capability, CodeSearchCapable, Provider, SearchCapable } from "./types.ts";
import { httpError } from "../fallback.ts";

const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
const DEFAULT_CONTEXT_MAX_CHARS = 3000;

interface ExaMcpRpcResponse {
	result?: {
		content?: Array<{ type?: string; text?: string }>;
		isError?: boolean;
	};
	error?: {
		code?: number;
		message?: string;
	};
}

// ── MCP JSON-RPC call ──

async function callExaMcp(toolName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
	const timeout = AbortSignal.timeout(60000);
	const composedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

	const response = await fetch(EXA_MCP_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json, text/event-stream",
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: { name: toolName, arguments: args },
		}),
		signal: composedSignal,
	});

	if (!response.ok) {
		throw await httpError("exa-free", response, "Exa MCP");
	}

	const body = await response.text();

	// Try SSE data: lines first
	const dataLines = body.split("\n").filter(line => line.startsWith("data:"));
	let parsed: ExaMcpRpcResponse | null = null;

	for (const line of dataLines) {
		const payload = line.slice(5).trim();
		if (!payload) continue;
		try {
			const candidate = JSON.parse(payload) as ExaMcpRpcResponse;
			if (candidate?.result || candidate?.error) {
				parsed = candidate;
				break;
			}
		} catch {}
	}

	// Fallback: try parsing entire body as JSON
	if (!parsed) {
		try {
			const candidate = JSON.parse(body) as ExaMcpRpcResponse;
			if (candidate?.result || candidate?.error) {
				parsed = candidate;
			}
		} catch {}
	}

	if (!parsed) {
		throw new Error("Exa MCP returned an empty or unparseable response");
	}

	if (parsed.error) {
		const code = typeof parsed.error.code === "number" ? ` ${parsed.error.code}` : "";
		throw new Error(`Exa MCP error${code}: ${parsed.error.message || "Unknown error"}`);
	}

	if (parsed.result?.isError) {
		const message = parsed.result.content
			?.find(item => item.type === "text" && typeof item.text === "string")
			?.text?.trim();
		throw new Error(message || "Exa MCP returned an error");
	}

	const text = parsed.result?.content
		?.find(item => item.type === "text" && typeof item.text === "string" && item.text.trim().length > 0)
		?.text;

	if (!text) {
		throw new Error("Exa MCP returned empty content");
	}

	return text;
}

// ── MCP result parsing ──

interface McpParsedResult {
	title: string;
	url: string;
	content: string;
}

function parseMcpResults(text: string): McpParsedResult[] {
	const blocks = text.split(/(?=^Title: )/m).filter(block => block.trim().length > 0);

	return blocks.map(block => {
		const title = block.match(/^Title: (.+)/m)?.[1]?.trim() ?? "";
		const url = block.match(/^URL: (.+)/m)?.[1]?.trim() ?? "";

		let content = "";
		const textStart = block.indexOf("\nText: ");
		if (textStart >= 0) {
			content = block.slice(textStart + 7).trim();
		} else {
			const hlMatch = block.match(/\nHighlights:\s*\n/);
			if (hlMatch?.index != null) {
				content = block.slice(hlMatch.index + hlMatch[0].length).trim();
			}
		}
		content = content.replace(/\n---\s*$/, "").trim();

		return { title, url, content };
	}).filter(result => result.url.length > 0);
}

function mcpResultsToSearchResults(results: McpParsedResult[]): SearchResult[] {
	return results.map((r, i) => ({
		title: r.title || `Source ${i + 1}`,
		url: r.url,
		snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 280),
	}));
}

// ── Provider implementation ──

export class ExaFreeProvider implements Provider, SearchCapable, CodeSearchCapable {
	readonly id = "exa-free" as const;
	readonly name = "Exa (Free MCP)";
	readonly capabilities: Capability[] = ["search", "codeSearch"];

	isAvailable(): boolean {
		return true; // Always available — no key needed
	}

	async search(options: SearchOptions, signal?: AbortSignal): Promise<SearchResponse> {
		const text = await callExaMcp(
			"web_search_exa",
			{
				query: options.query,
				numResults: options.maxResults,
				livecrawl: "fallback",
				type: "auto",
				contextMaxCharacters: DEFAULT_CONTEXT_MAX_CHARS,
			},
			signal,
		);

		const parsed = parseMcpResults(text);
		if (parsed.length === 0) {
			return { results: [] };
		}

		return {
			results: mcpResultsToSearchResults(parsed),
		};
	}

	async codeSearch(query: string, maxTokens: number, signal?: AbortSignal): Promise<string> {
		try {
			const text = await callExaMcp(
				"get_code_context_exa",
				{ query, tokensNum: maxTokens },
				signal,
			);
			return trimApproxTokens(text, maxTokens);
		} catch (error) {
			// If the tool doesn't exist on the MCP server, throw a clear error
			const message = error instanceof Error ? error.message : String(error);
			if (message.toLowerCase().includes("tool") && message.toLowerCase().includes("not found")) {
				throw new Error(
					`code_search failed: Exa MCP tool 'get_code_context_exa' is not available. ` +
					`Use web_search with a code-oriented query instead.`
				);
			}
			throw new Error(
				`code_search failed: ${message}. ` +
				`Use web_search with a code-oriented query as an alternative.`
			);
		}
	}
}

function trimApproxTokens(text: string, maxTokens: number): string {
	const maxChars = Math.max(1000, maxTokens * 4);
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars).trimEnd()}\n\n[Truncated to approximately ${maxTokens} tokens.]`;
}
