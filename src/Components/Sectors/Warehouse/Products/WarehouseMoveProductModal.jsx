import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  getStockPartnerCatalog,
  listActiveStockPartners,
  transferStockPartnership,
  transferWarehouse,
} from "../../../../api/warehouse";
import { fetchWarehousesAsync } from "../../../../store/creators/warehouseCreators";
import {
  extractPartnershipError,
  getProductQty,
  warehouseLabel,
} from "../Warehouses/partnership/partnershipHelpers";
import "../../Market/Warehouse/Warehouse.scss";
import "../Warehouses/Warehouses.scss";

const MOVE_MODE = {
  INTERNAL: "internal",
  PARTNER: "partner",
};

const formatQty = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(3) : "0.000";
};

const formatPrice = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const WarehouseMoveProductModal = ({ open, onClose, product, onMoved }) => {
  const dispatch = useDispatch();
  const warehouses = useSelector((state) => state.warehouse.list || []);
  const warehousesLoading = useSelector(
    (state) => state.warehouse.loading || false,
  );

  const fromWarehouseId = useMemo(
    () => product?.warehouse || product?.warehouse_id || "",
    [product],
  );

  const maxQty = useMemo(() => getProductQty(product), [product]);

  const [moveMode, setMoveMode] = useState(MOVE_MODE.INTERNAL);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [comment, setComment] = useState("межкомпанейское перемещение");
  const [submitting, setSubmitting] = useState(false);

  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerWarehouses, setPartnerWarehouses] = useState([]);
  const [partnerCatalogLoading, setPartnerCatalogLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!warehouses.length) {
      dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    }
  }, [open, dispatch, warehouses.length]);

  const loadPartners = useCallback(async () => {
    setPartnersLoading(true);
    setPartnersError("");
    try {
      const data = await listActiveStockPartners();
      setPartners(data?.partners || []);
    } catch (e) {
      console.error(e);
      setPartners([]);
      setPartnersError(extractPartnershipError(e));
    } finally {
      setPartnersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMoveMode(MOVE_MODE.INTERNAL);
    setToWarehouseId("");
    setPartnerId("");
    setPartnerWarehouses([]);
    setQty(maxQty > 0 ? formatQty(maxQty) : "1.000");
    setComment("межкомпанейское перемещение");
    setSubmitting(false);
    loadPartners();
  }, [open, product?.id, maxQty, loadPartners]);

  useEffect(() => {
    if (!open || moveMode !== MOVE_MODE.PARTNER || !partnerId) {
      setPartnerWarehouses([]);
      setToWarehouseId("");
      return undefined;
    }

    let cancelled = false;
    setPartnerCatalogLoading(true);
    (async () => {
      try {
        const data = await getStockPartnerCatalog(partnerId);
        if (!cancelled) {
          setPartnerWarehouses(data?.warehouses || []);
          setToWarehouseId("");
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setPartnerWarehouses([]);
          alert(extractPartnershipError(e));
        }
      } finally {
        if (!cancelled) setPartnerCatalogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, moveMode, partnerId]);

  const filteredWarehouses = useMemo(() => {
    const fromIdStr = String(fromWarehouseId || "");
    return (warehouses || []).filter((w) => String(w.id) !== fromIdStr);
  }, [warehouses, fromWarehouseId]);

  const handleInternalSubmit = async (e) => {
    e.preventDefault();
    if (!product?.id) return;

    if (!toWarehouseId) {
      alert("Выберите склад-получатель");
      return;
    }

    if (!fromWarehouseId) {
      alert("Не найден склад-отправитель");
      return;
    }

    setSubmitting(true);
    try {
      const qtyCandidate =
        product?.quantity ?? product?.qty ?? product?.stock ?? 1;

      await transferWarehouse({
        warehouse_from: String(fromWarehouseId),
        warehouse_to: String(toWarehouseId),
        comment: "перемещение",
        items: [
          {
            product: String(product.id),
            qty: formatQty(qtyCandidate),
            price: formatPrice(product?.purchase_price ?? product?.price ?? 0),
          },
        ],
      });

      if (typeof onMoved === "function") onMoved();
      onClose();
    } catch (error) {
      console.error("Ошибка перемещения товара:", error);
      const msg =
        error?.detail ||
        error?.warehouse ||
        (typeof error === "string"
          ? error
          : JSON.stringify(error?.response?.data || error?.message || error));
      alert(`Не удалось переместить товар: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    if (!product?.id || !fromWarehouseId) return;

    if (!partnerId) {
      alert("Выберите компанию-партнёра");
      return;
    }

    if (!toWarehouseId) {
      alert("Выберите склад партнёра");
      return;
    }

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
        warehouse_from: String(fromWarehouseId),
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

      if (typeof onMoved === "function") onMoved();
      onClose();
    } catch (error) {
      console.error("Ошибка передачи партнёру:", error);
      alert(`Не удалось передать партнёру: ${extractPartnershipError(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="warehouse-filter-overlay" onClick={onClose} role="presentation">
      <div className="warehouse-filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Перемещение товара</h3>
          <button className="warehouse-filter-modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div
          className="warehouse-partnership-tabs warehouse-partnership-tabs--catalog"
          style={{ padding: "0 16px 12px" }}
        >
          <button
            type="button"
            className={`warehouse-partnership-tab ${moveMode === MOVE_MODE.INTERNAL ? "active" : ""}`}
            onClick={() => {
              setMoveMode(MOVE_MODE.INTERNAL);
              setToWarehouseId("");
            }}
            disabled={submitting}
          >
            Между своими складами
          </button>
          <button
            type="button"
            className={`warehouse-partnership-tab ${moveMode === MOVE_MODE.PARTNER ? "active" : ""}`}
            onClick={() => {
              setMoveMode(MOVE_MODE.PARTNER);
              setToWarehouseId("");
            }}
            disabled={submitting}
          >
            Партнёру
          </button>
        </div>

        {moveMode === MOVE_MODE.INTERNAL ? (
          <>
            <p className="warehouse-filter-modal__subtitle">
              Перемещение внутри вашей компании — выберите другой свой склад
            </p>
            <form className="warehouse-filter-modal__content" onSubmit={handleInternalSubmit}>
              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Товар</label>
                <div style={{ fontWeight: 700 }}>{product?.name || "—"}</div>
                {maxQty > 0 && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    Остаток: {formatQty(maxQty)} {product?.unit || ""}
                  </div>
                )}
              </div>

              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Склад-получатель</label>
                <select
                  className="warehouse-filter-modal__select"
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  disabled={warehousesLoading || submitting}
                  required
                >
                  <option value="">Выберите склад</option>
                  {filteredWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {warehouseLabel(w)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="warehouse-filter-modal__footer">
                <button
                  className="warehouse-filter-modal__apply-btn"
                  type="submit"
                  disabled={submitting}
                >
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
          </>
        ) : (
          <>
            <p className="warehouse-filter-modal__subtitle">
              Отправка партнёру: ваш склад → склад другой компании
            </p>
            {partnersError && (
              <div className="warehouse-partnership-error" style={{ margin: "0 16px 12px" }}>
                {partnersError}
              </div>
            )}
            <form className="warehouse-filter-modal__content" onSubmit={handlePartnerSubmit}>
              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Товар</label>
                <div style={{ fontWeight: 700 }}>{product?.name || "—"}</div>
                {product?.article && (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Артикул: {product.article}
                  </div>
                )}
              </div>

              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">Компания-партнёр</label>
                <select
                  className="warehouse-filter-modal__select"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  disabled={partnersLoading || submitting}
                  required
                >
                  <option value="">
                    {partnersLoading ? "Загрузка…" : "Выберите партнёра"}
                  </option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "—"}
                    </option>
                  ))}
                </select>
                {!partnersLoading && partners.length === 0 && !partnersError && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                    Нет активных партнёров. Отправьте заявку в разделе «Склады → Партнёры».
                  </div>
                )}
              </div>

              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">
                  Склад партнёра-получатель
                </label>
                <select
                  className="warehouse-filter-modal__select"
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  disabled={!partnerId || partnerCatalogLoading || submitting}
                  required
                >
                  <option value="">
                    {partnerCatalogLoading
                      ? "Загрузка складов…"
                      : "Выберите склад партнёра"}
                  </option>
                  {partnerWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {warehouseLabel(w)}
                    </option>
                  ))}
                </select>
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
                <button
                  className="warehouse-filter-modal__apply-btn"
                  type="submit"
                  disabled={submitting || partners.length === 0}
                >
                  {submitting ? "Передаём..." : "Передать партнёру"}
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
          </>
        )}
      </div>
    </div>
  );
};

export default WarehouseMoveProductModal;
