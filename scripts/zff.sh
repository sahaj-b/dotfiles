#!/usr/bin/env bash

# zf - A smart and fast file finder
# prioritizes vim oldfiles(uses snacks.picker frequency data if available) and files in zoxide dirs

# This script provides:
# 1. zff: A function to open a file in neovim (or xdg-open)
# 2. An inserter bound to Ctrl+T (in Bash) or a `zffi` function (for Zsh widgets).

# requirements: fzf, zoxide, fd
# to use zf, paste this into your .bashrc or .zshrc
# if [[ -f /path/to/zff.sh ]]; then
#   source /path/to/zff.sh
# fi

# real ones bind these functions to a keybind (using widget in zsh). My .zshrc has the sauce.

# to change/disable keybind for inserter in Bash, modify the BASH SETUP section below

# heads-up: I'm forcing an exact search by default. Just backspace the single quote if you wanna get fuzzy
# to change this behavior, remove the --query "'" from the fzf command below

_zff_selector() {
  # -------- CONFIG --------
  # PLEAAAASE use 1 byte chars for icons ,so no emojies (script too dumb to handle that shi)
  local oldfilesIcon='O'
  local zoxideIcon='Z'
  local cwdIcon='󰚡'
  local extraIcon=' '
  local zoxideDepth=3 # how deep to search in zoxide dirs
  local zoxideThreshold=0.5 # minimum score to consider a zoxide dir
  local cwdDepth=2 # how deep to search in cwd
  local openCmd='xdg-open'

  local extra_dirs=()

  local fd_ignores=(
    '**/.git/**' '**/node_modules/**' '**/.cache/**' '**/.venv/**' '**/.vscode/**' '**/.pycache__/**' '**/.DS_Store'
    '**/.idea/**' '**/.mypy_cache/**' '**/.pytest_cache/**' '**/.next/**' '**/dist/**' '**/build/**' '**/target/**' '**/.gradle/**'
    '**/.terraform/**' '**/.egg-info/**' '**/.env' '**/.history' '**/.svn/**' '**/.hg/**' '**/.Trash/**' '**/bin/**' '**/.bin/**'
    "**/.local/share/Trash/**" "**/.local/share/nvim/**" "**/pkg/**"
  )
  # ------------------------

  local previewCmd
  if command -v bat &>/dev/null; then
    previewCmd='bat "$(echo {3..} | sed "s/^..//" | sed "s|^~|'"$HOME"'|")"'
  else
    previewCmd='cat "$(echo {3..} | sed "s/^..//" | sed "s|^~|'"$HOME"'|")"'
  fi

  local fd_excludes=()
  for pat in "${fd_ignores[@]}"; do
    fd_excludes+=(--exclude "$pat")
  done

  {
    # Priority 0: (n)vim oldfiles
    get_oldfiles 

    # Priority 1: Zoxide dirs
    get_zoxide_files

    # Priority 2: CWD
    fd -t f -H -d $cwdDepth "${fd_excludes[@]}" . "$PWD" 2>/dev/null | sed "s/^/2\t0\t$cwdIcon /"

  } |
    sed -E "s|^([0-9]+\t[0-9]+\t.[^ ]* )$HOME|\1~|" |
    fzf --height 50% --layout reverse --info=inline \
      --scheme=path --tiebreak=index \
      --cycle --ansi --preview-window 'right:40%' \
      --delimiter='\t' --with-nth=3.. \
      --query "'" \
      --preview "$previewCmd" |
    cut -f3- -d$'\t' |
    sed 's/^..//' | # remove prefix
    sed "s|^~|$HOME|" # expand tilde
}

get_oldfiles() {
  # Snacks picker database with frecency priority (fast af)
  local snacks_db="$HOME/.local/share/nvim/snacks/picker-frecency.sqlite3"
  if command -v sqlite3 &>/dev/null && [[ -f "$snacks_db" ]]; then
    sqlite3 "$snacks_db" "SELECT key,value FROM data ORDER BY value DESC;" | \
    awk 'BEGIN{FS="|"} {printf "0\t%d\t%s\n", 999999999999-$2, $1}' # invert score for fzf
    return 0
  fi

  # Fallback: Headless Neovim (Slower)
  if command -v nvim >/dev/null 2>&1; then
    nvim --headless -c 'redir! >/dev/stdout | silent oldfiles | quit!' | \
    sed 's/^[ 0-9:]*//' | \
    awk '{printf "0\t%d\t%s\n", NR, $0}'
    return 0
  fi

  # Fallback: vim oldfiles (fast af)
  if [[ -f "$HOME/.viminfo" ]]; then
    sed -n 's/^> //p' "$HOME/.viminfo" 2>/dev/null | \
    awk '{printf "0\t%d\t%s\n", NR, $0}'
  fi
}

get_zoxide_files() {
  local zoxide_dirs
  zoxide_dirs=$(zoxide query --list --score 2>/dev/null)
  local filtered_dirs=()

  # filter by threshold
  while IFS=$'\t' read -r score path; do
    if (( $(echo "$score >= $zoxideThreshold" | bc -l 2>/dev/null) )); then
      filtered_dirs+=("$path")
    fi
  done <<< "$zoxide_dirs"

  if [[ ${#filtered_dirs[@]} -eq 0 ]]; then return 0; fi

  fd -t f -H -d $zoxideDepth "${fd_excludes[@]}" "${filtered_dirs[@]}" 2>/dev/null | \
    sed "s/^/1\t0\t$zoxideIcon /"
}

# main function (opener)
zff() {
  target_file=$(_zff_selector)
  $openCmd "$target_file"
}

# --- setup for the INSERTER ---
# ZSH
if [[ -n "$ZSH_VERSION" ]]; then
  zfi() {
    target_file=$(_zff_selector)
      # shellcheck disable=SC2296
      LBUFFER+="${(q)target_file} "
  }

# BASH setup
elif [[ -n "$BASH_VERSION" && $- == *i* ]]; then
  _zffi_bash_inserter() {
    local selected
    selected=$(_zff_selector < /dev/tty)

    if [[ -n "$selected" ]]; then
      local quoted_path
      quoted_path=$(printf %q "$selected")

      READLINE_LINE="${READLINE_LINE:0:$READLINE_POINT}${quoted_path} ${READLINE_LINE:$READLINE_POINT:}"
      ((READLINE_POINT += ${#quoted_path} + 1))
    fi
  }
  # Comment this line to disable the keybind, or change it to another key
  bind -x '"\C-t": _zffi_bash_inserter'
fi
