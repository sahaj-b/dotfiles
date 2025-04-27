#!/usr/bin/env bash

function onBattery() {
  # turn off auto-cpufreq
  sudo auto-cpufreq --remove

  # turn on tlp
  systemctl start tlp

  # disable bluetooth if not connected
  if [ "$(bluetoothctl info | grep 'Connected: yes' | wc -l)" -eq 0 ]; then
    bluetoothctl power off
  fi

  # disable shadows and blur
  # sudo -u sahaj DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus hyprctl --instance 0 keyword decoration:blur:enabled false, decoration:shadow:enabled false
}
function onCharging() {
  # turn on auto-cpufreq
  sudo auto-cpufreq --install

  # turn off tlp
  systemctl stop tlp

  # enable shadows and blur
  # sudo -u sahaj DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus hyprctl --instance 0 reload
}

TMPFILE=/tmp/charging
echo $(($(cat /sys/class/power_supply/AC0/online) ^ 1)) >"$TMPFILE"
while true; do
  read charging </sys/class/power_supply/AC0/online
  if [[ $charging -eq 1 && $(cat $TMPFILE) -eq 0 ]]; then
    onCharging
    echo 1 >$TMPFILE
  elif [[ $charging -eq 0 && $(cat $TMPFILE) -eq 1 ]]; then
    onBattery
    echo 0 >$TMPFILE
  fi
  sleep 5
done
