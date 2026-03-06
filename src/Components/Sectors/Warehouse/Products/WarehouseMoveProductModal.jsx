import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { transferWarehouse } from "../../../../api/warehouse";
import { fetchWarehousesAsync } from "../../../../store/creators/warehouseCreators";
import "../../Market/Warehouse/Warehouse.scss";

const WarehouseMoveProductModal = ({ open, onClose, product, onMoved }) => {
  const dispatch = useDispatch();
  const warehouses = useSelector((state) => state.warehouse.list || []);
  const warehousesLoading = useSelector((state) => state.warehouse.loading || false);

  const fromWarehouseId = useMemo(() => {
    return product?.warehouse || product?.warehouse_id || "";
  }, [product]);

  const [toWarehouseId, setToWarehouseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatQty = (v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n.toFixed(3) : "0.000";
  };

  const formatPrice = (v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };

  useEffect(() => {
    if (!open) return;
    if (!warehouses.length) {
      dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    }
  }, [open, dispatch, warehouses.length]);

  useEffect(() => {
    if (!open) return;
    setToWarehouseId("");
    setSubmitting(false);
  }, [open]);

  const filteredWarehouses = useMemo(() => {
    const fromIdStr = String(fromWarehouseId || "");
    return (warehouses || []).filter((w) => String(w.id) !== fromIdStr);
  }, [warehouses, fromWarehouseId]);

  const handleSubmit = async (e) => {
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
        product?.quantity ??
        product?.qty ??
        product?.stock ??
        1;

      // POST /api/warehouse/transfer
      const payload = {
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
      };

      await transferWarehouse(payload);

      if (typeof onMoved === "function") onMoved();
      onClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Ошибка перемещения товара:", error);
      const msg =
        error?.response?.data?.detail ||
        (typeof error?.response?.data === "string"
          ? error.response.data
          : JSON.stringify(error?.response?.data || error?.message || error));
      alert(`Не удалось переместить товар: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="warehouse-filter-overlay" onClick={onClose}>
      <div className="warehouse-filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Перемещение товара</h3>
          <button className="warehouse-filter-modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <p className="warehouse-filter-modal__subtitle">Выберите склад-получатель для перемещения</p>

        <form className="warehouse-filter-modal__content" onSubmit={handleSubmit}>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Товар</label>
            <div style={{ fontWeight: 700 }}>{product?.name || "—"}</div>
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
                  {w.name || w.title || `Склад #${w.id}`}
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
      </div>
    </div>
  );
};

export default WarehouseMoveProductModal;


