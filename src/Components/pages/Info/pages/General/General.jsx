import React from 'react';
import './General.scss';

const General = () => {
  return (
    <div className="general">
      <div className="general__left">
        <h3 className="general__title">Общие настройки</h3>
        <div className="general__form">
          <label className="general__label">
            Адрес
            <input type="text" value="client-vxyoo" disabled className="general__input" />
          </label>
          <label className="general__label">
            Язык
            <select className="general__select">
              <option>Русский</option>
            </select>
          </label>
          <label className="general__label">
            Валюта
            <select className="general__select">
              <option>Сом</option>
            </select>
          </label>
          <label className="general__label">
            Часовой пояс
            <select className="general__select">
              <option>(CMT +03:00) Москва</option>
            </select>
          </label>
        </div>
      </div>

      <div className="general__right">
        <h3 className="general__title">Настройки меню</h3>
        <div className="general__menu">
          {[
            'Сделки', 'Контакты', 'Финансы', 'Проекты',
            'Задачи по сделкам', 'Почта', 'База знаний', 'Чаты с клиентами',
          ].map((item) => (
            <div className="general__menu-item" key={item}>
              <span>{item}</span>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider" />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default General;
