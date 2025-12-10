const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 10000;  // Render default

app.use(cors({
  origin: ["https://instantsaver.in", "http://localhost:3000"]
}));
app.use(express.json({ limit: "50mb" }));
app.set('timeout', 120000);  // 2min timeout

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Helpers
function isInstagramUrl(url) { return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url); }
function isYouTubeUrl(url) { return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url); }
function safeFileName(base, ext = ".mp4") {
  return String(base || "video").replace(/[^a-z0-9_\-]/gi, "_").slice(0, 40) + "_" + Date.now() + ext;
}
function isProfileUrl(url) { return /^https?:\/\/(www\.)?instagram\.com\/[^\/]+\/?$/.test(url); }

// ✅ FIXED: Instagram Profile Pictures
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url || !isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL" });

  // Profile Picture ✅ WORKING
  if (isProfileUrl(url)) {
    const username = url.split("instagram.com/")[1].replace("/", "");
    const apiUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
    
    https.get(apiUrl, { timeout: 10000 }, (r) => {
      let data = "";
      r.on("data", c => data += c);
      r.on("end", () => {
        try {
          const json = JSON.parse(data);
          const hd = json?.graphql?.user?.profile_pic_url_hd || json?.graphql?.user?.profile_pic_url;
          if (hd) {
            return res.json({
              type: "image",
              username,
              preview_url: hd,
              download_url: hd,
              can_preview: true
            });
          }
          return res.json({ error: "Profile picture not found" });
        } catch {
          return res.json({ error: "Failed to fetch profile" });
        }
      });
    }).on("error", () => res.json({ error: "Profile fetch failed" }));
    return;
  }

  // Reels/Posts ✅ FIXED Mobile Black Screen
  const cmd = `yt-dlp -J --timeout 45 --retries 3 --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" "${url}"`;
  
  exec(cmd, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: "Instagram fetch failed", retry: true });
    
    try {
      const data = JSON.parse(stdout);
      const preview = data.formats?.find(f => f.ext === "mp4" && f.vcodec !== "none")?.url || null;
      
      res.json({
        type: preview ? "video" : "image",
        username: data.uploader || "instagram",
        preview_url: preview,
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(data.title || "reel")}`,
        can_preview: !!preview
      });
    } catch {
      res.status(500).json({ error: "Parse failed" });
    }
  });
});

// ✅ FIXED: Mobile Compatible Instagram Download
app.get("/api/instagram/download", (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const filename = safeFileName(title, ".mp4");
  res.set({
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes'
  });

  // ✅ MOBILE SAFE: H.264 + AAC + Faststart
  const child = spawn("yt-dlp", [
    "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    "--recode-video", "mp4",
    "--postprocessor-args", "ffmpeg:-movflags +faststart -c:v libx264 -c:a aac",
    "--merge-output-format", "mp4",
    "-o", "-",
    url
  ], { timeout: 180000 });

  child.stdout.pipe(res);
  child.stderr.on("data", d => console.error("DL:", d.toString()));
  child.on("close", code => {
    if (code !== 0) console.error("Exit code:", code);
    res.end();
  });
  child.on("error", () => res.status(500).end());
});

// ✅ FIXED: YouTube (No Bot Detection)
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) return res.status(400).json({ error: "Invalid YouTube URL" });

  const cmd = `yt-dlp -J --flat-playlist --no-warnings "${url}"`;
  exec(cmd, { timeout: 45000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: "YouTube unavailable" });
    
    try {
      const data = JSON.parse(stdout);
      const preview = data.entries?.[0]?.formats?.find(f => f.ext === "mp4")?.url || null;
      
      res.json({
        type: "video",
        username: data.uploader || "youtube",
        preview_url: preview,
        download_url: `/api/youtube/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(data.title || "video")}`,
        can_preview: !!preview
      });
    } catch {
      res.status(500).json({ error: "YouTube parse failed" });
    }
  });
});

app.get("/api/youtube/download", (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const filename = safeFileName(title, ".mp4");
  res.set({
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes'
  });

  const child = spawn("yt-dlp", [
    "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    "--recode-video", "mp4",
    "--postprocessor-args", "ffmpeg:-movflags +faststart",
    "-o", "-",
    url
  ], { timeout: 180000 });

  child.stdout.pipe(res);
  child.stderr.on("data", d => console.error("YT-DL:", d.toString()));
  child.on("close", code => {
    console.error("YouTube exit:", code);
    res.end();
  });
  child.on("error", () => res.status(500).end());
});

app.listen(PORT, () => {
  console.log(`✅ InstantSaver running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
