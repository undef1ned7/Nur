import React from 'react';
import './Security.scss';

const options = [
  { label: 'Скрывать номер телефона', checked: false },
  { label: 'Разрешить работу с API только администраторам', checked: true },
  { label: 'Ограничение доступа по IP-адресу', checked: false },
  { label: 'Мониторинг активности', checked: false },
  { label: 'Мониторинг активности', checked: false },
];

const Security = () => {
  return (
    <div className="security">
      <div className="security__box">
        {options.map((item, index) => (
          <label key={index} className="security__item">
            <input
              type="checkbox"
              defaultChecked={item.checked}
              className="security__checkbox"
            />
            <span className="security__custom-checkbox" />
            <span className="security__label">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default Security;
