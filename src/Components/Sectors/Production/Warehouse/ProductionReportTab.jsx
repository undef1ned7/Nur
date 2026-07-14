import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";
import api from "../../../../api";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/**
 * Вкладка «Производство» на /crm/production/warehouse.
 * Отчёт о произведённой продукции за период с разбивкой на смены день/ночь.
 * Read-only поверх нового эндпоинта (см. docs/production/production-report.md).
 * При отсутствии API — безопасная ошибка/пустое состояние, склад не ломается.
 */

const PAGE_SIZE = 25;

// Границы смен (местное время): день 08:00–19:59, ночь 20:00–07:59
const DAY_SHIFT_START_HOUR = 8;
const DAY_SHIFT_END_HOUR = 20;

const SHIFT_OPTIONS = [
  { value: "", label: "Все смены" },
  { value: "day", label: `День (${DAY_SHIFT_START_HOUR}:00–${DAY_SHIFT_END_HOUR}:00)` },
  { value: "night", label: `Ночь (${DAY_SHIFT_END_HOUR}:00–${DAY_SHIFT_START_HOUR}:00)` },
];

const getShiftOfDate = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const hour = d.getHours();
  return hour >= DAY_SHIFT_START_HOUR && hour < DAY_SHIFT_END_HOUR
    ? "day"
    : "night";
};

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

const fmtNum = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const toYmd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const presetRange = (days) => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toYmd(from), to: toYmd(to) };
};

const parseRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const ProductionReportTab = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiMissing, setApiMissing] = useState(false);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);

  // Фильтры: по умолчанию — текущая неделя (последние 7 дней)
  const initialRange = useMemo(() => presetRange(7), []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [shift, setShift] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const params = useMemo(() => {
    const p = { limit: PAGE_SIZE, offset };
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (shift) p.shift = shift;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [dateFrom, dateTo, shift, debouncedSearch, offset]);

  useEffect(() => {
    setOffset(0);
  }, [dateFrom, dateTo, shift, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/main/production/report/", { params });
      const list = parseRows(data);
      setRows(list);
      setSummary(data?.summary || null);
      setCount(
        typeof data?.count === "number" ? data.count : list.length + offset,
      );
      setApiMissing(false);
    } catch (e) {
      if (e?.response?.status === 404) {
        setApiMissing(true);
        setError("");
      } else {
        setError(validateResErrors(e, "Не удалось загрузить отчёт производства"));
      }
      setRows([]);
      setSummary(null);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [params, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (days) => {
    const range = presetRange(days);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const resetFilters = () => {
    setDateFrom(initialRange.from);
    setDateTo(initialRange.to);
    setShift("");
    setSearch("");
  };

  // Сводка: приоритет — summary из API; фолбэк — расчёт по загруженной странице
  const totals = useMemo(() => {
    if (summary) {
      return {
        total: Number(summary.total_quantity || 0),
        day: Number(summary.day_quantity || 0),
        night: Number(summary.night_quantity || 0),
        cost: Number(summary.total_cost || 0),
        approximate: false,
      };
    }
    const acc = { total: 0, day: 0, night: 0, cost: 0, approximate: true };
    rows.forEach((row) => {
      const qty = Number(row.quantity || 0);
      acc.total += qty;
      acc.cost += Number(row.cost_total || 0);
      if (getShiftOfDate(row.produced_at || row.created_at) === "day") {
        acc.day += qty;
      } else {
        acc.night += qty;
      }
    });
    return acc;
  }, [summary, rows]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (apiMissing) {
    return (
      <div className="warehouse-page">
        <div className="warehouse-header">
          <div className="warehouse-header__left align-middle">
            <div className="warehouse-header__icon">
              <div className="warehouse-header__icon-box">🏭</div>
            </div>
            <div className="warehouse-header__title-section">
              <h1 className="warehouse-header__title">Производство</h1>
              <p className="warehouse-header__subtitle">
                Отчёт о произведённой продукции за период
              </p>
            </div>
          </div>
        </div>
        <p style={{ padding: 16, opacity: 0.75 }}>
          Отчёт станет доступен после обновления сервера (эндпоинт
          /main/production/report/ ещё не подключён).
        </p>
      </div>
    );
  }

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left align-middle">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🏭</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Производство</h1>
            <p className="warehouse-header__subtitle">
              Что и сколько произведено за период, по сменам день/ночь
            </p>
          </div>
        </div>
      </div>

      {/* Сводка за период */}
      <div className="pwt" style={{ marginBottom: 12 }}>
        <div className="pwt__card">
          <div className="pwt__body">
            <span className="pwt__label">Произведено единиц</span>
            <span className="pwt__value">{fmtNum(totals.total)}</span>
          </div>
        </div>
        <div className="pwt__card">
          <div className="pwt__body">
            <span className="pwt__label">Днём ({DAY_SHIFT_START_HOUR}:00–{DAY_SHIFT_END_HOUR}:00)</span>
            <span className="pwt__value">{fmtNum(totals.day)}</span>
          </div>
        </div>
        <div className="pwt__card">
          <div className="pwt__body">
            <span className="pwt__label">Ночью ({DAY_SHIFT_END_HOUR}:00–{DAY_SHIFT_START_HOUR}:00)</span>
            <span className="pwt__value">{fmtNum(totals.night)}</span>
          </div>
        </div>
        <div className="pwt__card">
          <div className="pwt__body">
            <span className="pwt__label">Себестоимость</span>
            <span className="pwt__value">
              {fmtMoney(totals.cost)} <i>сом</i>
            </span>
          </div>
        </div>
      </div>
      {totals.approximate && rows.length > 0 && (
        <p style={{ margin: "0 0 10px", fontSize: 12, opacity: 0.65 }}>
          Сводка рассчитана по текущей странице — точные итоги появятся после
          обновления сервера.
        </p>
      )}

      {/* Фильтры */}
      <div
        className="warehouse-search-section"
        style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <div className="warehouse-search" style={{ flex: "1 1 220px" }}>
          <Search className="warehouse-search__icon" size={18} />
          <input
            type="text"
            className="warehouse-search__input"
            placeholder="Поиск по товару…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="add-modal__cancel"
          style={{ height: 42 }}
          onClick={() => applyPreset(7)}
        >
          Неделя
        </button>
        <button
          type="button"
          className="add-modal__cancel"
          style={{ height: 42 }}
          onClick={() => applyPreset(30)}
        >
          Месяц
        </button>
        <input
          type="date"
          className="add-modal__input"
          style={{ height: 42, width: "auto" }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Дата с"
        />
        <input
          type="date"
          className="add-modal__input"
          style={{ height: 42, width: "auto" }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Дата по"
        />
        <select
          className="add-modal__input"
          style={{ height: 42, width: "auto", minWidth: 170 }}
          value={shift}
          onChange={(e) => setShift(e.target.value)}
        >
          {SHIFT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="add-modal__cancel"
          style={{ height: 42, display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={resetFilters}
        >
          <RefreshCw size={15} />
          Сбросить
        </button>
      </div>

      {/* Таблица */}
      {error ? (
        <p style={{ padding: 16, color: "#b91c1c" }}>{error}</p>
      ) : loading ? (
        <p style={{ padding: 16 }}>Загрузка…</p>
      ) : rows.length === 0 ? (
        <p style={{ padding: 16, opacity: 0.7 }}>
          За выбранный период производств не найдено
        </p>
      ) : (
        <div className="warehouse-table-wrap" style={{ overflowX: "auto" }}>
          <table className="warehouse-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Товар</th>
                <th>Кол-во</th>
                <th>Ед.</th>
                <th>Себестоимость</th>
                <th>Произвёл</th>
                <th>Смена</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const producedAt = row.produced_at || row.created_at;
                const rowShift = row.shift || getShiftOfDate(producedAt);
                return (
                  <tr key={row.id || `${row.product}-${producedAt}`}>
                    <td>{fmtDateTime(producedAt)}</td>
                    <td>{row.product_name || row.name || "—"}</td>
                    <td>{fmtNum(row.quantity)}</td>
                    <td>{row.unit || "шт."}</td>
                    <td>
                      {row.cost_total != null
                        ? `${fmtMoney(row.cost_total)} сом`
                        : "—"}
                    </td>
                    <td>
                      {row.produced_by_name || row.created_by_name || "—"}
                    </td>
                    <td>
                      <span
                        className={
                          rowShift === "night"
                            ? "pa-badge pa-badge--warning"
                            : "pa-badge"
                        }
                      >
                        {rowShift === "night" ? "Ночь" : "День"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "12px 0",
          }}
        >
          <button
            type="button"
            className="add-modal__cancel"
            disabled={loading || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Назад
          </button>
          <span style={{ fontSize: 13, opacity: 0.75 }}>
            Страница {page} из {totalPages} · всего {count}
          </span>
          <button
            type="button"
            className="add-modal__cancel"
            disabled={loading || page >= totalPages}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductionReportTab;
