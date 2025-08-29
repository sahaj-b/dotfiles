# Neovim Dotfiles

Highly opinionated neovim configuration built for raw speed and efficiency, leveraging lazy loading and AI tools
Primarily tailored for Web Development, Systems Programming and Markdown editing.

### Custom Scripts
  - `lua/close-fold-level.lua`: Closes specific depth folds, mapped to `z2` through `z9`.
  - `lua/fold-navigate.lua`: Jumps to next/previous closed fold, mapped to `]z` and `[z`.
  - `lua/rest-nvim-extract.lua`: Extracts `rest.nvim` requests to `curl` commands.
  - `lua/remap.lua`: Contains custom functions like `ToggleCheckbox` for markdown checklists and `ToggleDiagnostics` for filtering LSP warnings.
  - `lua/plugins/codecompanion/model_picker.lua`: A picker using `snacks.picker` for picking copilot models with request multipiers
