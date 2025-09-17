// src/components/Analytics/Analytics.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import "./Analytics.scss";

/* ===== helpers ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

const inRange = (iso, start, end) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const sMin = start ? new Date(start).setHours(0, 0, 0, 0) : -Infinity;
  const eMax = end ? new Date(end).setHours(23, 59, 59, 999) : Infinity;
  return t >= sMin && t <= eMax;
};

/* ===== нормализация ===== */
const normalizeIncome = (x) => ({
  id: x.id || x.uuid || x.sale_id || String(Math.random()),
  created_at:
    x.paid_at || x.created_at || x.created || x.timestamp || x.date || "",
  amount: num(x.total ?? x.amount ?? x.sum ?? 0),
  items_count: Number(
    x.items_count ??
      x.qty ??
      (Array.isArray(x.items)
        ? x.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
        : 0)
  ),
  status: x.status || x.state || "",
});

/* ====== модалка деталей продажи ====== */
function SaleModal({ id, onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sale, setSale] = useState(null);

  const load = async () => {
    try {
      setErr("");
      setLoading(true);
      const { data } = await api.get(`/main/pos/sales/${id}/`);
      const items = Array.isArray(data.items)
        ? data.items.map((it, i) => {
            const unit = Number(it.unit_price) || 0;
            const qty = Number(it.quantity) || 0;
            const line = Number(it.line_total ?? unit * qty) || 0;
            return {
              id: it.id || String(i),
              name: it.product_name || it.name_snapshot || "—",
              barcode: it.barcode_snapshot || it.barcode || "",
              qty,
              unit_price: unit,
              line_total: line,
            };
          })
        : [];
      setSale({
        id: data.id,
        createdAt: data.created_at || data.paid_at || null,
        total: Number(data.total) || 0,
        items,
      });
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить детали продажи");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 96vw)",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,.12)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            Продажа #{(id || "").slice(0, 8)}…
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{ fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="analytics__skeletonRow">
            <div className="analytics__skeleton" />
            <div className="analytics__skeleton" />
            <div className="analytics__skeleton" />
          </div>
        ) : err ? (
          <div className="analytics__error">{err}</div>
        ) : sale ? (
          <>
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div>
                <b>Создано:</b>{" "}
                {sale.createdAt
                  ? new Date(sale.createdAt).toLocaleString()
                  : "—"}
              </div>
              <div>
                <b>Итого:</b> {fmtMoney(sale.total)}
              </div>
            </div>

            <div className="analytics__panel">
              <div className="table">
                <div className="table__head">
                  <span>Товар</span>
                  <span>Штрих-код</span>
                  <span>Сумма</span>
                </div>
                <div className="table__body">
                  {sale.items.length ? (
                    sale.items.map((it) => (
                      <div key={it.id} className="table__row">
                        <span className="ellipsis" title={it.name}>
                          {it.name} • {it.qty} шт × {fmtMoney(it.unit_price)}
                        </span>
                        <span className="ellipsis" title={it.barcode || "—"}>
                          {it.barcode || "—"}
                        </span>
                        <span>{fmtMoney(it.line_total)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="table__empty">Позиции отсутствуют</div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                className="analytics__btn analytics__btn--secondary"
                onClick={load}
              >
                Обновить
              </button>
              <button className="analytics__btn" onClick={onClose}>
                Закрыть
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ===== основной компонент ===== */
export default function MarketAnalytics() {
  const [status, setStatus] = useState(""); // статус чеков: '', new, paid, canceled
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [incomes, setIncomes] = useState([]);
  const [openId, setOpenId] = useState(null);

  // загрузка только ПРИХОДА
  const load = async () => {
    try {
      setLoading(true);
      setErr("");

      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (from) q.set("start", from);
      if (to) q.set("end", to);

      let incomeRaw = [];
      try {
        const { data } = await api.get(
          `/main/pos/sales/${q.toString() ? `?${q}` : ""}`
        );
        incomeRaw = asArray(data);
      } catch {
        const { data } = await api.get("/main/pos/sales/");
        incomeRaw = asArray(data);
      }

      setIncomes(incomeRaw.map(normalizeIncome));
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить приход");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // фильтрация по датам/статусу (дополнительно к серверному фильтру)
  const incomesFiltered = useMemo(
    () =>
      incomes.filter(
        (x) =>
          inRange(x.created_at, from, to) &&
          (status ? x.status === status : true)
      ),
    [incomes, from, to, status]
  );

  // сводка
  const totals = useMemo(() => {
    const incSum = incomesFiltered.reduce((s, x) => s + num(x.amount), 0);
    const count = incomesFiltered.length;
    const avg = count ? Math.round(incSum / count) : 0;
    return { incSum, count, avg };
  }, [incomesFiltered]);

  return (
    <section className="analytics">
      {/* Заголовок + фильтры */}
      <header className="analytics__header">
        <div>
          <h2 className="analytics__title">Аналитика</h2>
          <p className="analytics__subtitle">
            Приход (чеки) за выбранный период
          </p>
        </div>

        <div className="analytics__actions" style={{ flexWrap: "wrap" }}>
          <select
            className="analytics__select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            title="Статус чеков"
          >
            <option value="">Все</option>
            <option value="new">Новые</option>
            <option value="paid">Оплачено</option>
            <option value="canceled">Отменено</option>
          </select>

          <input
            type="date"
            className="analytics__select"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            title="С"
          />
          <input
            type="date"
            className="analytics__select"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            title="По"
          />

          <button
            className="analytics__btn analytics__btn--secondary"
            onClick={load}
            disabled={loading}
          >
            Обновить
          </button>
        </div>
      </header>

      {err && <div className="analytics__error">{err}</div>}

      {/* Сводка (только приход) */}
      {loading ? (
        <div className="analytics__skeletonRow">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="analytics__skeleton" />
          ))}
        </div>
      ) : (
        <div className="analytics__summary">
          <div className="analytics__card">
            <div className="analytics__value">{fmtMoney(totals.incSum)}</div>
            <div className="analytics__label">Приход</div>
          </div>
          <div className="analytics__card">
            <div className="analytics__value">{totals.count}</div>
            <div className="analytics__label">Чеков</div>
          </div>
          <div className="analytics__card">
            <div className="analytics__value">{fmtMoney(totals.avg)}</div>
            <div className="analytics__label">Средний чек</div>
          </div>
        </div>
      )}

      {/* Список: Приход (чеки) */}
      <section className="analytics__panel">
        <div className="analytics__head">Приход (чеки)</div>
        <div className="table">
          <div className="table__head">
            <span>Дата</span>
            <span>Кол-во</span>
            <span>Сумма</span>
          </div>
          <div className="table__body">
            {loading ? (
              <div className="table__empty">Загрузка…</div>
            ) : incomesFiltered.length ? (
              incomesFiltered.map((r) => (
                <div
                  key={r.id}
                  className="table__row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(r.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" ? setOpenId(r.id) : null
                  }
                  style={{ cursor: "pointer" }}
                  title="Открыть детали"
                >
                  <span className="ellipsis" title={r.created_at || "—"}>
                    {r.created_at ? fmtDateTime(r.created_at) : "—"}
                  </span>
                  <span>{r.items_count || 0}</span>
                  <span>{fmtMoney(r.amount)}</span>
                </div>
              ))
            ) : (
              <div className="table__empty">Нет данных</div>
            )}
          </div>
        </div>
      </section>

      {openId && <SaleModal id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}
