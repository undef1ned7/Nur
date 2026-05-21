import "./Base.scss";
import img from "./img/img.svg";
import btn from "./img/btn.svg";
import line from "./img/line.svg";
import line2 from "./img/line2.svg";
import blur from "./img/blur.svg";

const Base = () => {
  return (
    <section className="base">
      <div className="base__container new-container">
        <div className="base__content">
          <img className="base__line" src={line} alt="" />
          <img className="base__line2" src={line2} alt="" />
          <div className="base__content__left">
            <h2 className="base__content__left__subtitle">
              <span className="base__content__left__dot"></span> ПОДДЕРЖКА И
              ОБУЧНЕНИЕ
            </h2>
            <h1 className="base__content__left__title">База знаний NurCRM</h1>
            <p className="base__content__left__description">
              Подробные видеоуроки и инструкции помогут быстро осваоить и
              использовать ее на максимум
            </p>
            <button className="base__content__left__btn">
              Перейти к базе знаний ⭢
            </button>
          </div>

          <div className="base__content__right">
            <img className="base__img" src={img} alt="" />
            <img className="base__blur" src={blur} alt="" />
          </div>
          <button className="base__content__btn">
            <img src={btn} alt="" />
          </button>
        </div>
      </div>
    </section>
  );
};
export default Base;
