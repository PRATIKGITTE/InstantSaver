// src/components/Contact.js
import React from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

export default function Contact() {
  const { t } = useTranslation();

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
        <script type="application/ld+json">{JSON.stringify(developer)}</script>
      </Helmet>

      <h2>{t("contact_title")}</h2>
      <p><strong>{t("contact_name_label")}:</strong> Pratik Gitte</p>
      <p><strong>{t("contact_email_label")}:</strong> <a href="mailto:pratikgitte123@gmail.com">pratikgitte123@gmail.com</a></p>
      <p><strong>{t("contact_role_label")}:</strong> Full Stack Developer</p>

      <h3 style={{ marginTop: 18 }}>{t("contact_creator_line")}</h3>
    </div>
  );
}
