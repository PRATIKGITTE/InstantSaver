import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import ReactGA from "react-ga4";

import DownloaderForm from "./components/DownloaderForm";
import FAQ from "./components/FAQ";
import Features from "./components/Features";
import Contact from "./components/Contact";
import About from "./components/About";
import AdSlot from "./components/AdSlot";
import SeoPage from "./components/SeoPage";
import "./App.css";
import InstagramInfo from "./components/InstagramInfo";
import YouTubeInfo from "./components/YouTubeInfo";
import { IconAll, IconReel, IconPhoto, IconDp, IconStories, IconIgtv, IconCarousel, IconHighlights, IconBolt, IconUnlock, IconInfinity } from "./components/Icons";
import heroIllustration from "./assets/hero-illustration.svg";
import { SUPPORTED_LOCALES, parseLocalePath, canonicalUrl, switchLocalePath, localizedHref, isRefreshOf } from "./i18nRoutes";

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

// Homepage-only canonical + hreflang (also covers /hi, /id, /th, /es — the localized
// homepages). NOTE: this used to live in the always-mounted top-level <Helmet> below,
// which meant it "won" over every route's own more specific canonical (e.g. SeoPage.js's,
// About.js's) regardless of nesting — react-helmet's duplicate-tag precedence here turned
// out to be commit-order-based, not deepest-wins, so a persistent parent Helmet beat a
// freshly-mounted child one on every navigation. Gating this on the actual route avoids
// the conflict entirely instead of fighting react-helmet's resolution order.
// This also owns title/description/keywords, not just canonical/hreflang — react-helmet
// replaces the single <title> element in place ("last writer wins" on the same node),
// so when FAQ.js was ALSO simultaneously mounted (embedded on the homepage) with its own
// <title>, the actual live homepage title ended up being FAQ's, not this one — found by
// checking the real rendered DOM, not assumption. FAQ.js now only declares its own
// title/description when it's the standalone /faq page, never when embedded, so this is
// the single source of truth for the homepage's title/description.
function HomeSeoTags() {
  const { t } = useTranslation();
  const location = useLocation();
  const { lang, rest } = parseLocalePath(location.pathname);
  if (rest !== "/") return null;
  return (
    <Helmet>
      <title>{t("app_title", "InstantSaver")} — {t("page_title", "Instagram Downloader: Reels, Photos, Carousel Free")}</title>
      <meta name="description" content={t("hero_desc", "Download Instagram Reels, Photos, and Carousel posts in HD — no watermark, no login. Free & fast on iPhone, Android, and PC.")} />
      <meta name="keywords" content="instagram downloader, instagram reels downloader, download instagram photos, carousel downloader, free instagram downloader, no watermark" />
      <link rel="canonical" href={canonicalUrl("/", lang)} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl("/", null)} />
      <link rel="alternate" hrefLang="en" href={canonicalUrl("/", null)} />
      {SUPPORTED_LOCALES.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl("/", l)} />
      ))}
    </Helmet>
  );
}

const TABS = [
  { id: "instagram", labelKey: "tab_instagram" },
  { id: "youtube", labelKey: "tab_youtube" }
];

const IG_TYPES = [
  { id: "auto", labelKey: "subtab_all", Icon: IconAll },
  { id: "reel", labelKey: "subtab_reels", Icon: IconReel },
  { id: "post", labelKey: "subtab_post", Icon: IconPhoto },
  { id: "dp", labelKey: "subtab_dp", Icon: IconDp },
  { id: "stories", labelKey: "subtab_stories", Icon: IconStories },
  { id: "igtv", labelKey: "subtab_igtv", Icon: IconIgtv },
  { id: "carousel", labelKey: "subtab_carousel", Icon: IconCarousel },
  { id: "highlights", labelKey: "subtab_highlights", Icon: IconHighlights }
];

const YT_TYPES = [
  { id: "auto", label: "All (Shorts/Live/Long)" },
  { id: "shorts", label: "Shorts" },
  { id: "live", label: "Live" },
  { id: "long", label: "Long Video" }
];

