#!/usr/bin/env bash

# Update system packages
apt-get update

# Install Python + pip
apt-get install -y python3 python3-pip

# Install Node.js (JS runtime for yt-dlp)
apt-get install -y nodejs npm

# Install JS runtime for yt-dlp (optional but keep)
pip install py-mini-racer

# Install yt-dlp and other Python packages
pip install -U yt-dlp requests beautifulsoup4 instaloader

# Install Chromium for Puppeteer
apt-get install -y chromium-browser

# Install all Python packages from requirements.txt
pip install -r /opt/render/project/src/backend/requirements.txt

# Give execution permission to all Python scripts
chmod +x /opt/render/project/src/backend/*.py
