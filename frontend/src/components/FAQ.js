import React from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import "./FAQ.css";

export default function FAQ() {
  const { t, i18n } = useTranslation();

  // ✅ FIXED: Real domain URLs
  const hreflangs = [
    { lang: "en", url: "https://instantsaver.in/" },
    { lang: "hi", url: "https://instantsaver.in/hi" }, // if you have Hindi page
  ];

  return (
    <section id="faq" className="faq" aria-labelledby="faq-heading">
      <Helmet>
        {/* ✅ PAGE SEO */}
        <title>FAQ — InstantSaver | Instagram Reels & YouTube Downloader</title>
        <meta
          name="description"
          content="InstantSaver FAQ: How to download Instagram Reels, Posts & YouTube videos. Preview with audio, HD quality, no login required."
        />
        <meta
          name="keywords"
          content="instantsaver faq, instagram reels faq, youtube downloader faq, download instagram, reel downloader"
        />

        {/* ✅ OPEN GRAPH */}
        <meta
          property="og:title"
          content="InstantSaver FAQ — Instagram & YouTube Downloader Guide"
        />
        <meta
          property="og:description"
          content="Learn how InstantSaver downloads Instagram Reels & YouTube videos with preview. FAQ answers all your questions."
        />
        <meta property="og:image" content="https://instantsaver.in/og-faq.png" />
        <meta property="og:url" content="https://instantsaver.in/faq" />

        {/* ✅ CRITICAL: ORGANIZATION LOGO SCHEMA (Fixes Globe Icon) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "InstantSaver",
            "url": "https://instantsaver.in/",
            "logo": "https://instantsaver.in/logo.svg",
            "description": "Free Instagram Reels & YouTube video downloader"
          })}
        </script>

        {/* ✅ FAQ PAGE SCHEMA (Rich FAQ Snippets) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How to download Instagram Reels with InstantSaver?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "1. Copy Instagram Reel/Post URL\n2. Paste in InstantSaver\n3. Preview (with audio)\n4. Click Download (HD quality)\nNo login or watermark required."
                }
              },
              {
                "@type": "Question",
                "name": "Does InstantSaver work on mobile?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes! InstantSaver works perfectly on Android, iPhone, tablets, and desktop browsers."
                }
              },
              {
                "@type": "Question",
                "name": "Is InstantSaver safe and free?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "100% free and safe. No login, no data collection, no watermarks, no limits."
                }
              },
              {
                "@type": "Question",
                "name": "Can I download YouTube Shorts?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes, InstantSaver supports YouTube Shorts and regular videos."
                }
              },
              {
                "@type": "Question",
                "name": "What video quality does InstantSaver download?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "HD quality (up to 720p) optimized for fast download and compatibility."
                }
              },
              {
                "@type": "Question",
                "name": "Why is my download failing?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Private posts require login. Try public Reels/Posts or wait 5 minutes and retry."
                }
              }
            ]
          })}
        </script>

        {/* ✅ HREFLANG (Fixed URLs) */}
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

      <h1>InstantSaver FAQ</h1>
      <p className="faq-intro">
        Answers to common questions about downloading Instagram Reels, Posts & YouTube videos.
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
  );
}
