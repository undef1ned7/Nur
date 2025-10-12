import kg from "./ky.svg";
import ru from "./ru.svg";
import { useTranslation } from "react-i18next";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";
import { useState, useRef } from "react";
import "./lang.scss";
import { useLocation } from "react-router-dom";

const Lang = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const audioRef = useRef(new Audio("/sounds/switch.mp3"));
  const toggleDropdown = () => setIsOpen((prev) => !prev);

  // const handleChangeLang = (lang) => {
  //   i18n.changeLanguage(lang);
  //   localStorage.setItem("i18nextLng", lang);
  //   setIsOpen(false);
  // };
  const handleChangeLang = () => {
    const newLang = i18n.language === "ru" ? "ky" : "ru";

    i18n.changeLanguage(newLang);

    setIsOpen(false);

    audioRef.current.currentTime = 0;
    audioRef.current.play();

    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div
      className="language-switcher"
      style={pathname === "/" ? { width: "200px", margin: "0" } : {}}
    >
      <div
        className={`selected-lang ${isOpen ? "open" : ""}`}
        onClick={toggleDropdown}
      >
        <img
          src={i18n.language === "ru" ? ru : kg}
          alt={i18n.language}
          className="lang-flag"
        />
        {i18n.language === "ru" ? "Русский" : "Кыргызча"}
        <MdOutlineKeyboardArrowDown
          className={`lang-icon ${isOpen ? "open" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="dropdown">
          <div className="dropdown-item" onClick={handleChangeLang}>
            <img
              src={i18n.language === "ru" ? kg : ru}
              alt={i18n.language === "ru" ? "ky" : "ru"}
              style={{ width: 30, height: 20 }}
            />
            {i18n.language === "ru" ? "Кыргызча" : "Русский"}
          </div>
        </div>
      )}
      {/* {isOpen && (
        <div className="dropdown">
          {i18n.language !== "ru" && (
            <div
              className="dropdown-item"
              onClick={() => handleChangeLang("ru")}
            >
              <img src={ru} alt="ru" className="lang-flag" />
              Русский
            </div>
          )}
          {i18n.language !== "kg" && (
            <div
              className="dropdown-item"
              onClick={() => handleChangeLang("kg")}
            >
              <img src={kg} alt="kg" className="lang-flag" />
              Кыргызча
            </div>
          )}
        </div>
      )} */}
    </div>
  );
};

export default Lang;
