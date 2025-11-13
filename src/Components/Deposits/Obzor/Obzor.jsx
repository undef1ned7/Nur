import React from "react";
import { Link } from "react-router-dom";
import './Obzor.scss';

const orders = [
  { id: 23, status: "Ожидает передачи в службу...", date: "15.11.2025 в 10:00", amount: "15 000 с", statusType: "gray" },
  { id: 2345, status: "Готов к выдаче", date: "14.11.2025 в 14:05", amount: "2 340 с", statusType: "green" },
  { id: 567, status: "Идёт комплектация", date: "14.11.2025 в 16:45", amount: "5 678 с", statusType: "gray" },
  { id: 5890, status: "Готов к выдаче", date: "13.11.2025 в 13:45", amount: "5 690 с", statusType: "green" },
  { id: 23, status: "Передан в доставку", date: "13.11.2025 в 15:50", amount: "320 с", statusType: "gray" },
];

const reviews = [
  { author: "Вера", rating: 5, text: "Самый лучший магазин на моей горочке! Совету всем прочитать...", date: "3 дня назад" },
  { author: "Николай", rating: 1, text: "Мне не понравился магазин! обслуживание ужасное - не советую", date: "5 дней назад" },
  { author: "Анна", rating: 2, text: "Долго ждала нужный заказ, заказ не упаковали и делали всё на...", date: "5 дней назад" },
];