function StaticPage({ titleKey, titleDefault, bodyKey, bodyDefault, canonicalPath }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language !== "en" ? i18n.language : null;
  const title = t(titleKey, titleDefault);
  const body = t(bodyKey, bodyDefault);
  return (
    <div style={{ maxWidth: 800, margin: "60px auto", padding: "0 20px", lineHeight: 1.8 }}>
      <Helmet>
        <title>{title} — {t("app_title", "InstantSaver")}</title>
        <meta name="description" content={body.slice(0, 155)} />
        <link rel="canonical" href={canonicalUrl(canonicalPath, lang)} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl(canonicalPath, null)} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl(canonicalPath, null)} />
        {SUPPORTED_LOCALES.map((l) => (
          <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl(canonicalPath, l)} />
        ))}
      </Helmet>
      <h1 style={{ marginBottom: 16 }}>{title}</h1>
      <p style={{ color: "var(--text-secondary)" }}>{body}</p>
      <a href={localizedHref("/", lang)} style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}>{t("back_to_home", "← Back to Home")}</a>
    </div>
  );
}

// Scrolls to the top on route mount. Used to live under the name "RedirectOnRefresh" and
// ALSO force-navigated to "/" on every browser refresh of a non-home route — that was a
// workaround for the static host not having a SPA rewrite rule (so a hard refresh of e.g.
// /faq would 404 straight from the host, before React Router ever got a chance to run).
// Now that the host has a proper rewrite (frontend/vercel.json, frontend/public/_redirects
// — covers Vercel and Netlify, add the equivalent for whatever actually hosts this if it's
// neither), a refresh correctly re-renders the SAME route, so the forced redirect is gone.
//
// Keeping only the scroll-to-top behavior — with two different rules for a hash like
// "/#faq" depending on HOW it was reached:
//   - Clicking a same-page anchor (<a href="#faq">) should scroll down to that section —
//     that's a real navigation, not a reload, and the user explicitly asked for it.
//   - Hard-refreshing a URL that already has a hash should land on the clean page instead
//     of jumping back to that section — confirmed with the user directly (they want
//     "/#faq" + refresh to behave like "/", not re-scroll to #faq every time).
// `isRefreshOf()` (i18nRoutes.js) is what distinguishes these two cases, matching on the
// EXACT path+hash that was on-screen at the real reload — not just "was the page ever
// reloaded", which would wrongly keep affecting every later click too (e.g. refresh the
// plain homepage, then click FAQ: the document did reload, but that specific click wasn't
// a reload of "/#faq", and must scroll normally) — reported live as "clicking FAQ
// refreshed to the homepage" when an earlier version of this got that distinction wrong.
function ScrollToTop() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    if (location.hash) {
      if (isRefreshOf(location.pathname, location.hash)) {
        navigate(location.pathname + location.search, { replace: true });
        return;
      }
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.hash]);

  return null;
}

function NotFound() {
  const { t, i18n } = useTranslation();
  return (
    <div style={{ maxWidth: 600, margin: "100px auto", padding: "0 20px", textAlign: "center" }}>
      <Helmet>
        <title>{t("notfound_title", "Page Not Found")} — {t("app_title", "InstantSaver")}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 style={{ fontSize: 64, margin: 0 }}>404</h1>
      <p style={{ color: "var(--text-secondary)" }}>{t("notfound_text", "We couldn't find that page.")}</p>
      <a href={localizedHref("/", i18n.language)} style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}>
        {t("back_to_home", "← Back to Home")}
      </a>
    </div>
  );
}

// Reads the optional :lang segment, puts i18next into that language, and renders the
// matched child route. An unrecognized lang segment (anything not in SUPPORTED_LOCALES)
// renders 404 instead of silently treating random text as a language code.
function LocaleLayout() {
  const { lang } = useParams();
  const { i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(lang || "en");
  }, [lang, i18n]);

  if (lang && !SUPPORTED_LOCALES.includes(lang)) {
    return <NotFound />;
  }
  return <Outlet />;
}

