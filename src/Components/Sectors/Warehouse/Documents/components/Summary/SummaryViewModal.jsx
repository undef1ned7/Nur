import React, { useEffect, useState } from "react";
import { X, FileText, Edit2, Trash2, RefreshCw } from "lucide-react";
import {
  getSummary,
  deleteSummary,
  regenerateSummary,
} from "../../../../../../api/warehouseSummaries";
import { useAlert, useConfirm } from "../../../../../../hooks/useDialog";
import { normalizeSummary, toNum } from "./summaryAggregation";
import SummaryPreviewModal from "./SummaryPreviewModal";
import "./Summary.scss";

const TYPE_LABEL = { general: "Общая", by_agents: "По агентам" };

const n2 = (v) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(v));
const nInt = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(toNum(v));
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d).slice(0, 10) : dt.toLocaleDateString("ru-RU");
};
const fmtDateTime = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? String(d)
    : `${dt.toLocaleDateString("ru-RU")} ${dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
};

const SummaryViewModal = ({ id, onClose, onEdit, onDeleted, onChanged }) => {
  const alert = useAlert();
  const confirm = useConfirm();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSummary(id);
      setSummary(normalizeSummary(data));
    } catch (e) {
      setError("Не удалось загрузить сводку");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = () => {
    confirm(`Удалить сводку «${summary?.name || ""}»?`, async (ok) => {
      if (!ok) return;
      setBusy(true);
      try {
        await deleteSummary(id);
        onDeleted?.(id);
      } catch (e) {
        alert("Не удалось удалить сводку", true);
      } finally {
        setBusy(false);
      }
    });
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const data = await regenerateSummary(id);
      setSummary(normalizeSummary(data));
      onChanged?.(data);
      alert("Сводка пересобрана");
    } catch (e) {
      alert("Не удалось пересобрать сводку", true);
    } finally {
      setBusy(false);
    }
  };

  const totals = summary?.totals || {};
  const products = summary?.products || [];
  const documents = summary?.documents || [];

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div
        className="summary-modal summary-modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="summary-modal__header">
          <h2 className="summary-modal__title">
            {loading ? "Сводка…" : summary?.name || "Сводка"}
            {summary?.number ? (
              <span className="summary-modal__num"> № {summary.number}</span>
            ) : null}
          </h2>
          <button className="summary-modal__close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="summary-modal__body">
          {loading ? (
            <div className="summary-empty">Загрузка…</div>
          ) : error ? (
            <div className="summary-empty summary-empty--error">{error}</div>
          ) : (
            <>
              <div className="summary-meta">
                <div className="summary-meta__row">
                  <span>Дата</span>
                  <b>{fmtDate(summary.date)}</b>
                </div>
                <div className="summary-meta__row">
                  <span>Тип</span>
                  <b>{TYPE_LABEL[summary.type] || summary.type}</b>
                </div>
                <div className="summary-meta__row">
                  <span>Склад</span>
                  <b>{summary.warehouse?.name || "—"}</b>
                </div>
                <div className="summary-meta__row">
                  <span>Автор</span>
                  <b>{summary.created_by?.full_name || "—"}</b>
                </div>
                <div className="summary-meta__row">
                  <span>Создана</span>
                  <b>{fmtDateTime(summary.created_at)}</b>
                </div>
                {summary.type === "by_agents" && (
                  <div className="summary-meta__row summary-meta__row--full">
                    <span>Агенты</span>
                    <b>
                      {(summary.agents || [])
                        .map((a) => a.full_name || a.code || a.id)
                        .join(", ") || "—"}
                    </b>
                  </div>
                )}
                {!!summary.comment && (
                  <div className="summary-meta__row summary-meta__row--full">
                    <span>Комментарий</span>
                    <b>{summary.comment}</b>
                  </div>
                )}
              </div>

              {/* Итоги */}
              <div className="summary-totals">
                <div className="summary-totals__item">
                  <span>Накладных</span>
                  <b>{nInt(totals.documents_count)}</b>
                </div>
                <div className="summary-totals__item">
                  <span>Позиций</span>
                  <b>{nInt(totals.products_count)}</b>
                </div>
                <div className="summary-totals__item">
                  <span>Вес</span>
                  <b>{nInt(totals.total_weight)}</b>
                </div>
                <div className="summary-totals__item summary-totals__item--accent">
                  <span>Сумма</span>
                  <b>{n2(totals.total_amount)}</b>
                </div>
              </div>

              {/* Таблица товаров */}
              <h3 className="summary-tableTitle">Товары ({products.length})</h3>
              <div className="summary-tableWrap">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Номенклатура</th>
                      <th>Ед.</th>
                      <th>Кол-во</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Вес</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{p.name}</td>
                        <td>{p.unit}</td>
                        <td className="ar">{nInt(p.quantity)}</td>
                        <td className="ar">{n2(p.price)}</td>
                        <td className="ar">{n2(p.amount)}</td>
                        <td className="ar">{nInt(p.weight)}</td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={7} className="summary-table__empty">
                          Нет товаров
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Таблица накладных */}
              <h3 className="summary-tableTitle">Накладные ({documents.length})</h3>
              <div className="summary-tableWrap">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Номер</th>
                      <th>Дата</th>
                      <th>Агент</th>
                      <th>Контрагент</th>
                      <th>Кол-во</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d, i) => (
                      <tr key={d.id || i}>
                        <td>{i + 1}</td>
                        <td>{d.number}</td>
                        <td>{fmtDate(d.date)}</td>
                        <td>{d.agent}</td>
                        <td>{d.client}</td>
                        <td className="ar">{nInt(d.quantity)}</td>
                        <td className="ar">{n2(d.amount)}</td>
                      </tr>
                    ))}
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan={7} className="summary-table__empty">
                          Нет накладных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {!loading && !error && (
          <div className="summary-modal__footer summary-modal__footer--spread">
            <div className="summary-actions">
              <button
                className="summary-btn summary-btn--ghost"
                onClick={() => onEdit?.(summary)}
                disabled={busy}
              >
                <Edit2 size={16} /> Изменить
              </button>
              <button
                className="summary-btn summary-btn--ghost"
                onClick={handleRegenerate}
                disabled={busy}
              >
                <RefreshCw size={16} /> Пересобрать
              </button>
              <button
                className="summary-btn summary-btn--danger"
                onClick={handleDelete}
                disabled={busy}
              >
                <Trash2 size={16} /> Удалить
              </button>
            </div>
            <button
              className="summary-btn summary-btn--primary"
              onClick={() => setShowPdf(true)}
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        )}
      </div>

      {showPdf && summary && (
        <SummaryPreviewModal summary={summary} onClose={() => setShowPdf(false)} />
      )}
    </div>
  );
};

export default SummaryViewModal;
