const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Force HTTPS redirect
app.use((req, res, next) => {
  if (req.get("X-Forwarded-Proto") !== "https" && req.get("X-Forwarded-Proto")) {
    return res.redirect(301, `https://${req.get("host")}${req.url}`);
  }
  next();
});

app.use(express.json({ limit: "50mb" }));

// ---------- yt-dlp PATH ----------
const YTDLP_PATH = path.join(__dirname, "bin", "yt-dlp");

// ---------- YouTube cookies path ----------
const YT_COOKIES_PATH = path.join(os.tmpdir(), "yt-cookies.txt");

// ---------- Health ----------
app.get("/health", (req, res) => {
  const exists = fs.existsSync(YTDLP_PATH);
  let version = "missing";
  if (exists) {
    try {
      version = require("child_process")
        .execSync(`${YTDLP_PATH} --version`)
        .toString()
        .trim();
    } catch {}
  }
  res.json({
    status: "ok",
    ts: Date.now(),
    ytDlpAvailable: exists,
    ytDlpVersion: version,
    ytDlpPath: YTDLP_PATH,
    cookies: fs.existsSync(YT_COOKIES_PATH) ? "✅ Loaded" : "❌ Missing"
  });
});

// ---------- Helpers ----------
function isInstagramUrl(url) {
  return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url || "");
}

// Extract username from URL paths like /cristiano/reel/{id}/, /cristiano/p/{id}/, /stories/cristiano/{id}/
function extractUsernameFromUrl(url) {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    // Pattern: /stories/{username}/{id}/
    if (parts[0] === "stories" && parts.length >= 2) return parts[1];
    // Pattern: /{username}/{postType}/{id}
    const postSegments = ["p", "reel", "reels", "tv", "highlights"];
    if (parts.length >= 2 && postSegments.includes(parts[1])) return parts[0];
    return null;
  } catch { return null; }
}

// Returns true for instagram.com/stories/{username}/{id}/ URLs
function isInstagramStoriesUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!/instagram\.com$/i.test(u.hostname)) return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] === "stories";
  } catch { return false; }
}

// Returns true for instagram.com/{username} profile pages (NOT posts/reels)
function isInstagramProfileUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!/instagram\.com$/i.test(u.hostname)) return false;
    const path = u.pathname.replace(/\/$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length !== 1) return false;
    const reserved = ["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "ar", "a", "s"];
    return !reserved.includes(parts[0].toLowerCase());
  } catch {
    return false;
  }
}

function isYouTubeUrl(url) {
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(url || "");
}

