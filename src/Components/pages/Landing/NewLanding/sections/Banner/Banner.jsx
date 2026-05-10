import React from "react";
import "./Banner.scss";

const Banner = () => {
  return (
    <section className="banner">
      <div className="banner__container new-container">
        <h2 className="banner__title">
          Управляйте бизнесом <br />
          <span>в одной</span> системе
        </h2>
        <p className="banner__text">
          CRM, склад, касса, аналитика, продажи и сотрудники — всё под контролем
          в NurCRM
        </p>
        <div className="banner__buttons">
          <button className="banner__buttons-btn banner__buttons-btn--primary">
            Оставить заявку
          </button>
          <button className="banner__buttons-btn banner__buttons-btn--secondary">
            Бесплатная консультация
          </button>
        </div>
        <img src="" alt="" />
      </div>
    </section>
  );
};

export default Banner;
