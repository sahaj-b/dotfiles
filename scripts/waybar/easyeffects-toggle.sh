#!/usr/bin/env bash
# Left-click: toggle global bypass only, then record the truth for the
# waybar module (a dead window is expected: any easyeffects CLI spawn
# closes the primary's open window) and poke waybar to refresh.
set -uo pipefail

STATE_FILE="${XDG_RUNTIME_DIR:-/tmp}/easyeffects_bypass_state"

pgrep -x easyeffects >/dev/null || exit 0
easyeffects --bypass-toggle >/dev/null 2>&1
sleep 0.8
state=$(timeout 2 easyeffects -b 3 2>/dev/null | tr -d '[:space:]')
[[ $state == "1" ]] || state="2"
echo "$state" >"$STATE_FILE"
pkill -RTMIN+12 waybar 2>/dev/null
