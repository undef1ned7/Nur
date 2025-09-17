import React, { useState } from 'react';
import './Funnels.scss';

const Funnels = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="funnels-page">
      <div className="funnels-page__sidebar">
        <div className="funnels-page__title">ВОРОНКИ ПРОДАЖ</div>
        <button className="funnels-page__item funnels-page__item--active">Первая воронка</button>
        <button className="funnels-page__create" onClick={() => setShowModal(true)}>+ Создать</button>
      </div>

      <div className="funnels-page__content">
        <div className="funnels-page__stages">
          <div className="funnels-page__stage">
            <div className="funnels-page__stage-header funnels-page__stage-header--yellow">Первый этап</div>
            <div className="funnels-page__deal">1 сделка</div>
            <div className="funnels-page__amount">1 000 000 с</div>
          </div>

          <div className="funnels-page__stage">
            <div className="funnels-page__stage-header funnels-page__stage-header--orange">Второй этап</div>
            <div className="funnels-page__deal">0 сделок</div>
            <div className="funnels-page__amount">0 с</div>
          </div>

          <div className="funnels-page__stage">
            <div className="funnels-page__stage-header funnels-page__stage-header--green">Успешно реализовано</div>
            <div className="funnels-page__deal">0 сделок</div>
            <div className="funnels-page__amount">0 с</div>
          </div>

          <div className="funnels-page__stage">
            <div className="funnels-page__stage-header funnels-page__stage-header--blue">Лучшая сделка</div>
            <div className="funnels-page__author">Иван Иванов</div>
            <div className="funnels-page__time">Сегодня в 02:37</div>
            <div className="funnels-page__amount">1 000 000 с</div>
          </div>

          <div className="funnels-page__stage">
            <div className="funnels-page__stage-header funnels-page__stage-header--gray">Закрытый этап</div>
            <div className="funnels-page__deal">0 сделок</div>
            <div className="funnels-page__amount">0 с</div>
          </div>
        </div>

        {showModal && (
          <div className="funnels-page__modal">
            <div className="funnels-page__modal-backdrop" onClick={() => setShowModal(false)} />
            <div className="funnels-page__modal-content">
              <h2 className="funnels-page__modal-title">Правило: Создать задачу</h2>

              <div className="funnels-page__form">
                <select className="funnels-page__select">
                  <option>Добавить условие</option>
                </select>

                <select className="funnels-page__select">
                  <option>Выберите событие</option>
                </select>

                <select className="funnels-page__select">
                  <option>Выберите срок выполнения</option>
                </select>

                <label className="funnels-page__checkbox">
                  <input type="checkbox" /> Свой срок выполнения
                </label>

                <select className="funnels-page__select">
                  <option>Выберите пользователя</option>
                </select>

                <select className="funnels-page__select">
                  <option>Выберите задачу</option>
                </select>

                <textarea
                  className="funnels-page__textarea"
                  placeholder="Текст задачи"
                ></textarea>

                <select className="funnels-page__select">
                  <option>Не напоминать</option>
                </select>

                <label className="funnels-page__checkbox">
                  <input type="checkbox" /> Свой срок напоминания
                </label>
              </div>

              <div className="funnels-page__modal-buttons">
                <button className="funnels-page__btn funnels-page__btn--yellow">Создать</button>
                <button className="funnels-page__btn funnels-page__btn--gray" onClick={() => setShowModal(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Funnels;
