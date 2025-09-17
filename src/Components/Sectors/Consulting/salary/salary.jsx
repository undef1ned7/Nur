import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./salary.scss";
import { FaCalendarAlt, FaMoneyBill, FaSearch, FaTimes } from "react-icons/fa";

/* ===== localStorage keys ===== */
const LS_EMPLOYEES = "employees_v1";
const LS_SALES = "sales_v1";
const LS_PAYOUTS = "payouts_v1";

/* ===== helpers ===== */
const safeRead = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const val = JSON.parse(raw);
    return Array.isArray(val) ? val : fallback;
  } catch {
    return fallback;
  }
};
const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {/* ignore */}
};
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const monthStart = (date = new Date()) =>
  ymd(new Date(date.getFullYear(), date.getMonth(), 1));
const monthEnd = (date = new Date()) =>
  ymd(new Date(date.getFullYear(), date.getMonth() + 1, 0));
const money = (v) => (Number(v) || 0).toLocaleString() + " с";
const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ===== normalization ===== */
const normalizeEmployee = (e = {}) => ({
  id: e.id,
  email: e.email ?? "",
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  commission_percent: Number(e.commission_percent ?? 0) || 0,
});
const normalizeSaleLS = (s = {}) => ({
  id: s.id,
  employee: s.seller_id ?? null, // id сотрудника (из Sale)
  employee_name: s.seller_name ?? "",
  title: s.service_title ?? "",
  amount: Number(s.service_price ?? 0) || 0,
  seller_percent: Number(s.seller_percent ?? 0) || 0, // <— процент, зафиксированный при продаже
  created_at: s.created_at || null,
});
const normalizePayout = (p = {}) => ({
  id: p.id,
  employee: p.employee ?? null,
  amount: num(p.amount ?? 0),
  period_start: p.period_start || null,
  period_end: p.period_end || null,
  created_at: p.created_at || null,
  note: p.note ?? "",
});

const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

