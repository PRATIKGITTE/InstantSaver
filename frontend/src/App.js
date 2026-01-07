// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
  Link
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

import DownloaderForm from "./components/DownloaderForm";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import InstagramInfo from "./components/InstagramInfo";
import YouTubeInfo from "./components/YouTubeInfo";

import "./App.css";

/* ================= CONSTANTS ================= */

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
  { id: "live", label: "Live" },
  { id: "long", label: "Long Video" }
];

/* ================= HOME LAYOUT ================= */

function HomeLayout() {
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
        <title>InstantSaver – Instagram & YouTube Downloader</title>
        <meta
          name="description"
          content="Download Instagram Reels, Posts & YouTube Shorts, Live or Long videos. Fast, free & no login."
        />
        <link rel="canonical" href="https://instantsaver.in/" />
      </Helmet>

      {/* HEADER */}
      <header className="nav">
        <div className="brand">
          <img src="/logo.png" className="logo" alt="InstantSaver" />
          <span>InstantSaver</span>
        </div>

        <nav className="links">
          <Link to="/features">Features</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/contact">Contact</Link>

          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
        </nav>
      </header>

      {/* HERO */}
      <section className="hero">
        <h1>Online Video Downloader</h1>
        <p>Download Instagram & YouTube videos instantly.</p>

        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={platform === tab.id ? "active" : ""}
              onClick={() => setPlatform(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {platform === "instagram" && (
          <div className="subtabs">
            {IG_TYPES.map((t) => (
              <button
                key={t.id}
                className={igType === t.id ? "active" : ""}
                onClick={() => setIgType(t.id)}
              >
                {t.label}
              </button>
            ))}
            <InstagramInfo />
          </div>
        )}

        {platform === "youtube" && (
          <div className="subtabs">
            {YT_TYPES.map((t) => (
              <button
                key={t.id}
                className={ytType === t.id ? "active" : ""}
                onClick={() => setYtType(t.id)}
              >
                {t.label}
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
          <video controls width="100%">
            <source src={previewUrl} />
          </video>
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

      <FAQ />

     
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
/* ================= MAIN APP ================= */

function RedirectOnRefresh() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, []); // run once on refresh

  return null;
}

export default function App() {
  return (
    <Router>
      <RedirectOnRefresh />
      <Routes>
        <Route path="/" element={<HomeLayout />} />
        <Route path="/features" element={<HomeLayout />} />
        <Route path="/faq" element={<HomeLayout />} />
        <Route path="/contact" element={<HomeLayout />} />
      </Routes>
    </Router>
  );
}
