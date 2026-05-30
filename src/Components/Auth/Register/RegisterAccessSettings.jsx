import { useState } from "react";
import { Link } from "react-router-dom";
import {
  changeAccessPassword,
  isBackendMode,
} from "../../../services/registerAccessService";
import RegisterLayout from "./RegisterLayout";
import "./Register.scss";

const RegisterAccessSettings = () => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    newPassword2: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.newPassword.length < 4) {
      setError("Новый пароль должен быть не короче 4 символов");
      return;
    }

    if (formData.newPassword !== formData.newPassword2) {
      setError("Новые пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const result = await changeAccessPassword(
        formData.currentPassword,
        formData.newPassword
      );

      if (!result.ok) {
        setError(result.error || "Не удалось сменить пароль");
        return;
      }

      setSuccess("Пароль доступа к регистрации успешно изменён");
      setFormData({
        currentPassword: "",
        newPassword: "",
        newPassword2: "",
      });
    } catch {
      setError("Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegisterLayout
      title="Пароль доступа к регистрации"
      subtitle={
        isBackendMode()
          ? "Пароль хранится на сервере."
          : "Пароль хранится локально в браузере. Для продакшена можно включить бэкенд через VITE_REGISTER_ACCESS_BACKEND=true."
      }
      footer={
        <div className="register__footer">
          <Link to="/register" className="register__link">
            К регистрации
          </Link>
        </div>
      }
    >
      <form className="register__form" onSubmit={handleSubmit}>
        {error && (
          <p className="register__message register__message--error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="register__message register__message--success" role="status">
            {success}
          </p>
        )}

        <section className="register__section">
          <div className="register__field">
            <label className="register__label" htmlFor="currentPassword">
              Текущий пароль
            </label>
            <div className="register__password">
              <input
                className="register__input register__input--password"
                type={showCurrent ? "text" : "password"}
                id="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                placeholder="Текущий пароль"
                required
                autoFocus
              />
              <button
                type="button"
                className="register__toggle"
                onClick={() => setShowCurrent((prev) => !prev)}
              >
                {showCurrent ? "Скрыть" : "Показать"}
              </button>
            </div>
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="newPassword">
              Новый пароль
            </label>
            <div className="register__password">
              <input
                className="register__input register__input--password"
                type={showNew ? "text" : "password"}
                id="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="Новый пароль"
                required
                minLength={4}
              />
              <button
                type="button"
                className="register__toggle"
                onClick={() => setShowNew((prev) => !prev)}
              >
                {showNew ? "Скрыть" : "Показать"}
              </button>
            </div>
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="newPassword2">
              Повторите новый пароль
            </label>
            <input
              className="register__input"
              type="password"
              id="newPassword2"
              value={formData.newPassword2}
              onChange={handleChange}
              placeholder="Повторите новый пароль"
              required
              minLength={4}
            />
          </div>
        </section>

        <div className="register__actions">
          <button className="register__button" type="submit" disabled={loading}>
            {loading ? "Сохранение..." : "Сменить пароль"}
          </button>
        </div>
      </form>
    </RegisterLayout>
  );
};

export default RegisterAccessSettings;
