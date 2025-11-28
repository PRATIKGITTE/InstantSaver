#!/usr/bin/env bash

# Update system
apt-get update -y

# Install curl and ca-certificates (NEEDED on Render)
apt-get install -y curl ca-certificates gnupg

# ---------------------------------------------------
# Install NodeJS 18 (required for yt-dlp JS Runtime)
# ---------------------------------------------------
curl -fsSL https://deb.nodesource.com/setup_18.x -o nodesource_setup.sh
bash nodesource_setup.sh
apt-get install -y nodejs

# Verify node exists (important)
node -v
npm -v

# ---------------------------------------------------
# Install Python + pip
# ---------------------------------------------------
apt-get install -y python3 python3-pip

# ---------------------------------------------------
# Install yt-dlp and dependencies
# ---------------------------------------------------
pip install -U yt-dlp
pip install py-mini-racer requests beautifulsoup4 instaloader

# Install from requirements.txt
pip install -r /opt/render/project/src/backend/requirements.txt || true

# ---------------------------------------------------
# Install Chromium (optional)
# ---------------------------------------------------
apt-get install -y chromium-browser || true

# Permissions
chmod +x /opt/render/project/src/backend/*.py
