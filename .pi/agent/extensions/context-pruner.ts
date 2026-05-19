/**
 * Context Pruner — Natural-language context management for Pi
 *
 * The LLM gets two tools it can call when you ask it to remove things from context:
 *
 * 1. context_map    — Shows a numbered index of all conversation turns
 * 2. prune_context  — Removes specific entries from future LLM context
 *
 * You just say things like:
 *   "remove your thinking from the last response"
 *   "cut messages 3 through 7 from context"
 *   "drop those 2 file reads you did earlier"
 *   "remove the 3rd prompt-response pair"
 *   "clear everything except the last 2 turns"
 *
 * And the AI maps that to the right entries and prunes them.
 * The session file is never modified — pruned entries just stop being
 * sent to the LLM in future turns.
 *
 * Installation:
 *   Save to ~/.pi/agent/extensions/context-pruner.ts
 *   Then restart Pi or run /reload
 */

import type {
  AgentMessage,
  ExtensionAPI,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const PERSIST_KEY = "context-pruner";

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Walk the branch and build:
 *   - turns[]: numbered user→assistant exchanges (each turn = 1+ messages)
 *   - entryId→turnIndex mapping
 *   - entryId→messageIndex mapping (flat 0-based index across all messages)
 */
function indexConversation(branch: SessionEntry[]) {
  interface TurnInfo {
    turnIndex: number; // 1-based
    entryIds: string[];
    summary: string;
    hasThinking: boolean;
    toolCalls: Array<{ name: string; args: string; entryId: string }>;
    toolResults: Array<{ tool: string; resultPreview: string; entryId: string }>;
    files: string[];
  }

  const turns: TurnInfo[] = [];
  const entryIdToTurnIndex = new Map<string, number>();
  const entryIdToFlatIndex = new Map<string, number>();
  let flatIndex = 0;
  let currentTurn: TurnInfo | null = null;

  for (const entry of branch) {
    const isMessage =
      entry.type === "message" ||
      entry.type === "compaction" ||
      entry.type === "branch_summary" ||
      entry.type === "custom_message";

    if (!isMessage) continue;

    entryIdToFlatIndex.set(entry.id, flatIndex);
    flatIndex++;

    if (entry.type === "message" && entry.message?.role === "user") {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = {
        turnIndex: turns.length + 1,
        entryIds: [],
        summary: "",
        hasThinking: false,
        toolCalls: [],
        toolResults: [],
        files: [],
      };
    }

    if (!currentTurn) continue;
    currentTurn.entryIds.push(entry.id);
    entryIdToTurnIndex.set(entry.id, currentTurn.turnIndex);

    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message;

    // User messages
    if (msg.role === "user") {
      let text = "";
      if (typeof msg.content === "string") text = msg.content;
      else if (Array.isArray(msg.content)) {
        text = msg.content
          .filter((b) => b && typeof b === "object" && "type" in b && b.type === "text")
          .map((b) => (b as any).text ?? "")
          .join(" ");
      }
      currentTurn.summary = text.slice(0, 100);
    }

    // Assistant messages — check for thinking + tool calls
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || typeof block !== "object" || !("type" in block)) continue;

        if (block.type === "thinking") {
          currentTurn.hasThinking = true;
        }

        if (block.type === "toolCall") {
          const name = (block as any).name ?? "unknown";
          const args = JSON.stringify((block as any).arguments ?? {}).slice(0, 80);
          currentTurn.toolCalls.push({ name, args, entryId: entry.id });

          // Extract file paths from tool call args
          const argsObj = (block as any).arguments as Record<string, unknown> | undefined;
          if (argsObj) {
            for (const val of Object.values(argsObj)) {
              if (typeof val === "string" && (val.includes("/") || val.includes("\\"))) {
                if (!currentTurn.files.includes(val)) currentTurn.files.push(val);
              }
            }
          }
        }
      }

      // Append text to summary
      const textParts = msg.content
        .filter((b) => b && typeof b === "object" && "type" in b && b.type === "text")
        .map((b) => (b as any).text ?? "");
      if (textParts.length > 0 && !currentTurn.summary) {
        currentTurn.summary = textParts.join(" ").slice(0, 100);
      }
    }

    // Tool results
    if (msg.role === "toolResult") {
      const toolName = (msg as any).toolName ?? "unknown";
      let preview = "";
      if (typeof msg.content === "string") preview = msg.content.slice(0, 60);
      else if (Array.isArray(msg.content)) {
        preview = msg.content
          .filter((b) => b && typeof b === "object" && "type" in b && b.type === "text")
          .map((b) => (b as any).text ?? "")
          .join("")
          .slice(0, 60);
      }
      currentTurn.toolResults.push({ tool: toolName, resultPreview: preview, entryId: entry.id });

      // Extract file path from tool result details
      const details = (msg as any).details as Record<string, unknown> | undefined;
      if (details?.path && typeof details.path === "string") {
        if (!currentTurn.files.includes(details.path)) currentTurn.files.push(details.path);
      }
    }
  }

  if (currentTurn) turns.push(currentTurn);

  return { turns, entryIdToTurnIndex, entryIdToFlatIndex, totalMessages: flatIndex };
}

