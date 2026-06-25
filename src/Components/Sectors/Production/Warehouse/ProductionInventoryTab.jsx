import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardList, Eye, X, RefreshCw } from "lucide-react";
import { useDispatch } from "react-redux";
import api from "../../../../api";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useProducts } from "../../../../store/slices/productSlice";
import {
  fetchProductsAsync,
  getItemsMake,
} from "../../../../store/creators/productCreators";
import { InventoryModal } from "../Inventory/InventoryModals";

/**
 * Вкладка «Инвентаризация» на /crm/production/warehouse.
 * История проведённых инвентаризаций + кнопка «Провести инвентаризацию».
 * Read-only поверх API инвентаризаций (см. 05-inventory.md). Изолировано,
 * не меняет существующую логику склада.
 */

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};
const fmtNum = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

const statusMeta = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "confirmed" || v === "done")
    return { label: "Подтверждено", cls: "pa-badge" };
  if (v === "draft") return { label: "Черновик", cls: "pa-badge pa-badge--warning" };
  if (v === "canceled" || v === "cancelled")
    return { label: "Отменено", cls: "pa-badge pa-badge--danger" };
  return { label: s || "—", cls: "pa-badge" };
};

const warehouseLabel = (w) =>
  w === "raw_materials" ? "Склад сырья" : "Склад готовой продукции";

