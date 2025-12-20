# duck-radar.yazi

A [Yazi](https://github.com/sxyazi/yazi) plugin for quickly finding and copying/moving recently modified files to your current directory.

Duck Radar scans your common directories (Downloads, Documents, Desktop) for files modified in the last 7 days and presents them in an interactive fzf picker with syntax-highlighted previews. Perfect for grabbing that file you just downloaded or worked on without navigating through folders.

## Requirements

- `fzf` - Interactive fuzzy finder
- `bat` - Syntax highlighting for file previews (optional but recommended)

Install on most systems:

**macOS**

```bash
brew install fzf bat
```

**Arch Linux**

```bash
sudo pacman -S fzf bat
```

**Ubuntu/Debian**

```bash
sudo apt install fzf bat
```

## Installation

```bash
ya pack add nsavvide/duck-radar
```

Or manually: place the plugin directory at `~/.config/yazi/plugins/duck-radar.yazi/`

## Usage

Add a keybinding to your `keymap.toml`:

```toml
[[manager.prepend_keymap]]
on = "<C-r>" # or your preferred key
run = "plugin duck-radar"
desc = "🦆 Duck Radar - Recent Files"
```

## Features

- **Smart Search**: Finds files modified in the last 7 days across Downloads, Documents, Desktop
- **Fast Performance**: Limited depth (3 levels) and top 200 results for instant response
- **Copy or Move**: Press `Enter` to copy files, `Ctrl-X` to move them
- **Multi-Select**: Use `Tab` to select multiple files
- **Rich Preview**: Syntax-highlighted file contents with bat
- **Intelligent Filtering**: Automatically excludes `.git`, `node_modules`, cache directories.

## Keybindings

Inside the fzf picker:

- `j/k` or `↑/↓` - Navigate
- `Tab` - Multi-select files
- `Enter` - **Copy** selected files to current directory
- `Ctrl-X` - **Move** selected files to current directory
- `Ctrl-D/U` - Scroll preview down/up
- `Esc` or `Ctrl-C` - Cancel

## Configuration

You can customize the search by editing the plugin's `entry()` function in `main.lua`:

```lua
-- Change time range (days)
"-mtime -7 " .. -- Change to -3 for last 3 days, -30 for last month

-- Change max depth
"-maxdepth 3 " .. -- Change to 2 for faster, 4 for deeper search

-- Change result limit
"| head -200 " .. -- Change to 50 or 500 as needed

-- Add more directories to search
local cmd = "find '" .. home .. "/Downloads' " ..
"'" .. home .. "/Projects' " .. -- Add your custom paths
```

## Acknowledgements

- [Yazi](https://github.com/sxyazi/yazi) - The blazing fast terminal file manager 🦆
- [fzf](https://github.com/junegunn/fzf) - Command-line fuzzy finder
- [fr.yazi](https://github.com/yazi-rs/plugins/tree/main/fr.yazi) - Inspiration for the fzf integration pattern

## License

MIT

---

**Duck Radar** - Your recent files are always within reach 🦆✨
