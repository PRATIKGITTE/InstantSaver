const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 10000;

// Standard security headers. crossOriginResourcePolicy is relaxed to "cross-origin"
// because the entire point of this API is serving media/downloads to the Vercel
// frontend (a different origin) — helmet's default "same-origin" CORP would block that.
// CSP is left off: this is a JSON/media API, not an HTML-serving app, so there's no
// injectable page context for CSP to protect.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

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
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "OPTIONS"],
  optionsSuccessStatus: 204
}));
// Turn the CORS middleware's thrown error into a clean 403 instead of a bare 500
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next(err);
});

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
// Render (production) is Linux → "yt-dlp" (matches download-ytdlp.sh's output).
// Local Windows dev → "yt-dlp.exe", so this only ever differs outside of prod.
const YTDLP_PATH = path.join(__dirname, "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

// ---------- ffmpeg PATH ----------
// YouTube no longer reliably serves pre-muxed (video+audio combined) formats, so video
// downloads need ffmpeg to merge separate video/audio streams. Prefer a bundled binary
// (fetched by download-ytdlp.sh on Render) and fall back to a system install (e.g. local
// dev machines that already have ffmpeg on PATH).
const FFMPEG_PATH = (() => {
  const bundled = path.join(__dirname, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  return fs.existsSync(bundled) ? bundled : null; // null → let yt-dlp auto-detect on PATH
})();

// ======================================================
// STRUCTURED LOGGER
// Format: [HH:MM:SS.mmm] [TAG] message
// ======================================================
function ts() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}
function log(tag, ...args) {
  console.log(`[${ts()}] [${tag}]`, ...args);
}
function logErr(tag, ...args) {
  console.error(`[${ts()}] [${tag}] ❌`, ...args);
}

// Request logging middleware — logs every API hit
app.use("/api", (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const status = res.statusCode;
    const emoji = status < 400 ? "✅" : status < 500 ? "⚠️" : "❌";
    log("HTTP", `${emoji} ${req.method} ${req.url} → ${status} (${Date.now() - start}ms)`);
  });
  next();
});

// ---------- YouTube cookies path ----------
const YT_COOKIES_PATH = path.join(os.tmpdir(), "yt-cookies.txt");

