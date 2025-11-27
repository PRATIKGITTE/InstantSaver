import React, { useState } from "react";

export default function InstagramDownloader() {
  const [url, setUrl] = useState("");
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchMedia() {
    if (!url.trim()) {
      alert("Enter Instagram URL");
      return;
    }
    setLoading(true);
    setMedia(null);
    try {
      const res = await fetch(`http://localhost:3001/api/download?platform=instagram&url=${encodeURIComponent(url)}`);
      const data = await res.json();
      setMedia(data);
    } catch {
      alert("Fetch failed");
    }
    setLoading(false);
  }

  function downloadFile(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="downloader-form">
      <input
        placeholder="Instagram Post/Reel/IGTV URL"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="input-box"
      />
      <button onClick={fetchMedia} disabled={loading} className="fetch-button">
        {loading ? "Loading..." : "Fetch"}
      </button>

      {media && (
        <div className="media-preview">
          {media.error && <p className="error">{media.error}</p>}

          {media.videoUrl && (
            <>
              <video controls className="media-element" src={media.videoUrl}></video>
              <button className="download-btn" onClick={() => downloadFile(media.videoUrl, "instagram_video.mp4")}>
                Download Video
              </button>
            </>
          )}

          {media.imageUrl && (
            <>
              <img className="media-element" src={media.imageUrl} alt="Instagram" />
              <button className="download-btn" onClick={() => downloadFile(media.imageUrl, "instagram_image.jpg")}>
                Download Image
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
