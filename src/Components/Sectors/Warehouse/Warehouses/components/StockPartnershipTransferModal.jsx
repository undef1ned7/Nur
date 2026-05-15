import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { transferStockPartnership } from "../../../../../api/warehouse";
import "../../../Market/Warehouse/Warehouse.scss";

const formatQty = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(3) : "0.000";
};

const formatPrice = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const extractErrorMessage = (err) => {
  if (!err) return "Неизвестная ошибка";
  if (typeof err === "string") return err;
  if (err.detail) return String(err.detail);
  if (err.warehouse) return String(err.warehouse);
  const parts = Object.entries(err).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join("; ") : JSON.stringify(err);
};

const StockPartnershipTransferModal = ({
  open,
  onClose,
  product,
  warehouseFromId,
  partnerCompanyName,
  ownWarehouses,
  onTransferred,
}) => {
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [comment, setComment] = useState("межкомпанейское перемещение");
  const [submitting, setSubmitting] = useState(false);

  const maxQty = useMemo(() => {
    const n = Number(String(product?.qty ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [product?.qty]);

  useEffect(() => {
    if (!open) return;
    setToWarehouseId("");
    setQty(product?.qty ? formatQty(product.qty) : "1.000");
    setComment("межкомпанейское перемещение");
    setSubmitting(false);
  }, [open, product]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product?.id || !warehouseFromId || !toWarehouseId) return;

    const qtyNum = Number(String(qty).replace(",", "."));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      alert("Укажите корректное количество");
      return;
    }
    if (maxQty > 0 && qtyNum > maxQty) {
      alert(`Количество не может превышать остаток (${formatQty(maxQty)})`);
      return;
    }

    setSubmitting(true);
    try {
      await transferStockPartnership({
        warehouse_from: String(warehouseFromId),
        warehouse_to: String(toWarehouseId),
        comment: comment.trim() || undefined,
        items: [
          {
            product: String(product.id),
            qty: formatQty(qtyNum),
            price: formatPrice(0),
            discount_percent: formatPrice(0),
            discount_amount: formatPrice(0),
          },
        ],
      });
      if (typeof onTransferred === "function") onTransferred();
      onClose();
    } catch (error) {
      console.error("Stock partnership transfer error:", error);
      alert(`Не удалось переместить: ${extractErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="warehouse-filter-overlay" onClick={onClose} role="presentation">
      <div className="warehouse-filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Перемещение от партнёра</h3>
          <button className="warehouse-filter-modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <p className="warehouse-filter-modal__subtitle">
          Из склада партнёра «{partnerCompanyName || "—"}» на ваш склад
        </p>
        <form className="warehouse-filter-modal__content" onSubmit={handleSubmit}>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Товар</label>
            <div style={{ fontWeight: 700 }}>{product?.name || "—"}</div>
            {product?.article && (
              <div style={{ fontSize: 13, color: "#6b7280" }}>Артикул: {product.article}</div>
            )}
          </div>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Количество</label>
            <input
              className="warehouse-filter-modal__select"
              type="text"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={submitting}
              required
            />
            {maxQty > 0 && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Доступно: {formatQty(maxQty)} {product?.unit || ""}
              </div>
            )}
          </div>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Ваш склад-получатель</label>
            <select
              className="warehouse-filter-modal__select"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              disabled={submitting}
              required
            >
              <option value="">Выберите склад</option>
              {(ownWarehouses || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.title || `Склад #${w.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Комментарий</label>
            <input
              className="warehouse-filter-modal__select"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="warehouse-filter-modal__footer">
            <button className="warehouse-filter-modal__apply-btn" type="submit" disabled={submitting}>
              {submitting ? "Перемещаем..." : "Переместить"}
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

export default StockPartnershipTransferModal;
