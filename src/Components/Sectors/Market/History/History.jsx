import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import "./History.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const pickDate = (row) => row.paid_at || row.created_at || null;

export default function MarketHistory() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // фильтры
  const [status, setStatus] = useState(""); // "" = все
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // модалка деталей
  const [openId, setOpenId] = useState(null);

  const load = async (url = null) => {
    try {
      setErr("");
      setLoading(true);

      let resp;
      if (url) {
        resp = await api.get(url);
      } else {
        const q = new URLSearchParams();
        if (status) q.set("status", status);
        if (start) q.set("start", start);
        if (end) q.set("end", end);
        resp = await api.get(
          `/main/pos/sales/${q.toString() ? `?${q.toString()}` : ""}`
        );
      }

      const data = resp.data || {};
      const list = asArray(data);

      const mapped = list.map((r) => ({
        id: r.id,
        status: r.status || "new",
        subtotal: Number(r.subtotal) || 0,
        discount: Number(r.discount_total) || 0,
        tax: Number(r.tax_total) || 0,
        total: Number(r.total) || 0,
        createdAt: pickDate(r),
        user: r.user_display || "—",
      }));

      if (url) {
        setRows((prev) => [...prev, ...mapped]);
      } else {
        setRows(mapped);
      }
      setCount(Number(data.count || mapped.length));
      setNextUrl(data.next || null);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить историю продаж");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // первичная загрузка
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(); // перезагрузка при смене фильтров
  }, [status, start, end]);

  const onOpen = (id) => setOpenId(id);
  const onClose = () => setOpenId(null);

  const totalSum = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.total) || 0), 0),
    [rows]
  );

  return (
    <section className="history">
      <header className="history__header">
        <div>
          <h2 className="history__title">История продаж</h2>
          <p className="history__subtitle">Список чеков и их содержимое</p>
        </div>

        <div className="history__filters">
          <label className="history__filter">
            <span className="history__filterLabel">Статус</span>
            <select
              className="history__input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Все</option>
              <option value="new">Новые</option>
              <option value="paid">Оплачено</option>
              <option value="canceled">Отменено</option>
            </select>
          </label>

          <label className="history__filter">
            <span className="history__filterLabel">С</span>
            <input
              type="date"
              className="history__input"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>

          <label className="history__filter">
            <span className="history__filterLabel">По</span>
            <input
              type="date"
              className="history__input"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>

          <button
            className="history__btn history__btn--secondary"
            onClick={() => load()}
            disabled={loading}
          >
            Обновить
          </button>
        </div>
      </header>

      {err && <div className="history__error">{err}</div>}

      <div className="history__tableWrap">
        <table className="history__table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Пользователь</th>
              <th>Статус</th>
              <th>Итого</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="history__empty" colSpan={6}>
                  Загрузка…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="ellipsis" title={r.createdAt || "—"}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                  <td>{r.user}</td>
                  <td>{r.status}</td>
                  <td>{fmtMoney(r.total)}</td>
                  <td className="ellipsis" title={r.id}></td>
                  <td>
                    <button
                      className="history__btn history__btn--primary"
                      onClick={() => onOpen(r.id)}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="history__empty" colSpan={6}>
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                <strong>Всего чеков:</strong> {count}
              </td>
              <td colSpan={3}>
                <strong>Сумма по странице:</strong> {fmtMoney(totalSum)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {nextUrl && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="history__btn"
            onClick={() => load(nextUrl)}
            disabled={loading}
          >
            Ещё
          </button>
        </div>
      )}

      {openId && <SaleModal id={openId} onClose={onClose} />}
    </section>
  );
}

/* ================== Modal with details ================== */
function SaleModal({ id, onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sale, setSale] = useState(null);

  const fmtMoney = (v) =>
    (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
    " с";

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
        createdAt: data.created_at || null,
        user: data.user_display || "—",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="history__modalOverlay" onClick={onClose}>
      <div className="history__modal" onClick={(e) => e.stopPropagation()}>
        <div className="history__modalHeader">
          <div className="history__modalTitle">
            Продажа #{(id || "").slice(0, 8)}…
          </div>
          <button
            className="history__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="history__skeletonRow">
            <div className="history__skeleton" />
            <div className="history__skeleton" />
            <div className="history__skeleton" />
          </div>
        ) : err ? (
          <div className="history__error">{err}</div>
        ) : sale ? (
          <>
            {/* Только создано, пользователь и итог */}
            <div className="history__meta">
              <div>
                <strong>Создано:</strong>{" "}
                {sale.createdAt
                  ? new Date(sale.createdAt).toLocaleString()
                  : "—"}
              </div>
              <div>
                <strong>Пользователь:</strong> {sale.user}
              </div>
              <div>
                <strong>Итого:</strong> {fmtMoney(sale.total)}
              </div>
            </div>

            <div className="history__tableWrap">
              <table className="history__table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Штрих-код</th>
                    <th>Кол-во</th>
                    <th>Цена</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.length ? (
                    sale.items.map((it) => (
                      <tr key={it.id}>
                        <td className="ellipsis" title={it.name}>
                          {it.name}
                        </td>
                        <td className="ellipsis" title={it.barcode || "—"}>
                          {it.barcode || "—"}
                        </td>
                        <td>{it.qty}</td>
                        <td>{fmtMoney(it.unit_price)}</td>
                        <td>{fmtMoney(it.line_total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="history__empty" colSpan={5}>
                        Позиции отсутствуют
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}></td>
                    <td>
                      <strong>Итого</strong>
                    </td>
                    <td>{fmtMoney(sale.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="history__modalFooter">
              <button
                className="history__btn history__btn--secondary"
                onClick={load}
              >
                Обновить
              </button>
              <button
                className="history__btn history__btn--primary"
                onClick={onClose}
              >
                Закрыть
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
