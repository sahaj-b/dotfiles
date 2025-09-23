# Plymouth ASCII Animation Theme

Creates sick animated ASCII art for your boot screen using terminal text effects. Currently set up with a blackhole effect but you can swap it for other dope effects.

## Requirements
- Python 3 with [terminaltexteffects](https://github.com/ChrisBuilds/terminaltexteffects) package
- [ansee](https://github.com/codersauce/ansee) for converting text frames to PNG images
- Plymouth

## Instructions

1. **Create your art.txt**: Use any ASCII art generator or create your own. Save it as `generator/art.txt`.

2. **Generate Frames**
  ```bash
  cd generator/
  python generate.py
  ```

This reads your ASCII art from `art.txt` and generates frame files.

3. Process Frames for Plymouth
  ```bash
  ./process [start_frame] [thinning_factor]
  ```

- `start_frame`: Which frame to start from (default: 1)
- `thinning_factor`: Keep every Nth frame (default: 8)

Example: `./process 10 6` starts from frame 10, keeps every 6th frame.

4. Install Plymouth Theme
  ```bash
# Copy theme files to Plymouth directory
# NOTE: if you are using a different name for the theme/directory, change it inside the .plymouth file too
  sudo mkdir -p /usr/share/plymouth/themes/ascii_effect
  sudo cp yeah.script /usr/share/plymouth/themes/ascii_effect/ascii_effect.script
  sudo cp yeah.plymouth /usr/share/plymouth/themes/ascii_effect/ascii_effect.plymouth
  sudo cp generator/processed_frames/frame-*.png /usr/share/plymouth/themes/ascii_effect/

# Set as active theme
  sudo plymouth-set-default-theme ascii_effect -R
  ```


> [!NOTE]
> It is assumed you have Plymouth setted up on your system. If not, see your distro's documentation for it

## Customization

- **Animation Effect**: In `generator/generate.py`, you can change `Blackhole` for other effects from the `terminaltexteffects` package
- **Animation FPS**: In the Plymouth script (`yeah.script`), change `frame_interval = 2` to speed up/slow down.
- **Frame Processing**:
  - Increase `thinning_factor` for smoother but longer animations (bloats initramfs, may cause boot delay)
  - Decrease for choppier but shorter animations
  - Adjust `start_frame` to skip intro frames
