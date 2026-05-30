import React from "react";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import banner from "../../assets/banner/banner.svg";
import smartphone from "../../assets/icons/smartphone.svg";
import shop from "../../assets/icons/shop.svg";
import mess from "../../assets/icons/mess.svg";
import blur1 from "./img/blur1.svg";
import blur2 from "./img/blur2.svg";
import "./Banner.scss";

const Banner = () => {
  const scrollToDemo = useScrollToDemo();

  return (
    <section className="banner">
      <div className="banner__container new-container">
        <img className="banner__blur1" src={blur1} alt="Blur 1" />
        <img className="banner__blur2" src={blur2} alt="Blur 2" />
        <h2 className="banner__title">
          Управляйте бизнесом <br />
          <span>в одной</span> системе
        </h2>
        <p className="banner__text">
          CRM, склад, касса, аналитика, продажи и сотрудники — всё под контролем
          в NurCRM
        </p>
        <div className="banner__buttons">
          <button
            type="button"
            className="banner__buttons-btn banner__buttons-btn--primary"
            onClick={scrollToDemo}
          >
            Оставить заявку
          </button>
          <button
            type="button"
            className="banner__buttons-btn banner__buttons-btn--secondary"
            onClick={scrollToDemo}
          >
            Бесплатная консультация
          </button>
        </div>
        <div className="banner__content">
          <img className="banner__image" src={banner} alt="Banner" />
          <div className="banner__content__cart banner__content__cart-1">
            <img
              className="banner__content__logo"
              src={smartphone}
              alt="Smartphone"
            />
            <p className="banner__content__description">Поддержка 24/7</p>
          </div>
          <div className="banner__content__cart banner__content__cart-2">
            <img className="banner__content__logo" src={shop} alt="Shop" />
            <p className="banner__content__description">Для магазинов</p>
          </div>
          <div className="banner__content__cart banner__content__cart-3">
            <img className="banner__content__logo" src={mess} alt="Mess" />
            <p className="banner__content__description">Мобильное приложение</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
