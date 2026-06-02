import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { transferStockPartnership } from "../../../../../api/warehouse";
import {
  extractPartnershipError,
  getProductQty,
  warehouseLabel,
} from "../partnership/partnershipHelpers";
import "../../../Market/Warehouse/Warehouse.scss";
import "./StockPartnershipTransferModal.scss";

const formatQty = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(3) : "0.000";
};

const formatPrice = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const buildItemPayload = (productId, qtyNum) => ({
  product: String(productId),
  qty: formatQty(qtyNum),
  price: formatPrice(0),
  discount_percent: formatPrice(0),
  discount_amount: formatPrice(0),
});

const StockPartnershipTransferModal = ({
  mode = "receive",
  open,
  onClose,
  product,
  products,
  warehouseFromId,
  partnerCompanyName,
  targetWarehouses,
  onTransferred,
}) => {
  const isSend = mode === "send";

  const productsList = useMemo(() => {
    if (Array.isArray(products) && products.length > 0) return products;
    if (product) return [product];
    return [];
  }, [products, product]);

  const isMulti = productsList.length > 1;

  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [qtyByProductId, setQtyByProductId] = useState({});
  const [comment, setComment] = useState("межкомпанейское перемещение");
  const [submitting, setSubmitting] = useState(false);

  const singleProduct = productsList[0];
  const maxQty = useMemo(
    () => (singleProduct ? getProductQty(singleProduct) : 0),
    [singleProduct],
  );

  useEffect(() => {
    if (!open) return;

    setToWarehouseId("");
    setComment("межкомпанейское перемещение");
    setSubmitting(false);

    if (isMulti) {
      const initial = {};
      productsList.forEach((p) => {
        const available = getProductQty(p);
        initial[String(p.id)] = available > 0 ? formatQty(available) : "1.000";
      });
      setQtyByProductId(initial);
      setQty("");
    } else {
      setQty(maxQty > 0 ? formatQty(maxQty) : "1.000");
      setQtyByProductId({});
    }
  }, [open, productsList, isMulti, maxQty]);

  const validateAndBuildItems = () => {
    const items = [];

    if (isMulti) {
      for (const p of productsList) {
        const id = String(p.id);
        const available = getProductQty(p);
        const qtyNum = Number(String(qtyByProductId[id] ?? "").replace(",", "."));

        if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
          return { error: `Укажите корректное количество для «${p.name || "товара"}»` };
        }
        if (available > 0 && qtyNum > available) {
          return {
            error: `«${p.name}»: количество не может превышать остаток (${formatQty(available)})`,
          };
        }
        items.push(buildItemPayload(id, qtyNum));
      }
      return { items };
    }

    const qtyNum = Number(String(qty).replace(",", "."));
    if (!singleProduct?.id) {
      return { error: "Товар не выбран" };
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return { error: "Укажите корректное количество" };
    }
    if (maxQty > 0 && qtyNum > maxQty) {
      return { error: `Количество не может превышать остаток (${formatQty(maxQty)})` };
    }
    return { items: [buildItemPayload(singleProduct.id, qtyNum)] };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseFromId || !toWarehouseId) return;

    const { items, error } = validateAndBuildItems();
    if (error) {
      alert(error);
      return;
    }
    if (!items?.length) return;

    setSubmitting(true);
    try {
      await transferStockPartnership({
        warehouse_from: String(warehouseFromId),
        warehouse_to: String(toWarehouseId),
        comment: comment.trim() || undefined,
        items,
      });
      if (typeof onTransferred === "function") {
        onTransferred(mode, warehouseFromId);
      }
      onClose();
    } catch (err) {
      console.error("Stock partnership transfer error:", err);
      alert(`Не удалось переместить: ${extractPartnershipError(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const setMultiQty = (productId, value) => {
    setQtyByProductId((prev) => ({
      ...prev,
      [String(productId)]: value,
    }));
  };

  const fillAllMaxQty = () => {
    const next = {};
    productsList.forEach((p) => {
      const available = getProductQty(p);
      next[String(p.id)] = available > 0 ? formatQty(available) : "1.000";
    });
    setQtyByProductId(next);
  };

  if (!open) return null;

  const submitLabel = submitting
    ? "Перемещаем..."
    : isMulti
      ? isSend
        ? `Отправить ${productsList.length} позиций`
        : `Забрать ${productsList.length} позиций`
      : isSend
        ? "Передать"
        : "Забрать";

  return (
    <div className="warehouse-filter-overlay" onClick={onClose} role="presentation">
      <div
        className={`warehouse-filter-modal stock-partnership-transfer-modal ${isMulti ? "stock-partnership-transfer-modal--multi" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">
            {isMulti
              ? isSend
                ? "Массовая отправка партнёру"
                : "Массовое получение от партнёра"
              : isSend
                ? "Отправка партнёру"
                : "Получение от партнёра"}
          </h3>
          <button className="warehouse-filter-modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <p className="warehouse-filter-modal__subtitle">
          {isSend
            ? `С вашего склада партнёру «${partnerCompanyName || "—"}»`
            : `Из склада партнёра «${partnerCompanyName || "—"}» на ваш склад`}
        </p>

        {isMulti && (
          <p className="stock-partnership-transfer-modal__hint">
            Один документ перемещения на все выбранные позиции. Проверьте количество по каждой строке.
          </p>
        )}

        <form className="warehouse-filter-modal__content" onSubmit={handleSubmit}>
          {!isMulti ? (
            <>
              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Товар</label>
                <div style={{ fontWeight: 700 }}>{singleProduct?.name || "—"}</div>
                {singleProduct?.article && (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Артикул: {singleProduct.article}
                  </div>
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
                    Доступно: {formatQty(maxQty)} {singleProduct?.unit || ""}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="warehouse-filter-modal__section">
              <div className="stock-partnership-transfer-modal__items-header">
                <label className="warehouse-filter-modal__label">
                  Позиции ({productsList.length})
                </label>
                <button
                  type="button"
                  className="stock-partnership-transfer-modal__fill-max"
                  onClick={fillAllMaxQty}
                  disabled={submitting}
                >
                  Заполнить по остатку
                </button>
              </div>
              <div className="stock-partnership-transfer-modal__items">
                {productsList.map((p) => {
                  const available = getProductQty(p);
                  const id = String(p.id);
                  return (
                    <div key={id} className="stock-partnership-transfer-modal__item">
                      <div className="stock-partnership-transfer-modal__item-info">
                        <div className="stock-partnership-transfer-modal__item-name">
                          {p.name || "—"}
                        </div>
                        {p.article && (
                          <div className="stock-partnership-transfer-modal__item-meta">
                            Арт. {p.article}
                          </div>
                        )}
                        {available > 0 && (
                          <div className="stock-partnership-transfer-modal__item-meta">
                            Доступно: {formatQty(available)} {p.unit || ""}
                          </div>
                        )}
                      </div>
                      <input
                        className="warehouse-filter-modal__select stock-partnership-transfer-modal__qty-input"
                        type="text"
                        value={qtyByProductId[id] ?? ""}
                        onChange={(e) => setMultiQty(id, e.target.value)}
                        disabled={submitting}
                        aria-label={`Количество: ${p.name}`}
                        required
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">
              {isSend ? "Склад партнёра-получатель" : "Ваш склад-получатель"}
            </label>
            <select
              className="warehouse-filter-modal__select"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              disabled={submitting}
              required
            >
              <option value="">Выберите склад</option>
              {(targetWarehouses || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {warehouseLabel(w)}
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

          {isMulti && (
            <div className="stock-partnership-transfer-modal__summary">
              Будет создан <strong>один документ</strong> перемещения с{" "}
              <strong>{productsList.length}</strong>{" "}
              {productsList.length === 1
                ? "позицией"
                : productsList.length < 5
                  ? "позициями"
                  : "позициями"}
              .
            </div>
          )}

          <div className="warehouse-filter-modal__footer">
            <button
              className="warehouse-filter-modal__apply-btn"
              type="submit"
              disabled={submitting}
            >
              {submitLabel}
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
