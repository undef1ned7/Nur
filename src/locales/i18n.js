import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./ru.json";
import kg from "./kg.json";

const currentLanguage = localStorage.getItem("i18nextLng") || "ru";

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    ky: { translation: kg },
  },
  lng: currentLanguage,
  fallbackLng: "ru",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("i18nextLng", lng);
});

export default i18n;
