import React, { useState } from "react";
import "./DownloaderForm.css";

export default function DownloaderForm({ platform, setPreviewUrl, setPreviewFormat }) {
  const [input, setInput] = useState("");
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [normalized, setNormalized] = useState(""); // keep the normalized URL we used for preview

  const BASE_URL = "https://instantsaver.onrender.com"; // <-- Render backend URL

  const normalizeYouTube = (url) => {
    let u = url.trim().split("?")[0].replace(/\/$/, "");
    if (/\/shorts\/([^\/]+)/.test(u)) return `https://www.youtube.com/watch?v=${u.match(/\/shorts\/([^\/]+)/)[1]}`;
    if (/youtu\.be\/([^\/]+)/.test(u)) return `https://www.youtube.com/watch?v=${u.match(/youtu\.be\/([^\/]+)/)[1]}`;
    return u;
  };

  const onPreview = async () => {
    if (!input.trim()) return alert("Please paste a valid link.");
    setLoading(true);
    setMedia(null);
    setPreviewUrl("");
    setPreviewFormat("");

    try {
      let url = input;
      if (platform === "youtube") url = normalizeYouTube(url);
      setNormalized(url); // remember the exact URL used for backend calls

      const res = await fetch(`${BASE_URL}/api/${platform}?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Preview fetch failed");

      setMedia(json);

      if (json.can_preview && json.preview_url) {
        setPreviewUrl(json.preview_url);
        setPreviewFormat(json.type === "video" ? "mp4" : "jpg");
      }
    } catch (e) {
      alert(e.message || "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = () => {
    if (!media) return;

    if (platform === "instagram") {
      const postUrl = normalized || input.trim();
      if (!postUrl) return alert("No Instagram post URL available.");

      const a = document.createElement("a");
      a.href = `${BASE_URL}/api/instagram/download?url=${encodeURIComponent(postUrl)}&filename=instagram`;
      a.setAttribute("download", "");
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (platform === "youtube") {
      const pageUrl = normalized || normalizeYouTube(input);

      const a = document.createElement("a");
      a.href = `${BASE_URL}/api/youtube/download?url=${encodeURIComponent(pageUrl)}&title=InstantSaver`;
      a.setAttribute("download", "");
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="downloader-form">
      <div className="input-row">
        <input
          type="text"
          placeholder={platform === "instagram" ? "Paste Instagram link" : "Paste YouTube link"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input-box"
        />
        <button className="btn primary" onClick={onPreview} disabled={loading}>
          {loading ? "Loading..." : "Preview"}
        </button>
      </div>

      {media && (
        <div className="media-preview">
          {media.type === "video" ? (
            media.can_preview ? (
              <video controls className="media-element">
                <source src={media.preview_url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="video-placeholder">
                {media.message || "Preview unavailable. Use download button to get the full video."}
              </div>
            )
          ) : media.type === "image" ? (
            <img src={media.preview_url} alt="Preview" className="media-element" />
          ) : null}

          {media.username && <p className="username">Posted by @{media.username}</p>}

          <div className="download-container">
            <button className="btn success" onClick={onDownload}>
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
