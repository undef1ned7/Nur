import React from 'react';
import './Company.scss';

const Company = () => {
  return (
    <div className="company">
      <h2 className="company__title">Моя компания</h2>
      <div className="company__container">
        <div className="company__avatar" />

        <div className="company__grid">
          <div className="company__field">
            <label className="company__label">Полное наименование</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>
          <div className="company__field">
            <label className="company__label">ИНН</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>

          <div className="company__field">
            <label className="company__label">Сокращенное наименование</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>
          <div className="company__field">
            <label className="company__label">КПП</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>

          <div className="company__field company__field--textarea">
            <label className="company__label">Юридический адрес</label>
            <textarea className="company__input" placeholder="Введите значение" />
          </div>
          <div className="company__field">
            <label className="company__label">ОГРН</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>

          <div className="company__field">
            <label className="company__label">ОКВЭД</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>
          <div className="company__field">
            <label className="company__label">ОКПО</label>
            <input className="company__input" type="text" placeholder="Введите значение" />
          </div>

          <div className="company__field company__field--textarea company__field--full">
            <label className="company__label">Почтовый адрес</label>
            <textarea className="company__input" placeholder="Введите значение" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Company;
