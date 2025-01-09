#!/bin/bash
hyprctl dispatch exec '[workspace special:term silent] foot -a scratch -e tmux new-session -A -s "scratch"'
sleep 1
tmux send-keys -t scratch.1 "f" ENTER
