// backend/server.js
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

// ---------- YouTube cookies path (TEMP) ----------
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
    ytDlpPath: YTDLP_PATH
  });
});

// ---------- Helpers ----------
function isInstagramUrl(url) {
  return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url || "");
}
function isYouTubeUrl(url) {
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(
    url || ""
  );
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

  console.log(
    "YT_COOKIES present:",
    !!cookies,
    "length:",
    cookies?.length || 0
  );

  if (!cookies) return null;

  try {
    fs.writeFileSync(YT_COOKIES_PATH, cookies, "utf8");
    console.log("✅ YouTube cookies written:", YT_COOKIES_PATH);
    return YT_COOKIES_PATH;
  } catch (e) {
    console.error("❌ Failed to write YouTube cookies:", e);
    return null;
  }
}

// ======================================================
//  INSTAGRAM (❌ UNTOUCHED)
// ======================================================
// 🔒 Instagram code stays EXACTLY the same
// (your existing Instagram preview & download code here)
// ======================================================



// ======================================================
//  YOUTUBE (✅ FIXED)
// ======================================================

// ---------- YouTube PREVIEW ----------
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

  const args = [
    "-J",
    ...(cookiePath ? ["--cookies", cookiePath] : []),
    cleanUrl
  ];

  exec(
    `"${YTDLP_PATH}" ${args.join(" ")}`,
    { maxBuffer: 30 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        console.error("YouTube error:", stderr || err.message);
        return res.status(503).json({
          error: "YouTube blocked or cookies expired"
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
    }
  );
});

// ---------- YouTube DOWNLOAD ----------
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
