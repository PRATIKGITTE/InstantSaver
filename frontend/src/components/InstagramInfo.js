import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./Info.css";

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-accordion-item">
      <button className="faq-accordion-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && <p className="faq-accordion-answer">{a}</p>}
    </div>
  );
}

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

const FAQ_KEYS = [
  { q: "ig_faq_q1", a: "ig_faq_a1" },
  { q: "ig_faq_q2", a: "ig_faq_a2" },
  { q: "ig_faq_q3", a: "ig_faq_a3" },
  { q: "ig_faq_q4", a: "ig_faq_a4" },
  { q: "ig_faq_q5", a: "ig_faq_a5" },
  { q: "ig_faq_q6", a: "ig_faq_a6" },
  { q: "ig_faq_q7", a: "ig_faq_a7" },
  { q: "ig_faq_q8", a: "ig_faq_a8" },
  { q: "ig_faq_q9", a: "ig_faq_a9" },
  { q: "ig_faq_q10", a: "ig_faq_a10" },
];

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

      {/* ── Accordion FAQ ── */}
      <h3>{t("faq_title", "Frequently Asked Questions")}</h3>
      <div className="faq-accordion">
        {FAQ_KEYS.map((item) => (
          <FaqItem key={item.q} q={t(item.q, item.q)} a={t(item.a, item.a)} />
        ))}
      </div>

      {/* ── Available worldwide ── */}
      <h3>{t("ig_worldwide_title", "Available Worldwide")}</h3>
      <p>{t("ig_worldwide_desc", "InstantSaver works in every country — India, Nigeria, United States, Indonesia, Thailand, United Kingdom, Canada, UAE, Italy, and more. No regional restrictions.")}</p>
      <ul className="ig-countries">
        <li><strong>🇮🇳 India</strong> — {t("ig_country_india", "सबसे तेज़ और मुफ़्त Instagram Reels डाउनलोडर। कोई लॉगिन नहीं, कोई वॉटरमार्क नहीं।")}</li>
        <li><strong>🇳🇬 Nigeria</strong> — {t("ig_country_nigeria", "Download Instagram reels and photos instantly — no login, no charges.")}</li>
        <li><strong>🇮🇩 Indonesia</strong> — {t("ig_country_indonesia", "Download video Instagram Reels gratis, cepat, tanpa watermark.")}</li>
        <li><strong>🇺🇸 United States</strong> — {t("ig_country_us", "Free HD Instagram video downloader. Personal use only; respect copyright.")}</li>
      </ul>

    </section>
  );
}
