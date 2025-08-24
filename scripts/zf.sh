#!/usr/bin/env bash

# zf - A smart and fast directory jumper
# prioritizes zoxide, then home, cwd, extra directories

# This script provides:
# 1. zf: A function to jump to a directory.
# 2. An inserter bound to Ctrl+T (in Bash) or a `zfi` function (for Zsh widgets).

# requirements: fzf, zoxide, fd, eza (optional)
# to use zf, paste this into your .bashrc or .zshrc
# if [[ -f /path/to/zf.sh ]]; then
#   source /path/to/zf.sh
# fi

# real ones bind these functoins to a single keybind (using hybrid widget in zsh). My .zshrc has the sauce.

# to change/disable keybind for inserter in Bash, modify the BASH SETUP section below

_zf_selector() {
  # -------- CONFIG --------
  # PLEAAAASE use 1 byte chars for icons ,so no emojies (script too dumb to handle that shi)
  local zoxideIcon='󱐌'
  local homeIcon='󰚡'
  local extraIcon=' '
  local rootIcon=' '

  local extra_dirs=(
    /usr/local /etc /opt /var/log /var/www /var/lib /srv /mnt /media
  )

  local fd_ignores=(
    '**/.git/**' '**/node_modules/**' '**/.cache/**' '**/.venv/**' '**/.vscode/**' '**/.pycache__/**' '**/.DS_Store'
    '**/.idea/**' '**/.mypy_cache/**' '**/.pytest_cache/**' '**/.next/**' '**/dist/**' '**/build/**' '**/target/**' '**/.gradle/**'
    '**/.terraform/**' '**/.egg-info/**' '**/.env' '**/.history' '**/.svn/**' '**/.hg/**' '**/.Trash/**'
    "**/.local/share/Trash/**" "**/.local/share/nvim/**"
  )
  # ------------------------

local previewCmd
  local path_extractor="cut -d' ' -f2- | sed 's|^~|$HOME|'"
  if command -v eza &>/dev/null; then
    previewCmd="eza --color=always --oneline \$(echo {} | $path_extractor)"
  else
    previewCmd="ls --color=always -1 \$(echo {} | $path_extractor)"
  fi

  local fd_excludes=()
  for pat in "${fd_ignores[@]}"; do
    fd_excludes+=(--exclude "$pat")
  done

{
    # Priority 0: Zoxide (already sorted by frecency)
    zoxide query -l | sed "s/^/$zoxideIcon /"

    # Priority 1: Home and CWD
    fd -t d -H -d 10 "${fd_excludes[@]}" . ~ 2>/dev/null | sed "s/^/$homeIcon /"

    # Priority 2: Extra Dirs
    fd -t d -d 8 "${fd_excludes[@]}" "${extra_dirs[@]}" 2>/dev/null | sed "s/^/$extraIcon /"

    # Priority 3: Root Dirs
    fd -t d -d 1 "${fd_excludes[@]}" / 2>/dev/null | sed "s/^/$rootIcon /"

  } | sed "s|$HOME|~|" |
    fzf --height 50% --layout reverse --info=inline \
      --scheme=path --tiebreak=index \
      --cycle --ansi --preview-window 'right:40%' \
      --preview "$previewCmd" |
    cut -d' ' -f2- |    # cut icon
    sed "s|^~|$HOME|"   # expand tilde

}

# function for JUMPING
zf() {
  local target_dir
  target_dir=$(_zf_selector)
  if [[ -n "$target_dir" ]]; then
    z "$target_dir"
  fi
}

# --- setup for the INSERTER ---
# ZSH
if [[ -n "$ZSH_VERSION" ]]; then
  zfi() {
    local target_dir
    target_dir=$(_zf_selector)
    if [[ -n "$target_dir" ]]; then
      # shellcheck disable=SC2296
      LBUFFER+="${(q)target_dir} "
    fi
  }

# BASH setup
elif [[ -n "$BASH_VERSION" && $- == *i* ]]; then
  _zfi_bash_inserter() {
    local selected
    selected=$(_zf_selector < /dev/tty)

    if [[ -n "$selected" ]]; then
      local quoted_path
      quoted_path=$(printf %q "$selected")

      READLINE_LINE="${READLINE_LINE:0:$READLINE_POINT}${quoted_path} ${READLINE_LINE:$READLINE_POINT:}"
      ((READLINE_POINT += ${#quoted_path} + 1))
    fi
  }
  # Comment this line to disable the keybind, or change it to another key
  bind -x '"\C-t": _zfi_bash_inserter'
fi
