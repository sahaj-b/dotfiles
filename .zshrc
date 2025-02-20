[ -f "${XDG_DATA_HOME:-$HOME/.local/share}/zap/zap.zsh" ] && source "${XDG_DATA_HOME:-$HOME/.local/share}/zap/zap.zsh"

plug "zsh-users/zsh-autosuggestions"
plug "zsh-users/zsh-syntax-highlighting"

setopt interactive_comments
stty stop undef

# Enable colors and change prompt:
autoload -U colors && colors
PS1="%F{cyan}%1~ %F{magenta}%B❯ %f%b"
PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/bin/site_perl:/usr/bin/vendor_perl:/usr/bin/core_perl:~/scripts:/sbin/:~/.local/bin:~/.cargo/bin

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

# Edit line in vim with ctrl-e:
autoload edit-command-line; zle -N edit-command-line
bindkey '^x^e' edit-command-line


# alias vibes='~/wayvibes/main ~/Downloads/creamy -v 5 > /dev/null 2>&1 &'

# journal script (j, j -1, j w 2, etc.)
function j() {
    local offset=0
    local type=d

    if [[ $1 =~ ^[dwmy]$ ]]; then
        type=$1
        shift
    fi

    if [[ $1 =~ ^[+-]?[0-9]+$ ]]; then
        offset=$1
    fi

    local desired_date
    local subpath

    case "$type" in
        d) desired_date=$(date -d "$offset days" +"%F")
           subpath="daily" ;;
        w) desired_date=$(date -d "$offset weeks" +"%Y-W%V")
           subpath="weekly" ;;
        m) desired_date=$(date -d "$offset months" +"%Y-%m")
           subpath="monthly" ;;
        y) desired_date=$(date -d "$offset years" +"%Y")
           subpath="yearly" ;;
    esac

    local file_path="~/notes/journal/$subpath/$desired_date.md"
    local template_path="~/notes/journal/template/$subpath.md" 

    if [ ! -f "$file_path" ]; then
        cat $template_path > $file_path
    fi
        nvim "$file_path"
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

function nstat() {
  file="$1"
  size=$(stat -c %s "$file" | numfmt --to=iec --suffix=B)
  access_time=$(stat -c %x "$file" | awk '{print $1, $2}' | xargs -I{} date -d "{}" "+%d-%m-%Y %H:%M:%S")
  modify_time=$(stat -c %y "$file" | awk '{print $1, $2}' | xargs -I{} date -d "{}" "+%d-%m-%Y %H:%M:%S")
  creation_time=$(stat -c %w "$file" | awk '{if ($1 == "-") print "-"; else print $1, $2}' | xargs -I{} date -d "{}" "+%d-%m-%Y %H:%M:%S" 2>/dev/null || echo "-")
  
  purple="\033[34m"
  reset="\033[0m"

  stat --printf "${purple}File:${reset} %n\n" "$file"
  echo -e "${purple}Size:${reset} $size"
  echo -e "${purple}Permissions:${reset} %A"
  echo -e "${purple}Last Access:${reset} $access_time"
  echo -e "${purple}Last Modify:${reset} $modify_time"
  echo -e "${purple}Creation:${reset} $creation_time"
  echo -e "${purple}Owner:${reset} %U"
  echo -e "${purple}Group:${reset} %G"
  echo -e "${purple}Type:${reset} %F"
  echo -e "${purple}Links:${reset} %h"
}

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

alias ts="~/scripts/tmux-sessionizer"
alias dblur="hyprctl keyword decoration:blur:enabled false, decoration:shadow:enabled false"
alias h="harsh"
alias neofetch="fastfetch"
alias tp="trash-put"
# alias rm="echo hell naw bro"
alias dunstHist="dunstctl history | jq '.data[0][] | .summary.data + \": \" + .body.data' -r"
alias refl="reflector -c India >> /etc/pacman.d/mirrorlist && reflector >> /etc/pacman.d/mirrorlist"
alias dk='line=$(sed -n "3p" /etc/keyd/default.conf); if [[ $line == \#* ]]; then sudo sed -i "3s/^#//" /etc/keyd/default.conf; else sudo sed -i "3s/^/#/" /etc/keyd/default.conf; fi; sudo keyd reload'
alias scratch="hyprctl dispatch exec '[workspace special:term silent] foot -a scratch -e tmux new-session -A -s scratch'"
alias oscratch="hyprctl dispatch exec '[workspace special:term silent] foot -o colors.alpha=1 -a scratch -e tmux new-session -A -s scratch' & disown; exit"
alias nvl='nvim ~/Leetcode/leet.cpp +"lua vim.diagnostic.disable(0)" +"lua Opaque()" +"Copilot disable" +":,%d _" +"norm i#include <bits/stdc++.h>" +"norm ousing namespace std;" +"norm o"'
alias dsaq='nvim ~/notes/tech/dsaq.md +"set nowrap"'
alias lnsync='LBsync.sh && notesync'
alias nvn='cd ~/notes && nv -c "norm -"; cd -'
alias notesync='cd ~/notes && git add . && git commit -m "notes backup" && git push'
alias unimatrix='unimatrix -n -s 96 -l o'
alias ls='eza -a --icons --group-directories-first'
alias nv='nvim'
alias v='vim'
alias nvsu='sudo -E -s nvim'
alias pymath='python3 -ic "from math import *"'
alias cpcmd='fc -nl -1 | wl-copy'
alias todo="glow ~/notes/todo.md"
alias f="nvim ~/notes/todo.md"
alias tk="tmux kill-session"
alias pc="sudo pacman -Syu"
alias pcn="sudo pacman -Syu --noconfirm"
alias ycn="yay -Syu --noconfirm"

