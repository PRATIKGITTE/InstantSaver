import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

import DownloaderForm from "./components/DownloaderForm";
import FAQ from "./components/FAQ";
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

// ✅ SIMPLE Refresh Guard - Only on REAL refresh (F5)
const RefreshGuard = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Only redirect if it's a real page refresh (not navigation)
    if (performance.navigation.type === 1) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return null;
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [platform, setPlatform] = useState("instagram");
  const [igType, setIgType] = useState("auto");
  const [ytType, setYtType] = useState("auto");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFormat, setPreviewFormat] = useState("");
  const [previewUsername, setPreviewUsername] = useState("");

  return (
    <Router>
      <Helmet>
        <title>{t("app_title", "InstantSaver")} — {t("hero_title", "Online Video Downloader")}</title>
        <meta name="description" content={t("hero_desc", "Download Instagram Reels/Posts & YouTube Shorts/Live/Long — fast, free, no login.")} />
        <meta name="keywords" content="instagram downloader, youtube downloader, reels, shorts, video download" />
      </Helmet>

      <Routes>
        {/* ✅ HOME PAGE */}
        <Route path="/" element={
          <div className="app">
            <header className="nav">
              <div className="brand">
                <img src="/logo.png" className="logo" alt="InstantSaver" />
                <span>InstantSaver</span>
              </div>
              <nav className="links">
                <a href="#features">Features</a>
                <a href="#faq">FAQ</a>
                <a href="/contact">Contact</a>
                <select
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

              <div className="tabs">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tab ${platform === tab.id ? "active" : ""}`}
                    onClick={() => setPlatform(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {platform === "instagram" && (
                <div className="subtabs">
                  {IG_TYPES.map((type) => (
                    <button
                      key={type.id}
                      className={`subtab ${igType === type.id ? "active" : ""}`}
                      onClick={() => setIgType(type.id)}
                    >
                      {type.label}
                    </button>
                  ))}
                  <InstagramInfo />
                </div>
              )}

              {platform === "youtube" && (
                <div className="subtabs">
                  {YT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      className={`subtab ${ytType === type.id ? "active" : ""}`}
                      onClick={() => setYtType(type.id)}
                    >
                      {type.label}
                    </button>
                  ))}
                  <YouTubeInfo />
                </div>
              )}

              <DownloaderForm
                platform={platform}
                igType={igType}
                ytType={ytType}
                setPreviewUrl={setPreviewUrl}
                setPreviewFormat={setPreviewFormat}
                setPreviewUsername={setPreviewUsername}
              />

              {previewUrl && (
                <div className="preview">
                  <h3>Preview</h3>
                  {platform === "instagram" && previewUsername && (
                    <p className="username">Posted by @{previewUsername}</p>
                  )}
                  <video controls width="100%" style={{ borderRadius: "12px", marginTop: "15px" }}>
                    <source src={previewUrl} type="video/mp4" />
                  </video>
                </div>
              )}
            </section>

            {/* Features - #features */}
            <section id="features" className="features">
              <h2>Everything in one place</h2>
              <div className="feature-grid">
                <div className="card">
                  <h3>Fast & Smart</h3>
                  <p>High-speed processing backed by optimized pipelines to preview & download instantly.</p>
                </div>
                <div className="card">
                  <h3>Free to Use</h3>
                  <p>No signup. No paywall. Just paste your link, preview, and download.</p>
                </div>
                <div className="card">
                  <h3>Unlimited</h3>
                  <p>Use it as much as you like. No hidden limits.</p>
                </div>
              </div>
            </section>

            {/* FAQ - #faq */}
            <section id="faq" className="faq-section">
              <FAQ />
            </section>

            <footer className="footer">
              <div className="footer-brand">
                <img src="/logo.png" className="logo small" alt="InstantSaver" />
                <strong>InstantSaver</strong>
              </div>
              <p>© {new Date().getFullYear()} InstantSaver. All rights reserved.</p>
              <p className="disclaimer">Disclaimer: All logos and trademarks belong to their respective owners.</p>
            </footer>
          </div>
        } />

        {/* FEATURES PAGE */}
        <Route path="/features" element={
          <>
            <RefreshGuard />
            <div className="app">
              <header className="nav">
                <div className="brand">
                  <img src="/logo.png" className="logo" alt="InstantSaver" />
                  <span>InstantSaver</span>
                </div>
                <nav className="links">
                  <a href="/">← Home</a>
                </nav>
              </header>
              <section className="features">
                <h2>Features</h2>
                <div className="feature-grid">
                  <div className="card">
                    <h3>Fast & Smart</h3>
                    <p>High-speed processing backed by optimized pipelines.</p>
                  </div>
                  <div className="card">
                    <h3>Free to Use</h3>
                    <p>No signup. No paywall. Just download.</p>
                  </div>
                  <div className="card">
                    <h3>Unlimited</h3>
                    <p>No hidden limits.</p>
                  </div>
                </div>
              </section>
            </div>
          </>
        } />

        {/* FAQ PAGE */}
        <Route path="/faq" element={
          <>
            <RefreshGuard />
            <FAQ />
          </>
        } />

        {/* CONTACT PAGE */}
        <Route path="/contact" element={
          <>
            <RefreshGuard />
            <Contact />
          </>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