// ---------- YouTube player client fallback ----------
// YouTube's "Sign in to confirm you're not a bot" check blocks the default "web" player
// client for anonymous (no-cookie) requests — confirmed live 2026-10-05, 100% repro on
// every video tested, even from a residential IP (this used to work without cookies as of
// 2026-08-30; YouTube tightened bot detection since). Requesting "web,android" makes yt-dlp
// try web first (full format list, highest quality — wins outright when YT_COOKIES is set)
// and silently fall back to the android client for whatever web couldn't get — the android
// client is not subject to this particular bot-check. Trade-off: android-only formats cap
// out around 360p (it doesn't expose the high-res DASH streams the web client does), so
// without cookies this is "works reliably at 360p" instead of "works at up to 1080p" — a
// real quality regression, but strictly better than the current 100% failure. Revisit if
// yt-dlp adds a client with both bot-check immunity AND high-res formats.
const YT_CLIENT_ARGS = ["--extractor-args", "youtube:player_client=web,android"];

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
// NOTE: /stories/highlights/{id}/ carries no username in the path at all — return null
// there so callers fall back to og:title parsing instead of the literal "highlights".
function extractUsernameFromUrl(url) {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    // Pattern: /stories/{username}/{id}/  (but /stories/highlights/{id}/ has no username)
    if (parts[0] === "stories" && parts.length >= 2) {
      return parts[1] === "highlights" ? null : parts[1];
    }
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

// Returns true for instagram.com/stories/highlights/{id}/ URLs
function isInstagramHighlightUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!/instagram\.com$/i.test(u.hostname)) return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] === "stories" && parts[1] === "highlights";
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
    logErr("PROFILE", "Invalid profile URL:", profileUrl);
    return res.status(400).json({ error: "Invalid profile URL" });
  }
  if (!username) {
    logErr("PROFILE", "Empty username extracted from:", profileUrl);
    return res.status(400).json({ error: "Could not extract username from URL" });
  }
  log("PROFILE", `Fetching IG profile: @${username} (redirect#${redirectCount}) via facebookexternalhit UA`);

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
    log("PROFILE", `Instagram responded HTTP ${response.statusCode} for @${username}`);

    // Follow redirects (renamed accounts etc.)
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirectCount < 2) {
      response.resume();
      log("PROFILE", `Redirect → ${response.headers.location}`);
      try {
        const loc = new URL(response.headers.location, "https://www.instagram.com");
        return fetchInstagramDP(loc.href, res, redirectCount + 1);
      } catch {
        logErr("PROFILE", "Bad redirect URL:", response.headers.location);
        return res.status(404).json({ error: "Profile not found." });
      }
    }
    if (response.statusCode === 404) {
      response.resume();
      logErr("PROFILE", `@${username} returned 404 — account not found or renamed`);
      return res.status(404).json({ error: "Instagram profile not found. Check the username." });
    }
    if (response.statusCode >= 400) {
      response.resume();
      logErr("PROFILE", `@${username} returned HTTP ${response.statusCode}`);
      return res.status(404).json({ error: "Could not access this profile. It may be private or unavailable." });
    }

    let html = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { if (html.length < 2000000) html += chunk; });
    response.on("end", () => {
      log("PROFILE", `HTML received: ${html.length} bytes for @${username}`);
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

      log("PROFILE", `og:image=${dpUrl ? "found" : "MISSING"} og:title=${rawTitle ? rawTitle.slice(0,40) : "MISSING"}`);

      if (dpUrl) {
        // Decode HTML entities in title before extracting display name
        const decodeHtml = (s) => s
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
          .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const decodedTitle = rawTitle ? decodeHtml(rawTitle) : "";
        // Strip " (@handle) • Instagram photos and videos" suffix
        const displayName = decodedTitle.replace(/\s*\(@[^)]+\).*$/, "").trim();
        log("PROFILE", `✅ @${username} → display_name="${displayName}" dp_url_len=${dpUrl.length}`);
        return res.json({
          type: "profile",
          username,
          display_name: displayName || username,
          bio: ogDesc || null,
          preview_url: dpUrl,
          profile_url: `https://www.instagram.com/${username}/`,
          can_preview: true,
          download_available: true,
          download_url: `/api/instagram/download-dp?url=${encodeURIComponent(dpUrl)}&username=${encodeURIComponent(username)}`
        });
      }
      logErr("PROFILE", `No og:image in ${html.length}B of HTML for @${username}. First 200 chars: ${html.slice(0,200)}`);
      return res.status(404).json({ error: "Profile picture not found. The account may be private or temporarily unavailable." });
    });
  });

  req.on("timeout", () => {
    req.destroy();
    logErr("PROFILE", `Timeout fetching @${username}`);
    if (!res.headersSent) res.status(504).json({ error: "Profile fetch timed out. Try again." });
  });
  req.on("error", (e) => {
    logErr("PROFILE", `Network error for @${username}: ${e.message}`);
    if (!res.headersSent) res.status(500).json({ error: "Failed to connect to Instagram. Try again." });
  });
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
  log("OG", `fetch ${pathname}${search || ""} (redirect#${redirectCount})`);
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
      if (response.statusCode >= 400) {
        logErr("OG", `HTTP ${response.statusCode} for ${pathname}${search || ""}`);
        return resolve(null);
      }
      let html = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { if (html.length < 2000000) html += chunk; });
      response.on("end", () => {
        log("OG", `${pathname}${search||""} → ${html.length}B HTML, status=${response.statusCode}`);
        const pick = (patterns) => {
          for (const p of patterns) {
            const m = html.match(p);
            if (m && m[1]) return m[1].replace(/&amp;/g, "&");
          }
          return null;
        };
        // Decode HTML entities in text fields (og: content always HTML-escaped)
        const decodeHtml = (s) => !s ? s : s
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

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
          title: decodeHtml(pick([
            /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i
          ])),
          desc: decodeHtml(pick([
            /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
            /<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i
          ])),
          finalPathname: pathname
        });
      });
    });
    req.on("timeout", () => {
      logErr("OG", `Timeout on ${pathname}${search||""}`);
      req.destroy(); resolve(null);
    });
    req.on("error", (e) => {
      logErr("OG", `Network error on ${pathname}${search||""}: ${e.message}`);
      resolve(null);
    });
    req.end();
  });
}

