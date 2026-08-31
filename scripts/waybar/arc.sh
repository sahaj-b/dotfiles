#!/usr/bin/env bash
# Waybar module: shows an icon while the Intel Arc A350M is off the PCI bus.
#
#   arc.sh            -> waybar JSON (empty text while the card is present)
#   arc.sh present    -> exit 0 if the card is on the bus, 1 if it is not
#
# Primary source is `~/scripts/arc s`. That script re-executes itself under sudo,
# so headless polling only works with a NOPASSWD sudoers entry. Without one we
# fall back to scanning sysfs, which needs no root at all: the PCI `device`
# attribute files are world-readable (mode 444).

set -uo pipefail

ARC="$HOME/scripts/arc"
DEVID=0x5694 # Arc A350M (dg2); resolved by id because the BDF moves between boots
ICON=󰚦      # nf-md-power_plug_off

CARD=GONE
DRV=none
RULE="n/a (no root)"

detect() {
  local out d v
  if out=$(sudo -n "$ARC" s 2>/dev/null) && [[ -n $out ]]; then
    # one awk pass instead of three greps: card|driver|rule
    IFS='|' read -r CARD DRV RULE < <(
      awk -F': +' '/^card:/{c=$2} /^driver:/{d=$2} /^rule:/{r=$2} END{printf "%s|%s|%s", c, d, r}' <<<"$out"
    )
    return
  fi
  for d in /sys/bus/pci/devices/*; do
    [[ -r $d/device ]] || continue
    read -r v <"$d/device"
    [[ $v == "$DEVID" ]] || continue
    CARD=PRESENT
    [[ -L $d/driver ]] && DRV=$(basename "$(readlink "$d/driver")")
    break
  done
}

detect

if [[ ${1:-} == present ]]; then
  [[ $CARD == PRESENT ]]
  exit
fi

if [[ $CARD == PRESENT ]]; then
  # empty text + "hide-empty-text" in the waybar config collapses the widget
  printf '{"text":"","class":"on","tooltip":"Arc: PRESENT\\rdriver: %s\\rboot rule: %s"}\n' "$DRV" "$RULE"
else
  printf '{"text":"%s","class":"off","tooltip":"Arc: DISABLED (off the PCI bus)\\rdriver: %s\\rboot rule: %s\\rclick: rescan  |  right-click: re-check"}\n' "$ICON" "$DRV" "$RULE"
fi
