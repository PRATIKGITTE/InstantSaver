const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3001;  // instead of 3001

app.use(cors());
app.use(express.json());

// --- Helpers
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

// ===================== INSTAGRAM =====================

function isProfileUrl(url) {
  return /^https?:\/\/(www\.)?instagram\.com\/[^\/]+\/?$/.test(url);
}

app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL" });

  // ========== 📌 1. PROFILE PICTURE (DP) ==========
  if (isProfileUrl(url)) {
    try {
      const username = url.split("instagram.com/")[1].replace("/", "");
      const apiUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;

      https.get(apiUrl, (r) => {
        let data = "";
        r.on("data", (c) => (data += c));
        r.on("end", () => {
          try {
            const json = JSON.parse(data);
            const hd = json?.graphql?.user?.profile_pic_url_hd;

            if (!hd) return res.json({ error: "DP Not found" });

            return res.json({
              type: "image",
              username,
              preview_url: hd,
              download_url: hd,
              can_preview: true,
            });
          } catch {
            return res.json({ error: "Failed to fetch DP" });
          }
        });
      });
      return;
    } catch (e) {
      return res.json({ error: "Profile fetch failed" });
    }
  }

  // ========== 📌 2. REELS / POSTS / CAROUSEL ==========
  const cmd = `yt-dlp -J "${url}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp Instagram error:", stderr);
      return res.status(500).json({ error: "Instagram fetch failed" });
    }

    try {
      const data = JSON.parse(stdout);

      // image posts
      if (data?.thumbnails?.length && !data.formats) {
        const img = data.thumbnails[data.thumbnails.length - 1].url;
        return res.json({
          type: "image",
          username: data.uploader || "unknown",
          preview_url: img,
          download_url: img,
          can_preview: true
        });
      }

      // video posts (reels / carousel video)
      const format = data.formats?.find((f) => f.url && f.vcodec !== "none");

      return res.json({
        type: "video",
        username: data.uploader || "unknown",
        preview_url: format?.url || null,
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(
          data.title || "instagram"
        )}`,
        can_preview: !!format?.url,
      });

    } catch (e) {
      console.error("Invalid JSON from yt-dlp:", e, stdout);
      return res.status(500).json({ error: "Invalid Instagram response" });
    }
  });
});


app.get("/api/instagram/download", (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const name = safeFileName(title || "instagram_video", ".mp4");

  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Type", "video/mp4");

  const { spawn } = require("child_process");

  const child = spawn("yt-dlp", [
    "-f", "bestvideo+bestaudio",
    "--merge-output-format", "mp4",
    "-o", "-",
    url,
  ]);

  child.stdout.pipe(res);
  child.stderr.on("data", (d) => console.error("yt-dlp err:", d.toString()));
  child.on("close", (code) => console.log("Done, code:", code));
});



// ======================= YOUTUBE ======================
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!isYouTubeUrl(url))
    return res.status(400).json({ error: "Invalid YouTube URL" });

  const cmd = `yt-dlp -J "${normalizeYouTube(url)}"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp YouTube error:", stderr);
      return res.status(500).json({ error: "YouTube fetch failed" });
    }
    try {
      const data = JSON.parse(stdout);
      const format = data.formats?.find((f) => f.url && f.vcodec !== "none");

      res.json({
        type: "video",
        username: data.uploader || "unknown",
        preview_url: format?.url || null,
        download_url: `/api/youtube/download?url=${encodeURIComponent(
          url
        )}&title=${encodeURIComponent(data.title)}`,
        can_preview: !!format?.url,
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp:", e, stdout);
      return res
        .status(500)
        .json({ error: "Invalid response from YouTube parser" });
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

  const { spawn } = require("child_process");

  // ✅ Select a single mp4 stream with both audio+video
  const child = spawn("yt-dlp", [
    "-f", "best[ext=mp4]",
    "-o", "-", // stream directly
    clean,
  ]);

  child.stdout.pipe(res);

  child.stderr.on("data", (d) => console.error("yt-dlp err:", d.toString()));
  child.on("error", (e) => {
    console.error("yt-dlp process error:", e);
    res.end();
  });
  child.on("close", (code) => {
    if (code !== 0) console.error(`yt-dlp exited with code ${code}`);
  });
});


app.listen(PORT, () => {
  console.log(`✅ InstantSaver backend running: http://localhost:${PORT}`);
});
