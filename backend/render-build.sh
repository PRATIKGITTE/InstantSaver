#!/usr/bin/env bash
set -e

# update apt and install system deps
apt-get update -y
apt-get install -y python3 python3-pip ffmpeg

# install yt-dlp python package
python3 -m pip install --upgrade pip
python3 -m pip install yt-dlp

# (Optional) ensure npm global packages if needed (not usually required)
# npm install -g npm@latest

echo "render-build.sh finished"
