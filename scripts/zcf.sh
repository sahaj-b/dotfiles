#!/usr/bin/env bash

# like zff, but only for CWD files

# ignore patterns
fd_ignores=(
  # VCS, project folders, misc
  '**/.git/**' '**/node_modules/**' '**/.cache/**' '**/.venv/**' '**/.vscode/**' '**/.pycache__/**' '**/.DS_Store' '**/.idea/**' '**/.mypy_cache/**' '**/.pytest_cache/**' '**/.next/**' '**/dist/**' '**/build/**' '**/target/**' '**/.gradle/**' '**/.terraform/**' '**/.egg-info/**' '**/.env' '**/.history' '**/.svn/**' '**/.hg/**' '**/.Trash/**' '**/bin/**' '**/.bin/**' "**/.local/share/Trash/**" "**/.local/share/nvim/**" "**/pkg/**" "oil:*"

  # Build artifacts and temp files
  '**/CMakeCache.txt' '**/CMakeFiles/**' '**/Makefile' '**/*.o' '**/*.obj' '**/*.a' '**/*.so' '**/*.dll' '**/*.dylib' '**/*.exe' '**/*.class' '**/*.jar' '**/*.war' '**/*.pyc' '**/*.pyo' '**/*.pyd' '**/__pycache__/**' '**/*.whl' '**/coverage/**' '**/.coverage' '**/.nyc_output/**' '**/htmlcov/**' '**/coverage.xml'

  # Lock files and package managers
  '**/package-lock.json' '**/yarn.lock' '**/pnpm-lock.yaml' '**/Pipfile.lock' '**/poetry.lock' '**/Cargo.lock' '**/composer.lock' '**/Gemfile.lock' '**/go.sum' '**/mix.lock'

  # OS and system files
  '**/.DS_Store' '**/Thumbs.db' '**/desktop.ini' '**/*.lnk' '**/System Volume Information/**' '**/lost+found/**' '**/.fseventsd/**' '**/.Spotlight-V100/**' '**/.TemporaryItems/**'

  # Database files
  '**/*.db' '**/*.sqlite' '**/*.sqlite3' '**/*.mdb' '**/*.accdb'

  # Archives
  '**/*.zip' '**/*.rar' '**/*.7z' '**/*.tar' '**/*.tar.gz' '**/*.tar.bz2' '**/*.tar.xz' '**/*.gz' '**/*.bz2' '**/*.xz'

  # Font files
  '**/*.ttf' '**/*.otf' '**/*.woff' '**/*.woff2' '**/*.eot'

  # Virtual environments and containers
  '**/.venv/**' '**/venv/**' '**/env/**' '**/.virtualenv/**' '**/virtualenv/**' '**/Dockerfile.*' '**/.dockerignore'

  # Testing and coverage
  '**/.pytest_cache/**' '**/.coverage' '**/coverage/**' '**/.nyc_output/**' '**/junit.xml'
)

fd_excludes=()
for pat in "${fd_ignores[@]}"; do
  fd_excludes+=(--exclude "$pat")
done

get_search_dir() {
  local git_root
  git_root=$(git rev-parse --show-toplevel 2>/dev/null)
  if [[ $? -eq 0 && -n "$git_root" ]]; then
    echo "$git_root"
  else
    echo "."
  fi
}

_zcf_selector() {
  local search_dir
  search_dir=$(get_search_dir)
  fd --type f --hidden --max-depth 12 . "${fd_excludes[@]}" "$search_dir" |
    fzf --height 40% --layout=reverse --info=inline --preview 'bat {}'
}

openFile() {
  if file --mime-type -b "$1" | grep -E -q 'text/|application/(json|javascript|xml|csv|x-yaml)|inode/x-empty'; then
    ${EDITOR:-nvim} "$1"
  else
    xdg-open "$1" &>/dev/null &
  fi
}

zcf() {
  local target_file
  target_file=$(_zcf_selector)
  if [[ -n "$target_file" ]]; then
    openFile "$target_file"
  fi
}

zcfi() {
  local selected_file
  selected_file=$(_zcf_selector)
  if [[ -n "$selected_file" ]]; then
    LBUFFER+="$selected_file "
    zle redisplay
  fi
}
