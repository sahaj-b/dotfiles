from terminaltexteffects.effects.effect_blackhole import Blackhole

# Load ASCII art from art.txt
try:
    with open("art.txt", "r") as f:
        input_text = f.read()
    print("Loaded ASCII art from art.txt")
except FileNotFoundError:
  print("art.txt not found")
  exit(1)

effect = Blackhole(input_text)

# Generate frames
frames = []
for frame in effect:
    frames.append(str(frame))

# Save to individual files
for i, frame in enumerate(frames, 1):
    with open(f"frame_{i:03d}.txt", "w") as f:
        f.write(frame)

print(f"Generated {len(frames)} frames from {len(input_text)} characters.")
print("Test in terminal: for f in frame_*.txt; do cat \"$f\"; sleep 0.15; clear; done")
