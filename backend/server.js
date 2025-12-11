// backend/server.js
const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ---------- yt-dlp PATH (from build step) ----------
const YTDLP_PATH = path.join(__dirname, "bin", "yt-dlp");

// ---------- Health ----------
app.get("/health", (req, res) => {
  const exists = fs.existsSync(YTDLP_PATH);
  const version = exists ? require("child_process").execSync(`${YTDLP_PATH} --version`).toString().trim() : "missing";
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
function normalizeYouTube(url) {
  let u = (url || "").trim().split("?")[0].replace(/\/$/, "");
  const m1 = u.match(/\/shorts\/([^\/]+)/);
  if (m1) return `https://www.youtube.com/watch?v=${m1[1]}`;
  const m2 = u.match(/youtu\.be\/([^\/]+)/);
  if (m2) return `https://www.youtube.com/watch?v=${m2[1]}`;
  return u;
}
function safeFileName(base, ext) {
  const s = String(base || "video").replace(/[^a-z0-9_\-]/gi, "_").slice(0, 40);
  return `${s || "video"}_${Date.now()}${ext}`;
}

// ---------- Instagram PREVIEW ----------
app.get("/api/instagram", (req, res) => {
  const { url } = req.query;
  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not installed. Check build logs." });
  }

  const cmd = `"${YTDLP_PATH}" -J "${url.replace(/"/g, '\\"')}"`;
  exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp Instagram error:", stderr || err.message);
      return res.status(500).json({ error: "Instagram fetch failed", stderr: stderr?.toString() });
    }

    let data;
    try {
      data = JSON.parse(stdout);
    } catch (e) {
      console.error("Instagram JSON parse error:", stdout?.toString()?.slice(0, 500));
      return res.status(500).json({ error: "Invalid Instagram response" });
    }

    const formats = Array.isArray(data.formats) ? data.formats : [];
    const prog = formats.filter(f => f.url && f.vcodec !== "none" && f.acodec !== "none");
    const mp4Prog = prog.filter(f => f.ext === "mp4");
    const candidates = mp4Prog.length ? mp4Prog : prog;

    let preview = null;
    if (candidates.length) {
      preview = candidates.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
    } else if (data.thumbnails?.length) {
      preview = { url: data.thumbnails[data.thumbnails.length - 1].url };
    }

    res.json({
      type: preview?.vcodec ? "video" : "image",
      can_preview: !!(preview?.url),
      preview_url: preview?.url || null,
      download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(data.title || "instagram")}`,
      username: data.uploader || data.channel || "instagram"
    });
  });
});

// ---------- Instagram DOWNLOAD ----------
app.get("/api/instagram/download", (req, res) => {
  const { url } = req.query;
  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not available" });
  }

  const filename = safeFileName("instagram_video", ".mp4");
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

// ---------- YouTube routes (same pattern) ----------
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not installed" });
  }

  const cleanUrl = normalizeYouTube(url);
  const cmd = `"${YTDLP_PATH}" -J "${cleanUrl.replace(/"/g, '\\"')}"`;
  
  exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp YouTube error:", stderr || err.message);
      return res.status(500).json({ error: "YouTube fetch failed" });
    }

    let data;
    try {
      data = JSON.parse(stdout);
    } catch (e) {
      return res.status(500).json({ error: "Invalid YouTube response" });
    }

    const formats = Array.isArray(data.formats) ? data.formats : [];
    const prog = formats.filter(f => f.url && f.vcodec !== "none" && f.acodec !== "none");
    const preview = prog.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();

    res.json({
      type: "video",
      can_preview: !!(preview?.url),
      preview_url: preview?.url || null,
      download_url: `/api/youtube/download?url=${encodeURIComponent(cleanUrl)}&title=${encodeURIComponent(data.title || "youtube")}`,
      username: data.uploader || data.channel || "youtube"
    });
  });
});

app.get("/api/youtube/download", (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
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

app.listen(PORT, () => {
  console.log(`✅ InstantSaver: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
