#!/usr/bin/env bash

# Update system
apt-get update

# Install Python3 + pip
apt-get install -y python3 python3-pip

# ---- IMPORTANT ----
# Install NodeJS (required for YouTube JS runtime)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Chromium (optional but helps for some extractors)
apt-get install -y chromium-browser || true

# Install yt-dlp and required libs
pip install -U yt-dlp
pip install py-mini-racer requests beautifulsoup4 instaloader

# Install everything from requirements.txt
pip install -r /opt/render/project/src/backend/requirements.txt

# Give execute permissions
chmod +x /opt/render/project/src/backend/*.py
