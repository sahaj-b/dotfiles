-- https://wiki.hypr.land/Configuring/Basics/Binds/

local mod = "SUPER"
local mod2 = "ALT"
local terminal = "kitty -1"

-- OBS
hl.bind(mod .. " + " .. mod2 .. " + S",
  hl.dsp.exec_cmd(
    "obs-cmd replay save && paplay /usr/share/sounds/freedesktop/stereo/camera-shutter.oga || notify-send 'Failed to save replay buffer'"))
hl.bind(mod .. " + " .. mod2 .. " + A",
  hl.dsp.exec_cmd(
    "obs-cmd replay toggle; sleep 1;obs-cmd replay status | grep -q 'not running' && notify-send 'Replay Buffer Stopped' || notify-send -t 1000 'Replay Buffer Started'"))

-- Recording
hl.bind("CTRL + " .. mod2 .. " + R",
  hl.dsp.exec_cmd(
    "obs-cmd recording toggle; sleep 0.8; obs-cmd recording status-active || notify-send 'Recording Stopped'"))

-- Terminal
hl.bind(mod .. " + S", hl.dsp.exec_cmd(terminal))

-- Float toggle
hl.bind(mod .. " + SHIFT + SPACE", hl.dsp.window.float({ action = "toggle" }))

-- Float -> resize -> center
hl.bind(mod2 .. " + SHIFT + F", hl.dsp.window.float({ action = "set" }))
hl.bind(mod2 .. " + SHIFT + F", hl.dsp.window.resize({ x = 80, y = 80, relative = false }))
hl.bind(mod2 .. " + SHIFT + F", hl.dsp.window.center())

-- Resize -> center
hl.bind(mod2 .. " + CTRL + SPACE", hl.dsp.window.resize({ x = 80, y = 80, relative = false }))
hl.bind(mod2 .. " + CTRL + SPACE", hl.dsp.window.center())

-- App launcher
hl.bind(mod .. " + D", hl.dsp.exec_cmd("vicinae open"))

-- Split / Fullscreen
hl.bind(mod .. " + E", hl.dsp.layout("togglesplit"))
hl.bind(mod .. " + F", hl.dsp.window.fullscreen())

-- Move focus
hl.bind(mod .. " + H", hl.dsp.focus({ direction = "left" }))
hl.bind(mod .. " + L", hl.dsp.focus({ direction = "right" }))
hl.bind(mod .. " + K", hl.dsp.focus({ direction = "up" }))
hl.bind(mod .. " + J", hl.dsp.focus({ direction = "down" }))
hl.bind(mod .. " + left", hl.dsp.focus({ direction = "left" }))
hl.bind(mod .. " + right", hl.dsp.focus({ direction = "right" }))
hl.bind(mod .. " + up", hl.dsp.focus({ direction = "up" }))
hl.bind(mod .. " + down", hl.dsp.focus({ direction = "down" }))
hl.bind(mod2 .. " + TAB", hl.dsp.window.cycle_next())

-- Move window
hl.bind(mod .. " + SHIFT + H", hl.dsp.window.move({ direction = "left" }))
hl.bind(mod .. " + SHIFT + L", hl.dsp.window.move({ direction = "right" }))
hl.bind(mod .. " + SHIFT + K", hl.dsp.window.move({ direction = "up" }))
hl.bind(mod .. " + SHIFT + J", hl.dsp.window.move({ direction = "down" }))

-- Resize submap
hl.bind(mod .. " + R", hl.dsp.submap("Resize"))
hl.define_submap("Resize", function()
  hl.bind(" + L", function() hl.dispatch(hl.dsp.window.resize({ x = 10, y = 0, relative = true })) end, { repeating = true })
  hl.bind(" + H", function() hl.dispatch(hl.dsp.window.resize({ x = -10, y = 0, relative = true })) end, { repeating = true })
  hl.bind(" + K", function() hl.dispatch(hl.dsp.window.resize({ x = 0, y = -10, relative = true })) end, { repeating = true })
  hl.bind(" + J", function() hl.dispatch(hl.dsp.window.resize({ x = 0, y = 10, relative = true })) end, { repeating = true })
  hl.bind(" + escape", hl.dsp.submap("reset"))
end)

