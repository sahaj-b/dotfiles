#!/usr/bin/env bash
set -euo pipefail

readonly ENABLED=''
readonly DISABLED='󰂛'
readonly TIMER_FILE="/tmp/waybar_dnd_timer"

PAUSED="$(dunstctl is-paused)"
CLASS="disabled"
TEXT="$DISABLED"

if [[ "$PAUSED" == 'false' ]]; then
  CLASS="enabled"
  TEXT="$ENABLED"
else
  if [[ -f "$TIMER_FILE" ]]; then
    timer_end=$(cat "$TIMER_FILE")
    remaining=$((timer_end - $(date +%s)))

    if ((remaining > 0)); then
      hours=$((remaining / 3600))
      minutes=$(((remaining % 3600) / 60))
      count="$(dunstctl count waiting)"

      if [[ $hours -gt 0 ]]; then
        time_display="${hours}h ${minutes}m"
      else
        time_display="${minutes}m"
      fi

      TEXT="$DISABLED $time_display"
      if [[ "$count" != '0' ]]; then
        TEXT+=" ($count)"
      fi
    fi
  fi

  # show notif count only, if timer is inactive
  if [[ "$TEXT" == "$DISABLED" ]]; then
    COUNT="$(dunstctl count waiting)"
    if [ "$COUNT" != '0' ]; then
      TEXT="$DISABLED $COUNT"
    fi
  fi
fi

printf '{"text": "%s", "class": "%s"}\n' "$TEXT" "$CLASS"
