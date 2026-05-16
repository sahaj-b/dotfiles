-- https://wiki.hypr.land/Configuring/Advanced-and-Cool/Environment-variables/

hl.env("TERMINAL", "kitty")
hl.env("XCURSOR_SIZE", "24")

hl.env("GDK_SCALE", "1.25")
hl.env("GTK_THEME", "catppuccin-mocha-blue-standard+default")
hl.env("GDK_BACKEND", "wayland,x11,*")

hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")
hl.env("QT_QPA_PLATFORM", "wayland;xcb")
hl.env("QT_WAYLAND_DISABLE_WINDOWDECORATION", "1")
hl.env("QT_AUTO_SCREEN_SCALE_FACTOR", "1")


hl.env("QT_QPA_PLATFORM", "wayland;xcb")
hl.env("SDL_VIDEODRIVER", "wayland")
hl.env("CLUTTER_BACKEND", "wayland")

hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_TYPE", "wayland")
hl.env("XDG_SESSION_DESKTOP", "Hyprland")

hl.env("WLR_DRM_DEVICES", "/dev/dri/card1")
hl.env("__GLX_VENDOR_LIBRARY_NAME", "mesa")
