const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 10000;

// CORS — allow instantsaver.in and local dev; block random scrapers
const allowedOrigins = [
  "https://instantsaver.in",
  "https://www.instantsaver.in",
  "http://localhost:3000"
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Render health checks, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // keep permissive for now; tighten after domain is fully stable
  },
  methods: ["GET", "OPTIONS"],
  optionsSuccessStatus: 204
}));

// Force HTTPS redirect
app.use((req, res, next) => {
  if (req.get("X-Forwarded-Proto") !== "https" && req.get("X-Forwarded-Proto")) {
    return res.redirect(301, `https://${req.get("host")}${req.url}`);
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

// ======================================================
// IN-MEMORY RATE LIMITER (no extra npm deps required)
// Resets per window; auto-prunes stale entries.
// ======================================================
const _rlMap = new Map();

function _rlCheck(ip, maxReqs, windowMs) {
  const now = Date.now();
  let e = _rlMap.get(ip);
  if (!e || now > e.resetAt) e = { count: 0, resetAt: now + windowMs };
  e.count++;
  _rlMap.set(ip, e);
  if (_rlMap.size > 10000) {
    for (const [k, v] of _rlMap) { if (now > v.resetAt) _rlMap.delete(k); }
  }
  return e.count <= maxReqs;
}

function rateLimiter(maxReqs, windowMs, msg) {
  return (req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    if (!_rlCheck(ip, maxReqs, windowMs)) {
      return res.status(429).json({ error: msg || "Too many requests — please wait a moment and try again." });
    }
    next();
  };
}

// Preset limiters
const metaLimiter     = rateLimiter(30,  60_000, "Too many lookups. Please wait 1 minute.");
const downloadLimiter = rateLimiter(15,  60_000, "Too many downloads. Please wait 1 minute.");
const dpLimiter       = rateLimiter(20,  60_000, "Too many profile requests. Please wait 1 minute.");

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

// In-memory metadata cache — avoids hammering Instagram for repeated previews of
// the same URL. Entries expire after 5 minutes (og: CDN tokens last ~1 hour).
const _metaCache = new Map();
const META_CACHE_TTL = 5 * 60 * 1000; // 5 min

function metaCacheGet(key) {
  const entry = _metaCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _metaCache.delete(key); return null; }
  return entry.data;
}

function metaCacheSet(key, data) {
  if (_metaCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _metaCache) { if (now > v.expiresAt) _metaCache.delete(k); }
  }
  _metaCache.set(key, { data, expiresAt: Date.now() + META_CACHE_TTL });
}

// Validate hostname is actually instagram.com to prevent SSRF via loose regex
function isInstagramUrl(url) {
  try {
    const u = new URL(url.trim());
    return /^(www\.)?instagram\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
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
    const upath = u.pathname.replace(/\/$/, "");
    const parts = upath.split("/").filter(Boolean);
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
// Uses facebookexternalhit UA (browser UA returns a blank JS shell with no og: tags).
// Follows up to 2 redirects (some profiles redirect to canonical username).
function fetchInstagramDP(profileUrl, res, redirectCount) {
  redirectCount = redirectCount || 0;
  const https = require("https");
  let username = "";
  try {
    const u = new URL(profileUrl.trim());
    username = u.pathname.replace(/\//g, "");
  } catch {
    return res.status(400).json({ error: "Invalid profile URL" });
  }
  if (!username) return res.status(400).json({ error: "Could not extract username from URL" });

  const options = {
    hostname: "www.instagram.com",
    path: `/${username}/`,
    method: "GET",
    timeout: 15000,
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity"
    }
  };

  const req = https.request(options, (response) => {
    // Follow redirects (renamed accounts etc.)
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirectCount < 2) {
      response.resume();
      try {
        const loc = new URL(response.headers.location, "https://www.instagram.com");
        return fetchInstagramDP(loc.href, res, redirectCount + 1);
      } catch {
        return res.status(404).json({ error: "Profile not found." });
      }
    }
    if (response.statusCode === 404) {
      response.resume();
      return res.status(404).json({ error: "Instagram profile not found. Check the username." });
    }
    if (response.statusCode >= 400) {
      response.resume();
      return res.status(404).json({ error: "Could not access this profile. It may be private or unavailable." });
    }

    let html = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { if (html.length < 2000000) html += chunk; });
    response.on("end", () => {
      const pick = (patterns) => {
        for (const p of patterns) {
          const m = html.match(p);
          if (m && m[1]) return m[1].replace(/&amp;/g, "&");
        }
        return null;
      };
      const dpUrl = pick([/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i, /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i]);
      const rawTitle = pick([/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i, /<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i]);
      const ogDesc = pick([/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i, /<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i]);

      if (dpUrl) {
        const displayName = rawTitle ? rawTitle.replace(/\s*\(@[^)]+\).*$/, "").trim() : username;
        return res.json({
          type: "profile",
          username,
          display_name: displayName || username,
          bio: ogDesc || null,
          preview_url: dpUrl,
          can_preview: true,
          download_url: `/api/instagram/download-dp?url=${encodeURIComponent(dpUrl)}&username=${encodeURIComponent(username)}`
        });
      }
      return res.status(404).json({ error: "Profile picture not found. The account may be private or temporarily unavailable." });
    });
  });

  req.on("timeout", () => { req.destroy(); if (!res.headersSent) res.status(504).json({ error: "Profile fetch timed out. Try again." }); });
  req.on("error", () => { if (!res.headersSent) res.status(500).json({ error: "Failed to connect to Instagram. Try again." }); });
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

// CDN path extractor for dedup
function cdnPath(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

// Scrape an Instagram post/reel/story via og: tags.
// For /p/ carousel posts, fetches img_index=1..N in PARALLEL batches for speed.
async function scrapeInstagramPost(cleanUrl) {
  let parsedUrl;
  try { parsedUrl = new URL(cleanUrl.trim()); } catch { return null; }

  let pathname = parsedUrl.pathname;
  const isPostUrl = /\/p\/[^/]+/.test(pathname);

  // Fetch img_index=1 (posts) or no index (reels/stories)
  const first = await fetchOgSingle(pathname, isPostUrl ? "?img_index=1" : "");
  if (!first || (!first.image && !first.video)) return null;

  // Follow canonical redirect (collab/tagged posts redirect to the owner's URL)
  if (first.finalPathname && first.finalPathname !== pathname) pathname = first.finalPathname;
  const urlUsername = extractUsernameFromUrl(`https://www.instagram.com${pathname}`);

  // Non-/p/ URLs (reels, stories) — single item
  if (!isPostUrl) {
    const mediaUrl = first.video || first.image;
    return {
      type: first.video ? "video" : "image",
      can_preview: !!(first.image),
      preview_url: first.image || null,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${first.video ? "video" : "image"}`,
      username: urlUsername,
      title: first.title || "Instagram media",
      caption: first.desc || "",
      thumbnail: first.image || null,
      scraped: true
    };
  }

  // Fetch img_index=2 in PARALLEL with first already done to check for carousel.
  // CDN URLs for the same underlying image have the same path but different query tokens.
  const second = await fetchOgSingle(pathname, "?img_index=2");
  const isCarousel = !!(second && second.image && cdnPath(second.image) !== cdnPath(first.image));

  if (!isCarousel) {
    const mediaUrl = first.video || first.image;
    return {
      type: first.video ? "video" : "image",
      can_preview: !!(first.image),
      preview_url: first.image || null,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${first.video ? "video" : "image"}`,
      username: urlUsername,
      title: first.title || "Instagram post",
      caption: first.desc || "",
      thumbnail: first.image || null,
      scraped: true
    };
  }

  // CAROUSEL: fetch remaining items in parallel batches of 4 for speed
  const items = [];
  const seenPaths = new Set();

  const pushItem = (og, index) => {
    if (!og || !og.image) return false;
    const key = cdnPath(og.image);
    if (seenPaths.has(key)) return false;
    seenPaths.add(key);
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

  // Batch-fetch indices 3–20 in groups of 4 to avoid hammering Instagram
  let done = false;
  for (let batchStart = 3; batchStart <= 20 && !done; batchStart += 4) {
    const indices = [];
    for (let i = batchStart; i < batchStart + 4 && i <= 20; i++) indices.push(i);
    const results = await Promise.all(
      indices.map((i) => fetchOgSingle(pathname, `?img_index=${i}`))
    );
    for (let j = 0; j < results.length; j++) {
      const og = results[j];
      if (!og || !og.image) { done = true; break; }
      if (!pushItem(og, indices[j])) { done = true; break; }
    }
  }

  return {
    type: "carousel",
    items,
    item_count: items.length,
    username: urlUsername,
    title: first.title || "Instagram carousel",
    caption: first.desc || "",
    scraped: true
  };
}

// Wrapper: scrapes and sends response, also populates metadata cache.
async function scrapeInstagramPostCached(cleanUrl, res) {
  const result = await scrapeInstagramPost(cleanUrl);
  if (!result) {
    if (!res.headersSent) {
      res.status(404).json({
        error: "Post not found or private. Make sure the account is public and the link is correct."
      });
    }
    return null;
  }
  metaCacheSet(cleanUrl, result);
  if (!res.headersSent) res.json(result);
  return result;
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
    // can_preview = true for both videos (stream preview) and images (show inline)
    can_preview: !!(previewUrl || data.thumbnail),
    preview_url: previewUrl || data.thumbnail || null,
    download_url: `/api/instagram/download?url=${encodeURIComponent(cleanUrl)}&type=${isVideo ? "video" : "image"}`,
    username: resolvedUser2,
    title: data.title || "Instagram media",
    caption: data.description || "",
    thumbnail: data.thumbnail || null,
    scraped: false
  };
}

app.get("/api/instagram", metaLimiter, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL. Please paste an Instagram link." });

  const cleanUrl = url.trim();

  // Return cached metadata immediately — avoids duplicate fetches for the same post
  const cached = metaCacheGet(cleanUrl);
  if (cached) {
    console.log("[cache hit]", cleanUrl);
    return res.json(cached);
  }

  // Profile URLs → DP scraper (yt-dlp can't fetch profile pictures)
  if (isInstagramProfileUrl(cleanUrl)) {
    return fetchInstagramDP(cleanUrl, res);
  }

  // For every non-profile Instagram URL, try OG scraping FIRST for /p/ posts
  // (yt-dlp is rate-limited on posts; OG scraping is faster and more reliable).
  // For /reel/ and /stories/, fall through to yt-dlp which handles them well.
  const isPostUrl = /\/p\/[^/]+/.test(cleanUrl);

  if (isPostUrl) {
    // OG scraping is the primary path for /p/ posts — yt-dlp is too unreliable
    try {
      const cached2 = await scrapeInstagramPostCached(cleanUrl, res);
      if (cached2 !== null) return; // response already sent
    } catch (e) {
      console.error("OG scrape error for /p/ post:", e.message);
      if (!res.headersSent) res.status(500).json({ error: "Failed to fetch this post. It may be private or unavailable." });
    }
    return;
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    // No yt-dlp — fall back to OG scraping for reels too
    try {
      await scrapeInstagramPostCached(cleanUrl, res);
    } catch (e) {
      if (!res.headersSent) res.status(503).json({ error: "Media extraction service unavailable. Please try again later." });
    }
    return;
  }

  // Reels, IGTV, Stories → yt-dlp (60s timeout; works well for these)
  const metaCmd = `"${YTDLP_PATH}" -J --no-warnings --extractor-retries 2 --socket-timeout 15 "${cleanUrl.replace(/"/g, '\\"')}"`;

  exec(metaCmd, { timeout: 60000, maxBuffer: 30 * 1024 * 1024 }, async (err, stdout, stderr) => {
    if (err) {
      console.error("IG yt-dlp failed, falling back to OG scraping:", (err.message || "").split("\n")[0]);
      try { await scrapeInstagramPostCached(cleanUrl, res); } catch (e) {
        console.error("OG scrape error:", e.message);
        if (!res.headersSent) res.status(500).json({ error: "Failed to fetch this post. It may be private or unavailable." });
      }
      return;
    }
    let raw = stdout.trim();
    const jsonStart = raw.indexOf("{");
    if (jsonStart > 0) raw = raw.slice(jsonStart);
    try {
      const data = JSON.parse(raw);
      const result = buildInstagramResponse(data, cleanUrl);
      metaCacheSet(cleanUrl, result);
      res.json(result);
    } catch {
      console.error("IG JSON parse failed, falling back to OG scraping");
      try { await scrapeInstagramPostCached(cleanUrl, res); } catch (e) {
        if (!res.headersSent) res.status(500).json({ error: "Failed to parse media response. Please try again." });
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

app.get("/api/instagram/download", downloadLimiter, (req, res) => {
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

// Profile picture proxy download (validates CDN domain, checks status before piping)
app.get("/api/instagram/download-dp", dpLimiter, (req, res) => {
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

  const cdnReq = https.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.instagram.com/"
    }
  }, (stream) => {
    // Follow redirect
    if ((stream.statusCode === 301 || stream.statusCode === 302) && stream.headers.location) {
      stream.destroy();
      return res.redirect(307, `/api/instagram/download-dp?url=${encodeURIComponent(stream.headers.location)}&username=${username || ""}`);
    }
    // Verify CDN actually returned the image before committing headers
    if (stream.statusCode !== 200) {
      stream.resume();
      return res.status(502).json({ error: "Profile picture CDN returned an error. The URL may have expired — try previewing again." });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "image/jpeg");
    if (stream.headers["content-length"]) res.setHeader("Content-Length", stream.headers["content-length"]);
    stream.pipe(res);
    stream.on("error", () => { if (!res.headersSent) res.status(500).end(); });
  });
  cdnReq.on("error", () => { if (!res.headersSent) res.status(500).json({ error: "Failed to download profile picture." }); });
  cdnReq.on("timeout", () => { cdnReq.destroy(); if (!res.headersSent) res.status(504).json({ error: "Download timed out." }); });
});

// General CDN media proxy — used for scraped posts where yt-dlp couldn't run
// Validates domain to prevent SSRF, then streams file directly from Instagram's CDN
app.get("/api/instagram/download-proxy", downloadLimiter, (req, res) => {
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
    // Follow redirect
    if ((stream.statusCode === 301 || stream.statusCode === 302) && stream.headers.location) {
      stream.destroy();
      return res.redirect(307, `/api/instagram/download-proxy?url=${encodeURIComponent(stream.headers.location)}&type=${type}&username=${username || ""}`);
    }
    // Verify the CDN actually returned the media before committing headers.
    // Without this check, a 403/404 CDN response gets piped as the "file", creating
    // a corrupt download that has 0 bytes or contains an HTML error body.
    if (stream.statusCode !== 200) {
      stream.resume(); // drain so socket is reused
      return res.status(502).json({
        error: `Media CDN returned HTTP ${stream.statusCode}. The URL may have expired — click Preview again then retry the download.`
      });
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
app.get("/api/youtube", metaLimiter, (req, res) => {
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

  const cmd = `"${YTDLP_PATH}" --no-warnings --socket-timeout 20 ${cookiePath ? `--cookies "${cookiePath}"` : ''} -J "${cleanUrl.replace(/"/g, '\\"')}"`;

  exec(cmd, { timeout: 45000, maxBuffer: 30 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("YouTube error:", (err.message || stderr || "").split("\n")[0]);
      return res.status(503).json({
        error: "YouTube is temporarily unavailable. Please try again in a moment."
      });
    }

    let data;
    try {
      data = JSON.parse(stdout);
    } catch {
      return res.status(500).json({ error: "Invalid YouTube response" });
    }

    const formats = Array.isArray(data.formats) ? data.formats : [];

    // Progressive (pre-muxed) formats — work WITHOUT ffmpeg
    const progressive = formats.filter(
      (f) => f.url && f.vcodec !== "none" && f.acodec !== "none"
    );

    // Available quality buckets (for frontend quality selector)
    const qualityOptions = [];
    const heights = [360, 480, 720];
    heights.forEach((h) => {
      const match = progressive.filter((f) => f.height && f.height <= h)
        .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
      if (match) qualityOptions.push({ label: `${h}p`, height: h });
    });
    // Dedupe
    const uniqueQualities = qualityOptions.filter((q, i, arr) =>
      arr.findIndex((x) => x.height === q.height) === i
    );

    const best = progressive.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];

    // Check if audio-only formats are available (m4a or webm audio)
    const hasAudio = formats.some((f) => f.vcodec === "none" && (f.ext === "m4a" || f.ext === "webm" || f.acodec !== "none"));

    res.json({
      type: "video",
      can_preview: !!best?.url,
      preview_url: best?.url || null,
      thumbnail: data.thumbnail || null,
      download_url: `/api/youtube/download?url=${encodeURIComponent(cleanUrl)}&title=${encodeURIComponent(data.title || "youtube")}`,
      audio_url: hasAudio ? `/api/youtube/audio?url=${encodeURIComponent(cleanUrl)}&title=${encodeURIComponent(data.title || "youtube")}` : null,
      username: data.uploader || data.channel || "YouTube",
      title: data.title || "YouTube video",
      duration: data.duration || null,
      view_count: data.view_count || null,
      quality_options: uniqueQualities.length ? uniqueQualities : [{ label: "720p", height: 720 }]
    });
  });
});

app.get("/api/youtube/download", downloadLimiter, (req, res) => {
  const { url, title, quality } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isYouTubeUrl(url)) return res.status(400).json({ error: "Invalid YouTube URL" });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(503).json({ error: "yt-dlp not available" });

  const cleanUrl = normalizeYouTube(url);
  if (!isValidYouTubeVideo(cleanUrl)) return res.status(400).json({ error: "Invalid YouTube video URL" });

  const cookiePath = ensureYouTubeCookies();

  // Build height-constrained format selector — no ffmpeg needed (picks pre-muxed mp4)
  const h = parseInt(quality, 10);
  const heightCap = [360, 480, 720].includes(h) ? h : 720;
  const fmt = `best[height<=${heightCap}][ext=mp4]/best[height<=${heightCap}]/best[ext=mp4]/best`;

  const filename = safeFileName(title || "youtube_video", ".mp4");
  const args = [
    "--no-warnings",
    "--socket-timeout", "30",
    "--extractor-retries", "2",
    ...(cookiePath ? ["--cookies", cookiePath] : []),
    "-f", fmt,
    "-o", "-",
    cleanUrl
  ];

  streamYtdlp(args, res, filename, "video/mp4", "YT-video");
});

// Audio-only download — uses m4a/webm audio stream (NO ffmpeg required)
app.get("/api/youtube/audio", downloadLimiter, (req, res) => {
  const { url, title } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!isYouTubeUrl(url)) return res.status(400).json({ error: "Invalid YouTube URL" });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(503).json({ error: "yt-dlp not available" });

  const cleanUrl = normalizeYouTube(url);
  if (!isValidYouTubeVideo(cleanUrl)) return res.status(400).json({ error: "Invalid YouTube video URL" });

  const cookiePath = ensureYouTubeCookies();
  const filename = safeFileName(title || "youtube_audio", ".m4a");

  const args = [
    "--no-warnings",
    "--socket-timeout", "30",
    "--extractor-retries", "2",
    ...(cookiePath ? ["--cookies", cookiePath] : []),
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "-o", "-",
    cleanUrl
  ];

  streamYtdlp(args, res, filename, "audio/mp4", "YT-audio");
});

// ---------- Start server ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ InstantSaver backend: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