function normalizeYouTube(url) {
  let u = (url || "").trim();
  const shortsMatch = u.match(/\/shorts\/([^\/\?]+)/);
  if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  const shortMatch = u.match(/youtu\.be\/([^\/\?]+)/);
  if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`;
  return u;
}

function isValidYouTubeVideo(url) {
  const clean = normalizeYouTube(url);
  return /youtube\.com\/watch\?/.test(clean) || /youtu\.be\//.test(clean);
}

function safeFileName(base, ext) {
  const s = String(base || "download")
    .replace(/[^a-z0-9_\-]/gi, "_")
    .slice(0, 40);
  return `${s}_${Date.now()}${ext}`;
}

// ---------- WRITE YOUTUBE COOKIES ----------
function ensureYouTubeCookies() {
  const cookies = process.env.YT_COOKIES;
  console.log("YT_COOKIES length:", cookies?.length || 0);

  if (!cookies) return null;

  try {
    fs.writeFileSync(YT_COOKIES_PATH, cookies, "utf8");
    console.log("✅ YouTube cookies:", YT_COOKIES_PATH);
    return YT_COOKIES_PATH;
  } catch (e) {
    console.error("❌ Cookies error:", e);
    return null;
  }
}

// ---------- Instagram Profile / DP scraper ----------
function fetchInstagramDP(profileUrl, res) {
  const https = require("https");
  let username = "";
  try {
    const u = new URL(profileUrl.trim());
    username = u.pathname.replace(/\//g, "");
  } catch {
    return res.status(400).json({ error: "Invalid profile URL" });
  }

  const options = {
    hostname: "www.instagram.com",
    path: `/${username}/`,
    method: "GET",
    timeout: 15000,
    headers: {
      // facebookexternalhit UA causes Instagram to render the og: meta tags server-side.
      // A standard browser UA returns a blank JS shell with no og:image at all.
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity"
    }
  };

  const req = https.request(options, (response) => {
    // Instagram often redirects profile pages — follow once
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      return res.status(404).json({ error: "Profile not found or redirected. Make sure the account is public." });
    }
    let html = "";
    response.setEncoding("utf8");
    // Stop accumulating past 2MB but keep draining the stream so 'end' still fires.
    // (Destroying the request here would abort the response before 'end' and hang forever.)
    response.on("data", (chunk) => { if (html.length < 2000000) html += chunk; });
    response.on("end", () => {
      const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                  || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
                   || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);

      if (ogImage && ogImage[1]) {
        const dpUrl = ogImage[1].replace(/&amp;/g, "&");
        const rawTitle = ogTitle ? ogTitle[1].replace(/&amp;/g, "&") : username;
        const displayName = rawTitle.replace(/\s*\(@[^)]+\).*$/, "").trim();
        return res.json({
          type: "profile",
          username,
          display_name: displayName || username,
          preview_url: dpUrl,
          can_preview: true,
          download_url: `/api/instagram/download-dp?url=${encodeURIComponent(dpUrl)}&username=${encodeURIComponent(username)}`
        });
      }
      return res.status(404).json({ error: "Profile picture not found. The account may be private or Instagram is blocking the request." });
    });
  });

  req.on("timeout", () => { req.destroy(); res.status(504).json({ error: "Profile fetch timed out. Try again." }); });
  req.on("error", () => res.status(500).json({ error: "Failed to fetch Instagram profile. Try again." }));
  req.end();
}

// ======================================================
// OG SCRAPER — fallback when yt-dlp fails on /p/ posts
// Uses facebookexternalhit UA so Instagram returns full og: tags.
// Supports full carousel detection via ?img_index=N iteration.
// ======================================================

// Fetch og: tags from one Instagram URL. Promise resolves to { image, video, title, desc, finalPathname } or null on failure.
function fetchOgSingle(pathname, search, redirectCount) {
  redirectCount = redirectCount || 0;
  return new Promise((resolve) => {
    const https = require("https");
    const options = {
      hostname: "www.instagram.com",
      path: pathname + (search || ""),
      method: "GET",
      timeout: 12000,
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity"
      }
    };
    const req = https.request(options, (response) => {
      // Instagram redirects tagged/collab posts to the canonical owner's URL —
      // follow it (same img_index) so we still get og: tags and the real username.
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirectCount < 3) {
        response.resume();
        let loc;
        try { loc = new URL(response.headers.location, "https://www.instagram.com"); } catch { return resolve(null); }
        resolve(
          fetchOgSingle(loc.pathname, search, redirectCount + 1).then((result) =>
            result ? { ...result, finalPathname: loc.pathname } : null
          )
        );
        return;
      }
      if (response.statusCode >= 400) return resolve(null);
      let html = "";
      response.setEncoding("utf8");
      // Stop accumulating past 2MB but keep draining the stream so 'end' still fires.
      // (Destroying the request here would abort the response before 'end' and hang the promise forever.)
      response.on("data", (chunk) => { if (html.length < 2000000) html += chunk; });
      response.on("end", () => {
        const pick = (patterns) => {
          for (const p of patterns) {
            const m = html.match(p);
            if (m && m[1]) return m[1].replace(/&amp;/g, "&");
          }
          return null;
        };
        resolve({
          image: pick([
            /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i
          ]),
          video: pick([
            /<meta[^>]+property="og:video:secure_url"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:video:secure_url"/i,
            /<meta[^>]+property="og:video"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:video"/i
          ]),
          title: pick([
            /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i
          ]),
          desc: pick([
            /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i
          ]),
          finalPathname: pathname
        });
      });
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// Scrape an Instagram post/reel/story via og: tags.
// For /p/ carousel posts, iterates ?img_index=1,2,... to get ALL individual items.
async function scrapeInstagramPost(cleanUrl, res) {
  let parsedUrl;
  try { parsedUrl = new URL(cleanUrl.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }

  let pathname = parsedUrl.pathname;
  const isPostUrl = /\/p\/[^/]+/.test(pathname);

  // Fetch first item — always use img_index=1 so carousels start correctly
  const first = await fetchOgSingle(pathname, isPostUrl ? "?img_index=1" : "");
  if (!first || (!first.image && !first.video)) {
    return res.status(404).json({
      error: "Post not found or private. Make sure the account is public and the link is correct."
    });
  }

  // Instagram may redirect tagged/collab posts to the canonical owner's URL —
  // use that path for the username and any further img_index requests.
  if (first.finalPathname && first.finalPathname !== pathname) pathname = first.finalPathname;
  const urlUsername = extractUsernameFromUrl(`https://www.instagram.com${pathname}`);

  // For non-/p/ URLs (reels, stories) — single item response
  if (!isPostUrl) {
    const mediaUrl = first.video || first.image;
    return res.json({
      type: first.video ? "video" : "image",
      can_preview: !!first.image,
      preview_url: first.image || null,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${first.video ? "video" : "image"}`,
      username: urlUsername,
      title: first.title || "Instagram media",
      caption: first.desc || "",
      thumbnail: first.image || null,
      scraped: true
    });
  }

  // For /p/ posts: detect carousel by checking if img_index=2 gives a DIFFERENT image.
  // Compare by path only — CDN URLs carry random per-request tokens in the query
  // string, so the same image would otherwise always look "different".
  const second = await fetchOgSingle(pathname, "?img_index=2");
  const samePath = (a, b) => {
    try { return new URL(a).pathname === new URL(b).pathname; } catch { return a === b; }
  };
  const isCarousel = !!(second && second.image && !samePath(second.image, first.image));

  if (!isCarousel) {
    // Single photo or video post
    const mediaUrl = first.video || first.image;
    return res.json({
      type: first.video ? "video" : "image",
      can_preview: !!first.image,
      preview_url: first.image || null,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${first.video ? "video" : "image"}`,
      username: urlUsername,
      title: first.title || "Instagram post",
      caption: first.desc || "",
      thumbnail: first.image || null,
      scraped: true
    });
  }

  // CAROUSEL: iterate img_index=1,2,...,20 to collect all unique items
  const items = [];
  const seenKeys = new Set();

  const pushItem = (og, index) => {
    if (!og || !og.image) return false;
    // CDN URLs for the same image share the same path prefix before the query params
    // Use the path part as a de-dup key so minor query differences don't fool us
    let key = og.image;
    try { key = new URL(og.image).pathname; } catch {}
    if (seenKeys.has(key)) return false; // repeated image = end of carousel
    seenKeys.add(key);
    const mediaUrl = og.video || og.image;
    items.push({
      index,
      type: og.video ? "video" : "image",
      preview_url: og.image,
      thumbnail: og.image,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${og.video ? "video" : "image"}`
    });
    return true;
  };

  pushItem(first, 1);
  pushItem(second, 2);

  for (let i = 3; i <= 20; i++) {
    const og = await fetchOgSingle(pathname, `?img_index=${i}`);
    if (!og || !og.image) break;
    if (!pushItem(og, i)) break; // repeated image means we've gone past the last item
  }

  return res.json({
    type: "carousel",
    items,
    item_count: items.length,
    username: urlUsername,
    title: first.title || "Instagram carousel",
    caption: first.desc || "",
    scraped: true
  });
}

// ======================================================
// INSTAGRAM (✅ FULLY WORKING - Preview + Download)
// ======================================================

function buildInstagramResponse(data, cleanUrl) {
  // CAROUSEL POST (multiple photos/videos in one post)
  if (data._type === "playlist" && Array.isArray(data.entries) && data.entries.length > 0) {
    const items = data.entries.map((entry, i) => {
      // Stub entries from yt-dlp have _type:"url" and no formats/vcodec
      const isStub = entry._type === "url" || (!entry.formats && entry.vcodec === undefined);
      const formats = Array.isArray(entry.formats) ? entry.formats : [];

      let isVideo = false;
      let previewUrl = entry.thumbnail || null;

      if (!isStub) {
        isVideo = !!(entry.vcodec && entry.vcodec !== "none");
        if (isVideo) {
          const progressive = formats.filter(
            (f) => f.url && f.vcodec !== "none" && f.acodec !== "none"
          );
          const best = progressive.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
          previewUrl = best?.url || entry.url || entry.thumbnail;
        } else {
          const imgFormats = formats.filter((f) => f.url);
          previewUrl = imgFormats[imgFormats.length - 1]?.url || entry.url || entry.thumbnail;
        }
      }

      // For stub entries, use individual item URL (e.g. ?img_index=N) for download
      const itemUrl = isStub && entry.url && isInstagramUrl(entry.url)
        ? entry.url
        : null;

      const downloadUrl = itemUrl
        ? `/api/instagram/download?url=${encodeURIComponent(itemUrl)}&type=auto`
        : `/api/instagram/download?url=${encodeURIComponent(cleanUrl)}&item=${i + 1}&type=auto`;

      return {
        index: i + 1,
        type: isVideo ? "video" : "image",
        preview_url: previewUrl,
        thumbnail: entry.thumbnail || null,
        download_url: downloadUrl
      };
    });

    // Prefer username found in URL (yt-dlp often returns "Instagram" instead of real username)
    const urlUser = extractUsernameFromUrl(cleanUrl);
    const ytUser = (data.uploader || data.channel || "").toLowerCase();
    const resolvedUser = urlUser || (ytUser && ytUser !== "instagram" ? (data.uploader || data.channel) : null);

    return {
      type: "carousel",
      items,
      item_count: items.length,
      username: resolvedUser,
      title: data.title || "Instagram post",
      caption: data.description || ""
    };
  }

  // SINGLE POST (video or image)
  const formats = Array.isArray(data.formats) ? data.formats : [];
  // Images: ext is jpg/png OR vcodec is "none"
  const isImage = ["jpg", "jpeg", "png", "webp"].includes(data.ext) || data.vcodec === "none";
  const isVideo = !isImage && !!(data.vcodec && data.vcodec !== "none");
  let previewUrl = null;

  if (isVideo) {
    const progressive = formats.filter(
      (f) => f.url && f.vcodec !== "none" && f.acodec !== "none" && (!f.height || f.height <= 720)
    );
    const best = progressive.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
    previewUrl = best?.url || data.url || null;
  } else {
    // Image or unknown — try to get a direct URL
    const imgFormats = formats.filter((f) => f.url);
    previewUrl = imgFormats[imgFormats.length - 1]?.url || data.url || data.thumbnail;
  }

  const urlUser2 = extractUsernameFromUrl(cleanUrl);
  const ytUser2 = (data.uploader || data.channel || "").toLowerCase();
  const resolvedUser2 = urlUser2 || (ytUser2 && ytUser2 !== "instagram" ? (data.uploader || data.channel) : null);

  return {
    type: isVideo ? "video" : "image",
    can_preview: !!(previewUrl && isVideo),
    preview_url: previewUrl || data.thumbnail || null,
    download_url: `/api/instagram/download?url=${encodeURIComponent(cleanUrl)}&type=${isVideo ? "video" : "image"}`,
    username: resolvedUser2,
    title: data.title || "Instagram media",
    caption: data.description || "",
    thumbnail: data.thumbnail || null
  };
}

app.get("/api/instagram", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL. Please paste an Instagram link." });

  const cleanUrl = url.trim();

  // Route profile URLs to the DP scraper (yt-dlp can't fetch profile pictures)
  if (isInstagramProfileUrl(cleanUrl)) {
    return fetchInstagramDP(cleanUrl, res);
  }

  // Stories: extract username from /stories/{username}/{id}/ for the response
  // yt-dlp handles stories the same as reels — fall through to yt-dlp path below

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not installed" });
  }

  // Use shorter timeout for /p/ posts so OG fallback kicks in faster;
  // reels and IGTV get the full 60s since yt-dlp usually works for those.
  const isPostUrl = /\/p\/[^/]+/.test(cleanUrl);
  const ytdlpTimeout = isPostUrl ? 20000 : 60000;

  const metaCmd = `"${YTDLP_PATH}" -J --no-warnings --extractor-retries 2 --socket-timeout 15 "${cleanUrl.replace(/"/g, '\\"')}"`;

  exec(metaCmd, { timeout: ytdlpTimeout, maxBuffer: 30 * 1024 * 1024 }, async (err, stdout, stderr) => {
    if (err) {
      console.error("IG yt-dlp failed, falling back to OG scraping:", (err.message || "").split("\n")[0]);
      try { await scrapeInstagramPost(cleanUrl, res); } catch (e) {
        console.error("OG scrape error:", e.message);
        if (!res.headersSent) res.status(500).json({ error: "Failed to fetch Instagram post. Try again in a moment." });
      }
      return;
    }
    let raw = stdout.trim();
    // yt-dlp sometimes emits warnings before JSON — find first '{'
    const jsonStart = raw.indexOf("{");
    if (jsonStart > 0) raw = raw.slice(jsonStart);
    try {
      const data = JSON.parse(raw);
      res.json(buildInstagramResponse(data, cleanUrl));
    } catch {
      // JSON parse failed — fallback to OG scraping
      console.error("IG JSON parse failed, falling back to OG scraping");
      try { await scrapeInstagramPost(cleanUrl, res); } catch (e) {
        if (!res.headersSent) res.status(500).json({ error: "Failed to parse Instagram response." });
      }
    }
  });
});

