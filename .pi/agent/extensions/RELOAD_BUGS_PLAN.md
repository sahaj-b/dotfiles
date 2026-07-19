# `/reload` Bugs: Statusline & Model Reset

## Root Causes

### 1. Broken Imports (BLOCKER) — 4 extensions use `@mariozechner/*` instead of `@earendil-works/*`

The `@mariozechner/pi-coding-agent` package **does not exist** on your system. Only `@earendil-works/*` is installed. These extensions crash on load:

| File | Broken Import |
|------|---------------|
| `codex.ts` | `@mariozechner/pi-coding-agent` |
| `opencode.ts` | `@mariozechner/pi-coding-agent` |
| `skill-toggle.ts` | `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui` |
| `subagents.ts` | `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui` |

When `/reload` runs, pi reloads all extensions. If any extension crashes during load, it can disrupt the extension loading pipeline — especially if it's loaded before the `qol` statusline extension. This is the **most likely reason the statusline disappears** on reload.

### 2. Module-level state not persisted across reloads

`/reload` creates **new extension instances** — module-level variables reset to their initial values:

- **`modes.ts`**: `activeMode` → `null`, `createdFiles` → empty. User loses RO/MD mode on reload. No `session_shutdown` handler to persist state.
- **`prompt-modes.ts`**: `activeMode` → `null`. User loses prompt mode on reload.

### 3. Model resets to `settings.json` default

`settings.json` has `"defaultModel": "mimo-v2.5-free"`. On `/reload`, pi may re-read settings and revert to this default instead of keeping the session's current model.

## Fixes

### Fix 1: Update all broken imports

Replace `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent` and `@mariozechner/pi-tui` → `@earendil-works/pi-tui` in all 4 files.

### Fix 2: Persist mode state across reloads in `modes.ts`

- Store `activeMode` via `pi.appendEntry()` on mode change
- Restore from session entries in `session_start`
- Add `session_shutdown` handler

### Fix 3: Persist prompt mode state across reloads in `prompt-modes.ts`

- Store `activeMode` via `pi.appendEntry()` on mode change
- Restore from session entries in `session_start`
- Add `session_shutdown` handler

### Fix 4: Model persistence

The model issue is likely caused by the broken extension loads disrupting pi's model initialization. Fixing imports (Fix 1) should resolve this. If not, `model-selector.ts` could explicitly restore model from session state on `session_start`.

## Files to Edit

1. `codex.ts` — fix imports
2. `opencode.ts` — fix imports
3. `skill-toggle.ts` — fix imports
4. `subagents.ts` — fix imports
5. `modes.ts` — persist mode state
6. `prompt-modes.ts` — persist prompt mode state
