import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { oneLine } from "./_ansi";
import { settingBoolean, settingNumber, settingStringAllowEmpty } from "./_config";

const DEFAULT_AUTO_RENAME_NAME_CHARS = 80;

export function autoRenameEnabled(cwd?: string): boolean {
	return settingBoolean("sessionAutoRename.enabled", true, cwd);
}

function textFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (typeof part === "string") return part;
			if (
				part &&
				typeof part === "object" &&
				(part as any).type === "text" &&
				typeof (part as any).text === "string"
			)
				return (part as any).text;
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

export function firstUserMessageText(
	branch: SessionEntry[],
): string | undefined {
	for (const entry of branch) {
		if (entry.type !== "message" || entry.message?.role !== "user") continue;
		const text = textFromContent(entry.message.content).trim();
		if (text) return text;
	}
	return undefined;
}

export function conversationTranscriptText(
	branch: SessionEntry[],
	maxChars: number,
): string | undefined {
	const lines: string[] = [];
	for (const entry of branch) {
		if (entry.type !== "message") continue;
		const role = entry.message?.role;
		if (role !== "user" && role !== "assistant") continue;
		const text = textFromContent(entry.message.content).trim();
		if (!text) continue;
		lines.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
	}
	const transcript = lines.join("\n\n").trim();
	return transcript ? truncateMiddle(transcript, maxChars) : undefined;
}

function truncateMiddle(text: string, maxChars: number): string {
	const max = Math.max(200, Math.floor(maxChars));
	if (text.length <= max) return text;
	const marker = "\n[...truncated...]\n";
	const budget = max - marker.length;
	if (budget <= 0) return text.slice(0, max);
	const headBudget = Math.ceil(budget * 0.6);
	const tailBudget = budget - headBudget;
	let head = text.slice(0, headBudget);
	const headSpace = head.lastIndexOf(" ");
	if (headSpace > headBudget * 0.6) head = head.slice(0, headSpace);
	let tail = text.slice(text.length - tailBudget);
	const tailSpace = tail.indexOf(" ");
	if (tailSpace >= 0 && tailSpace < tailBudget * 0.4)
		tail = tail.slice(tailSpace + 1);
	return `${head}${marker}${tail}`;
}

function clampAutoRenameName(name: string, maxChars: number): string {
	const max = Math.max(20, Math.floor(maxChars));
	let cleaned = oneLine(name)
		.replace(/[.!?:;,]+$/g, "")
		.trim();
	if (cleaned.length <= max) return cleaned;
	const truncated = cleaned.slice(0, max).trimEnd();
	const lastSpace = truncated.lastIndexOf(" ");
	cleaned = lastSpace > max * 0.45 ? truncated.slice(0, lastSpace) : truncated;
	return cleaned.replace(/[,;:\s]+$/g, "").trim();
}

function titleCaseWord(word: string): string {
	return word
		? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
		: word;
}

export function deterministicAutoRenameName(
	query: string,
	cwd?: string,
): string | undefined {
	const maxChars = settingNumber(
		"sessionAutoRename.maxNameChars",
		DEFAULT_AUTO_RENAME_NAME_CHARS,
		cwd,
	);
	const cleaned = oneLine(query)
		.replace(/[`"'""'']/g, "")
		.replace(/[^\w\s./-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return undefined;
	const words = cleaned
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 6)
		.map(titleCaseWord);
	return clampAutoRenameName(words.join(" "), maxChars);
}

export async function generateAutoRenameName(
	query: string,
): Promise<{ name?: string; source: string }> {
	const name = deterministicAutoRenameName(query);
	return name
		? { name, source: "deterministic" }
		: { source: "none" };
}

export function withAutoRenamePrefix(name: string, cwd?: string): string {
	const maxNameChars = Math.max(
		20,
		Math.floor(
			settingNumber(
				"sessionAutoRename.maxNameChars",
				DEFAULT_AUTO_RENAME_NAME_CHARS,
				cwd,
			),
		),
	);
	const prefix = settingStringAllowEmpty("sessionAutoRename.prefix", "", cwd);
	const cleaned = prefix ? `${prefix}: ${name}` : name;
	return clampAutoRenameName(cleaned, maxNameChars);
}
