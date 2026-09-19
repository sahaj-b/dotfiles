#!/usr/bin/env bash
# Waybar module: EasyEffects power + bypass state.
#
#   Classes:
#     enabled  -> process running, effects active (blue bg)
#     bypassed -> process running, global bypass on (blue icon, default bg)
#     disabled -> process not running (grey)
#
# WARNING: any `easyeffects` CLI invocation closes the primary's open window
# (EE 8 secondary-init behavior). So while its window is open (or freshly
# opened, see easyeffects-open.sh grace marker) we NEVER spawn the CLI: the
# class comes from a state file, and `easyeffects -b 3` only runs when no
# window exists, which is safe.

set -uo pipefail

ICON='󱡫'
RUNTIME="${XDG_RUNTIME_DIR:-/tmp}"
STATE_FILE="$RUNTIME/easyeffects_bypass_state"
GRACE_FILE="$RUNTIME/easyeffects_window_grace"

if ! pgrep -x easyeffects >/dev/null; then
  printf '{"text":"%s","class":"disabled","tooltip":"EasyEffects: Off\\nLeft: - | Middle-click: start | Right-click: open UI"}\n' "$ICON"
  exit 0
fi

window_open() {
  # grace period right after an open request: polling hyprctl alone can miss
  # a window that is still raising, and a mistimed -b 3 would kill it
  if [[ -f $GRACE_FILE ]] && (( $(date +%s) - $(stat -c %Y "$GRACE_FILE" 2>/dev/null || echo 0) < 4 )); then
    return 0
  fi
  hyprctl clients -j 2>/dev/null | jq -e '[.[] | select((.class // "" | test("easy"; "i")))] | length > 0' >/dev/null
}

if window_open; then
  # Window (maybe) open: do NOT query, trust the state file (default active).
  state=$(cat "$STATE_FILE" 2>/dev/null || echo "2")
else
  # No window: safe to ask the truth, and refresh the state file.
  state=$(timeout 2 easyeffects -b 3 2>/dev/null | tr -d '[:space:]')
  [[ $state == "1" ]] || state="2"
  echo "$state" >"$STATE_FILE"
fi

if [[ $state == "1" ]]; then
  printf '{"text":"%s","class":"bypassed","tooltip":"EasyEffects: Bypassed\\nLeft-click: unbypass | Middle-click: quit | Right-click: open UI"}\n' "$ICON"
else
  printf '{"text":"%s","class":"enabled","tooltip":"EasyEffects: Active\\nLeft-click: bypass | Middle-click: quit | Right-click: open UI"}\n' "$ICON"
fi