ggl () { links www.google.com/search\?q="$*"; }
allcommands () { compgen -ac | fzf --preview 'whereis {};tldr {}' --layout=reverse --bind 'enter:execute( tldr {} | less)'; }
packbrowse() { pacman -Qq | fzf --preview 'pacman -Qil {}' --layout=reverse --bind 'enter:execute(pacman -Qil {} | less)'; }
orphanrm() { sudo pacman -Qtdq | sudo pacman -Rns - }

pcs() { 
    package_list=$(pacman -Ss | awk -F '/' '{print $2}' | awk '{print $1}' | sort);
    packages=$(echo "$package_list" | fzf --multi --preview 'pacman -Si {}' --layout=reverse --query="'");
   packages=$(echo "$packages" | tr '\n' ' ' | sed 's/[[:space:]]*$//')
    if [ "$packages" != "" ];then
        echo -ne "sudo pacman -Syu $packages\nExecute?(Y/n/no(c)onfirm)"
        read yn;
        if [[ "$yn" == "y" ]] || [[ "$yn" == "" ]];then
            sudo pacman -Syu $(echo $packages)
        elif [[ "$yn" == "c" ]];then
            sudo pacman -Syu --noconfirm $(echo $packages)
        fi
    fi
}

ycs() {
    if [[ "$1" == "" ]];then
        echo "search argument required"
    else
        aur_package_list=$(yay -Ss "$1" | awk 'NR % 2 == 1' | tac);
        selected_package=$(echo "$aur_package_list" | fzf --layout=reverse --query="'");
        if [ "$selected_package" != "" ];then
            packname=$( echo "$selected_package" | awk -F/ '{print $2}' | awk '{print $1}' )
            echo -ne "yay -S $packname \nExecute?(Y/n)"
            read yn;
            if [[ "$yn" == "y" ]] || [[ "$yn" == "" ]];then
                yay -S "$packname"
            fi
        fi
    fi
}

bindkey -s '' 'source ~/scripts/fm\C-m'

countdown() {
    start="$(( $(date +%s) + $1))"
    while [ "$start" -ge $(date +%s) ]; do
        ## Is this more than 24h away?
        # days="$(($(($(( $start - $(date +%s) )) * 1 )) / 86400))"
        time="$(( $start - `date +%s` ))"
        # printf '%s day(s) and %s\r' "$days" "$(date -u -d "@$time" +%H:%M:%S)"
        printf '%s\r' "$(date -u -d "@$time" +%H:%M:%S)"
        sleep 0.5
    done
    notify-send "Time's up"
    /usr/bin/paplay /usr/share/sounds/freedesktop/stereo/complete.oga
}

stopwatch() {
    start=$(date +%s)
    while true; do
        # days="$(($(( $(date +%s) - $start )) / 86400))"
        time="$(( $(date +%s) - $start ))"
        # printf '%s day(s) and %s\r' "$days" "$(date -u -d "@$time" +%H:%M:%S)"
        printf '%s\r' "$(date -u -d "@$time" +%H:%M:%S)"
        sleep 0.5
    done
}

export TERMINAL='foot' 
export SUDO_EDITOR="nvim"
export EDITOR="nvim"
export MANPAGER="nvim +Man!"
# export PAGER="nvim"
export BROWSER="zen-browser"


source /usr/share/fzf/key-bindings.zsh

bindkey '^a' beginning-of-line
bindkey '^e' end-of-line

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

export TERM='xterm-256color'
export EDITOR='nvim'
export VISUAL='nvim'

eval "$(atuin init zsh --disable-up-arrow)"

type starship_zle-keymap-select >/dev/null || eval "$(starship init zsh)"
export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

# export DRI_PRIME=1 TO USE DEDICATED GPU(ARC A350M)
# export DRI_PRIME=0 (default)TO USE INTEGRATED GPU(iris xe)

export PATH=$PATH:/home/sahaj/.spicetify

. "$HOME/.local/share/../bin/env"
