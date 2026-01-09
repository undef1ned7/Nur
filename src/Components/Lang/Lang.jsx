import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";
import ruFlag from "./ru.svg";
import kyFlag from "./ky.svg";
import "./lang.scss";
import { useLocation } from "react-router-dom";

const languages = [
  { code: "ru", name: "Русский", flag: ruFlag },
  { code: "ky", name: "Кыргызча", flag: kyFlag },

];

const Lang = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();

  const currentLang =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  const handleChangeLang = (langCode) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
    // Убрали reload() — react-i18next сам перерендерит компоненты!
    // Если где-то текст не обновляется — значит, он не через t() или компонент не в <I18nextProvider>
  };

  return (
    <div
      className="language-switcher"
      style={pathname === "/" ? { width: "200px", margin: "0" } : {}}
    >
      <div
        className={`selected-lang ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <img
          src={currentLang.flag}
          alt={currentLang.code}
          className="lang-flag"
        />
        <span className="lang-name">{currentLang.name}</span>
        <MdOutlineKeyboardArrowDown
          className={`lang-icon ${isOpen ? "open" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="dropdown">
          {languages
            .filter((lang) => lang.code !== i18n.language)
            .map((lang) => (
              <div
                key={lang.code}
                className="dropdown-item"
                onClick={() => handleChangeLang(lang.code)}
              >
                <img src={lang.flag} alt={lang.code} className="lang-flag" />
                <span>{lang.name}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default Lang;
