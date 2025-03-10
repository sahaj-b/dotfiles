#!/usr/bin/env bash

dotfiles_dir="/media/data/LinuxBackup/dotfiles/"

if [[ $1 = "nodata" ]] || ! [[ -w $dotfiles_dir ]]; then
  dotfiles_dir="/home/sahaj/LinuxBackup/dotfiles/"
  echo "Not using 'Data' partition. Defaulting to $dotfiles_dir"
fi

cd "${dotfiles_dir}" || {
  echo "Couldn't cd into ${dotfiles_dir}"
  exit 1
}
git rm -rf .

file_list=(
  "/etc/keyd/default.conf"
  "/etc/tlp.conf"
  "/etc/auto-cpufreq.conf"
  "/etc/systemd/system/powermgmt.service"
  "/etc/systemd/system/fix-mic.service"
  # "/etc/udev/rules.d/90-power.rules"
  "$HOME/scripts/"
  "$HOME/.gitconfig"
  "$HOME/.zshrc"
  "$HOME/.zprofile"
  "$HOME/.config/hypr/"
  "$HOME/.config/swaylock/config"
  "$HOME/.config/waybar/"
  "$HOME/.config/dunst/"
  "$HOME/.config/wofi/"
  "$HOME/.config/nvim/"
  "$HOME/.config/yay/config.json"
  "$HOME/.config/gtk-3.0/"
  "$HOME/.config/gtk-4.0/"
  "$HOME/.config/easyeffects/"
  # "$HOME/.config/alacritty/alacritty.toml"
  "$HOME/.config/dconf/"
  "$HOME/.config/tmux/tmux.conf"
  "$HOME/.config/foot/"
  "$HOME/.config/starship/"
  "$HOME/.config/btop/"
  "$HOME/.config/mimeapps.list"
  "$HOME/wallpapers/"
)

for item in "${file_list[@]}"; do
  if [ -e "$item" ]; then
    relative_path="${item#~/}"
    if [[ $item == /etc/* ]]; then
      relative_path="${item#/}"
    fi
    destination_dir=$(dirname "$dotfiles_dir$relative_path")
    mkdir -p "$destination_dir"
    cp -r "$item" "$destination_dir"
    if [ $? -ne 0 ]; then
      echo -e "\e[31mERROR: cannot copy $item.\e[0m"
    else
      echo -e "Copied: $item to $destination_dir"
    fi
  else
    echo -e "\e[31mERROR: $item does not exist.\e[0m"
  fi
done

echo -e "\e[32mCopying completed.\n\e[0m"
if [[ $1 != "cp" ]]; then
  if [[ $1 == "gdrive" ]]; then
    echo -e "\e[32mUploading Dotfiles and Guides to GDrive\e[0m"
    sudo rclone --config="/home/sahaj/.config/rclone/rclone.conf" copy /media/data/Linux_Backup/ gdrive:Linux_Backup/ -P
  else
    echo -e "\e[32mUploading $dotfiles_dir to Github\e[0m"
    git add .
    git commit -m "Updated"
    git push -u origin main
  fi
fi

cd - || exit
