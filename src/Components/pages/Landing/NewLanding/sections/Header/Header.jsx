import { Fragment, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LandingImg from "../../components/LandingImg";
import phoneIcon from "../../assets/icons/phone.svg";
import headerLogo from "../../assets/icons/headerLogo.svg";
import {
  LANDING_LANGUAGES,
  LANDING_SECTION_LINKS,
} from "../../constants/landingNav";
import { DEMO_SECTION_ID, scrollToDemoSection } from "../../utils/scrollToDemo";
import { scrollToLandingSection } from "../../utils/scrollToLandingSection";
import "./header.scss";

const Header = () => {
  const { t, i18n } = useTranslation("newLanding");
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";
  const currentHash = location.hash.replace("#", "");
  const currentLang = (i18n.resolvedLanguage || i18n.language || "ru").startsWith(
    "ky",
  )
    ? "ky"
    : "ru";

  const closeMenu = () => setMenuOpen(false);

  const handleSectionClick = (e, sectionId) => {
    e.preventDefault();
    closeMenu();
    scrollToLandingSection(navigate, location.pathname, sectionId);
  };

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    closeMenu();
  };

  return (
    <header className={`newHeader${menuOpen ? " newHeader--menu-open" : ""}`}>
      <div className="newHeader__container new-container">
        <div className="newHeader__left">
          <Link to="/" className="newHeader__logo" onClick={closeMenu}>
            <LandingImg src={headerLogo} alt={t("header.logoAlt")} priority />
          </Link>
          <nav className="newHeader__nav" aria-label={t("nav.ariaLabel")}>
            <ul className="newHeader__menu">
              {LANDING_SECTION_LINKS.map(({ id, labelKey }) => (
                <li key={id} className="newHeader__menu-item">
                  <a
                    href={`/#${id}`}
                    className={
                      isLanding && currentHash === id ? "active" : undefined
                    }
                    onClick={(e) => handleSectionClick(e, id)}
                  >
                    {t(labelKey)}
                  </a>
                </li>
              ))}
              <li className="newHeader__menu-item">
                <NavLink
                  to="/video-lessons"
                  className={({ isActive }) =>
                    isActive ? "active" : undefined
                  }
                  onClick={closeMenu}
                >
                  {t("nav.knowledgeBase")}
                </NavLink>
              </li>
              <li className="newHeader__menu-item">
                <a
                  href={`/#${DEMO_SECTION_ID}`}
                  className={
                    isLanding && currentHash === DEMO_SECTION_ID
                      ? "active"
                      : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    closeMenu();
                    scrollToDemoSection(navigate, location.pathname);
                  }}
                >
                  {t("nav.faq")}
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="newHeader__right">
          <NavLink to="/login" className="newHeader__login" onClick={closeMenu}>
            {t("header.login")}
          </NavLink>
          <div className="newHeader__lang">
            {LANDING_LANGUAGES.map(({ code, label }, index) => (
              <Fragment key={code}>
                {index > 0 && <span>/</span>}
                <button
                  type="button"
                  className={currentLang === code ? "active" : undefined}
                  onClick={() => handleLanguageChange(code)}
                >
                  {label}
                </button>
              </Fragment>
            ))}
          </div>
          <div className="newHeader__contacts">
            <LandingImg src={phoneIcon} alt="" aria-hidden="true" />
            <a href="tel:+996556900556">{t("header.phone")}</a>
          </div>
          <button
            type="button"
            className="newHeader__burger"
            aria-label={menuOpen ? t("header.menuClose") : t("header.menuOpen")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
