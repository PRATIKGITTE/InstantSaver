import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import ReactGA from "react-ga4";

import DownloaderForm from "./components/DownloaderForm";
import FAQ from "./components/FAQ";
import Features from "./components/Features";
import Contact from "./components/Contact";
import SeoPage from "./components/SeoPage";
import "./App.css";
import InstagramInfo from "./components/InstagramInfo";
import YouTubeInfo from "./components/YouTubeInfo";

// Initialize GA4 — replace with your real Measurement ID from Google Analytics
const GA_ID = process.env.REACT_APP_GA_ID || "G-XXXXXXXXXX";
if (GA_ID && GA_ID !== "G-XXXXXXXXXX") {
  ReactGA.initialize(GA_ID);
}

// Track page views on every route change
function GAPageTracker() {
  const location = useLocation();
  useEffect(() => {
    if (GA_ID && GA_ID !== "G-XXXXXXXXXX") {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);
  return null;
}

const TABS = [
  { id: "instagram", labelKey: "tab_instagram" },
  { id: "youtube", labelKey: "tab_youtube" }
];

const IG_TYPES = [
  { id: "auto", labelKey: "subtab_all", icon: "✦" },
  { id: "reel", labelKey: "subtab_reels", icon: "🎬" },
  { id: "post", labelKey: "subtab_post", icon: "🖼️" },
  { id: "stories", labelKey: "subtab_stories", icon: "📖" },
  { id: "igtv", labelKey: "subtab_igtv", icon: "📺" },
  { id: "carousel", labelKey: "subtab_carousel", icon: "🗂️" }
];

const YT_TYPES = [
  { id: "auto", label: "All (Shorts/Live/Long)" },
  { id: "shorts", label: "Shorts" },
  { id: "live", label: "Live" },
  { id: "long", label: "Long Video" }
];

function StaticPage({ title, body }) {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 800, margin: "60px auto", padding: "0 20px", lineHeight: 1.8 }}>
      <h1 style={{ marginBottom: 16 }}>{title}</h1>
      <p style={{ color: "#374151" }}>{body}</p>
      <a href="/" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>{t("back_to_home", "← Back to Home")}</a>
    </div>
  );
}