// Buffered streaming helper — commits headers only after first byte arrives.
// Prevents 0-byte file downloads when yt-dlp exits with no output.
function streamYtdlp(args, res, filename, contentType, logTag) {
  const child = spawn(YTDLP_PATH, args);
  let dataStarted = false;

  child.stdout.on("data", (chunk) => {
    if (!dataStarted) {
      dataStarted = true;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", contentType);
    }
    res.write(chunk);
  });

  child.stderr.on("data", (d) => console.error(`[${logTag}]`, d.toString().trim()));

  child.on("error", (e) => {
    console.error(`[${logTag}] spawn error:`, e);
    if (!res.headersSent) res.status(500).json({ error: "Download process failed. Please try again." });
    else res.end();
  });

  child.on("close", (code) => {
    if (!dataStarted) {
      console.error(`[${logTag}] no data, exit code:`, code);
      if (!res.headersSent)
        res.status(500).json({ error: "Download failed — no media data received. The post may be private or temporarily unavailable." });
    } else {
      res.end();
    }
  });
}

app.get("/api/instagram/download", (req, res) => {
  const { url, type, item } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL." });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(503).json({ error: "yt-dlp not available" });

  const itemNumber = item ? parseInt(item, 10) : null;
  const retryFlags = ["--extractor-retries", "3", "--socket-timeout", "30", "--no-warnings"];

  if (type === "image") {
    const filename = safeFileName("instagram_photo", ".jpg");
    const args = [...retryFlags, "-o", "-"];
    if (itemNumber) args.push("--playlist-items", String(itemNumber));
    args.push(url);
    streamYtdlp(args, res, filename, "image/jpeg", "IG-photo");

  } else if (type === "auto") {
    // Carousel item or unknown type — let yt-dlp pick best format
    const filename = safeFileName("instagram_media", "");
    const args = [...retryFlags, "-f", "best", "-o", "-"];
    if (itemNumber) args.push("--playlist-items", String(itemNumber));
    args.push(url);
    streamYtdlp(args, res, filename, "application/octet-stream", "IG-auto");

  } else {
    // Video (reels, IGTV, video posts) — no ffmpeg re-encode to avoid silent failure
    const filename = safeFileName("instagram", ".mp4");
    const args = [
      ...retryFlags,
      "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
      "-o", "-",
      url
    ];
    streamYtdlp(args, res, filename, "video/mp4", "IG-video");
  }
});

