import { useState } from "react";
import { X } from "lucide-react";
import { adjustProductStock } from "../../../../api/warehouse";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "../../Market/Warehouse/Warehouse.scss";

const parseQty = (v) => Number(String(v ?? "").replace(",", ".").trim());

const formatQty = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
};

/**
 * Корректировка остатка товара: бэкенд создаёт и проводит документ INVENTORY
 * (POST /warehouse/products/{id}/stock-adjustment/).
 * Количество в карточке товара напрямую больше не редактируется —
 * иначе регистр остатков и карточка расходятся и товар «сам растёт».
 */
/** Монтируется только когда открыта — поля каждый раз начинаются с текущего остатка. */
const StockAdjustmentModal = ({ onClose, productId, productName, currentQty, unit, onAdjusted }) => {
  const [factQty, setFactQty] = useState(() =>
    currentQty != null && currentQty !== "" ? String(currentQty) : "",
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fact = parseQty(factQty);
  const current = parseQty(currentQty);
  const delta = Number.isFinite(fact) && Number.isFinite(current) ? fact - current : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (String(factQty).trim() === "" || !Number.isFinite(fact) || fact < 0) {
      setError("Укажите фактическое количество (0 или больше).");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await adjustProductStock(productId, {
        fact_qty: String(fact),
        comment: comment.trim() || undefined,
      });
      onAdjusted?.(result, fact);
    } catch (err) {
      console.error(err);
      setError(validateResErrors(err, "Не удалось провести корректировку остатка"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="warehouse-filter-overlay" onClick={submitting ? undefined : onClose} role="presentation">
      <div className="warehouse-filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Корректировка остатка</h3>
          <button
            className="warehouse-filter-modal__close"
            onClick={onClose}
            type="button"
            disabled={submitting}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        <p className="warehouse-filter-modal__subtitle">
          Будет создан и проведён документ «Инвентаризация» — изменение останется в истории движений.
        </p>
        <form className="warehouse-filter-modal__content" onSubmit={handleSubmit}>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Товар</label>
            <div style={{ fontWeight: 700 }}>{productName || "—"}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              Сейчас в учёте: {formatQty(currentQty)} {unit || "шт"}
            </div>
          </div>

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label" htmlFor="stock-adjustment-fact">
              Фактическое количество
            </label>
            <input
              id="stock-adjustment-fact"
              className="warehouse-filter-modal__select"
              type="text"
              inputMode="decimal"
              value={factQty}
              onChange={(e) => setFactQty(e.target.value)}
              disabled={submitting}
              autoFocus
              required
            />
            {delta != null && delta !== 0 && (
              <div
                style={{
                  fontSize: 13,
                  marginTop: 4,
                  color: delta > 0 ? "#15803d" : "#b91c1c",
                }}
              >
                {delta > 0 ? "Излишек" : "Недостача"}: {delta > 0 ? "+" : ""}
                {formatQty(delta)} {unit || "шт"}
              </div>
            )}
          </div>

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label" htmlFor="stock-adjustment-comment">
              Комментарий
            </label>
            <input
              id="stock-adjustment-comment"
              className="warehouse-filter-modal__select"
              type="text"
              value={comment}
              placeholder="Например: пересчёт на полке"
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                margin: "0 0 12px",
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div className="warehouse-filter-modal__footer">
            <button
              className="warehouse-filter-modal__apply-btn"
              type="submit"
              disabled={submitting || delta === 0}
              title={delta === 0 ? "Количество не изменилось" : undefined}
            >
              {submitting ? "Проводим..." : "Провести корректировку"}
            </button>
            <button
              className="warehouse-filter-modal__cancel-btn"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;
