import React, { useMemo } from "react";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value) => {
  const d = parseDate(value);
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()} г.`;
};

const formatMoney = (value) =>
  Number(value).toLocaleString("ru-RU").replace(/\u00a0/g, " ");

const daysLeft = (endDate) => {
  const end = parseDate(endDate);
  if (!end) return null;
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
};

const pluralDays = (n) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дн.";
};

const firstDefined = (...values) =>
  values.find((v) => v !== undefined && v !== null && v !== "");

const limitText = (used, limit) => {
  const usedText = used === undefined || used === null ? "—" : used;
  const limitValue = limit === undefined || limit === null ? "без ограничений" : limit;
  return `${usedText} · ${limitValue}`;
};

const STATUS_LABELS = {
  active: "Активна",
  trial: "Пробный период",
  expired: "Срок истёк",
};

const PERIOD_LABELS = {
  month: "в месяц",
  year: "в год",
  quarter: "в квартал",
};

const TariffBillingSettings = ({ company }) => {
  const subscription = company?.subscription || {};
  const plan = subscription.plan || company?.subscription_plan || {};
  const companyLimits = company?.limits || {};

  const endDate = firstDefined(
    subscription.end_date,
    company?.subscription_end_date,
    company?.end_date,
  );
  const left = useMemo(
    () => firstDefined(subscription.days_left, daysLeft(endDate)) ?? null,
    [subscription.days_left, endDate],
  );
  const isActive = subscription.status
    ? subscription.status === "active" || subscription.status === "trial"
    : left !== null && left >= 0;

  const price = plan.price;
  const startDate = firstDefined(
    subscription.started_at,
    company?.start_date,
  );
  const nextPayment = firstDefined(subscription.next_payment_at, endDate);

  const limits = [
    { label: "Сотрудники", ...companyLimits.employees },
    { label: "Склады", ...companyLimits.warehouses },
    { label: "Товары", ...companyLimits.products },
  ];

  return (
    <div className="settings__tab-content">
      <div className="settings__section">
        <h2 className="settings__section-title">
          <span className="settings__emoji">💳</span> Тариф и оплата
        </h2>
        <p className="settings__mutedText">
          Информация о вашем аккаунте и подписке.
        </p>

        <div className="settings__billing-cards">
          <div className="settings__billing-card">
            <div className="settings__billing-label">Аккаунт открыт</div>
            <div className="settings__billing-value">
              {formatDate(firstDefined(company?.created_at, company?.date_joined))}
            </div>
          </div>

          <div className="settings__billing-card">
            <div className="settings__billing-label">Тариф</div>
            <div className="settings__billing-value">{plan.name || "—"}</div>
            {price !== undefined && price !== null && (
              <div className="settings__billing-hint">
                {formatMoney(price)} {plan.currency || "KGS"} /{" "}
                {PERIOD_LABELS[plan.period] || "в месяц"}
              </div>
            )}
          </div>

          <div className="settings__billing-card">
            <div className="settings__billing-label">Оплачено до</div>
            <div className="settings__billing-value">
              {formatDate(endDate)}
            </div>
            {left !== null && (
              <span
                className={`settings__billing-badge ${
                  isActive ? "" : "settings__billing-badge--expired"
                }`}
              >
                {isActive
                  ? `Осталось ${left} ${pluralDays(left)}`
                  : "Срок истёк"}
              </span>
            )}
          </div>
        </div>

        <div className="settings__billing-table">
          <div className="settings__billing-row">
            <span>Статус</span>
            <strong>{STATUS_LABELS[subscription.status] || (isActive ? "Активна" : "Не активна")}</strong>
          </div>
          <div className="settings__billing-row">
            <span>Период с</span>
            <strong>{formatDate(startDate)}</strong>
          </div>
          <div className="settings__billing-row">
            <span>Следующий платёж</span>
            <strong>{formatDate(nextPayment)}</strong>
          </div>
        </div>

        <h3 className="settings__billing-subtitle">Лимиты тарифа</h3>
        <div className="settings__billing-table">
          {limits.map(({ label, used, max }) => (
            <div className="settings__billing-row" key={label}>
              <span>{label}</span>
              <strong>{limitText(used, max)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TariffBillingSettings;
