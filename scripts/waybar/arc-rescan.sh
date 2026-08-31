#!/usr/bin/env bash
# Click handler for the waybar Arc module: put the dGPU back on the PCI bus.
#
# Escalates with `sudo -n` when sudoers is NOPASSWD, otherwise falls back to
# pkexec, which pops the polkit agent. Either way the waybar module is refreshed
# once the rescan is over, so it disappears on success.

set -uo pipefail

ARC="$HOME/scripts/arc"
CHECK="$HOME/scripts/waybar/arc.sh"
SIGNAL=RTMIN+11 # matches "signal" in the custom/arc waybar config

if ! sudo -n "$ARC" rescan >/dev/null 2>&1 && ! pkexec "$ARC" rescan >/dev/null 2>&1; then
  notify-send -u critical -t 10000 -a waybar "Arc rescan aborted" \
    "Could not get root (sudo is not NOPASSWD and pkexec was denied or dismissed)."
  pkill "-$SIGNAL" waybar
  exit 1
fi

# the bridge rescan inside arc(1) sleeps 2s twice; give udev a moment to settle
sleep 1
if ! "$CHECK" present; then
  notify-send -u critical -t 10000 -a waybar "Arc rescan failed" \
    "The A350M is still off the PCI bus. Run 'sudo arc rescan' in a terminal."
fi

pkill "-$SIGNAL" waybar