/* ===== Component ===== */
export default function ConsultingSalary() {
  /* filters */
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [q, setQ] = useState(""); // поиск по сотруднику

  /* data */
  const [employees, setEmployees] = useState([]);
  const [sales, setSales] = useState([]);
  const [payouts, setPayouts] = useState([]);

  /* ui */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* payout modal (индивидуальная) */
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutEmpId, setPayoutEmpId] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutSaving, setPayoutSaving] = useState(false);

  /* массовая выплата */
  const [bulkSaving, setBulkSaving] = useState(false);

  const inRange = (dateIso) => {
    if (!dateIso) return false;
    const d = ymd(dateIso);
    return (!from || d >= from) && (!to || d <= to);
  };

  /* ===== loaders (локальные) ===== */
  const loadEmployees = useCallback(() => {
    setEmployees(safeRead(LS_EMPLOYEES).map(normalizeEmployee));
  }, []);

  const loadSales = useCallback(() => {
    const list = safeRead(LS_SALES).map(normalizeSaleLS);
    setSales(list.filter((s) => inRange(s.created_at)));
  }, [from, to]);

  const loadPayouts = useCallback(() => {
    const all = safeRead(LS_PAYOUTS).map(normalizePayout);
    const filtered = all.filter(
      (p) => p.period_start === from && p.period_end === to
    );
    setPayouts(filtered);
  }, [from, to]);

  const loadAll = useCallback(() => {
    setLoading(true);
    setErr("");
    try {
      loadEmployees();
      loadSales();
      loadPayouts();
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить данные по зарплатам.");
    } finally {
      setLoading(false);
    }
  }, [loadEmployees, loadSales, loadPayouts]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* подписки на изменения */
  useEffect(() => {
    const onEmp = () => loadEmployees();
    const onSales = () => loadSales();
    const onPayouts = () => loadPayouts();
    window.addEventListener("employees:updated", onEmp);
    window.addEventListener("sales:updated", onSales);
    window.addEventListener("payouts:updated", onPayouts);
    const onStorage = (e) => {
      if (e.key === LS_EMPLOYEES) onEmp();
      if (e.key === LS_SALES) onSales();
      if (e.key === LS_PAYOUTS) onPayouts();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("employees:updated", onEmp);
      window.removeEventListener("sales:updated", onSales);
      window.removeEventListener("payouts:updated", onPayouts);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadEmployees, loadSales, loadPayouts]);

  /* индексы */
  const empById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), e));
    return m;
  }, [employees]);

  /* суммы выплат по сотруднику за период */
  const paidByEmp = useMemo(() => {
    const m = new Map();
    payouts.forEach((p) => {
      const key = String(p.employee);
      m.set(key, (m.get(key) || 0) + Number(p.amount || 0));
    });
    return m;
  }, [payouts]);

  /* агрегация по сотрудникам: комиссия из ПРОДАЖ (по seller_percent) */
  const summaryAll = useMemo(() => {
    const acc = new Map(); // id -> {emp, revenue, count, percentCurrent, commission, paid, toPay}
    for (const s of sales) {
      const id = String(s.employee || "");
      if (!id) continue;
      const emp = empById.get(id);

      // текущий процент сотрудника (инфо)
      const percentCurrent = emp ? Number(emp.commission_percent || 0) : 0;

      // процент, который применяем к продаже (зафиксированный в чеке)
      const percentForSale =
        s.seller_percent != null ? Number(s.seller_percent) : percentCurrent;

      const row = acc.get(id) || {
        emp,
        revenue: 0,
        count: 0,
        percentCurrent,
        commission: 0,
        paid: 0,
        toPay: 0,
      };
      row.revenue += Number(s.amount || 0);
      row.count += 1;
      row.commission += Number(s.amount || 0) * (Number(percentForSale) / 100);
      acc.set(id, row);
    }

    for (const [id, row] of acc) {
      row.commission = Math.round(row.commission * 100) / 100;
      row.paid = Math.round((paidByEmp.get(id) || 0) * 100) / 100;
      row.toPay = Math.max(0, Math.round((row.commission - row.paid) * 100) / 100);
    }

    return Array.from(acc.values()).sort(
      (a, b) => b.toPay - a.toPay || b.revenue - a.revenue
    );
  }, [sales, empById, paidByEmp]);

  /* фильтр по сотруднику */
  const summary = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return summaryAll;
    return summaryAll.filter((r) =>
      [fullName(r.emp), r.emp?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    );
  }, [summaryAll, q]);

  const totalToPay = useMemo(
    () => summaryAll.reduce((s, r) => s + (Number(r.toPay) || 0), 0),
    [summaryAll]
  );

  /* выплаты (локально) */
  const openPayout = (empId, defaultAmount) => {
    setPayoutEmpId(empId);
    setPayoutAmount(String((Number(defaultAmount) || 0).toFixed(2)));
    setPayoutNote("");
    setPayoutOpen(true);
  };

  const submitPayout = (e) => {
    e?.preventDefault?.();
    if (!payoutEmpId || payoutSaving) return;
    const amountNum = num(payoutAmount);
    if (!(amountNum > 0)) return alert("Введите сумму выплаты больше 0.");

    if (!window.confirm("Оплатить? Нажмите «OK», если уверены.")) return;

    setPayoutSaving(true);
    try {
      const all = safeRead(LS_PAYOUTS);
      const payout = {
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        employee: payoutEmpId,
        amount: Math.round(amountNum * 100) / 100,
        period_start: from,
        period_end: to,
        created_at: new Date().toISOString(),
        note: payoutNote || "",
      };
      const next = [payout, ...all];
      safeWrite(LS_PAYOUTS, next);
      setPayouts((prev) => [normalizePayout(payout), ...prev]);
      window.dispatchEvent(new Event("payouts:updated"));
      setPayoutOpen(false);
    } catch (e2) {
      console.error(e2);
      alert("Не удалось провести выплату.");
    } finally {
      setPayoutSaving(false);
    }
  };

  const submitBulkPayouts = () => {
    if (!totalToPay) return;
    if (!window.confirm(`Оплатить всем сотрудникам «К выплате» на сумму ${money(totalToPay)}?`))
      return;

    setBulkSaving(true);
    try {
      const all = safeRead(LS_PAYOUTS);
      const toAdd = [];
      for (const r of summaryAll) {
        const empId = r.emp?.id;
        const amount = Math.round((Number(r.toPay) || 0) * 100) / 100;
        if (!empId || !(amount > 0)) continue;
        toAdd.push({
          id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + empId,
          employee: empId,
          amount,
          period_start: from,
          period_end: to,
          created_at: new Date().toISOString(),
          note: "Массовая выплата",
        });
      }
      if (toAdd.length) {
        const next = [...toAdd, ...all];
        safeWrite(LS_PAYOUTS, next);
        setPayouts((prev) => [...toAdd.map(normalizePayout), ...prev]);
        window.dispatchEvent(new Event("payouts:updated"));
      }
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <section className="salary">
      <header className="salary__header">
        <div>
          <h2 className="salary__title">Зарплаты (проценты с продаж)</h2>
          <p className="salary__subtitle">Комиссии сотрудников за выбранный период</p>
        </div>

        <div className="salary__toolbar">
          <div className="salary__datePicker">
            <FaCalendarAlt className="salary__mutedIcon" />
            <input
              type="date"
              className="salary__input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="salary__dash">—</span>
            <input
              type="date"
              className="salary__input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="salary__search">
            <FaSearch className="salary__mutedIcon" />
            <input
              className="salary__input"
              placeholder="Поиск по сотруднику…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button className="salary__btn" onClick={loadAll} title="Обновить данные">
            Обновить
          </button>
        </div>
      </header>

      {loading && <div className="salary__alert">Загрузка…</div>}
      {!!err && <div className="salary__alert">{err}</div>}

      {!loading && (
        <>
          {/* Карточки сотрудников */}
          <div className="salary__cards">
            {summary.length ? (
              summary.map((r) => {
                const emp = r.emp || {};
                const initials =
                  (fullName(emp) || emp.email || "•").trim().charAt(0).toUpperCase();
                return (
                  <div className="salary__card" key={emp.id || Math.random()}>
                    <div className="salary__cardHead">
                      <div className="salary__avatar" aria-hidden>
                        {initials}
                      </div>
                      <div>
                        <div className="salary__empName">
                          {fullName(emp) || emp.email || "—"}
                        </div>
                        <div className="salary__empMeta">
                          {r.count} продаж • {money(r.revenue)}
                        </div>
                      </div>
                    </div>

                    <div className="salary__stats">
                      <div className="salary__stat">
                        <span>Текущий %</span>
                        <b>{r.percentCurrent}%</b>
                      </div>
                      <div className="salary__stat">
                        <span>Комиссия (из продаж)</span>
                        <b>{money(r.commission)}</b>
                      </div>
                      <div className="salary__stat">
                        <span>Выплачено</span>
                        <b>{money(r.paid)}</b>
                      </div>
                      <div className={`salary__stat ${r.toPay ? "is-due" : ""}`}>
                        <span>К выплате</span>
                        <b>{money(r.toPay)}</b>
                      </div>
                    </div>

                    <div className="salary__cardActions">
                      <button
                        className="salary__btn salary__btn--success"
                        onClick={() => openPayout(emp.id, r.toPay)}
                        disabled={!r.toPay}
                        title="Оформить выплату"
                      >
                        <FaMoneyBill /> Выплатить
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="salary__emptyCards">Нет данных за период</div>
            )}
          </div>

          {/* Итоговая панель */}
          <div className="salary__footer">
            <div className="salary__footerText">
              К выплате всего: <strong>{money(totalToPay)}</strong>
            </div>
            <button
              className="salary__btn salary__btn--success"
              onClick={submitBulkPayouts}
              disabled={!totalToPay || bulkSaving}
              title="Оплатить всем"
            >
              {bulkSaving ? "Оплата…" : "Оплатить"}
            </button>
          </div>
        </>
      )}

      {/* ===== payout modal ===== */}
      {payoutOpen && (
        <div
          className="salary__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !payoutSaving && setPayoutOpen(false)}
        >
          <div className="salary__modal" onClick={(e) => e.stopPropagation()}>
            <div className="salary__modalHeader">
              <h3 className="salary__modalTitle">Выплата сотруднику</h3>
              <button
                className="salary__iconBtn"
                onClick={() => !payoutSaving && setPayoutOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="salary__form" onSubmit={submitPayout} noValidate>
              <div className="salary__formGrid">
                <div className="salary__field">
                  <label className="salary__label">Сотрудник</label>
                  <input
                    className="salary__input"
                    value={
                      fullName(empById.get(String(payoutEmpId))) ||
                      empById.get(String(payoutEmpId))?.email ||
                      "—"
                    }
                    readOnly
                  />
                </div>
                <div className="salary__field">
                  <label className="salary__label">Период</label>
                  <div className="salary__period">
                    <input className="salary__input" value={from} readOnly />
                    <span>—</span>
                    <input className="salary__input" value={to} readOnly />
                  </div>
                </div>
                <div className="salary__field">
                  <label className="salary__label">Сумма, с</label>
                  <input
                    className="salary__input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="salary__field salary__field--full">
                  <label className="salary__label">Заметка</label>
                  <textarea
                    className="salary__input"
                    rows={3}
                    placeholder="Комментарий (необязательно)"
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="salary__formActions">
                <button
                  type="button"
                  className="salary__btn"
                  onClick={() => setPayoutOpen(false)}
                  disabled={payoutSaving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="salary__btn salary__btn--success"
                  disabled={payoutSaving}
                >
                  {payoutSaving ? "Проведение…" : "Провести выплату"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
