import { useTranslation } from "react-i18next";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import LandingImg from "../../components/LandingImg";
import { getTranslationArray } from "../../utils/getTranslationArray";
import "./BusinessProblems.scss";
import cart1 from "./img/cart1.svg";
import cart2 from "./img/cart2.svg";
import cart3 from "./img/cart3.svg";
import cart4 from "./img/cart4.svg";
import logobanner1 from "./img/logobanner1.svg";
import logobanner2 from "./img/logobanner2.svg";
import logobanner3 from "./img/logobanner3.svg";
import logobanner4 from "./img/logobanner4.svg";
import logobanner5 from "./img/logobanner5.svg";

const BusinessProblems = () => {
  const { t } = useTranslation("newLanding");
  const scrollToDemo = useScrollToDemo();
  const cards = getTranslationArray(t, "businessProblems.cards");

  return (
    <section id="interface" className="business pt-[100px]">
      <div className="business__container new-container">
        <div className="business__wrapper">
          <div className="col-6">
            <div className="business__tems">
              <div className="business__tems-dot"></div>
              <p className="business__tems-text">
                {t("businessProblems.eyebrow")}
              </p>
            </div>
            <h2 className="business__title">
              {t("businessProblems.title")}{" "}
              <span className="business__title-span">
                {t("businessProblems.titleHighlight")}
              </span>
            </h2>
            <p className="business__description">
              {t("businessProblems.description")}
            </p>
            <div className="business__line"></div>
            <button type="button" className="business__btn" onClick={scrollToDemo}>
              {t("businessProblems.cta")}
            </button>
            <div className="business__banner">
              <LandingImg
                className="business__banner__img1"
                src={logobanner1}
                alt=""
                aria-hidden="true"
              />
              <LandingImg
                className="business__banner__img2"
                src={logobanner2}
                alt=""
                aria-hidden="true"
              />
              <LandingImg
                className="business__banner__img3"
                src={logobanner3}
                alt=""
                aria-hidden="true"
              />
              <LandingImg
                className="business__banner__img4"
                src={logobanner4}
                alt=""
                aria-hidden="true"
              />
              <LandingImg
                className="business__banner__img5"
                src={logobanner5}
                alt=""
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="col-6 ">
            <div className="business__carts">
              <div className="cols business__carts-col">
                {cards.slice(0, 2).map((card, index) => (
                  <div key={card.title} className="business__cart">
                    <div className="business__cart__up">
                      <LandingImg
                        className="business__cart__img"
                        src={[cart1, cart2][index]}
                        alt=""
                        aria-hidden="true"
                      />
                      <p className="business__cart__num">
                        {String(index + 1).padStart(2, "0")}{" "}
                      </p>
                    </div>
                    <h3 className="business__cart__title">{card.title}</h3>
                    <p className="business__cart__description">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
              <div className="cols business__carts-col">
                {cards.slice(2, 4).map((card, index) => (
                  <div key={card.title} className="business__cart">
                    <div className="business__cart__up">
                      <LandingImg
                        className="business__cart__img"
                        src={[cart3, cart4][index]}
                        alt=""
                        aria-hidden="true"
                      />
                      <p className="business__cart__num">
                        {String(index + 3).padStart(2, "0")}{" "}
                      </p>
                    </div>
                    <h3 className="business__cart__title">{card.title}</h3>
                    <p className="business__cart__description">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default BusinessProblems;
