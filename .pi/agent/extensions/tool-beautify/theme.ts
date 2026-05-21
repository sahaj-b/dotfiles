export const FALLBACK_THEME = {
	bg(_token: string, text: string) {
		return text;
	},
	bold(text: string) {
		return `\x1b[1m${text}\x1b[22m`;
	},
	fg(_token: string, text: string) {
		return text;
	},
};

export function treeConnector(
	theme: any,
	branch: "├" | "└" | "│" | "╰" = "├",
): string {
	return theme.fg("accent", `  ${branch === "│" ? "│ " : `${branch}─ `}`);
}

export function treeStem(theme: any, branch: "├" | "└"): string {
	if (branch === "└") return theme.fg("muted", "     ");
	return treeConnector(theme, "│");
}

export function toolLabel(theme: any, label: string): string {
	return theme.fg("text", theme.bold(label));
}

export function stackPrefix(theme: any): string {
	return theme.fg("accent", "● ");
}
