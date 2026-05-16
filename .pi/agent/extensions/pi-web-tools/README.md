# Pi Web Tools Extension (`pi-web-tools`)

A lightweight, robust web search and extraction extension for the Pi coding agent. It consolidates multiple providers (Exa, Firecrawl, Tavily) behind a clean set of tools with built-in fallback routing, cooldown tracking, and zero bulky SDK dependencies.

## Features

- **No Browser Popups & No Intrusive UI**: Returns raw results straight to the agent context.
- **Provider Fallback Engine**: Automatically routes around rate limits and network errors (e.g., `Exa (Paid)` → `Firecrawl` → `Tavily` → `Exa (Free)`).
- **Free Exa MCP Built-In**: Works out-of-the-box with zero configuration by automatically utilizing Exa's free hosted MCP endpoint.
- **Zero SDK Dependencies**: Uses standard `fetch()` for all providers, keeping the extension incredibly lightweight and fast.
- **Robust Network Primitives**: Follows redirects manually, enforces strict SSRF protections (blocking local/private IPs), and retries on Cloudflare challenges.
- **Dynamic Credentials**: Supports standard environment variables, raw strings, and secure command execution (e.g., `!pass show api/exa`).

## Installation

Symlink or copy this directory into your agent's extensions folder, then install the dependencies:

```bash
ln -s /path/to/piwebext/pi-web-tools ~/.pi/agent/extensions/pi-web-tools
cd ~/.pi/agent/extensions/pi-web-tools
bun install
```

## Tools Provided

1. **`web_search`**: Search the public web. Routes through the fallback chain and returns a list of results (titles, URLs, snippets).
2. **`code_search`**: Search code-specific sources (GitHub, Stack Overflow, docs). Exa-only. Errors directly on failure (with a suggestion to use `web_search` instead) to prevent silent fallback issues.
3. **`web_fetch`**: Direct URL fetching and Markdown conversion. No provider needed. Converts HTML to clean Markdown using Turndown.
4. **`web_crawl`**: Recursive site crawling using Tavily or Firecrawl.
5. **`web_extract`**: Structured Markdown extraction for JS-heavy or protected pages using Firecrawl or Tavily.

## Configuration (Optional)

By default, the extension requires **no configuration** and will automatically use environment variables (`EXA_API_KEY`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`) or default to the free Exa MCP endpoint.

You can customize the fallback chains and provide keys securely by creating `~/.pi/agent/web-tools.json`:

```json
{
  "providers": {
    "exa": { "apiKey": "EXA_API_KEY" },
    "firecrawl": { "apiKey": "!pass show api/firecrawl" },
    "tavily": { "apiKey": "TAVILY_API_KEY" }
  },
  "tools": {
    "web_search": {
      "providers": ["exa", "firecrawl", "tavily", "exa-free"],
      "maxResults": 8,
      "timeoutSeconds": 30
    },
    "code_search": {
      "providers": ["exa"],
      "maxTokens": 5000
    },
    "web_fetch": {
      "maxResponseMB": 5,
      "defaultFormat": "markdown"
    },
    "web_crawl": {
      "providers": ["firecrawl", "tavily"],
      "maxDepth": 2,
      "maxPages": 10
    },
    "web_extract": {
      "providers": ["firecrawl", "tavily"]
    }
  }
}
```

You can view the live status of your configuration inside Pi by running the `/web-tools` command.
