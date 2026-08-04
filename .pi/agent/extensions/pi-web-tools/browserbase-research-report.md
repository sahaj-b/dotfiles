# Browserbase (browserbase.com) — Deep Research Report

*Research performed live against the web (pricing page, docs.browserbase.com, changelog via Wayback Machine, GitHub, press releases, Hacker News). Current as of research date. Pricing/limits are what the vendor's site says *today* — treat as a snapshot.*

---

## 1. Executive Summary

**Browserbase is the browser-infrastructure layer for AI agents.** It hosts real, headless Chromium browsers in the cloud that your code (Playwright/Puppeteer/Selenium/Stagehand) or your agent (via MCP or its managed "Agents" API) drives over the Chrome DevTools Protocol (CDP). In 2025–2026 it expanded from a pure "browser-in-the-cloud" primitive into a full agent platform: **Browser API** (sessions), **Search API** (powered by Exa), **Fetch API** (URL→content/markdown/JSON, no browser needed), **Agents API** (managed autonomous browser agents), **Functions** (serverless browser runtime), **Model Gateway** (bring-your-own-model, billed through Browserbase), an official **MCP server**, and the open-source **Stagehand** agent framework (22k+ GitHub stars).

Key facts at a glance:

- **Free plan:** $0, **no credit card**, 1 browser-hour/month, 3 concurrent browsers, 15-min sessions, 1,000 Search + 1,000 Fetch calls, 3 Agent runs, $5 model tokens, 7-day retention. **Free tier has *not* been reduced** — it's been *expanded* since launch (concurrency 1→3 in Mar 2026; Search/Fetch added Mar 2026).
- **Paid:** Developer $20/mo (100 browser hrs, 25 concurrent), Startup $99/mo (500 hrs, 100 concurrent), Scale custom (250+ concurrent). Overage: browser hours $0.10–$0.12/hr, Fetch $1/1k, Extract $4/1k, Search $7/1k.
- **Funding:** $6.5M seed (Jun 2024, Kleiner Perkins) → $21M Series A (Nov 2024, KP + CRV) → **$40M Series B (Jun 2025, Notable Capital, ~$300M valuation)**. 10,000+ companies, ~35–37M browser sessions/month (company-reported, Mar 2026).
- **"Fetch this URL" answer:** Yes — `POST /v1/fetch` launched Mar 11, 2026 (~$1/1k raw pages; markdown/JSON extraction $4/1k, $7/1k with proxies). It is a real fetch/extract endpoint, but it does **not** execute JavaScript and is capped at 5 MB / 60 s — for JS-heavy pages you still need a full browser session.
- **Note on "browserbase.dev":** that domain is registered but does not currently resolve to any live product (parked; historical snapshots show it redirecting to browserbase.com). The Agents API lives at `api.browserbase.com/v1/agents/*` — there is no separate "browserbase.dev" API.

---

## 2. What is Browserbase & How It Works

### 2.1 The core primitive: browser sessions

