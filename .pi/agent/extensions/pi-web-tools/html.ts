// ── HTML → Markdown/Text conversion (ported from dotfiles/web-tools) ──

import { convert as convertHtmlToText, compile as compileHtmlToText } from "html-to-text";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const REMOVAL_SELECTOR = "head,title,script,style,noscript,template,meta,link,iframe,object,embed,canvas,svg,video,audio,source,picture,button,input,select,textarea";
const LANDMARK_REMOVAL = "header,footer,nav,aside,dialog,menu,[role='banner'],[role='navigation'],[role='complementary'],[role='contentinfo'],[aria-modal='true'],[hidden],[aria-hidden='true']";
const PREFERRED = ["#readme","[data-testid='repository-readme-content']","article.markdown-body",".markdown-body","article","main","[role='main']","#content","#main-content",".main-content",".content",".post-content",".entry-content"];
const BOILERPLATE_RE = /(^|[-_\s])(nav(?:igation)?|header|footer|sidebar|aside|menu|dialog|modal|cookie|consent|promo|advert|social|share|breadcrumb|pagination|toolbar|search|newsletter|subscribe|signup|login|banner|related|recommendation)s?($|[-_\s])/i;
const RAW_HTML_BLOCK_RE = /<(table|tbody|thead|tfoot|tr|td|th|div|section|article|main|header|footer|nav|aside)\b/gi;

const turndown = new TurndownService({ headingStyle: "atx", hr: "---", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*" });
turndown.use(gfm as never);

const compiledText = compileHtmlToText({
	baseElements: { selectors: ["body", "main", "article", "div"], returnDomByDefault: true },
	wordwrap: false,
	selectors: [
		{ selector: "img", format: "skip" },
		{ selector: "table", format: "dataTable", options: { uppercaseHeaderCells: false } },
		...["h1","h2","h3","h4","h5","h6"].map(s => ({ selector: s, options: { uppercase: false } })),
	],
});

export function htmlToMarkdown(rawHtml: string, baseUrl: string): string {
	return cleanupMd(turndown.turndown(sanitize(rawHtml, baseUrl)));
}

export function htmlToText(rawHtml: string, baseUrl: string): string {
	return cleanupText(compiledText(sanitize(rawHtml, baseUrl)));
}

export function isPoorMarkdownConversion(md: string): boolean {
	return (md.match(RAW_HTML_BLOCK_RE)?.length ?? 0) >= 6 || /^\s*<(table|tbody|thead|tfoot|tr|td|th|div|section|article|main)\b/i.test(md);
}

function sanitize(rawHtml: string, baseUrl: string): string {
	const { document } = parseHTML(rawHtml);
	const root = extractRoot(document);
	for (const el of root.querySelectorAll(REMOVAL_SELECTOR)) el.remove();
	for (const el of root.querySelectorAll(LANDMARK_REMOVAL)) el.remove();
	for (const el of Array.from(root.querySelectorAll("*"))) { if (isBoilerplate(el)) el.remove(); }
	for (const el of root.querySelectorAll("[href],[src]")) {
		for (const attr of ["href", "src"] as const) {
			const v = el.getAttribute(attr);
			if (!v) continue;
			try { el.setAttribute(attr, new URL(v, baseUrl).toString()); } catch { el.removeAttribute(attr); }
		}
	}
	return `<div>${root.innerHTML}</div>`;
}

function extractRoot(document: Document): Element {
	for (const sel of PREFERRED) {
		const match = document.querySelector(sel);
		if (match && (match.textContent?.trim().length ?? 0) > 100) return match.cloneNode(true) as Element;
	}
	return (document.querySelector("body") ?? document.documentElement).cloneNode(true) as Element;
}

function isBoilerplate(el: Element): boolean {
	return BOILERPLATE_RE.test([el.id, el.getAttribute("class"), el.getAttribute("role"), el.getAttribute("aria-label")].filter(Boolean).join(" "));
}

function cleanupMd(md: string): string {
	return md.replace(/\r\n/g, "\n").replace(/\[\]\([^)]+\)\n?/gm, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanupText(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
