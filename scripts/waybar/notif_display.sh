#!/usr/bin/env bash
set -euo pipefail

readonly ENABLED=''
readonly DISABLED='󰂛'
readonly TIMER_FILE="/tmp/waybar_dnd_timer"

PAUSED=$([[ $(makoctl mode) == "dnd" ]] && echo 1 || echo 0)
CLASS="disabled"
TEXT="$DISABLED"

if [[ $PAUSED -eq 0 ]]; then
  CLASS="enabled"
  TEXT="$ENABLED"
else
  if [[ -f "$TIMER_FILE" ]]; then
    timer_end=$(cat "$TIMER_FILE")
    remaining=$((timer_end - $(date +%s)))

    if ((remaining > 0)); then
      hours=$((remaining / 3600))
      minutes=$(((remaining % 3600) / 60))
      count="$(makoctl list | grep -c Notification 2>/dev/null || true)"
      count="${count:-0}"

      if [[ $hours -gt 0 ]]; then
        time_display="${hours}h ${minutes}m"
      else
        time_display="${minutes}m"
      fi

      TEXT="$DISABLED $time_display"
      if [[ "$count" != '0' ]]; then
        TEXT+=" ($count)"
      fi
    else
      rm -f "$TIMER_FILE"
    fi
  fi

  # show notif count only, if timer is inactive
  if [[ "$TEXT" == "$DISABLED" ]]; then
    COUNT="$(makoctl list | grep -c Notification 2>/dev/null || true)"
    COUNT="${COUNT:-0}"
    if [ "$COUNT" != '0' ]; then
      TEXT="$DISABLED $COUNT"
    fi
  fi
fi

printf '{"text": "%s", "class": "%s"}\n' "$TEXT" "$CLASS"
