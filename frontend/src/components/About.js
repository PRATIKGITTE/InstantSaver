// src/components/About.js
import React from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { SUPPORTED_LOCALES, canonicalUrl, localizedHref } from "../i18nRoutes";

export default function About() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language !== "en" ? i18n.language : null;

  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "InstantSaver",
    "url": "https://instantsaver.in/",
    "founder": {
      "@type": "Person",
      "name": "Pratik Gitte"
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "60px auto", padding: "0 20px", lineHeight: 1.8 }}>
      <Helmet>
        <title>{t("about_page_title", "About InstantSaver — Free Instagram & YouTube Downloader")}</title>
        <meta name="description" content={t("about_meta_desc", "Learn about InstantSaver, a free tool for downloading Instagram Reels, Photos, Carousels, Stories, and YouTube videos — no login, no data stored.")} />
        <link rel="canonical" href={canonicalUrl("/about", lang)} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl("/about", null)} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl("/about", null)} />
        {SUPPORTED_LOCALES.map((l) => (
          <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl("/about", l)} />
        ))}
        <script type="application/ld+json">{JSON.stringify(org)}</script>
      </Helmet>

      <h1 style={{ marginBottom: 16 }}>{t("about_title", "About InstantSaver")}</h1>

      <p style={{ color: "var(--text-secondary)" }}>
        {t("about_p1", "InstantSaver is a free web tool for downloading public Instagram Reels, Photos, Carousel posts, Stories, and Profile Pictures, along with YouTube videos and Shorts. Paste a link, get a preview, and download — no account, no app install, no watermark.")}
      </p>

      <p style={{ color: "var(--text-secondary)" }}>
        {t("about_p2", "We built InstantSaver because most downloader sites bury a simple task under intrusive ads, fake download buttons, and popups. Ours doesn't do that: no autoplaying media, no forced redirects, and no login is ever requested.")}
      </p>

      <p style={{ color: "var(--text-secondary)" }}>
        {t("about_p3", "InstantSaver doesn't store, log, or share the links you paste or the files you download — everything is processed in real time and fetched directly from the platform's own public CDN. See our Privacy Policy for the full details.")}
      </p>

      <p style={{ color: "var(--text-secondary)" }}>
        {t("about_p4", "InstantSaver is built and maintained by Pratik Gitte. If something's broken or you have a feature request, reach out via the Contact page.")}
      </p>

      <a href={localizedHref("/", lang)} style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}>{t("back_to_home", "← Back to Home")}</a>
    </div>
  );
}
