import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LandingImg from "../../components/LandingImg";
import { LANDING_SECTION_LINKS } from "../../constants/landingNav";
import { DEMO_SECTION_ID, scrollToDemoSection } from "../../utils/scrollToDemo";
import { scrollToLandingSection } from "../../utils/scrollToLandingSection";
import "./Footer.scss";
import logo from "./img/logo.svg";
import call from "./img/call.svg";
import gmail from "./img/gmail.svg";
import loc from "./img/loc.svg";
import inst from "./img/inst.svg";
import wa from "./img/wa.svg";
import yt from "./img/yt.svg";
import blur from "./img/blur.svg";

const Footer = () => {
  const { t } = useTranslation("newLanding");
  const location = useLocation();
  const navigate = useNavigate();

  const handleSectionClick = (e, sectionId) => {
    e.preventDefault();
    scrollToLandingSection(navigate, location.pathname, sectionId);
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
        <div className="footer__content">
          <div className="col-3 footer__content__first">
            <LandingImg src={logo} alt={t("footer.logoAlt")} />
            <p className="footer__description">{t("footer.description")}</p>
          </div>

          <div className="col-3 footer__content__second">
            <h3 className="footer__subtitle">{t("footer.navTitle")}</h3>
            <ul className="footer__content__ul">
              {LANDING_SECTION_LINKS.map(({ id, labelKey }) => (
                <li key={id}>
                  <a
                    className="footer__content__link"
                    href={`/#${id}`}
                    onClick={(e) => handleSectionClick(e, id)}
                  >
                    {t(labelKey)}
                  </a>
                </li>
              ))}
              <li>
                <NavLink className="footer__content__link" to="/video-lessons">
                  {t("nav.knowledgeBase")}
                </NavLink>
              </li>
              <li>
                <a
                  className="footer__content__link"
                  href={`/#${DEMO_SECTION_ID}`}
                  onClick={handleDemoClick}
                >
                  {t("nav.faq")}
                </a>
              </li>
            </ul>
          </div>

          <div className="col-3 footer__content__third">
            <h3 className="footer__subtitle">{t("footer.contactsTitle")}</h3>
            <ul className="footer__content__ul">
              <a
                className="footer__content__link footer__content__link1"
                href="tel:+996556900556"
              >
                <LandingImg
                  className="footer__icon"
                  src={call}
                  alt=""
                  aria-hidden="true"
                />
                {t("footer.phone")}
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="mailto:nurcrmkg@gmail.com"
              >
                <LandingImg
                  className="footer__icon"
                  src={gmail}
                  alt=""
                  aria-hidden="true"
                />
                {t("footer.email")}
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
                {t("footer.address")}
              </a>
            </ul>
          </div>

          <div className="col-3 footer__content__fourth">
            <h3 className="footer__subtitle">{t("footer.socialTitle")}</h3>
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
                {t("footer.instagram")}
              </a>
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
                {t("footer.whatsapp")}
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
                {t("footer.youtube")}
              </a>
            </ul>
          </div>
        </div>
        <hr className="!mt-2" />
        <div className="footer__end">
          <p className="footer__end-des">{t("footer.copyright")}</p>
          <div className="footer__end__des">
            <a className="footer__end-des" href="#">
              {t("footer.privacy")}
            </a>
            <a className="footer__end-des" href="#">
              {t("footer.terms")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
