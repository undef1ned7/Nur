import React, { useEffect, useMemo, useState } from "react";
import "./Payroll.scss";
import {
  FaSearch,
  FaMoneyBillWave,
  FaSync,
  FaCheckCircle,
} from "react-icons/fa";
import api from "../../../../api";

/**
 * БЕКЕНД (ожидается):
 * GET  /cafe/payroll-payouts/?month=YYYY-MM
 * POST /cafe/payroll-payouts/  { staff, month, orders_count, sales, salary }
 * Ответ POST: { id, staff, month, orders_count, sales, salary, paid_at }
 */

// ===== настройки расчёта
const COMMISSION_RATE = 0.1; // 10%

// ===== оффлайн-хранилище выплат (fallback)
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

const appendLocalPayout = (rec) => {
  const list = readLocalPayouts();
  list.unshift(rec);
  localStorage.setItem(LS_KEY_PAYOUTS, JSON.stringify(list));
};

// универсально достаём список (paginator/без)
const listFrom = (res) => res?.data?.results || res?.data || [];

// YYYY-MM текущего месяца
const nowMonth = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
})();

const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// посчитать тотал заказа по его items
const orderTotal = (o) => {
  const items = Array.isArray(o.items) ? o.items : [];
  return items.reduce(
    (s, it) => s + toNum(it.menu_item_price) * (Number(it.quantity) || 0),
    0
  );
};

