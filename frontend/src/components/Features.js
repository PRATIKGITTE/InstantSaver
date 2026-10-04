// src/components/Features.js
import React from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { SUPPORTED_LOCALES, canonicalUrl, localizedHref } from "../i18nRoutes";

export default function Features() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language !== "en" ? i18n.language : null;

  return (
    <div className="features-page app">
      <Helmet>
        <title>{t("features_page_title", "Features — InstantSaver")}</title>
        <meta name="description" content={t("features_page_desc", "See everything InstantSaver can do: Instagram Reels, Photos, Carousels, Stories, Profile Pictures, and YouTube video downloads — free, no login, no watermark.")} />
        <link rel="canonical" href={canonicalUrl("/features", lang)} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl("/features", null)} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl("/features", null)} />
        {SUPPORTED_LOCALES.map((l) => (
          <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl("/features", l)} />
        ))}
      </Helmet>

      <header className="nav">
        <div className="brand">
          <img src="/logo.png" className="logo" alt="InstantSaver" />
          <span>InstantSaver</span>
        </div>
        <nav className="links">
          <a href={localizedHref("/", lang)}>← {t("nav_home", "Home")}</a>
        </nav>
      </header>

      <section className="features">
        <h1>{t("features_title", "Everything in one place")}</h1>
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
    </div>
  );
}
