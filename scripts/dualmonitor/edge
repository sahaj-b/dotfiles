#!/usr/bin/env bash

c=0
d=0
# Function to update the previous cursor position
while true; do
    # Get the current cursor position
    cursor_info=$(xdotool getmouselocation)
    x=$(echo "$cursor_info" | awk '{print $1}' | cut -d ':' -f 2)
    y=$(echo "$cursor_info" | awk '{print $2}' | cut -d ':' -f 2)

    if [ "$y" -eq 768 ]; then 
        if [ "$c" -lt 2 ]; then
            c=$(($c+1))
            xdotool mousemove "$x" "770" 
            cursor_info=$(xdotool getmouselocation)
            x=$(echo "$cursor_info" | awk '{print $1}' | cut -d ':' -f 2)
            y=$(echo "$cursor_info" | awk '{print $2}' | cut -d ':' -f 2)
        else
            c=0
            if [ "$y" -eq 768 ]; then 
                xdotool mousemove "$(($x-1360))" "765" 
            fi
        fi
    else
        c=0
    fi

    if [ "$y" -eq 767 ]; then 
        if [ "$d" -lt 2 ]; then
            d=$(($d+1))
            xdotool mousemove "$x" "760" 
            cursor_info=$(xdotool getmouselocation)
            x=$(echo "$cursor_info" | awk '{print $1}' | cut -d ':' -f 2)
            y=$(echo "$cursor_info" | awk '{print $2}' | cut -d ':' -f 2)
        else
            d=0
            if [ "$y" -eq 767 ]; then 
                xdotool mousemove "$(($x+1366))" "769" 
            fi
        fi
    else
        d=0
    fi

    sleep 0.08
done
