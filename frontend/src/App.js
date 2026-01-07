// src/App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

import DownloaderForm from "./components/DownloaderForm";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import InstagramInfo from "./components/InstagramInfo";
import YouTubeInfo from "./components/YouTubeInfo";

import "./App.css";

/* ===================== CONSTANTS ===================== */

const TABS = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" }
];

const IG_TYPES = [
  { id: "auto", label: "All (Reels / Posts / IGTV)" },
  { id: "reel", label: "Reels" },
  { id: "post", label: "Post (Photo / Video)" },
  { id: "igtv", label: "IGTV" },
  { id: "carousel", label: "Carousel (first item only)" }
];

const YT_TYPES = [
  { id: "auto", label: "All (Shorts / Live / Long)" },
  { id: "shorts", label: "Shorts" },
  { id: "live", label: "Live (if available)" },
  { id: "long", label: "Long Video" }
];

/* ===================== HOME PAGE ===================== */

function Home() {
  const { t, i18n } = useTranslation();

  const [platform, setPlatform] = useState("instagram");
  const [igType, setIgType] = useState("auto");
  const [ytType, setYtType] = useState("auto");

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFormat, setPreviewFormat] = useState("");
  const [previewUsername, setPreviewUsername] = useState("");

  return (
    <div className="app">
      <Helmet>
        <title>InstantSaver – Online Video Downloader</title>
        <meta
          name="description"
          content="Download Instagram Reels, Posts & YouTube Shorts, Live or Long videos. Fast, free & no login."
        />
        <link rel="canonical" href="https://instantsaver.in/" />
      </Helmet>

      {/* ================= HEADER ================= */}
      <header className="nav">
        <div className="brand">
          <img src="/logo.png" className="logo" alt="InstantSaver" />
          <span>InstantSaver</span>
        </div>

        <nav className="links">
          <Link to="/features">{t("nav_features", "Features")}</Link>
          <Link to="/faq">{t("nav_faq", "FAQ")}</Link>
          <Link to="/contact">{t("nav_contact", "Contact")}</Link>

          <select
            aria-label="Language"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            style={{ marginLeft: 12, padding: 6 }}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="hero">
        <h1>{t("hero_title", "Online Video Downloader")}</h1>
        <p>
          {t(
            "hero_desc",
            "Download Instagram Reels/Posts & YouTube Shorts/Live/Long — fast, free, no login."
          )}
        </p>

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
            <h3>{t("preview_title", "Preview")}</h3>
            <video controls width="100%">
              <source
                src={previewUrl}
                type={`video/${previewFormat || "mp4"}`}
              />
            </video>
          </div>
        )}
      </section>

      {/* ================= FEATURES (RESTORED) ================= */}
      <section id="features" className="features">
        <h2>{t("features_title", "Everything in one place")}</h2>
        <div className="feature-grid">
          <div className="card">
            <h3>Fast & Smart</h3>
            <p>Instant preview & download with optimized pipelines.</p>
          </div>
          <div className="card">
            <h3>Free to Use</h3>
            <p>No login. No watermark. No limits.</p>
          </div>
          <div className="card">
            <h3>Unlimited</h3>
            <p>Download as much as you want.</p>
          </div>
        </div>
      </section>

      {/* ================= FOOTER (RESTORED) ================= */}
      <footer className="footer">
        <div className="footer-brand">
          <img src="/logo.png" className="logo small" alt="InstantSaver" />
          <strong>InstantSaver</strong>
        </div>

        <p>© {new Date().getFullYear()} InstantSaver. All rights reserved.</p>

        <p className="disclaimer">
          Downloads are fetched from public CDNs. Please respect platform terms.
        </p>
      </footer>
    </div>
  );
}

/* ===================== ROUTER ===================== */

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/features" element={<Features />} />
      </Routes>
    </Router>
  );
}
