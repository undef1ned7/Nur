import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { loginUserAsync } from "@/store/creators/userCreators";
import { getProfile } from "@/store/slices/userSlice";
import "@/Layout.scss";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await dispatch(loginUserAsync({ email, password })).unwrap();
      await dispatch(getProfile()).unwrap();
      navigate("/building/projects", { replace: true });
    } catch (err) {
      setError(
        typeof err === "string" ? err : err?.detail || "Ошибка входа",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-page__card" onSubmit={handleSubmit}>
        <h1 className="login-page__title">Nur Строй</h1>
        <p className="login-page__hint">
          Войдите с учётной записью NurCRM для работы в строительном разделе.
        </p>
        {error ? <div className="login-page__error">{error}</div> : null}
        <div className="login-page__field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="login-page__field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button className="login-page__submit" type="submit" disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
        <p className="login-page__footer">
          Нет аккаунта?{" "}
          <Link to="/register" className="login-page__link">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </div>
  );
}
