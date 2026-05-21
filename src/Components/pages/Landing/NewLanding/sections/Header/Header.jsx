import { useState } from "react";
import { NavLink } from "react-router-dom";
import phoneIcon from "../../assets/icons/phone.svg";
import headerLogo from "../../assets/icons/headerLogo.svg";
import "./header.scss";

const NAV_ITEMS = [
  { to: "/", label: "Возможности" },
  { to: "/", label: "Для кого" },
  { to: "/", label: "Интерфейс" },
  { to: "/", label: "Тариф" },
  { to: "/", label: "Команда" },
  { to: "/video-lessons", label: "База знаний" },
  { to: "/", label: "FAQ" },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`newHeader${menuOpen ? " newHeader--menu-open" : ""}`}>
      <div className="newHeader__container new-container">
        <div className="newHeader__left">
          <div className="newHeader__logo">
            <img src={headerLogo} alt="Logo" />
          </div>
          <nav className="newHeader__nav" aria-label="Основная навигация">
            <ul className="newHeader__menu">
              {NAV_ITEMS.map(({ to, label }) => (
                <li key={label} className="newHeader__menu-item">
                  <NavLink to={to} onClick={closeMenu}>
                    {label}
                  </NavLink>
                </li>
              ))}
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
