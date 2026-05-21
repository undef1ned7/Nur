import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import phoneIcon from "../../assets/icons/phone.svg";
import headerLogo from "../../assets/icons/headerLogo.svg";
import { DEMO_SECTION_ID, scrollToDemoSection } from "../../utils/scrollToDemo";
import "./header.scss";

const SECTION_LINKS = [
  { id: "features", label: "Возможности" },
  { id: "for-whom", label: "Для кого" },
  { id: "interface", label: "Интерфейс" },
  { id: "tariff", label: "Тариф" },
  { id: "team", label: "Команда" },
];

const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `/#${id}`);
  }
};

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";
  const currentHash = location.hash.replace("#", "");

  const closeMenu = () => setMenuOpen(false);

  const handleSectionClick = (e, sectionId) => {
    e.preventDefault();
    closeMenu();

    if (isLanding) {
      scrollToSection(sectionId);
      return;
    }

    navigate({ pathname: "/", hash: sectionId });
  };

  return (
    <header className={`newHeader${menuOpen ? " newHeader--menu-open" : ""}`}>
      <div className="newHeader__container new-container">
        <div className="newHeader__left">
          <Link to="/" className="newHeader__logo" onClick={closeMenu}>
            <img src={headerLogo} alt="NurCRM" />
          </Link>
          <nav className="newHeader__nav" aria-label="Основная навигация">
            <ul className="newHeader__menu">
              {SECTION_LINKS.map(({ id, label }) => (
                <li key={id} className="newHeader__menu-item">
                  <a
                    href={`/#${id}`}
                    className={isLanding && currentHash === id ? "active" : undefined}
                    onClick={(e) => handleSectionClick(e, id)}
                  >
                    {label}
                  </a>
                </li>
              ))}
              <li className="newHeader__menu-item">
                <NavLink
                  to="/video-lessons"
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                  onClick={closeMenu}
                >
                  База знаний
                </NavLink>
              </li>
              <li className="newHeader__menu-item">
                <a
                  href={`/#${DEMO_SECTION_ID}`}
                  className={
                    isLanding && currentHash === DEMO_SECTION_ID ? "active" : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    closeMenu();
                    scrollToDemoSection(navigate, location.pathname);
                  }}
                >
                  FAQ
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="newHeader__right">
          <NavLink
            to="/login"
            className="newHeader__login"
            onClick={closeMenu}
          >
            Логин
          </NavLink>
          <div className="newHeader__lang">
            <button type="button">RU</button>
            <span>/</span>
            <button type="button">KG</button>
          </div>
          <div className="newHeader__contacts">
            <img src={phoneIcon} alt="" />
            <a href="tel:+996557880182">+996 557 880 182</a>
          </div>
          <button
            type="button"
            className="newHeader__burger"
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
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
