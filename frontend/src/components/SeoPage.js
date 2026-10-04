import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, canonicalUrl, localizedHref } from "../i18nRoutes";

import EN from "../seoPageData/en";
import HI from "../seoPageData/hi";
import ID from "../seoPageData/id";
import TH from "../seoPageData/th";
import ES from "../seoPageData/es";

const SEO_PAGE_DATA_BY_LANG = { en: EN, hi: HI, id: ID, th: TH, es: ES };
const ALL_SLUGS = Object.keys(EN);

export default function SeoPage({ slug }) {
  const { t, i18n } = useTranslation();
  const lang = SUPPORTED_LOCALES.includes(i18n.language) ? i18n.language : null;
  const page = (SEO_PAGE_DATA_BY_LANG[lang] || SEO_PAGE_DATA_BY_LANG.en)[slug] || SEO_PAGE_DATA_BY_LANG.en[slug];
  const L = (path) => localizedHref(path, lang);

  if (!page) {
    return (
      <div className="seo-page">
        <p>{t("seo_page_not_found", "Page not found.")} <Link to={L("/")}>← {t("back_to_home_short", "Home")}</Link></p>
      </div>
    );
  }

  const path = `/${slug}`;

  return (
    <>
      <Helmet>
        <title>{page.title} | InstantSaver</title>
        <meta name="description" content={page.metaDesc} />
        <meta name="keywords" content={page.keywords} />
        <link rel="canonical" href={canonicalUrl(path, lang)} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl(path, null)} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl(path, null)} />
        {SUPPORTED_LOCALES.map((l) => (
          <link key={l} rel="alternate" hrefLang={l} href={canonicalUrl(path, l)} />
        ))}
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.metaDesc} />
        <meta property="og:url" content={canonicalUrl(path, lang)} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://instantsaver.in/og-cover.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          })}
        </script>
      </Helmet>

      <div className="seo-page">
        {/* Nav */}
        <header className="nav">
          <div className="brand">
            <img src="/logo.png" className="logo" alt="InstantSaver" />
            <span>InstantSaver</span>
          </div>
          <nav className="links">
            <Link to={L("/")}>{t("seo_nav_home", "Home")}</Link>
            <a href={`${L("/")}#faq`}>{t("seo_nav_faq", "FAQ")}</a>
          </nav>
        </header>

        <main className="seo-main">
          {/* Hero */}
          <section className="seo-hero">
            <h1>{page.h1}</h1>
            <p className="seo-desc">{page.desc}</p>
            <Link to={L("/")} className="seo-cta-btn">
              {t("seo_go_to_downloader", "Go to Downloader →")}
            </Link>
          </section>

          {/* How to use */}
          <section className="seo-section">
            <h2>{t("seo_how_to_use_title", "How to Use InstantSaver")}</h2>
            <div className="seo-steps">
              <div className="seo-step">
                <span className="seo-step-num">1</span>
                <span>{t("seo_step_1", "Copy the link from Instagram or YouTube")}</span>
              </div>
              <div className="seo-step">
                <span className="seo-step-num">2</span>
                <span>{t("seo_step_2", 'Paste it in the box on the homepage and click "Preview"')}</span>
              </div>
              <div className="seo-step">
                <span className="seo-step-num">3</span>
                <span>{t("seo_step_3", 'Click the green "Download" button to save the file')}</span>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="seo-section">
            <h2>{page.featureTitle}</h2>
            <ul className="seo-features">
              {page.features.map((f, i) => (
                <li key={i}>
                  <span className="seo-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="seo-section">
            <h2>{t("seo_faq_title", "Frequently Asked Questions")}</h2>
            <div className="seo-faq">
              {page.faq.map((item, i) => (
                <details key={i} className="seo-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="seo-cta-section">
            <h2>{t("seo_ready_title", "Ready to Download?")}</h2>
            <p>{t("seo_ready_desc", "InstantSaver is free, fast, and requires no sign-up.")}</p>
            <Link to={L("/")} className="seo-cta-btn large">
              {t("seo_start_downloading", "Start Downloading — It's Free →")}
            </Link>
          </section>

          {/* Internal links */}
          <nav className="seo-related">
            <h3>{t("seo_related_title", "Related Tools")}</h3>
            <ul>
              {ALL_SLUGS.filter((s) => s !== slug).map((s) => (
                <li key={s}>
                  <Link to={L(`/${s}`)}>{(SEO_PAGE_DATA_BY_LANG[lang] || EN)[s]?.h1 || EN[s].h1}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} InstantSaver. All rights reserved.</p>
          <nav className="footer-links">
            <Link to={L("/")}>{t("seo_nav_home", "Home")}</Link>
            <Link to={L("/privacy")}>{t("privacy_policy", "Privacy Policy")}</Link>
            <Link to={L("/terms")}>{t("terms_of_service", "Terms of Service")}</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