// ✅ PERFECT Scroll + Refresh Fix
function RedirectOnRefresh() {
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    scrollToTop();
    setTimeout(scrollToTop, 10);
    setTimeout(scrollToTop, 100);
    setTimeout(scrollToTop, 500);

    if (performance.navigation.type === 1 && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }, []);

  return null;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [platform, setPlatform] = useState("instagram");
  const [igType, setIgType] = useState("auto");
  const [ytType, setYtType] = useState("auto");

  return (
    <Router>
      <GAPageTracker />
      <Helmet>
        <title>{t("app_title", "InstantSaver")} — {t("page_title", "Instagram Downloader: Reels, Photos, Carousel Free")}</title>
        <meta name="description" content={t("hero_desc", "Download Instagram Reels, Photos, and Carousel posts in HD — no watermark, no login. Free & fast on iPhone, Android, and PC.")} />
        <meta name="keywords" content="instagram downloader, instagram reels downloader, download instagram photos, carousel downloader, free instagram downloader, no watermark" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="alternate" hrefLang="en" href="/" />
        <link rel="alternate" hrefLang="hi" href="/hi" />
        <link rel="alternate" hrefLang="id" href="/id" />
      </Helmet>

      <Routes>
        <Route path="/" element={
          <div className="app">
            <RedirectOnRefresh />
            
            <header className="nav">
              <div className="brand">
                <img src="/logo.png" className="logo" alt={t("app_title", "InstantSaver")} />
                <span>{t("app_title", "InstantSaver")}</span>
              </div>
              <nav className="links">
                <a href="#features">{t("nav_features", "Features")}</a>
                <a href="#faq">{t("nav_faq", "FAQ")}</a>
                <a href="/contact">{t("nav_contact", "Contact")}</a>
                <select
                  aria-label="Language"
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  style={{ marginLeft: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14 }}
                >
                  <option value="en">🌐 English</option>
                  <option value="hi">🇮🇳 हिंदी</option>
                  <option value="id">🇮🇩 Indonesia</option>
                  <option value="th">🇹🇭 ภาษาไทย</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </nav>
            </header>

            <section className="hero">
              <h1>{t("hero_title", "Instagram Downloader — Reels, Photos & Carousel")}</h1>
              <p>{t("hero_desc", "Download Instagram Reels, Photos, Carousel posts & YouTube videos — HD quality, no watermark, free.")}</p>

              {/* Supported formats strip */}
              <div className="formats-strip">
                <span className="format-badge">🎬 {t("subtab_reels","Reels")}</span>
                <span className="format-badge">🖼️ {t("subtab_post","Posts")}</span>
                <span className="format-badge">🗂️ {t("subtab_carousel","Carousel")}</span>
                <span className="format-badge">📖 {t("subtab_stories","Stories")}</span>
                <span className="format-badge">📺 IGTV</span>
                <span className="format-badge">👤 {t("profile_picture","Profile DP")}</span>
              </div>

              {/* MAIN TABS */}
              <div className="tabs">
                {TABS.map((tTab) => (
                  <button
                    key={tTab.id}
                    className={`tab ${platform === tTab.id ? "active" : ""}`}
                    onClick={() => setPlatform(tTab.id)}
                  >
                    {t(tTab.labelKey, tTab.labelKey)}
                  </button>
                ))}
              </div>

              {/* INSTAGRAM SECTION */}
              {platform === "instagram" && (
                <div>
                  {/* SUBTABS */}
                  <div className="subtabs instagram-subtabs">
                    {IG_TYPES.map((tObj) => (
                      <button
                        key={tObj.id}
                        className={`subtab ${igType === tObj.id ? "active" : ""}`}
                        onClick={() => setIgType(tObj.id)}
                      >
                        {tObj.icon} {t(tObj.labelKey, tObj.labelKey)}
                      </button>
                    ))}
                  </div>

                  {/* LINK PASTE + PREVIEW — all preview state managed inside DownloaderForm */}
                  <DownloaderForm platform={platform} igType={igType} ytType={ytType} />

                  <InstagramInfo />
                </div>
              )}

              {/* YOUTUBE SECTION */}
              {platform === "youtube" && (
                <div>
                  {/* ✅ MOBILE PERFECT SUBTABS - Horizontal scroll */}
                  <div className="subtabs youtube-subtabs">
                    {YT_TYPES.map((tObj) => (
                      <button
                        key={tObj.id}
                        className={`subtab ${ytType === tObj.id ? "active" : ""}`}
                        onClick={() => setYtType(tObj.id)}
                      >
                        {tObj.label}
                      </button>
                    ))}
                  </div>

                  {/* LINK PASTE + PREVIEW — all preview state managed inside DownloaderForm */}
                  <DownloaderForm platform={platform} igType={igType} ytType={ytType} />

                  <YouTubeInfo />
                </div>
              )}
            </section>

            <section id="features" className="features">
              <h2>{t("features_title", "Everything in one place")}</h2>
              <div className="feature-grid">
                <div className="card">
                  <h3>{t("features_fast_title", "Fast & Smart")}</h3>
                  <p>{t("features_fast_desc", "High-speed processing backed by optimized pipelines to preview & download instantly.")}</p>
                </div>
                <div className="card">
                  <h3>{t("features_free_title", "Free to Use")}</h3>
                  <p>{t("features_free_desc", "No signup. No paywall. Just paste your link, preview, and download.")}</p>
                </div>
                <div className="card">
                  <h3>{t("features_unlimited_title", "Unlimited")}</h3>
                  <p>{t("features_unlimited_desc", "Use it as much as you like. No hidden limits.")}</p>
                </div>
              </div>
            </section>

            <section id="faq" className="faq-section">
              <FAQ />
            </section>

            <footer className="footer">
              <div className="footer-brand">
                <img src="/logo.png" className="logo small" alt={t("app_title", "InstantSaver")} />
                <strong>{t("app_title", "InstantSaver")}</strong>
              </div>
              <nav className="footer-links">
                <a href="/privacy">{t("privacy_policy", "Privacy Policy")}</a>
                <a href="/terms">{t("terms_of_service", "Terms of Service")}</a>
                <a href="/contact">{t("nav_contact", "Contact")}</a>
                <a href="#faq">{t("nav_faq", "FAQ")}</a>
              </nav>
              <p>© {new Date().getFullYear()} {t("app_title", "InstantSaver")}. All rights reserved.</p>
              <p className="disclaimer">{t("footer_disclaimer", "Disclaimer: All logos and trademarks belong to their respective owners. Downloads are fetched directly from public CDNs. Please respect platform terms.")}</p>
            </footer>
          </div>
        } />

        <Route path="/features" element={<><RedirectOnRefresh /><Features /></>} />
        <Route path="/faq" element={<><RedirectOnRefresh /><FAQ /></>} />
        <Route path="/contact" element={<><RedirectOnRefresh /><Contact /></>} />
        <Route path="/privacy" element={<><RedirectOnRefresh /><StaticPage title="Privacy Policy" body="InstantSaver does not store, log, or share any user data or downloaded URLs. All processing happens server-side and no personal information is collected. Downloads are fetched directly from public CDNs. By using this service you agree to respect the terms of the platforms you download from." /></>} />
        <Route path="/terms" element={<><RedirectOnRefresh /><StaticPage title="Terms of Service" body="InstantSaver is provided free of charge for personal, non-commercial use. You agree to use it only to download publicly accessible content for personal offline use. Redistribution or commercial use of downloaded content without the original creator's permission is prohibited. We reserve the right to suspend service at any time without notice." /></>} />

        {/* SEO Landing Pages — high-quality, crawlable content for Google */}
        <Route path="/instagram-downloader" element={<SeoPage slug="instagram-downloader" />} />
        <Route path="/reels-downloader" element={<SeoPage slug="reels-downloader" />} />
        <Route path="/youtube-downloader" element={<SeoPage slug="youtube-downloader" />} />
        <Route path="/profile-picture-downloader" element={<SeoPage slug="profile-picture-downloader" />} />
        <Route path="/carousel-downloader" element={<SeoPage slug="carousel-downloader" />} />

        <Route path="*" element={<RedirectOnRefresh />} />
      </Routes>
    </Router>
  );
}
