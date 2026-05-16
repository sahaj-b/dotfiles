local mocha = require("mocha")

hl.config({
  general = {
    gaps_in = 3,
    gaps_out = 0,
    border_size = 2,
    col = {
      active_border = { colors = { mocha.mauve, mocha.blue }, angle = 45 },
      inactive_border = "rgba(595959aa)",
    },
    layout = "dwindle",
    allow_tearing = false,
  },
  cursor = {
    inactive_timeout = 2,
    hotspot_padding = 0, -- fixes edge cursor clicking
  },
  binds = {
    allow_workspace_cycles = true,
  },

  decoration = {
    rounding = 10,
    blur = {
      enabled = true,
      size = 5,
      passes = 4,
      new_optimizations = true,
      xray = true,
      popups = true,
    },
    shadow = {
      enabled = true,
      range = 4,
      render_power = 3,
      color = 0xee1a1a1a,
    },
    dim_special = 0.2,
    inactive_opacity = 0.9,
  },

  dwindle = {
    preserve_split = true,
    force_split = 2,
  },

  animations = {
    enabled = true,
  },
})

-- Layer rules
hl.layer_rule({
  match = { namespace = "waybar" },
  blur = true,
  xray = true,
})

--- ANIMATIONS ---
-- https://wiki.hypr.land/Configuring/Advanced-and-Cool/Animations/

hl.curve("myBezier", { type = "bezier", points = { { 0.05, 0.9 }, { 0.1, 1.05 } } })

hl.animation({ leaf = "windows", enabled = true, speed = 3, bezier = "myBezier" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 3, bezier = "default", style = "popin 80%" })
hl.animation({ leaf = "border", enabled = true, speed = 3, bezier = "default" })
hl.animation({ leaf = "borderangle", enabled = true, speed = 3, bezier = "default" })
hl.animation({ leaf = "fade", enabled = true, speed = 3, bezier = "default" })
hl.animation({ leaf = "workspaces", enabled = true, speed = 2, bezier = "default" })
hl.animation({ leaf = "specialWorkspace", enabled = true, speed = 2, bezier = "default", style = "slidefadevert" })
