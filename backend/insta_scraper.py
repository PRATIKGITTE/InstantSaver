#!/usr/bin/env python3
# insta-downloader.py
import sys
import json
import instaloader
from urllib.parse import urlparse

if len(sys.argv) < 2:
    print(json.dumps({"error": "Missing URL"}))
    sys.exit(1)

url = sys.argv[1].strip()
parsed = urlparse(url)

# Strict domain check for Instagram
valid_domains = ["instagram.com", "www.instagram.com"]
if parsed.netloc not in valid_domains:
    print(json.dumps({"error": "Invalid URL. This script only supports Instagram links."}))
    sys.exit(1)

loader = instaloader.Instaloader(save_metadata=False, download_videos=True, download_comments=False)

try:
    if "/reel/" in url:
        shortcode = url.split("/reel/")[1].split("/")[0]
        post = instaloader.Post.from_shortcode(loader.context, shortcode)
        print(json.dumps({
            "media_url": post.video_url,
            "is_video": True,
            "posted_by": f"Posted by @{post.owner_username}"
        }))
    elif "/p/" in url:
        shortcode = url.split("/p/")[1].split("/")[0]
        post = instaloader.Post.from_shortcode(loader.context, shortcode)
        print(json.dumps({
            "media_url": post.url,
            "is_video": post.is_video,
            "posted_by": f"Posted by @{post.owner_username}"
        }))
    elif "/profile/" in url or "instagram.com/" in url:
        username = url.split("instagram.com/")[1].split("/")[0]
        profile = instaloader.Profile.from_username(loader.context, username)
        print(json.dumps({
            "media_url": profile.profile_pic_url,
            "is_video": False,
            "posted_by": f"Posted by @{username}"
        }))
    else:
        raise Exception("Unsupported Instagram URL")
except Exception as e:
    print(json.dumps({"error": str(e)}))