// CDN path extractor for dedup
function cdnPath(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

// Attempt to resolve EVERY item of a carousel post via Instagram's own internal GraphQL
// endpoint — the same one instagram.com's own web app calls client-side to render a post,
// not a deprecated/legacy API. Unlike yt-dlp (which can detect a carousel's item COUNT via
// the playlist but gets `null` for every individual entry) and the old `?img_index=N` trick
// (Instagram stopped varying the response by it), this endpoint — when it works — returns
// the full `edge_sidecar_to_children` list with a real image/video URL for every slide, with
// NO login/cookie required. Technique + exact doc_id confirmed against a live, maintained
// open-source scraper (github.com/ahmedrangel/instagram-media-scraper, scraper_graphql.js)
// rather than guessed — Instagram rotates this doc_id occasionally as their web app
// redeploys, so this WILL need the value refreshed again at some point; when it stops
// working, re-check that project (or inspect instagram.com's own network tab for the
// current doc_id their post-page component calls) rather than assuming the whole approach
// is dead. Also subject to normal anonymous-request rate limiting — on 2026-10-04 this
// returned "Rate limit exceeded" (not an auth/doc_id error) after this same dev IP had
// already made many other Instagram requests that session; a clean IP should succeed.
async function fetchCarouselViaGraphQL(shortcode) {
  const https = require("https");
  const body = new URLSearchParams({
    variables: JSON.stringify({ shortcode }),
    doc_id: "10015901848480474",
    lsd: "AVqbxe3J_YA"
  }).toString();

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "www.instagram.com",
        path: "/api/graphql",
        method: "POST",
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "X-IG-App-ID": "936619743392459",
          "X-FB-LSD": "AVqbxe3J_YA",
          "X-ASBD-ID": "129477",
          "Sec-Fetch-Site": "same-origin"
        }
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { if (raw.length < 2000000) raw += chunk; });
        response.on("end", () => {
          try {
            const json = JSON.parse(raw);
            const media = json?.data?.xdt_shortcode_media;
            if (!media) {
              logErr("GRAPHQL", `No xdt_shortcode_media for ${shortcode}: ${raw.slice(0, 200)}`);
              return resolve(null);
            }
            resolve(media);
          } catch (e) {
            logErr("GRAPHQL", `Parse failed for ${shortcode}: ${e.message} — raw: ${raw.slice(0, 200)}`);
            resolve(null);
          }
        });
      }
    );
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", (e) => { logErr("GRAPHQL", `Request error for ${shortcode}: ${e.message}`); resolve(null); });
    req.write(body);
    req.end();
  });
}

