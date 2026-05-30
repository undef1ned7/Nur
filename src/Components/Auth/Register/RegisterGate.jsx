import { useState } from "react";
import { Link } from "react-router-dom";
import {
  isSessionUnlocked,
  unlockRegistration,
  isBackendMode,
} from "../../../services/registerAccessService";
import Register from "./Register";
import RegisterLayout from "./RegisterLayout";
import "./Register.scss";

const RegisterGate = () => {
  const [unlocked, setUnlocked] = useState(isSessionUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await unlockRegistration(password);
      if (result.ok) {
        setUnlocked(true);
        return;
      }
      setError(result.error || "Неверный пароль");
    } catch {
      setError("Не удалось проверить пароль");
    } finally {
      setLoading(false);
    }
  };

  if (unlocked) {
    return <Register />;
  }

  return (
    <RegisterLayout
      title="Доступ к регистрации"
      subtitle={
        isBackendMode()
          ? "Введите пароль доступа. Проверка выполняется на сервере."
          : "Введите пароль доступа, чтобы открыть форму регистрации."
      }
      footer={
        <div className="register__footer">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="register__link">
            Войдите
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

        <div className="register__field">
          <label className="register__label" htmlFor="register_access_password">
            Пароль доступа
          </label>
          <div className="register__password">
            <input
              className="register__input register__input--password"
              type={showPass ? "text" : "password"}
              id="register_access_password"
              name="register_access_password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            <button
              type="button"
              className="register__toggle"
              onClick={() => setShowPass((prev) => !prev)}
              aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPass ? "Скрыть" : "Показать"}
            </button>
          </div>
        </div>

        <div className="register__actions">
          <button className="register__button" type="submit" disabled={loading}>
            {loading ? "Проверка..." : "Открыть регистрацию"}
          </button>
        </div>
      </form>
    </RegisterLayout>
  );
};

export default RegisterGate;
