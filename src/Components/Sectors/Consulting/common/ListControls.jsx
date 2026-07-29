/**
 * Консалтинг: общие элементы управления списками — поиск, пагинация, табы со
 * счётчиками, пустые состояния. Один набор на весь сектор, чтобы экраны
 * выглядели и вели себя одинаково, а правки не приходилось повторять в каждом.
 *
 * Работают в паре с useConsultingList (см. соседний файл).
 */
import { memo, useEffect, useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaSearch, FaTimes } from "react-icons/fa";
import { PAGE_SIZE_OPTIONS } from "./useConsultingList";
import { PERIOD_PRESETS, periodRange, plural } from "./listUtils";
import "./listControls.scss";

/* ------------------------------- поиск -------------------------------- */

export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = "Поиск…",
  ariaLabel = "Поиск",
  className = "",
}) {
  return (
    <label className={`cList__search ${className}`.trim()}>
      <FaSearch className="cList__searchIcon" aria-hidden />
      <input
        className="cList__searchInput"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      {!!value && (
        <button
          type="button"
          className="cList__searchClear"
          onClick={() => onChange("")}
          aria-label="Очистить поиск"
        >
          <FaTimes aria-hidden />
        </button>
      )}
    </label>
  );
});

/* ----------------------------- пагинация ------------------------------ */

export const Pagination = memo(function Pagination({
  page,
  totalPages,
  count,
  pageSize,
  onPage,
  onPageSize,
  unitLabel = plural.records,
  loading = false,
}) {
  if (count === 0 && page === 1) return null;

  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className="cList__pager">
      <div className="cList__pagerInfo">
        {count > 0 ? (
          <>
            <b>
              {from}–{to}
            </b>{" "}
            из {count} {unitLabel(count)}
          </>
        ) : (
          <>Ничего не найдено</>
        )}
      </div>

      <div className="cList__pagerControls">
        {typeof onPageSize === "function" && (
          <select
            className="cList__pagerSize"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Записей на странице"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} на стр.
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="cList__pagerBtn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Предыдущая страница"
        >
          <FaChevronLeft aria-hidden />
        </button>
        <span className="cList__pagerPage">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="cList__pagerBtn"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages || loading}
          aria-label="Следующая страница"
        >
          <FaChevronRight aria-hidden />
        </button>
      </div>
    </div>
  );
});

/* --------------------------- табы со счётчиками ------------------------ */

/**
 * @param {Array<{value:string,label:string,count?:number,tone?:string}>} tabs
 * `count === undefined` — счётчик ещё не загружен, место под него не рисуем.
 */
export const CounterTabs = memo(function CounterTabs({
  tabs,
  value,
  onChange,
  ariaLabel = "Разделы",
  className = "",
}) {
  return (
    <div
      className={`cList__tabs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => {
        const active = String(value) === String(t.value);
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`cList__tab${active ? " is-active" : ""}${
              t.tone ? ` cList__tab--${t.tone}` : ""
            }`}
            onClick={() => onChange(t.value)}
          >
            <span className="cList__tabLabel">{t.label}</span>
            {Number.isFinite(t.count) && (
              <span
                className={`cList__tabCount${
                  t.countTone ? ` cList__tabCount--${t.countTone}` : ""
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

/* -------------------------- состояния списка --------------------------- */

export function ListState({
  loading,
  error,
  notReady,
  empty,
  notReadyTitle = "Раздел ещё подключается",
  notReadyText = "Данные появятся здесь после подключения на сервере. Остальные функции работают как обычно.",
  emptyTitle = "Пока пусто",
  emptyText = "",
  emptyAction = null,
  hasActiveFilters = false,
  onResetFilters = null,
}) {
  if (loading) return <div className="cList__state">Загрузка…</div>;
  if (error) return <div className="cList__state cList__state--error">{error}</div>;
  if (notReady) {
    return (
      <div className="cList__notice">
        <b>{notReadyTitle}</b>
        <p>{notReadyText}</p>
      </div>
    );
  }
  if (!empty) return null;

  if (hasActiveFilters) {
    return (
      <div className="cList__state">
        <strong>Ничего не найдено</strong>
        <p>Попробуйте изменить условия поиска или фильтры.</p>
        {typeof onResetFilters === "function" && (
          <button
            type="button"
            className="cList__resetBtn"
            onClick={onResetFilters}
          >
            Сбросить фильтры
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cList__state">
      <strong>{emptyTitle}</strong>
      {!!emptyText && <p>{emptyText}</p>}
      {emptyAction}
    </div>
  );
}

/**
 * Панель периода: пресеты + произвольные даты. Значения всегда уезжают в
 * params как date_from/date_to — сервер не должен угадывать пресет.
 */
export function PeriodFilter({ dateFrom, dateTo, onChange, presets = PERIOD_PRESETS }) {
  // Текущее время берём в эффекте, а не в рендере: рендер должен быть чистым,
  // иначе подсветка активного пресета «плавает» между перерисовками.
  const [nowTs, setNowTs] = useState(0);
  useEffect(() => {
    setNowTs(Date.now());
  }, []);

  const ranges = useMemo(() => {
    if (!nowTs) return {};
    return Object.fromEntries(
      presets.map((p) => [p.value, periodRange(p.value, nowTs)]),
    );
  }, [presets, nowTs]);

  return (
    <div className="cList__period">
      <div className="cList__periodPresets">
        {presets.map((p) => {
          const range = ranges[p.value];
          const active =
            !!range &&
            range.date_from === dateFrom &&
            range.date_to === dateTo;
          return (
            <button
              key={p.value}
              type="button"
              className={`cList__periodBtn${active ? " is-active" : ""}`}
              onClick={() => onChange(periodRange(p.value))}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="cList__periodDates">
        <input
          type="date"
          className="cList__input"
          value={dateFrom || ""}
          max={dateTo || undefined}
          onChange={(e) => onChange({ date_from: e.target.value, date_to: dateTo })}
          aria-label="Дата с"
        />
        <span className="cList__periodDash">—</span>
        <input
          type="date"
          className="cList__input"
          value={dateTo || ""}
          min={dateFrom || undefined}
          onChange={(e) => onChange({ date_from: dateFrom, date_to: e.target.value })}
          aria-label="Дата по"
        />
      </div>
    </div>
  );
}

/** Карточка показателя для сводок и аналитики. */
export const StatCard = memo(function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`cList__stat${tone ? ` cList__stat--${tone}` : ""}`}>
      <div className="cList__statLabel">{label}</div>
      <div className="cList__statValue">{value}</div>
      {!!hint && <div className="cList__statHint">{hint}</div>}
    </div>
  );
});
