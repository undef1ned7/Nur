import { NavLink } from "react-router-dom";
import phoneIcon from "../../assets/icons/phone.svg";
import headerLogo from "../../assets/icons/headerLogo.svg";
import "./header.scss";

const Header = () => {
  return (
    <header className="newHeader">
      <div className="newHeader__container new-container">
        <div className="newHeader__left">
          <div className="header__logo">
            <img src={headerLogo} alt="Logo" />
          </div>
          <nav className="newHeader__nav">
            <ul className="newHeader__menu">
              <li className="newHeader__menu-item">
                <NavLink to="/">Возможности</NavLink>
              </li>
              <li className="newHeader__menu-item">
                <NavLink to="/">Для кого</NavLink>
              </li>
              <li className="newHeader__menu-item">
                <NavLink to="/">Интерфейс</NavLink>
              </li>
              <li className="newHeader__menu-item">
                <NavLink to="/">Тариф</NavLink>
              </li>
              <li className="newHeader__menu-item">
                <NavLink to="/">Команда</NavLink>
              </li>
              <li className="newHeader__menu-item">
                <NavLink to="/">База знаний</NavLink>
              </li>
              <li className="newHeader__menu-item">
                <NavLink to="/">FAQ</NavLink>
              </li>
            </ul>
          </nav>
        </div>
        <div className="newHeader__right">
          <div className="newHeader__lang">
            <button>RU</button>
            <span>/</span>
            <button>KG</button>
          </div>
          <div className="newHeader__contacts">
            <img src={phoneIcon} alt="Phone" />
            <a href="tel:+996557880182">+996 557 880 182</a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
