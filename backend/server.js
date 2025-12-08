const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* ================= HELPERS ================= */

function isInstagramUrl(url) {
  return /(?:https?:\/\/)?(www\.)?instagram\.com\//i.test(url);
}

function isYouTubeUrl(url) {
  return /(?:https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

function normalizeYouTube(url) {
  if (url.includes("/shorts/")) {
    const id = url.split("/shorts/")[1].split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return url;
}

function safeFileName(name, ext = ".mp4") {
  const ts = Date.now();
  return (
    (name || "video")
      .replace(/[^a-z0-9]/gi, "_")
      .slice(0, 40) +
    "_" +
    ts +
    ext
  );
}

function isProfileUrl(url) {
  return /^https?:\/\/(www\.)?instagram\.com\/[^\/]+\/?$/.test(url);
}

/* ================= INSTAGRAM ================= */

// Fetch Instagram metadata (NO preview video)
app.get("/api/instagram", (req, res) => {
  const { url } = req.query;

  if (!url || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }

  // ✅ Profile picture fetch
  if (isProfileUrl(url)) {
    const username = url.split("instagram.com/")[1].replace("/", "");
    const apiUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;

    https
      .get(apiUrl, (r) => {
        let data = "";
        r.on("data", (c) => (data += c));
        r.on("end", () => {
          try {
            const json = JSON.parse(data);
            const dp =
              json?.graphql?.user?.profile_pic_url_hd ||
              json?.graphql?.user?.profile_pic_url;

            if (!dp) return res.json({ error: "DP not found" });

            return res.json({
              type: "image",
              username,
              preview_url: dp,
              download_url: dp,
              can_preview: true,
            });
          } catch {
            return res.json({ error: "Failed to fetch DP" });
          }
        });
      })
      .on("error", () => res.json({ error: "Failed to fetch DP" }));

    return;
  }

  // ✅ Reels / Posts (NO preview to avoid black screen)
  exec(`yt-dlp -J "${url}"`, (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: "Instagram fetch failed" });
    }

    try {
      const data = JSON.parse(stdout);

      return res.json({
        type: "video",
        username: data.uploader || "instagram",
        preview_url: null, // ❌ disabled (important)
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(
          data.title || "instagram_video"
        )}`,
        can_preview: false,
      });
    } catch {
      return res.status(500).json({ error: "Instagram parse error" });
    }
  });
});

// ✅ Instagram download (MOBILE SAFE)
app.get("/api/instagram/download", (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const name = safeFileName(filename, ".mp4");

  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Type", "video/mp4");

  const child = spawn("yt-dlp", [
    "-f",
    "bv*[vcodec^=avc]+ba[acodec^=mp4a]/b[ext=mp4]",
    "--merge-output-format",
    "mp4",
    "--postprocessor-args",
    "ffmpeg:-movflags +faststart",
    "-o",
    "-",
    url,
  ]);

  child.stdout.pipe(res);
  child.stderr.on("data", (d) => console.error(d.toString()));
  child.on("error", () => res.end());
  child.on("close", () => res.end());
});

/* ================= YOUTUBE ================= */

app.get("/api/youtube", (req, res) => {
  const { url } = req.query;

  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  exec(`yt-dlp -J "${normalizeYouTube(url)}"`, (err, stdout) => {
    if (err) return res.status(500).json({ error: "YouTube fetch failed" });

    try {
      const data = JSON.parse(stdout);

      const formats = data.formats || [];
      const preview = formats.find(
        (f) => f.url && f.vcodec !== "none" && f.acodec !== "none" && f.ext === "mp4"
      );

      res.json({
        type: "video",
        username: data.uploader || "youtube",
        preview_url: preview?.url || null,
        download_url: `/api/youtube/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(
          data.title || "youtube_video"
        )}`,
        can_preview: !!preview?.url,
      });
    } catch {
      res.status(500).json({ error: "YouTube parse error" });
    }
  });
});

app.get("/api/youtube/download", (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const cleanUrl = normalizeYouTube(url);
  const name = safeFileName(title, ".mp4");

  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Content-Type", "video/mp4");

  const child = spawn("yt-dlp", [
    "-f",
    "best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "--postprocessor-args",
    "ffmpeg:-movflags +faststart",
    "-o",
    "-",
    cleanUrl,
  ]);

  child.stdout.pipe(res);
  child.stderr.on("data", (d) => console.error(d.toString()));
  child.on("error", () => res.end());
  child.on("close", () => res.end());
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log(`✅ InstantSaver backend running on port ${PORT}`);
});
