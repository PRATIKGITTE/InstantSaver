// src/components/YouTubeInfo.js
import React from "react";
import "./Info.css";

export default function YouTubeInfo() {
  return (
    <section className="info-section">
      <h2>YouTube Video Downloader</h2>
      <p>
        YouTube is the world’s largest video platform — from music videos, tutorials, to Shorts and live streams.  
        But YouTube doesn’t provide a native download option for many videos.  
        InstantSaver solves this by allowing you to quickly and safely download any public YouTube video.
      </p>

      <h3>Key Features</h3>
      <ul>
        <li>Free, Secure, and Easy to use.</li>
        <li>Download Shorts, Live videos, Long-form videos, and more.</li>
        <li>No app required — works in your browser on all devices.</li>
        <li>Download in MP4 format with video + audio merged.</li>
      </ul>

      <h3>How to Download YouTube Videos?</h3>
      <ol>
        <li>Copy the link of the YouTube video or Shorts.</li>
        <li>Paste it into the input box above.</li>
        <li>Click <strong>Preview</strong> and then <strong>Download</strong>.</li>
      </ol>

      <h3>Why Choose InstantSaver?</h3>
      <p>
        InstantSaver provides high-speed servers that fetch YouTube videos instantly,  
        with support for both video and audio in one file. No login required, no restrictions.  
        Just paste your link and download.
      </p>

      <h3>FAQ — YouTube</h3>
      <ul>
        <li><strong>Can I download YouTube Shorts?</strong> Yes, Shorts are supported just like regular videos.</li>
        <li><strong>Is there a quality limit?</strong> No, you can download in the best available MP4 quality.</li>
        <li><strong>Do I need to install software?</strong> No, this is a 100% web-based tool.</li>
        <li><strong>Is downloading YouTube videos legal?</strong> You should only download videos for personal offline use. Always respect copyright.</li>
      </ul>
    </section>
  );
}
