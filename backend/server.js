// server.js
const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// Helpers
function isInstagramUrl(url) {
  return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url);
}
function isYouTubeUrl(url) {
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}
function normalizeYouTube(url) {
  let u = url.trim().split("?")[0].replace(/\/$/, "");
  const shorts = u.match(/\/shorts\/([^\/]+)/);
  if (shorts) return `https://www.youtube.com/watch?v=${shorts[1]}`;
  const shortLink = u.match(/youtu\.be\/([^\/]+)/);
  if (shortLink) return `https://www.youtube.com/watch?v=${shortLink[1]}`;
  return u;
}
function safeFileName(base, ext) {
  const s = String(base || "video")
    .replace(/[^a-z0-9_\-]/gi, "_")
    .slice(0, 40);
  return `${s || "video"}_${Date.now()}${ext}`;
}

/**
 * 1) INSTAGRAM PREVIEW
 */
app.get("/api/instagram", (req, res) => {
  const { url } = req.query;
  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  const cmd = `yt-dlp -J "${url}"`;
  exec(cmd, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp Instagram error:", stderr || err.message);
      return res.status(500).json({ error: "Instagram fetch failed", retry: true });
    }

    try {
      const data = JSON.parse(stdout);

      const formats = data.formats || [];
      // progressive formats (video+audio)
      const prog = formats.filter(
        f =>
          f.url &&
          f.vcodec &&
          f.acodec &&
          f.vcodec !== "none" &&
          f.acodec !== "none"
      );
      const mp4Prog = prog.filter(f => f.ext === "mp4");
      const candidates = mp4Prog.length ? mp4Prog : prog;
      let preview = null;
      if (candidates.length) {
        preview = candidates.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
      } else if (data.thumbnails && data.thumbnails.length) {
        preview = { url: data.thumbnails[data.thumbnails.length - 1].url };
      }

      res.json({
        type: preview && preview.vcodec ? "video" : "image",
        can_preview: !!(preview && preview.url && preview.vcodec),
        preview_url: preview ? preview.url : null,
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(
          data.title || "instagram"
        )}`,
        username: data.uploader || "instagram"
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp (Instagram):", e);
      res.status(500).json({ error: "Invalid Instagram response" });
    }
  });
});

/**
 * 2) INSTAGRAM DOWNLOAD (mobile‑friendly MP4)
 */
app.get("/api/instagram/download", (req, res) => {
  const { url, title } = req.query;
  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  const filename = safeFileName(title || "instagram_video", ".mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "video/mp4");

  const args = [
    "-f",
    'best[height<=720][ext=mp4]/best[ext=mp4]/best',
    "--merge-output-format",
    "mp4",
    "--recode-video",
    "mp4",
    "--postprocessor-args",
    "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
    "-o",
    "-",
    url
  ];

  const child = spawn("yt-dlp", args);

  child.stdout.pipe(res);

  child.stderr.on("data", d => console.error("yt-dlp IG err:", d.toString()));

  child.on("error", e => {
    console.error("yt-dlp IG process error:", e);
    if (!res.headersSent) res.status(500).end();
  });

  child.on("close", code => {
    if (code !== 0) console.error("yt-dlp IG exited with code", code);
    if (!res.headersSent) res.end();
  });
});

/**
 * 3) YOUTUBE PREVIEW
 */
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  const clean = normalizeYouTube(url);
  const cmd = `yt-dlp -J "${clean}"`;

  exec(cmd, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp YouTube error:", stderr || err.message);
      return res.status(500).json({ error: "YouTube fetch failed" });
    }

    try {
      const data = JSON.parse(stdout);
      const formats = data.formats || [];

      const prog = formats.filter(
        f =>
          f.url &&
          f.vcodec &&
          f.acodec &&
          f.vcodec !== "none" &&
          f.acodec !== "none"
      );
      const mp4Prog = prog.filter(f => f.ext === "mp4");
      const candidates = mp4Prog.length ? mp4Prog : prog;
      let preview = null;
      if (candidates.length) {
        preview = candidates.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
      }

      res.json({
        type: "video",
        can_preview: !!(preview && preview.url),
        preview_url: preview ? preview.url : null,
        download_url: `/api/youtube/download?url=${encodeURIComponent(clean)}&title=${encodeURIComponent(
          data.title || "youtube_video"
        )}`,
        username: data.uploader || "youtube"
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp (YouTube):", e);
      res.status(500).json({ error: "Invalid YouTube response" });
    }
  });
});

/**
 * 4) YOUTUBE DOWNLOAD (mobile‑friendly MP4)
 */
app.get("/api/youtube/download", (req, res) => {
  const { url, title } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  const clean = normalizeYouTube(url);
  const filename = safeFileName(title || "youtube_video", ".mp4");

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "video/mp4");

  const args = [
    "-f",
    'best[height<=720][ext=mp4]/best[ext=mp4]/best',
    "--merge-output-format",
    "mp4",
    "--recode-video",
    "mp4",
    "--postprocessor-args",
    "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
    "-o",
    "-",
    clean
  ];

  const child = spawn("yt-dlp", args);

  child.stdout.pipe(res);

  child.stderr.on("data", d => console.error("yt-dlp YT err:", d.toString()));

  child.on("error", e => {
    console.error("yt-dlp YT process error:", e);
    if (!res.headersSent) res.status(500).end();
  });

  child.on("close", code => {
    if (code !== 0) console.error("yt-dlp YT exited with code", code);
    if (!res.headersSent) res.end();
  });
});

app.listen(PORT, () => {
  console.log(`✅ InstantSaver backend running: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
