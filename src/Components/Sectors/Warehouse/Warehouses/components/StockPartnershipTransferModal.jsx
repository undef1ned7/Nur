import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { transferStockPartnership } from "../../../../../api/warehouse";
import { useAlert } from "../../../../../hooks/useDialog";
import {
  PULL_MODE_HINT,
  extractPartnershipError,
  formatQty,
  getProductQty,
  isPendingOperationResponse,
  pluralRu,
  transferItemPrice,
  warehouseLabel,
} from "../partnership/partnershipHelpers";
import "../../../Market/Warehouse/Warehouse.scss";
import "./StockPartnershipTransferModal.scss";

const DEFAULT_COMMENT = "Межкомпанейское перемещение";

const buildItemPayload = (product, qtyNum) => ({
  product: String(product.id),
  qty: formatQty(qtyNum),
  price: transferItemPrice(product),
  discount_percent: "0.00",
  discount_amount: "0.00",
});

const initialQty = (product) => {
  const available = getProductQty(product);
  return available > 0 ? formatQty(available) : "1.000";
};

const parseQty = (value) => Number(String(value ?? "").replace(",", "."));

const POSITIONS = ["позицию", "позиции", "позиций"];

/**
 * Перемещение товара между складами компаний-партнёров.
 * Монтируется только в открытом состоянии: начальные значения формы
 * считаются один раз из переданных товаров.
 *
 * mode "send"    — со своего склада на склад партнёра (проводится сразу);
 * mode "receive" — со склада партнёра на свой (см. pullMode).
 */
const StockPartnershipTransferModal = ({
  mode = "receive",
  onClose,
  product,
  products,
  warehouseFromId,
  partnerCompanyName,
  targetWarehouses,
  pullMode = "legacy",
  onTransferred,
}) => {
  const alert = useAlert();
  const isSend = mode === "send";

  const productsList = useMemo(() => {
    if (Array.isArray(products) && products.length > 0) return products;
    if (product) return [product];
    return [];
  }, [products, product]);

  const isMulti = productsList.length > 1;
  const count = productsList.length;

  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qtyByProductId, setQtyByProductId] = useState(() => {
    const initial = {};
    productsList.forEach((p) => {
      initial[String(p.id)] = initialQty(p);
    });
    return initial;
  });
  const [comment, setComment] = useState(DEFAULT_COMMENT);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (!submitting) onClose();
  };

  const validateAndBuildItems = () => {
    if (count === 0) return { error: "Товар не выбран" };
    const items = [];
    for (const p of productsList) {
      const id = String(p.id);
      const available = getProductQty(p);
      const qtyNum = parseQty(qtyByProductId[id]);
      const label = p.name || "товара";
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return { error: `Укажите корректное количество для «${label}»` };
      }
      if (available > 0 && qtyNum > available) {
        return {
          error: `«${label}»: количество не может превышать остаток (${formatQty(available)})`,
        };
      }
      items.push(buildItemPayload(p, qtyNum));
    }
    return { items };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!warehouseFromId) {
      alert("Не выбран склад-источник", true);
      return;
    }
    if (!toWarehouseId) {
      alert("Выберите склад-получатель", true);
      return;
    }

    const { items, error } = validateAndBuildItems();
    if (error) {
      alert(error, true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await transferStockPartnership({
        warehouse_from: String(warehouseFromId),
        warehouse_to: String(toWarehouseId),
        comment: comment.trim() || undefined,
        items,
      });
      const pending = isPendingOperationResponse(result);
      alert(
        pending
          ? `Запрос отправлен «${partnerCompanyName || "партнёру"}». Товар поступит на ваш склад после подтверждения партнёром.`
          : "Перемещение проведено",
      );
      onTransferred?.(mode, warehouseFromId, { pending });
      onClose();
    } catch (err) {
      console.error("Stock partnership transfer error:", err);
      alert(`Не удалось переместить: ${extractPartnershipError(err)}`, true);
    } finally {
      setSubmitting(false);
    }
  };

  const setQty = (productId, value) => {
    setQtyByProductId((prev) => ({ ...prev, [String(productId)]: value }));
  };

  const fillAllMaxQty = () => {
    const next = {};
    productsList.forEach((p) => {
      next[String(p.id)] = initialQty(p);
    });
    setQtyByProductId(next);
  };

  const actionVerb = isSend ? "Отправить" : pullMode === "confirm" ? "Запросить" : "Забрать";
  const submitLabel = submitting
    ? "Отправляем..."
    : isMulti
      ? `${actionVerb} ${count} ${pluralRu(count, POSITIONS)}`
      : actionVerb;

  const title = isSend
    ? isMulti
      ? "Массовая отправка партнёру"
      : "Отправка партнёру"
    : isMulti
      ? "Массовое получение от партнёра"
      : "Получение от партнёра";

  const singleProduct = productsList[0];
  const singleAvailable = singleProduct ? getProductQty(singleProduct) : 0;

  return (
    <div className="warehouse-filter-overlay" onClick={close} role="presentation">
      <div
        className={`warehouse-filter-modal stock-partnership-transfer-modal ${isMulti ? "stock-partnership-transfer-modal--multi" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">{title}</h3>
          <button
            className="warehouse-filter-modal__close"
            onClick={close}
            type="button"
            disabled={submitting}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        <p className="warehouse-filter-modal__subtitle">
          {isSend
            ? `С вашего склада партнёру «${partnerCompanyName || "—"}»`
            : `Со склада партнёра «${partnerCompanyName || "—"}» на ваш склад`}
        </p>

        {!isSend && (
          <div
            className={`stock-partnership-transfer-modal__hint ${pullMode === "legacy" ? "stock-partnership-transfer-modal__hint--warning" : ""}`}
          >
            {PULL_MODE_HINT[pullMode] || PULL_MODE_HINT.legacy}
          </div>
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
                <label className="warehouse-filter-modal__label" htmlFor="partner-transfer-qty">
                  Количество
                </label>
                <input
                  id="partner-transfer-qty"
                  className="warehouse-filter-modal__select"
                  type="text"
                  inputMode="decimal"
                  value={qtyByProductId[String(singleProduct?.id)] ?? ""}
                  onChange={(e) => setQty(singleProduct?.id, e.target.value)}
                  disabled={submitting}
                  required
                />
                {singleAvailable > 0 && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Доступно: {formatQty(singleAvailable)} {singleProduct?.unit || ""}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="warehouse-filter-modal__section">
              <div className="stock-partnership-transfer-modal__items-header">
                <label className="warehouse-filter-modal__label">
                  Позиции ({count})
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
                        inputMode="decimal"
                        value={qtyByProductId[id] ?? ""}
                        onChange={(e) => setQty(id, e.target.value)}
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
            <label className="warehouse-filter-modal__label" htmlFor="partner-transfer-to">
              {isSend ? "Склад партнёра-получатель" : "Ваш склад-получатель"}
            </label>
            <select
              id="partner-transfer-to"
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
            <label className="warehouse-filter-modal__label" htmlFor="partner-transfer-comment">
              Комментарий
            </label>
            <input
              id="partner-transfer-comment"
              className="warehouse-filter-modal__select"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
            />
          </div>

          {isMulti && (
            <div className="stock-partnership-transfer-modal__summary">
              Будет создан <strong>один документ</strong> перемещения на{" "}
              <strong>{count}</strong> {pluralRu(count, POSITIONS)}.
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
              onClick={close}
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
