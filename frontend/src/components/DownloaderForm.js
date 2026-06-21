import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./DownloaderForm.css";

const BASE_URL = "https://instantsaver.onrender.com";

// ── Progress step labels ──────────────────────────────────
const PROGRESS_STEPS = ["Fetching media…", "Processing…", "Ready!"];

export default function DownloaderForm({ platform, igType, ytType }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [normalized, setNormalized] = useState("");
  const [videoFailed, setVideoFailed] = useState(false);
  const [ytQuality, setYtQuality] = useState(720);

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
      // Clipboard permission denied
    }
  };

  const onPreview = async () => {
    if (!input.trim()) return alert(t("error_invalid_link", "Please paste a valid link."));
    setLoading(true);
    setMedia(null);
    setVideoFailed(false);
    setProgressStep(0);

    try {
      let url = input.trim();
      if (platform === "youtube") url = normalizeYouTube(url);
      setNormalized(url);

      setProgressStep(0);
      const res = await fetch(`${BASE_URL}/api/${platform}?url=${encodeURIComponent(url)}`);

      setProgressStep(1);

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response. Please try again.");
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      if (json.error) throw new Error(json.error);

      setProgressStep(2);
      setMedia(json);

      if (json.quality_options?.length) {
        const highest = json.quality_options[json.quality_options.length - 1].height;
        setYtQuality(highest);
      }
    } catch (e) {
      alert(e.message || t("error_preview_failed", "Preview failed. Check the link and try again."));
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
      triggerDownload(
        `${BASE_URL}/api/youtube/download?url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(media.title || "youtube")}&quality=${ytQuality}`
      );
    }
  };

  const onDownloadAudio = () => {
    if (!media || platform !== "youtube") return;
    const pageUrl = normalized || normalizeYouTube(input);
    triggerDownload(
      `${BASE_URL}/api/youtube/audio?url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(media.title || "youtube")}`
    );
  };

  const onDownloadAll = () => {
    if (!media?.items) return;
    media.items.forEach((item, i) => {
      setTimeout(() => triggerDownload(item.download_url), i * 800);
    });
  };

  // ── Carousel grid ──────────────────────────────────────
  const renderCarousel = () => (
    <div className="carousel-wrapper">
      {media.username && (
        <p className="username">
          {t("posted_by", "Posted by @{{username}}", { username: media.username })}
        </p>
      )}
      {media.caption && (
        <p className="media-caption carousel-caption">
          {media.caption.length > 180 ? media.caption.slice(0, 180) + "…" : media.caption}
        </p>
      )}
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
                    crossOrigin="anonymous"
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

  // ── Profile / DP ──────────────────────────────────────
  const renderProfile = () => (
    <div className="dp-preview-wrapper">
      <div className="dp-preview-card">
        <img
          src={media.preview_url}
          alt={`${media.username} profile picture`}
          className="dp-image"
          onError={(e) => { e.target.style.display = "none"; }}
          crossOrigin="anonymous"
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

  // ── YouTube card ───────────────────────────────────────
  const renderYouTube = () => (
    <div className="yt-preview-wrapper">
      <div className="yt-meta">
        {media.thumbnail && (
          <img
            src={media.thumbnail}
            alt={media.title}
            className="yt-thumb"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        )}
        <div className="yt-meta-info">
          <p className="yt-title">{media.title}</p>
          {media.username && <p className="yt-channel">{media.username}</p>}
          {media.duration && (
            <p className="yt-duration">
              ⏱ {Math.floor(media.duration / 60)}:{String(media.duration % 60).padStart(2, "0")}
            </p>
          )}
        </div>
      </div>

      {media.can_preview && media.preview_url && !videoFailed && (
        <video
          controls
          className="media-element"
          preload="metadata"
          onError={() => setVideoFailed(true)}
        >
          <source src={media.preview_url} type="video/mp4" />
        </video>
      )}

      {/* Quality selector */}
      {media.quality_options?.length > 0 && (
        <div className="yt-quality-row">
          <span className="yt-quality-label">Quality:</span>
          <div className="yt-quality-btns">
            {media.quality_options.map((opt) => (
              <button
                key={opt.height}
                className={`yt-quality-btn ${ytQuality === opt.height ? "active" : ""}`}
                onClick={() => setYtQuality(opt.height)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Download buttons */}
      <div className="yt-download-row">
        <button className="btn success" onClick={onDownload}>
          ↓ Download MP4
        </button>
        {media.audio_url && (
          <button className="btn yt-audio-btn" onClick={onDownloadAudio}>
            ♪ Audio M4A
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="downloader-form">
      {/* Input row */}
      <div className="input-row">
        <div className="input-wrap">
          <input
            type="text"
            placeholder={
              platform === "instagram"
                ? t("input_placeholder_ig", "Paste Instagram link here (reel, post, carousel, stories, profile)…")
                : t("input_placeholder_yt", "Paste YouTube link here…")
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && onPreview()}
            className="input-box"
            aria-label="URL input"
          />
          {!input && (
            <button className="paste-btn" onClick={onPaste} title="Paste from clipboard" aria-label="Paste">
              📋
            </button>
          )}
          {input && (
            <button
              className="paste-btn clear-btn"
              onClick={() => { setInput(""); setMedia(null); }}
              title="Clear"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>
        <button className="btn primary" onClick={onPreview} disabled={loading} aria-label="Preview">
          {loading
            ? <><span className="btn-spinner" />{PROGRESS_STEPS[progressStep]}</>
            : t("btn_preview", "Preview")}
        </button>
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="progress-track" role="progressbar" aria-label="Loading progress">
          <div
            className="progress-fill"
            style={{ width: `${((progressStep + 1) / PROGRESS_STEPS.length) * 100}%` }}
          />
        </div>
      )}

      {/* Result area */}
      {media && (
        <div className="media-preview">

          {media.type === "profile" && renderProfile()}

          {media.type === "carousel" && renderCarousel()}

          {platform === "youtube" && media.type === "video" && renderYouTube()}

          {platform === "instagram" && (media.type === "video" || media.type === "image") && (
            <>
              {media.username && (
                <p className="username">
                  {t("posted_by", "Posted by @{{username}}", { username: media.username })}
                </p>
              )}

              {media.scraped && (
                <p className="scraped-note">
                  ⚡ {t("scraped_note", "Preview loaded via fast scraping. Full quality available on download.")}
                </p>
              )}

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
        </div>
      )}
    </div>
  );
}
