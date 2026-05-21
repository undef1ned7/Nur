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

const Footer = () => {
  return (
    <footer className="footer !mt-0">
      <img className="footer__blur" src={blur} alt="" aria-hidden="true" />
      <div className="footer__container new-container">
        {/* <hr /> */}
        <div className="footer__content">
          <div className="col-3 footer__content__first">
            <img src={logo} alt="" />
            <p className="footer__description">
              NurCRM — система для управления бизнесом: продажи, склад, касса,
              аналитика и клиенты в одном месте.
            </p>
          </div>

          <div className="col-3 footer__content__second">
            <h3 className="footer__subtitle">Навигация</h3>
            <ul className="footer__content__ul">
              <a className="footer__content__link" href="#">
                Возможности
              </a>
              <a className="footer__content__link" href="#">
                Для кого
              </a>
              <a className="footer__content__link" href="#">
                Интерфейс
              </a>
              <a className="footer__content__link" href="#">
                Тариф
              </a>
              <a className="footer__content__link" href="#">
                Команда
              </a>
              <a className="footer__content__link" href="#">
                База знаний
              </a>
              <a className="footer__content__link" href="#">
                FAQ
              </a>
            </ul>
          </div>

          <div className="col-3 footer__content__third">
            <h3 className="footer__subtitle">Контакты</h3>
            <ul className="footer__content__ul">
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <img
                  className="footer__icon
                "
                  src={call}
                  alt=""
                />
                +996 (556) 900 556
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <img
                  className="footer__icon
                "
                  src={gmail}
                  alt=""
                />
                nurcrmkg@gmail.com
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="#"
              >
                <img
                  className="footer__icon
                "
                  src={loc}
                  alt=""
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
                <img
                  className="footer__icon
                "
                  src={inst}
                  alt=""
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
                <img
                  className="footer__icon
                "
                  src={wa}
                  alt=""
                />
                WhatsApp
              </a>
              <a
                className="footer__content__link footer__content__link1"
                href="https://www.youtube.com/@NURCRM25"
              >
                <img
                  className="footer__icon
                "
                  src={yt}
                  alt=""
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
