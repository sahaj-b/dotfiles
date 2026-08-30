import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";

/**
 * Shutdown on turn end — personal extension
 *
 * /shutdown        → queue OS shutdown for end of current agent turn,
 *                    or next turn if idle right now
 * /shutdown cancel → abort pending queued shutdown
 * /shutdown-cancel → alias for cancel
 *
 * (no immediate 'now' — run it in another terminal if you want instant)
 */
export default function (pi: ExtensionAPI) {
	let pending = false;
	let shuttingDown = false;

	function fireShutdown(ctx?: { ui: { notify: (msg: string, level: string) => void } }) {
		if (shuttingDown) return;
		shuttingDown = true;
		pending = false;

		try {
			ctx?.ui.notify("shutting down system now...", "warning");
		} catch {}

		const isWin = process.platform === "win32";
		const cmd = isWin ? "shutdown /s /t 0" : "shutdown now";

		try {
			const child = spawn(cmd, {
				shell: true,
				detached: true,
				stdio: "ignore",
			});
			child.unref();
		} catch {}

		if (!isWin) {
			setTimeout(() => {
				try {
					spawn("sudo shutdown -h now", { shell: true, detached: true, stdio: "ignore" }).unref();
				} catch {}
			}, 500);
		}
	}

	pi.on("agent_end", async (_event: any, ctx: any) => {
		if (!pending || shuttingDown) return;
		ctx.ui.notify("Agent turn ended — shutting down system now.", "warning");
		fireShutdown(ctx);
	});

	pi.on("agent_settled", async (_event: any, ctx: any) => {
		if (!pending || shuttingDown) return;
		ctx.ui.notify("Agent settled — shutting down system now.", "warning");
		fireShutdown(ctx);
	});

	pi.registerCommand("shutdown", {
		description: "Shutdown system when agent turn ends (or next turn if idle). Use 'cancel' to abort.",
		handler: async (args: string, ctx: any) => {
			const arg = args?.trim().toLowerCase();

			if (arg === "cancel" || arg === "abort" || arg === "off") {
				if (!pending) {
					ctx.ui.notify("No pending shutdown to cancel.", "info");
					return;
				}
				pending = false;
				shuttingDown = false;
				ctx.ui.notify("Pending shutdown cancelled.", "info");
				return;
			}

			if (pending) {
				ctx.ui.notify("Shutdown already queued. Use /shutdown cancel to abort.", "info");
				return;
			}

			pending = true;
			shuttingDown = false;

			if (ctx.isIdle()) {
				ctx.ui.notify("No active turn — shutdown queued for end of next agent turn.", "info");
			} else {
				ctx.ui.notify("Shutdown scheduled — system will power off when current turn ends.", "info");
			}
		},
	});

	pi.registerCommand("shutdown-cancel", {
		description: "Cancel pending system shutdown",
		handler: async (_args: string, ctx: any) => {
			if (!pending) {
				ctx.ui.notify("No pending shutdown.", "info");
				return;
			}
			pending = false;
			shuttingDown = false;
			ctx.ui.notify("Pending shutdown cancelled.", "info");
		},
	});
}
