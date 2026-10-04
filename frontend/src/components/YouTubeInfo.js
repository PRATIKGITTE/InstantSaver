// src/components/YouTubeInfo.js
import React from "react";
import { useTranslation } from "react-i18next";
import guideYoutube from "../assets/guide-youtube.svg";
import "./Info.css";

export default function YouTubeInfo() {
  const { t } = useTranslation();
  return (
    <section className="info-section">
      <h2>{t("yt_info_title", "YouTube Video Downloader")}</h2>
      <p>{t("yt_info_desc", "YouTube is the world's largest video platform — from music videos, tutorials, to Shorts and live streams. But YouTube doesn't provide a native download option for many videos. InstantSaver solves this by allowing you to quickly and safely download any public YouTube video.")}</p>

      <div className="ig-guide-images yt-guide-images">
        <figure>
          <img src={guideYoutube} alt={t("yt_guide_alt", "Pasting a YouTube link into InstantSaver and downloading")} loading="lazy" />
          <figcaption>{t("yt_guide_caption", "Paste, preview, and download — with quality and audio options")}</figcaption>
        </figure>
      </div>

      <h3>{t("yt_features_title", "Key Features")}</h3>
      <ul>
        <li>{t("yt_feature_1", "Free, Secure, and Easy to use.")}</li>
        <li>{t("yt_feature_2", "Download Shorts, Live videos, Long-form videos, and more.")}</li>
        <li>{t("yt_feature_3", "No app required — works in your browser on all devices.")}</li>
        <li>{t("yt_feature_4", "Download in MP4 format with video + audio merged.")}</li>
      </ul>

      <h3>{t("yt_howto_title", "How to Download YouTube Videos?")}</h3>
      <ol>
        <li>{t("yt_howto_1", "Copy the link of the YouTube video or Shorts.")}</li>
        <li>{t("yt_howto_2", "Paste it into the input box above.")}</li>
        <li>
          {t("yt_howto_3_pre", "Click")} <strong>{t("btn_preview", "Preview")}</strong> {t("yt_howto_3_mid", "and then")} <strong>{t("btn_download", "Download")}</strong>.
        </li>
      </ol>

      <h3>{t("yt_why_title", "Why Choose InstantSaver?")}</h3>
      <p>{t("yt_why_desc", "InstantSaver provides high-speed servers that fetch YouTube videos instantly, with support for both video and audio in one file. No login required, no restrictions. Just paste your link and download.")}</p>

      <h3>{t("yt_faq_title", "FAQ — YouTube")}</h3>
      <ul>
        <li><strong>{t("yt_faq_q1", "Can I download YouTube Shorts?")}</strong> {t("yt_faq_a1", "Yes, Shorts are supported just like regular videos.")}</li>
        <li><strong>{t("yt_faq_q2", "Is there a quality limit?")}</strong> {t("yt_faq_a2", "No, you can download in the best available MP4 quality.")}</li>
        <li><strong>{t("yt_faq_q3", "Do I need to install software?")}</strong> {t("yt_faq_a3", "No, this is a 100% web-based tool.")}</li>
        <li><strong>{t("yt_faq_q4", "Is downloading YouTube videos legal?")}</strong> {t("yt_faq_a4", "You should only download videos for personal offline use. Always respect copyright.")}</li>
      </ul>
    </section>
  );
}
