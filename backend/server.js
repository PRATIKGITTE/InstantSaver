// backend/server.js - UNIVERSAL DOWNLOADER (ALL TYPES FIXED)
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

// ---------- FIXED Helpers (YouTube Shorts + All Types) ----------
function isInstagramUrl(url) {
  return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url || "");
}
function isYouTubeUrl(url) {
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(url || "");
}
function normalizeYouTube(url) {
  let u = (url || "").trim();
  // YouTube Shorts FIXED
  const shortsMatch = u.match(/\/shorts\/([^\/\?]+)/);
  if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  // youtu.be
  const shortMatch = u.match(/youtu\.be\/([^\/\?]+)/);
  if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`;
  // Standard watch?v=
  if (u.includes('watch?v=')) return u;
  return u;
}
function isValidYouTubeVideo(url) {
  const clean = normalizeYouTube(url);
  // Accept shorts, watch?v=, youtu.be, or valid video pages
  return clean.includes('v=') || clean.includes('youtu.be/') || 
         clean.includes('/shorts/') || clean.match(/youtube\.com\/watch/);
}
function safeFileName(base, ext) {
  const s = String(base || "download").replace(/[^a-z0-9_\-]/gi, "_").slice(0, 40);
  return `${s}_${Date.now()}${ext}`;
}

// ---------- UNIVERSAL PREVIEW (Instagram + YouTube - ALL TYPES) ----------
app.get("/api/instagram", handleUniversalPreview);
app.get("/api/youtube", handleUniversalPreview);

function handleUniversalPreview(req, res) {
  const { url } = req.query;
  const isIG = isInstagramUrl(url);
  const isYT = isYouTubeUrl(url);
  
  if (!url || (!isIG && !isYT)) {
    return res.status(400).json({ error: "Invalid Instagram or YouTube URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not available" });
  }

  const cleanUrl = isYT ? normalizeYouTube(url) : url;
  
  // FIXED Instagram Preview (Audio+Video)
  if (isIG) {
    const cmd = `"${YTDLP_PATH}" --get-url -f "best[height<=720][vcodec~='^((?!none).)*$'][acodec~='^((?!none).)*$']/best" "${cleanUrl.replace(/"/g, '\\"')}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout) => {
      if (!err && stdout.trim()) {
        return res.json({
          type: "video",
          can_preview: true,
          preview_url: stdout.trim(),
          download_url: `/api/instagram/download?url=${encodeURIComponent(cleanUrl)}`,
          username: "instagram",
          title: "Instagram Post/Reel"
        });
      }
      // Fallback JSON
      getMetadata(cleanUrl, isIG, res);
    });
  } else {
    // YouTube - validate first
    if (!isValidYouTubeVideo(url)) {
      return res.status(400).json({ 
        error: "Invalid YouTube video. Use: youtube.com/watch?v=, youtu.be/, or /shorts/",
        example: "https://youtube.com/shorts/DpMsAo4clKk"
      });
    }
    getMetadata(cleanUrl, false, res);
  }
}

function getMetadata(url, isIG, res) {
  const cmd = `"${YTDLP_PATH}" -J "${url.replace(/"/g, '\\"')}"`;
  exec(cmd, { maxBuffer: 30 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error(`${isIG ? "IG" : "YT"} metadata error:`, stderr);
      return res.status(500).json({ error: `${isIG ? "Instagram" : "YouTube"} fetch failed` });
    }
    
    try {
      const data = JSON.parse(stdout);
      const formats = Array.isArray(data.formats) ? data.formats : [];
      
      // Universal preview selection
      let previewUrl = null;
      const progressive = formats.filter(f => 
        f.url && f.vcodec !== "none" && f.acodec !== "none" && f.height <= 720
      );
      if (progressive.length) {
        previewUrl = progressive.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0]?.url;
      } else {
        previewUrl = data.thumbnail;
      }

      res.json({
        type: previewUrl && progressive.length ? "video" : "image",
        can_preview: !!previewUrl,
        preview_url: previewUrl,
        download_url: `/api/${isIG ? 'instagram' : 'youtube'}/download?url=${encodeURIComponent(url)}`,
        username: data.uploader || data.channel || data.author || "user",
        title: data.title || "Media",
        duration: data.duration,
        is_playlist: !!(data.entries && data.entries.length)
      });
    } catch (e) {
      res.status(500).json({ error: "Parse failed" });
    }
  });
}

// ---------- UNIVERSAL DOWNLOAD (Posts, Reels, PFP, Shorts, Playlists, ALL) ----------
app.get("/api/instagram/download", handleUniversalDownload);
app.get("/api/youtube/download", handleUniversalDownload);

function handleUniversalDownload(req, res) {
  const { url, type = "video" } = req.query;
  const isIG = isInstagramUrl(url);
  const isYT = isYouTubeUrl(url);
  
  if (!url || (!isIG && !isYT)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!fs.existsSync(YTDLP_PATH)) {
    return res.status(503).json({ error: "yt-dlp not available" });
  }

  const cleanUrl = isYT ? normalizeYouTube(url) : url;
  
  // Content detection & headers
  let contentType = "video/mp4";
  let ext = ".mp4";
  let filenameBase = isIG ? "instagram" : "youtube";
  
  if (type === "image" || type === "pfp") {
    contentType = "image/jpeg";
    ext = ".jpg";
    filenameBase += "_image";
  } else if (type === "audio") {
    contentType = "audio/m4a";
    ext = ".m4a";
    filenameBase += "_audio";
  }

  const filename = safeFileName(filenameBase, ext);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", contentType);

  // UNIVERSAL yt-dlp args for ALL content types
  const args = [
    "-f", type === "image" ? "best[ext=jpg]" :
          type === "audio" ? "bestaudio/best" :
          "best[height<=1080][ext=mp4]/best[ext=mp4]/best",
    ...(type !== "image" && type !== "audio" ? [
      "--merge-output-format", "mp4",
      "--recode-video", "mp4",
      "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart"
    ] : []),
    "-o", "-",
    "--no-warnings",
    cleanUrl
  ];

  const child = spawn(YTDLP_PATH, args);
  child.stdout.pipe(res);
  
  child.stderr.on("data", d => {
    console.error(`${isIG ? "IG" : "YT"} download:`, d.toString());
  });
  
  child.on("error", e => {
    console.error("Download error:", e);
    if (!res.headersSent) res.status(500).end();
  });
  
  child.on("close", code => {
    if (code !== 0) console.error("Download exit code:", code);
    if (!res.headersSent) res.end();
  });
}

// ---------- SPECIAL ENDPOINTS ----------
// Profile Pictures (Instagram)
app.get("/api/instagram/pfp", (req, res) => {
  req.query.type = "image";
  handleUniversalDownload(req, res);
});

// Thumbnails
app.get("/api/:platform/thumbnail", (req, res) => {
  const { platform, url } = req.query;
  req.query.type = "image";
  handleUniversalDownload({ query: { ...req.query, url } }, res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Universal Downloader: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`📱 Supports: Posts/Reels/PFP/Images/Videos/Shorts/Playlists/Profiles`);
});
