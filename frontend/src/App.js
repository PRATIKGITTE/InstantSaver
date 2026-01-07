import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

import DownloaderForm from "./components/DownloaderForm";
import FAQ from "./components/FAQ";
import Features from "./components/Features";
import Contact from "./components/Contact";
import "./App.css";
import InstagramInfo from "./components/InstagramInfo";
import YouTubeInfo from "./components/YouTubeInfo";

const TABS = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" }
];

const IG_TYPES = [
  { id: "auto", label: "All (Reels/Posts/IGTV)" },
  { id: "reel", label: "Reels" },
  { id: "post", label: "Post (Photo/Video)" },
  { id: "igtv", label: "IGTV" },
  { id: "carousel", label: "Carousel (first item only)" }
];

const YT_TYPES = [
  { id: "auto", label: "All (Shorts/Live/Long)" },
  { id: "shorts", label: "Shorts" },
  { id: "live", label: "Live (if available)" },
  { id: "long", label: "Long Video" }
];

// ✅ PERFECT Scroll + Refresh Fix
function RedirectOnRefresh() {
  useEffect(() => {
    // ✅ DISABLE browser scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // ✅ FORCE scroll to top - Multiple times to beat browser
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    scrollToTop();
    setTimeout(scrollToTop, 10);
    setTimeout(scrollToTop, 100);
    setTimeout(scrollToTop, 500);

    // ✅ Redirect ONLY non-home routes (not #features/#faq)
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
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFormat, setPreviewFormat] = useState("");
  const [previewUsername, setPreviewUsername] = useState("");

  // ✅ Clear preview function
  const clearPreview = () => {
    setPreviewUrl("");
    setPreviewFormat("");
    setPreviewUsername("");
  };

  return (
    <Router>
      <Helmet>
        <title>{t("app_title", "InstantSaver")} — {t("hero_title", "Online Video Downloader")}</title>
        <meta name="description" content={t("hero_desc", "Download Instagram Reels/Posts & YouTube Shorts/Live/Long — fast, free, no login.")} />
        <meta name="keywords" content="instagram downloader, youtube downloader, reels, shorts, video download" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="alternate" hrefLang="en" href="/" />
        <link rel="alternate" hrefLang="hi" href="/hi" />
      </Helmet>

      <Routes>
        {/* ✅ HOME PAGE - PERFECT LAYOUT */}
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
                  style={{ marginLeft: 12, padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                </select>
              </nav>
            </header>

            <section className="hero">
              <h1>{t("hero_title", "Online Video Downloader")}</h1>
              <p>{t("hero_desc", "Download Instagram Reels/Posts & YouTube Shorts/Live/Long — fast, free, no login.")}</p>

              {/* 1. MAIN TABS */}
              <div className="tabs">
                {TABS.map((tTab) => (
                  <button
                    key={tTab.id}
                    className={`tab ${platform === tTab.id ? "active" : ""}`}
                    onClick={() => setPlatform(tTab.id)}
                  >
                    {tTab.label}
                  </button>
                ))}
              </div>

              {/* 2. SUBTABS */}
              {platform === "instagram" && (
                <div className="subtabs">
                  {IG_TYPES.map((tObj) => (
                    <button
                      key={tObj.id}
                      className={`subtab ${igType === tObj.id ? "active" : ""}`}
                      onClick={() => setIgType(tObj.id)}
                    >
                      {tObj.label}
                    </button>
                  ))}
                  <InstagramInfo />
                </div>
              )}

              {platform === "youtube" && (
                <div className="subtabs">
                  {YT_TYPES.map((tObj) => (
                    <button
                      key={tObj.id}
                      className={`subtab ${ytType === tObj.id ? "active" : ""}`}
                      onClick={() => setYtType(tObj.id)}
                    >
                      {tObj.label}
                    </button>
                  ))}
                  <YouTubeInfo />
                </div>
              )}

              {/* 3. 🔴 LINK PASTE + DOWNLOAD - Perfect position */}
              <DownloaderForm
                platform={platform}
                igType={igType}
                ytType={ytType}
                setPreviewUrl={setPreviewUrl}
                setPreviewFormat={setPreviewFormat}
                setPreviewUsername={setPreviewUsername}
              />

              {/* 4. ✨ GORGEOUS PREVIEW */}
              {previewUrl && (
                <div className="preview-improved">
                  <div className="preview-header">
                    <h3>{t("preview_title", "Preview")}</h3>
                    <button 
                      className="clear-preview" 
                      onClick={clearPreview}
                      aria-label="Clear preview"
                    >
                      ×
                    </button>
                  </div>
                  
                  {platform === "instagram" && previewUsername && (
                    <p className="username">Posted by @{previewUsername}</p>
                  )}
                  
                  <div className="video-container">
                    <video controls preload="metadata" width="100%">
                      <source src={previewUrl} type={`video/${previewFormat || "mp4"}`} />
                      {t("no_video_support", "Your browser does not support the video tag.")}
                    </video>
                  </div>
                </div>
              )}
            </section>

            {/* ✅ #features scroll target */}
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

            {/* ✅ #faq scroll target */}
            <section id="faq" className="faq-section">
              <FAQ />
            </section>

            <footer className="footer">
              <div className="footer-brand">
                <img src="/logo.png" className="logo small" alt={t("app_title", "InstantSaver")} />
                <strong>{t("app_title", "InstantSaver")}</strong>
              </div>
              <p>© {new Date().getFullYear()} {t("app_title", "InstantSaver")}. All rights reserved.</p>
              <p className="disclaimer">{t("footer_disclaimer", "Disclaimer: All logos and trademarks belong to their respective owners. Downloads are fetched directly from public CDNs. Please respect platform terms.")}</p>
            </footer>
          </div>
        } />

        {/* ✅ ROUTE PAGES */}
        <Route path="/features" element={<><RedirectOnRefresh /><Features /></>} />
        <Route path="/faq" element={<><RedirectOnRefresh /><FAQ /></>} />
        <Route path="/contact" element={<><RedirectOnRefresh /><Contact /></>} />
        <Route path="*" element={<RedirectOnRefresh />} />
      </Routes>
    </Router>
  );
}
