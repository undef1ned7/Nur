import { useTranslation } from "react-i18next";
import LandingImg from "../../components/LandingImg";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import "./Base.scss";
import img from "./img/img.svg";
import btn from "./img/btn.svg";
import line from "./img/line.svg";
import line2 from "./img/line2.svg";
import blur from "./img/blur.svg";

const Base = () => {
  const { t } = useTranslation("newLanding");
  const scrollToDemo = useScrollToDemo();

  return (
    <section className="base">
      <div className="base__container new-container">
        <div className="base__content">
          <LandingImg className="base__line" src={line} alt="" aria-hidden="true" />
          <LandingImg className="base__line2" src={line2} alt="" aria-hidden="true" />
          <div className="base__content__left">
            <h2 className="base__content__left__subtitle">
              <span className="base__content__left__dot"></span>{" "}
              {t("base.eyebrow")}
            </h2>
            <h1 className="base__content__left__title">{t("base.title")}</h1>
            <p className="base__content__left__description">
              {t("base.description")}
            </p>
            <button
              type="button"
              className="base__content__left__btn"
              onClick={scrollToDemo}
            >
              {t("base.cta")}
            </button>
          </div>

          <div className="base__content__right">
            <LandingImg className="base__img" src={img} alt="" />
            <LandingImg className="base__blur" src={blur} alt="" aria-hidden="true" />
          </div>
          <button type="button" className="base__content__btn">
            <LandingImg src={btn} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};
export default Base;
