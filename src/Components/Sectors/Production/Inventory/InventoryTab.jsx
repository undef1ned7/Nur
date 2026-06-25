import { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { ClipboardList, Plus, Eye, X, RefreshCw } from "lucide-react";
import api from "../../../../api";
import { useProducts } from "../../../../store/slices/productSlice";
import { getItemsMake } from "../../../../store/creators/productCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { InventoryModal } from "./InventoryModals";

/**
 * Задача — вкладка «Инвентаризация» на /crm/production/warehouse.
 * По умолчанию — история всех инвентаризаций. Кнопка «Провести инвентаризацию».
 * Переиспользует InventoryModal (Задача №5). API: GET /main/inventories/,
 * GET /main/inventories/{id}/. Изолировано, dark/adaptive (под .prod).
 */

const fmtNum = (n) =>
  Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

const docNo = (r) =>
  r?.doc_no || r?.number || (r?.id ? `№ ${String(r.id).slice(0, 8)}` : "—");

const itemsCount = (r) =>
  r?.items_count ?? (Array.isArray(r?.items) ? r.items.length : 0);

const statusLabel = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "confirmed" || v === "done") return "Подтверждено";
  if (v === "draft") return "Черновик";
  if (v === "canceled" || v === "cancelled") return "Отменено";
  return s || "—";
};
const isDraft = (s) => String(s || "").toLowerCase() === "draft";

const WAREHOUSES = [
  {
    value: "finished_goods",
    label: "Склад готовой продукции",
    short: "Готовая продукция",
  },
  { value: "raw_materials", label: "Склад сырья", short: "Сырьё" },
];

/* -------- Детали инвентаризации -------- */
const InventoryDetailsModal = ({ row, onClose }) => {
  const [data, setData] = useState(row);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!row?.id) return undefined;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/main/inventories/${row.id}/`);
        if (!cancelled) setData(res.data || row);
      } catch (e) {
        if (!cancelled)
          setError(validateResErrors(e, "Не удалось загрузить детали"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row]);

  const items = Array.isArray(data?.items) ? data.items : [];

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
          <h3>Инвентаризация {docNo(data)}</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div
          className="add-modal__section"
          style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
        >
          <span>Дата: {fmtDateTime(data?.created_at || data?.date)}</span>
          <span>
            Ответственный:{" "}
            {data?.user_name || data?.created_by_name || data?.user || "—"}
          </span>
          <span>Статус: {statusLabel(data?.status)}</span>
        </div>
        {data?.comment && (
          <div className="add-modal__section">Комментарий: {data.comment}</div>
        )}

        {error && <div className="raw-form__error">{error}</div>}

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
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Загрузка…
                  </td>
                </tr>
              ) : items.length > 0 ? (
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
                      <td data-label="Расхождение" style={{ textAlign: "right" }}>
                        <span
                          className={
                            diff > 0
                              ? "pa-badge"
                              : diff < 0
                                ? "pa-badge pa-badge--danger"
                                : "pa-badge pa-badge--warning"
                          }
                        >
                          {diff > 0 ? `+${fmtNum(diff)}` : fmtNum(diff)}
                        </span>
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

        <div className="add-modal__footer">
          <button type="button" className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------- Вкладка «Инвентаризация» -------- */
const InventoryTab = () => {
  const dispatch = useDispatch();
  const { list: products, itemsMake } = useProducts();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouse, setWarehouse] = useState("finished_goods");
  const [showCreate, setShowCreate] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);

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
    dispatch(getItemsMake());
  }, [load, dispatch]);

  const createItems = useMemo(
    () =>
      warehouse === "raw_materials"
        ? Array.isArray(itemsMake)
          ? itemsMake
          : []
        : Array.isArray(products)
          ? products
          : [],
    [warehouse, products, itemsMake],
  );

  const warehouseLabel =
    WAREHOUSES.find((w) => w.value === warehouse)?.label || "";

  const renderDiscrepancy = (r) => (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <span style={{ color: "#047857", fontWeight: 600 }}>
        +{fmtNum(r.surplus_qty ?? r.surplus_total ?? 0)}
      </span>
      <span style={{ color: "#b91c1c", fontWeight: 600 }}>
        −{fmtNum(r.shortage_qty ?? r.shortage_total ?? 0)}
      </span>
    </span>
  );

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left align-middle">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">
              <ClipboardList size={20} />
            </div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Инвентаризация</h1>
            <p className="warehouse-header__subtitle">
              История проведённых инвентаризаций и сверка остатков
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-center justify-end md:w-full md:justify-center lg:justify-end">
          <select
            className="add-modal__input"
            style={{ height: 42, width: "auto", minWidth: 200 }}
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            title="Склад для новой инвентаризации"
          >
            {WAREHOUSES.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <button
            className="warehouse-header__create-btn"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} />
            Провести инвентаризацию
          </button>
          <button
            className="warehouse-header__create-btn"
            onClick={load}
            disabled={loading}
            title="Обновить"
            style={{ background: "#64748b" }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="raw-form__error" style={{ margin: "0 0 12px" }}>
          {error}
        </div>
      )}

      <div className="warehouse-table-container">
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="sklad__table">
            <thead>
              <tr>
                <th>№ документа</th>
                <th>Дата и время</th>
                <th>Кто создал</th>
                <th>Статус</th>
                <th style={{ textAlign: "right" }}>Позиций</th>
                <th>Расхождения</th>
                <th>Комментарий</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    Загрузка…
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td data-label="№ документа">{docNo(r)}</td>
                    <td data-label="Дата и время">
                      {fmtDateTime(r.created_at || r.date)}
                    </td>
                    <td data-label="Кто создал">
                      {r.user_name || r.created_by_name || r.user || "—"}
                    </td>
                    <td data-label="Статус">
                      <span
                        className={
                          isDraft(r.status)
                            ? "pa-badge pa-badge--warning"
                            : "pa-badge"
                        }
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td data-label="Позиций" style={{ textAlign: "right" }}>
                      {fmtNum(itemsCount(r))}
                    </td>
                    <td data-label="Расхождения">{renderDiscrepancy(r)}</td>
                    <td data-label="Комментарий">{r.comment || "—"}</td>
                    <td data-label="">
                      <button
                        type="button"
                        className="warehouse-table__edit-btn"
                        title="Детали"
                        onClick={() => setDetailsRow(r)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Eye size={15} />
                        Детали
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", padding: "28px 0" }}
                  >
                    Инвентаризаций пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <InventoryModal
          items={createItems}
          warehouse={warehouse}
          warehouseLabel={warehouseLabel}
          onClose={() => setShowCreate(false)}
          onChanged={load}
        />
      )}
      {detailsRow && (
        <InventoryDetailsModal
          row={detailsRow}
          onClose={() => setDetailsRow(null)}
        />
      )}
    </div>
  );
};

export default InventoryTab;
