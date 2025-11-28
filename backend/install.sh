#!/usr/bin/env bash

apt-get update

# Install Python + pip
apt-get install -y python3 python3-pip

# Install JS runtime for yt-dlp (VERY IMPORTANT)
pip install py-mini-racer

# Install yt-dlp
pip install -U yt-dlp

# Install chromium for puppeteer
apt-get install -y chromium-browser

# Give permission
chmod +x /opt/render/project/src/backend/*.py
