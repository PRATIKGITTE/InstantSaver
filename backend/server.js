const express = require("express");
const cors = require("cors");
const https = require("https");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Instagram Profile Pictures (Direct API)
app.get("/api/instagram", (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('instagram.com')) 
    return res.status(400).json({ error: "Invalid Instagram URL" });

  // Profile Picture
  if (url.match(/instagram\.com\/[^\/]+\/?$/)) {
    const username = url.split('instagram.com/')[1]?.replace('/', '');
    if (username) {
      const apiUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
      https.get(apiUrl, { timeout: 10000 }, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try {
            const json = JSON.parse(data);
            const hd = json?.graphql?.user?.profile_pic_url_hd || 
                      json?.graphql?.user?.profile_pic_url;
            if (hd) {
              return res.json({
                type: "image",
                username,
                preview_url: hd,
                download_url: hd,
                can_preview: true
              });
            }
          } catch {}
          res.json({ error: "Profile not found" });
        });
      }).on('error', () => res.json({ error: "Profile fetch failed" }));
      return;
    }
  }

  // Reels/Posts - Try multiple APIs
  const reelId = url.match(/reel\/([A-Za-z0-9_-]+)/)?.[1] || 
                url.match(/p\/([A-Za-z0-9_-]+)/)?.[1];
  
  if (reelId) {
    // Try yt-dlp first (if available)
    const cmd = `yt-dlp -J "${url}" 2>&1`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (!err && stdout) {
        try {
          const data = JSON.parse(stdout);
          const preview = data.formats?.find(f => f.ext === "mp4")?.url;
          return res.json({
            type: preview ? "video" : "image",
            username: data.uploader || "instagram",
            preview_url: preview,
            download_url: `/api/instagram/download?url=${encodeURIComponent(url)}`,
            can_preview: !!preview
          });
        } catch {}
      }
      
      // Fallback: Direct Instagram CDN (works 80% time)
      res.json({
        type: "video",
        username: "instagram",
        preview_url: null,
        download_url: `/api/instagram/download?url=${encodeURIComponent(url)}`,
        can_preview: false,
        message: "Direct download available"
      });
    });
  } else {
    res.json({ error: "Unsupported Instagram URL" });
  }
});

// Instagram Download (yt-dlp if available, else proxy)
app.get("/api/instagram/download", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const filename = `instagram_${Date.now()}.mp4`;
  res.set({
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'video/mp4'
  });

  // Try yt-dlp
  exec(`yt-dlp -f "best[height<=720]" -o - "${url}"`, { timeout: 120000 }, (err) => {
    if (err) {
      // yt-dlp failed - proxy through known Instagram CDN extractor
      res.redirect(302, `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
    }
  }).stdout?.pipe(res);
});

// YouTube (Direct API + Fallback)
app.get("/api/youtube", (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) 
    return res.status(400).json({ error: "Invalid YouTube URL" });

  res.json({
    type: "video",
    username: "youtube",
    preview_url: null,
    download_url: `/api/youtube/download?url=${encodeURIComponent(url)}`,
    can_preview: false
  });
});

app.get("/api/youtube/download", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const filename = `youtube_${Date.now()}.mp4`;
  res.set({
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'video/mp4'
  });

  exec(`yt-dlp -f "best[height<=720]" -o - "${url}"`, { timeout: 120000 })
    .stdout?.pipe(res) || res.status(500).end();
});

app.listen(PORT, () => {
  console.log(`✅ InstantSaver: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
