// backend/server.js - FIXED VERSION
const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ---------- yt-dlp PATH ----------
const YTDLP_PATH = path.join(__dirname, "bin", "yt-dlp");

// ---------- Health ----------
app.get("/health", (req, res) => {
  const exists = fs.existsSync(YTDLP_PATH);
  let version = "missing";
  if (exists) {
    try {
      version = require("child_process").execSync(`${YTDLP_PATH} --version`).toString().trim();
    } catch (e) {}
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
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url || "");
}
function isValidYouTubeVideo(url) {
  const clean = normalizeYouTube(url);
  return clean.includes('v=') || clean.includes('youtu.be/');
}
function normalizeYouTube(url) {
  let u = (url || "").trim().split("?")[0].replace(/\/$/, "");
  const m1 = u.match(/\/shorts\/([^\/]+)/);
  if (m1) return `https://www.youtube.com/watch?v=${m1[1]}`;
  const m2 = u.match(/youtu\.be\/([^\/\?]+)/);
  if (m2) return `https://www.youtube.com/watch?v=${m2[1]}`;
  return u;
}
function safeFileName(base, ext) {
  const s = String(base || "video").replace(/[^a-z0-9_\-]/gi, "_").slice(0, 40);
  return `${s}_${Date.now()}${ext}`;
}

// ---------- INSTAGRAM PREVIEW (FIXED - Direct Audio+Video URL) ----------
app.get("/api/instagram", (req, res) => {
  const { url } = req.query;
  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not installed" });
  }

  // FIXED: Get DIRECT progressive format URL with audio+video
  const cmd = `"${YTDLP_PATH}" --get-url -f "best[height<=720][vcodec!=\"none\"][acodec!=\"none\"]/best" "${url.replace(/"/g, '\\"')}"`;
  
  exec(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err || !stdout.trim()) {
      // Fallback: Get JSON metadata
      const fallbackCmd = `"${YTDLP_PATH}" -J "${url.replace(/"/g, '\\"')}"`;
      exec(fallbackCmd, { maxBuffer: 20 * 1024 * 1024 }, (fErr, fStdout) => {
        if (fErr) {
          console.error("Instagram fallback error:", fStdout || fErr.message);
          return res.status(500).json({ error: "Instagram fetch failed", retry: true });
        }
        try {
          const data = JSON.parse(fStdout);
          res.json({
            type: "video",
            can_preview: false,
            preview_url: data.thumbnail,
            download_url: `/api/instagram/download?url=${encodeURIComponent(url)}`,
            username: data.uploader || "instagram",
            title: data.title || "Instagram Video"
          });
        } catch (e) {
          return res.status(500).json({ error: "Instagram parse failed" });
        }
      });
    } else {
      // SUCCESS: Direct URL with audio+video
      res.json({
        type: "video",
        can_preview: true,
        preview_url: stdout.trim(),
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}`,
        username: "instagram",
        title: "Instagram Video"
      });
    }
  });
});

// ---------- INSTAGRAM DOWNLOAD (Already Working) ----------
app.get("/api/instagram/download", (req, res) => {
  const { url } = req.query;
  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not available" });
  }

  const filename = safeFileName("instagram", ".mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "video/mp4");

  const args = [
    "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    "--merge-output-format", "mp4",
    "--recode-video", "mp4",
    "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
    "-o", "-",
    url
  ];

  const child = spawn(YTDLP_PATH, args);
  child.stdout.pipe(res);
  child.stderr.on("data", d => console.error("IG download:", d.toString()));
  child.on("error", e => {
    console.error("IG spawn error:", e);
    if (!res.headersSent) res.status(500).end();
  });
  child.on("close", code => {
    if (code !== 0) console.error("IG close code:", code);
    if (!res.headersSent) res.end();
  });
});

// ---------- YOUTUBE PREVIEW (FIXED - Strict Validation) ----------
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url) || !isValidYouTubeVideo(url)) {
    return res.status(400).json({ 
      error: "Invalid YouTube URL. Use format: youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID",
      example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not installed" });
  }

  const cleanUrl = normalizeYouTube(url);
  const cmd = `"${YTDLP_PATH}" -J "${cleanUrl.replace(/"/g, '\\"')}"`;
  
  exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("YouTube error:", stderr || err.message);
      return res.status(500).json({ error: "YouTube fetch failed", url: cleanUrl });
    }

    let data;
    try {
      data = JSON.parse(stdout);
    } catch (e) {
      return res.status(500).json({ error: "Invalid YouTube response" });
    }

    const formats = Array.isArray(data.formats) ? data.formats : [];
    // FIXED: Better progressive format selection
    const progressive = formats.filter(f => 
      f.url && f.vcodec !== "none" && f.acodec !== "none" && f.height <= 720
    );
    const preview = progressive.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];

    res.json({
      type: "video",
      can_preview: !!(preview?.url),
      preview_url: preview?.url || data.thumbnail,
      download_url: `/api/youtube/download?url=${encodeURIComponent(cleanUrl)}&title=${encodeURIComponent(data.title || "youtube")}`,
      username: data.uploader || data.channel || "youtube",
      title: data.title || "YouTube Video"
    });
  });
});

// ---------- YOUTUBE DOWNLOAD (FIXED - Strict Validation) ----------
app.get("/api/youtube/download", (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url) || !isValidYouTubeVideo(url)) {
    return res.status(400).json({ 
      error: "Invalid YouTube video URL. Must contain video ID (v= or youtu.be)",
      example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not available" });
  }

  const cleanUrl = normalizeYouTube(url);
  const filename = safeFileName("youtube_video", ".mp4");
  
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "video/mp4");

  const args = [
    "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    "--merge-output-format", "mp4",
    "--recode-video", "mp4",
    "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
    "-o", "-",
    cleanUrl
  ];

  const child = spawn(YTDLP_PATH, args);
  child.stdout.pipe(res);
  child.stderr.on("data", d => console.error("YT download:", d.toString()));
  child.on("error", e => {
    console.error("YT spawn error:", e);
    if (!res.headersSent) res.status(500).end();
  });
  child.on("close", code => {
    if (code !== 0) console.error("YT close code:", code);
    if (!res.headersSent) res.end();
  });
});

// ---------- Bind to Render port ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ InstantSaver: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`📱 Instagram + YouTube Preview & Download READY`);
});
