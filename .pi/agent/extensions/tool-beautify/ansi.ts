import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";


export const ANSI_GREEN = "\x1b[32m";
export const ANSI_RED = "\x1b[31m";
export const ANSI_FG_RESET = "\x1b[39m";
export const ANSI_BG_RESET = "\x1b[49m";

export const ANSI_RE = /\x1b(?:\[[0-9;]*m|\]133;[ABC]\x07)/g;
export const ANSI_PRESENT_RE = /\x1b\[[0-9;]*m/;

export function stripAnsi(text: string): string {
	return text.replace(ANSI_RE, "");
}

export function hasAnsi(text: string): boolean {
	return ANSI_PRESENT_RE.test(text);
}

export function visibleLength(text: string): number {
	return visibleWidth(text);
}

export function padVisible(text: string, width: number): string {
	const missing = width - visibleLength(text);
	return missing > 0 ? `${text}${" ".repeat(missing)}` : text;
}

export function truncateAnsi(text: string, width: number): string {
	return truncateToWidth(text, Math.max(1, width), "");
}

export function stableRenderWidth(width: number, _cwd?: string): number {
	const safe = Math.max(1, Math.floor(width || 1));
	return safe > 1 ? safe - 1 : safe;
}

export function terminalWidth(cwd?: string): number {
	const raw = Number(process.stdout.columns || (process.stderr as any).columns || process.env.COLUMNS || 120);
	const guarded = stableRenderWidth(raw, cwd);
	return Math.max(40, guarded);
}

export function isBlankRenderLine(line: string | undefined): boolean {
	return stripAnsi(line ?? "").trim().length === 0;
}

export function trimTrailingBlankLines(lines: string[]): string[] {
	let end = lines.length - 1;
	while (end >= 0 && isBlankRenderLine(lines[end])) end--;
	return end < 0 ? [] : lines.slice(0, end + 1);
}

export function trimOuterBlankLines(lines: string[]): string[] {
	let start = 0;
	while (start < lines.length && isBlankRenderLine(lines[start])) start++;
	let end = lines.length - 1;
	while (end >= start && isBlankRenderLine(lines[end])) end--;
	return start > end ? [] : lines.slice(start, end + 1);
}

export function isHorizontalRuleLine(line: string | undefined): boolean {
	const stripped = stripAnsi(line ?? "").trim();
	return stripped.length > 0 && /^[─━-]+$/.test(stripped);
}

export function trimOuterBlankLinesAroundRules(lines: string[]): string[] {
	const trimmed = trimOuterBlankLines(lines);
	if (trimmed.length < 3) return lines;
	return isHorizontalRuleLine(trimmed[0]) && isHorizontalRuleLine(trimmed[trimmed.length - 1]) ? trimmed : lines;
}

export function isThinkingOnlyAssistantMessage(message: any): boolean {
	const content = Array.isArray(message?.content) ? message.content : [];
	let hasThinking = false;
	for (const item of content) {
		if (item?.type === "text" && typeof item.text === "string" && item.text.trim()) return false;
		if (item?.type === "thinking" && typeof item.thinking === "string" && item.thinking.trim()) hasThinking = true;
	}
	return hasThinking;
}

export function trimThinkingOnlyAssistantLines(lines: string[]): string[] {
	const trimmed = trimOuterBlankLines(lines).map((line) => line.trimEnd());
	if (trimmed.length === 0) return lines;
	const zoneStart = "\x1b]133;A\x07";
	if (lines[0]?.includes(zoneStart) && !trimmed[0]?.includes(zoneStart)) trimmed[0] = `${zoneStart}${trimmed[0] ?? ""}`;
	return trimmed;
}

export function fgParts(theme: any, token: string): { open: string; close: string } {
	const marker = "\uE000";
	try {
		const styled = theme.fg(token, marker);
		const index = styled.indexOf(marker);
		if (index < 0) return { open: "", close: "" };
		return { open: styled.slice(0, index), close: styled.slice(index + marker.length) };
	} catch {
		return { open: "", close: "" };
	}
}

export function applyBaseTextFg(line: string, theme: any): string {
	let normalized = line;
	for (const token of ["userMessageText", "text"]) {
		const { open } = fgParts(theme, token);
		if (open) normalized = normalized.split(open).join(ANSI_FG_RESET);
	}
	return `${ANSI_FG_RESET}${normalized.replace(/\x1b\[(?:0|39)m/g, (reset) => `${reset}${ANSI_FG_RESET}`)}${ANSI_FG_RESET}`;
}

export { visibleWidth, wrapTextWithAnsi };
