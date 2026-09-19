#!/usr/bin/env bash
# Right-click: open the UI. Blocking call (same as the old config). Touches
# a grace marker first so the waybar poller does not fire `easyeffects -b 3`
# while the window is still raising (that query would close it again).
set -uo pipefail

touch "${XDG_RUNTIME_DIR:-/tmp}/easyeffects_window_grace"
easyeffects >/dev/null 2>&1
pkill -RTMIN+12 waybar 2>/dev/null
