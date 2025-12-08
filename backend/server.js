const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3001;

// 🚀 Enhanced middleware
app.use(cors({
  origin: ["https://instantsaver.in", "http://localhost:3000"], // Vercel + dev
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "10mb" }));
app.set('timeout', 90000); // 90s timeout for cold starts

// 🛡️ Health check - ping every 14min to prevent Render sleep
app.get('/health', (req, res) => {
  res.json({ status: 'warm', timestamp: Date.now(), uptime: process.uptime() });
});

// --- Helpers (unchanged + improved)
function normalizeYouTube(url) {
  let u = url.trim();
  if (u.includes("/shorts/")) {
    const id = u.split("/shorts/")[1].split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (u.includes("youtu.be/")) {
    const id = u.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return u;
}

function isInstagramUrl(url) {
  return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url);
}

function isYouTubeUrl(url) {
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

function safeFileName(base, ext = ".mp4") {
  const ts = Date.now();
  const safe = String(base || "video")
    .replace(/[^a-z0-9_\-]+/gi, "_")
    .slice(0, 40);
  return `${safe || "video"}_${ts}${ext}`;
}

function isProfileUrl(url) {
  return /^https?:\/\/(www\.)?instagram\.com\/[^\/]+\/?$/.test(url);
}

function choosePreviewUrlFromFormats(formats = []) {
  const progressive = formats.filter(
    (f) => f.url && f.vcodec && f.acodec && f.vcodec !== "none" && f.acodec !== "none"
  );
  const progressiveMp4 = progressive.filter((f) => f.ext === "mp4");
  if (progressiveMp4.length) {
    const best = progressiveMp4.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
    return { url: best.url, type: "video" };
  }
  if (progressive.length) {
    const best = progressive.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
    return { url: best.url, type: "video" };
  }
  const videoOnly = formats.find((f) => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"));
  if (videoOnly) return { url: videoOnly.url, type: "video" };
  
  const thumb = formats.find((f) => f.vcodec === "none" && f.acodec === "none" && f.filesize === undefined);
  if (thumb) return { url: thumb.url, type: "image" };
  
  return { url: null, type: null };
}

// ===================== INSTAGRAM =====================
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL" });

  // ========== 1) PROFILE PICTURE (✅ Working)
  if (isProfileUrl(url)) {
    try {
      const username = url.split("instagram.com/")[1].replace("/", "");
      const apiUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;

      https.get(apiUrl, { timeout: 15000 }, (r) => {
        let data = "";
        r.on("data", (c) => (data += c));
        r.on("end", () => {
          try {
            const json = JSON.parse(data);
            const hd = json?.graphql?.user?.profile_pic_url_hd || json?.graphql?.user?.profile_pic_url;
            if (!hd) return res.json({ error: "DP Not found" });

            return res.json({
              type: "image",
              username,
              preview_url: hd,
              download_url: hd,
              can_preview: true,
            });
          } catch (err) {
            console.error("Instagram profile JSON parse error:", err);
            return res.json({ error: "Failed to fetch DP" });
          }
        });
      }).on("error", (e) => {
        console.error("Instagram profile fetch error:", e.message);
        return res.json({ error: "Failed to fetch DP. Try again." });
      });
      return;
    } catch (e) {
      console.error("Profile fetch failed:", e);
      return res.json({ error: "Profile fetch failed" });
    }
  }

  // ========== 2) REELS / POSTS (🚀 FIXED with timeouts/retries)
  const cmd = `yt-dlp -J --timeout 45 --retries 3 --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${url}"`;

  exec(cmd, { timeout: 45000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (err || stderr.includes("ERROR")) {
      console.error("yt-dlp Instagram error:", stderr || err?.message);
      return res.status(500).json({ 
        error: "Instagram fetch failed", 
        retry: true,
        details: err?.message || stderr || "Server warming up, retry in 10s"
      });
    }

    try {
      const data = JSON.parse(stdout);

      if (data?.thumbnails && (!data.formats || data.formats.length === 0)) {
        const img = data.thumbnails[data.thumbnails.length - 1].url;
        return res.json({
          type: "image",
          username: data.uploader || "unknown",
          preview_url: img,
          download_url: img,
          can_preview: true,
        });
      }

      const pick = choosePreviewUrlFromFormats(data.formats || []);
      return res.json({
        type: pick.type || "video",
        username: data.uploader || "unknown",
        preview_url: pick.url || null,
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(data.title || "instagram")}`,
        can_preview: !!pick.url,
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp (Instagram):", e, stdout?.slice(0, 500));
      return res.status(500).json({ error: "Invalid Instagram response. Try different URL." });
    }
  });
});

app.get("/api/instagram/download", (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const name = safeFileName(title || "instagram_video", ".mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Type", "video/mp4");

  // 🚀 FIXED spawn with timeout handling
  const child = spawn("yt-dlp", [
    "-f", "bv*[vcodec^=avc]+ba[acodec^=mp4a]/b[ext=mp4]",
    "--merge-output-format", "mp4",
    "--timeout", "120",
    "--retries", "2",
    "-o", "-",
    url,
  ], { timeout: 120000 });

  child.stdout.pipe(res);
  child.stderr.on("data", (d) => console.error("yt-dlp download err:", d.toString()));
  
  child.on("error", (e) => {
    console.error("yt-dlp spawn error:", e);
    res.status(500).end();
  });
  child.on("close", (code) => {
    if (code !== 0) console.error(`yt-dlp download exited with code ${code}`);
    res.end();
  });
});

// ======================= YOUTUBE ======================
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!isYouTubeUrl(url)) return res.status(400).json({ error: "Invalid YouTube URL" });

  const cmd = `yt-dlp -J --timeout 45 --retries 3 "${normalizeYouTube(url)}"`;
  
  exec(cmd, { timeout: 45000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp YouTube error:", stderr || err);
      return res.status(500).json({ error: "YouTube fetch failed" });
    }
    
    try {
      const data = JSON.parse(stdout);
      const formats = data.formats || [];
      let preview = null;
      
      const progMp4 = formats.filter((f) => f.url && f.vcodec && f.acodec && f.ext === "mp4");
      if (progMp4.length) preview = progMp4.sort((a,b) => (a.tbr||0)-(b.tbr||0)).pop();
      else {
        const progAny = formats.filter((f) => f.url && f.vcodec && f.acodec);
        if (progAny.length) preview = progAny.sort((a,b) => (a.tbr||0)-(b.tbr||0)).pop();
        else preview = formats.find((f) => f.url && f.vcodec && f.vcodec !== "none");
      }

      res.json({
        type: "video",
        username: data.uploader || "unknown",
        preview_url: preview?.url || null,
        download_url: `/api/youtube/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(data.title || "youtube")}`,
        can_preview: !!preview?.url,
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp (YouTube):", e);
      return res.status(500).json({ error: "Invalid YouTube response" });
    }
  });
});

app.get("/api/youtube/download", (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const clean = normalizeYouTube(url);
  const name = safeFileName(title || "youtube_video", ".mp4");
  
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Type", "video/mp4");

  const child = spawn("yt-dlp", [
    "-f", "best[ext=mp4]/best",
    "--merge-output-format", "mp4",
    "--timeout", "120",
    "-o", "-",
    clean,
  ], { timeout: 120000 });

  child.stdout.pipe(res);
  child.stderr.on("data", (d) => console.error("yt-dlp YouTube err:", d.toString()));
  
  child.on("error", (e) => {
    console.error("yt-dlp YouTube spawn error:", e);
    res.status(500).end();
  });
  child.on("close", (code) => {
    if (code !== 0) console.error(`yt-dlp YouTube exited with code ${code}`);
    res.end();
  });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ InstantSaver backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});
