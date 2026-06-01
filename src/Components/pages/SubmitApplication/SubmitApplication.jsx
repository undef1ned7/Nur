import React from "react";
import { useNavigate } from "react-router-dom";
import { useSubmitApplicationForm } from "./useSubmitApplicationForm";
import "./application.scss";

const SubmitApplication = () => {
  const navigate = useNavigate();

  const { form, onChange, onFormSubmit, sending, error, ok } =
    useSubmitApplicationForm({
      onSuccess: () => navigate("/"),
    });

  return (
    <div className="application">
      {/* СЛЕВА: слоган */}
      <section className="application__left" aria-hidden="true">
        <h1 className="application__slogan">Один запрос — и мы на связи</h1>
        <p className="application__subtitle">
          Оставьте контакты и кратко опишите задачу — мы вернёмся с решением.
        </p>
      </section>

      {/* СПРАВА: форма */}
      <aside className="application__right">
        <div
          className="application__container"
          role="dialog"
          aria-labelledby="appTitle"
        >
          <h2 id="appTitle" className="application__title">
            Оставить заявку в NurCRM
          </h2>

          {ok && (
            <div
              className="application__message application__message--success"
              role="status"
            >
              Заявка успешно отправлена
            </div>
          )}

          {!!error && (
            <div
              className="application__message application__message--error"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            className="application__form"
            onSubmit={onFormSubmit}
            noValidate
          >
            <div className="application__field">
              <label className="application__label" htmlFor="full_name">
                ФИО
              </label>
              <input
                className="application__input"
                type="text"
                id="full_name"
                name="full_name"
                placeholder="Введите ФИО"
                value={form.full_name}
                onChange={onChange}
                required
              />
            </div>

            <div className="application__field">
              <label className="application__label" htmlFor="phone">
                Телефон
              </label>
              <input
                className="application__input"
                type="tel"
                id="phone"
                name="phone"
                placeholder="+996 555 123 456"
                value={form.phone}
                onChange={onChange}
                inputMode="tel"
                maxLength={20}
                required
              />
            </div>

            <div className="application__field">
              <label className="application__label" htmlFor="text">
                Обращение
              </label>
              <textarea
                className="application__textarea"
                id="text"
                name="text"
                placeholder="Введите ваше обращение"
                value={form.text}
                onChange={onChange}
                rows={5}
                required
              />
            </div>

            <button
              className="application__button"
              type="submit"
              disabled={sending}
            >
              {sending ? "Отправка..." : "Оставить заявку"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};

export default SubmitApplication;