// Converts a GraphQL `xdt_shortcode_media` carousel node into our normal items[] shape.
function buildCarouselFromGraphQL(media, cleanUrl) {
  const edges = media?.edge_sidecar_to_children?.edges;
  if (!Array.isArray(edges) || edges.length === 0) return null;

  const items = edges.map((edge, i) => {
    const node = edge.node;
    const isVideo = !!node.is_video;
    const mediaUrl = isVideo ? node.video_url : node.display_url;
    return {
      index: i + 1,
      type: isVideo ? "video" : "image",
      preview_url: mediaUrl || null,
      thumbnail: node.display_url || null,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${isVideo ? "video" : "image"}`
    };
  });

  return {
    type: "carousel",
    items,
    item_count: items.length,
    total_items: items.length,
    username: media.owner?.username || extractUsernameFromUrl(cleanUrl),
    title: media.owner?.username ? `Post by ${media.owner.username}` : "Instagram post",
    caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || ""
  };
}

// Scrape an Instagram post/reel/story via og: tags.
// For /p/ carousel posts, fetches img_index=1..N in PARALLEL batches for speed.
async function scrapeInstagramPost(cleanUrl) {
  let parsedUrl;
  try { parsedUrl = new URL(cleanUrl.trim()); } catch { return null; }

  let pathname = parsedUrl.pathname;
  const isPostUrl = /\/p\/[^/]+/.test(pathname);
  const isHighlightPath = /\/stories\/highlights\//.test(pathname);
  // Highlights are multi-slide just like carousels (a saved reel of several stories),
  // so they need the same img_index pagination — not the single-item path used for
  // plain reels/stories.
  const isMultiSlide = isPostUrl || isHighlightPath;

  log("OG-SCRAPE", `Starting scrape: ${pathname} isPost=${isPostUrl} isHighlight=${isHighlightPath}`);

  // Fetch img_index=1 (posts/highlights) or no index (reels/stories)
  const first = await fetchOgSingle(pathname, isMultiSlide ? "?img_index=1" : "");
  if (!first || (!first.image && !first.video)) {
    logErr("OG-SCRAPE", `No og:image/video found for ${pathname}. first=${JSON.stringify(first)}`);
    return null;
  }
  log("OG-SCRAPE", `First OG data: image=${!!first.image} video=${!!first.video} finalPath=${first.finalPathname}`);

  // Follow canonical redirect (collab/tagged posts redirect to the owner's URL)
  if (first.finalPathname && first.finalPathname !== pathname) pathname = first.finalPathname;
  const urlUsername = extractUsernameFromUrl(`https://www.instagram.com${pathname}`);

  // Non-/p/, non-highlight URLs (reels, stories) — single item
  if (!isMultiSlide) {
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

  // Fetch img_index=2 in PARALLEL with first already done to check for carousel/multi-slide highlight.
  // CDN URLs for the same underlying image have the same path but different query tokens.
  //
  // ⚠️ KNOWN BROKEN (found 2026-08-30 via live testing): Instagram appears to have
  // stopped honoring ?img_index=N for anonymous/facebookexternalhit requests — both
  // img_index=1 and img_index=2 now return the identical first slide's image, so
  // `isCarousel` here evaluates false for real multi-item carousels (confirmed against
  // several live carousel posts, cross-checked with `yt-dlp -J` showing the true
  // playlist_count > 1). Every carousel is currently silently collapsed to a single
  // image. Since /p/ posts use this OG-scrape path as PRIMARY (not yt-dlp — see the
  // comment above the /api/instagram route), this needs a different multi-item
  // detection signal before carousels work again — img_index can no longer be trusted.
  const second = await fetchOgSingle(pathname, "?img_index=2");
  const isCarousel = !!(second && second.image && cdnPath(second.image) !== cdnPath(first.image));
  log("OG-SCRAPE", `isCarousel=${isCarousel} (img1_path=${cdnPath(first.image||"").slice(-30)} img2_path=${cdnPath(second?.image||"").slice(-30)})`);

  if (!isCarousel) {
    const mediaUrl = first.video || first.image;
    return {
      type: first.video ? "video" : "image",
      can_preview: !!(first.image),
      preview_url: first.image || null,
      download_url: `/api/instagram/download-proxy?url=${encodeURIComponent(mediaUrl)}&type=${first.video ? "video" : "image"}`,
      username: urlUsername,
      title: first.title || (isHighlightPath ? "Instagram highlight" : "Instagram post"),
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

  log("OG-SCRAPE", `Carousel complete: ${items.length} items`);
  return {
    type: "carousel",
    items,
    item_count: items.length,
    username: urlUsername,
    title: first.title || (isHighlightPath ? "Instagram highlight" : "Instagram carousel"),
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
    const totalItems = data.entries.length;
    // Instagram currently blocks per-item carousel extraction for unauthenticated
    // requests — yt-dlp reports `null` for entries it couldn't resolve (observed a 100%
    // null rate across every real carousel tested 2026-08-30). Filter those out rather
    // than crash on `null.formats`; item_count can end up less than totalItems, even 0.
    const resolvableEntries = data.entries
      .map((entry, i) => [entry, i])
      .filter(([entry]) => entry != null);

    const items = resolvableEntries.map(([entry, i]) => {
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

    // Prefer username found in URL, then yt-dlp's `channel` (actual @handle) —
    // `uploader` is the display name (e.g. "Pratikssha Honmukhe"), not the handle.
    const urlUser = extractUsernameFromUrl(cleanUrl);
    const ytUser = (data.channel || data.uploader || "").toLowerCase();
    const resolvedUser = urlUser || (ytUser && ytUser !== "instagram" ? (data.channel || data.uploader) : null);

    return {
      type: "carousel",
      items,
      item_count: items.length,
      total_items: totalItems,
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
  const ytUser2 = (data.channel || data.uploader || "").toLowerCase();
  const resolvedUser2 = urlUser2 || (ytUser2 && ytUser2 !== "instagram" ? (data.channel || data.uploader) : null);

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
  if (!isInstagramUrl(url)) {
    logErr("IG", `Invalid URL rejected: ${url}`);
    return res.status(400).json({ error: "Invalid Instagram URL. Please paste an Instagram link." });
  }

  const cleanUrl = url.trim();
  log("IG", `→ ${cleanUrl}`);

  // Detect URL type for logging
  const isProfileUrl   = isInstagramProfileUrl(cleanUrl);
  const isPostUrl      = /\/p\/[^/]+/.test(cleanUrl);
  const isReelUrl      = /\/reel\/[^/]+/.test(cleanUrl);
  const isHighlightUrl = isInstagramHighlightUrl(cleanUrl);
  const isStoryUrl     = /\/stories\//.test(cleanUrl);
  const urlType        = isProfileUrl ? "PROFILE" : isPostUrl ? "POST" : isReelUrl ? "REEL" : isHighlightUrl ? "HIGHLIGHT" : isStoryUrl ? "STORY" : "UNKNOWN";
  log("IG", `URL type: ${urlType}`);

  // Cache hit
  const cached = metaCacheGet(cleanUrl);
  if (cached) {
    log("IG", `Cache hit for ${urlType}: ${cleanUrl}`);
    return res.json(cached);
  }

  // ── PROFILE ──────────────────────────────────────────────────
  if (isProfileUrl) {
    log("IG", `Extractor: OG_PROFILE (facebookexternalhit UA)`);
    return fetchInstagramDP(cleanUrl, res);
  }

  // ── REEL / STORY / IGTV / POST — use yt-dlp with OG fallback ────────
  // NOTE: /p/ posts used to skip straight to OG-scrape ("yt-dlp is rate-limited on
  // /p/ posts") but that meant carousels were silently shown as a single image with no
  // way to know more items existed — OG-scrape's img_index carousel-detection no longer
  // works at all (Instagram stopped varying the returned image by img_index). yt-dlp's
  // playlist_count is still a reliable multi-item signal even though it currently can't
  // resolve individual carousel items either (see the merge-fallback below) — routing
  // posts through here restores at least an honest "N items" count. Watch Render logs
  // after deploy in case this reintroduces the rate-limiting the old comment warned
  // about; the OG-scrape fallback below means a regression degrades back to today's
  // single-image behavior, not a hard failure.
  if (!fs.existsSync(YTDLP_PATH)) {
    log("IG", `yt-dlp not found at ${YTDLP_PATH} — falling back to OG scraping for ${urlType}`);
    try {
      await scrapeInstagramPostCached(cleanUrl, res);
    } catch (e) {
      logErr("IG", `OG fallback failed: ${e.message}`);
      if (!res.headersSent) res.status(503).json({ error: "Media extraction unavailable. Please try again later." });
    }
    return;
  }

  log("IG", `Extractor: YTDLP (${urlType}, 60s timeout)`);
  const metaCmd = `"${YTDLP_PATH}" -J --no-warnings --extractor-retries 2 --socket-timeout 15 "${cleanUrl.replace(/"/g, '\\"')}"`;

  exec(metaCmd, { timeout: 60000, maxBuffer: 30 * 1024 * 1024 }, async (err, stdout, stderr) => {
    // yt-dlp can exit non-zero (err truthy) while STILL printing valid, useful JSON to
    // stdout — e.g. a carousel where individual items fail to extract but the
    // playlist-level metadata (crucially, the real item count) is still there. Try
    // parsing stdout regardless of exit code before giving up on yt-dlp entirely.
    let raw = (stdout || "").trim();
    const jsonStart = raw.indexOf("{");
    if (jsonStart > 0) raw = raw.slice(jsonStart);

    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = null; }
    }

    if (!data) {
      if (err) logErr("IG", `yt-dlp failed (${urlType}): ${(err.message || "").split("\n")[0]}`);
      log("IG", `Falling back to OG scraping for ${urlType}`);
      try {
        await scrapeInstagramPostCached(cleanUrl, res);
      } catch (e) {
        logErr("IG", `OG fallback also failed: ${e.message}`);
        if (!res.headersSent) res.status(500).json({ error: "Failed to fetch this post. It may be private or unavailable." });
      }
      return;
    }

    log("IG", `yt-dlp success: type=${data._type||"single"} uploader="${data.uploader||"?"}" ext=${data.ext||"?"}${err ? " (exited non-zero but stdout had usable JSON)" : ""}`);
    let result = buildInstagramResponse(data, cleanUrl);

    // yt-dlp correctly detected a multi-item post (total_items) but couldn't resolve
    // ANY individual entry — Instagram currently blocks per-item carousel extraction via
    // yt-dlp for unauthenticated requests. Before falling back to a single-image result,
    // try the GraphQL sidecar endpoint (fetchCarouselViaGraphQL) — when it's not rate
    // limited and the doc_id is current, it resolves every real item, not just one.
    if (result.type === "carousel" && result.item_count === 0 && result.total_items > 0) {
      const shortcodeMatch = cleanUrl.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reels?|reel)\/([A-Za-z0-9-_]+)/);
      if (shortcodeMatch) {
        log("IG", `Trying GraphQL sidecar fetch for full carousel (${result.total_items} items, shortcode=${shortcodeMatch[1]})`);
        const media = await fetchCarouselViaGraphQL(shortcodeMatch[1]);
        const graphqlResult = media && buildCarouselFromGraphQL(media, cleanUrl);
        if (graphqlResult && graphqlResult.item_count > 0) {
          log("IG", `GraphQL sidecar resolved ${graphqlResult.item_count}/${result.total_items} real items`);
          metaCacheSet(cleanUrl, graphqlResult);
          return res.json(graphqlResult);
        }
        log("IG", `GraphQL sidecar fetch did not yield items — falling back to OG-scrape for the first item`);
      }
      log("IG", `Playlist had 0/${result.total_items} resolvable entries — falling back to OG-scrape for the first item`);
      const ytResult = result; // yt-dlp's own metadata — caption/username here are cleaner
      // (real caption text, no "5M likes, 44K comments -" prefix; real @handle via `channel`)
      // than OG-scrape's, so prefer them and only use ogResult for the actual image/video.
      const ogResult = await scrapeInstagramPost(cleanUrl);
      if (ogResult) {
        // Keep type "carousel" (not ogResult's "image"/"video") so the frontend still
        // renders the grid — with the one item we have — instead of silently collapsing
        // a 4-item post into what looks like a complete single-image post.
        result = {
          type: "carousel",
          items: [{
            index: 1,
            type: ogResult.type,
            preview_url: ogResult.preview_url,
            thumbnail: ogResult.thumbnail,
            download_url: ogResult.download_url
          }],
          item_count: 1,
          total_items: ytResult.total_items,
          username: ytResult.username || ogResult.username,
          title: ytResult.title || ogResult.title,
          caption: ytResult.caption || ogResult.caption
        };
      } else {
        if (!res.headersSent) {
          return res.status(404).json({ error: "Post not found or private. Make sure the account is public and the link is correct." });
        }
        return;
      }
    }

    metaCacheSet(cleanUrl, result);
    res.json(result);
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

// Downloads via yt-dlp to a REAL temp file (not stdout) — needed whenever the format
// selector merges separate video+audio streams, since piping a merge straight to
// stdout only produces a broken container (MP4 muxing needs a seekable output for its
// moov atom). Streams the resulting file to the client, then sweeps up every temp file
// sharing this request's prefix (the final merged file plus any per-format
// intermediates yt-dlp occasionally leaves behind). Shared by /api/youtube/download and
// the Instagram video branch of /api/instagram/download — both need it because YouTube
// and Instagram alike now frequently only expose split DASH streams above ~720p.
function mergeDownloadYtdlp(args, res, tempId, tempOut, filename, contentType, logTag) {
  const child = spawn(YTDLP_PATH, args);
  let stderrTail = "";
  child.stderr.on("data", (d) => { stderrTail = (stderrTail + d.toString()).slice(-4000); });

  const cleanupTemp = () => {
    fs.readdir(os.tmpdir(), (err, files) => {
      if (err) return;
      for (const f of files) {
        if (f.startsWith(tempId)) fs.unlink(path.join(os.tmpdir(), f), () => {});
      }
    });
  };

  child.on("error", (e) => {
    logErr(logTag, `spawn error: ${e.message}`);
    if (!res.headersSent) res.status(500).json({ error: "Download process failed. Please try again." });
    cleanupTemp();
  });

  child.on("close", (code) => {
    if (code !== 0 || !fs.existsSync(tempOut)) {
      logErr(logTag, `exit ${code}: ${stderrTail.split("\n").filter(Boolean).slice(-3).join(" | ")}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download failed. This may be restricted, private, or temporarily unavailable." });
      }
      cleanupTemp();
      return;
    }
    const stat = fs.statSync(tempOut);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    const readStream = fs.createReadStream(tempOut);
    readStream.on("error", (e) => {
      logErr(logTag, `read stream error: ${e.message}`);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    readStream.on("close", cleanupTemp);
    res.on("close", cleanupTemp);
    readStream.pipe(res);
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
    // Video (reels, IGTV, video posts). Used to cap at height<=720 with no ffmpeg —
    // confirmed live on a real reel that this leaves real quality on the table: true
    // best available was 1080x1920 (VP9 video-only DASH + separate AAC audio-only DASH,
    // no progressive/muxed option above 720p) — same split-stream situation YouTube is
    // in. Merge via ffmpeg into a real temp file for genuine full-quality downloads.
    const filename = safeFileName("instagram", ".mp4");
    const tempId = `ig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempOut = path.join(os.tmpdir(), `${tempId}.mp4`);
    const fmt = "bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo+bestaudio/best";
    const args = [
      ...retryFlags,
      "-f", fmt,
      "--merge-output-format", "mp4",
      ...(FFMPEG_PATH ? ["--ffmpeg-location", FFMPEG_PATH] : []),
      "-o", tempOut
    ];
    if (itemNumber) args.push("--playlist-items", String(itemNumber));
    args.push(url);
    mergeDownloadYtdlp(args, res, tempId, tempOut, filename, "video/mp4", "IG-video");
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

  const cmd = `"${YTDLP_PATH}" --no-warnings --socket-timeout 20 ${YT_CLIENT_ARGS.join(" ")} ${cookiePath ? `--cookies "${cookiePath}"` : ''} -J "${cleanUrl.replace(/"/g, '\\"')}"`;

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

    // Available quality buckets (for frontend quality selector). Based on ALL formats
    // (not just `progressive`) since /api/youtube/download can merge separate video-only
    // + audio-only DASH streams via ffmpeg to reach resolutions progressive alone doesn't
    // have. Only offer a tier the extraction actually has a format for — previously this
    // always offered 360/480/720 as long as SOME lower-height format existed (the "<=h"
    // filter matches a 360p format for the 720p bucket too), so a user could pick "720p"
    // and silently receive 360p. Real-world trigger: YouTube's bot-check currently forces
    // the android player client fallback (see YT_CLIENT_ARGS above), which only exposes
    // formats up to 360p — before this fix, the selector still showed fake 480p/720p
    // buttons in that case.
    const allHeights = formats.map((f) => f.height).filter(Boolean);
    const maxAvailableHeight = allHeights.length ? Math.max(...allHeights) : 0;
    const uniqueQualities = [360, 480, 720]
      .filter((h) => h <= maxAvailableHeight)
      .map((h) => ({ label: `${h}p`, height: h }));
    if (!uniqueQualities.length && maxAvailableHeight) {
      uniqueQualities.push({ label: `${maxAvailableHeight}p`, height: maxAvailableHeight });
    }

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
      quality_options: uniqueQualities
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

  // YouTube stopped reliably serving pre-muxed (video+audio combined) formats — nearly
  // every video now only offers separate video-only and audio-only streams. Piping a
  // video+audio merge straight to stdout ("-o -") only produces a broken MPEG-TS stream
  // mislabeled as .mp4 (MP4 muxing needs a seekable output for its moov atom), so this
  // downloads to a real temp file first, then streams that file to the client and deletes
  // it afterward. Prefer H.264 + AAC (near-universal playback support) over AV1/VP9 + Opus
  // when both are available for the requested height.
  const h = parseInt(quality, 10);
  const heightCap = [360, 480, 720].includes(h) ? h : 720;
  const fmt = `bestvideo[height<=${heightCap}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${heightCap}]+bestaudio/best[height<=${heightCap}]`;

  const filename = safeFileName(title || "youtube_video", ".mp4");
  const tempId = `yt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempOut = path.join(os.tmpdir(), `${tempId}.mp4`);

  const args = [
    "--no-warnings",
    "--socket-timeout", "30",
    "--extractor-retries", "2",
    ...YT_CLIENT_ARGS,
    ...(cookiePath ? ["--cookies", cookiePath] : []),
    "-f", fmt,
    "--merge-output-format", "mp4",
    ...(FFMPEG_PATH ? ["--ffmpeg-location", FFMPEG_PATH] : []),
    "-o", tempOut,
    cleanUrl
  ];

  mergeDownloadYtdlp(args, res, tempId, tempOut, filename, "video/mp4", "YT-video");
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
    ...YT_CLIENT_ARGS,
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
