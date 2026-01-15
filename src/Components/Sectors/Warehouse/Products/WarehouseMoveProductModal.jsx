import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../../../api";
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
  const [qty, setQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!warehouses.length) {
      dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    }
  }, [open, dispatch, warehouses.length]);

  useEffect(() => {
    if (!open) return;
    setToWarehouseId("");
    setQty("");
    setSubmitting(false);
  }, [open]);

  const filteredWarehouses = useMemo(() => {
    const fromIdStr = String(fromWarehouseId || "");
    return (warehouses || []).filter((w) => String(w.id) !== fromIdStr);
  }, [warehouses, fromWarehouseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product?.id) return;

    const qtyNum = Number(qty);
    if (!toWarehouseId) {
      alert("Выберите склад-получатель");
      return;
    }
    if (!qty || Number.isNaN(qtyNum) || qtyNum <= 0) {
      alert("Введите корректное количество");
      return;
    }

    setSubmitting(true);
    try {
      // Перемещение товара между складами
      // Endpoint (по аналогии с GET списком): /warehouse/movements/
      // Если бэкенд ожидает другие ключи — в ответе будет валидация, подстроим.
      await api.post("/warehouse/movements/", {
        product: product.id,
        from_warehouse: fromWarehouseId || null,
        to_warehouse: toWarehouseId,
        qty: qtyNum,
      });

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

        <p className="warehouse-filter-modal__subtitle">
          Выберите склад-получатель и количество для перемещения
        </p>

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

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Количество</label>
            <input
              className="warehouse-filter-modal__input"
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={submitting}
              required
            />
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