/* ---- Детали инвентаризации ---- */
const InventoryDetailModal = ({ id, onClose }) => {
  const alert = useAlert();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/main/inventories/${id}/`);
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) {
          alert(validateResErrors(e, "Не удалось загрузить инвентаризацию"), true);
          onClose?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = Array.isArray(detail?.items) ? detail.items : [];

  return (
    <div className="add-modal raw-form">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(820px, 96vw)", maxWidth: "96vw" }}
      >
        <div className="add-modal__header">
          <h3>
            Инвентаризация {detail?.doc_no ? `№ ${detail.doc_no}` : ""}
          </h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка…</div>
        ) : (
          <>
            <div
              className="add-modal__section"
              style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
            >
              <span>Дата: <b>{fmtDateTime(detail?.created_at)}</b></span>
              <span>
                Склад: <b>{warehouseLabel(detail?.warehouse)}</b>
              </span>
              <span>
                Ответственный:{" "}
                <b>{detail?.user_name || detail?.created_by_name || "—"}</b>
              </span>
              <span>
                Статус: <b>{statusMeta(detail?.status).label}</b>
              </span>
            </div>
            {detail?.comment && (
              <div className="add-modal__section">
                Комментарий: {detail.comment}
              </div>
            )}
            <div
              className="table-wrapper"
              style={{ maxHeight: 380, overflow: "auto" }}
            >
              <table className="sklad__table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th style={{ textAlign: "right" }}>Учётный</th>
                    <th style={{ textAlign: "right" }}>Факт</th>
                    <th style={{ textAlign: "right" }}>Расхождение</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((it, idx) => {
                      const diff = Number(
                        it.diff ?? Number(it.qty_fact) - Number(it.qty_system),
                      );
                      return (
                        <tr key={it.id || idx}>
                          <td data-label="Товар">
                            {it.product_name || it.product || "—"}
                          </td>
                          <td data-label="Учётный" style={{ textAlign: "right" }}>
                            {fmtNum(it.qty_system)}
                          </td>
                          <td data-label="Факт" style={{ textAlign: "right" }}>
                            {fmtNum(it.qty_fact)}
                          </td>
                          <td
                            data-label="Расхождение"
                            style={{
                              textAlign: "right",
                              color:
                                diff > 0
                                  ? "#047857"
                                  : diff < 0
                                    ? "#b91c1c"
                                    : "inherit",
                            }}
                          >
                            {diff > 0 ? "+" : ""}
                            {fmtNum(diff)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>
                        Нет позиций
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="add-modal__footer">
          <button type="button" className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductionInventoryTab = () => {
  const dispatch = useDispatch();
  const { list: products, itemsMake } = useProducts();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouse, setWarehouse] = useState("finished_goods");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/main/inventories/");
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить инвентаризации"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    dispatch(fetchProductsAsync());
    dispatch(getItemsMake());
  }, [load, dispatch]);

  const createItems = useMemo(
    () => (warehouse === "raw_materials" ? itemsMake : products) || [],
    [warehouse, itemsMake, products],
  );

  const refresh = useCallback(() => {
    load();
    dispatch(fetchProductsAsync());
    dispatch(getItemsMake());
  }, [load, dispatch]);

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left align-middle">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📋</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Инвентаризация</h1>
            <p className="warehouse-header__subtitle">
              История проведённых инвентаризаций и расхождения
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap flex-1 justify-end">
          <select
            className="add-modal__input"
            style={{ height: 40, width: "auto", minWidth: 200 }}
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="finished_goods">Склад готовой продукции</option>
            <option value="raw_materials">Склад сырья</option>
          </select>
          <button
            className="warehouse-header__create-btn"
            onClick={() => setShowCreate(true)}
          >
            <ClipboardList size={16} />
            Провести инвентаризацию
          </button>
        </div>
      </div>

      {error && (
        <div className="add-modal__section">
          <div className="raw-form__error">{error}</div>
        </div>
      )}

      <div
        className="table-wrapper"
        style={{ overflow: "auto", marginTop: 12 }}
      >
        <table className="sklad__table">
          <thead>
            <tr>
              <th>№ док.</th>
              <th>Дата и время</th>
              <th>Кто создал</th>
              <th>Склад</th>
              <th>Статус</th>
              <th style={{ textAlign: "right" }}>Позиций</th>
              <th style={{ textAlign: "right" }}>Излишки</th>
              <th style={{ textAlign: "right" }}>Недостачи</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center" }}>
                  Загрузка…
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((r, idx) => {
                const st = statusMeta(r.status);
                return (
                  <tr key={r.id || idx}>
                    <td data-label="№ док.">{r.doc_no || r.number || "—"}</td>
                    <td data-label="Дата и время">
                      {fmtDateTime(r.created_at || r.date)}
                    </td>
                    <td data-label="Кто создал">
                      {r.user_name || r.created_by_name || r.user || "—"}
                    </td>
                    <td data-label="Склад">{warehouseLabel(r.warehouse)}</td>
                    <td data-label="Статус">
                      <span className={st.cls}>{st.label}</span>
                    </td>
                    <td data-label="Позиций" style={{ textAlign: "right" }}>
                      {fmtNum(r.items_count ?? r.positions ?? (Array.isArray(r.items) ? r.items.length : 0))}
                    </td>
                    <td
                      data-label="Излишки"
                      style={{ textAlign: "right", color: "#047857" }}
                    >
                      +{fmtNum(r.surplus_qty ?? r.surplus_total ?? 0)}
                    </td>
                    <td
                      data-label="Недостачи"
                      style={{ textAlign: "right", color: "#b91c1c" }}
                    >
                      −{fmtNum(r.shortage_qty ?? r.shortage_total ?? 0)}
                    </td>
                    <td data-label="Комментарий">{r.comment || "—"}</td>
                    <td data-label="">
                      <button
                        type="button"
                        className="add-modal__cancel"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        onClick={() => setDetailId(r.id)}
                      >
                        <Eye size={14} /> Детали
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: "center" }}>
                  Инвентаризаций пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="add-modal__cancel"
          onClick={refresh}
          disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Обновить
        </button>
      </div>

      {showCreate && (
        <InventoryModal
          items={createItems}
          warehouse={warehouse}
          warehouseLabel={warehouseLabel(warehouse)}
          onClose={() => setShowCreate(false)}
          onChanged={refresh}
        />
      )}
      {detailId && (
        <InventoryDetailModal id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
};

export default ProductionInventoryTab;
