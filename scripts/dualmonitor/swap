#!/usr/bin/env bash
    # requires jq
    
    DISPLAY_CONFIG=($(i3-msg -t get_workspaces | jq -r '.[]|"\(.name):\(.output)"'))
    
    for ROW in "${DISPLAY_CONFIG[@]}"
    do
        IFS=':'
        read -ra CONFIG <<< "${ROW}"
        if [ "${CONFIG[0]}" != "null" ] && [ "${CONFIG[1]}" != "null" ]; then
            echo "moving ${CONFIG[0]}"
            i3-msg -- workspace --no-auto-back-and-forth "${CONFIG[0]}"
            i3-msg -- move workspace to output next
        fi
    done
