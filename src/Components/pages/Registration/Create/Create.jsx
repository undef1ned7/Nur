import React, { useState } from 'react';
import styles from './Create.module.scss';

const Create = ({ onNextStep }) => {
  const [showSuccess, setShowSuccess] = useState(false);

  if (showSuccess) {
    return (
      <div className={styles.success}>
        <div className={styles.success__content}>
          <p className={styles.success__title}>Благодарим за регистрацию в NurCRM</p>
          <span className={styles.success__check}>✔</span>
          <p className={styles.success__text}>Система успешно создана и готова к работе</p>
        </div>
        <button className={styles.success__button} onClick={onNextStep}>Начать пользоваться</button>
      </div>
    );
  }

  return (
    <div className={styles.create}>
      <h1 className={styles.create__title}>Создать аккаунт в NurCRM</h1>
      <input className={styles.create__input} type="text" placeholder="ФИО" />
      <input className={styles.create__input} type="email" placeholder="Email" />
      <input className={styles.create__input} type="tel" placeholder="Номер телефона" />
      <button className={styles.create__button} onClick={() => setShowSuccess(true)}>Создать</button>
    </div>
  );
};

export default Create;