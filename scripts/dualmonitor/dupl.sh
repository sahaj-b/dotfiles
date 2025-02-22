#!/usr/bin/env bash

if [ "$y" -eq "0" ]; then
  xrandr --output eDP-1 --pos 1360x768
else
  xrandr --output eDP-1 --pos 0x0
fi