function Home() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("instagram");
  const [igType, setIgType] = useState("auto");
  const [ytType, setYtType] = useState("auto");
  const [menuOpen, setMenuOpen] = useState(false);

  const L = (path) => localizedHref(path, i18n.language);
  const onLanguageChange = (e) => navigate(switchLocalePath(location.pathname, e.target.value));

  return (
    <div className="app">
      <ScrollToTop />

      <header className="nav">
        <div className="brand">
          <img src="/logo.png" className="logo" alt={t("app_title", "InstantSaver")} />
          <span>{t("app_title", "InstantSaver")}</span>
        </div>

        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <nav className={`links ${menuOpen ? "open" : ""}`}>
          <a href="#features" onClick={() => setMenuOpen(false)}>{t("nav_features", "Features")}</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>{t("nav_faq", "FAQ")}</a>
          <a href={L("/contact")} onClick={() => setMenuOpen(false)}>{t("nav_contact", "Contact")}</a>
          <ThemeToggle />
          <select
            aria-label="Language"
            value={i18n.language}
            onChange={onLanguageChange}
            className="lang-select"
          >
            <option value="en">🌐 English</option>
            <option value="hi">🇮🇳 हिंदी</option>
            <option value="id">🇮🇩 Indonesia</option>
            <option value="th">🇹🇭 ภาษาไทย</option>
            <option value="es">🇪🇸 Español</option>
          </select>
        </nav>

        {menuOpen && <div className="nav-backdrop" onClick={() => setMenuOpen(false)} />}
      </header>

      <AdSlot zone="header" />

      <section className="hero">
        <img src={heroIllustration} alt="" className="hero-illustration" />
        <h1>{t("hero_title", "Instagram Downloader — Reels, Photos & Carousel")}</h1>
        <p>{t("hero_desc", "Download Instagram Reels, Photos, Carousel posts & YouTube videos — HD quality, no watermark, free.")}</p>

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
        <p className="auto-detect-hint">
          {t("auto_detect_hint", "🔍 Just paste any link below — we auto-detect Reels, Posts, Stories, Highlights, Carousels & Profile pictures for you.")}
        </p>

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
                  <tObj.Icon /> {t(tObj.labelKey, tObj.labelKey)}
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
            <div className="card-icon card-icon-brand"><IconBolt /></div>
            <h3>{t("features_fast_title", "Fast & Smart")}</h3>
            <p>{t("features_fast_desc", "High-speed processing backed by optimized pipelines to preview & download instantly.")}</p>
          </div>
          <div className="card">
            <div className="card-icon card-icon-success"><IconUnlock /></div>
            <h3>{t("features_free_title", "Free to Use")}</h3>
            <p>{t("features_free_desc", "No signup. No paywall. Just paste your link, preview, and download.")}</p>
          </div>
          <div className="card">
            <div className="card-icon card-icon-primary"><IconInfinity /></div>
            <h3>{t("features_unlimited_title", "Unlimited")}</h3>
            <p>{t("features_unlimited_desc", "Use it as much as you like. No hidden limits.")}</p>
          </div>
        </div>
      </section>

      <section id="faq" className="faq-section">
        <FAQ />
      </section>

      <AdSlot zone="inContent" />

      <footer className="footer">
        <AdSlot zone="footer" />
        <div className="footer-brand">
          <img src="/logo.png" className="logo small" alt={t("app_title", "InstantSaver")} />
          <strong>{t("app_title", "InstantSaver")}</strong>
        </div>
        {/* These SEO landing pages are English-only content (not yet translated), so they
            intentionally always link to the bare English URL regardless of current
            language — avoids pointing a Hindi-browsing visitor at a /hi/ URL whose body
            copy is still 100% English. */}
        <nav className="footer-tools">
          <h4>{t("footer_tools_title", "Instagram Tools")}</h4>
          <a href="/instagram-downloader">{t("footer_tool_ig", "Instagram Video Downloader")}</a>
          <a href="/reels-downloader">{t("footer_tool_reels", "Instagram Reels Downloader")}</a>
          <a href="/carousel-downloader">{t("footer_tool_carousel", "Instagram Carousel Downloader")}</a>
          <a href="/profile-picture-downloader">{t("footer_tool_dp", "Instagram DP Downloader")}</a>
          <a href="/stories-downloader">{t("footer_tool_stories", "Instagram Story Downloader")}</a>
          <a href="/highlights-downloader">{t("footer_tool_highlights", "Instagram Highlights Downloader")}</a>
          <a href="/youtube-downloader">{t("footer_tool_youtube", "YouTube Video Downloader")}</a>
        </nav>
        <nav className="footer-links">
          <a href={L("/about")}>{t("nav_about", "About")}</a>
          <a href={L("/privacy")}>{t("privacy_policy", "Privacy Policy")}</a>
          <a href={L("/terms")}>{t("terms_of_service", "Terms of Service")}</a>
          <a href={L("/contact")}>{t("nav_contact", "Contact")}</a>
          <a href="#faq">{t("nav_faq", "FAQ")}</a>
        </nav>
        <p>© {new Date().getFullYear()} {t("app_title", "InstantSaver")}. All rights reserved.</p>
        <p className="disclaimer">{t("footer_disclaimer", "Disclaimer: All logos and trademarks belong to their respective owners. Downloads are fetched directly from public CDNs. Please respect platform terms.")}</p>
      </footer>
    </div>
  );
}

