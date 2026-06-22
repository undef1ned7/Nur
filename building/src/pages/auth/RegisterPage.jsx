import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  registerUserAsync,
  getIndustriesAsync,
  getSubscriptionPlansAsync,
} from "@/store/creators/userCreators";
import { mapSectorNameToSlug } from "@/utils/sectorMapping";
import RegisterLayout from "./RegisterLayout";
import "./Register.scss";

const COMPANY_REGIONS = [
  { value: "bishkek", label: "Бишкек" },
  { value: "osh_city", label: "город Ош" },
  { value: "chuy", label: "Чуйская область" },
  { value: "osh", label: "Ошская область" },
  { value: "jalal_abad", label: "Джалал-Абадская область" },
  { value: "issyk_kul", label: "Иссык-Кульская область" },
  { value: "naryn", label: "Нарынская область" },
  { value: "talas", label: "Таласская область" },
  { value: "batken", label: "Баткенская область" },
];

function getRegisterErrorMessage(error) {
  if (!error) return "";

  if (typeof error === "string") return error;
  if (typeof error.detail === "string") return error.detail;

  if (Array.isArray(error.detail)) {
    return error.detail.map(String).join(", ");
  }

  if (typeof error.detail === "object" && error.detail) {
    return Object.entries(error.detail)
      .map(([field, messages]) => {
        const text = Array.isArray(messages)
          ? messages.join(", ")
          : String(messages);
        return `${field}: ${text}`;
      })
      .join("; ");
  }

  if (Array.isArray(error.non_field_errors) && error.non_field_errors.length) {
    return String(error.non_field_errors[0]);
  }

  try {
    return JSON.stringify(error.detail || error);
  } catch {
    return "Ошибка регистрации";
  }
}

