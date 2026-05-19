import { basename } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { settingBoolean, settingNumber } from "./_config";

const SPINNER_INTERVAL = 15;
const LOADING_WAVE_FROM = "#333333";
const LOADING_WAVE_TO = "#c69bf7";
const LOADING_WAVE_RATIO = 0.35;
const LOADING_BAR_STATIC = "#835eaf";
const LOADING_BOUNCE_FRAMES = 35;

function hexGradient(from: string, to: string, steps: number): string[] {
	const parse = (h: string) => [
		parseInt(h.slice(1, 3), 16),
		parseInt(h.slice(3, 5), 16),
		parseInt(h.slice(5, 7), 16),
	];
	const [r1, g1, b1] = parse(from);
	const [r2, g2, b2] = parse(to);
	const ramp = Array.from({ length: steps }, (_, i) => {
		const t = i / (steps - 1);
		const r = Math.round(r1 + (r2 - r1) * t);
		const g = Math.round(g1 + (g2 - g1) * t);
		const b = Math.round(b1 + (b2 - b1) * t);
		return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
	});
	return [...ramp, ...ramp.reverse().slice(1)];
}

function truecolorFg(hex: string, text: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `\x1b[38;2;${r};${g};${b}m${text}`;
}

// const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// const SPINNER_FRAMES = [
// 	" 🦍⚽       🦍 ",
// 	"🦍  ⚽      🦍 ",
// 	"🦍   ⚽     🦍 ",
// 	"🦍    ⚽    🦍 ",
// 	"🦍     ⚽   🦍 ",
// 	"🦍      ⚽  🦍 ",
// 	"🦍       ⚽🦍  ",
// 	"🦍      ⚽  🦍 ",
// 	"🦍     ⚽   🦍 ",
// 	"🦍    ⚽    🦍 ",
// 	"🦍   ⚽     🦍 ",
// 	"🦍  ⚽      🦍 ",
// ];

let spinnerActive = false;
let spinnerFrame = 0;
let spinnerTimer: ReturnType<typeof setInterval> | undefined;

export interface GitState {
	projectName: string;
	branch?: string;
	dirty: boolean;
}

function repoNameFromRemote(remote: string): string | undefined {
	const trimmed = remote.trim().replace(/\.git$/, "");
	const match = trimmed.match(/([^/:]+)$/);
	return match?.[1];
}

function formatModelName(ctx: ExtensionContext): string {
	const model = ctx.model;
	if (!model) return "no model";
	let name = model.name || model.id;
	name = name.replace(/^Claude\s+/i, "");
	name = name.replace(/^claude[-_]/i, "");
	name = name.replace(/[-_](20\d{6}|latest)$/i, "");
	name = name.replace(/^gpt[-_]/i, "GPT ");
	name = name.replace(/[-_]/g, " ");
	name = name.replace(/\bopus\b/i, "Opus");
	name = name.replace(/\bsonnet\b/i, "Sonnet");
	name = name.replace(/\bhaiku\b/i, "Haiku");
	name = name.replace(/\s+/g, " ").trim();
	name = name.replace(/\b(Opus|Sonnet|Haiku) (\d) (\d)\b/, "$1 $2.$3");
	return name;
}

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
const THINKING_TOKEN: Record<ThinkingLevel, string> = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
};

function normalizeThinkingLevel(value: string | undefined): ThinkingLevel {
	switch ((value ?? "").toLowerCase()) {
		case "off":
			return "off";
		case "minimal":
			return "minimal";
		case "low":
			return "low";
		case "medium":
			return "medium";
		case "high":
			return "high";
		case "xhigh":
			return "xhigh";
		default:
			return "off";
	}
}

function formatTokens(value: number | undefined): string {
	if (!value || value <= 0) return "?";
	if (value >= 1_000_000) {
		const v = value / 1_000_000;
		return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}M`;
	}
	if (value >= 1_000) {
		const v = value / 1_000;
		return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}K`;
	}
	return `${value}`;
}

function statuslineContextInfo(ctx: ExtensionContext): {
	window: string;
	percent: number | null;
	used: string;
} {
	const usage = ctx.getContextUsage();
	const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	if (typeof usage?.percent !== "number") {
		return { window: formatTokens(contextWindow), percent: null, used: "?" };
	}
	const usedPercent = Math.max(0, Math.min(100, Math.round(usage.percent)));
	const usedTokens =
		contextWindow > 0 ? Math.round((usage.percent / 100) * contextWindow) : 0;
	return {
		window: formatTokens(contextWindow),
		percent: 100 - usedPercent,
		used: formatTokens(usedTokens || (usage?.tokens ?? 0)),
	};
}

function gitBadge(state: GitState, showDirtyMarker: boolean): string {
	if (!state.branch) return "";
	return `${state.branch}${state.dirty && showDirtyMarker ? "*" : ""}`;
}

export function makeFallbackGitState(cwd: string): GitState {
	return { projectName: basename(cwd), dirty: false };
}

