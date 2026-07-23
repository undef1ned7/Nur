// src/Components/Sectors/Consulting/client/SubscriptionMatrix.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getSubscriptionMatrix } from "../../../../api/consultingSubscriptions";
import "./SubscriptionMatrix.scss";

const RU_MONTHS = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") : "—";
};

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key) => {
  const [y, m] = String(key).split("-");
  const idx = Number(m) - 1;
  return `${RU_MONTHS[idx] || m} ${String(y).slice(2)}`;
};

// Диапазон месяцев [from..to] включительно как массив ключей "YYYY-MM".
const buildMonthRange = (from, to) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out = [];
  let y = fy;
  let m = fm;
  let guard = 0;
  while ((y < ty || (y === ty && m <= tm)) && guard < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
};

const defaultRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1); // последние 6 мес.
  return { from: monthKey(from), to: monthKey(now) };
};

const STATUS_LABEL = {
  paid: "Оплачено",
  planned: "Запланировано",
  overdue: "Просрочено",
  none: "—",
};

export default function SubscriptionMatrix() {
  const init = defaultRange();
  const [monthFrom, setMonthFrom] = useState(init.from);
  const [monthTo, setMonthTo] = useState(init.to);
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ months: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setNotReady(false);
    try {
      const res = await getSubscriptionMatrix({
        month_from: monthFrom,
        month_to: monthTo,
        search: search.trim() || undefined,
      });
      setData({
        months: Array.isArray(res?.months) ? res.months : [],
        rows: Array.isArray(res?.rows) ? res.rows : [],
      });
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) setNotReady(true);
      else setErr(e?.detail || "Не удалось загрузить матрицу.");
    } finally {
      setLoading(false);
    }
  }, [monthFrom, monthTo, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Колонки: берём из ответа, иначе строим из выбранного диапазона.
  const months = useMemo(() => {
    if (data.months.length) return data.months;
    if (monthFrom && monthTo) return buildMonthRange(monthFrom, monthTo);
    return [];
  }, [data.months, monthFrom, monthTo]);

  // Итог по месяцу (сумма оплаченных абонплат) — строка «Итого».
  const totals = useMemo(() => {
    const t = {};
    months.forEach((mk) => (t[mk] = 0));
    data.rows.forEach((row) => {
      months.forEach((mk) => {
        const cell = row.cells?.[mk];
        if (cell && (cell.status === "paid" || cell.paid)) {
          t[mk] += Number(cell.amount) || 0;
        }
      });
    });
    return t;
  }, [data.rows, months]);

  return (
    <div className="subMatrix">
      <div className="subMatrix__toolbar">
        <label className="subMatrix__field">
          <span>С месяца</span>
          <input
            type="month"
            className="subMatrix__input"
            value={monthFrom}
            max={monthTo}
            onChange={(e) => setMonthFrom(e.target.value)}
          />
        </label>
        <label className="subMatrix__field">
          <span>По месяц</span>
          <input
            type="month"
            className="subMatrix__input"
            value={monthTo}
            min={monthFrom}
            onChange={(e) => setMonthTo(e.target.value)}
          />
        </label>
        <label className="subMatrix__field subMatrix__field--grow">
          <span>Поиск</span>
          <input
            className="subMatrix__input"
            placeholder="ФИО клиента или услуга…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="subMatrix__legend">
          <span className="subMatrix__legendItem">
            <i className="subMatrix__dot subMatrix__dot--paid" /> Оплачено
          </span>
          <span className="subMatrix__legendItem">
            <i className="subMatrix__dot subMatrix__dot--planned" /> Запланировано
          </span>
          <span className="subMatrix__legendItem">
            <i className="subMatrix__dot subMatrix__dot--overdue" /> Просрочено
          </span>
        </div>
      </div>

      {notReady && (
        <div className="subMatrix__notice">
          <b>Матрица ещё не подключена на бэкенде.</b>
          <p>
            Эндпоинт <code>GET /consalting/subscription-matrix/</code> вернёт
            строки «клиент × услуга» и абонентские платежи по месяцам. Контракт:
            docs/consulting/subscription-matrix.md.
          </p>
        </div>
      )}

      {!!err && <div className="subMatrix__alert">{err}</div>}

      {!notReady && (
        <div className="subMatrix__tableWrap">
          <table className="subMatrix__table">
            <thead>
              <tr>
                <th className="subMatrix__stickyCol subMatrix__stickyCol--1">
                  ФИО
                </th>
                <th className="subMatrix__stickyCol subMatrix__stickyCol--2">
                  Услуга
                </th>
                <th className="subMatrix__stickyCol subMatrix__stickyCol--3">
                  Абон. плата
                </th>
                {months.map((mk) => (
                  <th key={mk} className="subMatrix__monthCol">
                    {monthLabel(mk)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="subMatrix__empty" colSpan={months.length + 3}>
                    Загрузка…
                  </td>
                </tr>
              ) : data.rows.length ? (
                data.rows.map((row, i) => (
                  <tr key={`${row.client_id}-${row.service_id}-${i}`}>
                    <td className="subMatrix__stickyCol subMatrix__stickyCol--1">
                      {row.client_name || "—"}
                    </td>
                    <td className="subMatrix__stickyCol subMatrix__stickyCol--2">
                      {row.service_name || "—"}
                    </td>
                    <td className="subMatrix__stickyCol subMatrix__stickyCol--3">
                      {money(row.subscription_amount)}
                      <small>
                        {" "}
                        /{row.subscription_period === "year" ? "год" : "мес"}
                      </small>
                    </td>
                    {months.map((mk) => {
                      const cell = row.cells?.[mk];
                      const status = cell
                        ? cell.status || (cell.paid ? "paid" : "planned")
                        : "none";
                      return (
                        <td
                          key={mk}
                          className={`subMatrix__cell subMatrix__cell--${status}`}
                          title={
                            cell
                              ? `${monthLabel(mk)}: ${money(cell.amount)} — ${
                                  STATUS_LABEL[status] || status
                                }`
                              : `${monthLabel(mk)}: нет платежа`
                          }
                        >
                          {cell ? money(cell.amount) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="subMatrix__empty" colSpan={months.length + 3}>
                    Нет данных за выбранный период
                  </td>
                </tr>
              )}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr>
                  <td
                    className="subMatrix__stickyCol subMatrix__stickyCol--1"
                    colSpan={3}
                  >
                    Итого оплачено
                  </td>
                  {months.map((mk) => (
                    <td key={mk} className="subMatrix__totalCell">
                      {totals[mk] ? money(totals[mk]) : "—"}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
