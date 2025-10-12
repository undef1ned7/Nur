import React, { useState } from 'react';
import styles from './Whynur.module.scss';

const Whynur = () => {
  const [step, setStep] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const renderStep = () => {
    if (step === 1) {
      return (
        <>
          <h1 className={styles.whynur__title}>Зачем вам CRM-система?</h1>
          <p className={styles.whynur__subtitle}>Можно выбрать один или несколько вариантов</p>
          <div className={styles.whynur__options}>
            {[
              'Организовать отдел продаж',
              'Управлять командой',
              'Вести клиентскую базу',
              'Автоматизировать сделки',
              'Объединить мессенджеры',
              'Общаться с командой',
              'Еще не решил',
            ].map((item, idx) => (
              <label className={styles.whynur__option} key={idx}>
                <input type="checkbox" /> {item}
              </label>
            ))}
          </div>
        </>
      );
    } else if (step === 2) {
      return (
        <>
          <h1 className={styles.whynur__title}>Какая ваша роль в бизнесе?</h1>
          <p className={styles.whynur__subtitle}>Скажите, чем занимаетесь</p>
          <div className={styles.whynur__options}>
            {[
              'я владелец компании',
              'руководитель компании',
              'отвечаю за маркетинг',
              'руководитель отделом продаж',
              'руководитель проекта',
              'я самозанятый',
              'нет моего варианта',
            ].map((item, idx) => (
              <label className={styles.whynur__option} key={idx}>
                <input type="radio" name="role" /> {item}
              </label>
            ))}
          </div>
        </>
      );
    } else if (step === 3) {
      return (
        <>
          <h1 className={styles.whynur__title}>Как работает ваш бизнес?</h1>
          <p className={styles.whynur__subtitle}>Зная детали, мы можем лучше вам помочь</p>
          <div className={styles.whynur__options}>
            <select className={styles.whynur__select}>
              <option>В какой сфере работаете?</option>
              <option>IT</option>
              <option>Услуги</option>
              <option>Торговля</option>
            </select>
            <select className={styles.whynur__select}>
              <option>Сколько человек будет работать в CRM?</option>
              <option>1</option>
              <option>2-5</option>
              <option>6-10</option>
            </select>
            <select className={styles.whynur__select}>
              <option>Есть ли отдел продаж?</option>
              <option>Да</option>
              <option>Нет</option>
            </select>
            <select className={styles.whynur__select}>
              <option>Пробовали раньше внедрять CRM?</option>
              <option>Да</option>
              <option>Нет</option>
            </select>
          </div>
        </>
      );
    }
  };

  return (
    <div className={styles.whynur}>
      {renderStep()}
      <div className={styles.whynur__navigation}>
        {step > 1 && (
          <span className={styles.whynur__navPrev} onClick={() => setStep(step - 1)}>
            ←
          </span>
        )}
        <span className={styles.whynur__navText}>{step} из 3</span>
        {step < 3 ? (
          <button className={styles.whynur__nextButton} onClick={() => setStep(step + 1)}>
            Далее
          </button>
        ) : (
          <button className={styles.whynur__nextButton} onClick={() => setIsModalOpen(true)}>
            Завершить
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.whynur__modal}>
          <div className={styles.whynur__modalContent}>
            <h1 className={styles.whynur__title}>Создать аккаунт</h1>
            <div className={styles.whynur__successContent}>
              <p className={styles.whynur__successText}>Спасибо, что выбрали нашу CRM!</p>
              <span className={styles.whynur__successCheck}>✔</span>
              <p className={styles.whynur__successText}>
                Система автоматизирует ваши сделки и процессы в компании, научит управлять клиентской базой и поможет
                продавать больше. Сейчас расскажем, что умеет система и как всё устроено в вашей CRM. А потом покажем
                пару фокусов. Просим чуть-чуть внимания и 3 минуты вашего времени.
              </p>
            </div>
            <button className={styles.whynur__nextButton} onClick={() => setIsModalOpen(false)}>
              Погнали, я готов!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Whynur;
