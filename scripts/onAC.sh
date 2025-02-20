#!/bin/env bash

# turn on auto-cpufrew
auto-cpufreq --live &
disown

# turn off tlp
systemctl stop tlp

# enable shadows and blur
hyprctl reload
