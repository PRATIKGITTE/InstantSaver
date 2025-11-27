import React from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import "./FAQ.css";

export default function FAQ() {
  const { t, i18n } = useTranslation();

  // Dynamically generate alternate language links
  const hreflangs = [
    { lang: "en", url: "https://yourdomain.com/" },
    { lang: "hi", url: "https://yourdomain.com/hi" },
  ];

  return (
    <section id="faq" className="faq" aria-labelledby="faq-heading">
      <Helmet>
        <title>{t("faq_title")} — InstantSaver</title>
        <meta
          name="description"
          content="FAQ — How InstantSaver previews and downloads Instagram & YouTube media (public)."
        />
        <meta
          name="keywords"
          content="download instagram reel, download youtube, preview video, instant saver"
        />

        {/* Open Graph */}
        <meta
          property="og:title"
          content={`${t("faq_title")} — InstantSaver`}
        />
        <meta
          property="og:description"
          content="FAQ — How InstantSaver previews and downloads Instagram & YouTube media (public)."
        />

        {/* Hreflang for SEO */}
        {hreflangs.map((h) => (
          <link
            key={h.lang}
            rel="alternate"
            hrefLang={h.lang}
            href={h.url}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href="https://yourdomain.com/" />
      </Helmet>

      <h2 id="faq-heading">{t("faq_title")}</h2>

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
