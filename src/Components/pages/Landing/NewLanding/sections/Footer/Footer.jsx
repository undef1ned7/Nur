import { NavLink, useLocation, useNavigate } from "react-router-dom";
import LandingImg from "../../components/LandingImg";
import { DEMO_SECTION_ID, scrollToDemoSection } from "../../utils/scrollToDemo";
import "./Footer.scss";
import logo from "./img/logo.svg";
import call from "./img/call.svg";
import gmail from "./img/gmail.svg";
import loc from "./img/loc.svg";
import inst from "./img/inst.svg";
import tg from "./img/tg.svg";
import wa from "./img/wa.svg";
import yt from "./img/yt.svg";
import blur from "./img/blur.svg";

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

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";

  const handleSectionClick = (e, sectionId) => {
    e.preventDefault();

    if (isLanding) {
      scrollToSection(sectionId);
      return;
    }

    navigate({ pathname: "/", hash: sectionId });
  };

  const handleDemoClick = (e) => {
    e.preventDefault();
    scrollToDemoSection(navigate, location.pathname);
  };

  return (
    <footer className="footer !mt-0">
      <LandingImg
        className="footer__blur"
        src={blur}
        alt=""
        aria-hidden="true"
      />
      <div className="footer__container new-container">
        {/* <hr /> */}
        <div className="footer__content">
          <div className="col-3 footer__content__first">
            <LandingImg src={logo} alt="NurCRM" />
            <p className="footer__description">
              NurCRM — система для управления бизнесом: продажи, склад, касса,
              аналитика и клиенты в одном месте.
            </p>
          </div>

          <div className="col-3 footer__content__second">
            <h3 className="footer__subtitle">Навигация</h3>
            <ul className="footer__content__ul">
              {SECTION_LINKS.map(({ id, label }) => (
                <li key={id}>
                  <a
                    className="footer__content__link"
                    href={`/#${id}`}
                    onClick={(e) => handleSectionClick(e, id)}
                  >
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <NavLink className="footer__content__link" to="/video-lessons">
                  База знаний
                </NavLink>
              </li>
              <li>
                <a
                  className="footer__content__link"
                  href={`/#${DEMO_SECTION_ID}`}
                  onClick={handleDemoClick}
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div className="col-3 footer__content__third">
            <h3 className="footer__subtitle">Контакты</h3>
            <ul className="footer__content__ul">
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <LandingImg
                  className="footer__icon"
                  src={call}
                  alt=""
                  aria-hidden="true"
                />
                +996 (556) 900 556
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <LandingImg
                  className="footer__icon"
                  src={gmail}
                  alt=""
                  aria-hidden="true"
                />
                nurcrmkg@gmail.com
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <LandingImg
                  className="footer__icon"
                  src={loc}
                  alt=""
                  aria-hidden="true"
                />
                Улица Салиевой, 1/3, Ош, Кыргызстан
              </a>
            </ul>
          </div>

          <div className="col-3 footer__content__fourth">
            <h3 className="footer__subtitle">Мы в соц сетях</h3>
            <ul className="footer__content__ul">
              <a
                className="footer__content__link footer__content__link1"
                href="https://www.instagram.com/nurcrm.osh/"
              >
                <LandingImg
                  className="footer__icon"
                  src={inst}
                  alt=""
                  aria-hidden="true"
                />
                Instagram
              </a>
              {/* <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <img
                  className="footer__icon
                "
                  src={tg}
                  alt=""
                />
                Telegram
              </a> */}
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <LandingImg
                  className="footer__icon"
                  src={wa}
                  alt=""
                  aria-hidden="true"
                />
                WhatsApp
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="https://www.youtube.com/@NURCRM25"
              >
                <LandingImg
                  className="footer__icon"
                  src={yt}
                  alt=""
                  aria-hidden="true"
                />
                YouTube
              </a>
            </ul>
          </div>
        </div>
        <hr className="!mt-2" />
        <div className="footer__end">
          <p className="footer__end-des">© 2026 NurCRM. Все права защищены.</p>
          <div className="footer__end__des">
            <a className="footer__end-des" href="#">
              Политика конфиденциальности
            </a>
            <a className="footer__end-des" href="#">
              Пользовательское соглашение
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
