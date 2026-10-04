import React from "react";
import { useTranslation } from "react-i18next";
import guideCopyLink from "../assets/guide-copy-link.svg";
import guideUseInstantSaver from "../assets/guide-use-instantsaver.svg";
import "./Info.css";

const FEATURES = [
  { icon: "🎬", key: "ig_feature_1" },
  { icon: "🖼️", key: "ig_feature_2" },
  { icon: "🗂️", key: "ig_feature_3" },
  { icon: "📺", key: "ig_feature_4" },
  { icon: "🔒", key: "ig_feature_5" },
  { icon: "📱", key: "ig_feature_6" },
  { icon: "✨", key: "ig_feature_7" },
];

const REELS_STEPS = ["ig_howto_reels_1", "ig_howto_reels_2", "ig_howto_reels_3", "ig_howto_reels_4"];
const CAROUSEL_STEPS = ["ig_howto_carousel_1", "ig_howto_carousel_2", "ig_howto_carousel_3", "ig_howto_carousel_4"];

export default function InstagramInfo() {
  const { t } = useTranslation();

  return (
    <section className="info-section">

      {/* ── Main description ── */}
      <h2>{t("ig_info_title", "Instagram Downloader — Download Reels, Photos & Carousels Free")}</h2>
      <p>{t("ig_info_desc", "InstantSaver is the fastest free Instagram downloader for reels, photos, carousel posts, and IGTV videos. No watermark. No login. Works on every device — iPhone, Android, tablet, and PC.")}</p>

      {/* ── Feature cards ── */}
      <h3>{t("ig_features_title", "Key Features")}</h3>
      <div className="ig-feature-grid">
        {FEATURES.map((f) => (
          <div key={f.key} className="ig-feature-card">
            <span className="ig-feature-icon">{f.icon}</span>
            <span>{t(f.key, f.key)}</span>
          </div>
        ))}
      </div>

      {/* ── How to download reels ── */}
      <h3>{t("ig_howto_reels", "How to Download Instagram Reels & Videos")}</h3>
      <div className="ig-guide-images">
        <figure>
          <img src={guideCopyLink} alt={t("ig_guide_copy_alt", "Copying a link from Instagram's share menu")} loading="lazy" />
          <figcaption>{t("ig_guide_copy_caption", "1. Copy the link from Instagram")}</figcaption>
        </figure>
        <figure>
          <img src={guideUseInstantSaver} alt={t("ig_guide_use_alt", "Pasting the link into InstantSaver and downloading")} loading="lazy" />
          <figcaption>{t("ig_guide_use_caption", "2. Paste it here and download")}</figcaption>
        </figure>
      </div>
      <div className="ig-steps">
        {REELS_STEPS.map((k, i) => (
          <div key={k} className="ig-step">
            <span className="ig-step-num">{i + 1}</span>
            <span>{t(k, k)}</span>
          </div>
        ))}
      </div>

      {/* ── How to download carousel ── */}
      <h3>{t("ig_howto_carousel", "How to Download Instagram Carousel Posts (Multiple Photos/Videos)")}</h3>
      <div className="ig-steps">
        {CAROUSEL_STEPS.map((k, i) => (
          <div key={k} className="ig-step">
            <span className="ig-step-num">{i + 1}</span>
            <span>{t(k, k)}</span>
          </div>
        ))}
      </div>

      {/* ── Why choose ── */}
      <h3>{t("ig_why_title", "Why Choose InstantSaver?")}</h3>
      <p>{t("ig_why_desc", "Unlike other tools that show @instagram as the account name, InstantSaver shows the real poster username and caption so you always know whose content you are downloading. We never ask for your login credentials and we never store your data. Downloads are fetched directly from Instagram's public CDN.")}</p>

      {/* ── Available worldwide ── */}
      <h3>{t("ig_worldwide_title", "Available Worldwide")}</h3>
      <p>{t("ig_worldwide_desc_v2", "InstantSaver works in every country, with no regional restrictions — and the site itself speaks your language.")}</p>

    </section>
  );
}