A **browser session** is "a single browser instance running in the cloud" — the fundamental building block (docs: [reference/api/overview](https://docs.browserbase.com/reference/api/overview)). Flow:

1. `POST https://api.browserbase.com/v1/sessions` → returns `id`, `connectUrl` (WebSocket CDP URL), `seleniumRemoteUrl`, `signingKey`.
2. Connect with Playwright (`chromium.connectOverCDP(session.connectUrl)`), Puppeteer, Selenium (WebDriver), or raw CDP.
3. Drive the browser; everything (DOM, cookies, network) stays in the cloud session.
4. Sessions auto-end on disconnect; `keepAlive: true` keeps them alive for reconnection; `timeout` up to 21600 s (6 h) on paid plans.

**Under the hood** (from Browserbase's own "build vs buy" post): each session runs in its own microVM via **Firecracker** (VM-level isolation), browsers are pre-booted in **warm pools** to kill cold-start latency, they maintain a **forked/stealth Chromium** with coherent fingerprints (OS, fonts, canvas, TLS/JA3/JA4 signals), residential proxy pools, CAPTCHA-solving, session recording, and a model gateway. Regions: `us-west-2` (default), `us-east-1`, `eu-central-1`, `ap-southeast-1` — running close to your app yields "8-9x" RTT gains per the docs. ([build-vs-buy-agent-infrastructure](https://www.browserbase.com/blog/build-vs-buy-agent-infrastructure), [speed-optimization](https://docs.browserbase.com/optimizations/latency/speed-optimization))

### 2.2 Product surface (as of research date)

| Product | What it is | Endpoint |
|---|---|---|
| **Browser API** | Create/control/observe cloud browser sessions | `POST /v1/sessions`, `GET /v1/sessions/{id}`, etc. |
| **Search API** | Token-efficient web search, **powered by Exa** (launched Mar 17, 2026) | `POST /v1/search` |
| **Fetch API** | URL → content/markdown/JSON, *no browser session* (launched Mar 11, 2026) | `POST /v1/fetch` |
| **Agents API** | Managed autonomous browser agent; describe goal → structured result (GA ~Jun 30, 2026) | `POST /v1/agents/runs` |
| **Runtime / Functions** | Serverless browser functions ("AWS Lambda with a browser built-in", launched Feb 10, 2026); free on every plan | — |
| **Model Gateway / Router** | Use OpenAI/Anthropic/Gemini through one Browserbase key at "market price, no markup" (Apr 5, 2026); Model Router auto-picks models ("30–40% lower inference cost") | — |
| **MCP server** | Hosted at `https://mcp.browserbase.com/mcp` (migrated to Browserbase infra Mar 14, 2026); local via `npx @browserbasehq/mcp` | — |
| **Stagehand** | OSS browser-agent SDK (TS + Python), natural-language actions; 22k+ stars, 700k+ weekly downloads | — |
| **Director** | No-code web automation builder (launched Jun 17, 2025; v2.0; chat feature disabled Nov 2025) | — |
| **Browse CLI / browse.sh / skills** | `browse` CLI + open catalog of agent skills (SKILL.md) incl. **Autobrowse** self-improving skills (May 2026) | — |

Source: [docs.browserbase.com](https://docs.browserbase.com/), [changelog (via Wayback)](https://web.archive.org/web/20260416202515/https://www.browserbase.com/changelog)

### 2.3 Integrations

- **Playwright** (recommended, `connectOverCDP`), **Puppeteer**, **Selenium** — all supported against sessions.
- **Stagehand** — Browserbase's own OSS framework (`act()`, `agent()`, `extract()` with Zod schemas). Docs: [github.com/browserbase/stagehand](https://github.com/browserbase/stagehand) (MIT).
- **MCP** — hosted Streamable HTTP endpoint + STDIO; tools: `navigate`, `act`, `observe`, `extract`, `start`, `end`. Works with Claude Desktop, Cursor, ChatGPT, etc. ([integrations/mcp](https://docs.browserbase.com/integrations/mcp/introduction), [setup](https://docs.browserbase.com/integrations/mcp/setup))
- **Vercel AI SDK** — official integration + Next.js research-agent template (parallel sessions, SSE streaming). ([integrations/vercel](https://docs.browserbase.com/integrations/vercel/introduction)) Also listed on the **Vercel Marketplace** (Feb 12, 2026).
- **LangChain** (JS `StagehandToolkit` + Python `browserbase` provider), **CrewAI**, **Mastra** — documented integrations.
- **Claude Code / Cursor / coding agents** — `claude mcp add --transport http browserbase "https://mcp.browserbase.com/mcp?browserbaseApiKey=..."` plus the `browse` CLI and skills.
- **Cloudflare** — partnership on **Web Bot Auth** ("passport for AI agents", cryptographic agent identity, Aug 2025). ([blog](https://www.browserbase.com/blog/cloudflare-browserbase-pioneering-identity))
- **Prime Intellect** — partnership for RL training of browser agents (**BrowserEnv**, browserenv.com, Mar 2026).

---

## 3. Pricing & Rate Limits (CRITICAL — verified against official pages)

Official sources: [browserbase.com/pricing](https://www.browserbase.com/pricing) and [docs.browserbase.com/account/billing/plans](https://docs.browserbase.com/account/billing/plans).

### 3.1 Plans overview

| | **Free $0** | **Developer $20/mo** | **Startup $99/mo** | **Scale (custom)** |
|---|---|---|---|---|
| **Browser hours/mo** | 1 hr | 100 hrs | 500 hrs | Flexible |
| *Hours overage* | — | $0.12/hr | $0.10/hr | Custom |
| **Proxy bandwidth** | 0 GB | 1 GB | 5 GB | Usage-based |
| *Proxy overage* | — | $12/GB | $10/GB | Custom |
| **Max concurrent browsers** | 3 | 25 | 100 | 250+ |
| **Session duration max** | 15 min | 6 hrs | 6 hrs | 6+ hrs |
| **Session creation rate** | 5/min | 25/min | 50/min | 150+/min |
| **Agent runs/mo** | 3 | 15 | 50 | Custom |
| **Search calls/mo** | 1,000 | 1,000 | 1,000 | Custom |
| *Search overage* | — | $7/1k | $7/1k | Custom |
| **Fetch calls/mo** | 1,000 | 1,000 | 10,000 | Custom |
| *Fetch overage* | — | $1/1k | $0.5/1k | Custom |
| *Extract overage (md/json)* | — | $4/1k | $4/1k | Custom |
| **Data retention** | 7 days | 7 days | 30 days | 30+ days |
| **Projects** | 1 | Up to 2 | Up to 5 | 5+ |
| **Verified identity** | No | Basic | Basic | Verified |
| **CAPTCHA solving** | No | Auto | Auto | Auto |
| **Support** | Email | Standard | Priority | High Priority |
| **SOC2** | Yes | Yes | Yes | Yes (+pen tests/reports) |
| **HIPAA BAA / DPA / SSO** | No | No | No | Yes (Scale) |
| **Free model tokens** | **$5 in tokens** (per pricing page) | — | — | — |

Notes:
- **"No caps. No cut-offs"** — browser hours and proxies are *allocations*, not hard limits; overage is billed pay-as-you-go. Same for Search/Fetch/Extract (API allocations with overage rates). **Agent-run overage pricing is NOT published** on the plans page.
- **Billing minimums:** browser time billed per minute, proxy by MB, with a **one-minute / one-MB minimum per session**. This is important: every short session costs ≥1 min of browser time. `keepAlive` is recommended to avoid minimum charges when running many sub-1-minute sessions.
- **Concurrency is organization-level**, distributed across projects (e.g. Developer: project 1 gets 24, project 2 gets 1 by default; adjustable in dashboard).
- **Rate-limit mechanics:** hitting concurrency or session-creation limits returns `429` with `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after` headers. ([concurrency/overview](https://docs.browserbase.com/optimizations/concurrency/overview))
- **Search API rate limit:** 120 req/min per project (docs) — same as the "2/sec" shown on the plans page. Fetch: 5/sec.
- **Free plan: no credit card required** ("Start free, no credit card needed" — plans page; "No cost, no card" pattern also on pricing page).
- **Keep-alive sessions are paid-plan-only** — free plan gets `403 Keep alive sessions are not supported on the FREE plan` (see [open-operator issue #34](https://github.com/browserbase/open-operator/issues/34)).

### 3.2 Pricing history / changes (answer to "did they reduce the free tier?")

- **Pre-Feb 2025:** signup included a one-time **10 total browser sessions** trial.
- **Feb 25, 2025 — Free plan launched:** 60 browser-minutes/month, 15-min max session, 7-day retention. ([blog/free-plan](https://www.browserbase.com/blog/free-plan))
- **Feb 4, 2025 — keep-alive opened to all (paid) plans** (previously Scale-only). ([changelog/keep-alive-works-on-all-plans](https://www.browserbase.com/changelog/keep-alive-works-on-all-plans))
- **Jun 17, 2025 — "Massive price decrease":** Hobby plan cut to **$20/mo and renamed Developer**; concurrency increased across plans. ([changelog/massive-price-decrease](https://www.browserbase.com/changelog/massive-price-decrease))
- **Mar 11–17, 2026 — Fetch & Search APIs added:** every plan now includes **1,000 free Search + 1,000 Fetch calls/mo** (10,000 Fetch on Startup).
- **Mar 16, 2026 — free-plan concurrency raised 1 → 3.** ([changelog/concurrency-free-plan](https://www.browserbase.com/changelog/concurrency-free-plan))
- **May 2026 — Fetch Extract added:** markdown/JSON output; data cap raised **1 MB → 5 MB**; Extract $4/1k ($7/1k with proxies). ([changelog/fetch-api-extract](https://www.browserbase.com/changelog/fetch-api-extract))

**Bottom line: the free tier has never been cut back — it has only gotten bigger (3× concurrency, plus Search/Fetch allocations and $5 model tokens).** Third-party "pricing history" trackers are unreliable here: e.g. PulseSignal claims "Free $4→$99" which contradicts the official page (flagging that source as corrupt data — do not trust it).

---

## 4. API Specifics

### 4.1 Authentication
- **REST:** header `X-BB-API-Key: <api-key>` (docs use this in all examples).
- **SDKs:** `new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY })` (JS) / `Browserbase(api_key=...)` (Python). API key + project ID from dashboard settings.

### 4.2 Main REST endpoints (v1, base `https://api.browserbase.com`)
| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/sessions` | POST | Create session → `id`, `connectUrl` (WebSocket/CDP), `seleniumRemoteUrl`, `signingKey`, status `PENDING→RUNNING→...` |
| `/v1/sessions/{id}` | GET / PATCH | Retrieve / update (incl. `status: "REQUEST_RELEASE"` to stop keep-alive) |
| `/v1/sessions` | GET | List (status filter) |
| `/v1/sessions/{id}/debug` | GET | **Live view URLs** (`debuggerFullscreenUrl`, `debuggerUrl`, per-tab `pages[]`) |
| `/v1/sessions/{id}/recording` | GET | Session recording (now MP4 video; see deprecation note) |
| `/v1/sessions/{id}/logs` | GET | Session logs |
| `/v1/contexts`, `/v1/projects`, `/v1/extensions` | — | Persisted browser contexts, project usage, Chrome extensions |
| `/v1/search` | POST | `{query, numResults(1–25)}` → results w/ url, title, author, publishedDate, image, favicon |
| `/v1/fetch` | POST | Fetch a URL (params below) |
| `/v1/agents` , `/v1/agents/runs` | POST/GET | Create agents; run tasks; poll runs (`listMessages`) |
| `/v1/agents/runs/{id}` | POST | Stop a run |

Full OpenAPI spec: [docs.browserbase.com/reference/api/openapi.v1.yaml](https://docs.browserbase.com/reference/api/openapi.v1.yaml); SDK refs: [nodejs](https://docs.browserbase.com/reference/sdk/nodejs), [python](https://docs.browserbase.com/reference/sdk/python).

Create-session body highlights: `projectId`, `extensionId`, `browserSettings` (`blockAds`, `solveCaptchas`, `recordSession`, `logSession`, `verified`, `os`, `viewport`, `context`), `timeout` (60–21600 s), `keepAlive`, `proxies` (boolean or array with `geolocation`/domain patterns), `region`, `userMetadata`. ([create-a-session](https://docs.browserbase.com/reference/api/create-a-session))

### 4.3 "Fetch a webpage and return content" — 3 ways

**A. Fetch API (fastest, cheapest, no browser):**
```typescript
import Browserbase from "@browserbasehq/sdk";
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

// raw HTML
const r = await bb.fetchAPI.create({ url: "https://httpbin.org/get" });
console.log(r.statusCode, r.content);

// markdown
await bb.fetchAPI.create({ url: "https://www.browserbase.com/", format: "markdown" });

// structured JSON via JSON Schema
await bb.fetchAPI.create({
  url: "https://www.browserbase.com/",
  format: "json",
  schema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
});
```
cURL: `curl -X POST https://api.browserbase.com/v1/fetch -H "X-BB-API-Key: $KEY" -d '{"url":"https://httpbin.org/"}'`

Request params: `url` (required), `allowRedirects`, `allowInsecureSsl`, `proxies`, `format` (`raw|markdown|json`), `schema` (JSON only). Response: `{statusCode, headers, content, contentType, encoding}` (base64 for binary). **Limits:** 5 MB max (else 502), 60 s timeout (else 504), **no JS execution**, **no PDF→markdown conversion** — fall back to a browser session for those. Fetch Extract (`format`) is priced separately from plain Fetch. ([platform/fetch/overview](https://docs.browserbase.com/platform/fetch/overview))

**B. Browser session (JS rendering, interactions, screenshots):**
```typescript
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
const session = await bb.sessions.create();
const browser = await chromium.connectOverCDP(session.connectUrl);
const page = browser.contexts()[0].pages()[0];
await page.goto("https://news.ycombinator.com/", { waitUntil: "domcontentloaded" });
const content = await page.content();          // DOM serialization
const text = await page.textContent("body");   // page text
await page.screenshot({ path: "shot.png", fullPage: true }); // viewport & full-page screenshots
await browser.close();
console.log(`Recording: https://browserbase.com/sessions/${session.id}`);
```
Text/DOM/screenshot support: yes — all via the connected framework (Playwright/Puppeteer). CDP screenshot capture is recommended as "significantly faster" ([features/screenshots](https://docs.browserbase.com/features/screenshots)).

**C. Agents API (managed autonomous agent):**
```bash
curl -X POST https://api.browserbase.com/v1/agents/runs \
  -H "x-bb-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"task": "Go to Hacker News and return the top 3 stories with titles and URLs"}'
```
Async: poll run status (`PENDING/RUNNING/COMPLETED/FAILED/STOPPED/TIMED_OUT`), read messages, get structured result per `resultSchema`. ([platform/agents/overview](https://docs.browserbase.com/platform/agents/overview))

### 4.4 Session management & observability
- **Keep-alive:** sessions survive disconnects (paid plans); reconnect to same `connectUrl`; must `REQUEST_RELEASE` to stop billing. Faster than creating new sessions. ([keep-alive](https://docs.browserbase.com/platform/browser/long-sessions/keep-alive))
- **Live view:** interactive watch-and-control window (click/type/scroll), embeddable via iframe, per-tab URLs, `browserbase-disconnected` postMessage event. ([session-live-view](https://docs.browserbase.com/platform/browser/observability/session-live-view))
- **Recording:** every session recorded; video (MP4) downloadable via API/dashboard — **rrweb DOM replay is being deprecated** in favor of video ([session-recording](https://docs.browserbase.com/platform/browser/observability/session-recording)). HLS session-replay streaming API exists for embedding.
- **Session inspector** in dashboard; **WebSocket debugging** via `connectUrl` (CDP) — this is also how live view/debug URLs work.

---

## 5. Browserbase as a General "Fetch This URL" Service (for AI tool providers)

**Yes, it can serve as a fetch service, but understand the tiering:**

1. **The Fetch API is exactly the "fetch this URL → return content" primitive** — `POST /v1/fetch`, $1 per 1k raw pages ($0.001/page), markdown/JSON at $4/1k ($7/1k with proxies). 5/sec rate limit, 5 MB cap, 60 s timeout, no JS execution.
2. **Latency:** Fetch is a lightweight HTTP fetch through Browserbase infra (real browser user-agent by default, optional proxies) — far faster than spinning up a browser. The `Search → Fetch → decide → Browse` pattern is the vendor's recommended agent flow to save money/latency.
3. **Browser sessions are heavier:** cold start ~**3–5 seconds** per a community benchmark ([mcp-server-browserbase issue #127](https://github.com/browserbase/mcp-server-browserbase/issues/127) comparing to Kernel's sub-second claims); mitigated by warm pools (vendor), parallel session creation at app init, region choice (8–9x RTT gains), and `keepAlive` session reuse. Every session has a **1-minute billing minimum**.
4. **Caveats for a "fetch" tool:**
   - Fetch doesn't run JS — pages that render content client-side (SPAs) will return the raw HTML. For those, use a session (`page.goto` + `page.content()`), which costs 1 min minimum browser time (~$0.10–0.12 on paid overage; on free, burns your 60 min/month).
   - Fetch 5 MB/60 s limits → 502/504; vendor explicitly recommends falling back to a browser session.
   - If you need JS rendering *without* a full session API, competitors like Firecrawl (managed render) may be a better fit — see §6.
5. **Agents API** (managed runs) is the highest-level option: you send a task, Browserbase owns the loop and returns structured data; includes live view, replay, traces, per-run cost breakdown. GA on all plans; 3 free runs/mo on Free, 15 Developer, 50 Startup.

---

## 6. Comparison vs. Alternatives

### 6.1 Positioning: two different layers
The cleanest mental model (per [Fixed Labs comparison](https://www.fixedlabs.ai/blog/firecrawl-vs-browserbase) and Firecrawl's own [vs page](https://www.firecrawl.dev/alternatives/firecrawl-vs-browserbase)):

- **Firecrawl (and Jina Reader, ZenRows, ScrapingBee) = the *web data layer***: URL → clean Markdown/JSON, stateless, API-first. Built for "read the web" workloads.
- **Browserbase = the *browser execution layer***: real persistent browsers for "operate the web" workloads (login, forms, JS-heavy app-like sites), plus its Fetch/Search as a data-layer bolt-on.
- For an AI agent's "fetch this URL" tool, the decision is: **no-JS-needed & cheap → Firecrawl/Jina/Browserbase-Fetch; JS-rendering needed → Firecrawl enhanced/Firecrawl-scrape or Browserbase session; full interaction/authentication → Browserbase/Stagehand.**

### 6.2 Pricing comparison table (2026 snapshot)

| Service | Free tier | Paid entry | Unit economics | Notes |
|---|---|---|---|---|
| **Browserbase** | 1 hr browser + 1,000 Fetch + 1,000 Search + 3 agent runs, no card | $20/mo (100 hrs) | Fetch $1/1k; Extract $4/1k; browser hrs $0.10–0.12; 1-min session minimum | Full browser platform + fetch/search/agents |
| **Firecrawl** ([pricing](https://www.firecrawl.dev/pricing.md)) | 1,000 credits/mo, 2 concurrent, no card | Hobby $19/mo (5k credits) | Scrape 1 credit/page; Search 2 credits/10 results; Interact 2 credits/min; JSON/enhanced +4 | Data-layer specialist; YC-backed; JS render + stealth built in |
| **Jina Reader** ([jina.ai/reader](https://jina.ai/reader/)) | Free no-key (rate-limited); 10M free tokens on signup | ~$0.02/M tokens (Reader) | Token-based | `r.jina.ai` URL prefix; cheapest "read" option; free tier RPM ~100–500 |
| **ZenRows** ([pricing](https://zenrows.mintlify.app/first-steps/pricing)) | 5,000 credits/mo | Build $19/mo (45k credits); Launch $69 (250k) | 1 credit/request; JS render 5×; premium proxies 10×; protected 25×; pay only on success | Scraping API + browser sessions; anti-bot focus |
| **ScrapingBee** ([pricing](https://www.scrapingbee.com/pricing/)) | 1,000 credits | Freelance $49.99/mo (250k, 10 concurrent) | 1 credit/call; JS render 5×; premium proxies 10–25× | Simple API, 1,000 free credits |
| **Hyperbrowser** ([docs/pricing](https://hyperbrowser.ai/docs/pricing)) | 5,000 credits (~$5), 1 concurrent, no card | ~$30/mo Startup (30k credits, 25 concurrent) | 1 credit = $0.001; browser hour ~$0.10; per-second billing | Parallelism-first cloud Chromium |
| **Browserless** ([pricing](https://www.browserless.io/pricing)) | 1,000 units/mo (1 unit = 30 s), 2 concurrent, 1-min max session | from ~$25/mo | Units: browser time 30-s increments; proxies/captcha draw same balance | BaaS; MCP endpoint; no free browser concurrency |
| **Playwright Workspaces (Microsoft)** ([learn](https://learn.microsoft.com/en-us/azure/app-testing/playwright-workspaces/how-to-try-playwright-workspaces-free)) | 30-day/100 test-min trial | Consumption (per test-minute) | Test-minute based | E2E-testing focus, not agent/stealth infra |

Other players in the browser-execution space: **Bright Data** (proxy + browser network), **Steel.dev**, **Anchor Browser**, **BrowserStation** (OSS alternative), **Kernel** (unikernel, sub-second cold starts), **Owl Browser**, plus OSS frameworks **Browser Use**, **Crawl4AI**, **ScrapeGraphAI**.

### 6.3 Independent-ish signal on reliability (take with bias caveats)
- A **competitor-run benchmark** (Anchor Browser, Aug 2025) of the top-100 US sites found Browserbase loaded **71/100 (71%)** vs Anchor's 93%, with 30 s timeouts and no proxies/stealth — headline "29% failure rate on basic page loads." Vendor points out sites load fine in its own playground, and the test used default (non-verified, no-proxy) sessions. **Single-vendor test, not an audit.** ([anchor browser blog](https://anchorbrowser.io/blog/page-load-reliability-on-the-top-100-websites-in-the-us))
- Community reviews generally rate Browserbase 4.2–4.5/5; recurring positives: DX, observability, Stagehand, Verified/anti-bot. Recurring negatives: cost at scale for high-volume extraction ("per-session pricing hits hard" once you run hundreds of concurrent sessions), thin free tier for real workloads, no published agent-run overage pricing.

---

## 7. Notable News, Funding & Community Sentiment

### 7.1 Funding & company timeline
- **Jan 2024** — founded by **Paul Klein IV** (ex-Twilio; 3x founder; sold Stream Club to Mux 2021; previously at Mux).
- **Jun 6, 2024** — **$6.5M seed**, led by Kleiner Perkins (angels incl. Patrick Collison, Jeff Lawson, Aaron Levie). ([fundz](https://www.fundz.net/fundings/browserbase-funding-round-seed-5f4b90))
- **Oct 29/Nov 12, 2024** — **$21M Series A**, co-led by Kleiner Perkins & CRV, Okta Ventures participating. ([Kleiner Perkins](https://www.kleinerperkins.com/perspectives/browserbase-ai-seriesa/), [Pulse2](https://pulse2.com/browserbase-web-browser-automation-company-raises-21-million-series-a/))
- **Feb 25, 2025** — Free plan launches.
- **Jun 17, 2025** — **$40M Series B** led by **Notable Capital** (Glenn Solomon joins board), KP & CRV continue; **~$300M valuation**; **1,000+ customers** (Perplexity, Commure, 11x, Vercel, Customer.io; later Ramp, Shopify, Lovable); **20,000+ developers**; **50M+ browser sessions in 2025 alone**; **Director** no-code tool launched same day. ([PRNewswire](https://www.prnewswire.com/news-releases/browserbase-launches-director-to-automate-the-web-for-everyone-announces-40m-series-b-302483761.html), [Upstarts](https://www.upstartsmedia.com/p/browserbase-raises-40m-and-launches-director))
- **Total raised: ~$67.5M.**
- **2026 growth stats (company-reported):** 10,000+ companies, ~37M browser sessions in March 2026, 800k weekly SDK downloads, 61 employees. ([RuntimeWire](https://runtimewire.com/article/browserbase-agents-one-call-browser-agent-api), Exa company profile)

### 7.2 Product/news timeline (2025–2026)
- **Nov 2024** — Series A; **2025** — free plan (Feb), keep-alive on all paid plans (Feb), Stagehand v1.x, HIPAA/SOC2, multi-region, Series B + Director (Jun), price decrease (Jun), Cloudflare Web Bot Auth partnership (Aug), Stagehand Python, SOC 2 Type II, new org/account structure, Director 2.0 + Director chat disabled (Nov), MCP server (Nov).
- **2026** — Session Recordings (Jan 15), Stagehand "works with every language" (Jan 13), **Functions** (Feb 10), **Vercel Marketplace** (Feb 12), Stagehand Caching (Feb 17), **Fetch API** (Mar 11), **hosted MCP** (Mar 14), **free-plan concurrency 1→3** (Mar 16), **Search API (Exa)** (Mar 17), **Prime Intellect/BrowserEnv** (Mar 25), **Model Gateway** (Apr 5), MCP migration/archival of OSS repo (Apr), Fetch markdown/JSON + 5 MB cap (May), **Autobrowse + browse.sh skills catalog** (May), **Browserbase Agents GA** (late Jun 2026), Stagehand 3.7.0 with **Model Router** ("model: auto", 30–40% lower inference cost; new CUA models incl. `google/gemini-3.5-flash` and GPT-5.6 family per changelog).

### 7.3 Community sentiment & complaints
- **HN (Oct 2025):** a site owner said they had to **block all of Browserbase** after a customer used it for AI-training scraping; founder Paul Klein replied that Browserbase gates full platform access, debated giving <50 free sessions, and had already banned unidentified "company accounts." ([HN thread 45459596](https://news.ycombinator.com/item?id=45459596)) — a real operational concern if you run an agent at scale: **your traffic can get sites blocking the whole Browserbase IP space.**
- **Free-plan gripes:** keep-alive 403 on Free ([open-operator #34](https://github.com/browserbase/open-operator/issues/34)); 15-min session cap; 1 browser-hour is tight for anything real; 1,000 Fetch/Search per month.
- **MCP repo archived** — the self-hostable `mcp-server-browserbase` GitHub repo is now **archived** ("no longer maintained… retained for historical purposes"); users are directed to the **hosted MCP endpoint** (`mcp.browserbase.com/mcp`) instead. ([GitHub](https://github.com/browserbase/mcp-server-browserbase))
- **rrweb DOM-replay deprecation** in favor of MP4 video recordings (noted in docs).
- Third-party "MCP Server v2" reviews (e.g. Ship or Skip) list "$49/mo Starter / $299/mo Scale" tiers — **this could not be verified against official docs**, which describe the hosted MCP as running on your Browserbase account/API key with no separate tier list. Treat the $49/$299 claim as unconfirmed.
- **Reliability benchmark** (competitor): 71% page-load success vs Anchor's 93% (§6.3) — single-vendor test, unverified.

---

## 8. Key Sources

**Official:** pricing page, plans doc, concurrency doc, Fetch/Search/Agents docs, API reference (create-a-session), Node/Python SDK refs, MCP intro+setup, Vercel integration, keep-alive, live view, session recording, speed optimization, free-plan blog, fetch-api blog, introducing-agents blog, build-vs-buy blog, Cloudflare identity blog, changelog (via Wayback), browse.sh, autobrowse, Stagehand repo.

**Funding/news:** PRNewswire (Series B/Director), Kleiner Perkins (Series A), Pulse2/Upstarts/SiliconANGLE, RuntimeWire, VentureBeat (2024 launch).

**Community/third-party:** Hacker News (item 45459596), GitHub issues (open-operator #34, mcp-server-browserbase #127), Anchor Browser benchmark, Fixed Labs, Firecrawl pricing.md, ZenRows pricing docs, ScrapingBee pricing, Hyperbrowser docs, Browserless pricing, Microsoft Learn (Playwright Workspaces), Jina AI reader/api docs, Simon Willison on Jina Reader, reviews (MakerStack, Doolpa, ProxyLook, ToolPilot).

**Caveats flagged in-report:** competitor-run benchmarks (§6.3), unverified third-party MCP pricing (§7.3), corrupt third-party pricing-tracker data (§3.2), vendor-reported growth stats (§7.1), and the general volatility of pricing in this category.
