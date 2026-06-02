export const INSTALL_SYMBOL = Symbol("pi-qol.installed");
export const STATUS_KEY = "qol-attachments";
export const CONTEXT_USAGE_MESSAGE_TYPE = "qol-context-usage";

export const IMAGE_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".bmp",
	".tif",
	".tiff",
	".heic",
	".heif",
]);
export const IMAGE_PATH_PATTERN =
	/(^|[\s(\[{<"'`])(@?(?:~|\.\.?|\/)[^\s)\]}>"'`]+?\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif))(?=$|[\s)\]}>"'`,.;:!?])/gi;

export const THINKING_TIMER_STORE_SYMBOL = Symbol(
	"pi-qol.thinking-timer.store",
);
export const THINKING_TIMER_PATCH_KEY = "__pi-qol-timer-patched__";

export const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 8;
export const DEFAULT_NOTIFICATION_BODY_MAX_CHARS = 240;

export const DEFAULT_PERMISSION_GATE_COMMANDS = "rm -Rf";
export const DEFAULT_PERMISSION_GATE_PREVIEW_LINES = 12;
export const DEFAULT_PERMISSION_GATE_PREVIEW_CHARS = 1200;
export const DEFAULT_PERMISSION_GATE_PREVIEW_LINE_WIDTH = 120;

export const DEFAULT_AUTO_RENAME_NAME_CHARS = 80;

export const THINKING_LABEL_DEFAULT = "\ue28c ";

export const DEFAULT_SOUND_ENABLED = true;
export const DEFAULT_SUPPRESS_WHEN_FOCUSED = true;
export const DEFAULT_FOCUS_DETECTION_SCRIPT =
	"/home/sahaj/scripts/detect-pi-hyprland";
export const DEFAULT_TERM_INITIAL_TITLE = "";
export const DEFAULT_NOTIFICATION_TIMEOUT_SECONDS = 5;
export const DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED = true;