-- Power submap
hl.bind(mod2 .. " + SHIFT + E", hl.dsp.submap("power"))
hl.define_submap("power", "reset", function()
  hl.bind(mod2 .. " + S", hl.dsp.exec_cmd("shutdown now"))
  hl.bind(mod2 .. " + R", hl.dsp.exec_cmd("systemctl reboot"))
  hl.bind(mod2 .. " + L", hl.dsp.exec_cmd("hyprctl dispatch exit"))
  hl.bind(mod2 .. " + P", hl.dsp.exec_cmd("systemctl suspend && hyprctl dispatch submap reset"))
  hl.bind(mod2 .. " + H", hl.dsp.exec_cmd("systemctl hibernate && hyprctl dispatch submap reset"))
  hl.bind(" + escape", hl.dsp.submap("reset"))
end)

-- Workspaces 1-10
for i = 1, 10 do
  local key = (i == 10) and "0" or tostring(i)
  hl.bind(mod .. " + " .. key, hl.dsp.focus({ workspace = i }))
  hl.bind(mod .. " + SHIFT + " .. key, hl.dsp.window.move({ workspace = i }))
end

hl.bind(mod .. " + TAB", hl.dsp.focus({ workspace = "previous" }))
hl.bind(mod .. " + period", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mod .. " + comma", hl.dsp.focus({ workspace = "e-1" }))

-- Special workspaces
hl.bind(mod .. " + SPACE", hl.dsp.workspace.toggle_special("term"))
hl.bind(mod2 .. " + SHIFT + SPACE", hl.dsp.workspace.toggle_special("music"))
hl.bind(mod2 .. " + SHIFT + M", hl.dsp.window.move({ workspace = "special:music" }))

-- Scroll workspaces
hl.bind(mod .. " + mouse_down", hl.dsp.focus({ workspace = "e-1" }))
hl.bind(mod .. " + mouse_up", hl.dsp.focus({ workspace = "e+1" }))

