#!/usr/bin/env bash

output_chars=45

transformStr() {
  local input_string="$1"
  local n="$2"
  local string_length=${#input_string}

  if [ "$string_length" -gt "$n" ]; then
    expr "$input_string" : ".*\(.\{$n\}\)$"
  else
    local padding_length=$((n - string_length))
    echo "$(printf ' %.0s' $(seq 1 "$( expr $padding_length / 2)")) $input_string$(printf ' %.0s' $(seq 1 "$(expr $padding_length / 2)"))"
  fi
}

if [[ "$1" == "output" ]];then
    lastsess=$(cat /tmp/lastscratch.tmp)

    # Dont give terminal output when window active, or no command, or in neovim
    if [[ $(xprop -id $(xdotool getactivewindow) | grep WM_CLASS | cut -d '"' -f4) == drop$lastsess ]] || [[ "$output" == *">>"* ]] || [[ "$output" == *"{.}"* ]]|| [[ "$output" == *"written"* ]] || [[ "$output" == *"   ["*"/"*"]" ]] || [[ "$output" == *","*"-"*"All" ]] || [[ "$output" == *"lines yanked" ]]; then
        # echo "$(printf '%*s' $output_chars)"
        transformStr "$(grep '-' ~/notes/todo.md | head -1)    " $output_chars
    else
        output=$(tmux capture-pane -pt drop"$lastsess":.1 | awk '/./{line=$0} END{print line}')
        transformStr "$output" $output_chars
    fi
elif [[ "$(xprop -id $(xdotool getactivewindow) | grep WM_CLASS | cut -d '"' -f4)" == "drop"*	]];then
    i3-msg move scratchpad
else
    echo "$1">/tmp/lastscratch.tmp
    if xdotool search --class "drop$1" >/dev/null;then
        i3-msg "[class="drop$1"] move container to workspace current,focus,move position center"
    else
        st -c "drop$1" -e tmux new-session -A -s "drop$1" & disown
        while true; do
            if xdotool search --class "drop$1" >/dev/null; then
                i3-msg "[class="drop$1"] floating enable  "
                i3-msg "[class="drop$1"] resize set 950 600"
                i3-msg "[class="drop$1"] move position center"
                break
            fi
        done
    fi
fi
exit
