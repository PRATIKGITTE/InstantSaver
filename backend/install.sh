#!/usr/bin/env bash

# Update system packages
apt-get update

# Install Python + pip
apt-get install -y python3 python3-pip

# Install Chromium for Puppeteer
apt-get install -y chromium-browser

# Install all Python packages from requirements.txt (includes yt-dlp, py-mini-racer, requests, beautifulsoup4, instaloader)
pip install -r /opt/render/project/src/backend/requirements.txt

# Give execution permission to all Python scripts
chmod +x /opt/render/project/src/backend/*.py
