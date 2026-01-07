// src/components/Features.js
import React from "react";
import { useTranslation } from "react-i18next";

export default function Features() {
  const { t } = useTranslation();

  return (
    <div className="features-page">
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