// Profile picture proxy download (validates CDN domain to prevent SSRF)
app.get("/api/instagram/download-dp", (req, res) => {
  const { url, username } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }

  const allowed = ["cdninstagram.com", "fbcdn.net", "instagram.com"];
  if (!allowed.some((h) => parsed.hostname.endsWith(h))) {
    return res.status(400).json({ error: "URL not allowed" });
  }

  const https = require("https");
  const filename = safeFileName(`${username || "instagram"}_dp`, ".jpg");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "image/jpeg");

  https.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  }, (stream) => {
    stream.pipe(res);
  }).on("error", () => { if (!res.headersSent) res.status(500).end(); });
});

// General CDN media proxy — used for scraped posts where yt-dlp couldn't run
// Validates domain to prevent SSRF, then streams file directly from Instagram's CDN
app.get("/api/instagram/download-proxy", (req, res) => {
  const { url, type, username } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }

  const allowed = ["cdninstagram.com", "fbcdn.net", "instagram.com", "scontent.cdninstagram.com", "video.cdninstagram.com"];
  if (!allowed.some((h) => parsed.hostname.endsWith(h))) {
    return res.status(400).json({ error: "URL domain not allowed" });
  }

  const https = require("https");
  const isVideo = type === "video";
  const ext = isVideo ? ".mp4" : ".jpg";
  const ct = isVideo ? "video/mp4" : "image/jpeg";
  const baseName = `${username || "instagram"}_${isVideo ? "video" : "photo"}`;
  const filename = safeFileName(baseName, ext);

  const httpsReq = https.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.instagram.com/"
    }
  }, (stream) => {
    // Follow one redirect if CDN redirects
    if ((stream.statusCode === 301 || stream.statusCode === 302) && stream.headers.location) {
      stream.destroy();
      return res.redirect(307, `/api/instagram/download-proxy?url=${encodeURIComponent(stream.headers.location)}&type=${type}&username=${username || ""}`);
    }
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", ct);
    if (stream.headers["content-length"]) {
      res.setHeader("Content-Length", stream.headers["content-length"]);
    }
    stream.pipe(res);
    stream.on("error", () => { if (!res.headersSent) res.status(500).end(); });
  });
  httpsReq.on("error", (e) => {
    console.error("[proxy]", e.message);
    if (!res.headersSent) res.status(500).json({ error: "Media download failed. Please try again." });
  });
  httpsReq.on("timeout", () => {
    httpsReq.destroy();
    if (!res.headersSent) res.status(504).json({ error: "Download timed out." });
  });
});

