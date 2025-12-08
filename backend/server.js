// backend/server.js
const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3001;  // use Render's provided port when available

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

function isProfileUrl(url) {
  // match https://www.instagram.com/username or with trailing slash
  return /^https?:\/\/(www\.)?instagram\.com\/[^\/]+\/?$/.test(url);
}

// Choose best preview format from yt-dlp JSON for browser preview
function choosePreviewUrlFromFormats(formats = []) {
  // 1) Progressive mp4 (video+audio) — best
  const progressive = formats.filter(
    (f) => f.url && f.vcodec && f.acodec && f.vcodec !== "none" && f.acodec !== "none"
  );
  const progressiveMp4 = progressive.filter((f) => f.ext === "mp4");
  if (progressiveMp4.length) {
    // choose highest bitrate
    const best = progressiveMp4.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
    return { url: best.url, type: "video" };
  }
  // 2) Any progressive (non-mp4)
  if (progressive.length) {
    const best = progressive.sort((a, b) => (a.tbr || 0) - (b.tbr || 0)).pop();
    return { url: best.url, type: "video" };
  }
  // 3) If only separate streams (video-only + audio-only) — pick a video-only url for preview (may not play)
  const videoOnly = formats.find((f) => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"));
  if (videoOnly) return { url: videoOnly.url, type: "video" };

  // 4) fallback: thumbnail
  const thumb = formats.find((f) => f.vcodec === "none" && f.acodec === "none" && f.filesize === undefined);
  if (thumb) return { url: thumb.url, type: "image" };

  return { url: null, type: null };
}

// ===================== INSTAGRAM =====================

app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!isInstagramUrl(url)) return res.status(400).json({ error: "Invalid Instagram URL" });

  // ========== 1) PROFILE PICTURE (DP) ==========
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
            const hd = json?.graphql?.user?.profile_pic_url_hd || json?.graphql?.user?.profile_pic_url;

            if (!hd) return res.json({ error: "DP Not found" });

            // Option A: return CDN URL directly (frontend will download it)
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
        console.error("Instagram profile fetch error:", e);
        return res.json({ error: "Failed to fetch DP" });
      });

      return;
    } catch (e) {
      console.error("Profile fetch failed:", e);
      return res.json({ error: "Profile fetch failed" });
    }
  }

  // ========== 2) REELS / POSTS / CAROUSEL ==========
  const cmd = `yt-dlp -J "${url}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp Instagram error:", stderr || err);
      return res.status(500).json({ error: "Instagram fetch failed" });
    }

    try {
      const data = JSON.parse(stdout);

      // If thumbnails exist and formats missing => image post
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

      // Choose a good preview URL (prefer progressive mp4)
      const pick = choosePreviewUrlFromFormats(data.formats || []);
      const previewUrl = pick.url || null;

      return res.json({
        type: pick.type || "video",
        username: data.uploader || "unknown",
        preview_url: previewUrl,
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(
          data.title || "instagram"
        )}`,
        can_preview: !!previewUrl,
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp (Instagram):", e, stdout);
      return res.status(500).json({ error: "Invalid Instagram response" });
    }
  });
});
  
app.get("/api/instagram/download", (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const name = safeFileName(filename || "instagram_video", ".mp4");

  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Type", "video/mp4");

  const { spawn } = require("child_process");

  // ✅ MOBILE-SAFE: Force H.264 video + AAC audio
  const child = spawn("yt-dlp", [
    "-f",
    "bv*[vcodec^=avc]+ba[acodec^=mp4a]/b[ext=mp4]",
    "--merge-output-format",
    "mp4",
    "-o",
    "-",
    url,
  ]);

  // stream the binary output directly to the response
  child.stdout.pipe(res);

  child.stderr.on("data", (d) => console.error("yt-dlp err:", d.toString()));
  child.on("error", (e) => {
    console.error("yt-dlp process error:", e);
    res.end();
  });
  child.on("close", (code) => {
    if (code !== 0) console.error(`yt-dlp exited with code ${code}`);
  });

// ======================= YOUTUBE ======================
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!isYouTubeUrl(url)) return res.status(400).json({ error: "Invalid YouTube URL" });

  const cmd = `yt-dlp -J "${normalizeYouTube(url)}"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp YouTube error:", stderr || err);
      return res.status(500).json({ error: "YouTube fetch failed" });
    }
    try {
      const data = JSON.parse(stdout);

      // pick a progressive mp4 preview if available
      const formats = data.formats || [];
      let preview = null;
      // progressive mp4
      const progMp4 = formats.filter((f) => f.url && f.vcodec && f.acodec && f.ext === "mp4");
      if (progMp4.length) preview = progMp4.sort((a,b)=> (a.tbr||0)-(b.tbr||0)).pop();
      else {
        const progAny = formats.filter((f) => f.url && f.vcodec && f.acodec);
        if (progAny.length) preview = progAny.sort((a,b)=> (a.tbr||0)-(b.tbr||0)).pop();
        else preview = formats.find((f) => f.url && f.vcodec && f.vcodec !== "none");
      }

      res.json({
        type: "video",
        username: data.uploader || "unknown",
        preview_url: preview?.url || null,
        download_url: `/api/youtube/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(data.title)}`,
        can_preview: !!preview?.url,
      });
    } catch (e) {
      console.error("Invalid JSON from yt-dlp (YouTube):", e, stdout);
      return res.status(500).json({ error: "Invalid response from YouTube parser" });
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

  // prefer a single mp4 stream; fallback to best and let yt-dlp/ffmpeg handle merging/recode
  const child = spawn("yt-dlp", [
    "-f",
    "best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    "-",
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
