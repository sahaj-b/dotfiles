--- WINDOW RULES ---
-- https://wiki.hypr.land/Configuring/Basics/Window-Rules/

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

-- Scratch workspace
hl.window_rule({ match = { class = "^scratch$" }, workspace = "special:term" })

-- Music workspace
hl.window_rule({ match = { class = "^com.github.th_ch.youtube_music$" }, workspace = "special:music" })

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
hl.window_rule({ match = { title = "^termfilechooser$" }, size = "85% monitor_w 85% monitor_h" })

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