// ======================================================
// YOUTUBE (✅ WORKING WITH COOKIES)
// ======================================================
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isYouTubeUrl(url))
    return res.status(400).json({ error: "Invalid YouTube URL" });
  if (!fs.existsSync(YTDLP_PATH))
    return res.status(503).json({ error: "yt-dlp not installed" });

  const cleanUrl = normalizeYouTube(url);
  if (!isValidYouTubeVideo(cleanUrl))
    return res.status(400).json({ error: "Invalid YouTube video URL" });

  const cookiePath = ensureYouTubeCookies();

  const cmd = `"${YTDLP_PATH}" ${cookiePath ? `--cookies "${cookiePath}"` : ''} -J "${cleanUrl.replace(/"/g, '\\"')}"`;

  exec(cmd, { maxBuffer: 30 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("YouTube error:", stderr || err.message);
      return res.status(503).json({
        error: "YouTube blocked or cookies expired. Try another video."
      });
    }

    let data;
    try {
      data = JSON.parse(stdout);
    } catch {
      return res.status(500).json({ error: "Invalid YouTube response" });
    }

    const formats = Array.isArray(data.formats) ? data.formats : [];
    const progressive = formats.filter(
      (f) =>
        f.url &&
        f.vcodec !== "none" &&
        f.acodec !== "none" &&
        (!f.height || f.height <= 720)
    );

    const best = progressive.sort(
      (a, b) => (b.tbr || 0) - (a.tbr || 0)
    )[0];

    res.json({
      type: "video",
      can_preview: !!best?.url,
      preview_url: best?.url || data.thumbnail || null,
      download_url: `/api/youtube/download?url=${encodeURIComponent(
        cleanUrl
      )}&title=${encodeURIComponent(data.title || "youtube")}`,
      username: data.uploader || data.channel || "youtube",
      title: data.title || "YouTube video"
    });
  });
});

app.get("/api/youtube/download", (req, res) => {
  const { url, title } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isYouTubeUrl(url))
    return res.status(400).json({ error: "Invalid YouTube URL" });
  if (!fs.existsSync(YTDLP_PATH))
    return res.status(503).json({ error: "yt-dlp not available" });

  const cleanUrl = normalizeYouTube(url);
  if (!isValidYouTubeVideo(cleanUrl))
    return res.status(400).json({ error: "Invalid YouTube video URL" });

  const cookiePath = ensureYouTubeCookies();

  const filename = safeFileName(title || "youtube_video", ".mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "video/mp4");

  const args = [
    ...(cookiePath ? ["--cookies", cookiePath] : []),
    "-f",
    "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "--recode-video",
    "mp4",
    "--postprocessor-args",
    "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
    "-o",
    "-",
    cleanUrl
  ];

  const child = spawn(YTDLP_PATH, args);
  child.stdout.pipe(res);
  child.stderr.on("data", (d) =>
    console.error("YT download:", d.toString())
  );
  child.on("close", () => res.end());
});

// ---------- Start server ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ InstantSaver backend: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
