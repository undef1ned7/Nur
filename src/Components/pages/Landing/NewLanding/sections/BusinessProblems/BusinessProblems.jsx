import { useScrollToDemo } from "../../hooks/useScrollToDemo";
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
  const scrollToDemo = useScrollToDemo();

  return (
    <section id="interface" className="business pt-[100px]">
      <div className="business__container new-container">
        <div className="business__wrapper">
          <div className="col-6">
            <div className="business__tems">
              <div className="business__tems-dot"></div>
              <p className="business__tems-text">ПРОБЛЕМЫ БИЗНЕСА</p>
            </div>
            <h2 className="business__title">
              Бизнес теряет деньги из-за{" "}
              <span className="business__title-span">хаоса</span>
            </h2>
            <p className="business__description">
              Таблицы, звонки, сотрудники и продажи - когда все разных местах,
              бизнес теряет контроль.
            </p>
            <div className="business__line"></div>
            <button type="button" className="business__btn" onClick={scrollToDemo}>
              Попробовать NurCRM ⭢
            </button>
            <div className="business__banner">
              <img
                className="business__banner__img1"
                src={logobanner1}
                alt=""
              />
              <img
                className="business__banner__img2"
                src={logobanner2}
                alt=""
              />
              <img
                className="business__banner__img3"
                src={logobanner3}
                alt=""
              />
              <img
                className="business__banner__img4"
                src={logobanner4}
                alt=""
              />
              <img
                className="business__banner__img5"
                src={logobanner5}
                alt=""
              />
            </div>
          </div>

          <div className="col-6 ">
            <div className="business__carts">
              <div className="cols business__carts-col">
                <div className="business__cart">
                  <div className="business__cart__up">
                    <img className="business__cart__img" src={cart1} alt="" />
                    <p className="business__cart__num">01 </p>
                  </div>
                  <h3 className="business__cart__title">Потеря клиентов</h3>
                  <p className="business__cart__description">
                    Заявки забываются, а сделки не доходят до оплаты.
                  </p>
                </div>
                <div className="business__cart">
                  <div className="business__cart__up">
                    <img className="business__cart__img" src={cart2} alt="" />
                    <p className="business__cart__num">02 </p>
                  </div>
                  <h3 className="business__cart__title">Нет контроля</h3>
                  <p className="business__cart__description">
                    Сложно отслеживать работу сотрудников и продажи.
                  </p>
                </div>
              </div>
              <div className="cols business__carts-col">
                <div className="business__cart">
                  <div className="business__cart__up">
                    <img className="business__cart__img" src={cart3} alt="" />
                    <p className="business__cart__num">03 </p>
                  </div>
                  <h3 className="business__cart__title">Хаос в данных</h3>
                  <p className="business__cart__description">
                    Информация хранится в чатах, Excel и разных сервисах.
                  </p>
                </div>
                <div className="business__cart">
                  <div className="business__cart__up">
                    <img className="business__cart__img" src={cart4} alt="" />
                    <p className="business__cart__num">04 </p>
                  </div>
                  <h3 className="business__cart__title">Нет аналитики</h3>
                  <p className="business__cart__description">
                    Непонятно, что приносит прибыль, а что тянет бизнес вниз.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default BusinessProblems;
