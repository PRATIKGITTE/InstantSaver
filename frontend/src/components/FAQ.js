import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { SUPPORTED_LOCALES, parseLocalePath, canonicalUrl, localizedHref } from "../i18nRoutes";
import "./FAQ.css";

// Merged from two previously-separate, overlapping FAQ lists (a 6-question grid here and
// a 10-question accordion duplicated inside InstagramInfo.js) into one accordion — the
// ig_faq_* set is the more specific, Instagram-feature-focused one (DP, carousel, legality,
// speed), kept in full; only the two faq_q* questions it didn't already cover (the
// preview/download mechanics and the no-storage privacy point) were folded in alongside it.
const FAQ_ITEMS = [
  { q: "ig_faq_q1", a: "ig_faq_a1" },
  { q: "ig_faq_q2", a: "ig_faq_a2" },
  { q: "ig_faq_q3", a: "ig_faq_a3" },
  { q: "ig_faq_q4", a: "ig_faq_a4" },
  { q: "ig_faq_q5", a: "ig_faq_a5" },
  { q: "ig_faq_q6", a: "ig_faq_a6" },
  { q: "ig_faq_q7", a: "ig_faq_a7" },
  { q: "ig_faq_q8", a: "ig_faq_a8" },
  { q: "ig_faq_q9", a: "ig_faq_a9" },
  { q: "ig_faq_q10", a: "ig_faq_a10" },
  { q: "faq_q2_title", a: "faq_q2_text" },
  { q: "faq_q6_title", a: "faq_q6_text" },
];

function FaqAccordionItem({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="faq-accordion-item">
      <button className="faq-accordion-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && <p className="faq-accordion-answer">{a}</p>}
    </div>
  );
}

export default function FAQ() {
  const { t } = useTranslation();
  const location = useLocation();
  const { lang, rest } = parseLocalePath(location.pathname);

  // ✅ Show Home button ONLY on the standalone /faq (or /hi/faq, etc.) route, not the
  // homepage's embedded #faq section.
  const showHomeButton = rest === "/faq";
  // This component renders standalone (its own page, needs an <h1>) or embedded inside
  // the homepage (which already has its own <h1> in the hero) — using <h1> in both
  // cases would create two <h1>s on the homepage, and jumping straight to <h3> for the
  // FAQ items (as this used to do unconditionally) skips a heading level, which fails
  // accessibility's heading-order check either way.
  const TitleTag = showHomeButton ? "h1" : "h2";

  const resolvedItems = FAQ_ITEMS.map((item) => ({ q: t(item.q, item.q), a: t(item.a, item.a) }));

  return (
    <>
      {/* ✅ HOME BUTTON - ONLY on /faq route */}
      {showHomeButton && (
        <div className="app-header">
          <header className="nav">
            <div className="brand">
              <img src="/logo.png" className="logo" alt="InstantSaver" />
              <span>InstantSaver</span>
            </div>
            <nav className="links">
              <a href={localizedHref("/", lang)}>← {t("back_to_home_short", "Home")}</a>
            </nav>
          </header>
        </div>
      )}

      {/* Title/description/OG/hreflang are gated to the standalone /faq route — this
          component is ALSO embedded on the homepage (inside <section id="faq">), and
          declaring them unconditionally meant they fought the homepage's own
          HomeSeoTags for the single <title> element ("last writer wins" on that node)
          and appended a second, incomplete hreflang set alongside it.
          NOTE: this MUST be its own separate <Helmet>, not a Fragment conditionally
          rendered *inside* one shared Helmet below — this version of react-helmet only
          looks for tag elements as DIRECT children and doesn't traverse into a nested
          Fragment, so a `{cond && <>...</>}` block inside <Helmet> gets silently
          ignored entirely (confirmed live: title/canonical never applied at all). */}
      {showHomeButton && (
        <Helmet>
          <title>{t("faq_page_title", "InstantSaver™ – Instagram & YouTube Video Downloader (Reels, Posts, Shorts)")}</title>
          <meta
            name="description"
            content={t("faq_page_meta_desc", "Download Instagram Reels, Posts, Carousels & YouTube Shorts in HD. Fast, secure & no login required.")}
          />
          <meta
            name="keywords"
            content="instantsaver, instagram downloader, reels downloader, youtube downloader, shorts downloader"
          />
          <link rel="canonical" href={canonicalUrl("/faq", lang)} />
          <meta property="og:title" content={t("faq_page_title", "InstantSaver™ – Instagram & YouTube Video Downloader (Reels, Posts, Shorts)")} />
          <meta property="og:description" content={t("faq_page_meta_desc", "Download Instagram Reels, Posts, Carousels & YouTube Shorts in HD. Fast, secure & no login required.")} />
          <meta property="og:image" content="https://instantsaver.in/og-cover.png" />
          <meta property="og:url" content={canonicalUrl("/faq", lang)} />
          <link rel="alternate" hrefLang="x-default" href={canonicalUrl("/faq", null)} />
          <link rel="alternate" hrefLang="en" href={canonicalUrl("/faq", null)} />
          {SUPPORTED_LOCALES.map((l) => (
            <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl("/faq", l)} />
          ))}
        </Helmet>
      )}

      <Helmet>
        {/* FAQPage JSON-LD stays unconditional (renders on both standalone /faq and the
            homepage embed) — multiple JSON-LD scripts can coexist fine, it's not a
            single-node/competing-tag situation like title or canonical. Generated from
            the SAME resolvedItems the page actually renders, in the current language,
            instead of a separate hand-maintained list that could (and did) drift out of
            sync with the real questions shown on the page. */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "InstantSaver",
            "url": "https://instantsaver.in/",
            "logo": "https://instantsaver.in/logo.png",
            "description": "Free Instagram Reels & YouTube video downloader"
          })}
        </script>

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": resolvedItems.map((item) => ({
              "@type": "Question",
              "name": item.q,
              "acceptedAnswer": { "@type": "Answer", "text": item.a }
            }))
          })}
        </script>
      </Helmet>

      <section className="faq" aria-labelledby="faq-heading">
        <TitleTag>{t("faq_section_heading", "Frequently Asked Questions")}</TitleTag>
        <p className="faq-intro">
          {t("faq_intro", "Everything you need to know about downloading Instagram Reels, Posts & YouTube videos.")}
        </p>

        <div className="faq-accordion">
          {resolvedItems.map((item, i) => (
            <FaqAccordionItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>
    </>
  );
}
