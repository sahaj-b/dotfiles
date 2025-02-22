cursor_info=$(xdotool getmouselocation)
x=$(echo "$cursor_info" | awk '{print $1}' | cut -d ':' -f 2)
y=$(echo "$cursor_info" | awk '{print $2}' | cut -d ':' -f 2)

if [ $x -lt 1361 ]; then
  xdotool mousemove '2000' '1000'
else
  xdotool mousemove '600' '350'
fi
