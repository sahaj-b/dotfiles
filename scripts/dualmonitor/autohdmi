#!/usr/bin/env bash

while [ True ] 
do
    xrandr=$(xrandr)
    con_monitors=$(echo $xrandr | grep -c "HDMI-1 connected")
    if [[ $con_monitors -eq 1 ]]; then
        xrandr --output eDP-1 --primary --mode 1366x768 --pos 1360x768 --rotate normal --output HDMI-1 --mode 1360x768 --pos 0x0 --rotate normal
        break
    fi
    sleep 2 
done
