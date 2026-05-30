import "./Rate.scss";
import iconbutton from "./img/iconbutton.svg";
import check from "./img/check.svg";
import blur from './img/blur.svg';

const Rate = () => {
  return (
    <section id="tariff" className="rate">
      <div className="rate__container new-container">
        <h1 className="rate__title">
          Выберите тариф, который{" "}
          <span className="rate__title-span">подходит именно вам</span>
        </h1>
        <button className="rate__button">
          <img
            className="rate__button-icon"
            src={iconbutton}
            alt="iconbutton"
          />
          Экономьте до 20% при оплате за год
        </button>

        <div className="rate__carts">
          <div className="col-4 ">
            <div className="rate__cart">
              <h2 className="rate__cart__title">Стандарт</h2>
              <p className="rate__cart__description">
                Для старта и небольших команд
              </p>
              <p className="rate__cart__price">
                <span className="rate__cart__price-num">499c</span>
                <span className="rate__cart__price-month">/мес.</span>
              </p>
              <p className="rate__cart__description">Лучший выбор для старта</p>
              <div className="rate__cart__features">
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  CRM система
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Клиенты и контакты
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Базовая аналитика
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Поддержка
                </p>
              </div>
              <button className="rate__cart__button">
                Попробовать бесплатно
              </button>
            </div>
            <p  className="rate__descriptionend">10 дней бесплатно</p>
          </div>

          <div className="col-4 ">
            <div className="rate__cart1">
                <div className="rate__cart1__hit">
                    <p className="rate__cart1__hit-text">ХИТ</p>
                </div>
              <h2 className="rate__cart__title">Стандарт</h2>
              <p className="rate__cart__description">Для растущего бизнеса</p>
              <p className="rate__cart__price">
                <span className="rate__cart__price-num">2990с</span>
                <span className="rate__cart__price-month">/мес.</span>
              </p>
              <p className="rate__cart__description">
                Бльше возможностей для роста
              </p>
              <div className="rate__cart__features">
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Автоматизация процессов
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Все из тарифа “Старт”
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Расширенная аналитика
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  И еще что то
                </p>
              </div>
              <button className="rate__cart__button rate__cart__button1">
                Попробовать бесплатно
              </button>
            </div>
            <p  className="rate__descriptionend">10 дней бесплатно</p>
          </div>

          <div className="col-4">
            <div className=" rate__cart">
              <h2 className="rate__cart__title">Стандарт</h2>
              <p className="rate__cart__description">Для крупных компаний</p>
              <p className="rate__cart__price">
                <span className="rate__cart__price-num">9990с</span>
                <span className="rate__cart__price-month">/мес.</span>
              </p>
              <p className="rate__cart__description">
                Бльше возможностей для роста
              </p>
              <div className="rate__cart__features">
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Расширенные права доступа
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Обучение и внедрение
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Полная аналитика
                </p>
                <p className="rate__cart__features-description">
                  <img
                    className="rate__cart__features-img"
                    src={check}
                    alt="check"
                  />
                  Персональный менеджер
                </p>
              </div>
              <button className="rate__cart__button">
                Попробовать бесплатно
              </button>
            </div>
            <p className="rate__descriptionend">10 дней бесплатно</p>
          </div>
        </div>
        <img className="rate__blur" src={blur} alt="blur" />
      </div>
    </section>
  );
};
export default Rate;