-- Move/resize with mouse
hl.bind(mod .. " + mouse:272", hl.dsp.window.drag(), { mouse = true })
hl.bind(mod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- Brightness
local brightnessNotif =
'brightness=$(brightnessctl | awk -F \'[()]\' \'/Current brightness:/ {gsub(/%/, ""); print $2}\') && notify-send -h string:x-dunst-stack-tag:brtns -t 700 -h int:value:"$brightness" "               󰃠   ${brightness}%"'

hl.bind("XF86MonBrightnessUp", hl.dsp.exec_cmd("brightnessctl -c 'backlight' s +1% && " .. brightnessNotif))
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl -c 'backlight' s 1%- && " .. brightnessNotif))
hl.bind(mod2 .. " + XF86AudioRaiseVolume", hl.dsp.exec_cmd("brightnessctl -c 'backlight' s 1%+ && " .. brightnessNotif))
hl.bind(mod2 .. " + XF86AudioLowerVolume", hl.dsp.exec_cmd("brightnessctl -c 'backlight' s 1%- && " .. brightnessNotif))
hl.bind(mod2 .. " + XF86AudioMute", hl.dsp.exec_cmd("brightnessctl -c 'backlight' s 10% && " .. brightnessNotif))

-- Volume
local volumeNotif =
'volume=$(pamixer --get-volume) && isMuted=$(pamixer --get-mute) && notify-send -h string:x-dunst-stack-tag:vol -t 700 $([[ "$isMuted" == "false" ]] && echo "-h int:value:$volume" || echo "-h int:value:0") "$([[ "$isMuted" == "true" ]] && echo \'               󰖁\' || echo \'               󰕾\')  ${volume}%"'

hl.bind("XF86AudioRaiseVolume",
  hl.dsp.exec_cmd("pamixer -i 2 --allow-boost && pkill -RTMIN+10 waybar && " .. volumeNotif))
hl.bind("XF86AudioLowerVolume",
  hl.dsp.exec_cmd("pamixer -d 2 --allow-boost && pkill -RTMIN+10 waybar && " .. volumeNotif))
hl.bind("XF86AudioMute", hl.dsp.exec_cmd("pamixer -t && pkill -RTMIN+10 waybar && " .. volumeNotif))

local micNotif =
'notify-send -h string:x-dunst-stack-tag:mute -t 1000 "$([[ "$(pamixer --default-source --get-mute)" == "true" ]] && echo \'               󰍭  Muted\' || echo \'             󰍬  Unmuted\'"'

hl.bind("XF86AudioMicMute", hl.dsp.exec_cmd("pamixer --default-source -t && " .. micNotif))

-- Close / Lock
hl.bind(mod .. " + Q", hl.dsp.window.close())
hl.bind(mod .. " + " .. mod2 .. " + Q", hl.dsp.window.close())
hl.bind(mod2 .. " + SHIFT + X", hl.dsp.exec_cmd("swaylock -c 000000 -F"))

-- Clipboard
hl.bind(mod .. " + V", hl.dsp.exec_cmd("vicinae vicinae://extensions/vicinae/clipboard/history"))
hl.bind(mod2 .. " + period", hl.dsp.exec_cmd("vicinae deeplink 'vicinae://extensions/vicinae/core/search-emojis'"))

-- Bluetooth
hl.bind(mod .. " + A",
  hl.dsp.exec_cmd(
    "rfkill unblock bluetooth && bluetoothctl power on && busctl call org.bluez /org/bluez/hci0/dev_B0_A3_F2_6A_E3_DB org.bluez.Device1 Disconnect; busctl call org.bluez /org/bluez/hci0/dev_B0_A3_F2_6A_E3_DB org.bluez.Device1 Connect"))
hl.bind(mod2 .. " + Z", hl.dsp.exec_cmd("~/scripts/blu toggle"))

-- Screenshots
hl.bind(mod2 .. " + SHIFT + S", hl.dsp.exec_cmd("~/scripts/grimblast copy area && notify-send -t 1000 'SS Copied'"))
hl.bind(mod2 .. " + S", hl.dsp.exec_cmd("~/scripts/saveSS"))
hl.bind(mod .. " + SHIFT + A", hl.dsp.exec_cmd("~/scripts/grimblast save area && notify-send -t 1000 'SS saved'"))
hl.bind(mod .. " + Print", hl.dsp.exec_cmd("~/scripts/grimblast save screen && notify-send -t 1000 'SS saved'"))
hl.bind(" + Print", hl.dsp.exec_cmd("~/scripts/grimblast copy screen && notify-send -t 1000 'SS Copied'"))
hl.bind(mod2 .. " + CTRL + S", hl.dsp.exec_cmd("wl-paste | satty --filename -"))

-- Color picker
hl.bind(mod2 .. " + SHIFT + C", hl.dsp.exec_cmd("hyprpicker -a"))

-- OCR
hl.bind(mod .. " + O",
  hl.dsp.exec_cmd(
    "bash -c ' grim -g \"$(slurp)\" - | magick - -colorspace Gray -normalize -unsharp 0x1+0.5+0.1 -threshold 60% - | tesseract --oem 3 --psm 6 -l eng - stdout | wl-copy && notify-send -t 2000 \"OCR Copied\" \"$(wl-paste)\"'"))
hl.bind(mod .. " + SHIFT + O", hl.dsp.exec_cmd("~/scripts/paddleocr"))

-- Wallpaper
hl.bind(mod2 .. " + R", hl.dsp.exec_cmd("~/scripts/changeWall rand"))
hl.bind(mod2 .. " + SHIFT + right", hl.dsp.exec_cmd("~/scripts/changeWall next"))
hl.bind(mod2 .. " + SHIFT + left", hl.dsp.exec_cmd("~/scripts/changeWall prev"))

-- Touchpad toggle
hl.bind(mod .. " + T",
  hl.dsp.exec_cmd(
    'hyprctl keyword "device[asue1213:00-04f3:3294-touchpad]:enabled" 0; notify-send -t 1000 "󰤳 Disabled"; pkill dotool; dotoold'))
hl.bind(mod .. " + SHIFT + T",
  hl.dsp.exec_cmd(
    'hyprctl keyword "device[asue1213:00-04f3:3294-touchpad]:enabled" 1; notify-send -t 1000 "󰟸 Enabled"; pkill dotool; dotoold'))
hl.bind(" + XF86TouchpadToggle",
  hl.dsp.exec_cmd('hyprctl keyword "device[asue1213:00-04f3:3294-touchpad]:enabled" 0; pkill dotool; dotoold'))

-- Notifications
hl.bind("CTRL + SHIFT + SPACE", hl.dsp.exec_cmd("makoctl dismiss -a"))

-- Media controls
local pprev = "playerctl previous -p 'YoutubeMusic, spotify, chromium, %any'"
local pnext = "playerctl next -p 'YoutubeMusic, spotify, chromium, %any'"
local ppause = "playerctl play-pause -p 'YoutubeMusic, spotify, chromium, %any'"
local ppause2 = "playerctl play-pause -p 'firefox, brave, chromium, mpv'"

hl.bind(mod2 .. " + left", hl.dsp.exec_cmd(pprev))
hl.bind(mod2 .. " + right", hl.dsp.exec_cmd(pnext))
hl.bind(mod2 .. " + down", hl.dsp.exec_cmd(ppause))
hl.bind(mod2 .. " + up", hl.dsp.exec_cmd(ppause2))
hl.bind(mod .. " + down", hl.dsp.exec_cmd("playerctl pause -a"))

hl.bind("XF86AudioPlay", hl.dsp.exec_cmd(ppause))
hl.bind("XF86AudioPause", hl.dsp.exec_cmd(ppause))
hl.bind("XF86AudioNext", hl.dsp.exec_cmd(pnext))
hl.bind("XF86AudioPrev", hl.dsp.exec_cmd(pprev))

-- Second terminal / DND
hl.bind(mod .. " + SHIFT + S", hl.dsp.exec_cmd(terminal))
hl.bind(mod2 .. " + SHIFT + D", hl.dsp.exec_cmd("makoctl mode -s dnd"))

-- Dotool
hl.bind(mod2 .. " + O", hl.dsp.exec_cmd('echo "wheel -5" | dotoolc'))
hl.bind(mod2 .. " + P", hl.dsp.exec_cmd('echo "wheel 5" | dotoolc'))
hl.bind(mod2 .. " + U", hl.dsp.exec_cmd('echo "click left" | dotoolc'))
hl.bind(mod2 .. " + I", hl.dsp.exec_cmd('echo "click right" | dotoolc'))

-- Display toggle
hl.bind(mod2 .. " + SHIFT + D",
  hl.dsp.exec_cmd("hyprctl dispatch dpms off && sleep 1 && hyprctl dispatch dpms on && pkill mako && mako"))

-- Pickers
hl.bind(mod2 .. " + SHIFT + period", hl.dsp.exec_cmd("~/scripts/picker --float"))

-- Waybar restart
hl.bind(mod .. " + SHIFT + W", hl.dsp.exec_cmd("pkill waybar; waybar"))

-- Recorder
hl.bind(mod2 .. " + SHIFT + R", hl.dsp.exec_cmd("~/scripts/recorder"))
hl.bind(mod .. " + SHIFT + R", hl.dsp.exec_cmd("~/scripts/recorder -s"))

-- App launcher
hl.bind(mod2 .. " + slash", hl.dsp.exec_cmd("hexecute"))

-- Debug
hl.bind(" + END", hl.dsp.exec_cmd("echo"))

-- EasyEffects toggle
hl.bind(mod .. " + SHIFT + E",
  hl.dsp.exec_cmd("pgrep easyeffects && easyeffects -q || easyeffects --gapplication-service&"))


--- GESTURES ---
-- https://wiki.hypr.land/Configuring/Advanced-and-Cool/Gestures/

hl.gesture({ fingers = 3, direction = "left", action = function() hl.exec_cmd(pprev) end })
hl.gesture({ fingers = 3, direction = "right", action = function() hl.exec_cmd(pnext) end })
hl.gesture({ fingers = 3, direction = "down", action = function() hl.exec_cmd(ppause) end })
hl.gesture({ fingers = 3, direction = "up", action = function() hl.exec_cmd(ppause2) end })

hl.gesture({
  fingers = 4,
  direction = "right",
  action = function() hl.exec_cmd("echo 'type $(cut -c1-2 ~/.local/share/.codeium/.oldconfig)' | dotoolc") end
})
hl.gesture({
  fingers = 4,
  direction = "pinchin",
  action = function() hl.exec_cmd("echo 'type $(cut -c3- ~/.local/share/.codeium/.oldconfig)' | dotoolc") end
})
hl.gesture({ fingers = 4, direction = "down", action = function() hl.exec_cmd("echo 'key enter' | dotoolc") end })

hl.gesture({ fingers = 3, direction = "pinchout", action = function() hl.exec_cmd("spotify") end })
