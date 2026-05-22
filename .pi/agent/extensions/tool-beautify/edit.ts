import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	attachDiffDetails,
	DiffResult,
	diffSummary,
	readTextForDiff,
	type StructuredDiff,
} from "./diff.js";
import { contextCwd, getBuiltInTool } from "./read.js";
import { stackPrefix, toolLabel } from "./theme.js";
import {
	clearBlink,
	displayPath,
	makeTruncatedLines,
	renderPendingCall,
	renderPendingDetail,
	textContent,
} from "./text.js";

export function registerEdit(pi: ExtensionAPI, agent: any, cwd: string): void {
	const original = getBuiltInTool(agent, cwd, "edit");
	if (!original) return;
	pi.registerTool({
		renderShell: "self",
		name: "edit",
		label: "edit",
		description: original.description,
		parameters: original.parameters,
		async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: unknown, context: any) {
			const effectiveCwd = contextCwd(context, cwd);
			const targetPath = params?.path ?? params?.file_path;
			const before = readTextForDiff(targetPath, effectiveCwd);
			const result = await getBuiltInTool(agent, effectiveCwd, "edit").execute(id, params, signal, onUpdate);
			const after = result?.isError ? before : readTextForDiff(targetPath, effectiveCwd);
			return attachDiffDetails(result, before, after, typeof targetPath === "string" ? targetPath : undefined);
		},
		renderCall(args: any, theme: any, context: any) {
			const targetPath = args?.path ?? args?.file_path ?? "";
			const displayTarget = displayPath(targetPath, context?.cwd ?? cwd);
			return renderPendingCall(`${toolLabel(theme, "Edit ")}${theme.fg("accent", displayTarget)}`, theme, context, cwd);
		},
		renderResult(result: any, { expanded, isPartial }: any, theme: any, context: any) {
			const args = context?.args ?? {};
			const targetPath = args.path ?? args.file_path ?? "";
			const displayTarget = displayPath(targetPath, context?.cwd ?? cwd);
			const call = `${toolLabel(theme, "Edit ")}${theme.fg("accent", displayTarget)}`;
			if (isPartial) return renderPendingDetail("editing…", theme);
			clearBlink(context);
			const structured = result?.details?.toolDiff as StructuredDiff | undefined;
			if (context?.isError || result?.isError) {
				const errorText = textContent(result).split(/\r?\n/)[0] || "edit failed";
				return makeTruncatedLines(`${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${theme.fg("error", errorText)}`);
			}
			const summary = structured ? diffSummary(structured, theme, context?.cwd ?? cwd) : theme.fg("success", "applied");
			const header = `${stackPrefix(theme)}${call}${theme.fg("dim", " · ")}${summary}`;
			if (structured) return new DiffResult(header, structured, theme, expanded, context?.cwd ?? cwd, targetPath);
			return makeTruncatedLines(header);
		},
	});
}
