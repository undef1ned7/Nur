import React, { useEffect, useState, useMemo } from "react";
import "./Settings.scss";
import Tabs from "../Tabs/Tabs";
import {
  getProfile,
  logoutUser,
  useUser,
} from "../../../../store/slices/userSlice";
import { useDispatch } from "react-redux";
import {
  updateUserCompanyName,
  updateUserData,
  getScalesToken,
} from "../../../../store/creators/userCreators";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { tariff, errorChange: errors, company, profile } = useUser();

  // Определяем, является ли сфера "магазин" (market)
  const isMarketSector = useMemo(() => {
    if (!company?.sector?.name) return false;
    const sectorName = company.sector.name.toLowerCase().trim();
    return (
      sectorName === "магазин" ||
      sectorName === "цветочный магазин" ||
      sectorName.includes("магазин")
    );
  }, [company?.sector?.name]);

  // Определяем, является ли пользователь владельцем
  const isOwner = useMemo(() => {
    return profile?.role === "owner";
  }, [profile?.role]);

  // Определяем начальный активный таб в зависимости от доступных табов
  const initialTab = useMemo(() => {
    if (isOwner) return "Моя компания";
    if (isMarketSector) return "Токен для весов";
    return "Безопасность";
  }, [isOwner, isMarketSector]);

  const [activeTab, setActiveTab] = useState("Безопасность");
  const [isInitialized, setIsInitialized] = useState(false);

  // Устанавливаем начальный таб при первой загрузке данных
  useEffect(() => {
    if (company && profile && !isInitialized) {
      setActiveTab(initialTab);
      setIsInitialized(true);
    }
  }, [company, profile, initialTab, isInitialized]);

  // Обновляем активный таб, если текущий стал недоступен
  useEffect(() => {
    if (!isInitialized) return;

    // Если текущий таб недоступен, переключаемся на первый доступный
    if (activeTab === "Моя компания" && !isOwner) {
      setActiveTab(isMarketSector ? "Токен для весов" : "Безопасность");
    } else if (activeTab === "Токен для весов" && !isMarketSector) {
      setActiveTab(isOwner ? "Моя компания" : "Безопасность");
    }
  }, [isMarketSector, isOwner, activeTab, isInitialized]);
  const [saving, setSaving] = useState(false);

  // --- Пароли
  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    new_password2: "",
  });

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    repeat: false,
  });

  // --- Данные компании (единый стейт)
  const [companyState, setCompanyState] = useState({
    name: company?.name || "",
    llc: company?.llc || "",
    inn: company?.inn || "",
    okpo: company?.okpo || "",
    score: company?.score || "",
    bik: company?.bik || "",
    address: company?.address || "",
  });

  // Пришёл свежий company из стора — инициализируем поля
  useEffect(() => {
    setCompanyState({
      name: company?.name || "",
      llc: company?.llc || "",
      inn: company?.inn || "",
      okpo: company?.okpo || "",
      score: company?.score || "",
      bik: company?.bik || "",
      address: company?.address || "",
    });
  }, [company]);

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyState((prev) => ({ ...prev, [name]: value }));
  };

  // Удобно посчитать валидность паролей
  const passwordsMismatch = useMemo(() => {
    return (
      formData.new_password.trim() !== "" &&
      formData.new_password2.trim() !== "" &&
      formData.new_password !== formData.new_password2
    );
  }, [formData.new_password, formData.new_password2]);

  // Сохранение данных компании
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (profile?.role !== "owner") return;

    setSaving(true);
    try {
      await dispatch(updateUserCompanyName(companyState)).unwrap();
      alert("Данные компании успешно сохранены");
    } catch (err) {
      console.error("Failed to update company:", err);
      alert("Ошибка при сохранении данных компании");
    } finally {
      setSaving(false);
    }
  };

  // Сохранение пароля
  const handleSavePassword = async (e) => {
    e.preventDefault();

    // Если пользователь ничего не вводил — просто пропускаем обновление пароля
    const anyPasswordFilled = Object.values(formData).some(
      (s) => s.trim() !== ""
    );
    if (!anyPasswordFilled) {
      alert("Заполните поля для изменения пароля");
      return;
    }

    if (passwordsMismatch) {
      alert("Пароли не совпадают");
      return;
    }

    setSaving(true);
    try {
      await dispatch(updateUserData(formData)).unwrap();
      alert("Пароль успешно изменен");
      setFormData({
        current_password: "",
        new_password: "",
        new_password2: "",
      });
    } catch (err) {
      console.error("Failed to update password:", err);
      alert("Ошибка при изменении пароля");
    } finally {
      setSaving(false);
    }
  };

  // Сброс формы компании
  const handleResetCompany = () => {
    setCompanyState({
      name: company?.name || "",
      llc: company?.llc || "",
      inn: company?.inn || "",
      okpo: company?.okpo || "",
      score: company?.score || "",
      bik: company?.bik || "",
      address: company?.address || "",
    });
  };

  // Сброс формы пароля
  const handleResetPassword = () => {
    setFormData({
      current_password: "",
      new_password: "",
      new_password2: "",
    });
  };

  // Создание токена для доступа к весам
  const handleCreateScalesToken = async () => {
    try {
      const result = await dispatch(getScalesToken()).unwrap();
      // Извлекаем токен из ответа API (поле scale_api_token)
      const token =
        result?.scale_api_token ||
        result?.token ||
        result?.access_token ||
        (typeof result === "string" ? result : null);

      if (!token) {
        alert("Токен не найден в ответе сервера");
        return;
      }

      // Показываем токен пользователю и даем возможность скопировать
      const tokenString = String(token);

      // Создаем модальное окно для отображения токена
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement("div");
      modalContent.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;

      modalContent.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Токен для доступа к весам</h3>
        <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">Скопируйте токен и сохраните его в безопасном месте:</p>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 16px; word-break: break-all; font-family: monospace; font-size: 12px;">
          ${tokenString}
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="copyTokenBtn" style="
            padding: 8px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Копировать</button>
          <button id="closeModalBtn" style="
            padding: 8px 16px;
            background: #e5e7eb;
            color: #374151;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Закрыть</button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      const copyBtn = modalContent.querySelector("#copyTokenBtn");
      const closeBtn = modalContent.querySelector("#closeModalBtn");

      copyBtn.onclick = () => {
        navigator.clipboard
          .writeText(tokenString)
          .then(() => {
            copyBtn.textContent = "Скопировано!";
            copyBtn.style.background = "#10b981";
            setTimeout(() => {
              copyBtn.textContent = "Копировать";
              copyBtn.style.background = "#2563eb";
            }, 2000);
          })
          .catch(() => {
            alert("Не удалось скопировать. Токен: " + tokenString);
          });
      };

      closeBtn.onclick = () => {
        document.body.removeChild(modal);
      };

      modal.onclick = (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      };
    } catch (err) {
      console.error("Ошибка при создании токена:", err);
      const errorMessage =
        err?.detail ||
        err?.message ||
        (typeof err === "string" ? err : "Не удалось создать токен");
      alert(`Ошибка: ${errorMessage}`);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "Моя компания":
        return (
          <form onSubmit={handleSaveCompany} className="settings__tab-form">
            {profile?.role === "owner" && (
              <div className="settings__section">
                <h2 className="settings__section-title">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 7L10 17L5 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Основная информация
                </h2>

                {/* Название компании */}
                <div className="settings__form-group">
                  <label className="settings__label" htmlFor="companyName">
                    Название компании
                  </label>
                  <div className="settings__input-wrapper">
                    <input
                      id="companyName"
                      name="name"
                      type="text"
                      className="settings__input"
                      placeholder="Введите название компании"
                      value={companyState.name}
                      onChange={handleCompanyChange}
                    />
                    <div className="settings__input-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M20 7L10 17L5 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Остальные поля компании */}
                {[
                  {
                    id: "llc",
                    label: "Название ООО",
                    placeholder: "Введите название ООО",
                  },
                  { id: "inn", label: "ИНН", placeholder: "Введите ИНН" },
                  { id: "okpo", label: "ОКПО", placeholder: "Введите ОКПО" },
                  {
                    id: "score",
                    label: "Расчетный счет",
                    placeholder: "Введите расчетный счет",
                  },
                  { id: "bik", label: "БИК", placeholder: "Введите БИК" },
                  {
                    id: "address",
                    label: "Адрес",
                    placeholder: "Введите адрес",
                  },
                ].map((field) => (
                  <div
                    key={field.id}
                    className="settings__form-group"
                    style={{ marginTop: "15px" }}
                  >
                    <label className="settings__label" htmlFor={field.id}>
                      {field.label}
                    </label>
                    <div className="settings__input-wrapper">
                      <input
                        id={field.id}
                        name={field.id}
                        type="text"
                        className="settings__input"
                        placeholder={field.placeholder}
                        value={companyState[field.id] ?? ""}
                        onChange={handleCompanyChange}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Кнопки действий для таба компании */}
            {profile?.role === "owner" && (
              <div className="settings__actions">
                <button
                  className="settings__btn settings__btn--primary"
                  type="submit"
                  disabled={saving}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 7L10 17L5 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {saving ? "Сохранение..." : "Сохранить изменения"}
                </button>

                <button
                  className="settings__btn settings__btn--secondary"
                  type="button"
                  onClick={handleResetCompany}
                  disabled={saving}
                >
                  Отменить
                </button>
              </div>
            )}
          </form>
        );
      case "Безопасность":
        return (
          <form onSubmit={handleSavePassword} className="settings__tab-form">
            <div className="settings__section">
              <h2 className="settings__section-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 15V3M12 15L8 11M12 15L16 11M2 17L2.621 19.485C2.72915 19.9177 2.97882 20.3018 3.33033 20.5763C3.68184 20.8508 4.11501 20.9999 4.561 21H19.439C19.885 20.9999 20.3182 20.8508 20.6697 20.5763C21.0212 20.3018 21.2708 19.9177 21.379 19.485L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Безопасность
              </h2>

              {/* Текущий пароль */}
              <div className="settings__form-group">
                {!formData.current_password.trim() &&
                errors?.current_password ? (
                  <label
                    style={{ color: "red" }}
                    className="settings__label"
                    htmlFor="currentPassword"
                  >
                    {errors.current_password[0]}
                  </label>
                ) : (
                  <label className="settings__label" htmlFor="currentPassword">
                    Текущий пароль
                  </label>
                )}
                <div className="settings__input-wrapper">
                  <input
                    id="currentPassword"
                    name="current_password"
                    type={showPassword.current ? "text" : "password"}
                    className="settings__input"
                    placeholder="Введите текущий пароль"
                    value={formData.current_password}
                    onChange={handlePasswordInputChange}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="settings__password-toggle"
                    onClick={() => togglePasswordVisibility("current")}
                  >
                    {showPassword.current ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 12S5 4 12 4S23 12 23 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 5C14.1493 5 16.195 5.77714 17.7781 7.16045C19.3613 8.54375 20.5 10.4816 20.5 12.5C20.5 14.5184 19.3613 16.4562 17.7781 17.8395C16.195 19.2229 14.1493 20 12 20C9.85075 20 7.80504 19.2229 6.22195 17.8395C4.63886 16.4562 3.5 14.5184 3.5 12.5C3.5 10.4816 4.63886 8.54375 6.22195 7.16045C7.80504 5.77714 9.85075 5 12 5Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M17.94 17.94A10.07 10.07 0 0 1 12 20C7 20 2 15 2 10C2 5.03 6.58 1 12 1C16.42 1 20.97 5.03 21 10C21 15 18.97 20 12 20C10.06 20 8.24 19.43 6.67 18.43"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 10.3431 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 2V5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 19V22"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Новый пароль */}
              <div className="settings__form-group">
                {!formData.new_password.trim() && errors?.new_password ? (
                  <label
                    style={{ color: "red" }}
                    className="settings__label"
                    htmlFor="newPassword"
                  >
                    {errors.new_password[0]}
                  </label>
                ) : (
                  <label className="settings__label" htmlFor="newPassword">
                    Новый пароль
                  </label>
                )}
                <div className="settings__input-wrapper">
                  <input
                    id="newPassword"
                    name="new_password"
                    type={showPassword.new ? "text" : "password"}
                    className="settings__input"
                    placeholder="Введите новый пароль"
                    value={formData.new_password}
                    onChange={handlePasswordInputChange}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="settings__password-toggle"
                    onClick={() => togglePasswordVisibility("new")}
                  >
                    {showPassword.new ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 12S5 4 12 4S23 12 23 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 5C14.1493 5 16.195 5.77714 17.7781 7.16045C19.3613 8.54375 20.5 10.4816 20.5 12.5C20.5 14.5184 19.3613 16.4562 17.7781 17.8395C16.195 19.2229 14.1493 20 12 20C9.85075 20 7.80504 19.2229 6.22195 17.8395C4.63886 16.4562 3.5 14.5184 3.5 12.5C3.5 10.4816 4.63886 8.54375 6.22195 7.16045C7.80504 5.77714 9.85075 5 12 5Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M17.94 17.94A10.07 10.07 0 0 1 12 20C7 20 2 15 2 10C2 5.03 6.58 1 12 1C16.42 1 20.97 5.03 21 10C21 15 18.97 20 12 20C10.06 20 8.24 19.43 6.67 18.43"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 10.3431 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 2V5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 19V22"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="settings__password-strength">
                  <div className="settings__strength-bar">
                    <div
                      className={`settings__strength-fill ${
                        formData.new_password.length > 8
                          ? "strong"
                          : formData.new_password.length > 5
                          ? "medium"
                          : "weak"
                      }`}
                    />
                  </div>
                  <span className="settings__strength-text">
                    {formData.new_password.length === 0
                      ? "Введите пароль"
                      : formData.new_password.length < 6
                      ? "Слабый"
                      : formData.new_password.length < 9
                      ? "Средний"
                      : "Сильный"}
                  </span>
                </div>
              </div>

              {/* Повтор пароля */}
              <div className="settings__form-group">
                {!formData.new_password2.trim() && errors?.new_password2 ? (
                  <label
                    style={{ color: "red" }}
                    className="settings__label"
                    htmlFor="repeatPassword"
                  >
                    {errors.new_password2[0]}
                  </label>
                ) : (
                  <label className="settings__label" htmlFor="repeatPassword">
                    Повторите новый пароль
                  </label>
                )}
                <div className="settings__input-wrapper">
                  <input
                    id="repeatPassword"
                    name="new_password2"
                    type={showPassword.repeat ? "text" : "password"}
                    className={`settings__input ${
                      passwordsMismatch ? "error" : ""
                    }`}
                    placeholder="Повторите новый пароль"
                    value={formData.new_password2}
                    onChange={handlePasswordInputChange}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="settings__password-toggle"
                    onClick={() => togglePasswordVisibility("repeat")}
                  >
                    {showPassword.repeat ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 12S5 4 12 4S23 12 23 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 5C14.1493 5 16.195 5.77714 17.7781 7.16045C19.3613 8.54375 20.5 10.4816 20.5 12.5C20.5 14.5184 19.3613 16.4562 17.7781 17.8395C16.195 19.2229 14.1493 20 12 20C9.85075 20 7.80504 19.2229 6.22195 17.8395C4.63886 16.4562 3.5 14.5184 3.5 12.5C3.5 10.4816 4.63886 8.54375 6.22195 7.16045C7.80504 5.77714 9.85075 5 12 5Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M17.94 17.94A10.07 10.07 0 0 1 12 20C7 20 2 15 2 10C2 5.03 6.58 1 12 1C16.42 1 20.97 5.03 21 10C21 15 18.97 20 12 20C10.06 20 8.24 19.43 6.67 18.43"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 10.3431 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 2V5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 19V22"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordsMismatch && (
                  <p className="settings__error-text">Пароли не совпадают</p>
                )}
              </div>
            </div>

            {/* Кнопки действий для таба безопасности */}
            <div className="settings__actions">
              <button
                className="settings__btn settings__btn--primary"
                type="submit"
                disabled={passwordsMismatch || saving}
                title={passwordsMismatch ? "Пароли не совпадают" : undefined}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 7L10 17L5 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>

              <button
                className="settings__btn settings__btn--secondary"
                type="button"
                onClick={handleResetPassword}
                disabled={saving}
              >
                Отменить
              </button>
            </div>
          </form>
        );
      case "Токен для весов":
        return (
          <div className="settings__tab-content">
            <div className="settings__section">
              <h2 className="settings__section-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 19.07L16.24 16.24M19.07 4.93L16.24 7.76M4.93 19.07L7.76 16.24M4.93 4.93L7.76 7.76"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Токен для доступа к весам
              </h2>

              <div className="settings__form-group">
                <p
                  className="settings__label"
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    marginBottom: "20px",
                    fontWeight: "normal",
                    lineHeight: "1.6",
                  }}
                >
                  Создайте токен для интеграции с весами. Токен будет показан
                  один раз - сохраните его в безопасном месте.
                </p>
                <button
                  type="button"
                  className="settings__btn settings__btn--primary"
                  onClick={handleCreateScalesToken}
                  style={{
                    width: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 19.07L16.24 16.24M19.07 4.93L16.24 7.76M4.93 19.07L7.76 16.24M4.93 4.93L7.76 7.76"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Создать токен
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <div className="settings__header-content">
          <h1 className="settings__main-title">Настройки</h1>
          <p className="settings__subtitle">
            Управление настройками вашей компании
          </p>
        </div>
        <div className="settings__header-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.2579 9.77251 19.9887C9.5799 19.7195 9.31074 19.5141 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.74205 9.96512 4.01126 9.77251C4.28047 9.5799 4.48593 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Табы */}
      <Tabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        company={company}
        profile={profile}
      />

      {/* Контент табов */}
      <div className="settings__content">{renderTabContent()}</div>

      <div className="settings__footer">
        <button
          className="settings__logout"
          type="button"
          onClick={() => {
            dispatch(logoutUser());
            navigate("/");
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 17L21 12L16 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 12H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Выйти из аккаунта
        </button>
      </div>

      {/* Если понадобится вернуть вкладки */}
      {/* {tariff !== "Старт" && (
        <>
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="settings__content">{renderContent()}</div>
        </>
      )} */}
    </div>
  );
};

export default Settings;
