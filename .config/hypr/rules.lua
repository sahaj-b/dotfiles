--- WINDOW RULES ---
-- https://wiki.hypr.land/Configuring/Basics/Window-Rules/

-- disable sleeping on fullscreen apps
hl.window_rule({ match = { class = ".*" }, idle_inhibit = "fullscreen" })

-- Suppress maximize
hl.window_rule({
  name = "suppress-maximize",
  match = { class = ".*" },
  suppress_event = "maximize",
})

-- Float rules
hl.window_rule({
  match = { workspace = "w[tv1]", fullscreen = false, float = false, class = "^zen$" },
  decorate = false,
})

hl.window_rule({ match = { class = "^float$" }, float = true })
hl.window_rule({ match = { title = "^Open File$" }, float = true })
hl.window_rule({ match = { title = "^Open Files$" }, float = true })
hl.window_rule({ match = { title = "^Open$" }, float = true })
hl.window_rule({ match = { title = "^Save File$" }, float = true })
hl.window_rule({ match = { title = "^Save$" }, float = true })
hl.window_rule({ match = { title = ".*wants to.*" }, float = true })
hl.window_rule({ match = { title = "^Qml Runtime$" }, float = true })
hl.window_rule({ match = { title = "^qmlscene$" }, float = true })
hl.window_rule({ match = { title = ".*Sign.*" }, float = true })
hl.window_rule({ match = { class = "^yad$" }, float = true })

-- Picker float rules (class + title based, works with kitty -1)
hl.window_rule({ match = { class = "^picker$", title = "picker-wide$" }, float = true, center = true, size = { "(monitor_w*0.60)", "(monitor_h*0.70)" } })
hl.window_rule({ match = { class = "^picker$", title = "picker-tall$" }, float = true, center = true, size = { "(monitor_w*0.40)", "(monitor_h*0.80)" } })
hl.window_rule({ match = { class = "^picker$", title = "picker-small$" }, float = true, center = true, size = { "(monitor_w*0.30)", "(monitor_h*0.25)" } })

-- Scratch workspace
hl.window_rule({ match = { class = "^scratch$" }, workspace = "special:term" })

-- Music workspace
hl.window_rule({ match = { class = "^com.github.th-ch.youtube-music$" }, workspace = "special:music silent" })
hl.window_rule({ match = { class = "mpv" }, workspace = "special:music silent" })

-- Rhythm Doctor: kill blur+border+dimming on the windows (floating ones have empty class, so match title).
-- NOTE: NO `opacity 1 override` here on purpose - that would force the main game window opaque and
-- defeat the auto-hide below. The dance sub-windows get their own opacity rule further down.
hl.window_rule({ match = { title = "^Rhythm Doctor$" }, no_blur = true, border_size = 0, no_shadow = true, no_dim = true })

-- Keep the dance sub-windows (empty class, ignore input) fully opaque (unfocused windows get
-- inactive_opacity=0.9 dimming otherwise), never auto-focused on open, and never focused on
-- mouse-hover (no_follow_mouse) so the keyboard stays on the main game window and space works
-- even while windows dance around the cursor.
hl.window_rule({
  match = { class = "^$", title = "^Rhythm Doctor$" },
  no_focus = true,
  no_follow_mouse = true,
  opacity = "1 override 1 override 1 override",
})

-- Rhythm Doctor window-dance auto-hide:
-- - main window has class "rhythm doctor.exe" and is opaque (Hyprland XWayland ignores the Wine
--   transparency the plugin sets), so it covers the game during dance.
-- - dance sub-windows have class "" (empty).
-- Whenever a dance sub-window exists, set the main window opacity to 0 (invisible but still alive
-- so it keeps receiving game input); when the last one is destroyed, restore opacity to 1.
local RD_MAIN = "class:rhythm doctor\\.exe" -- full-match regex of the main (Unity) window class.
-- dance sub-windows have class "".
local rdDanceCount = 0

local function rdIsDanceWindow(win)
  return win ~= nil and win.class == "" and (win.title or ""):find("Rhythm Doctor", 1, true) ~= nil
end

local function rdFocusMain()
  local win = hl.get_window(RD_MAIN)
  if win then hl.dispatch(hl.dsp.focus({ window = win })) end
end

local function rdSetMainOpacity(value)
  local win = hl.get_window(RD_MAIN)
  if win then
    hl.dispatch(hl.dsp.window.set_prop({ window = win, prop = "opacity", value = value }))
  end
end

local function rdRefresh()
  local count = 0
  for _, win in ipairs(hl.get_windows()) do
    if rdIsDanceWindow(win) then count = count + 1 end
  end
  rdDanceCount = count
  rdSetMainOpacity(count > 0 and 0 or 1)
  if count > 0 then rdFocusMain() end
end

hl.on("window.open", function(win)
  if rdIsDanceWindow(win) then
    rdDanceCount = rdDanceCount + 1
    rdSetMainOpacity(0)
    rdFocusMain()
  end
end)

hl.on("window.destroy", function(win)
  if rdIsDanceWindow(win) then
    if rdDanceCount > 0 then rdDanceCount = rdDanceCount - 1 end
    if rdDanceCount == 0 then rdSetMainOpacity(1) end
  end
end)

rdRefresh()

-- FL Studio window rules (toggled by startFL-wayland)
--hl.window_rule({ match = { class = "^fl64.exe$", title = "^()$" }, move = { "cursor_x", "cursor_y" } }) -- fl-toggle
--hl.window_rule({ match = { class = "^fl64.exe$" }, float = true }) -- fl-toggle

-- fl64.exe
-- hl.window_rule({ match = { class = "^fl64.exe$", title = "^()$" }, no_focus = true })
-- hl.window_rule({
--   name = "ghost_fl64",
--   match = { class = "^fl64.exe$", title = "^()$" },
--   float = true,
--   no_initial_focus = true,
--   no_focus = true,
--   suppress_event = "activate activatefocus",
--   no_anim = true,
--   no_blur = true,
--   no_shadow = true,
--   opacity = "0 override 0 override 0 override",
-- })

-- REAPER About window
hl.window_rule({
  name = "ghost_about_reaper",
  match = { class = "^REAPER$", title = "About REAPER.*" },
  float = true,
  no_initial_focus = true,
  no_focus = true,
  suppress_event = "activate activatefocus",
  no_anim = true,
  no_blur = true,
  no_shadow = true,
  opacity = "0 override 0 override 0 override",
})

-- Termfilechooser
hl.window_rule({ match = { title = "^termfilechooser$" }, float = true })
hl.window_rule({ match = { title = "^termfilechooser$" }, center = true })
hl.window_rule({ match = { title = "^termfilechooser$" }, size = { "(monitor_w*0.85)", "(monitor_h*0.85)" } })

-- Layer rules
hl.layer_rule({ match = { namespace = "vicinae" }, ignore_alpha = 0 })
hl.layer_rule({ match = { namespace = "vicinae" }, no_anim = true })


--- WORKSPACE RULES ---
-- https://wiki.hypr.land/Configuring/Basics/Workspace-Rules/

hl.workspace_rule({
  workspace = "s[true]",
  gaps_in = 3,
  gaps_out = { top = 78, left = 150, bottom = 77, right = 150 },
})
