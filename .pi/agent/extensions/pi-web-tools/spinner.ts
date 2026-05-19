import { Text } from "@earendil-works/pi-tui";

export const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
export const SPINER_INTERVAL = 60;

export function bullet(theme: any): string {
	return theme.fg("accent", "●");
}

export function treeConnector(theme: any): string {
	return theme.fg("muted", "╰─ ");
}

function startSpinner(ctx: any): void {
	if (ctx.state._spinStarted) return;
	ctx.state._spinStarted = true;
	ctx.state._fi = 0;
	ctx.state._spinInterval = setInterval(() => {
		ctx.state._fi = (ctx.state._fi + 1) % SPINNER_FRAMES.length;
		ctx.invalidate();
	}, SPINER_INTERVAL);
}

export function cleanupSpinner(ctx: any): void {
	if (ctx.state._spinInterval) {
		clearInterval(ctx.state._spinInterval);
		ctx.state._spinInterval = null;
	}
	ctx.state._spinStarted = false;
	ctx.state._fi = 0;
}

export function spinnerFrame(ctx: any, theme: any): string {
	startSpinner(ctx);
	const frame = SPINNER_FRAMES[ctx.state._fi] ?? SPINNER_FRAMES[0];
	return theme.fg("warning", frame);
}

// renderCall prefix: spinner during loading, static bullet when done
export function animatedBullet(ctx: any, theme: any): string {
	if (ctx.isPartial) return spinnerFrame(ctx, theme);
	cleanupSpinner(ctx);
	return bullet(theme);
}

// renderResult line: tree connector + label
export function connectorText(ctx: any, theme: any, label: string): Text {
	return new Text(`${treeConnector(theme)}${label}`, 0, 0);
}
