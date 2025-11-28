#!/usr/bin/env bash

# Update system packages
apt-get update

# Install Python + pip
apt-get install -y python3 python3-pip

# Install JS runtime for yt-dlp
pip install py-mini-racer

# Install yt-dlp
pip install -U yt-dlp

# Install additional Python libraries
pip install requests beautifulsoup4 instaloader

# Install Chromium for Puppeteer
apt-get install -y chromium-browser

# Give execution permission to all Python scripts
chmod +x /opt/render/project/src/backend/*.py
