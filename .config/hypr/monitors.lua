-- https://wiki.hypr.land/Configuring/Basics/Monitors/

hl.monitor({
  output = "eDP-1",
  mode = "1920x1080",
  position = "auto",
  scale = 1.25,
})

hl.monitor({
  output = "HDMI-A-1",
  mode = "1920x1080@60",
  position = "1920x0",
  -- mode = "3840x2160@60@60",
  position = "0x0",
  scale = 1,
  mirror = "eDP-1",
})
