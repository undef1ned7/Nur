// src/components/Reports/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaChartLine, FaPrint, FaFilter, FaSync } from "react-icons/fa";
import api from "../../../../api";
import "./reports.scss";

/* ────────── утилиты ────────── */
const listFrom = (res) => res?.data?.results || res?.data || [];
const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Number(n) || 0);
const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0)) + " сом";

const RU_MONTHS = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];
const ymKey = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
};
const ymLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${RU_MONTHS[(m || 1) - 1]} ${y}`;
};

// вхождение даты в диапазон (включительно)
const inRange = (iso, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const from = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : -Infinity;
  const to = toStr ? new Date(`${toStr}T23:59:59.999`).getTime() : +Infinity;
  return t >= from && t <= to;
};

const nightsBetween = (a, b) => {
  if (!a || !b) return 1;
  const ms = new Date(b) - new Date(a);
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, d);
};

const curYear = new Date().getFullYear();

/* ────────── компонент ────────── */
const Reports = () => {
  const [tab, setTab] = useState("cash"); // cash | history
  const [period, setPeriod] = useState("ytd"); // ytd | 6m | 12m

  // общие флаги загрузки
  const [loading, setLoading] = useState(false); // для cash
  const [loadingHist, setLoadingHist] = useState(false); // для history

  // кассы
  const [boxes, setBoxes] = useState([]);
  const [boxId, setBoxId] = useState("ALL"); // 'ALL' = все кассы

  // cashflows
  const [flows, setFlows] = useState([]);

  // history (архив броней)
  const [hist, setHist] = useState([]);

  // фильтры
  const [queryMonth, setQueryMonth] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  // ── загрузка касс
  const fetchBoxes = async () => {
    try {
      const r = await api
        .get("/construction/cashboxes/")
        .catch(() => ({ data: [] }));
      const arr = listFrom(r) || [];
      setBoxes(arr);
      setBoxId("ALL");
    } catch {
      setBoxes([]);
      setBoxId("ALL");
    }
  };

  // ── загрузка всех cashflows (с пагинацией)
  const fetchAllFlows = async () => {
    setLoading(true);
    try {
      let acc = [];
      let url = "/construction/cashflows/";
      const params = [];
      if (boxId && boxId !== "ALL")
        params.push(`cashbox=${encodeURIComponent(boxId)}`);
      if (params.length) url += `?${params.join("&")}`;

      // цикл по страницам (DRF style)
      while (url) {
        const r = await api.get(url);
        const data = r?.data;
        if (Array.isArray(data)) {
          acc = acc.concat(data);
          url = null;
        } else {
          const chunk = data?.results || [];
          acc = acc.concat(Array.isArray(chunk) ? chunk : []);
          url = data?.next || null;
        }
      }

      // приведение типов и полей
      const mapped = acc.map((x, i) => {
        const rawAmt = toNum(x.amount ?? x.sum ?? x.value ?? x.total);
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense") {
          type = rawAmt < 0 ? "expense" : "income";
        }
        return {
          id: x.id || x.uuid || `${i}`,
          type, // 'income' | 'expense'
          amount: Math.abs(rawAmt),
          created_at:
            x.created_at ||
            x.created ||
            x.date ||
            x.timestamp ||
            x.createdAt ||
            null,
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          cashbox: x.cashbox || x.cashbox_id || null,
        };
      });

      // ⬇️ только приходы по бронированиям
      const onlyBookings = mapped.filter(
        (f) => f.type === "income" && /оплата\s*брони/i.test(f.title || "")
      );

      setFlows(onlyBookings);
    } catch (e) {
      console.error("Ошибка загрузки cashflows:", e);
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  // ── загрузка архива броней (история) — для ТАБЛИЦЫ
  const fetchHistoryAll = async () => {
    setLoadingHist(true);
    try {
      let acc = [];
      let url = "/booking/booking/history/";
      let guard = 0;
      while (url && guard < 50) {
        const r = await api.get(url);
        const data = r?.data;
        if (Array.isArray(data)) {
          acc = acc.concat(data);
          url = null;
        } else {
          const chunk = data?.results || [];
          acc = acc.concat(Array.isArray(chunk) ? chunk : []);
          url = data?.next || null;
        }
        guard += 1;
      }

      // нормализация истории для таблицы
      const mapped = acc.map((h, i) => {
        const from = h.start_time || null;
        const to = h.end_time || null;
        const nights = nightsBetween(from, to);
        const price = toNum(h.target_price);
        const amount = Math.max(0, price * nights);
        const archivedAt =
          h.archived_at || h.end_time || h.start_time || h.created_at || null;

        return {
          id: h.id || h.uuid || `hist-${i}`,
          created_at: archivedAt,
          from,
          to,
          nights,
          price,
          amount,
          client_label: h.client_label || "",
          target_name: h.target_name || "",
          target_type: h.target_type || "", // hotel | room | bed
          purpose: h.purpose || "",
        };
      });

      setHist(mapped);
    } catch (e) {
      console.error("Ошибка загрузки истории броней:", e);
      setHist([]);
    } finally {
      setLoadingHist(false);
    }
  };

  // первая загрузка
  useEffect(() => {
    (async () => {
      await fetchBoxes();
      fetchAllFlows();
      fetchHistoryAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // перезагрузка движений при смене кассы (только для вкладки кассы)
  useEffect(() => {
    if (tab === "cash") {
      fetchAllFlows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  /* ===================== CASH: агрегации ===================== */
  // фильтрация по датам
  const flowsFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return flows;
    return flows.filter((f) => inRange(f.created_at, dateFrom, dateTo));
  }, [flows, dateFrom, dateTo]);

  // группировка по месяцам
  const groupedCash = useMemo(() => {
    const map = new Map();
    for (const f of flowsFiltered) {
      const ym = ymKey(f.created_at);
      if (!ym) continue;
      const cur = map.get(ym) || { income: 0, expense: 0, ops: 0 };
      if (f.type === "income") cur.income += toNum(f.amount);
      else cur.expense += toNum(f.amount);
      cur.ops += 1;
      map.set(ym, cur);
    }
    return Array.from(map.entries())
      .map(([ym, v]) => ({
        ym,
        label: ymLabel(ym),
        income: v.income,
        expense: v.expense,
        net: v.income - v.expense,
        ops: v.ops,
      }))
      .sort((a, b) => (a.ym < b.ym ? -1 : 1));
  }, [flowsFiltered]);

  // период (если выбран диапазон дат — используем его)
  const dataCash = useMemo(() => {
    const grouped = groupedCash;
    if (!grouped.length) return [];
    if (dateFrom || dateTo) return grouped;
    if (period === "6m") return grouped.slice(-6);
    if (period === "12m") return grouped.slice(-12);
    if (period === "ytd")
      return grouped.filter((r) => Number(r.ym.slice(0, 4)) === curYear);
    return grouped;
  }, [groupedCash, period, dateFrom, dateTo]);

  // сводка по CASH
  const summaryCash = useMemo(() => {
    const income = dataCash.reduce((s, d) => s + d.income, 0);
    const expense = dataCash.reduce((s, d) => s + d.expense, 0);
    const net = income - expense;
    return { income, expense, net };
  }, [dataCash]);

  // данные для графика CASH
  const seriesIncome = useMemo(
    () => dataCash.map((d) => ({ label: d.label, value: d.income })),
    [dataCash]
  );
  const seriesExpense = useMemo(
    () => dataCash.map((d) => ({ label: d.label, value: d.expense })),
    [dataCash]
  );
  const maxY = useMemo(
    () =>
      Math.max(
        1,
        ...seriesIncome.map((s) => s.value),
        ...seriesExpense.map((s) => s.value)
      ),
    [seriesIncome, seriesExpense]
  );
  const makePolyline = (series) => {
    const W = 640,
      H = 220,
      P = 24;
    const innerW = W - P * 2;
    const innerH = H - P * 2;
    const points = series.map((s, i) => {
      const x =
        P + innerW * (series.length === 1 ? 0 : i / (series.length - 1));
      const y = P + (innerH - (s.value / maxY) * innerH);
      return `${x},${y}`;
    });
    return { points: points.join(" ") };
  };
  const polyIncome = useMemo(
    () => makePolyline(seriesIncome),
    [seriesIncome, maxY]
  );
  const polyExpense = useMemo(
    () => makePolyline(seriesExpense),
    [seriesExpense, maxY]
  );

  // фильтр таблицы по названию месяца (только CASH)
  const tableDataCash = useMemo(() => {
    const q = (queryMonth || "").trim().toLowerCase();
    if (!q) return dataCash;
    return dataCash.filter((d) => d.label.toLowerCase().includes(q));
  }, [dataCash, queryMonth]);

  /* ===================== HISTORY: таблица ===================== */
  // фильтрация по датам
  const histFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return hist;
    return hist.filter((f) => inRange(f.created_at, dateFrom, dateTo));
  }, [hist, dateFrom, dateTo]);

  // сортировка по дате архива (свежие сверху)
  const histTable = useMemo(
    () =>
      [...histFiltered].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      ),
    [histFiltered]
  );

  // сводка по HISTORY (для футера таблицы)
  const histSummary = useMemo(() => {
    const amount = histTable.reduce((s, r) => s + toNum(r.amount), 0);
    const ops = histTable.length;
    return { amount, ops };
  }, [histTable]);

  // перезагрузка по кнопке
  const handleRefresh = () => {
    if (tab === "cash") fetchAllFlows();
    else fetchHistoryAll();
  };

  const isLoading = tab === "cash" ? loading : loadingHist;

  return (
    <section className="reports">
      {/* Tabs */}
      <div className="reports__tabs">
        <button
          className={`reports__tab ${
            tab === "cash" ? "reports__tab--active" : ""
          }`}
          onClick={() => setTab("cash")}
        >
          Касса: оплаты бронирований
        </button>
        <button
          className={`reports__tab ${
            tab === "history" ? "reports__tab--active" : ""
          }`}
          onClick={() => setTab("history")}
        >
          История броней
        </button>
      </div>

      {/* Header */}
      <div className="reports__header">
        <div>
          <h2 className="reports__title">
            <FaChartLine />{" "}
            {tab === "cash"
              ? "Отчёты и аналитика (касса: оплаты бронирований)"
              : "История броней (таблица)"}
          </h2>
          <p className="reports__subtitle">
            {tab === "cash"
              ? "Суммы приходов по операциям кассы, помеченным как «Оплата брони»"
              : "Архивные записи бронирований: период, ночи, цена/ночь и сумма (ночей × снапшот цены)"}
          </p>
        </div>

        <div className="reports__actions">
          {/* выбор кассы — только для вкладки «Касса» */}
          {tab === "cash" && (
            <select
              className="reports__select"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              title="Касса"
            >
              <option value="ALL">Все кассы</option>
              {boxes.map((b) => (
                <option key={b.id || b.uuid} value={b.id || b.uuid}>
                  {b.department_name || b.name || "Касса"}
                </option>
              ))}
            </select>
          )}

          <button
            className="reports__btn reports__btn--secondary"
            onClick={() => window.print()}
          >
            <FaPrint /> Печать
          </button>
          <button
            className="reports__btn reports__btn--secondary"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Обновить данные"
          >
            <FaSync /> Обновить
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="reports__controls">
        {/* Период — только для CASH (для истории он не нужен) */}
        {tab === "cash" && (
          <div className="reports__filter">
            <FaFilter className="reports__filterIcon" />
            <select
              className="reports__select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={!!(dateFrom || dateTo)}
              title={
                dateFrom || dateTo
                  ? "Период отключён: используется диапазон дат"
                  : "Период"
              }
            >
              <option value="6m">Последние 6 мес</option>
              <option value="ytd">С начала года</option>
              <option value="12m">12 месяцев</option>
            </select>
          </div>
        )}

        {/* Дата от / до */}
        <input
          type="date"
          className="reports__select"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Дата от"
        />
        <input
          type="date"
          className="reports__select"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Дата до"
        />

        {/* серии/фильтр месяца — только для CASH */}
        {tab === "cash" && (
          <div className="reports__series">
            <label className="reports__check">
              <input type="checkbox" checked readOnly />
              <span className="reports__dot reports__dot--income"></span>
              Приход
            </label>
            <label className="reports__check">
              <input type="checkbox" checked readOnly />
              <span className="reports__dot reports__dot--expense"></span>
              Расход
            </label>

            <input
              className="reports__select"
              placeholder="Фильтр месяца (напр. Июл)"
              value={queryMonth}
              onChange={(e) => setQueryMonth(e.target.value)}
              style={{ minWidth: 160 }}
              title="Поиск по названию месяца"
            />
          </div>
        )}
      </div>

      {/* ===== CASH: KPI + CHART + TABLE АГРЕГАТОВ ===== */}
      {tab === "cash" && (
        <>
          {/* KPIs */}
          <div className="reports__kpis">
            <div className="reports__kpi">
              <div className="reports__kpiLabel">Приход</div>
              <div className="reports__kpiValue">
                {fmtMoney(summaryCash.income)}
              </div>
            </div>
            <div className="reports__kpi">
              <div className="reports__kpiLabel">Расход</div>
              <div className="reports__kpiValue">
                {fmtMoney(summaryCash.expense)}
              </div>
            </div>
            <div className="reports__kpi">
              <div className="reports__kpiLabel">Итог</div>
              <div className="reports__kpiValue">
                {fmtMoney(summaryCash.net)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="reports__chartCard">
            <div className="reports__chartHead">Динамика: приход vs расход</div>
            <div className="reports__chart">
              <div
                className="reports__chartLabels"
                style={{ "--cols": Math.max(2, dataCash.length) }}
              >
                {dataCash.map((d) => (
                  <span key={d.ym} className="reports__chartLabel">
                    {d.label}
                  </span>
                ))}
              </div>

              <svg
                className="reports__svg"
                viewBox="0 0 640 220"
                preserveAspectRatio="none"
                aria-hidden
              >
                {[0.25, 0.5, 0.75, 1].map((g) => (
                  <line
                    key={g}
                    x1="24"
                    x2="616"
                    y1={24 + (220 - 48) * g}
                    y2={24 + (220 - 48) * g}
                    className="reports__grid"
                  />
                ))}

                {/* Приход */}
                <polyline
                  className="reports__poly reports__poly--income"
                  points={polyIncome.points}
                />
                {polyIncome.points
                  .split(" ")
                  .filter(Boolean)
                  .map((pt, i) => {
                    const [cx, cy] = pt.split(",");
                    return (
                      <circle
                        key={`inc-${i}`}
                        cx={cx}
                        cy={cy}
                        r="3"
                        className="reports__dotPoint reports__dotPoint--income"
                      />
                    );
                  })}

                {/* Расход */}
                <polyline
                  className="reports__poly reports__poly--expense"
                  points={polyExpense.points}
                />
                {polyExpense.points
                  .split(" ")
                  .filter(Boolean)
                  .map((pt, i) => {
                    const [cx, cy] = pt.split(",");
                    return (
                      <circle
                        key={`exp-${i}`}
                        cx={cx}
                        cy={cy}
                        r="3"
                        className="reports__dotPoint reports__dotPoint--expense"
                      />
                    );
                  })}
              </svg>
            </div>

            <div className="reports__legend">
              <span>
                <i className="reports__legendDot reports__legendDot--income" />
                Приход
              </span>
              <span>
                <i className="reports__legendDot reports__legendDot--expense" />
                Расход
              </span>
            </div>
          </div>

          {/* Table (агрегаты по месяцам) */}
          <div className="reports__tableWrap">
            <table className="reports__table">
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th>Приход</th>
                  <th>Расход</th>
                  <th>Итог</th>
                  <th>Операций</th>
                </tr>
              </thead>
              <tbody>
                {tableDataCash.map((d) => (
                  <tr key={d.ym}>
                    <td>{d.label}</td>
                    <td>{fmtMoney(d.income)}</td>
                    <td>{fmtMoney(d.expense)}</td>
                    <td>{fmtMoney(d.net)}</td>
                    <td>{fmt(d.ops)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Итого</td>
                  <td>{fmtMoney(summaryCash.income)}</td>
                  <td>{fmtMoney(summaryCash.expense)}</td>
                  <td>{fmtMoney(summaryCash.net)}</td>
                  <td>{fmt(tableDataCash.reduce((s, d) => s + d.ops, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {loading && <div className="reports__alert">Загрузка данных…</div>}
          {!loading && !dataCash.length && (
            <div className="reports__alert">
              Нет данных кассы для выбранного периода.
            </div>
          )}
        </>
      )}

      {/* ===== HISTORY: ТОЛЬКО ТАБЛИЦА ===== */}
      {tab === "history" && (
        <>
          <div className="reports__tableWrap">
            <table className="reports__table">
              <thead>
                <tr>
                  <th>Архивировано</th>
                  <th>Клиент</th>
                  <th>Объект</th>
                  <th>Тип</th>
                  <th>Период</th>
                  <th>Ночей</th>
                  <th>Цена/ночь</th>
                  <th>Сумма</th>
                  <th>Назначение</th>
                </tr>
              </thead>
              <tbody>
                {histTable.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>{r.client_label || "—"}</td>
                    <td>{r.target_name || "—"}</td>
                    <td>{r.target_type || "—"}</td>
                    <td>
                      {r.from || "—"}
                      {r.to ? ` — ${r.to}` : ""}
                    </td>
                    <td>{fmt(r.nights)}</td>
                    <td>{fmtMoney(r.price)}</td>
                    <td>{fmtMoney(r.amount)}</td>
                    <td>{r.purpose || "—"}</td>
                  </tr>
                ))}
                {!histTable.length && (
                  <tr>
                    <td className="reports__empty" colSpan={9}>
                      Нет записей истории за выбранный период
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>Итого</td>
                  <td>{fmtMoney(histSummary.amount)}</td>
                  <td>{fmt(histSummary.ops)} запис.</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {loadingHist && (
            <div className="reports__alert">Загрузка истории…</div>
          )}
        </>
      )}
    </section>
  );
};

export default Reports;
