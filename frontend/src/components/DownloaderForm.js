import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./DownloaderForm.css";

const BASE_URL = "https://instantsaver.onrender.com";

export default function DownloaderForm({ platform }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [normalized, setNormalized] = useState("");
  const [videoFailed, setVideoFailed] = useState(false);

  const normalizeYouTube = (url) => {
    let u = url.trim().split("?")[0].replace(/\/$/, "");
    if (/\/shorts\/([^/]+)/.test(u))
      return `https://www.youtube.com/watch?v=${u.match(/\/shorts\/([^/]+)/)[1]}`;
    if (/youtu\.be\/([^/]+)/.test(u))
      return `https://www.youtube.com/watch?v=${u.match(/youtu\.be\/([^/]+)/)[1]}`;
    return u;
  };

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text.trim());
    } catch {
      // Clipboard permission denied — focus input instead
    }
  };

  const onPreview = async () => {
    if (!input.trim()) return alert(t("error_invalid_link", "Please paste a valid link."));
    setLoading(true);
    setMedia(null);
    setVideoFailed(false);

    try {
      let url = input.trim();
      if (platform === "youtube") url = normalizeYouTube(url);
      setNormalized(url);

      const res = await fetch(`${BASE_URL}/api/${platform}?url=${encodeURIComponent(url)}`);
      
      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned invalid response. Please try again later.");
      }
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status} error`);
      if (json.error) throw new Error(json.error);

      setMedia(json);
    } catch (e) {
      const errorMsg = e.message || t("error_preview_failed", "Preview failed. Please check the link and try again.");
      alert(errorMsg);
      console.error("Preview error:", e);
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (href) => {
    const a = document.createElement("a");
    a.href = href.startsWith("/api") ? `${BASE_URL}${href}` : href;
    a.setAttribute("download", "");
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onDownload = () => {
    if (!media) return;
    if (platform === "instagram") {
      triggerDownload(media.download_url);
    } else {
      const pageUrl = normalized || normalizeYouTube(input);
      triggerDownload(`${BASE_URL}/api/youtube/download?url=${encodeURIComponent(pageUrl)}&title=InstantSaver`);
    }
  };

  const onDownloadAll = () => {
    if (!media?.items) return;
    media.items.forEach((item, i) => {
      setTimeout(() => triggerDownload(item.download_url), i * 800);
    });
  };

  // ── Carousel grid ──
  const renderCarousel = () => (
    <div className="carousel-wrapper">
      <div className="carousel-grid">
        {media.items.map((item, i) => (
          <div key={i} className="carousel-card">
            <div className="carousel-thumb-box">
              {item.preview_url ? (
                item.type === "video" ? (
                  <video
                    src={item.preview_url}
                    className="carousel-thumb-media"
                    preload="metadata"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={item.preview_url}
                    alt={`Item ${item.index}`}
                    className="carousel-thumb-media"
                    loading="lazy"
                  />
                )
              ) : item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={`Item ${item.index}`}
                  className="carousel-thumb-media"
                  loading="lazy"
                />
              ) : (
                <div className="carousel-no-preview">
                  {item.type === "video" ? "🎬" : "🖼️"} {item.index}
                </div>
              )}
              <span className="carousel-index-badge">{item.index}/{media.item_count}</span>
              <span className="carousel-type-badge">{item.type === "video" ? "🎬" : "🖼️"}</span>
            </div>
            <button
              className="btn success carousel-dl-btn"
              onClick={() => triggerDownload(item.download_url)}
            >
              ↓ {t("btn_download", "Download")} {item.index}
            </button>
          </div>
        ))}
      </div>
      {media.item_count > 1 && (
        <button className="btn primary download-all-btn" onClick={onDownloadAll}>
          ↓ {t("btn_download_all", "Download All {{count}} Items", { count: media.item_count })}
        </button>
      )}
    </div>
  );

  // ── Profile / DP ──
  const renderProfile = () => (
    <div className="dp-preview-wrapper">
      <div className="dp-preview-card">
        <img
          src={media.preview_url}
          alt={`${media.username} profile picture`}
          className="dp-image"
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div className="dp-info">
          <p className="dp-display-name">{media.display_name || media.username}</p>
          <p className="dp-username">@{media.username}</p>
        </div>
      </div>
      <div className="download-container">
        <button className="btn success" onClick={onDownload}>
          ↓ {t("btn_download_dp", "Download Profile Picture")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="downloader-form">
      <div className="input-row">
        <div className="input-wrap">
          <input
            type="text"
            placeholder={
              platform === "instagram"
                ? t("input_placeholder_ig", "Paste Instagram link here (reel, post, photo, carousel, stories, profile)…")
                : t("input_placeholder_yt", "Paste YouTube link here…")
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && onPreview()}
            className="input-box"
          />
          {!input && (
            <button className="paste-btn" onClick={onPaste} title="Paste from clipboard">
              📋
            </button>
          )}
          {input && (
            <button className="paste-btn clear-btn" onClick={() => { setInput(""); setMedia(null); }} title="Clear">
              ✕
            </button>
          )}
        </div>
        <button className="btn primary" onClick={onPreview} disabled={loading}>
          {loading ? <><span className="btn-spinner" />{t("btn_loading", "Loading…")}</> : t("btn_preview", "Preview")}
        </button>
      </div>

      {media && (
        <div className="media-preview">

          {/* Username — always shown when present */}
          {media.username && (
            <p className="username">
              {t("posted_by", "Posted by @{{username}}", { username: media.username })}
            </p>
          )}

          {/* Scraped note */}
          {media.scraped && (
            <p className="scraped-note">
              ⚡ {t("scraped_note", "Showing first item preview. For carousel posts, all items are available via Download.")}
            </p>
          )}

          {/* PROFILE / DP */}
          {media.type === "profile" && renderProfile()}

          {/* CAROUSEL */}
          {media.type === "carousel" && renderCarousel()}

          {/* SINGLE VIDEO or IMAGE */}
          {(media.type === "video" || media.type === "image") && (
            <>
              {media.type === "video" && !videoFailed && media.can_preview && media.preview_url ? (
                <video
                  controls
                  className="media-element"
                  preload="metadata"
                  onError={() => setVideoFailed(true)}
                >
                  <source src={media.preview_url} type="video/mp4" />
                  {t("no_video_support", "Your browser does not support the video tag.")}
                </video>
              ) : media.type === "image" && media.preview_url ? (
                <img
                  src={media.preview_url}
                  alt={media.title || "Instagram photo"}
                  className="media-element"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="video-placeholder">
                  {(media.thumbnail || media.preview_url) && (
                    <img
                      src={media.thumbnail || media.preview_url}
                      alt="Thumbnail"
                      className="media-element"
                    />
                  )}
                  <p className="placeholder-text">
                    {t("preview_unavailable", "Preview unavailable — click Download to save.")}
                  </p>
                </div>
              )}

              {media.caption && (
                <p className="media-caption">
                  {media.caption.length > 220 ? media.caption.slice(0, 220) + "…" : media.caption}
                </p>
              )}

              <div className="download-container">
                <button className="btn success" onClick={onDownload}>
                  ↓ {t("btn_download", "Download")}
                </button>
              </div>
            </>
          )}

          {/* Carousel caption */}
          {media.type === "carousel" && media.caption && (
            <p className="media-caption carousel-caption">
              {media.caption.length > 220 ? media.caption.slice(0, 220) + "…" : media.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
