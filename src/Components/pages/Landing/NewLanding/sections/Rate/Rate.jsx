import LandingImg from "../../components/LandingImg";
import "./Rate.scss";
import iconbutton from "./img/iconbutton.svg";
import blur from "./img/blur.svg";

const PLANS = [
  {
    id: "start",
    title: "Стандарт",
    subtitle: "Для старта и небольших команд",
    price: "499c",
    note: "Лучший выбор для старта",
    features: [
      "CRM система",
      "Клиенты и контакты",
      "Базовая аналитика",
      "Поддержка",
    ],
    variant: "default",
  },
  {
    id: "growth",
    title: "Стандарт",
    subtitle: "Для растущего бизнеса",
    price: "2990с",
    note: "Бльше возможностей для роста",
    features: [
      "Автоматизация процессов",
      "Все из тарифа “Старт”",
      "Расширенная аналитика",
      "И еще что то",
    ],
    variant: "hit",
  },
  {
    id: "enterprise",
    title: "Стандарт",
    subtitle: "Для крупных компаний",
    price: "9990с",
    note: "Бльше возможностей для роста",
    features: [
      "Расширенные права доступа",
      "Обучение и внедрение",
      "Полная аналитика",
      "Персональный менеджер",
    ],
    variant: "default",
  },
];

const FeatureItem = ({ text }) => (
  <p className="rate__cart__features-description">
    <span className="rate__cart__features-check" aria-hidden="true" />
    {text}
  </p>
);

const Rate = () => {
  return (
    <section id="tariff" className="rate">
      <div className="rate__container new-container">
        <h1 className="rate__title">
          Выберите тариф, который{" "}
          <span className="rate__title-span">подходит именно вам</span>
        </h1>
        <button type="button" className="rate__button">
          <LandingImg
            className="rate__button-icon"
            src={iconbutton}
            alt=""
            aria-hidden="true"
          />
          Экономьте до 20% при оплате за год
        </button>

        <div className="rate__carts">
          {PLANS.map((plan) => (
            <div key={plan.id} className="col-4">
              <div
                className={
                  plan.variant === "hit" ? "rate__cart1" : "rate__cart"
                }
              >
                {plan.variant === "hit" && (
                  <div className="rate__cart1__hit">
                    <p className="rate__cart1__hit-text">ХИТ</p>
                  </div>
                )}
                <h2 className="rate__cart__title">{plan.title}</h2>
                <p className="rate__cart__description">{plan.subtitle}</p>
                <p className="rate__cart__price">
                  <span className="rate__cart__price-num">{plan.price}</span>
                  <span className="rate__cart__price-month">/мес.</span>
                </p>
                <p className="rate__cart__description">{plan.note}</p>
                <div className="rate__cart__features">
                  {plan.features.map((feature) => (
                    <FeatureItem key={feature} text={feature} />
                  ))}
                </div>
                <button
                  type="button"
                  className={
                    plan.variant === "hit"
                      ? "rate__cart__button rate__cart__button1"
                      : "rate__cart__button"
                  }
                >
                  Попробовать бесплатно
                </button>
              </div>
              <p className="rate__descriptionend">10 дней бесплатно</p>
            </div>
          ))}
        </div>
        <LandingImg className="rate__blur" src={blur} alt="" aria-hidden="true" />
      </div>
    </section>
  );
};

export default Rate;
