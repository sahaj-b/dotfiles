#!/usr/bin/env bash

# Function to send notifications
notification_sent=0
notification_sent1=0
notification_sent2=0
notification_sent3=0
send_notification() {
  local percent=$1
  local state=$2

  if [[ $state == "Charging" || $state == "Not charging" || $state == "Full" ]]; then
    if [[ $notification_sent == 1 ]]; then
      dunstify -C 69
      notification_sent=0
    fi
  elif [[ $state == "Discharging" ]]; then
    if [[ $notification_sent == 0 ]]; then
      dunstify -r 69 -u critical "Battery is Discharging (dblur)"
      notification_sent=1
    fi
    if [[ $percent -lt 10 ]]; then
      if [[ $notification_sent1 == 0 ]]; then
        notify-send -u critical -t 0 'BATTERY IS VERY LOW (10%)!!!'
        notification_sent1=1
      fi
    elif [[ $percent -lt 20 ]]; then
      if [[ $notification_sent2 == 0 ]]; then
        notify-send -u critical -t 0 "Low Battery (20%)"
        notification_sent2=1
      fi
    elif [[ $percent -lt 30 ]]; then
      if [[ $notification_sent3 == 0 ]]; then
        notify-send "Low Battery (30%)"
        notification_sent3=1
      fi
    fi
  fi
}

while true; do
  percent=$(acpi -b | grep -oP '\d+%' | tr -d '%')
  state=$(acpi -b | grep -oP "Discharging|Charging|Full|Unknown|Not charging")

  # Send notifications if necessary
  send_notification "$percent" "$state"

  sleep 2
done