/**
 * Build a text representation of the conversation map for the LLM.
 * Shows turns numbered 1-N with key details.
 */
function buildContextMapText(branch: SessionEntry[]): string {
  const { turns } = indexConversation(branch);

  if (turns.length === 0) return "(No conversation history)";

  const lines: string[] = [];
  lines.push(`=== CONTEXT MAP: ${turns.length} turn(s) total ===\n`);

  for (const turn of turns) {
    lines.push(`TURN ${turn.turnIndex}:`);

    // User prompt
    if (turn.summary) {
      lines.push(`  User: "${turn.summary}"`);
    }

    // Thinking
    if (turn.hasThinking) {
      lines.push(`  ⚡ Contains assistant thinking/reasoning content`);
    }

    // Tool calls
    if (turn.toolCalls.length > 0) {
      lines.push(`  Tool calls (${turn.toolCalls.length}):`);
      for (const tc of turn.toolCalls) {
        lines.push(`    - ${tc.name}(${tc.args})`);
      }
    }

    // Tool results
    if (turn.toolResults.length > 0) {
      lines.push(`  Tool results (${turn.toolResults.length}):`);
      for (const tr of turn.toolResults) {
        lines.push(`    - ${tr.tool}: "${tr.resultPreview}"`);
      }
    }

    // Files referenced
    if (turn.files.length > 0) {
      lines.push(`  Files: ${turn.files.join(", ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ─── Persisted prune state ────────────────────────────────────────

type PruneState = {
  prunedEntryIds: string[];
};

function loadPruneState(branch: SessionEntry[]): PruneState {
  const prunedIds = new Set<string>();
  for (const entry of branch) {
    if (
      entry.type === "custom" &&
      entry.customType === PERSIST_KEY &&
      entry.data &&
      typeof entry.data === "object" &&
      Array.isArray((entry.data as any).prunedEntryIds)
    ) {
      for (const id of (entry.data as any).prunedEntryIds) {
        prunedIds.add(id);
      }
    }
  }
  return { prunedEntryIds: [...prunedIds] };
}

function savePruneState(pi: ExtensionAPI, newState: PruneState) {
  pi.appendEntry(PERSIST_KEY, newState);
}

// ─── Filter messages via context event ───────────────────────────

function filterPrunedMessages(
  messages: AgentMessage[],
  prunedEntryIds: Set<string>,
  branch: SessionEntry[]
): AgentMessage[] {
  if (prunedEntryIds.size === 0) return messages;

  // Build mapping from flat message index to entryId
  const flatIndexToEntryId = new Map<number, string>();
  let flatIndex = 0;

  for (const entry of branch) {
    const isMessage =
      entry.type === "message" ||
      entry.type === "compaction" ||
      entry.type === "branch_summary" ||
      entry.type === "custom_message";

    if (isMessage) {
      flatIndexToEntryId.set(flatIndex, entry.id);
      flatIndex++;
    }
  }

  // Determine which flat indices are pruned
  const prunedFlatIndices = new Set<number>();
  for (const [idx, entryId] of flatIndexToEntryId) {
    if (prunedEntryIds.has(entryId)) {
      prunedFlatIndices.add(idx);
    }
  }

  return messages.filter((_, i) => !prunedFlatIndices.has(i));
}

// ─── Extension ─────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── Context event: filter out pruned messages ──────────────────
  pi.on("context", async (event, ctx) => {
    const branch = ctx.sessionManager.getBranch();
    const { prunedEntryIds } = loadPruneState(branch);

    if (prunedEntryIds.length === 0) return;

    const filtered = filterPrunedMessages(
      event.messages,
      new Set(prunedEntryIds),
      branch
    );

    if (filtered.length < event.messages.length) {
      return { messages: filtered };
    }
  });

  // ── Tool: context_map ──────────────────────────────────────────
  pi.registerTool({
    name: "context_map",
    label: "Context Map",
    description:
      "Shows a numbered overview of all conversation turns in the current session. Use this to identify which turns contain thinking, tool calls, file reads, etc. Call this before prune_context to find the right entry IDs.",
    promptSnippet: "View numbered conversation context overview",
    promptGuidelines: [
      "Use context_map when the user asks you to remove something specific from context but you need to identify which entries to target.",
      "Call this first to see the turn structure, then use prune_context with the right entry IDs.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const branch = ctx.sessionManager.getBranch();
      const map = buildContextMapText(branch);
      const { prunedEntryIds } = loadPruneState(branch);

      const result = map + `\n\nPreviously pruned entries: ${prunedEntryIds.length}`;

      return {
        content: [{ type: "text", text: result }],
        details: {},
      };
    },
  });

  // ── Tool: prune_context ────────────────────────────────────────
  pi.registerTool({
    name: "prune_context",
    label: "Prune Context",
    description:
      "Removes specific messages from the conversation context so they won't be sent to the LLM in future turns. Use this to free up context space. You must provide specific entry IDs — call context_map first to find them.",
    promptSnippet: "Remove specific messages from conversation context to free up tokens",
    promptGuidelines: [
      "Always call context_map first to identify the correct entry IDs before calling prune_context.",
      "You can prune multiple entry IDs in a single call.",
      "Pruning is reversible — the user can ask you to restore pruned content later.",
      "Be careful not to prune messages that are still needed for context (e.g., important decisions, file contents you're still working with).",
      "When the user asks to remove something vague like 'your thinking' or 'old messages', call context_map first to find the right entries.",
    ],
    parameters: Type.Object({
      entry_ids: Type.Array(
        Type.String({ description: "The entry IDs to remove from context" }),
        { description: "List of entry IDs to prune" }
      ),
      reason: Type.Optional(
        Type.String({
          description: "Brief explanation of why these entries are being pruned",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const branch = ctx.sessionManager.getBranch();
      const existing = loadPruneState(branch);
      const existingIds = new Set(existing.prunedEntryIds);

      // Validate entry IDs exist in the branch
      const validBranchIds = new Set(branch.map((e) => e.id));
      const newIds: string[] = [];
      const invalidIds: string[] = [];
      const alreadyPruned: string[] = [];

      for (const id of params.entry_ids) {
        if (!validBranchIds.has(id)) {
          invalidIds.push(id);
        } else if (existingIds.has(id)) {
          alreadyPruned.push(id);
        } else {
          newIds.push(id);
        }
      }

      // Save updated prune state
      const updatedIds = [...existing.prunedEntryIds, ...newIds];
      savePruneState(pi, { prunedEntryIds: updatedIds });

      // Build response
      const lines: string[] = [];
      lines.push(`Pruned ${newIds.length} new entry(s) from context.`);
      if (alreadyPruned.length > 0) {
        lines.push(`${alreadyPruned.length} entry(s) were already pruned.`);
      }
      if (invalidIds.length > 0) {
        lines.push(`${invalidIds.length} invalid entry ID(s): ${invalidIds.join(", ")}`);
      }
      if (params.reason) {
        lines.push(`Reason: ${params.reason}`);
      }
      lines.push(`Total pruned entries: ${updatedIds.length}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { pruned: newIds, total: updatedIds.length },
      };
    },
  });

  // ── Tool: unprune_context ──────────────────────────────────────
  pi.registerTool({
    name: "unprune_context",
    label: "Unprune Context",
    description:
      "Restores previously pruned messages back into the conversation context. Use this if the user asks to bring back something that was removed.",
    promptSnippet: "Restore previously pruned messages back into context",
    promptGuidelines: [
      "Use unprune_context when the user asks to restore or bring back something that was previously pruned from context.",
      "Call context_map to see which entries were pruned, then use unprune_context to restore them.",
    ],
    parameters: Type.Object({
      entry_ids: Type.Array(
        Type.String({ description: "The entry IDs to restore" }),
        { description: "List of entry IDs to unprune" }
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const branch = ctx.sessionManager.getBranch();
      const existing = loadPruneState(branch);
      const idsToRestore = new Set(params.entry_ids);
      const remaining = existing.prunedEntryIds.filter((id) => !idsToRestore.has(id));

      savePruneState(pi, { prunedEntryIds: remaining });

      const restored = params.entry_ids.filter((id) => idsToRestore.has(id));

      return {
        content: [
          {
            type: "text",
            text: `Restored ${restored.length} entry(s) to context.\nRemaining pruned entries: ${remaining.length}`,
          },
        ],
        details: { restored, remaining },
      };
    },
  });

  // ── Tool: clear_all_prunes ─────────────────────────────────────
  pi.registerTool({
    name: "clear_all_prunes",
    label: "Clear All Prunes",
    description:
      "Removes ALL prune rules and restores the full conversation context. Use this when the user wants to completely reset the context to include everything.",
    promptSnippet: "Clear all pruned entries and restore full conversation context",
    promptGuidelines: [
      "Only use clear_all_prunes when the user explicitly asks to restore the full context or clear all pruning.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      savePruneState(pi, { prunedEntryIds: [] });

      return {
        content: [{ type: "text", text: "All prunes cleared. Full conversation context restored." }],
        details: {},
      };
    },
  });
}
