-- Swayimg config — keyboard-first, vim-panning when zoomed
-- Location: ~/.config/swayimg/init.lua
-- Reference: /usr/share/swayimg/swayimg.lua (full API)

swayimg.set_mode("viewer")
swayimg.enable_antialiasing(true)
swayimg.enable_exif_orientation(true)
swayimg.imagelist.set_order("numeric")
swayimg.imagelist.enable_adjacent(true)
swayimg.viewer.enable_loop(true)

swayimg.viewer.set_default_scale("optimal")
swayimg.viewer.set_default_position("center")
swayimg.viewer.set_drag_button("MouseLeft")
swayimg.viewer.enable_centering(true)
swayimg.viewer.limit_preload(2)
swayimg.viewer.limit_history(2)

-- Kill that annoying info overlay on startup
swayimg.text.hide()

-- ── Helpers ──────────────────────────────────────────────────────────

--- Returns true when the image is zoomed past the viewport bounds.
function is_zoomed()
  local img = swayimg.viewer.get_image()
  if not img then return false end
  local win = swayimg.get_window_size()
  local scale = swayimg.viewer.get_scale()
  return (img.width * scale > win.width) or (img.height * scale > win.height)
end

--- Pan the viewport by (dx, dy) pixels.
function pan(dx, dy)
  local p = swayimg.viewer.get_position()
  swayimg.viewer.set_abs_position(p.x + dx, p.y + dy)
end

-- ── Quit ─────────────────────────────────────────────────────────────

swayimg.viewer.on_key("Escape", function() swayimg.exit() end)
swayimg.viewer.on_key("q", function() swayimg.exit() end)

-- ── Navigation ───────────────────────────────────────────────────────

swayimg.viewer.on_key("n", function() swayimg.viewer.switch_image("next") end)
swayimg.viewer.on_key("p", function() swayimg.viewer.switch_image("prev") end)
swayimg.viewer.on_key("g", function() swayimg.viewer.switch_image("first") end)
swayimg.viewer.on_key("G", function() swayimg.viewer.switch_image("last") end)
swayimg.viewer.on_key("Left", function() swayimg.viewer.switch_image("prev") end)
swayimg.viewer.on_key("Right", function() swayimg.viewer.switch_image("next") end)

-- ── HJKL: pan when zoomed, h/l navigates when not ────────────────────

-- HJKL: big pan (fraction of window size)
swayimg.viewer.on_key("h", function()
  if is_zoomed() then
    local w = swayimg.get_window_size()
    pan(math.floor(w.width / 3), 0)
  else
    swayimg.viewer.switch_image("prev")
  end
end)
swayimg.viewer.on_key("l", function()
  if is_zoomed() then
    local w = swayimg.get_window_size()
    pan(-math.floor(w.width / 3), 0)
  else
    swayimg.viewer.switch_image("next")
  end
end)
swayimg.viewer.on_key("k", function()
  if is_zoomed() then
    local w = swayimg.get_window_size()
    pan(0, math.floor(w.height / 3))
  end
end)
swayimg.viewer.on_key("j", function()
  if is_zoomed() then
    local w = swayimg.get_window_size()
    pan(0, -math.floor(w.height / 3))
  end
end)

-- Shift+hjkl: fine pan (80px)
swayimg.viewer.on_key("Shift-h", function() pan(80, 0) end)
swayimg.viewer.on_key("Shift-l", function() pan(-80, 0) end)
swayimg.viewer.on_key("Shift-k", function() pan(0, 80) end)
swayimg.viewer.on_key("Shift-j", function() pan(0, -80) end)

-- ── Zoom ─────────────────────────────────────────────────────────────

swayimg.viewer.on_key("+", function()
  local s = swayimg.viewer.get_scale()
  swayimg.viewer.set_abs_scale(s * 1.25)
end)
swayimg.viewer.on_key("Ctrl-=", function()
  local s = swayimg.viewer.get_scale()
  swayimg.viewer.set_abs_scale(s * 1.25)
end)
swayimg.viewer.on_key("-", function()
  local s = swayimg.viewer.get_scale()
  swayimg.viewer.set_abs_scale(s / 1.25)
end)
swayimg.viewer.on_key("Ctrl-minus", function()
  local s = swayimg.viewer.get_scale()
  swayimg.viewer.set_abs_scale(s / 1.25)
end)
swayimg.viewer.on_key("0", function()
  swayimg.viewer.set_fix_scale("fit")
end)
swayimg.viewer.on_key("z", function()
  swayimg.viewer.set_fix_scale("real")
end)
swayimg.viewer.on_key("Space", function()
  swayimg.viewer.reset()
end)

-- ── Modes ────────────────────────────────────────────────────────────

swayimg.viewer.on_key("f", function()
  swayimg.set_fullscreen()
end)
swayimg.viewer.on_key("Return", function()
  swayimg.set_mode("gallery")
end)

-- ── Rotate & flip ────────────────────────────────────────────────────

swayimg.viewer.on_key("r", function() swayimg.viewer.rotate(90) end)
swayimg.viewer.on_key("R", function() swayimg.viewer.rotate(270) end)
swayimg.viewer.on_key("m", function() swayimg.viewer.flip_vertical() end)

-- ── Info overlay ─────────────────────────────────────────────────────

swayimg.viewer.on_key("i", function()
  local img = swayimg.viewer.get_image()
  local scale = swayimg.viewer.get_scale()
  swayimg.text.set_status(string.format(
    "%s  %dx%d  %d/%d  scale: %d%%",
    img and img.path or "?",
    img and img.width or 0,
    img and img.height or 0,
    img and img.index or 0,
    swayimg.imagelist.size(),
    math.floor(scale * 100)
  ))
end)

-- ── Gallery mode keybinds ────────────────────────────────────────────

swayimg.gallery.on_key("Escape", function() swayimg.exit() end)
swayimg.gallery.on_key("q", function() swayimg.exit() end)
swayimg.gallery.on_key("Return", function() swayimg.set_mode("viewer") end)
swayimg.gallery.on_key("h", function() swayimg.gallery.switch_image("left") end)
swayimg.gallery.on_key("l", function() swayimg.gallery.switch_image("right") end)
swayimg.gallery.on_key("k", function() swayimg.gallery.switch_image("up") end)
swayimg.gallery.on_key("j", function() swayimg.gallery.switch_image("down") end)
swayimg.gallery.on_key("g", function() swayimg.gallery.switch_image("first") end)
swayimg.gallery.on_key("G", function() swayimg.gallery.switch_image("last") end)
swayimg.gallery.on_key("f", function() swayimg.set_fullscreen() end)
