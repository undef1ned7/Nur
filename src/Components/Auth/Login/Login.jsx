// src/components/Education/Login.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {  loginUserAsync, getCompany } from "../../../store/creators/userCreators";
import {  logoutUser } from "../../../store/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { tryRedirectToBuildingApp } from "../../../utils/crossAppAuth";
import { getCompanySubscriptionStatus } from "../../../utils/companySubscription";
import { captureBuildingAppUrlFromSearch } from "../../../utils/appUrls";
import { clearTokens } from "../../../utils/authUtils";
import { useAlert } from "../../../hooks/useDialog";
import "./Login.scss";

// Блокировка входа после подряд неудачных попыток
const LOCK_STORAGE_KEY = "nurcrm_login_lock";
const MAX_LOGIN_ATTEMPTS = 3;
// Длительность блокировки в минутах: растёт с каждой новой блокировкой
const LOCK_DURATIONS_MIN = [1, 3, 5, 10, 30];

const readLockState = () => {
  const fallback = { attempts: 0, lockUntil: 0, lockLevel: 0 };
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object"
      ? { ...fallback, ...parsed }
      : fallback;
  } catch {
    return fallback;
  }
};

const writeLockState = (state) => {
  try {
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

const clearLockState = () => {
  try {
    localStorage.removeItem(LOCK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

const formatLockTime = (ms) => {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const { loading, error, currentUser, isAuthenticated } = useSelector(
    (state) => state.user
  );

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [lockState, setLockState] = useState(readLockState);
  const [now, setNow] = useState(() => Date.now());
  const [localError, setLocalError] = useState("");

  const lockRemainingMs = Math.max(0, (lockState.lockUntil || 0) - now);
  const isLocked = lockRemainingMs > 0;

  // Тикаем каждую секунду, пока идёт блокировка, чтобы обновлять обратный отсчёт
  useEffect(() => {
    if (!isLocked) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  const registerFailedAttempt = () => {
    setLockState((prev) => {
      const attempts = (prev.attempts || 0) + 1;
      let next;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const level = Math.min(
          prev.lockLevel || 0,
          LOCK_DURATIONS_MIN.length - 1
        );
        next = {
          attempts: 0,
          lockLevel: (prev.lockLevel || 0) + 1,
          lockUntil: Date.now() + LOCK_DURATIONS_MIN[level] * 60 * 1000,
        };
      } else {
        next = { ...prev, attempts };
      }
      writeLockState(next);
      return next;
    });
    setNow(Date.now());
  };

  const resetLockState = () => {
    clearLockState();
    setLockState({ attempts: 0, lockUntil: 0, lockLevel: 0 });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") === "1") {
      dispatch(logoutUser());
      clearTokens();
      localStorage.removeItem("userId");
      localStorage.removeItem("userData");
      params.delete("logout");
      const search = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (search ? `?${search}` : "") + window.location.hash,
      );
    }
    captureBuildingAppUrlFromSearch();
  }, [dispatch]);

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

  const errText = localError || getErrorMessage(error);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (localError) setLocalError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setLocalError("");

    try {
      await dispatch(loginUserAsync(formData)).unwrap();
    } catch {
      registerFailedAttempt();
      return;
    }

    resetLockState();

    try {
      const company = await dispatch(getCompany()).unwrap();
      const subscription = getCompanySubscriptionStatus(company);

      if (!subscription.ok && subscription.message) {
        setLocalError(subscription.message);
        alert(subscription.message, true);
        navigate("/", { replace: true });
        return;
      }

      if (tryRedirectToBuildingApp(company) === "redirected") {
        return;
      }

      navigate("/crm/");
    } catch {
      // Авторизация уже прошла; компанию подтянет AuthGuard
      navigate("/crm/");
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

          {isLocked ? (
            <div className="login__message login__message--error" role="alert">
              Слишком много неудачных попыток входа. Повторите через{" "}
              <strong>{formatLockTime(lockRemainingMs)}</strong>
            </div>
          ) : (
            !!errText && (
              <div
                className="login__message login__message--error"
                role="alert"
              >
                {localError
                  ? localError
                  : (
                    <>
                      Неправильный логин или пароль
                      {lockState.attempts > 0 && (
                        <>
                          {" "}
                          (осталось попыток:{" "}
                          {Math.max(0, MAX_LOGIN_ATTEMPTS - lockState.attempts)})
                        </>
                      )}
                    </>
                  )}
              </div>
            )
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
              disabled={loading || isLocked}
            >
              {isLocked
                ? `Заблокировано (${formatLockTime(lockRemainingMs)})`
                : loading
                  ? "Вход..."
                  : "Войти"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};

export default Login;
