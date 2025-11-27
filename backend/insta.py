#!/usr/bin/env python3
import sys
import json
import subprocess
import os

COOKIES_FILE = os.path.join(os.path.dirname(__file__), "cookies.txt")

def yt_dlp_json(url):
    """Return parsed yt-dlp JSON dict for a url, retry if fails, using cookies."""
    cmd_base = ["yt-dlp", "-j", url]
    cmd_cookies = ["yt-dlp", "--cookies", COOKIES_FILE, "-j", url] if os.path.exists(COOKIES_FILE) else cmd_base

    try:
        out = subprocess.check_output(cmd_cookies, stderr=subprocess.STDOUT, text=True)
        return parse_json_output(out)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(e.output or str(e))
    except Exception as e:
        raise RuntimeError(f"yt-dlp failed: {e}")

def parse_json_output(out):
    """Strip warnings/non-JSON lines and parse the last valid JSON line."""
    lines = out.splitlines()
    json_lines = [line for line in lines if line.strip().startswith("{")]
    if not json_lines:
        raise RuntimeError("yt-dlp returned invalid JSON, no JSON found")
    try:
        return json.loads(json_lines[-1])
    except json.JSONDecodeError as e:
        raise RuntimeError(f"yt-dlp returned invalid JSON: {e}")

def choose_best_format(info):
    """Pick playable URL from yt-dlp info dict and return FastDL-like structured JSON."""

    # handle playlists / multiple entries
    if "entries" in info and isinstance(info["entries"], list):
        info = info["entries"][0] if info["entries"] else info

    formats = info.get("formats") or []
    username = info.get("uploader") or None

    # 1️⃣ Progressive formats (video+audio) — best for browser preview
    prog = [f for f in formats if f.get("vcodec") not in (None, "none") and f.get("acodec") not in (None, "none")]
    mp4_prog = [f for f in prog if f.get("ext") == "mp4"]
    candidates = mp4_prog or prog
    if candidates:
        best = sorted(candidates, key=lambda f: (f.get("tbr") or 0))[-1]
        return {
            "type": "video",
            "can_preview": True,
            "preview_url": best.get("url"),   # ✅ preview works in <video>
            "download_url": best.get("url"),
            "username": username
        }

    # 2️⃣ DASH / separate video+audio — for download only, cannot preview
    video_only = [f for f in formats if f.get("vcodec") not in (None, "none") and f.get("acodec") in (None, "none")]
    audio_only = [f for f in formats if f.get("vcodec") in (None, "none") and f.get("acodec") not in (None, "none")]
    if video_only and audio_only:
        return {
            "type": "video",
            "can_preview": False,
            "preview_url": None,
            "download_url": info.get("webpage_url") or "",
            "username": username,
            "message": "Preview unavailable for separate video/audio streams. Use download button to get the full video."
        }

    # 3️⃣ Image post
    if info.get("thumbnail"):
        return {
            "type": "image",
            "can_preview": True,
            "preview_url": info.get("thumbnail"),
            "download_url": info.get("thumbnail"),
            "username": username
        }

    return {"error": "No playable format found"}

def fetch_instagram(url, retries=2):
    """Retry yt-dlp fetch for transient errors."""
    last_err = None
    for _ in range(retries):
        try:
            info = yt_dlp_json(url)
            return choose_best_format(info)
        except Exception as e:
            last_err = e
    raise last_err

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing URL"}))
        return

    url = sys.argv[1].strip()
    try:
        result = fetch_instagram(url)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": f"yt-dlp failed: {str(e)}"}))

if __name__ == "__main__":
    main()
