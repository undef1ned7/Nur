// src/components/Reports/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaChartLine, FaPrint, FaFilter, FaSync, FaTimes } from "react-icons/fa";
import api from "../../../../api";
import "./reports.scss";

/* ────────── helpers ────────── */
const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmtInt = (n) => new Intl.NumberFormat("ru-RU").format(Number(n) || 0);
const fmtMoney0 = (n) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.round(Number(n) || 0)) + " KGS";
const fmt2 = (n) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n) || 0);

const parseISO = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const keyBy = (date, g) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (g === "day") return `${y}-${m}-${d}`;
  if (g === "year") return `${y}`;
  return `${y}-${m}`;
};
const inRange = (iso, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const from = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : -Infinity;
  const to = toStr ? new Date(`${toStr}T23:59:59.999`).getTime() : +Infinity;
  return t >= from && t <= to;
};
const RU_MONTHS = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const ymLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${RU_MONTHS[(m || 1) - 1]} ${y}`;
};

/* tiny sparkline */
const Sparkline = ({ values = [], width = 520, height = 140 }) => {
  if (!values.length) return <div className="reports__sparkEmpty">.</div>;
  const pad = 8;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = pad + (i * W) / Math.max(1, values.length - 1);
    const ratio = max === min ? 0.5 : (v - min) / (max - min);
    const y = pad + (1 - ratio) * H;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  return (
    <svg className="reports__spark" viewBox={`0 0 ${width} ${height}`} role="img">
      <polyline fill="none" stroke="var(--c-border)" strokeWidth="1"
        points={`${pad},${height - pad} ${width - pad},${height - pad}`} />
      <path d={d} fill="none" stroke="var(--c-primary)" strokeWidth="2" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="var(--c-primary)" />)}
    </svg>
  );
};

/* ────────── универсальный пейджер ────────── */
async function readAllPages(url) {
  let acc = [];
  let guard = 0;
  while (url && guard < 120) {
    const r = await api.get(url);
    const data = r?.data;
    if (Array.isArray(data)) { acc = acc.concat(data); break; }
    const chunk = data?.results || [];
    acc = acc.concat(Array.isArray(chunk) ? chunk : []);
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

/* источники */
async function tryFetchSalesPages() {
  const eps = [
    "/main/pos/receipts/","/main/pos/sales/receipts/","/main/pos/sales/?status=completed",
    "/main/pos/sales/","/pos/receipts/","/sales/receipts/","/sales/"
  ];
  for (const ep of eps) { try { const rows = await readAllPages(ep); if (rows.length) return rows; } catch {} }
  return [];
}
async function tryFetchReceiptDetail({ id, number }) {
  const ids = [id, number].filter(Boolean);
  const bases = ["/main/pos/receipts/","/main/pos/sales/receipts/","/pos/receipts/","/sales/receipts/","/sales/"];
  for (const b of bases) for (const key of ids) {
    try { const r = await api.get(`${b}${encodeURIComponent(key)}/`); if (r?.data) return r.data; } catch {}
  }
  for (const key of ids) {
    try {
      const r = await api.get(`/main/pos/receipts/?number=${encodeURIComponent(key)}`);
      const list = r?.data?.results || r?.data || [];
      if (Array.isArray(list) && list.length) return list[0];
    } catch {}
  }
  return null;
}
async function tryFetchBookingsPages() {
  const eps = ["/booking/booking/history/","/bookings/history/","/booking/history/"];
  for (const ep of eps) { try { const rows = await readAllPages(ep); if (rows.length) return rows; } catch {} }
  return [];
}

/* ────────── нормализация чека ────────── */
function normalizeReceiptShape(raw, fallback) {
  if (!raw && fallback) raw = fallback;
  const created =
    raw?.paid_at || raw?.closed_at || raw?.created_at || raw?.date || raw?.timestamp || null;
  const number =
    raw?.number || raw?.code || raw?.receipt_no || raw?.receipt_number || raw?.id || fallback?.number;

  const client =
    raw?.client?.name || raw?.customer?.name || raw?.client_name || raw?.customer_name || raw?.user_display || "Нет имени";

  let status = raw?.status || raw?.state || raw?.payment_status || "";
  if (!status) { const paid = raw?.paid ?? raw?.is_paid; status = paid === true ? "Оплачен" : "Новый"; }

  const paymentsRaw =
    raw?.payments || raw?.payment_list || (Array.isArray(raw?.payment) ? raw.payment : []) || [];
  const payments = Array.isArray(paymentsRaw)
    ? paymentsRaw.map((p, i) => ({
        id: p.id || i,
        method: p.method || p.type || p.name || (p.card ? "Карта" : p.cash ? "Наличные" : "Оплата"),
        amount: toNum(p.amount ?? p.sum ?? p.total ?? 0),
      }))
    : [];

  const linesRaw = raw?.items || raw?.lines || raw?.positions || [];
  const items = Array.isArray(linesRaw)
    ? linesRaw.map((l, i) => ({
        id: l.id || l.uuid || i,
        name: l.name || l.title || l.product_name || l.product?.name || "Позиция",
        qty: toNum(l.qty ?? l.quantity ?? l.count ?? 1),
        price: toNum(l.price ?? l.unit_price ?? l.cost ?? l.amount ?? 0),
        total: toNum(l.total ?? l.sum ?? (toNum(l.price ?? l.unit_price ?? l.amount) * toNum(l.qty ?? l.quantity ?? 1))),
      }))
    : [];

  const subtotal = items.reduce((s, it) => s + toNum(it.total), 0);
  const discount = Math.max(0, toNum(raw?.discount ?? raw?.discount_total ?? 0));
  const tax = Math.max(0, toNum(raw?.tax_total ?? raw?.tax ?? raw?.vat ?? 0));
  let total =
    toNum(raw?.total ?? raw?.grand_total ?? raw?.final_total ?? raw?.amount ?? 0) ||
    Math.max(0, subtotal - discount + tax);
  const change = toNum(raw?.change ?? raw?.change_amount ?? 0);

  return {
    id: raw?.id || raw?.uuid || number || "",
    number: String(number || ""),
    created_at: created,
    status: String(status || "Новый"),
    client: String(client || "Нет имени"),
    payments,
    items,
    subtotal,
    discount,
    tax,
    total,
    change,
  };
}

/* ────────── модалка чека ────────── */
const ReceiptSkeleton = ({ onClose }) => (
  <div className="reports__modal" role="dialog" aria-modal="true" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
    <div className="reports__modalCard reports__modalCard--receipt">
      <button className="reports__modalClose" onClick={onClose} aria-label="Закрыть"><FaTimes /></button>
      <div className="reports__receiptHead"><h3>Детали продажи</h3></div>
      <div className="reports__loader"><span className="reports__spinner" /> Загрузка чека…</div>
    </div>
  </div>
);

const ReceiptModal = ({ receipt, onClose }) => {
  if (!receipt) return null;
  return (
    <div className="reports__modal" role="dialog" aria-modal="true" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="reports__modalCard reports__modalCard--receipt">
        <button className="reports__modalClose" onClick={onClose} aria-label="Закрыть"><FaTimes /></button>

        <div className="reports__receiptHead"><h3>Детали продажи</h3></div>

        <div className="reports__receiptMeta">
          <div><strong>Клиент:</strong> {receipt.client || "—"}</div>
          <div><strong>Статус:</strong> {receipt.status || "—"}</div>
          <div><strong>Дата:</strong> {receipt.created_at ? new Date(receipt.created_at).toLocaleString() : "—"}</div>
        </div>

        <div className="reports__receiptList">
          {(receipt.items || []).map((it, idx) => (
            <div key={it.id ?? idx} className="reports__receiptRow">
              <div className="reports__receiptLeft">
                <span className="reports__receiptIndex">{idx + 1}.</span>
                <span className="reports__receiptName">{it.name}</span>
              </div>
              <div className="reports__receiptRight">
                <span>{fmt2(it.qty)} × {fmt2(it.price)} = <b>{fmt2(it.total)}</b></span>
              </div>
            </div>
          ))}
          {!receipt.items?.length && (
            <div className="reports__receiptRow"><div className="reports__receiptLeft">Нет позиций</div></div>
          )}
        </div>

        <div className="reports__receiptDots" />

        <div className="reports__receiptTotals">
          <div className="reports__receiptTotalLabel"><b>ИТОГО</b></div>
          <div className="reports__receiptTotalInfo">
            <span>Общая скидка {fmt2(receipt.discount)}</span>
            <span>Налог {fmt2(receipt.tax || 0)}</span>
            <span className="reports__receiptGrand">≡ {fmt2(receipt.total)}</span>
          </div>
        </div>

        {!!receipt.payments?.length && (
          <div className="reports__payments">
            <div className="reports__paymentsHead">Оплаты</div>
            <ul className="reports__paymentsList">
              {receipt.payments.map((p) => (
                <li key={p.id} className="reports__paymentsItem">
                  <span className="reports__pill">{String(p.method || "Оплата")}</span>
                  <span className="reports__paymentsAmount">{fmt2(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="reports__modalActions">
          <button className="reports__btn reports__btn--secondary" onClick={() => window.print()}><FaPrint /> Печать</button>
          <button className="reports__btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

/* ────────── компонент ────────── */
const Reports = () => {
  // tabs
  const [tab, setTab] = useState("report"); // report | sales | bookings

  // controls
  const [startDate, setStartDate] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [granularity, setGranularity] = useState("month"); // day | month | year
  const [boxId, setBoxId] = useState("all");

  // loading
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cashLoading, setCashLoading] = useState(false);

  // data
  const [sales, setSales] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [flows, setFlows] = useState([]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptDetail, setReceiptDetail] = useState(null);

  /* sales */
  const loadSales = async () => {
    setLoadingSales(true);
    try {
      const pages = await tryFetchSalesPages();
      const mapped = pages.map((x, i) => {
        const total = toNum(x.total ?? x.amount ?? x.sum ?? x.grand_total ?? x.final_total);
        const created = x.paid_at || x.closed_at || x.created_at || x.date || x.timestamp || null;
        const number = x.number || x.code || x.receipt_no || x.id || `#${i + 1}`;
        const clientName =
          x.client?.name || x.customer?.name || x.client_name || x.customer_name || x.user_display || "Нет имени";
        let status = x.status || x.state || x.payment_status;
        if (!status) { const paid = x.paid ?? x.is_paid; status = paid === true ? "Оплачен" : "Новый"; }
        return {
          id: x.id || x.uuid || `sale-${i}`,
          number: String(number),
          created_at: created,
          total,
          client_name: String(clientName),
          status: String(status || "Новый"),
          _raw: x
        };
      });
      setSales(mapped);
    } catch { setSales([]); }
    finally { setLoadingSales(false); }
  };

  /* bookings */
  const nightsBetween = (a, b) => {
    if (!a || !b) return 1;
    const ms = new Date(b) - new Date(a);
    const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
    return Math.max(1, d);
  };

  // ✅ Всегда показываем полный год (YYYY), никаких «25»
  const fmtPeriod = (from, to) => {
    if (!from && !to) return "—";
    const dd = (d) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return "";
      const day = String(dt.getDate()).padStart(2, "0");
      const mon = String(dt.getMonth() + 1).padStart(2, "0");
      const year = String(dt.getFullYear()); // полный год
      return `${day}.${mon}.${year}`;
    };
    if (from && to) return `${dd(from)}—${dd(to)}`;
    return dd(from || to);
  };

  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const acc = await tryFetchBookingsPages();
      const mapped = acc.map((h, i) => {
        const from = h.start_time || null;
        const to = h.end_time || null;
        const nights = nightsBetween(from, to);
        const price = toNum(h.target_price);
        const amount = Math.max(0, price * nights);
        const archivedAt = h.archived_at || h.end_time || h.start_time || h.created_at || null;
        return {
          id: h.id || h.uuid || `hist-${i}`,
          created_at: archivedAt,
          from, to, nights, price, amount,
          client_label: h.client_label || "",
          target_name: h.target_name || "",
          target_type: h.target_type || "",
          purpose: h.purpose || "",
          period_short: fmtPeriod(from, to), // ← краткий период с полным годом
        };
      });
      setBookings(mapped);
    } catch { setBookings([]); }
    finally { setLoadingBookings(false); }
  };

  /* cashboxes & flows */
  const listFrom = (r) => r?.data?.results || r?.data || [];
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/construction/cashboxes/", { params: { page_size: 1000 } });
        setBoxes(listFrom(res));
      } catch { setBoxes([]); }
    })();
  }, []);
  const loadFlows = async () => {
    setCashLoading(true);
    try {
      const params = { page_size: 1000 };
      if (boxId !== "all") params.cashbox = boxId;
      const r = await api.get("/construction/cashflows/", { params });
      const raw = listFrom(r) || [];
      const normalized = raw.map((x, i) => {
        const amt = toNum(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense") type = amt >= 0 ? "income" : "expense";
        const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
        const cashboxName = x.cashbox?.department_name || x.cashbox?.name || x.cashbox_name || null;
        return {
          id: x.id || x.uuid || `${i}`,
          type,
          amount: Math.abs(amt),
          title: x.title || x.name || x.description || x.note || (type === "income" ? "Приход" : "Расход"),
          created_at: x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
          cashboxId, cashboxName
        };
      });
      setFlows(normalized);
    } catch { setFlows([]); }
    finally { setCashLoading(false); }
  };
  useEffect(() => { loadFlows(); /* eslint-disable-next-line */ }, [boxId]);

  /* first load */
  useEffect(() => {
    loadSales();
    loadBookings();
  }, []);

  /* report aggregates */
  const inPeriod = (d) => inRange(d, startDate, endDate);
  const flowsFiltered = useMemo(() => flows.filter((f) => inPeriod(f.created_at)), [flows, startDate, endDate]);
  const cashTotals = useMemo(() => {
    let income = 0, expense = 0;
    for (const f of flowsFiltered) { if (f.type === "income") income += f.amount; else expense += f.amount; }
    return { income, expense, net: income - expense };
  }, [flowsFiltered]);

  const cashSeries = useMemo(() => {
    const inc = new Map(); const exp = new Map();
    for (const f of flowsFiltered) {
      const d = parseISO(f.created_at); if (!d) continue;
      const k = keyBy(d, granularity);
      if (f.type === "income") inc.set(k, toNum(inc.get(k)) + f.amount);
      else exp.set(k, toNum(exp.get(k)) + f.amount);
    }
    const keys = Array.from(new Set([...inc.keys(), ...exp.keys()])).sort();
    const incomeVals = keys.map((k) => Math.round(toNum(inc.get(k))));
    const expenseVals = keys.map((k) => Math.round(toNum(exp.get(k))));
    const netVals = keys.map((_, i) => Math.round(toNum(incomeVals[i]) - toNum(expenseVals[i])));
    const labels = keys.map((k) => (granularity === "month" ? ymLabel(k) : k));
    return { labels, incomeVals, expenseVals, netVals };
  }, [flowsFiltered, granularity]);

  const perBox = useMemo(() => {
    const map = new Map();
    for (const f of flowsFiltered) {
      const id = f.cashboxId || "—";
      const name =
        f.cashboxName ||
        boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
        boxes.find((b) => (b.id || b.uuid) === id)?.name ||
        "—";
      const cur = map.get(id) || { name, income: 0, expense: 0 };
      if (f.type === "income") cur.income += f.amount; else cur.expense += f.amount;
      map.set(id, cur);
    }
    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id, name: v.name, income: v.income, expense: v.expense, net: v.income - v.expense
    }));
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [flowsFiltered, boxes]);

  const topExpenseByTitle = useMemo(() => {
    const m = new Map();
    for (const f of flowsFiltered) {
      if (f.type !== "expense") continue;
      const key = (f.title || "Расход").toString();
      m.set(key, toNum(m.get(key)) + f.amount);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [flowsFiltered]);

  /* tables */
  const salesFiltered = useMemo(() => sales.filter((s) => inPeriod(s.created_at)), [sales, startDate, endDate]);
  const salesTable = useMemo(() => [...salesFiltered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), [salesFiltered]);
  const salesSummary = useMemo(() => ({
    amount: salesTable.reduce((s, r) => s + toNum(r.total), 0),
    ops: salesTable.length,
  }), [salesTable]);

  const bookingsFiltered = useMemo(() => bookings.filter((b) => inPeriod(b.created_at)), [bookings, startDate, endDate]);
  const bookingsTable = useMemo(() => [...bookingsFiltered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), [bookingsFiltered]);
  const bookingsSummary = useMemo(() => ({
    amount: bookingsTable.reduce((s, r) => s + toNum(r.amount), 0),
    ops: bookingsTable.length,
  }), [bookingsTable]);

  /* open receipt modal with waiting */
  const openReceipt = async (row) => {
    setModalOpen(true);
    setReceiptDetail(null);
    setLoadingReceipt(true);
    try {
      const raw = await tryFetchReceiptDetail({ id: row.id, number: row.number });
      setReceiptDetail(normalizeReceiptShape(raw, row._raw));
    } catch {
      setReceiptDetail(normalizeReceiptShape(null, row._raw));
    } finally { setLoadingReceipt(false); }
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="reports">
      {/* Tabs */}
      <div className="reports__tabs">
        <button className={`reports__tab ${tab === "report" ? "reports__tab--active" : ""}`} onClick={() => setTab("report")}>
          Отчёт (касса)
        </button>
        <button className={`reports__tab ${tab === "sales" ? "reports__tab--active" : ""}`} onClick={() => setTab("sales")}>
          История продаж
        </button>
        <button className={`reports__tab ${tab === "bookings" ? "reports__tab--active" : ""}`} onClick={() => setTab("bookings")}>
          История бронирований
        </button>
      </div>

      {/* Header */}
      <div className="reports__header">
        <div>
          <h2 className="reports__title"><FaChartLine /> {tab === "report" ? "Отчёт по кассе и потокам" : tab === "sales" ? "История продаж (чеки)" : "История бронирований"}</h2>
          <p className="reports__subtitle">
            {tab === "report" ? "Приход, расход и сальдо по выбранному периоду и кассе." :
             tab === "sales" ? "Клик по строке — откроется чек." :
             "Период всегда с полным годом: 15.09.2025—18.09.2025."}
          </p>
        </div>
        <div className="reports__actions">
          <button className="reports__btn reports__btn--secondary" onClick={() => window.print()}><FaPrint /> Печать</button>
          <button className="reports__btn reports__btn--secondary" onClick={() => { loadFlows(); loadSales(); loadBookings(); }} disabled={cashLoading || loadingSales || loadingBookings} title="Обновить">
            <FaSync /> Обновить
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="reports__controls">
        <div className="reports__presets">
          <button onClick={() => { const n = new Date(); const sd = new Date(n.getFullYear(), n.getMonth(), 1); const ed = new Date(n.getFullYear(), n.getMonth() + 1, 0); setStartDate(sd.toISOString().slice(0,10)); setEndDate(ed.toISOString().slice(0,10)); setGranularity("day"); }}>
            Этот месяц
          </button>
          <button onClick={() => { const n = new Date(); const sd = new Date(n.getFullYear(), n.getMonth()-1, 1); const ed = new Date(n.getFullYear(), n.getMonth(), 0); setStartDate(sd.toISOString().slice(0,10)); setEndDate(ed.toISOString().slice(0,10)); setGranularity("day"); }}>
            Прошлый месяц
          </button>
          <button onClick={() => { const n = new Date(); const sd = new Date(n.getFullYear(), 0, 1); setStartDate(sd.toISOString().slice(0,10)); setEndDate(new Date().toISOString().slice(0,10)); setGranularity("month"); }}>
            Год-к-дате
          </button>
          <button onClick={() => { const n = new Date(); const sd = new Date(n.getFullYear(), 0, 1); const ed = new Date(n.getFullYear(), 11, 31); setStartDate(sd.toISOString().slice(0,10)); setEndDate(ed.toISOString().slice(0,10)); setGranularity("month"); }}>
            Весь год
          </button>
        </div>

        <label className="reports__label">С
          <input type="date" className="reports__select" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="reports__label">До
          <input type="date" className="reports__select" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>

        <div className="reports__segmented">
          <button className={granularity === "day" ? "is-active" : ""} onClick={() => setGranularity("day")}>Дни</button>
          <button className={granularity === "month" ? "is-active" : ""} onClick={() => setGranularity("month")}>Месяцы</button>
          <button className={granularity === "year" ? "is-active" : ""} onClick={() => setGranularity("year")}>Годы</button>
        </div>

        <div className="reports__selectBox">
          <label className="reports__label">Касса
            <select className="reports__select" value={boxId} onChange={(e) => setBoxId(e.target.value)}>
              <option value="all">Все кассы</option>
              {boxes.map((b) => (
                <option key={b.id || b.uuid} value={b.id || b.uuid}>
                  {b.department_name || b.name || (b.id || b.uuid)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ===== REPORT ===== */}
      {tab === "report" && (
        <>
          <div className="reports__kpis reports__cardRow">
            <div className="reports__kpi">
              <div className="reports__kpiLabel">ПРИХОД</div>
              <div className="reports__kpiValue">{fmtMoney0(cashTotals.income)}</div>
            </div>
            <div className="reports__kpi">
              <div className="reports__kpiLabel">РАСХОД</div>
              <div className="reports__kpiValue">{fmtMoney0(cashTotals.expense)}</div>
            </div>
            <div className="reports__kpi">
              <div className="reports__kpiLabel">САЛЬДО</div>
              <div className={"reports__kpiValue " + (cashTotals.net < 0 ? "is-neg" : "")}>
                {fmtMoney0(cashTotals.net)}
              </div>
            </div>
          </div>

          <div className="reports__grid3">
            <div className="reports__card">
              <div className="reports__cardTitle">Динамика чистого потока ({granularity === "day" ? "дни" : granularity === "month" ? "месяцы" : "годы"})</div>
              <Sparkline values={cashSeries.netVals} />
              <div className="reports__legendRow">
                {cashSeries.labels.map((l, i) => <span className="reports__legendItem" key={i}>{l}</span>)}
              </div>
            </div>

            <div className="reports__card">
              <div className="reports__cardTitle">Срез по кассам</div>
              <div className="reports__tableWrap">
                <table className="reports__table">
                  <thead><tr><th>Касса</th><th>Приход</th><th>Расход</th><th>Сальдо</th></tr></thead>
                  <tbody>
                    {perBox.length ? perBox.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{fmtMoney0(r.income)}</td>
                        <td>{fmtMoney0(r.expense)}</td>
                        <td className={r.net < 0 ? "is-neg" : ""}>{fmtMoney0(r.net)}</td>
                      </tr>
                    )) : <tr><td colSpan={4} className="reports__empty">Нет данных</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="reports__card">
              <div className="reports__cardTitle">Топ-10 статей расхода</div>
              <ul className="reports__bars">
                {topExpenseByTitle.length ? topExpenseByTitle.map(([title, sum], i) => {
                  const max = topExpenseByTitle[0][1] || 1;
                  const width = clamp(Math.round((sum / max) * 100), 5, 100);
                  return (
                    <li className="reports__bar" key={i}>
                      <span className="reports__barName" title={title}>{title}</span>
                      <span className="reports__barTrack"><span className="reports__barFill" style={{ width: `${width}%` }} /></span>
                      <span className="reports__barValue">{fmtMoney0(sum)}</span>
                    </li>
                  );
                }) : <li className="reports__empty">Нет данных</li>}
              </ul>
            </div>
          </div>

          <div className="reports__card reports__card--scroll">
            <div className="reports__cardTitle">Последние операции</div>
            <div className="reports__tableWrap">
              <table className="reports__table">
                <thead><tr><th>Тип</th><th>Статья</th><th>Сумма</th><th>Касса</th><th>Дата</th></tr></thead>
                <tbody>
                  {cashLoading ? (
                    <tr><td colSpan={5} className="reports__empty">Загрузка…</td></tr>
                  ) : flowsFiltered.length ? (
                    flowsFiltered.slice().sort((a,b)=> (a.created_at < b.created_at ? 1 : -1)).slice(0, 80).map((f, i) => (
                      <tr key={f.id ?? i}>
                        <td>{f.type === "income" ? "Приход" : "Расход"}</td>
                        <td>{f.title}</td>
                        <td className={f.type === "expense" ? "is-neg" : ""}>{fmtMoney0(f.amount)}</td>
                        <td>{f.cashboxName || "—"}</td>
                        <td>{f.created_at ? new Date(f.created_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="reports__empty">Нет операций</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== SALES ===== */}
      {tab === "sales" && (
        <>
          <div className="reports__tableWrap">
            <table className="reports__table">
              <thead><tr><th>№</th><th>Клиент</th><th>Цена</th><th>Статус</th><th>Дата</th></tr></thead>
              <tbody>
                {salesTable.map((r, i) => (
                  <tr key={r.id} className="reports__rowClickable" onClick={() => openReceipt(r)} title="Открыть чек">
                    <td>{fmtInt(i + 1)}</td>
                    <td>{r.client_name || "Нет имени"}</td>
                    <td>{fmtMoney0(r.total)}</td>
                    <td>{r.status || "Новый"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {!salesTable.length && <tr><td className="reports__empty" colSpan={5}>Нет продаж за период</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={2}>Итого</td><td>{fmtMoney0(salesSummary.amount)}</td><td colSpan={2}>{fmtInt(salesSummary.ops)} чек(ов)</td></tr></tfoot>
            </table>
          </div>

          {modalOpen && (loadingReceipt || !receiptDetail)
            ? <ReceiptSkeleton onClose={() => { setModalOpen(false); setReceiptDetail(null); }} />
            : modalOpen && <ReceiptModal receipt={receiptDetail} onClose={() => { setModalOpen(false); setReceiptDetail(null); }} />
          }
        </>
      )}

      {/* ===== BOOKINGS ===== */}
      {tab === "bookings" && (
        <>
          <div className="reports__tableWrap reports__tableWrap--noX">
            <table className="reports__table">
              <thead>
                <tr>
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
                {bookingsTable.map((r) => (
                  <tr key={r.id}>
                    <td>{r.client_label || "—"}</td>
                    <td>{r.target_name || "—"}</td>
                    <td>{r.target_type || "—"}</td>
                    <td>{r.period_short}</td>
                    <td>{fmtInt(r.nights)}</td>
                    <td>{fmtMoney0(r.price)}</td>
                    <td>{fmtMoney0(r.amount)}</td>
                    <td>{r.purpose || "—"}</td>
                  </tr>
                ))}
                {!bookingsTable.length && <tr><td className="reports__empty" colSpan={8}>Нет записей за период</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={6}>Итого</td><td>{fmtMoney0(bookingsSummary.amount)}</td><td>{fmtInt(bookingsSummary.ops)} запис.</td></tr></tfoot>
            </table>
          </div>

          {loadingBookings && <div className="reports__alert">Загрузка броней…</div>}
        </>
      )}
    </section>
  );
};

export default Reports;
