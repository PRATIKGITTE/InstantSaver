import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslation from "./locales/en/translation.json";
import hiTranslation from "./locales/hi/translation.json";
import idTranslation from "./locales/id/translation.json";
import thTranslation from "./locales/th/translation.json";
import esTranslation from "./locales/es/translation.json";

const supported = ["en", "hi", "id", "th", "es"];

// Auto-detect browser language, fall back to English
const browserLang = (navigator.language || "en").split("-")[0].toLowerCase();
const detectedLng = supported.includes(browserLang) ? browserLang : "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation },
      id: { translation: idTranslation },
      th: { translation: thTranslation },
      es: { translation: esTranslation },
    },
    lng: detectedLng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;