function getBuildingIndustries(industries) {
  return (industries || [])
    .map((industry) => ({
      ...industry,
      sectors: (industry.sectors || []).filter(
        (sector) => mapSectorNameToSlug(sector.name) === "building",
      ),
    }))
    .filter((industry) => industry.sectors.length > 0);
}

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  hint,
  hintType,
  minLength = 8,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="register__field">
      <label className="register__label" htmlFor={id}>
        {label}
      </label>
      <div className="register__password">
        <input
          className="register__input register__input--password"
          type={visible ? "text" : "password"}
          id={id}
          name={id}
          placeholder={label}
          value={value}
          onChange={onChange}
          required
          minLength={minLength}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="register__toggle"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        >
          {visible ? "Скрыть" : "Показать"}
        </button>
      </div>
      {hint ? (
        <p
          className={`register__field-hint${
            hintType ? ` register__field-hint--${hintType}` : ""
          }`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    loading,
    error,
    currentUser,
    isAuthenticated,
    industries,
    subscriptionPlans,
  } = useSelector((state) => state.user);

  const [formError, setFormError] = useState("");
  const [selectedIndustryId, setSelectedIndustryId] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    password2: "",
    first_name: "",
    last_name: "",
    avatar: "",
    company_sector_id: "",
    subscription_plan_id: "",
    company_name: "",
    company_region: "",
  });

  const buildingIndustries = useMemo(
    () => getBuildingIndustries(industries),
    [industries],
  );

  const selectedIndustry = useMemo(
    () =>
      buildingIndustries.find(
        (industry) => String(industry.id) === selectedIndustryId,
      ),
    [buildingIndustries, selectedIndustryId],
  );

  const availableSectors = selectedIndustry?.sectors || [];

  useEffect(() => {
    dispatch(getIndustriesAsync());
    dispatch(getSubscriptionPlansAsync());
  }, [dispatch]);

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (formError) setFormError("");
  };

  const handleIndustryChange = (e) => {
    const industryId = e.target.value;
    setSelectedIndustryId(industryId);

    const selected = buildingIndustries.find(
      (industry) => String(industry.id) === industryId,
    );
    const firstSectorId = selected?.sectors?.[0]?.id || "";

    setFormData((prev) => ({
      ...prev,
      company_sector_id: firstSectorId,
    }));
  };

  const passwordsMatch =
    !formData.password2 || formData.password === formData.password2;

  const passwordHint = formData.password2
    ? passwordsMatch
      ? "Пароли совпадают"
      : "Пароли не совпадают"
    : "Минимум 8 символов";

  const passwordHintType = formData.password2
    ? passwordsMatch
      ? "ok"
      : "error"
    : undefined;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.company_sector_id) {
      setFormError("Выберите направление строительной деятельности");
      return;
    }

    if (!formData.subscription_plan_id) {
      setFormError("Выберите тарифный план");
      return;
    }

    if (formData.password !== formData.password2) {
      setFormError("Пароли не совпадают");
      return;
    }

    dispatch(
      registerUserAsync({
        formData: {
          ...formData,
          company_region: formData.company_region || null,
        },
        navigate,
      }),
    );
  };

  const apiError = getRegisterErrorMessage(error);

  return (
    <RegisterLayout
      title="Регистрация в Nur Строй"
      subtitle="Создайте аккаунт для строительной компании, ремонта или архитектуры"
      footer={
        <div className="register__footer">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="register__link">
            Войдите
          </Link>
        </div>
      }
    >
      {isAuthenticated && currentUser ? (
        <p
          className="register__message register__message--success"
          role="status"
        >
          Аккаунт успешно создан.{" "}
          <Link to="/login" className="register__link">
            Войдите
          </Link>
          , чтобы продолжить.
        </p>
      ) : null}

      {(formError || apiError) && (
        <p className="register__message register__message--error" role="alert">
          {formError || apiError}
        </p>
      )}

      <form className="register__form" onSubmit={handleSubmit} noValidate>
        <section className="register__section">
          <h3 className="register__section-title">Личные данные</h3>

          <div className="register__field">
            <label className="register__label" htmlFor="email">
              Email
            </label>
            <input
              className="register__input"
              type="email"
              id="email"
              name="email"
              placeholder="name@company.kg"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="register__row">
            <div className="register__field">
              <label className="register__label" htmlFor="first_name">
                Имя
              </label>
              <input
                className="register__input"
                type="text"
                id="first_name"
                name="first_name"
                placeholder="Имя"
                value={formData.first_name}
                onChange={handleChange}
                required
                autoComplete="given-name"
              />
            </div>

            <div className="register__field">
              <label className="register__label" htmlFor="last_name">
                Фамилия
              </label>
              <input
                className="register__input"
                type="text"
                id="last_name"
                name="last_name"
                placeholder="Фамилия"
                value={formData.last_name}
                onChange={handleChange}
                required
                autoComplete="family-name"
              />
            </div>
          </div>
        </section>

        <section className="register__section">
          <h3 className="register__section-title">Компания</h3>

          <div className="register__row">
            <div className="register__field">
              <label className="register__label" htmlFor="company_name">
                Название компании
              </label>
              <input
                className="register__input"
                type="text"
                id="company_name"
                name="company_name"
                placeholder="ОсОО «Пример»"
                value={formData.company_name}
                onChange={handleChange}
                required
                autoComplete="organization"
              />
            </div>

            <div className="register__field">
              <label className="register__label" htmlFor="company_region">
                Регион <span className="register__optional">необязательно</span>
              </label>
              <select
                className="register__select"
                name="company_region"
                id="company_region"
                value={formData.company_region}
                onChange={handleSelectChange}
              >
                <option value="">Не выбрано</option>
                {COMPANY_REGIONS.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="industry_id">
              Отрасль
            </label>
            <select
              className="register__select"
              name="industry_id"
              id="industry_id"
              value={selectedIndustryId}
              onChange={handleIndustryChange}
              required
            >
              <option value="" disabled>
                {buildingIndustries.length
                  ? "Выберите отрасль"
                  : "Загрузка отраслей..."}
              </option>
              {buildingIndustries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </div>

          {availableSectors.length > 1 ? (
            <div className="register__field">
              <label className="register__label" htmlFor="company_sector_id">
                Направление
              </label>
              <select
                className="register__select"
                name="company_sector_id"
                id="company_sector_id"
                value={formData.company_sector_id}
                onChange={handleSelectChange}
                required
              >
                <option value="" disabled>
                  Выберите направление
                </option>
                {availableSectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="register__field">
            <label className="register__label" htmlFor="subscription_plan_id">
              Тарифный план
            </label>
            <select
              className="register__select"
              name="subscription_plan_id"
              id="subscription_plan_id"
              value={formData.subscription_plan_id}
              onChange={handleSelectChange}
              required
            >
              <option value="" disabled>
                Выберите тариф
              </option>
              {(subscriptionPlans || []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="register__section">
          <h3 className="register__section-title">Безопасность</h3>

          <PasswordField
            id="password"
            label="Пароль"
            value={formData.password}
            onChange={handleChange}
          />

          <PasswordField
            id="password2"
            label="Повторите пароль"
            value={formData.password2}
            onChange={handleChange}
            hint={passwordHint}
            hintType={passwordHintType}
            minLength={1}
          />
        </section>

        <div className="register__actions">
          <button className="register__button" type="submit" disabled={loading}>
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </div>
      </form>
    </RegisterLayout>
  );
}
