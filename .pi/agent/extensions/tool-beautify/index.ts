import {
	CompactionSummaryMessageComponent,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { registerBash } from "./bash.js";
import {
	installToolExecutionRendererPatch,
	installWorkingIndicator,
	installWorkingLoaderAlignmentPatch,
} from "./chrome.js";
import {
	installAssistantMessageRenderer,
	installCompactionSummaryRenderer,
	installCustomMessageSpacingPatch,
	installMarkdownCodeBlockRenderer,
	installSkillInvocationRenderer,
	installUserMessageRenderer,
} from "./messages.js";
import { registerRead } from "./read.js";
import { registerReadOnly } from "./search.js";
import { registerEdit } from "./edit.js";
import { registerWrite } from "./write.js";
import { settingBoolean } from "./settings.js";

const INSTALL_SYMBOL = Symbol("tool-beautify.installed");

export default async function toolBeautify(pi: ExtensionAPI): Promise<void> {
	const guard = pi as unknown as Record<PropertyKey, unknown>;
	if (guard[INSTALL_SYMBOL]) return;
	guard[INSTALL_SYMBOL] = true;

	installToolExecutionRendererPatch(pi);
	installWorkingLoaderAlignmentPatch();
	installWorkingIndicator(pi);
	installMarkdownCodeBlockRenderer(pi);
	installCompactionSummaryRenderer(pi, CompactionSummaryMessageComponent);

	const agent = await import("@earendil-works/pi-coding-agent");
	installUserMessageRenderer(pi, agent.UserMessageComponent);
	installAssistantMessageRenderer(pi, agent.AssistantMessageComponent);
	installCustomMessageSpacingPatch(pi, (agent as any).CustomMessageComponent);
	installSkillInvocationRenderer(
		pi,
		(agent as any).SkillInvocationMessageComponent,
	);

	const cwd = process.cwd();
	registerRead(pi, agent, cwd);
	registerBash(pi, agent, cwd);
	registerReadOnly(pi, agent, cwd, "grep");
	registerReadOnly(pi, agent, cwd, "find");
	registerReadOnly(pi, agent, cwd, "ls");
	if (settingBoolean("renderMutationTools", false, cwd)) {
		registerEdit(pi, agent, cwd);
		registerWrite(pi, agent, cwd);
	}
}
