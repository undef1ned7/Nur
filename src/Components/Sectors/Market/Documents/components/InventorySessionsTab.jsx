import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Eye,
  PackageCheck,
  RefreshCw,
  XCircle,
} from "lucide-react";
import api from "../../../../../api";
import ReactPortal from "../../../../common/Portal/ReactPortal";
import InventoryModal from "../../Warehouse/components/InventoryModal";
import { validateResErrors } from "../../../../../../tools/validateResErrors";
import { useAlert, useConfirm } from "../../../../../hooks/useDialog";
import { fetchProductsAsync } from "../../../../../store/creators/productCreators";
import "../../Warehouse/Warehouse.scss";
import "./InventorySessionsTab.scss";

const PAGE_SIZE = 20;

const listFrom = (res) => res?.data?.results || res?.data || [];

const statusLabel = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "draft") return "Черновик";
  if (s === "applied") return "Проведён";
  if (s === "canceled" || s === "cancelled") return "Отменён";
  return status || "—";
};

const statusClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "draft") return "draft";
  if (s === "applied") return "approved";
  return "draft";
};

const formatDt = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

const InventorySessionsTab = () => {
  const alert = useAlert();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [allowNegative, setAllowNegative] = useState(false);

  const [createProducts, setCreateProducts] = useState(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/main/inventory/sessions/", {
        params: { page, page_size: PAGE_SIZE },
      });
      const list = listFrom({ data });
      setSessions(Array.isArray(list) ? list : []);
      setCount(Number(data?.count) || list.length || 0);
    } catch (e) {
      setSessions([]);
      setError(
        validateResErrors(e, "Не удалось загрузить акты инвентаризации."),
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const products = location.state?.inventoryProducts;
    if (Array.isArray(products) && products.length > 0) {
      setCreateProducts(products);
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} },
      );
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail(null);
    setDetailError("");
    setAllowNegative(false);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/main/inventory/sessions/${id}/`);
      setDetail(data);
    } catch (e) {
      setDetailError(
        validateResErrors(e, "Не удалось загрузить акт."),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setDetailError("");
  };

  const handleApply = async () => {
    if (!detailId || !detail) return;
    const ok = await new Promise((resolve) => {
      confirm(
        "Провести инвентаризацию? Остатки товаров будут выровнены по фактическим количествам в акте.",
        (result) => resolve(Boolean(result)),
      );
    });
    if (!ok) return;
    setApplyBusy(true);
    try {
      await api.post(`/main/inventory/sessions/${detailId}/apply/`, {
        allow_negative: allowNegative,
      });
      alert("Инвентаризация проведена и остатки товаров обновлены.");
      closeDetail();
      await loadSessions();
      void dispatch(fetchProductsAsync({ page: 1, page_size: 50 }));
    } catch (e) {
      alert(
        validateResErrors(e, "Не удалось провести инвентаризацию."),
        true,
      );
    } finally {
      setApplyBusy(false);
    }
  };

  const handleCancelDraft = async () => {
    if (!detailId) return;
    const ok = await new Promise((resolve) => {
      confirm("Отменить черновик акта? Остатки товаров не изменятся.", (r) =>
        resolve(Boolean(r)),
      );
    });
    if (!ok) return;
    setCancelBusy(true);
    try {
      await api.post(`/main/inventory/sessions/${detailId}/cancel/`);
      alert("Черновик инвентаризации отменён.");
      closeDetail();
      await loadSessions();
    } catch (e) {
      alert(validateResErrors(e, "Не удалось отменить акт."), true);
    } finally {
      setCancelBusy(false);
    }
  };

  const onCreateModalSaved = async ({ applied }) => {
    setCreateProducts(null);
    await loadSessions();
    if (applied) {
      alert("Инвентаризация проведена и остатки товаров обновлены.");
    } else {
      alert("Черновик инвентаризации сохранён.");
    }
    void dispatch(fetchProductsAsync({ page: 1, page_size: 50 }));
  };

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const hasNextPage = page * PAGE_SIZE < count;
  const hasPrevPage = page > 1;

  const itemsCount = (session) => {
    if (Array.isArray(session?.items)) return session.items.length;
    if (typeof session?.items_count === "number") return session.items_count;
    return "—";
  };

  return (
    <div className="inventory-sessions">
      <div className="inventory-sessions__toolbar">
        <p className="inventory-sessions__hint">
          Новый акт: нажмите «Создать инвентаризацию» вверху страницы, на складе
          отметьте товары и снова «Инвентаризация» — форма откроется здесь.
          Черновики ниже можно провести или отменить.
        </p>
        <div className="inventory-sessions__toolbar-actions">
          <button
            type="button"
            className="inventory-sessions__refresh"
            onClick={() => void loadSessions()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>
      </div>

      {error ? (
        <div className="inventory-sessions__banner inventory-sessions__banner--error">
          {error}
        </div>
      ) : null}

      <div className="documents__table-wrapper">
        <table className="documents__table">
          <thead>
            <tr>
              <th>Создан</th>
              <th>Примечание</th>
              <th>Статус</th>
              <th>Позиций</th>
              <th>Проведён</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="documents__empty">
                  Загрузка…
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="documents__empty">
                  Актов инвентаризации пока нет
                </td>
              </tr>
            ) : (
              sessions.map((row) => (
                <tr key={row.id}>
                  <td>{formatDt(row.created_at)}</td>
                  <td className="inventory-sessions__note">
                    {row.note?.trim() ? row.note : "—"}
                  </td>
                  <td>
                    <span
                      className={`documents__status documents__status--${statusClass(
                        row.status,
                      )}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td>{itemsCount(row)}</td>
                  <td>{formatDt(row.applied_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="documents__action-btn"
                      title="Подробнее"
                      onClick={() => void openDetail(row.id)}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="documents__pagination">
          <button
            type="button"
            className="documents__pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || !hasPrevPage}
          >
            Назад
          </button>
          <span className="documents__pagination-info">
            Страница {page} из {totalPages}
            {count ? ` (${count} актов)` : ""}
          </span>
          <button
            type="button"
            className="documents__pagination-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || !hasNextPage}
          >
            Вперёд
          </button>
        </div>
      ) : null}

      {detailId ? (
        <ReactPortal modalId="market-inventory-session-detail">
          <div
            className="warehouse-inventory-overlay"
            onClick={() =>
              !applyBusy && !cancelBusy && !detailLoading && closeDetail()
            }
          >
            <div
              className="warehouse-inventory-modal inventory-sessions__detail-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="warehouse-inventory-modal__header">
                <div className="warehouse-inventory-modal__title-wrap">
                  <div className="warehouse-inventory-modal__icon">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <h3 className="warehouse-inventory-modal__title">
                      Акт инвентаризации
                    </h3>
                    <p className="warehouse-inventory-modal__subtitle">
                      {detail
                        ? `${statusLabel(detail.status)} · ${formatDt(detail.created_at)}`
                        : "Загрузка…"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="warehouse-inventory-modal__close"
                  onClick={closeDetail}
                  disabled={applyBusy || cancelBusy}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>

              <div className="warehouse-inventory-modal__body">
                {detailLoading ? (
                  <p>Загрузка…</p>
                ) : detailError ? (
                  <p className="inventory-sessions__banner inventory-sessions__banner--error">
                    {detailError}
                  </p>
                ) : detail ? (
                  <>
                    {detail.note ? (
                      <p>
                        <strong>Примечание:</strong> {detail.note}
                      </p>
                    ) : null}
                    <div className="warehouse-inventory-modal__table">
                      <div className="warehouse-inventory-modal__table-head">
                        <span>Товар</span>
                        <span>Было</span>
                        <span>Факт</span>
                        <span>Δ</span>
                      </div>
                      <div className="warehouse-inventory-modal__rows">
                        {(detail.items || []).map((line) => {
                          const pname =
                            line.product?.name ||
                            line.product_name ||
                            line.product_title ||
                            line.product_id ||
                            "—";
                          return (
                            <div
                              key={line.id || `${line.product_id}-${line.quantity_fact}`}
                              className="warehouse-inventory-modal__row"
                            >
                              <div className="warehouse-inventory-modal__product">
                                <div className="warehouse-inventory-modal__product-name">
                                  {pname}
                                </div>
                              </div>
                              <div className="warehouse-inventory-modal__value">
                                {line.quantity_before ?? "—"}
                              </div>
                              <div className="warehouse-inventory-modal__value">
                                {line.quantity_fact ?? "—"}
                              </div>
                              <div className="warehouse-inventory-modal__value">
                                {line.quantity_delta ?? "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {String(detail.status || "").toLowerCase() === "draft" ? (
                      <>
                        <label className="warehouse-inventory-modal__checkbox">
                          <input
                            type="checkbox"
                            checked={allowNegative}
                            onChange={(e) =>
                              setAllowNegative(e.target.checked)
                            }
                          />
                          <span>
                            Разрешить отрицательные фактические остатки при
                            проведении
                          </span>
                        </label>
                        <div className="inventory-sessions__detail-actions">
                          <button
                            type="button"
                            className="warehouse-inventory-modal__secondary-btn"
                            onClick={() => void handleCancelDraft()}
                            disabled={applyBusy || cancelBusy}
                          >
                            <XCircle size={16} />
                            {cancelBusy ? "Отмена…" : "Отменить черновик"}
                          </button>
                          <button
                            type="button"
                            className="warehouse-inventory-modal__primary-btn"
                            onClick={() => void handleApply()}
                            disabled={applyBusy || cancelBusy}
                          >
                            <PackageCheck size={16} />
                            {applyBusy ? "Проводим…" : "Провести"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </ReactPortal>
      ) : null}

      {createProducts?.length ? (
        <ReactPortal modalId="market-inventory-create-from-warehouse">
          <InventoryModal
            products={createProducts}
            onClose={() => setCreateProducts(null)}
            onSaved={onCreateModalSaved}
          />
        </ReactPortal>
      ) : null}
    </div>
  );
};

export default React.memo(InventorySessionsTab);
