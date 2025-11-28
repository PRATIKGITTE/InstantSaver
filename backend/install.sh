#!/usr/bin/env bash

apt-get update

# Install Python and pip
apt-get install -y python3 python3-pip

# Install yt-dlp (VERY IMPORTANT)
pip install -U yt-dlp

# Install chrome for puppeteer
apt-get install -y chromium-browser

# Give execution permission
chmod +x /opt/render/project/src/backend/*.py
