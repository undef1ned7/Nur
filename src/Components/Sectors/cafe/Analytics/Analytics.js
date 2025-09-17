import React, { useEffect, useMemo, useState } from "react";
import "./Analytics.scss";
import api from "../../../../api";

/**
 * Источники:
 *  - GET /cafe/staff/
 *  - GET /cafe/payroll-payouts/?month=YYYY-MM (с пагинацией; выгружаем все нужные месяцы)
 * + оффлайн-выплаты из localStorage (fallback).
 * Фильтрация по датам делается по полю paid_at (включительно).
 */

// ===== оффлайн-хранилище выплат (как в Payroll.jsx)
const LS_KEY_PAYOUTS = "local_payouts_v1";
const readLocalPayouts = () => {
  try {
    const raw = localStorage.getItem(LS_KEY_PAYOUTS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const nowMonth = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
})();

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

// ===== helpers по датам
const ymFromDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m] = dateStr.split("-");
  if (!y || !m) return null;
  return `${y}-${m}`;
};
const addMonths = (y, m, delta) => {
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
};
const monthsBetween = (fromDateStr, toDateStr) => {
  const f = new Date(fromDateStr);
  const t = new Date(toDateStr);
  if (Number.isNaN(f) || Number.isNaN(t)) return [];
  const y1 = f.getFullYear();
  const m1 = f.getMonth() + 1;
  const y2 = t.getFullYear();
  const m2 = t.getMonth() + 1;
  const total = (y2 - y1) * 12 + (m2 - m1);
  const out = [];
  for (let i = 0; i <= total; i++) out.push(addMonths(y1, m1, i));
  return out;
};
const inDateRange = (iso, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  const from = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : -Infinity;
  const to = toStr ? new Date(`${toStr}T23:59:59.999`).getTime() : +Infinity;
  return ts >= from && ts <= to;
};

