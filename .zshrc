[ -f "${XDG_DATA_HOME:-$HOME/.local/share}/zap/zap.zsh" ] && source "${XDG_DATA_HOME:-$HOME/.local/share}/zap/zap.zsh"

export TERMINAL='foot' 
export SUDO_EDITOR="nvim"
export EDITOR="nvim"
export MANPAGER="nvim +Man!"
# export PAGER="nvim"
export BROWSER="zen-browser"
export TERM='xterm-256color'
export EDITOR='nvim'
export VISUAL='nvim'
export GOBIN=~/.local/bin/
export ANDROID_HOME=/opt/android-sdk

plug "zsh-users/zsh-autosuggestions"
plug "zsh-users/zsh-syntax-highlighting"

setopt interactive_comments
stty stop undef

# Enable colors and change prompt:
autoload -U colors && colors
PS1="%F{cyan}%1~ %F{magenta}%B❯ %f%b"
PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/bin/site_perl:/usr/bin/vendor_perl:/usr/bin/core_perl:~/scripts:~/scripts/pen:/sbin/:~/.local/bin:~/.cargo/bin:~/.local/share/pnpm/

# History
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history
setopt appendhistory

# Basic auto/tab complete:
autoload -Uz compinit
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zmodload zsh/complist
compinit
_comp_options+=(globdots)		# Include hidden files.

# vi mode
bindkey -v
export KEYTIMEOUT=1

# Use vim keys in tab complete menu:
bindkey -v '^?' backward-delete-char

bindkey '^a' beginning-of-line
bindkey '^e' end-of-line

# Edit line in vim with ctrl-e:
autoload edit-command-line; zle -N edit-command-line
bindkey '^x^e' edit-command-line

alias tok="fd -t d | xargs -I{} sh -c 'printf \"\n\x1b[36m{}\x1b[0m\n\"; tokei {}| grep -v = | tail -n +2'"
alias scrntime="scrntime -s 2"
alias mpvo="eza --no-quotes *.mp4 | mpv --playlist=- "
alias xo="xdg-open"
alias gitl="git log --oneline --graph --decorate"
alias df="duf"
alias du="dust"
alias grep="grep --color=auto"
alias o="nvim +'Telescope oldfiles'"
alias bp="sudo l2ping -s 200"
alias neofetch="fastfetch"
alias ls='eza --no-quotes -a --icons --group-directories-first'
alias nv='nvim'
alias v='vim'
alias nvsu='sudoedit'
alias cpcmd='fc -nl -1 | wl-copy'
alias todo="glow ~/notes/todo.md"
alias f="nvim ~/notes/todo.md"
alias pc="sudo pacman -Syu"
alias pcn="sudo pacman -Syu --noconfirm --needed"
# alias nvl='nvim ~/Leetcode/leet.cpp +"lua vim.diagnostic.enable(false)" +"Copilot disable" +":,%d _" +"norm i#include <bits/stdc++.h>" +"norm ousing namespace std;" +"norm o"'
alias nvl='nvim ~/Leetcode/leet.cpp +"lua vim.diagnostic.enable(false)" +"SupermavenStop" +":,%d _" +"norm i#include <bits/stdc++.h>" +"norm ousing namespace std;" +"norm o"'
alias dsaq='nvim ~/notes/dsa/dsaq.md +"set nowrap"'
alias nvn='cd ~/notes && nv -c "norm -"; cd -'
alias notesync='cd ~/notes && git add . && git commit -m "notes backup" && git push && cd -'
alias pymath='python3 -ic "from math import *"'
alias ts="~/scripts/tmux-sessionizer"
alias dblur="hyprctl keyword decoration:blur:enabled false, decoration:shadow:enabled false"
# alias h="harsh"
alias tp="trash-put"
# alias rm="echo hell naw bro"
alias dunstHist="dunstctl history | jq '.data[0][] | .summary.data + \": \" + .body.data' -r"
alias refl="sudo reflector -c India --save /etc/pacman.d/mirrorlist"
alias scratch="hyprctl dispatch exec '[workspace special:term silent] foot -a scratch -e tmux new-session -A -s scratch'"
alias oscratch="hyprctl dispatch exec '[workspace special:term silent] foot -o colors.alpha=1 -a scratch -e tmux new-session -A -s scratch' & disown; exit"
alias vibes='~/wayvibes/main ~/Downloads/creamy -v 5 > /dev/null 2>&1 &'
alias unimatrix='unimatrix -n -s 96 -l o'
# disable lappy keeb
alias dk='line=$(sed -n "3p" /etc/keyd/default.conf); if [[ $line == \#* ]]; then sudo sed -i "3s/^#//" /etc/keyd/default.conf; else sudo sed -i "3s/^/#/" /etc/keyd/default.conf; fi; sudo keyd reload'
alias cmdbrowse="ls $(echo $PATH | tr ':' ' ') | grep -v '/' | grep . | fzf --preview 'whereis {};tldr {}' --layout=reverse --bind 'enter:execute( tldr {} | less)';"
alias packbrowse="pacman -Qq | fzf --preview 'pacman -Qil {}' --layout=reverse --bind 'enter:execute(pacman -Qil {} | less)'" 
alias orphanrm="sudo pacman -Qtdq | sudo pacman -Rns -"
alias shToHttp="node ~/projects/multiple-curl-to-postman/index.js --file"
alias randgen="tr -dc a-z1-4 </dev/urandom | tr 1-2 ' \n' | awk 'length==0 || length>50' | tr 3-4 ' ' | sed 's/^ *//' | cat -s | fmt | head"
alias gs="git status"
alias fm="source fm"
alias duration="ffprobe -show_entries format=duration -v quiet -of csv='p=0' -i"

