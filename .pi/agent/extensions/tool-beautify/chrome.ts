import { ToolExecutionComponent, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Loader } from "@earendil-works/pi-tui";

import { trimOuterBlankLines } from "./ansi.js";
import { settingBoolean } from "./settings.js";
import {
	componentDefinesRenderer,
	renderApplyPatchCall,
	renderApplyPatchResult,
	renderGenericToolCall,
	renderGenericToolResult,
	renderUnknownToolCall,
	renderUnknownToolResult,
	shouldUseGenericRenderer,
	shouldUseUnknownToolRenderer,
} from "./generic.js";

const TOOL_EXECUTION_RENDERER_PATCH_SYMBOL = Symbol.for("tb.tool-execution-renderer-patch");
const WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL = Symbol.for("tb.working-loader-alignment-patch");

function withCallTheme(_component: any, renderer: (args: any, theme: any, context: any) => any): (args: any, theme: any, context: any) => any {
	return function renderCallWithTheme(this: any, args: any, theme: any, context: any) {
		return renderer.call(this, args, theme, context);
	};
}

function withResultTheme(_component: any, renderer: (result: any, options: any, theme: any, context: any) => any): (result: any, options: any, theme: any, context: any) => any {
	return function renderResultWithTheme(this: any, result: any, options: any, theme: any, context: any) {
		return renderer.call(this, result, options, theme, context);
	};
}

export function installToolExecutionRendererPatch(pi: ExtensionAPI): void {
	const proto = ToolExecutionComponent?.prototype as any;
	if (!proto) return;
	const existing = proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL] as { originalGetCallRenderer?: unknown; originalGetRenderShell?: unknown; originalGetResultRenderer?: unknown; originalHasRendererDefinition?: unknown; originalRender?: unknown } | undefined;
	const originalGetCallRenderer = existing?.originalGetCallRenderer ?? proto.getCallRenderer;
	const originalGetResultRenderer = existing?.originalGetResultRenderer ?? proto.getResultRenderer;
	const originalHasRendererDefinition = existing?.originalHasRendererDefinition ?? proto.hasRendererDefinition;
	const originalGetRenderShell = existing?.originalGetRenderShell ?? proto.getRenderShell;
	const originalRender = existing?.originalRender ?? proto.render;
	if (typeof originalGetCallRenderer !== "function" || typeof originalGetResultRenderer !== "function" || typeof originalHasRendererDefinition !== "function" || typeof originalGetRenderShell !== "function" || typeof originalRender !== "function") return;
	const state = { originalGetCallRenderer, originalGetRenderShell, originalGetResultRenderer, originalHasRendererDefinition, originalRender };
	proto.render = function patchedToolExecutionRender(this: any, width: number): string[] {
		const rendered = originalRender.call(this, width);
		if (!Array.isArray(rendered) || typeof this?.toolName !== "string" || typeof this?.toolCallId !== "string") return rendered;
		return trimOuterBlankLines(rendered);
	};
	proto.hasRendererDefinition = function patchedHasRendererDefinition(this: any) {
		const toolName = typeof this?.toolName === "string" ? this.toolName : "";
		if (shouldUseUnknownToolRenderer(this, toolName)) return true;
		return originalHasRendererDefinition.call(this);
	};
	proto.getRenderShell = function patchedGetRenderShell(this: any) {
		const toolName = typeof this?.toolName === "string" ? this.toolName : "";
		if (shouldUseUnknownToolRenderer(this, toolName)) return "self";
		return originalGetRenderShell.call(this);
	};
	proto.getCallRenderer = function patchedGetCallRenderer(this: any) {
		const toolName = typeof this?.toolName === "string" ? this.toolName : "";
		if (shouldUseUnknownToolRenderer(this, toolName)) {
			return withCallTheme(this, (args: any, theme: any, context: any) => renderUnknownToolCall(toolName, args, theme, context));
		}
		if (toolName === "apply_patch" && settingBoolean("applyPatchRenderer", true) && !componentDefinesRenderer(this, "renderCall")) {
			return withCallTheme(this, (args: any, theme: any, context: any) => renderApplyPatchCall(args, theme, context));
		}
		if (settingBoolean("genericToolRenderers", true) && shouldUseGenericRenderer(toolName) && !componentDefinesRenderer(this, "renderCall")) {
			return withCallTheme(this, (args: any, theme: any, context: any) => renderGenericToolCall(toolName, args, theme, context));
		}
		const renderer = originalGetCallRenderer.call(this);
		return typeof renderer === "function" ? withCallTheme(this, renderer) : renderer;
	};
	proto.getResultRenderer = function patchedGetResultRenderer(this: any) {
		const toolName = typeof this?.toolName === "string" ? this.toolName : "";
		if (shouldUseUnknownToolRenderer(this, toolName)) {
			return withResultTheme(this, (result: any, options: any, theme: any, context: any) => renderUnknownToolResult(toolName, result, options, theme, context));
		}
		if (toolName === "apply_patch" && settingBoolean("applyPatchRenderer", true) && !componentDefinesRenderer(this, "renderResult")) {
			return withResultTheme(this, (result: any, options: any, theme: any, context: any) => renderApplyPatchResult(result, options, theme, context));
		}
		if (settingBoolean("genericToolRenderers", true) && shouldUseGenericRenderer(toolName) && !componentDefinesRenderer(this, "renderResult")) {
			return withResultTheme(this, (result: any, options: any, theme: any, context: any) => renderGenericToolResult(toolName, result, options, theme, context));
		}
		const renderer = originalGetResultRenderer.call(this);
		return typeof renderer === "function" ? withResultTheme(this, renderer) : renderer;
	};
	proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL] = state;
	pi.on("session_shutdown", () => {
		if (proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL] !== state) return;
		proto.render = originalRender;
		proto.hasRendererDefinition = originalHasRendererDefinition;
		proto.getRenderShell = originalGetRenderShell;
		proto.getCallRenderer = originalGetCallRenderer;
		proto.getResultRenderer = originalGetResultRenderer;
		delete proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL];
	});
}


export function installWorkingIndicator(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWorkingIndicator({
			frames: [ctx.ui.theme.fg("dim", "·"), ctx.ui.theme.fg("muted", "•"), ctx.ui.theme.fg("accent", "●"), ctx.ui.theme.fg("muted", "•")],
			intervalMs: 120,
		});
	});
	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setWorkingIndicator();
	});
}

export function installWorkingLoaderAlignmentPatch(): void {
	const proto = Loader.prototype as unknown as Record<PropertyKey, any>;
	if (proto[WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL]) return;
	const originalRender = proto.render;
	if (typeof originalRender !== "function") return;
	proto[WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL] = true;
	proto.render = function patchedWorkingLoaderRender(this: any, width: number): string[] {
		const message = typeof this?.message === "string" ? this.message : "";
		if (!message.startsWith("Working...")) return originalRender.call(this, width);
		const originalPaddingX = this.paddingX;
		try {
			this.paddingX = 0;
			this.invalidate?.();
			return originalRender.call(this, width);
		} finally {
			this.paddingX = originalPaddingX;
			this.invalidate?.();
		}
	};
}