async function runGit(
	pi: ExtensionAPI,
	cwd: string,
	args: string[],
): Promise<string | undefined> {
	try {
		const result = await pi.exec("git", ["-C", cwd, ...args], {
			timeout: settingNumber("gitRefreshTimeoutMs", 1500, cwd),
		});
		if (result.code !== 0) return undefined;
		const stdout = result.stdout.trim();
		return stdout.length > 0 ? stdout : undefined;
	} catch {
		return undefined;
	}
}

export async function refreshGitState(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<GitState> {
	const cwd = ctx.cwd;
	const topLevel = await runGit(pi, cwd, ["rev-parse", "--show-toplevel"]);
	if (!topLevel) return makeFallbackGitState(cwd);
	const [remote, branchRaw, shortHead, diffExit] = await Promise.all([
		runGit(pi, cwd, ["remote", "get-url", "origin"]),
		runGit(pi, cwd, ["branch", "--show-current"]),
		runGit(pi, cwd, ["rev-parse", "--short", "HEAD"]),
		pi
			.exec("git", ["-C", cwd, "diff-index", "--quiet", "HEAD", "--"], {
				timeout: settingNumber("gitRefreshTimeoutMs", 1500, cwd),
			})
			.then((result) => result.code)
			.catch(() => 0),
	]);
	const projectName = repoNameFromRemote(remote ?? "") ?? basename(topLevel);
	const branch = branchRaw || shortHead;
	return { projectName, branch, dirty: diffExit === 1 };
}

export function renderStatusLine(
	width: number,
	ctx: ExtensionContext,
	git: GitState,
	pi: ExtensionAPI,
	theme: Pick<Theme, "fg">,
): string {
	const { percent, used } = statuslineContextInfo(ctx);
	// const spinner = spinnerActive ? (SPINNER_FRAMES[spinnerFrame] ?? "") : "";
	const gitChunk = `${gitBadge(git, settingBoolean("showDirtyMarker", true, ctx.cwd))}`;
	const modelChunk = formatModelName(ctx);
	const statusSeparator = " ∙ ";
	const thinkingLevel = normalizeThinkingLevel(pi.getThinkingLevel());
	const thinkingChunk = thinkingLevel;
	const leftPlain = `${modelChunk}${statusSeparator}${thinkingChunk}${gitChunk ? statusSeparator : ""}${gitChunk}`;

	const percentPlain = percent === null ? "…" : `${percent}`;
	const contextWindow = statuslineContextInfo(ctx).window;
	const rightPlainFull = `${used}/${contextWindow} ${percentPlain}`;

	const percentColor =
		percent === null
			? "muted"
			: percent <= 15
				? "error"
				: percent <= 30
					? "warning"
					: "success";
	const separatorColored = theme.fg("muted", statusSeparator);
	const leftColored = `${theme.fg("accent", modelChunk)}${separatorColored}${theme.fg(THINKING_TOKEN[thinkingLevel], thinkingChunk)}${gitChunk ? separatorColored : ""}${theme.fg("mdCode", gitChunk)}`;
	const right = `${theme.fg("muted", `${used}/${contextWindow}`)} ${theme.fg(percentColor, percentPlain)}`;

	const minimumGap = 1;
	const gapWidth = Math.max(
		minimumGap,
		width - visibleWidth(leftPlain) - visibleWidth(rightPlainFull) - 2,
	);
	const waveSteps = Math.max(2, Math.round(gapWidth * LOADING_WAVE_RATIO));
	const wave = hexGradient(LOADING_WAVE_FROM, LOADING_WAVE_TO, waveSteps);
	const halfWave = wave.length >> 1;
	const bounceFull = LOADING_BOUNCE_FRAMES * 2;
	const t = (spinnerFrame % bounceFull) / LOADING_BOUNCE_FRAMES;
	const phase = t <= 1 ? t : 2 - t;
	const eased = (1 - Math.cos(phase * Math.PI)) / 2;
	const pos = eased * (gapWidth - 1);
	const bar = spinnerActive
		? Array.from({ length: gapWidth }, (_, i) => {
				const dist = Math.abs(i - pos);
				const idx = Math.max(0, halfWave - Math.round(dist));
				return truecolorFg(wave[Math.min(idx, wave.length - 1)], "─");
			}).join("")
		: truecolorFg(LOADING_BAR_STATIC, "─".repeat(gapWidth));

	return truncateToWidth(`${leftColored} ${bar} ${right}`, width, "");
}

export function setSpinnerActive(active: boolean, refresh: () => void): void {
	spinnerActive = active;
	if (active) {
		if (spinnerTimer) clearInterval(spinnerTimer);
		spinnerFrame = 0;
		spinnerTimer = setInterval(() => {
			spinnerFrame++;
			refresh();
		}, SPINNER_INTERVAL);
	} else {
		if (spinnerTimer) clearInterval(spinnerTimer);
		spinnerTimer = undefined;
		spinnerFrame = 0;
	}
}
