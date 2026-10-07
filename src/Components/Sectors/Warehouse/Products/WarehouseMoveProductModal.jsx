import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  listActiveStockPartners,
  transferStockPartnership,
  transferWarehouse,
} from "../../../../api/warehouse";
import { getPartnerWarehouses } from "../../../../api/warehousePartnership";
import { fetchWarehousesAsync } from "../../../../store/creators/warehouseCreators";
import { useUser } from "../../../../store/slices/userSlice";
import { useAlert } from "../../../../hooks/useDialog";
import {
  extractPartnershipError,
  formatQty,
  getProductQty,
  isOwnerOrAdmin,
  transferItemPrice,
  validateTransferQty,
  warehouseLabel,
} from "../Warehouses/partnership/partnershipHelpers";
import "../../Market/Warehouse/Warehouse.scss";
import "../Warehouses/Warehouses.scss";

const MOVE_MODE = {
  INTERNAL: "internal",
  PARTNER: "partner",
};

const MoveProductForm = ({ onClose, product, onMoved }) => {
  const dispatch = useDispatch();
  const alert = useAlert();
  const { profile } = useUser();
  const canMoveToPartner = isOwnerOrAdmin(profile);
  const warehouses = useSelector((state) => state.warehouse.list || []);
  const warehousesLoading = useSelector((state) => state.warehouse.loading || false);

  const fromWarehouseId = product?.warehouse || product?.warehouse_id || "";
  const maxQty = getProductQty(product);

  const [moveMode, setMoveMode] = useState(MOVE_MODE.INTERNAL);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qty, setQty] = useState(() => (maxQty > 0 ? formatQty(maxQty) : "1.000"));
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // null — партнёры ещё не загружались (грузим при первом открытии вкладки)
  const [partners, setPartners] = useState(null);
  const [partnersError, setPartnersError] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerWarehouses, setPartnerWarehouses] = useState([]);
  const [partnerWarehousesLoading, setPartnerWarehousesLoading] = useState(false);

  useEffect(() => {
    if (!warehouses.length) {
      dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    }
  }, [dispatch, warehouses.length]);

  useEffect(() => {
    if (moveMode !== MOVE_MODE.PARTNER || partners !== null) return undefined;
    let cancelled = false;
    listActiveStockPartners()
      .then((data) => {
        if (!cancelled) setPartners(data?.partners || []);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setPartners([]);
        setPartnersError(extractPartnershipError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [moveMode, partners]);

  const selectPartner = async (id) => {
    setPartnerId(id);
    setToWarehouseId("");
    setPartnerWarehouses([]);
    if (!id) return;
    setPartnerWarehousesLoading(true);
    try {
      const data = await getPartnerWarehouses(id);
      setPartnerWarehouses(data?.warehouses || []);
    } catch (e) {
      console.error(e);
      alert(extractPartnershipError(e), true);
    } finally {
      setPartnerWarehousesLoading(false);
    }
  };

  const ownTargetWarehouses = useMemo(() => {
    const fromIdStr = String(fromWarehouseId || "");
    return warehouses.filter((w) => String(w.id) !== fromIdStr);
  }, [warehouses, fromWarehouseId]);

  const switchMode = (mode) => {
    setMoveMode(mode);
    setToWarehouseId("");
  };

  const close = () => {
    if (!submitting) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !product?.id) return;
    const isPartner = moveMode === MOVE_MODE.PARTNER;

    if (!fromWarehouseId) {
      alert("Не найден склад-отправитель", true);
      return;
    }
    if (isPartner && !partnerId) {
      alert("Выберите компанию-партнёра", true);
      return;
    }
    if (!toWarehouseId) {
      alert(isPartner ? "Выберите склад партнёра" : "Выберите склад-получатель", true);
      return;
    }
    const qtyError = validateTransferQty(qty, maxQty);
    if (qtyError) {
      alert(qtyError, true);
      return;
    }

    const payload = {
      warehouse_from: String(fromWarehouseId),
      warehouse_to: String(toWarehouseId),
      comment: comment.trim() || (isPartner ? "Межкомпанейское перемещение" : "Перемещение"),
      items: [
        {
          product: String(product.id),
          qty: formatQty(qty),
          price: transferItemPrice(product),
        },
      ],
    };

    setSubmitting(true);
    try {
      if (isPartner) {
        await transferStockPartnership(payload);
      } else {
        await transferWarehouse(payload);
      }
      alert(isPartner ? "Товар передан партнёру" : "Товар перемещён");
      onMoved?.();
      onClose();
    } catch (error) {
      console.error("Ошибка перемещения товара:", error);
      const prefix = isPartner ? "Не удалось передать партнёру" : "Не удалось переместить товар";
      alert(`${prefix}: ${extractPartnershipError(error)}`, true);
    } finally {
      setSubmitting(false);
    }
  };

  const isPartnerMode = moveMode === MOVE_MODE.PARTNER;
  const partnersLoading = isPartnerMode && partners === null;
  const partnerList = partners || [];

  return (
    <div className="warehouse-filter-overlay" onClick={close} role="presentation">
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Перемещение товара"
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Перемещение товара</h3>
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

        {canMoveToPartner && (
          <div
            className="warehouse-partnership-tabs warehouse-partnership-tabs--catalog"
            style={{ padding: "0 16px 12px" }}
          >
            <button
              type="button"
              className={`warehouse-partnership-tab ${!isPartnerMode ? "active" : ""}`}
              onClick={() => switchMode(MOVE_MODE.INTERNAL)}
              disabled={submitting}
            >
              Между своими складами
            </button>
            <button
              type="button"
              className={`warehouse-partnership-tab ${isPartnerMode ? "active" : ""}`}
              onClick={() => switchMode(MOVE_MODE.PARTNER)}
              disabled={submitting}
            >
              Партнёру
            </button>
          </div>
        )}

        <p className="warehouse-filter-modal__subtitle">
          {isPartnerMode
            ? "Отправка партнёру: ваш склад → склад другой компании"
            : "Перемещение внутри вашей компании — выберите другой свой склад"}
        </p>
        {isPartnerMode && partnersError && (
          <div className="warehouse-partnership-error" style={{ margin: "0 16px 12px" }}>
            {partnersError}
          </div>
        )}

        <form className="warehouse-filter-modal__content" onSubmit={handleSubmit}>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Товар</label>
            <div style={{ fontWeight: 700 }}>{product?.name || "—"}</div>
            {product?.article && (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Артикул: {product.article}
              </div>
            )}
          </div>

          {isPartnerMode && (
            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label" htmlFor="move-partner">
                Компания-партнёр
              </label>
              <select
                id="move-partner"
                className="warehouse-filter-modal__select"
                value={partnerId}
                onChange={(e) => selectPartner(e.target.value)}
                disabled={partnersLoading || submitting}
                required
              >
                <option value="">
                  {partnersLoading ? "Загрузка…" : "Выберите партнёра"}
                </option>
                {partnerList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "—"}
                  </option>
                ))}
              </select>
              {!partnersLoading && partnerList.length === 0 && !partnersError && (
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                  Нет активных партнёров. Отправьте заявку в разделе «Склады → Партнёры».
                </div>
              )}
            </div>
          )}

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label" htmlFor="move-to-warehouse">
              {isPartnerMode ? "Склад партнёра-получатель" : "Склад-получатель"}
            </label>
            <select
              id="move-to-warehouse"
              className="warehouse-filter-modal__select"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              disabled={
                submitting ||
                (isPartnerMode ? !partnerId || partnerWarehousesLoading : warehousesLoading)
              }
              required
            >
              <option value="">
                {isPartnerMode && partnerWarehousesLoading
                  ? "Загрузка складов…"
                  : "Выберите склад"}
              </option>
              {(isPartnerMode ? partnerWarehouses : ownTargetWarehouses).map((w) => (
                <option key={w.id} value={w.id}>
                  {warehouseLabel(w)}
                </option>
              ))}
            </select>
          </div>

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label" htmlFor="move-qty">
              Количество
            </label>
            <input
              id="move-qty"
              className="warehouse-filter-modal__select"
              type="text"
              inputMode="decimal"
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
            <label className="warehouse-filter-modal__label" htmlFor="move-comment">
              Комментарий
            </label>
            <input
              id="move-comment"
              className="warehouse-filter-modal__select"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              placeholder={isPartnerMode ? "Межкомпанейское перемещение" : "Перемещение"}
            />
          </div>

          <div className="warehouse-filter-modal__footer">
            <button
              className="warehouse-filter-modal__apply-btn"
              type="submit"
              disabled={submitting || (isPartnerMode && partnerList.length === 0)}
            >
              {submitting
                ? "Отправляем..."
                : isPartnerMode
                  ? "Передать партнёру"
                  : "Переместить"}
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

/**
 * Перемещение товара из карточки: на другой свой склад или (владелец/админ)
 * на склад компании-партнёра. Количество задаётся явно — раньше внутреннее
 * перемещение всегда уносило весь остаток.
 */
const WarehouseMoveProductModal = ({ open, ...props }) =>
  open ? <MoveProductForm {...props} /> : null;

export default WarehouseMoveProductModal;
