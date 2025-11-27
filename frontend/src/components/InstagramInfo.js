// src/components/InstagramInfo.js
import React from "react";
import "./Info.css";

export default function InstagramInfo() {
  return (
    <section className="info-section">
      <h2>Instagram Video Downloader</h2>
      <p>
        Instagram is one of the most popular social media platforms for teens and young adults.  
        While scrolling your feed, you may find interesting videos and wish to save them.  
        Unfortunately, Instagram doesn’t allow direct downloads — but that’s where InstantSaver comes in.
      </p>

      <h3>Key Features</h3>
      <ul>
        <li>100% Free, Fast & Secure tool.</li>
        <li>No need to create an account or log in.</li>
        <li>Works on all devices — Mobile, iPhone, Tablet, PC.</li>
        <li>Download Reels, IGTV, Photos, Feed videos in original quality.</li>
      </ul>

      <h3>How to Download Instagram Videos?</h3>
      <ol>
        <li>Copy the link of the Instagram video, reel, or post.</li>
        <li>Paste it into the input box above.</li>
        <li>Click <strong>Preview</strong> and then <strong>Download</strong>.</li>
      </ol>

      <h3>Why Choose InstantSaver?</h3>
      <p>
        Our Instagram Downloader is designed to be secure, anonymous, and extremely easy to use.  
        Unlike other tools, we never ask for your login details and we don’t store your data.  
        Download unlimited Instagram content anytime, anywhere.
      </p>

      <h3>FAQ — Instagram</h3>
      <ul>
        <li><strong>Can I download private Instagram videos?</strong> No, only public posts are supported.</li>
        <li><strong>Is it legal to download Instagram videos?</strong> Downloading is allowed for personal use only. Always respect copyright.</li>
        <li><strong>Can I download IGTV and Reels?</strong> Yes, our tool supports Reels, IGTV, and normal feed videos.</li>
        <li><strong>Is there a limit on downloads?</strong> No, you can download as much as you like.</li>
      </ul>
    </section>
  );
}
