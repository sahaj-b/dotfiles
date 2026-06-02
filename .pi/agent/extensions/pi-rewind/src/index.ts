/**
 * pi-rewind — Extension entry point
 *
 * Automatic git-based checkpoints with per-tool granularity.
 * Creates snapshots of your working tree so you can rewind when the AI makes mistakes.
 *
 * Checkpoint strategy (matches Cline — research-backed):
 *   - 1 resume checkpoint on session start
 *   - 1 checkpoint at turn_end (after ALL tools in a response finish)
 *   - Label: user prompt + list of mutating tools that ran
 *   - No per-tool or per-turn-start checkpoints (noisy, redundant)
 *
 * Usage:
 *   pi -e ./src/index.ts
 *   pi install github.com/arpagon/pi-rewind
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  isGitRepo,
  getRepoRoot,
  isValidGitDir,
  createCheckpoint,
  deleteCheckpoint,
  loadAllCheckpoints,
  pruneCheckpoints,
  pruneOldSessions,
  MUTATING_TOOLS,
  DEFAULT_MAX_CHECKPOINTS,
  git,
  type GitConfig,
} from "./core.js";
import { createInitialState, resetState } from "./state.js";
import { updateStatus, clearStatus } from "./ui.js";
import { registerCommands, handleForkRestore, handleTreeRestore } from "./commands.js";
import { loadTrackedDirs, getShadowRepoPath } from "./tracked.js";

/** Truncate a string to maxLen, adding ellipsis if needed */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

/** Extract a human-readable description from a tool_call event */
function describeToolCall(toolName: string, input: any): string {
  if (!input) return toolName;
  switch (toolName) {
    case "write":
      return `write → ${input.path || "?"}`;
    case "edit":
      return `edit → ${input.path || "?"}`;
    case "bash":
      return `bash: ${truncate(String(input.command || ""), 50)}`;
    default:
      return toolName;
  }
}

