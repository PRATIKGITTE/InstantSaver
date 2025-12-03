#!/usr/bin/env python3
# yt.py

import sys, json
from yt_dlp import YoutubeDL
from urllib.parse import urlparse

if len(sys.argv) < 2:
    print(json.dumps({"error": "Missing URL"}))
    sys.exit(1)

url = sys.argv[1].strip()
parsed = urlparse(url)

valid_domains = ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"]

if not any(domain in parsed.netloc for domain in valid_domains):
    print(json.dumps({"error": "Invalid URL. Only YouTube supported"}))
    sys.exit(1)

try:
    ydl_opts = {
        "quiet": True,
        "dump_single_json": True,
        "cookiefile": "cookies.txt",
        "extractor_args": { "youtube": { "player_client": ["default"] }},
        "merge_output_format": "mp4",
        "nocheckcertificate": True,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        formats = info.get("formats", [])

        merged = [
            f for f in formats
            if f.get("vcodec") not in ("none", None) and f.get("acodec") not in ("none", None)
        ]

        best = sorted(merged, key=lambda f: f.get("tbr") or 0)[-1]

        print(json.dumps({
            "type": "video",
            "can_preview": True,
            "preview_url": best.get("url"),
            "download_url": url,
            "username": info.get("uploader")
        }))

except Exception as e:
    print(json.dumps({"error": str(e)}))