const Obzor = () => {
  return (
    <div className="obzor">

      <div className="obzor__panel obzor__panel--pokazatel">
        <div className="obzor__header">
          <div className="obzor__title-group">
            <h2 className="obzor__title">Показатели за неделю</h2>
            <div className="obzor__tab-panel">
              <span className="obzor__tab obzor__tab--active">месяц</span>
              <span className="obzor__tab">год</span>
            </div>
          </div>
          <button className="obzor__action obzor__action--more">Подробнее</button>
        </div>


        <div className="obzor__content obzor__content--metrics">
          <div className="obzor__metric">
            <div className="obzor__label">Продажи</div>
            <div className="obzor__value">50 500 с</div>
          </div>
          <div className="obzor__metric">
            <div className="obzor__label">Возвраты</div>
            <div className="obzor__value">1 200 с</div>
          </div>
          <div className="obzor__metric">
            <div className="obzor__label">Комиссия</div>
            <div className="obzor__value">1 515 с</div>
          </div>
          <div className="obzor__metric">
            <div className="obzor__label">Доход магазина</div>
            <div className="obzor__value">47 785 с</div>
          </div>
          <div className="obzor__metric">
            <div className="obzor__label">Средний чек</div>
            <div className="obzor__value">3 400с</div>
          </div>
          <div className="obzor__metric">
            <div className="obzor__label">Конверсия</div>
            <div className="obzor__value">96 %</div>
          </div>
        </div>
      </div>

      <div className="obzor__dow">


        
      <div className="obzor__cards">


        <div className="obzor__panel obzor__panel--storefront">
          <div className="obzor__header obzor__header--storefront">
            <h3 className="obzor__title obzor__title--storefront">Витрина</h3>
            <Link to='/crm/vitrina' className="obzor__action obzor__action--go">Перейти</Link>
          </div>

          <div className="obzor__body obzor__body--storefront">
            <div className="obzor__item obzor__item--storefront">
              <div className="obzor__icon obzor__icon--doc">📄</div>
              <div className="obzor__info">
                <div className="obzor__label obzor__label--storefront">Прайс актуален до</div>
                <div className="obzor__value obzor__value--storefront obzor__value--green">
                  10.11.2025, 10:00
                </div>
              </div>
            </div>

            <div className="obzor__item obzor__item--storefront">
              <div className="obzor__icon obzor__icon--box">📦</div>
              <div className="obzor__info">
                <div className="obzor__label obzor__label--storefront">В наличии</div>
                <div className="obzor__value obzor__value--storefront">Нет товаров</div>
              </div>
            </div>
          </div>

          <button className="obzor__button obzor__button--update">Обновить прайс</button>
        </div>

        <div className="obzor__card obzor__card--shipments">
          <div className="obzor__header">
            <div className="obzor__title">
              Отгрузки <span className="obzor__badge">3</span>
            </div>
            <button className="obzor__action obzor__action--all-shipments">Все отгрузки</button>
          </div>
          <div className="obzor__table obzor__table--shipments">
            <div className="obzor__row obzor__row--head">
              <div>№</div>
              <div>Дата отгрузки</div>
              <div>Служба</div>
            </div>
            {[{ id: 16, date: "13.11.2025" }, { id: 67, date: "16.11.2025" }, { id: 13, date: "16.11.2025" }].map((item) => (
              <div key={item.id} className="obzor__row">
                <div className="obzor__cell obzor__cell--bold">{item.id}</div>
                <div className="obzor__cell">{item.date}</div>
                <div className="obzor__cell"><img alt="служба" className="obzor__logo" /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="obzor__card obzor__card--goals">
          <div className="obzor__header">
            <div className="obzor__title">Цели</div>
            <button className="obzor__action obzor__action--details">Подробнее</button>
          </div>
          <div className="obzor__list obzor__list--goals">
            <div className="obzor__item obzor__item--goal">
              <div className="obzor__circle obzor__circle--orange">25%</div>
              <div>
                <div className="obzor__label obzor__label--goal">Доход за неделю</div>
                <div className="obzor__value obzor__value--goal">+47 785 c</div>
              </div>
            </div>
            <div className="obzor__item obzor__item--goal">
              <div className="obzor__circle obzor__circle--blue">75%</div>
              <div>
                <div className="obzor__label obzor__label--goal">Доход за месяц</div>
                <div className="obzor__value obzor__value--goal">+328 900c</div>
              </div>
            </div>
          </div>
        </div>


      </div>


      <div className="obzor__bottom">

                <div className="obzor__panel obzor__panel--orders">
          <div className="obzor__header obzor__header--orders">
            <h3 className="obzor__title obzor__title--orders">
              Активные заказы <span className="obzor__count">{orders.length}</span>
            </h3>
            <button className="obzor__action obzor__action--all-orders">Все заказы</button>
          </div>

          <div className="obzor__table obzor__table--orders">
            <div className="obzor__row obzor__row--head">
              <div>№</div>
              <div>Статус</div>
              <div>Оформлен</div>
              <div>Сумма</div>
              <div></div>
            </div>
            {orders.map((order, index) => (
              <div className="obzor__row" key={index}>
                <div className="obzor__cell obzor__cell--id">
                  <b>{order.id}</b>
                </div>
                <div className={`obzor__status obzor__status--${order.statusType}`}>
                  {order.status}
                </div>
                <div className="obzor__cell obzor__cell--date">{order.date}</div>
                <div className="obzor__cell obzor__cell--amount">{order.amount}</div>
                <div className="obzor__cell obzor__cell--menu">⋮</div>
              </div>
            ))}
          </div>
        </div>

        <div className="obzor__panel obzor__panel--reviews">
          <div className="obzor__header obzor__header--reviews">
            <h3 className="obzor__title obzor__title--reviews">
              Новые отзывы <span className="obzor__count">{reviews.length}</span>
            </h3>
            <button className="obzor__action obzor__action--all-reviews">Все отзывы</button>
          </div>
          

          <div className="obzor__list obzor__list--reviews">
            {reviews.map((review, index) => (
              <div key={index} className="obzor__item obzor__item--review">
                <div className="obzor__avatar">{review.author[0]}</div>
                <div className="obzor__content obzor__content--review">
                  <div className="obzor__review-header">
                    <div className="obzor__review-author">{review.author}</div>
                  </div>
                  <div className="obzor__review-text">{review.text}</div>
                                      <div className="obzor__rating">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </div>
                  <div className="obzor__review-date">{review.date}</div>
                  
                </div>
                
                <div className="obzor__menu">⋮</div>
              </div>
            ))}
          </div>
        </div>


        
      </div>

    </div>


    </div>
  );
};

export default Obzor;