export default function (pi: ExtensionAPI) {
  const state = createInitialState();

  // Register /rewind command and Esc+Esc shortcut
  registerCommands(pi, state, initSession);

  // ========================================================================
  // Session lifecycle
  // ========================================================================

  async function initSession(ctx: any): Promise<void> {
    resetState(state);

    state.gitAvailable = await isGitRepo(ctx.cwd);
    if (!state.gitAvailable) {
      const trackedDirs = loadTrackedDirs();
      if (trackedDirs.includes(ctx.cwd)) {
        const shadowPath = getShadowRepoPath(ctx.cwd);
        try {
          if (await isValidGitDir(shadowPath)) {
            // Shadow repo already exists — attach to it
            state.shadowRepoDir = shadowPath;
            state.shadowWorkTree = ctx.cwd;
          } else {
            // Create a bare shadow repo at the external path
            await git("init --bare", shadowPath);
            state.shadowRepoDir = shadowPath;
            state.shadowWorkTree = ctx.cwd;
          }
          state.gitAvailable = true;
        } catch {
          if (ctx.hasUI) clearStatus(ctx);
          return;
        }
      } else {
        if (ctx.hasUI) clearStatus(ctx);
        return;
      }
    }

    state.repoRoot = state.shadowWorkTree ?? await getRepoRoot(ctx.cwd);
    state.sessionId = ctx.sessionManager.getSessionId();

    const gitConfig: GitConfig | undefined = state.shadowRepoDir
      ? { gitDir: state.shadowRepoDir, workTree: state.shadowWorkTree! }
      : undefined;

    // Rebuild checkpoint cache from existing git refs (for resumed sessions)
    try {
      const existing = await loadAllCheckpoints(state.repoRoot, state.sessionId, gitConfig);
      for (const cp of existing) {
        state.checkpoints.set(cp.id, cp);
      }
    } catch {
      // Silent — we'll create new checkpoints anyway
    }

    // Create resume checkpoint (snapshot of current state on session start)
    try {
      const resumeId = `resume-${state.sessionId}-${Date.now()}`;
      const cp = await createCheckpoint({
        root: state.repoRoot,
        id: resumeId,
        sessionId: state.sessionId,
        trigger: "resume",
        turnIndex: 0,
        description: "Session start",
        ...gitConfig,
      });
      state.resumeCheckpoint = cp;
      state.checkpoints.set(cp.id, cp);
      state.lastWorktreeTree = cp.worktreeTreeSha;
    } catch {
      // Resume checkpoint is optional
    }

    if (ctx.hasUI) updateStatus(state, ctx);

    // Prune old sessions in background (non-blocking)
    if (state.repoRoot && state.sessionId) {
      const root = state.repoRoot;
      const sid = state.sessionId;
      pruneOldSessions(root, sid, undefined, gitConfig).then((pruned) => {
        if (pruned > 0) {
          // Reload cache after prune
          loadAllCheckpoints(root, sid, gitConfig).then((remaining) => {
            state.checkpoints.clear();
            for (const cp of remaining) state.checkpoints.set(cp.id, cp);
            if (ctx.hasUI) updateStatus(state, ctx);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "fork") {
      // Fork: just update session ID for new checkpoint tagging
      if (!state.gitAvailable) return;
      state.sessionId = ctx.sessionManager.getSessionId();
      return;
    }
    // startup, reload, new, resume: full re-initialization
    await initSession(ctx);
  });

  /** Convenience: get GitConfig from current state, if shadow repo is active. */
  function getGitConfig(): GitConfig | undefined {
    return state.shadowRepoDir
      ? { gitDir: state.shadowRepoDir, workTree: state.shadowWorkTree! }
      : undefined;
  }

  // ========================================================================
  // Capture user prompt for checkpoint labels
  // ========================================================================

  pi.on("before_agent_start", async (event, _ctx) => {
    state.currentPrompt = truncate(String(event.prompt || ""), 60);
    // Reset tool list for this new turn
    state.turnToolDescriptions = [];
    state.turnHadMutations = false;
  });

  // ========================================================================
  // Track turn index
  // ========================================================================

  pi.on("turn_start", async (event, _ctx) => {
    state.currentTurnIndex = event.turnIndex;
  });

  // ========================================================================
  // Capture tool args for checkpoint labels
  // ========================================================================

  pi.on("tool_call", async (event, _ctx) => {
    if (MUTATING_TOOLS.has(event.toolName)) {
      const desc = describeToolCall(event.toolName, event.input);
      state.pendingToolInfo.set(event.toolCallId, desc);
    }
  });

  // ========================================================================
  // Track mutating tools (accumulate per turn, checkpoint at turn_end)
  // ========================================================================

  pi.on("tool_execution_end", async (event, _ctx) => {
    if (!MUTATING_TOOLS.has(event.toolName)) return;

    state.turnHadMutations = true;

    // Get the description captured from tool_call
    const toolDesc = state.pendingToolInfo.get(event.toolCallId)
      || event.toolName;
    state.pendingToolInfo.delete(event.toolCallId);

    state.turnToolDescriptions.push(toolDesc);
  });

  // ========================================================================
  // Create checkpoint at turn_end (1 per model response, like Cline)
  // ========================================================================

  pi.on("turn_end", async (_event, ctx) => {
    if (!state.gitAvailable || state.failed) return;
    if (!state.repoRoot || !state.sessionId) return;

    const gc = getGitConfig();

    // Only create checkpoint if this turn had mutating tools
    if (state.turnHadMutations) {
      // Build description: prompt + tools
      const promptLabel = state.currentPrompt ? `"${state.currentPrompt}"` : "";
      const toolsLabel = state.turnToolDescriptions.join(", ");
      const desc = promptLabel && toolsLabel
        ? `${promptLabel} → ${toolsLabel}`
        : promptLabel || toolsLabel || `Turn ${state.currentTurnIndex}`;

      // Wait for any in-flight checkpoint
      if (state.pending) await state.pending;

      state.pending = (async () => {
        try {
          const ts = Date.now();
          const id = `turn-${state.sessionId}-${state.currentTurnIndex}-${ts}`;
          const cp = await createCheckpoint({
            root: state.repoRoot!,
            id,
            sessionId: state.sessionId!,
            trigger: "tool",
            turnIndex: state.currentTurnIndex,
            description: desc,
            ...gc,
          });

          // Skip if worktree is identical to last checkpoint (read-only bash like ls, find, cat)
          if (state.lastWorktreeTree && cp.worktreeTreeSha === state.lastWorktreeTree) {
            await deleteCheckpoint(state.repoRoot!, cp.id, gc);
            return;
          }

          state.checkpoints.set(cp.id, cp);
          state.lastWorktreeTree = cp.worktreeTreeSha;
          if (ctx.hasUI) updateStatus(state, ctx);
        } catch {
          // Checkpoint failures are non-fatal
        }
      })();
    }

    // Wait for checkpoint to complete before pruning
    if (state.pending) await state.pending;

    // Auto-prune
    try {
      const pruned = await pruneCheckpoints(
        state.repoRoot,
        state.sessionId,
        DEFAULT_MAX_CHECKPOINTS,
        gc,
      );
      if (pruned > 0) {
        const remaining = await loadAllCheckpoints(state.repoRoot, state.sessionId, gc);
        state.checkpoints.clear();
        for (const cp of remaining) {
          state.checkpoints.set(cp.id, cp);
        }
        if (ctx.hasUI) updateStatus(state, ctx);
      }
    } catch {
      // Pruning is non-critical
    }

    // Reset turn state
    state.turnToolDescriptions = [];
    state.turnHadMutations = false;
  });

  // ========================================================================
  // Fork / tree restore hooks
  // ========================================================================

  pi.on("session_before_fork", async (event, ctx) => {
    return handleForkRestore(state, event, ctx);
  });

  pi.on("session_before_tree", async (event, ctx) => {
    return handleTreeRestore(state, event, ctx);
  });

  // ========================================================================
  // Shutdown
  // ========================================================================

  pi.on("session_shutdown", async () => {
    if (state.pending) await state.pending;
  });
}
