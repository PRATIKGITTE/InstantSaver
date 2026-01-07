import React from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import "./FAQ.css";

export default function FAQ() {
  const { t, i18n } = useTranslation();

  // ✅ FIXED: Real domain URLs
  const hreflangs = [
    { lang: "en", url: "https://instantsaver.in/" },
    { lang: "hi", url: "https://instantsaver.in/hi" },
  ];

  return (
    <div className="app"> {/* ✅ Added app wrapper for consistent styling */}
      {/* ✅ HOME BUTTON HEADER - Same as Features */}
      <header className="nav">
        <div className="brand">
          <img src="/logo.png" className="logo" alt="InstantSaver" />
          <span>InstantSaver</span>
        </div>
        <nav className="links">
          <a href="/">← Home</a>
        </nav>
      </header>

      <Helmet>
        {/* ✅ FIXED: NO "FAQ" - Perfect SEO title */}
        <title>InstantSaver™ – Instagram & YouTube Video Downloader (Reels, Posts, Shorts)</title>
        <meta
          name="description"
          content="Download Instagram Reels, Posts, Carousels & YouTube Shorts in HD. Fast, secure & no login required."
        />
        <meta
          name="keywords"
          content="instantsaver, instagram downloader, reels downloader, youtube downloader, shorts downloader"
        />

        {/* ✅ FIXED OG: NO FAQ mention */}
        <meta
          property="og:title"
          content="InstantSaver™ – Instagram Reels & YouTube Downloader"
        />
        <meta
          property="og:description"
          content="Download Instagram Reels, Posts & YouTube videos in HD quality instantly. Preview before download."
        />
        <meta property="og:image" content="https://instantsaver.in/og-cover.png" />
        <meta property="og:url" content="https://instantsaver.in/faq" />

        {/* ✅ LOGO FOR GOOGLE (Fixes Globe Icon) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "InstantSaver",
            "url": "https://instantsaver.in/",
            "logo": "https://instantsaver.in/logo.png",  // ✅ PNG fixed
            "description": "Free Instagram Reels & YouTube video downloader"
          })}
        </script>

        {/* ✅ FAQ SCHEMA - Clean question names */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Download Instagram Reels",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "1. Copy Instagram Reel/Post URL\n2. Paste in InstantSaver\n3. Preview (with audio)\n4. Click Download (HD quality)\nNo login or watermark required."
                }
              },
              {
                "@type": "Question",
                "name": "Mobile compatibility",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Works perfectly on Android, iPhone, tablets, and desktop browsers."
                }
              },
              {
                "@type": "Question",
                "name": "Safe and free",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "100% free and safe. No login, no data collection, no watermarks, no limits."
                }
              },
              {
                "@type": "Question",
                "name": "YouTube Shorts support",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Supports YouTube Shorts and regular videos."
                }
              },
              {
                "@type": "Question",
                "name": "Video quality",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "HD quality (up to 720p) optimized for fast download and compatibility."
                }
              },
              {
                "@type": "Question",
                "name": "Download troubleshooting",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Private posts require login. Try public Reels/Posts or wait 5 minutes and retry."
                }
              }
            ]
          })}
        </script>

        {/* ✅ HREFLANG */}
        {hreflangs.map((h) => (
          <link
            key={h.lang}
            rel="alternate"
            hrefLang={h.lang}
            href={h.url}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href="https://instantsaver.in/" />
      </Helmet>

      <section className="faq" aria-labelledby="faq-heading">
        {/* ✅ FIXED H1: NO "FAQ" */}
        <h1>InstantSaver™ – Download Videos Instantly</h1>
        <p className="faq-intro">
          Everything you need to know about downloading Instagram Reels, Posts & YouTube videos.
        </p>

        {/* Top ad/banner placeholder */}
        <div
          className="ad-banner"
          role="complementary"
          aria-label={t("ad_banner_text")}
        >
          <div className="ad-inner">
            <strong>{t("ad_banner_text")}</strong>
            <div className="ad-placeholder">Your Ad Here</div>
          </div>
        </div>

        <div className="faq-grid">
          <div className="faq-item">
            <h3>{t("faq_q1_title")}</h3>
            <p>{t("faq_q1_text")}</p>
          </div>
          <div className="faq-item">
            <h3>{t("faq_q2_title")}</h3>
            <p>{t("faq_q2_text")}</p>
          </div>
          <div className="faq-item">
            <h3>{t("faq_q3_title")}</h3>
            <p>{t("faq_q3_text")}</p>
          </div>
          <div className="faq-item">
            <h3>{t("faq_q4_title")}</h3>
            <p>{t("faq_q4_text")}</p>
          </div>
          <div className="faq-item">
            <h3>{t("faq_q5_title")}</h3>
            <p>{t("faq_q5_text")}</p>
          </div>
          <div className="faq-item">
            <h3>{t("faq_q6_title")}</h3>
            <p>{t("faq_q6_text")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
