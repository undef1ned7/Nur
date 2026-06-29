import React, { useMemo } from "react";
import { CalendarDays, TrendingUp, Wallet, ArrowDownUp } from "lucide-react";
import "./CounterpartyBalanceBar.scss";

const MODES = [
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
  { key: "custom", label: "Период" },
];

const fmt = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Карточка показателя с разбивкой Дебет / Кредит. */
const MetricCard = ({ icon: Icon, title, debit, credit, accent }) => (
  <div className={`cp-balance__card ${accent ? `cp-balance__card--${accent}` : ""}`}>
    <div className="cp-balance__card-head">
      <Icon size={16} aria-hidden />
      <span>{title}</span>
    </div>
    <div className="cp-balance__card-rows">
      <div className="cp-balance__metric cp-balance__metric--debit">
        <span className="cp-balance__metric-label">Дебет</span>
        <span className="cp-balance__metric-value">{fmt(debit)}</span>
      </div>
      <div className="cp-balance__metric cp-balance__metric--credit">
        <span className="cp-balance__metric-label">Кредит</span>
        <span className="cp-balance__metric-value">{fmt(credit)}</span>
      </div>
    </div>
  </div>
);

/**
 * Панель фильтрации по периоду (месяц / год / кастом) + показатели:
 * Сальдо на начало, Оборот за период, Сальдо на конец.
 */
const CounterpartyBalanceBar = ({
  mode,
  onModeChange,
  monthValue,
  onMonthChange,
  yearValue,
  onYearChange,
  customRange,
  onCustomChange,
  period,
  summary,
  loading,
}) => {
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const list = [];
    for (let y = now + 1; y >= now - 6; y -= 1) list.push(y);
    return list;
  }, []);

  const opening = summary?.opening || { debit: 0, credit: 0 };
  const turnover = summary?.turnover || { debit: 0, credit: 0 };
  const closing = summary?.closing || { debit: 0, credit: 0 };

  return (
    <section className="cp-balance" aria-label="Период и показатели">
      <div className="cp-balance__filter">
        <div className="cp-balance__modes" role="tablist" aria-label="Тип периода">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              className={`cp-balance__mode ${
                mode === m.key ? "cp-balance__mode--active" : ""
              }`}
              onClick={() => onModeChange(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="cp-balance__inputs">
          <CalendarDays size={16} className="cp-balance__inputs-icon" aria-hidden />
          {mode === "month" && (
            <input
              type="month"
              className="cp-balance__input"
              value={monthValue}
              onChange={(e) => onMonthChange(e.target.value)}
              aria-label="Месяц"
            />
          )}
          {mode === "year" && (
            <select
              className="cp-balance__input"
              value={yearValue}
              onChange={(e) => onYearChange(e.target.value)}
              aria-label="Год"
            >
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {mode === "custom" && (
            <div className="cp-balance__range">
              <input
                type="date"
                className="cp-balance__input"
                value={customRange.from}
                max={customRange.to || undefined}
                onChange={(e) =>
                  onCustomChange({ ...customRange, from: e.target.value })
                }
                aria-label="Дата с"
              />
              <span className="cp-balance__dash">—</span>
              <input
                type="date"
                className="cp-balance__input"
                value={customRange.to}
                min={customRange.from || undefined}
                onChange={(e) =>
                  onCustomChange({ ...customRange, to: e.target.value })
                }
                aria-label="Дата по"
              />
            </div>
          )}
          {period?.from && period?.to && (
            <span className="cp-balance__period-label">
              {period.from} — {period.to}
            </span>
          )}
        </div>
      </div>

      <div className={`cp-balance__cards ${loading ? "cp-balance__cards--loading" : ""}`}>
        <MetricCard
          icon={Wallet}
          title="Сальдо на начало периода"
          debit={opening.debit}
          credit={opening.credit}
          accent="opening"
        />
        <MetricCard
          icon={ArrowDownUp}
          title="Оборот за период"
          debit={turnover.debit}
          credit={turnover.credit}
          accent="turnover"
        />
        <MetricCard
          icon={TrendingUp}
          title="Сальдо на конец периода"
          debit={closing.debit}
          credit={closing.credit}
          accent="closing"
        />
        {loading && <div className="cp-balance__cards-overlay">Загрузка…</div>}
      </div>
    </section>
  );
};

export default CounterpartyBalanceBar;
