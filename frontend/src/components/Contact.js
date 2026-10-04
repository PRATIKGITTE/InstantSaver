// src/components/Contact.js
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { SUPPORTED_LOCALES, parseLocalePath, canonicalUrl, localizedHref, isRefreshOf } from "../i18nRoutes";

export default function Contact() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = parseLocalePath(location.pathname);

  // Deliberately standalone-only (not embedded on the homepage — personal contact info
  // shouldn't be part of the scrollable public landing page) AND, unlike every other
  // standalone page (/faq, /about, /privacy...), refreshing this one bounces back to the
  // homepage instead of staying put — the user explicitly wants this page to behave like
  // a transient hash anchor on refresh, not a permanent bookmarkable one, even though it's
  // reached via a real route rather than a "#contact" hash.
  useEffect(() => {
    if (isRefreshOf(location.pathname)) {
      navigate(localizedHref("/", i18n.language !== "en" ? i18n.language : null), { replace: true });
    }
  }, []);

  const developer = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Pratik Gitte",
    "email": "mailto:pratikgitte123@gmail.com",
    "jobTitle": "Full Stack Developer",
    "worksFor": {
      "@type": "Organization",
      "name": "InstantSaver"
    }
  };

  return (
    <div style={{ padding: "22px", fontFamily: "Inter, sans-serif" }}>
      <Helmet>
        <title>Contact — InstantSaver</title>
        <meta name="description" content="Contact the developer of InstantSaver – Pratik Gitte." />
        <link rel="canonical" href={canonicalUrl("/contact", lang)} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl("/contact", null)} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl("/contact", null)} />
        {SUPPORTED_LOCALES.map((l) => (
          <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl("/contact", l)} />
        ))}
        <script type="application/ld+json">{JSON.stringify(developer)}</script>
      </Helmet>

      <h1>{t("contact_title")}</h1>
      <p><strong>{t("contact_name_label")}:</strong> Pratik Gitte</p>
      <p><strong>{t("contact_email_label")}:</strong> <a href="mailto:pratikgitte123@gmail.com">pratikgitte123@gmail.com</a></p>
      <p><strong>{t("contact_role_label")}:</strong> Full Stack Developer</p>

      <h3 style={{ marginTop: 18 }}>{t("contact_creator_line")}</h3>
    </div>
  );
}