// Applies whatever theme choice is stored in localStorage (if any) to <html> as soon as
// the app boots — before anything else, so there's no flash of the wrong theme. Absence
// of a stored choice is deliberate: it means "follow the OS", which App.css's
// prefers-color-scheme media query already handles with no attribute needed.
const THEME_STORAGE_KEY = "instantsaver-theme";
(function applyStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch {
    // localStorage unavailable (private browsing etc.) — falls back to OS preference.
  }
})();

function getStoredTheme() {
  try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme() || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* ignore */ }
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export default function App() {
  return (
    <Router>
      <GAPageTracker />
      <HomeSeoTags />

      <Routes>
        {/* Every page lives under an optional :lang prefix (hi/id/th/es — English is the
            unprefixed default) so each language is a real, separately crawlable URL
            instead of one URL that silently reflows based on browser/localStorage state. */}
        <Route element={<LocaleLayout />}>
          <Route path="/:lang?" element={<Home />} />

          <Route path="/:lang?/features" element={<><ScrollToTop /><Features /></>} />
          <Route path="/:lang?/faq" element={<><ScrollToTop /><FAQ /></>} />
          <Route path="/:lang?/contact" element={<><ScrollToTop /><Contact /></>} />
          <Route path="/:lang?/about" element={<><ScrollToTop /><About /></>} />
          <Route path="/:lang?/privacy" element={<><ScrollToTop /><StaticPage
            titleKey="privacy_title" titleDefault="Privacy Policy"
            bodyKey="privacy_body" bodyDefault="InstantSaver does not store, log, or share any user data or downloaded URLs. All processing happens server-side and no personal information is collected. Downloads are fetched directly from public CDNs. By using this service you agree to respect the terms of the platforms you download from."
            canonicalPath="/privacy" /></>} />
          <Route path="/:lang?/terms" element={<><ScrollToTop /><StaticPage
            titleKey="terms_title" titleDefault="Terms of Service"
            bodyKey="terms_body" bodyDefault="InstantSaver is provided free of charge for personal, non-commercial use. You agree to use it only to download publicly accessible content for personal offline use. Redistribution or commercial use of downloaded content without the original creator's permission is prohibited. We reserve the right to suspend service at any time without notice."
            canonicalPath="/terms" /></>} />

          {/* SEO Landing Pages — high-quality, crawlable content for Google. English-only
              for now (SEO_PAGE_DATA isn't translated), reachable under a lang prefix for
              nav consistency but each still canonicalizes to its bare English URL. */}
          <Route path="/:lang?/instagram-downloader" element={<SeoPage slug="instagram-downloader" />} />
          <Route path="/:lang?/reels-downloader" element={<SeoPage slug="reels-downloader" />} />
          <Route path="/:lang?/youtube-downloader" element={<SeoPage slug="youtube-downloader" />} />
          <Route path="/:lang?/profile-picture-downloader" element={<SeoPage slug="profile-picture-downloader" />} />
          <Route path="/:lang?/carousel-downloader" element={<SeoPage slug="carousel-downloader" />} />
          <Route path="/:lang?/stories-downloader" element={<SeoPage slug="stories-downloader" />} />
          <Route path="/:lang?/highlights-downloader" element={<SeoPage slug="highlights-downloader" />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}