// belongs to YYYY-MM
const inMonth = (isoDateTime, ym) => {
  if (!isoDateTime) return false;
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}` === ym;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function CafePayroll() {
  const [month, setMonth] = useState(nowMonth);

  // каталоги
  const [staff, setStaff] = useState([]); // {id, name, role, is_active}
  const [orders, setOrders] = useState([]); // заказы с items

  // выплаты (серверные + локальные)
  const [payouts, setPayouts] = useState([]); // [{id, staff, month, orders_count, sales, salary, paid_at}]

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [paying, setPaying] = useState({}); // { [staffId]: boolean }

  // загрузчики
  const fetchStaff = async () => {
    const r = await api.get("/cafe/staff/");
    const all = listFrom(r) || [];
    const act = all.filter((p) => p.is_active !== false);
    setStaff(act.length ? act : all);
  };

  // DRF может отдавать пагинацией. Пройдём все страницы, если есть.
  const fetchAllOrders = async () => {
    let acc = [];
    let url = "/cafe/orders/";
    while (url) {
      const r = await api.get(url);
      const data = r?.data || {};
      const chunk = data.results || data || [];
      acc = acc.concat(Array.isArray(chunk) ? chunk : []);
      url = data.next || null; // axios тянет и абсолютный next
    }
    setOrders(acc);
  };

  // тянем выплаты + склеиваем с локальными
  const fetchPayouts = async (ym) => {
    let server = [];
    try {
      const r = await api.get(
        `/cafe/payroll-payouts/?month=${encodeURIComponent(ym)}`
      );
      server = listFrom(r);
    } catch {
      // сервер может быть недоступен
      server = [];
    }

    const local = readLocalPayouts().filter((p) => p.month === ym);
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

    setPayouts(merged);
  };

  const loadAll = async (ym = month) => {
    setLoading(true);
    try {
      await Promise.all([fetchStaff(), fetchAllOrders(), fetchPayouts(ym)]);
    } catch (e) {
      console.error("Ошибка загрузки payroll:", e);
      setStaff([]);
      setOrders([]);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // при смене месяца — подтянуть выплаты на этот месяц
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchPayouts(month);
      } catch (e) {
        console.error("Ошибка загрузки выплат:", e);
        setPayouts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  // индекс по сотрудникам
  const staffMap = useMemo(() => {
    const m = new Map();
    staff.forEach((s) => m.set(s.id, s));
    return m;
  }, [staff]);

  // агрегат по выплатам за выбранный месяц (для вычета)
  const paidAggByStaff = useMemo(() => {
    const agg = new Map();
    for (const p of payouts) {
      if (p.month !== month) continue;
      const prev = agg.get(p.staff) || { orders: 0, sales: 0, salary: 0 };
      agg.set(p.staff, {
        orders: prev.orders + (Number(p.orders_count) || 0),
        sales: prev.sales + toNum(p.sales),
        salary: prev.salary + toNum(p.salary),
      });
    }
    return agg;
  }, [payouts, month]);

  // сгруппируем выручку и заказы по официанту за выбранный месяц
  const payrollRows = useMemo(() => {
    // waiterId -> { sales, ordersCount }
    const agg = new Map();

    for (const o of orders) {
      if (!inMonth(o.created_at, month)) continue;
      if (!o.waiter) continue; // у заказа не назначен официант
      const sale = orderTotal(o);
      const prev = agg.get(o.waiter) || { sales: 0, ordersCount: 0 };
      agg.set(o.waiter, {
        sales: prev.sales + sale,
        ordersCount: prev.ordersCount + 1,
      });
    }

    // превратим во «все сотрудники», и вычтем уже выплаченное
    const rows = staff.map((s) => {
      const a = agg.get(s.id) || { sales: 0, ordersCount: 0 };
      const paid = paidAggByStaff.get(s.id) || {
        orders: 0,
        sales: 0,
        salary: 0,
      };

      const ordersLeft = Math.max(0, (a.ordersCount || 0) - (paid.orders || 0));
      const salesLeft = Math.max(0, round2((a.sales || 0) - (paid.sales || 0)));
      const salaryLeft = Math.max(0, round2(salesLeft * COMMISSION_RATE));

      return {
        staffId: s.id,
        staff: s.name || "Сотрудник",
        role: s.role || "",
        month,
        // Полные значения:
        ordersCountTotal: a.ordersCount,
        salesTotal: round2(a.sales),
        salaryTotal: round2((a.sales || 0) * COMMISSION_RATE),
        // Остаток к выплате:
        ordersCount: ordersLeft,
        sales: salesLeft,
        salary: salaryLeft,
        // Уже выплачено:
        paidOrders: paid.orders || 0,
        paidSales: round2(paid.sales || 0),
        paidSalary: round2(paid.salary || 0),
      };
    });

    // поиск/сортировка
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.staff.toLowerCase().includes(q) ||
            (r.role || "").toLowerCase().includes(q)
        )
      : rows;

    // сортировка по остаточной зарплате убыв.
    return filtered.sort((a, b) => b.salary - a.salary);
  }, [orders, staff, month, query, paidAggByStaff]);

  const fmtMoney = (n) =>
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNum(n));

  const handlePay = async (row) => {
    if (row.salary <= 0 || row.sales <= 0) return;

    const staffName = row.staff;
    const msg =
      `Выплатить ${fmtMoney(row.salary)} сом\n` +
      `Сотр.: ${staffName}\nМесяц: ${row.month}\n` +
      `Заказы: ${row.ordersCount}\nВыручка: ${fmtMoney(row.sales)}\n\n` +
      `Подтвердить выплату?`;
    if (!window.confirm(msg)) return;

    try {
      setPaying((m) => ({ ...m, [row.staffId]: true }));

      const payload = {
        staff: row.staffId,
        month: row.month,
        orders_count: round2(row.ordersCount),
        sales: round2(row.sales),
        salary: round2(row.salary),
      };

      // Пытаемся сохранить на сервер
      const { data: created } = await api.post(
        "/cafe/payroll-payouts/",
        payload
      );
      setPayouts((prev) => [created, ...prev]); // успех: серверная запись
    } catch (e) {
      console.error("Ошибка выплаты, пишу в локальную аналитику:", e);

      // Fallback: локальная запись для аналитики
      const fallback = {
        id: `local-${Date.now()}-${row.staffId}`,
        staff: row.staffId,
        month: row.month,
        orders_count: round2(row.ordersCount),
        sales: round2(row.sales),
        salary: round2(row.salary),
        paid_at: new Date().toISOString(),
        _source: "local",
      };

      appendLocalPayout(fallback);
      setPayouts((prev) => [fallback, ...prev]); // мгновенное «обнуление» карточки
    } finally {
      setPaying((m) => ({ ...m, [row.staffId]: false }));
    }
  };

  return (
    <section className="payroll">
      {/* Header */}
      <div className="payroll__header">
        <div>
          <h2 className="payroll__title">Зарплата</h2>
          <div className="payroll__subtitle">
            Авторасчёт по месяцам: ЗП = {Math.round(COMMISSION_RATE * 100)}% от
            выручки заказов официанта за месяц. После «Оплатить» остаток по
            месяцу обнуляется, а запись попадает в аналитику выплат (оффлайн —
            тоже).
          </div>
        </div>

        <div className="payroll__actions">
          {/* Поиск */}
          <div className="payroll__search">
            <FaSearch className="payroll__search-icon" />
            <input
              className="payroll__search-input"
              placeholder="Поиск: сотрудник или роль…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Месяц */}
          <input
            type="month"
            className="payroll__input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            title="Месяц расчёта"
          />

          {/* Обновить */}
          <button
            className="payroll__btn payroll__btn--secondary"
            onClick={() => loadAll(month)}
            disabled={loading}
            title="Перезагрузить данные"
          >
            <FaSync /> Обновить
          </button>
        </div>
      </div>

      {/* List */}
      <div className="payroll__list">
        {loading && <div className="payroll__alert">Загрузка данных…</div>}

        {!loading &&
          payrollRows.map((p) => {
            const canPay = p.salary > 0 && p.sales > 0 && !paying[p.staffId];
            return (
              <article key={p.staffId} className="payroll__card">
                <div className="payroll__card-left">
                  <div className="payroll__avatar">
                    <FaMoneyBillWave />
                  </div>
                  <div>
                    <h3 className="payroll__name">{p.staff}</h3>
                    <div className="payroll__meta">
                      <span className="payroll__muted">Месяц: {p.month}</span>
                      {p.role && (
                        <span className="payroll__muted">Роль: {p.role}</span>
                      )}
                      <span className="payroll__muted">
                        Заказов: {p.ordersCount}
                      </span>
                      <span className="payroll__muted">
                        Выручка: {fmtMoney(p.sales)} сом
                      </span>
                      <span className="payroll__muted">
                        <b>Зарплата: {fmtMoney(p.salary)} сом</b>
                      </span>

                      {(p.paidOrders > 0 || p.paidSales > 0) && (
                        <span
                          className="payroll__paidBadge"
                          title="Уже выплачено за этот месяц"
                        >
                          выплачено: {p.paidOrders} / {fmtMoney(p.paidSales)} /{" "}
                          {fmtMoney(p.paidSalary)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="payroll__actionsRight">
                  <button
                    className="payroll__btn"
                    disabled={!canPay}
                    onClick={() => handlePay(p)}
                    title={
                      canPay
                        ? "Выплатить остаток за месяц"
                        : "Нет остатка к выплате"
                    }
                  >
                    <FaCheckCircle /> Оплатить
                  </button>
                </div>
              </article>
            );
          })}

        {!loading && payrollRows.length === 0 && (
          <div className="payroll__alert">Нет данных за выбранный месяц.</div>
        )}
      </div>
    </section>
  );
}
