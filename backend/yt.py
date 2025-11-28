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
    print(json.dumps({"error": "Invalid URL. This script only supports YouTube links."}))
    sys.exit(1)

try:
    ydl_opts = {
    "quiet": True,
    "dump_single_json": True,
    "cookiefile": "cookies.txt",
    "extractor_args": {"youtube": {"player_client": ["default"]}}
}
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        formats = info.get("formats", [])

        # Pick progressive MP4
        prog = [f for f in formats if f.get("vcodec") not in (None,"none") and f.get("acodec") not in (None,"none")]
        mp4_prog = [f for f in prog if f.get("ext") == "mp4"]
        best = (sorted(mp4_prog or prog, key=lambda f: f.get("tbr") or 0)[-1]
                if (mp4_prog or prog) else None)

        if best:
            print(json.dumps({
                "type": "video",
                "can_preview": True,
                "preview_url": best.get("url"),
                "download_url": url,
                "username": info.get("uploader")
            }))
        else:
            print(json.dumps({
                "type": "video",
                "can_preview": False,
                "preview_url": None,
                "download_url": url,
                "username": info.get("uploader"),
                "message": "Preview unavailable for separate video/audio streams. Use download button."
            }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
