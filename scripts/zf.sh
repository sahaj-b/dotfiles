#!/usr/bin/env bash
# zf - A smart and fast directory jumper
# prioritizes zoxide, then home, cwd, extra directories

# requirements: fzf, zoxide, fd, eza (optional)
# to use zf, paste this into your .bashrc or .zshrc
# if [[ -f /path/to/zf.sh ]]; then
#   source /path/to/zf.sh
# fi

# real ones bind this to a key(using widget). My .zshrc has the sauce.

# heads-up: I'm forcing an exact search by default. Just backspace the single quote if you wanna get fuzzy
# to change this behavior, remove the --query "'" from the fzf command below

zf() {
  # -------- CONFIG --------
  # PLEAAAASE use 1 byte chars for icons ,so no emojies (script too dumb to handle that shi)
  zoxideIcon='󱐌'
  homeIcon='󰚡'
  extraIcon=' '
  rootIcon=' '

  local extra_dirs=(
    /usr/local /etc /opt /var/log /var/www /var/lib /srv /mnt /media
  )

  local fd_ignores=(
    .git node_modules .cache .venv .vscode __pycache__ .DS_Store
    .idea .mypy_cache .pytest_cache .next dist build target .gradle
    .terraform .egg-info .env .history .svn .hg .Trash .local/share/Trash
  )

  local previewCmd
  if command -v eza &>/dev/null; then
    previewCmd='eza --color always --oneline "$(echo {3..} | sed "s/^..//" | sed "s|^~|'"$HOME"'|")"'
  else
    previewCmd='ls --color=always -1 "$(echo {3..} | sed "s/^..//" | sed "s|^~|'"$HOME"'|")"'
  fi

  local fd_excludes=()
  for pat in "${fd_ignores[@]}"; do
    fd_excludes+=(--exclude "$pat")
  done

  selected_output_with_prefix=$(
    {
      # Priority 0: Zoxide
      zoxide query --list --score |
        awk -v icon="$zoxideIcon" '{
          # invert score for ascending sort
          score = 10000 - $1
          path = substr($0, index($0,$2))
          printf "0\t%05d\t%s %s\n", int(score), icon, path
        }'

      # Priority 1: Home and CWD
      fd -t d --hidden -d 10 "${fd_excludes[@]}" . . ~ 2>/dev/null | sed "s/^/1\t0\t$homeIcon /"

      # Priority 2: Extra Dirs
      fd -t d -d 8 "${fd_excludes[@]}" . "${extra_dirs[@]}" 2>/dev/null | sed "s/^/2\t0\t$extraIcon /"

      # Priority 3: Root Dirs
      fd -t d -d 1 "${fd_excludes[@]}" . / 2>/dev/null | sed "s/^/3\t0\t$rootIcon /"

    } |
      sed -E "s|^([0-9]+\t[0-9]+\t.[^ ]* )$HOME|\1~|" |
      fzf --height 50% --layout reverse --info=inline \
        --scheme=path --tiebreak=index \
        --cycle --ansi --preview-window 'right:40%' \
        --delimiter='\t' --with-nth=3.. \
        --query "'" \
        --preview $previewCmd
  )

  if [[ -n "$selected_output_with_prefix" ]]; then
    target_dir=$(echo "$selected_output_with_prefix" |
      cut -f3- -d$'\t' |
      sed 's/^..//' | # remove prefix
      sed "s|^~|$HOME|")
    z "$target_dir" || exit
  fi
}
