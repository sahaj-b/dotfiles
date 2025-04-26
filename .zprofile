# XDG User Directories
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_STATE_HOME="$HOME/.local/state"
export XDG_SCREENSHOTS_DIR="$HOME/Pictures/"
export XDG_PICTURES_DIR="$HOME/Pictures/"

# XDG System Directories
export XDG_DATA_DIRS="/usr/local/share:/usr/share"
export XDG_CONFIG_DIRS="/etc/xdg"
export ELECTRON_OZONE_PLATFORM_HINT=auto

# Bluetooth off when on battery
# if [[ $(cat /sys/class/power_supply/BAT0/status) == "Discharging" ]]; then 
#     bluetoothctl power off
# fi