# bros
alias gpt='mods -m gpt-4.1'
alias gpto='mods -m gpt-4o'
alias pro='mods -m 2.5-pro'
alias flash='mods -m 2.5-flash'
alias flas='mods -m 2.0-flash'
alias lite='mods -m 2.0-flash-lite'
alias gcs="gh copilot suggest -t shell"
alias gce="gh copilot explain"
alias gits="gh copilot suggest -t git"

function lorem () {shuf -n ${1:-100} /usr/share/dict/cracklib-small | tr '\n' ' ' | fmt }
function ggl () { links www.google.com/search\?q="$*"; }
function postmanToHttp() { node ~/projects/postman-collection-gen/node.js --names --short -c "$1" | ~/scripts/curlToHttp }
bindkey -s "^o" "o\n"


function ffss(){
  # trim video
  duration=$(ffprobe -i $1 -show_entries format=duration -v quiet -of csv="p=0")
  ffmpeg -ss $2 -i $1 -t $(( $duration - $3 )) -c copy ${4:-output.mp4}
}

# yazi file browser
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
		builtin cd -- "$cwd"
	fi
	\rm -f -- "$tmp"
}

# cht.sh
function cht() {
  local language=$1 
  shift
  if [ $# -eq 0 ]; then
    curl cht.sh/${language}\?T | nvim
  else
    local query=$(echo "$@" | sed 's/ /+/g')
    curl cht.sh/${language}/${query}\?T | nvim
  fi
}

source /usr/share/fzf/key-bindings.zsh

function osc7-pwd() {
    emulate -L zsh # also sets localoptions for us
    setopt extendedglob
    local LC_ALL=C
    printf '\e]7;file://%s%s\e\' $HOST ${PWD//(#m)([^@-Za-z&-;_~])/%${(l:2::0:)$(([##16]#MATCH))}}
}
function chpwd-osc7-pwd() {
    (( ZSH_SUBSHELL )) || osc7-pwd
}
add-zsh-hook -Uz chpwd chpwd-osc7-pwd

. "$HOME/.atuin/bin/env"

eval "$(atuin init zsh --disable-up-arrow)"

type starship_zle-keymap-select >/dev/null || eval "$(starship init zsh)"
export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

# export DRI_PRIME=1 TO USE DEDICATED GPU (ARC A350M)
# export DRI_PRIME=0 (default) TO USE INTEGRATED GPU (iris xe)

export PATH=$PATH:/home/sahaj/.spicetify
# pnpm
export PNPM_HOME="/home/sahaj/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
export FZF_DEFAULT_OPTS="--bind 'ctrl-u:preview-page-up,ctrl-d:preview-page-down' \
--color=bg+:#313244,bg:#1E1E2E,spinner:#F5E0DC,hl:#F38BA8 \
--color=fg:#CDD6F4,header:#F38BA8,info:#CBA6F7,pointer:#F5E0DC \
--color=marker:#B4BEFE,fg+:#CDD6F4,prompt:#CBA6F7,hl+:#F38BA8 \
--color=selected-bg:#45475A \
--color=border:#313244,label:#CDD6F4"
