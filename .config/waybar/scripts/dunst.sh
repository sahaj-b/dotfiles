#!/usr/bin/env bash
set -euo pipefail

readonly ENABLED=''
readonly DISABLED='󰂛'
readonly TIMER_FILE="/tmp/waybar_dnd_timer"
readonly PID_FILE="/tmp/waybar_dnd.pid"
readonly CMD_FILE="/tmp/waybar_dnd_cmd"

# storing PID for signal targeting
echo $$ >"$PID_FILE"

timer_end=0
timer_active=false

handle_scroll_up() {
  # Check if there's a command file with custom time
  local add_time=300 # default 5 minutes
  if [[ -f "$CMD_FILE" ]]; then
    add_time=$(cat "$CMD_FILE")
    rm -f "$CMD_FILE"
  fi

  if [[ $timer_active == true ]]; then
    # add custom time
    timer_end=$((timer_end + add_time))
    echo "$timer_end" >"$TIMER_FILE"
  else
    # activate timer with custom time if not active
    dunstctl set-paused true
    timer_end=$(($(date +%s) + add_time))
    timer_active=true
    echo "$timer_end" >"$TIMER_FILE"
  fi
}

handle_scroll_down() {
  local sub_time=300 # default 5 minutes
  if [[ -f "$CMD_FILE" ]]; then
    sub_time=$(cat "$CMD_FILE")
    rm -f "$CMD_FILE"
  fi

  if [[ $timer_active == true ]]; then
    # subtract custom time
    timer_end=$((timer_end - sub_time))
    echo "$timer_end" >"$TIMER_FILE"
  fi
}

trap 'handle_scroll_up' USR1
trap 'handle_scroll_down' USR2

# Load existing timer if exists
if [[ -f "$TIMER_FILE" ]]; then
  timer_end=$(cat "$TIMER_FILE")
  current_time=$(date +%s)
  if [[ $timer_end > $current_time ]] && [[ "$(dunstctl is-paused)" == 'true' ]]; then
    timer_active=true
  fi
fi

generate_output() {
  local paused="$(dunstctl is-paused)"
  local class text

  # Sync timer_active with actual DND state
  if [[ "$paused" == 'false' ]]; then
    timer_active=false
    rm -f "$TIMER_FILE"
    class="enabled"
    text="$ENABLED"
  else
    class="disabled"
    text="$DISABLED"

    # Add timer display if active
    if [[ $timer_active == true ]]; then
      local current_time=$(date +%s)
      local remaining=$((timer_end - current_time))

      if [[ $remaining -le 0 ]]; then
        # Timer expired, disable DND
        dunstctl set-paused false
        timer_active=false
        rm -f "$TIMER_FILE"
        text="$ENABLED"
        class="enabled"
      else
        # Show countdown
        local hours=$((remaining / 3600))
        local minutes=$(((remaining % 3600) / 60))
        local count="$(dunstctl count waiting)"

        local time_display
        if [[ $hours -gt 0 ]]; then
          time_display="${hours}h ${minutes}m"
        else
          time_display="${minutes}m"
        fi

        if [[ "$count" != '0' ]]; then
          text="$DISABLED $time_display ($count)"
        else
          text="$DISABLED $time_display"
        fi
      fi
    else
      # No timer, show notification count
      local count="$(dunstctl count waiting)"
      if [[ "$count" != '0' ]]; then
        text="$DISABLED $count"
      fi
    fi
  fi

  printf '{"text": "%s", "class": "%s"}\n' "$text" "$class"
}

while true; do
  generate_output
  sleep 1
done
