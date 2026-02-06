// src/components/Education/Login.jsx
import  { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {  loginUserAsync } from "../../../store/creators/userCreators";
import {  logoutUser } from "../../../store/slices/userSlice";
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

  // Нормализация сообщений об ошибке
  const getErrorMessage = (err) => {
    if (!err) return "";

    // DRF: detail: "No active account found with the given credentials"
    if (typeof err.detail === "string") {
      const txt = err.detail.trim();
      const low = txt.toLowerCase();
      if (low.includes("no active account found with the given credentials")) {
        return "Неверный логин или пароль";
      }
      return txt;
    }

    // DRF: non_field_errors: [...]
    if (Array.isArray(err.non_field_errors) && err.non_field_errors.length) {
      const txt = String(err.non_field_errors[0] || "").trim();
      const low = txt.toLowerCase();
      if (low.includes("unable to log in") || low.includes("credentials")) {
        return "Неверный логин или пароль";
      }
      return txt;
    }

    // Ошибки по полям
    if (Array.isArray(err.email) && err.email.length)
      return String(err.email[0]);
    if (Array.isArray(err.password) && err.password.length)
      return String(err.password[0]);

    // Общие варианты
    if (typeof err.message === "string") return err.message;

    try {
      return JSON.stringify(err);
    } catch {
      return "Ошибка входа";
    }
  };

  const errText = getErrorMessage(error);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // ← НЕ ДАДИМ БРАУЗЕРУ ПЕРЕЗАГРУЗИТЬ СТРАНИЦУ
    try {
      await dispatch(loginUserAsync(formData)).unwrap();
     
      navigate("/crm/"); // навигация SPA, без reload
    } catch (e) {
      // Ошибка уже попадёт в Redux -> error, и покажется в errText
      // Можно логировать при необходимости:
      // console.debug("Login failed:", e);
    }
  };

  const handleLogout = () => dispatch(logoutUser());

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
              {errText}
            </div>
          )}

          {/* ВОЗВРАЩАЕМ ФОРМУ и перехватываем submit */}
          <form className="login__form" onSubmit={handleSubmit} noValidate>
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
                autoComplete="off"
                autoSave="off"
                value={formData.email}
                onChange={handleChange}
                required
                aria-invalid={!!errText}
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
                  autoComplete="off"
                  autoSave="off"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  aria-invalid={!!errText}
                />
                <button
                  type="button" // ← ВАЖНО: не submit
                  className="login__toggle"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPass ? "Скрыть" : "Показать"}
                </button>
              </div>
            </div>

            <button
              type="submit" // ← ЯВНО submit
              className="login__button"
              disabled={loading}
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};

export default Login;
