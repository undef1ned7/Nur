import { useTranslation } from "react-i18next";
import LandingImg from "../../components/LandingImg";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import { getTranslationArray } from "../../utils/getTranslationArray";
import "./Rate.scss";
import iconbutton from "./img/iconbutton.svg";
import blur from "./img/blur.svg";

const PLAN_CONFIG = [
  { id: "start", variant: "default" },
  { id: "standard", variant: "hit" },
  { id: "business", variant: "default" },
];

const FeatureItem = ({ text }) => (
  <p className="rate__cart__features-description">
    <span className="rate__cart__features-check" aria-hidden="true" />
    {text}
  </p>
);

const Rate = () => {
  const { t } = useTranslation("newLanding");
  const scrollToDemo = useScrollToDemo();

  return (
    <section id="tariff" className="rate">
      <div className="rate__container new-container">
        <h1 className="rate__title">
          {t("rate.title")}{" "}
          <span className="rate__title-span">{t("rate.titleHighlight")}</span>
        </h1>
        <button type="button" className="rate__button">
          <LandingImg
            className="rate__button-icon"
            src={iconbutton}
            alt=""
            aria-hidden="true"
          />
          {t("rate.annualDiscount")}
        </button>

        <div className="rate__carts">
          {PLAN_CONFIG.map(({ id, variant }) => {
            const features = getTranslationArray(t, `rate.plans.${id}.features`);

            return (
              <div key={id} className="col-4">
                <div
                  className={variant === "hit" ? "rate__cart1" : "rate__cart"}
                >
                  {variant === "hit" && (
                    <div className="rate__cart1__hit">
                      <p className="rate__cart1__hit-text">
                        {t("rate.hitBadge")}
                      </p>
                    </div>
                  )}
                  <h2 className="rate__cart__title">
                    {t(`rate.plans.${id}.title`)}
                  </h2>
                  <p className="rate__cart__description">
                    {t(`rate.plans.${id}.subtitle`)}
                  </p>
                  <p className="rate__cart__price">
                    <span className="rate__cart__price-num">
                      {t(`rate.plans.${id}.price`)}
                    </span>
                    <span className="rate__cart__price-month">
                      {" "}
                      {t("rate.priceUnit")}
                    </span>
                  </p>
                  <p className="rate__cart__description">
                    {t(`rate.plans.${id}.note`)}
                  </p>
                  <div className="rate__cart__features">
                    {features.map((feature) => (
                      <FeatureItem key={feature} text={feature} />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={
                      variant === "hit"
                        ? "rate__cart__button rate__cart__button1"
                        : "rate__cart__button"
                    }
                    onClick={scrollToDemo}
                  >
                    {t("rate.cta")}
                  </button>
                </div>
                <p className="rate__descriptionend">{t("rate.trialNote")}</p>
              </div>
            );
          })}
        </div>
        <LandingImg className="rate__blur" src={blur} alt="" aria-hidden="true" />
      </div>
    </section>
  );
};

export default Rate;
