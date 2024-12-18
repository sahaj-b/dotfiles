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
function vibes() {
  nohup wayvibes ~/Downloads/creamy -v $1 &
}

# function rm() {
#   arg=$1;
#   if [[ "$arg" == "-rff" ]]; then
#     rm -rf $2
#     return
#   fi
#   if [[ "$arg" == "-r" || "$arg" == "-rf" || "$arg" == "-fr" ]]; then
#     if [ -z "$2" ]; then
#       echo "No file specified"
#       return 1
#     else
#       arg=$2
#     fi
#   fi
#   mv "$arg" ~/.local/share/Trash/files/
#   echo "[Trash Info]" > "~/.local/share/Trash/info/$arg.trashinfo"
#   echo "Path=$(readlink -f $arg)" >> "~/.local/share/Trash/info/$arg.trashinfo"
#   echo "DeletionDate=$(date +%Y-%m-%dT%H:%M:%S)" >> "~/.local/share/Trash/info/$arg.trashinfo"
# }

alias tp="trash-put"
alias rm="echo hell naw bro"
alias dunstHist="dunstctl history | jq '.data[0][] | .summary.data + \": \" + .body.data' -r"
alias demn=~/demn/demn.py
alias refl="reflector -c India >> /etc/pacman.d/mirrorlist && reflector >> /etc/pacman.d/mirrorlist"
alias dk='line=$(sed -n "3p" /etc/keyd/default.conf); if [[ $line == \#* ]]; then sudo sed -i "3s/^#//" /etc/keyd/default.conf; else sudo sed -i "3s/^/#/" /etc/keyd/default.conf; fi; sudo keyd reload'
alias scratch="hyprctl dispatch exec '[workspace special:term silent] foot -a scratch -e tmux new-session -A -s scratch'"
alias oscratch="hyprctl dispatch exec '[workspace special:term silent] foot -o colors.alpha=1 -a scratch -e tmux new-session -A -s scratch' & disown; exit"
alias nvl='nvim ~/Leetcode/leet.cpp +"lua vim.diagnostic.disable(0)" +"CodeiumDisable" +"lua opaque()" +":,%d _" +"norm i#include <bits/stdc++.h>" +"norm ousing namespace std;" +"norm o"'
alias dsaq='nvim ~/notes/tech/dsaq.md +"set nowrap" +CodeiumDisable'
alias lnsync='LBsync.sh && notesync'
alias nvn='cd ~/notes && nv -c "Telescope find_files"'
alias notesync='cd ~/notes && git add . && git commit -m "notes backup" && git push'
alias unimatrix='unimatrix -n -s 96 -l o'
alias ls='eza --icons --group-directories-first'
alias nv='nvim'
alias v='vim'
alias nvsu='sudo -E -s nvim'
alias pymath='python3 -ic "from math import *"'
alias cpcmd='fc -nl -1 | wl-copy'
alias todo="glow ~/notes/todo.md"
alias todon="nvim ~/notes/todo.md +CodeiumDisable"
alias pcon="ssh u0_a251@192.168.0.199 -p8022 -L 9901:localhost:5901"
alias vncv="vncviewer localhost:9901"
alias ttoggle="xinput --list-props 13 | grep 'Device Enabled' | cut -f2 -d ':' | xargs -I {} bash -c 'if [ {} -eq 0 ]; then xinput --enable 13; else xinput --disable 13; fi'"
alias tstog="xinput --list-props 10 | grep 'Device Enabled' | cut -f2 -d ':' | xargs -I {} bash -c 'if [ {} -eq 0 ]; then xinput --enable 10; else xinput --disable 10; fi'"
alias tk="tmux kill-session"
alias pc="sudo pacman -Syu"
alias pcn="sudo pacman -Syu --noconfirm"
alias ycn="yay -Syu --noconfirm"
allcommands () { compgen -ac | fzf --preview 'whereis {};tldr {}' --layout=reverse --bind 'enter:execute( tldr {} | less)'; }

pic () { scp -P 8022 192.168.0.195:/data/data/com.termux/files/home/$1 ~/; sxiv $1; }
q () {
    if [[ $1 == "see" ]]; then
        nvim ~/notes/tech/dsaq.md +"set nowrap | TableModeToggle"
    else
        nvim ~/notes/tech/dsaq.md
    fi
}

adbw () { adb connect 192.168.0.194:$(nmap 192.168.0.197 -p 30000-49999 | awk '/\/tcp/' | cut -d/ -f1); }


# journal script (j, j -1, j w 2, etc.)
j() {
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

    local file_path=~/notes/journal/"$subpath"/"$desired_date".md

    if [ ! -f "$file_path" ]; then
        nvim -c "e $file_path" -c "ObsidianTemplate $subpath.md" -c "norm \"_dd"
else
nvim "$file_path"
    fi
}
ggl () { links www.google.com/search\?q="$*"; }
packbrowse() { pacman -Qq | fzf --preview 'pacman -Qil {}' --layout=reverse --bind 'enter:execute(pacman -Qil {} | less)'; }
orphanrm() { echo "sudo pacman -Qtdq | sudo pacman -Rns -"; }
adbcon () { sudo adb devices; sudo adb tcpip 5555; sudo adb connect $(adb shell ip route | awk '{print $9}'):5555;}
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
                yay -Syu "$packname"
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
# hdmi () {
#     xrandr=$(xrandr)
#     con_monitors=$(echo "$xrandr" | grep -c "HDMI")
#     if [[ $con_monitors -eq 1 ]]; then
#         xrandr --output eDP-1 --primary --mode 1366x768 --pos 1360x768 --rotate normal --output HDMI-1 --mode 1360x768 --pos 0x0 --rotate normal
#     else
#         echo "No HDMI connected"
#     fi
# }

export TERMINAL='alacritty' 
export SUDO_EDITOR="nvim"
export EDITOR="nvim"
export MANPAGER="nvim +Man!"
# export PAGER="nvim"
export BROWSER="thorium-browser"


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
