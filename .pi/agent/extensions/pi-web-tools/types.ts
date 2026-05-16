// ── Shared types for pi-web-tools ──

export type ProviderId = "exa" | "exa-free" | "firecrawl" | "tavily";
export type ToolId = "web_search" | "code_search" | "web_fetch" | "web_crawl" | "web_extract";
export type FetchFormat = "markdown" | "text" | "html";
export type ContentKind = "html" | "text" | "raster-image" | "svg" | "binary";

// ── Search ──

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	publishedAt?: string;
	source?: string;
	score?: number;
}

export interface SearchResponse {
	results: SearchResult[];
	answer?: string;
}

export interface SearchOptions {
	query: string;
	maxResults: number;
}

// ── Fetch ──

export interface ParsedContentType {
	contentType: string;
	mime: string;
	charset?: string;
	kind: ContentKind;
}

export interface FetchDetails {
	requestedUrl: string;
	finalUrl: string;
	format: FetchFormat;
	status: number;
	mime: string;
	contentType: string;
	charset?: string;
	decoder?: string;
	bytes: number;
	image?: boolean;
	truncated?: boolean;
	fullOutputPath?: string;
}

// ── Crawl ──

export interface CrawlOptions {
	url: string;
	maxDepth: number;
	maxPages: number;
	instructions?: string;
}

export interface CrawlResult {
	url: string;
	content: string;
	title?: string;
	depth: number;
}

export interface CrawlResponse {
	results: CrawlResult[];
	totalPages: number;
}

// ── Extract ──

export interface ExtractOptions {
	urls: string[];
	prompt?: string;
}

export interface ExtractResult {
	url: string;
	content: string;
	title?: string;
	error?: string;
}

export interface ExtractResponse {
	results: ExtractResult[];
}

// ── Config ──

export interface ProviderConfig {
	apiKey?: string;
}

export interface ToolConfig {
	providers?: ProviderId[];
	maxResults?: number;
	maxTokens?: number;
	timeoutSeconds?: number;
	maxDepth?: number;
	maxPages?: number;
	maxResponseMB?: number;
	defaultFormat?: FetchFormat;
}

export interface WebToolsConfig {
	providers?: Partial<Record<ProviderId, ProviderConfig>>;
	tools?: Partial<Record<ToolId, ToolConfig>>;
	settings?: {
		retryCount?: number;
		retryDelayMs?: number;
	};
}

// ── Search details for TUI rendering ──

export interface WebSearchDetails {
	query: string;
	maxResults: number;
	provider: string;
	resultCount: number;
	truncated?: boolean;
	fullOutputPath?: string;
	fallbacksUsed?: string[];
	results: SearchResult[];
}

export interface CodeSearchDetails {
	query: string;
	maxTokens: number;
	provider: string;
	error?: string;
}

export interface WebCrawlDetails {
	url: string;
	maxDepth: number;
	maxPages: number;
	provider: string;
	pageCount: number;
}

export interface WebExtractDetails {
	urls: string[];
	provider: string;
	resultCount: number;
}
