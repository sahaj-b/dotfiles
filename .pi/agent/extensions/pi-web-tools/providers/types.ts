// ── Provider capability interfaces ──

import type {
	CrawlOptions, CrawlResponse,
	ExtractOptions, ExtractResponse,
	FetchOptions, FetchResponse,
	ProviderId,
	SearchOptions, SearchResponse,
} from "../types.ts";

export type Capability = "search" | "codeSearch" | "crawl" | "extract" | "fetch";

export interface SearchCapable {
	search(options: SearchOptions, signal?: AbortSignal): Promise<SearchResponse>;
}

export interface CodeSearchCapable {
	codeSearch(query: string, maxTokens: number, signal?: AbortSignal): Promise<string>;
}

export interface CrawlCapable {
	crawl(options: CrawlOptions, signal?: AbortSignal): Promise<CrawlResponse>;
}

export interface ExtractCapable {
	extract(options: ExtractOptions, signal?: AbortSignal): Promise<ExtractResponse>;
}

export interface FetchCapable {
	fetch(options: FetchOptions, signal?: AbortSignal): Promise<FetchResponse>;
}

export interface Provider {
	readonly id: ProviderId;
	readonly name: string;
	readonly capabilities: readonly Capability[];

	/** Whether this provider is currently usable (has key, not on cooldown, etc.) */
	isAvailable(): boolean;
}

export function isSearchCapable(provider: Provider): provider is Provider & SearchCapable {
	return provider.capabilities.includes("search") && "search" in provider;
}

export function isCodeSearchCapable(provider: Provider): provider is Provider & CodeSearchCapable {
	return provider.capabilities.includes("codeSearch") && "codeSearch" in provider;
}

export function isCrawlCapable(provider: Provider): provider is Provider & CrawlCapable {
	return provider.capabilities.includes("crawl") && "crawl" in provider;
}

export function isExtractCapable(provider: Provider): provider is Provider & ExtractCapable {
	return provider.capabilities.includes("extract") && "extract" in provider;
}

export function isFetchCapable(provider: Provider): provider is Provider & FetchCapable {
	return provider.capabilities.includes("fetch") && "fetch" in provider;
}
