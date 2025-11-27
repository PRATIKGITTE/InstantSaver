import React, { useState } from "react";

const YouTubeDownloader = () => {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!url.trim()) {
      alert("Please enter a valid YouTube URL");
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`http://localhost:3001/api/download?url=${encodeURIComponent(url)}&platform=youtube`);
      const json = await response.json();
      setResult(json);
    } catch {
      alert("Failed to fetch YouTube video");
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (url, filename) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "youtube_video.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="downloader-form">
      <input
        type="text"
        placeholder="Paste YouTube video or shorts URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input-box"
      />
      <button onClick={handleFetch} disabled={loading} className="fetch-button">
        {loading ? "Loading..." : "Fetch"}
      </button>

      {result && (
        <div className="media-preview">
          {result.error && <p className="error">{result.error}</p>}

          {result.videoUrl && (
            <>
              <video controls src={result.videoUrl} className="media-element" />
              <button
                className="download-btn"
                onClick={() => triggerDownload(result.videoUrl, "youtube_video.mp4")}
              >
                Download Video
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeDownloader;