export default function Analytics() {
  const [month, setMonth] = useState(nowMonth);
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [rowsAgg, setRowsAgg] = useState([]); // агрегированные выплаты [{staff, month, orders_count, sales, salary, paid_at}]
  const [staff, setStaff] = useState([]); // для имён/ролей

  const staffMap = useMemo(() => {
    const m = new Map();
    staff.forEach((p) => m.set(p.id, p));
    return m;
  }, [staff]);

  const load = async (ym = month, df = dateFrom, dt = dateTo) => {
    setLoading(true);
    try {
      // 1) staff
      const staffRes = await api.get("/cafe/staff/");
      const staffAll = listFrom(staffRes) || [];
      setStaff(staffAll);
      const staffIdSet = new Set(staffAll.map((x) => x.id));

      // 2) какие месяцы вытягивать с сервера
      let monthsToFetch = [];
      if (df || dt) {
        const from = df || dt;
        const to = dt || df;
        monthsToFetch = monthsBetween(from, to);
      } else {
        monthsToFetch = [ym];
      }

      // 3) выплаты (сервер) — по всем нужным месяцам
      let server = [];
      for (const m of monthsToFetch) {
        let url = `/cafe/payroll-payouts/?month=${encodeURIComponent(m)}`;
        while (url) {
          const r = await api.get(url);
          const data = r?.data || {};
          const chunk = data.results || data || [];
          server = server.concat(Array.isArray(chunk) ? chunk : []);
          url = data.next || null;
        }
      }

      // 4) выплаты (локальные оффлайн) — можно не фильтровать по месяцам, потом отрежем по датам
      const local = readLocalPayouts();

      // 5) merge + дедуп (на уровне отдельных записей)
      const seen = new Set();
      const keyOf = (p) =>
        `${p.staff}|${p.month}|${p.orders_count}|${p.sales}|${p.salary}|${
          p.paid_at || ""
        }`;
      const merged = [...local, ...server].filter((p) => {
        const k = keyOf(p);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // 6) ФИЛЬТР: только существующие сотрудники
      const knownOnly = merged.filter((p) => staffIdSet.has(p.staff));

      // 7) ФИЛЬТР ПО ДАТАМ paid_at (если заданы)
      const byDate =
        df || dt
          ? knownOnly.filter((r) => inDateRange(r.paid_at, df, dt))
          : knownOnly;

      // 8) АГРЕГАЦИЯ: (staff, month) → суммируем поля и берём позднейший paid_at
      const groups = new Map();
      for (const r of byDate) {
        const k = `${r.staff}|${r.month || ""}`;
        const g = groups.get(k) || {
          id: `grp-${k}`,
          staff: r.staff,
          month: r.month || "",
          orders_count: 0,
          sales: 0,
          salary: 0,
          paid_at: null,
        };
        g.orders_count += Number(r.orders_count) || 0;
        g.sales = round2(g.sales + toNum(r.sales));
        g.salary = round2(g.salary + toNum(r.salary));

        const cur = r.paid_at ? new Date(r.paid_at).getTime() : 0;
        const prev = g.paid_at ? new Date(g.paid_at).getTime() : 0;
        if (cur > prev) g.paid_at = r.paid_at || g.paid_at;

        groups.set(k, g);
      }

      const aggregated = Array.from(groups.values());
      setRowsAgg(aggregated);
    } catch (e) {
      console.error(e);
      // fallback: только локальные выплаты
      try {
        const staffRes = await api.get("/cafe/staff/");
        const staffAll = listFrom(staffRes) || [];
        setStaff(staffAll);
        const staffIdSet = new Set(staffAll.map((x) => x.id));

        const local = readLocalPayouts().filter((r) => staffIdSet.has(r.staff));
        const byDate =
          dateFrom || dateTo
            ? local.filter((r) => inDateRange(r.paid_at, dateFrom, dateTo))
            : local;

        const groups = new Map();
        for (const r of byDate) {
          const k = `${r.staff}|${r.month || ""}`;
          const g = groups.get(k) || {
            id: `grp-${k}`,
            staff: r.staff,
            month: r.month || "",
            orders_count: 0,
            sales: 0,
            salary: 0,
            paid_at: null,
          };
          g.orders_count += Number(r.orders_count) || 0;
          g.sales = round2(g.sales + toNum(r.sales));
          g.salary = round2(g.salary + toNum(r.salary));
          const cur = r.paid_at ? new Date(r.paid_at).getTime() : 0;
          const prev = g.paid_at ? new Date(g.paid_at).getTime() : 0;
          if (cur > prev) g.paid_at = r.paid_at || g.paid_at;
          groups.set(k, g);
        }
        setRowsAgg(Array.from(groups.values()));
      } catch (e2) {
        console.error("fallback staff/local failed:", e2);
        setRowsAgg([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // авто-перезагрузка при смене месяца/дат
  useEffect(() => {
    load(month, dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, dateFrom, dateTo]);

  // поиск по имени/роли на АГРЕГИРОВАННЫХ строках
  const rowsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rowsAgg;
    return rowsAgg.filter((r) => {
      const st = staffMap.get(r.staff);
      const name = (st?.name || "").toLowerCase();
      const role = (st?.role || "").toLowerCase();
      return name.includes(q) || role.includes(q);
    });
  }, [rowsAgg, staffMap, query]);

  // сортировка (по зарплате убыв.)
  const rowsSorted = useMemo(
    () => [...rowsFiltered].sort((a, b) => toNum(b.salary) - toNum(a.salary)),
    [rowsFiltered]
  );

  const totals = useMemo(() => {
    const orders = rowsFiltered.reduce(
      (s, r) => s + (Number(r.orders_count) || 0),
      0
    );
    const sales = rowsFiltered.reduce((s, r) => s + toNum(r.sales), 0);
    const salary = rowsFiltered.reduce((s, r) => s + toNum(r.salary), 0);
    return { orders, sales, salary };
  }, [rowsFiltered]);

  return (
    <section className="analytics">
      {/* Заголовок + фильтры */}
      <header className="analytics__header">
        <div>
          <h2 className="analytics__title">Аналитика выплат</h2>
          <p className="analytics__subtitle">
            Данные группируются по сотруднику и месяцу. Удалённые сотрудники
            скрываются.
          </p>
        </div>

        <div className="analytics__actions">
          {/* Месяц (быстрый фильтр/навигация) */}
          <input
            type="month"
            className="analytics__select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            title="Фильтр по месяцу"
          />

          {/* Дата от / до (для фильтрации по дню или диапазону) */}
          <input
            type="date"
            className="analytics__select"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Дата от"
          />
          <input
            type="date"
            className="analytics__select"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Дата до"
          />

          {/* Поиск */}
          <input
            className="analytics__select"
            placeholder="Поиск: сотрудник или роль…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            title="Поиск"
          />

          <button
            className="analytics__btn analytics__btn--secondary"
            onClick={() => load(month, dateFrom, dateTo)}
            disabled={loading}
          >
            Обновить
          </button>
        </div>
      </header>

      {/* Сводка */}
      {loading ? (
        <div className="analytics__skeletonRow">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="analytics__skeleton" />
          ))}
        </div>
      ) : (
        <div className="analytics__summary">
          <div className="analytics__card">
            <div className="analytics__value">{totals.orders}</div>
            <div className="analytics__label">Заказы</div>
          </div>
          <div className="analytics__card">
            <div className="analytics__value">{fmtMoney(totals.sales)} сом</div>
            <div className="analytics__label">Выручка</div>
          </div>
          <div className="analytics__card">
            <div className="analytics__value">
              {fmtMoney(totals.salary)} сом
            </div>
            <div className="analytics__label">Выплаты</div>
          </div>
        </div>
      )}

      {/* Таблица (агрегированные записи) */}
      <section className="analytics__panel">
        <div className="analytics__head">Выплаты</div>
        <div className="table">
          <div className="table__head">
            <span>Сотрудник</span>
            <span>Роль</span>
            <span>Месяц</span>
            <span>Заказы</span>
            <span>Выручка</span>
            <span>Зарплата</span>
            <span>Последняя выплата</span>
          </div>
          <div className="table__body">
            {loading ? (
              <div className="table__empty">Загрузка…</div>
            ) : rowsSorted.length ? (
              rowsSorted.map((r) => {
                const st = staffMap.get(r.staff);
                return (
                  <div key={r.id} className="table__row">
                    <span className="ellipsis">{st?.name || r.staff}</span>
                    <span className="ellipsis">{st?.role || "—"}</span>
                    <span>{r.month || "—"}</span>
                    <span>{r.orders_count || 0}</span>
                    <span>{fmtMoney(r.sales)} сом</span>
                    <span>{fmtMoney(r.salary)} сом</span>
                    <span>
                      {r.paid_at ? new Date(r.paid_at).toLocaleString() : "—"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="table__empty">Нет записей</div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
