import React, { useEffect } from "react";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import LandingImg from "../../components/LandingImg";
import banner from "../../assets/banner/banner.jpg";
import smartphone from "../../assets/icons/smartphone.svg";
import shop from "../../assets/icons/shop.svg";
import mess from "../../assets/icons/mess.svg";
import blur1 from "./img/blur1.svg";
import blur2 from "./img/blur2.svg";
import "./Banner.scss";

const Banner = () => {
  const scrollToDemo = useScrollToDemo();

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = banner;
    link.fetchPriority = "high";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <section className="banner">
      <div className="banner__container new-container">
        <LandingImg className="banner__blur1" src={blur1} alt="" aria-hidden="true" />
        <LandingImg className="banner__blur2" src={blur2} alt="" aria-hidden="true" />
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
          <LandingImg
            className="banner__image"
            src={banner}
            alt="Интерфейс NurCRM"
            width={766}
            height={428}
            priority
          />
          <div className="banner__content__cart banner__content__cart-1">
            <LandingImg
              className="banner__content__logo"
              src={smartphone}
              alt=""
              aria-hidden="true"
            />
            <p className="banner__content__description">Поддержка 24/7</p>
          </div>
          <div className="banner__content__cart banner__content__cart-2">
            <LandingImg
              className="banner__content__logo"
              src={shop}
              alt=""
              aria-hidden="true"
            />
            <p className="banner__content__description">Для магазинов</p>
          </div>
          <div className="banner__content__cart banner__content__cart-3">
            <LandingImg
              className="banner__content__logo"
              src={mess}
              alt=""
              aria-hidden="true"
            />
            <p className="banner__content__description">Мобильное приложение</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
