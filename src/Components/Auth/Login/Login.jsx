// src/components/Education/Login.jsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUserAsync } from "../../../store/creators/userCreators";
import { logoutUser } from "../../../store/slices/userSlice";
import { useNavigate } from "react-router-dom";
import "./Login.scss";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, currentUser, isAuthenticated } = useSelector(
    (state) => state.user
  );

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUserAsync({ formData, navigate }));
  };

  const handleLogout = () => dispatch(logoutUser());

  const errText =
    typeof error === "string"
      ? error
      : error?.message ||
        error?.detail ||
        (Array.isArray(error?.non_field_errors) && error.non_field_errors[0]) ||
        (error && JSON.stringify(error));

  return (
    <div className="login">
      <section className="login__left" aria-hidden="true">
        <h1 className="login__slogan">Сила управления в ваших руках</h1>
      </section>

      <aside className="login__right">
        <div className="login__card" role="dialog" aria-labelledby="loginTitle">
          <h2 id="loginTitle" className="login__title">
            Вход в NurCRM
          </h2>

          {isAuthenticated && currentUser && (
            <div
              className="login__message login__message--success"
              role="status"
            >
              Добро пожаловать,&nbsp;
              <strong>
                {currentUser.email ||
                  (currentUser.user && currentUser.user.email) ||
                  "пользователь"}
              </strong>
              !
              <button
                type="button"
                onClick={handleLogout}
                className="login__logout-button"
                aria-label="Выйти из аккаунта"
              >
                Выйти
              </button>
            </div>
          )}

          {!!errText && (
            <div className="login__message login__message--error" role="alert">
              Ошибка входа
            </div>
          )}

          <form className="login__form" onSubmit={handleSubmit}>
            <div className="login__field">
              <label className="login__label" htmlFor="email">
                Email
              </label>
              <input
                className="login__input"
                type="email"
                id="email"
                name="email"
                placeholder="Введите email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="password">
                Пароль
              </label>
              <div className="login__password">
                <input
                  className="login__input login__input--password"
                  type={showPass ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="login__toggle"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPass ? "Скрыть" : "Показать"}
                </button>
              </div>
            </div>

            <button className="login__button" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};

export default Login;
