import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { ArrowLeft, Package } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./Stock.scss";
import {
  acceptBuildingWarehouseTransfer,
  fetchBuildingWarehouseTransfers,
  rejectBuildingWarehouseTransfer,
} from "@/store/creators/building/transfersCreators";
import {
  fetchBuildingWarehouseStockItems,
  fetchBuildingWarehouseStockMoves,
} from "@/store/creators/building/stockCreators";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import {
  TRANSFER_STATUS_LABELS,
  asDateTime,
  statusLabel,
} from "../shared/constants";
import BuildingPagination from "../shared/Pagination";
import BuildingActionsMenu from "../shared/ActionsMenu";
import { useBuildingTransfers } from "@/store/slices/building/transfersSlice";
import { useBuildingStock } from "@/store/slices/building/stockSlice";
import { fetchBuildingWarehouseById } from "@/store/creators/building/warehousesCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";

const DECISION_INITIAL = {
  transfer: null,
  mode: "accept",
  note: "",
};

const transferStatusClass = (status) => {
  if (status === "rejected") return "building-page__status is-danger";
  if (status === "accepted") return "building-page__status is-success";
  if (status === "pending_receipt") return "building-page__status is-warning";
  return "building-page__status";
};

export default function BuildingStockDetail() {
  const { id } = useParams();
  const warehouseId = id ? String(id) : null;
  const alert = useAlert();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    list: transfers,
    count: transfersCount,
    loading,
    error,
    decidingIds,
    decisionError,
  } = useBuildingTransfers();
  const {
    items: stockItems,
    itemsLoading,
    itemsError,
    moves: stockMoves,
    movesLoading,
    movesError,
  } = useBuildingStock();
  const {
    current: warehouse,
    currentLoading,
    currentError,
  } = useBuildingWarehouses();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [incomingOnly, setIncomingOnly] = useState(true);
  const [decisionModal, setDecisionModal] = useState(DECISION_INITIAL);

  const totalPages = useMemo(
    () => getPageCount(transfersCount, DEFAULT_PAGE_SIZE),
    [transfersCount],
  );

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(fetchBuildingWarehouseById(warehouseId));
  }, [dispatch, warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(
      fetchBuildingWarehouseTransfers({
        warehouse: warehouseId,
        incoming: incomingOnly ? "true" : undefined,
        search: search || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      }),
    );
  }, [dispatch, incomingOnly, page, search, warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(
      fetchBuildingWarehouseStockItems({
        warehouse: warehouseId,
        page: 1,
        page_size: 10,
      }),
    );
    dispatch(
      fetchBuildingWarehouseStockMoves({
        warehouse: warehouseId,
        page: 1,
        page_size: 10,
      }),
    );
  }, [dispatch, warehouseId]);

  const openDecisionModal = (mode, transfer) => {
    setDecisionModal({
      transfer,
      mode,
      note: "",
    });
  };

  const closeDecisionModal = () => {
    setDecisionModal(DECISION_INITIAL);
  };

  const isSubmitting = useMemo(() => {
    const transferId =
      decisionModal.transfer?.id ?? decisionModal.transfer?.uuid;
    if (!transferId) return false;
    return decidingIds?.[transferId] === true;
  }, [decisionModal.transfer, decidingIds]);

  const submitDecision = async (e) => {
    e.preventDefault();
    const transferId =
      decisionModal.transfer?.id ?? decisionModal.transfer?.uuid;
    if (!transferId) return;
    if (
      decisionModal.mode === "reject" &&
      String(decisionModal.note || "").trim().length === 0
    ) {
      alert("Для отклонения укажите причину", true);
      return;
    }
    confirm("Подтвердить решение склада?", async (ok) => {
      if (!ok) return;
      try {
        if (decisionModal.mode === "accept") {
          const res = await dispatch(
            acceptBuildingWarehouseTransfer({
              transferId,
              payload: { note: String(decisionModal.note || "").trim() },
            }),
          );
          if (res.meta.requestStatus === "fulfilled")
            alert("Передача принята складом");
          else
            alert(
              validateResErrors(res.payload || res.error, "Не удалось принять"),
              true,
            );
        } else {
          const res = await dispatch(
            rejectBuildingWarehouseTransfer({
              transferId,
              payload: { reason: String(decisionModal.note || "").trim() },
            }),
          );
          if (res.meta.requestStatus === "fulfilled")
            alert("Передача отклонена складом");
          else
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось отклонить",
              ),
              true,
            );
        }
        closeDecisionModal();
        if (warehouseId) {
          dispatch(
            fetchBuildingWarehouseTransfers({
              warehouse: warehouseId,
              incoming: incomingOnly ? "true" : undefined,
              search: search || undefined,
              page,
              page_size: DEFAULT_PAGE_SIZE,
            }),
          );
          dispatch(
            fetchBuildingWarehouseStockItems({
              warehouse: warehouseId,
              page: 1,
              page_size: 10,
            }),
          );
          dispatch(
            fetchBuildingWarehouseStockMoves({
              warehouse: warehouseId,
              page: 1,
              page_size: 10,
            }),
          );
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось выполнить действие"), true);
      }
    });
  };

  return (
    <div className="warehouse-page building-page building-page--stock-detail">
      <button
        type="button"
        className="warehouse-header__back w-max"
        onClick={() => navigate("/crm/building/stock")}
        aria-label="Назад"
      >
        <ArrowLeft size={20} />
        Назад к складам
      </button>

      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">
            <Package size={24} />
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              Склад: {warehouse?.name || "—"}
            </h1>
            <p className="warehouse-header__subtitle">
              ЖК: {warehouse?.residential_complex_name || "—"}
            </p>
            {currentLoading && (
              <span className="warehouse-search__info" style={{ marginTop: 4 }}>
                Загрузка склада...
              </span>
            )}
            {currentError && (
              <div className="building-page__error" style={{ marginTop: 4 }}>
                {String(
                  validateResErrors(currentError, "Не удалось загрузить склад"),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по передаче/комментарию"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <select
            className="warehouse-filter-modal__select-small"
            style={{ minWidth: 200 }}
            value={incomingOnly ? "incoming" : "all"}
            onChange={(e) => {
              setPage(1);
              setIncomingOnly(e.target.value === "incoming");
            }}
          >
            <option value="incoming">Только ожидающие приемки</option>
            <option value="all">Все передачи</option>
          </select>
        </div>
      </div>

      {(error || decisionError) && (
        <div className="mt-2 text-sm text-red-500">
          {error && String(error)}
          {decisionError && String(validateResErrors(decisionError, "Ошибка"))}
        </div>
      )}

      <DataContainer>
        <h3
          className="warehouse-header__title"
          style={{ fontSize: 18, marginBottom: 12 }}
        >
          Передачи на склад
        </h3>
        <div
          className="warehouse-table-container w-full"
          style={{ marginBottom: 24 }}
        >
          {loading ? (
            <div className="warehouse-table__loading">Загрузка...</div>
          ) : transfers.length === 0 ? (
            <div className="warehouse-table__empty">Передач пока нет.</div>
          ) : (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Закупка</th>
                  <th>Статус</th>
                  <th>Создана</th>
                  <th>Комментарий</th>
                  <th style={{ width: 120 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => {
                  const transferId = transfer?.id ?? transfer?.uuid;
                  const isPending = transfer?.status === "pending_receipt";
                  const deciding =
                    transferId != null && decidingIds?.[transferId] === true;
                  return (
                    <tr key={transferId}>
                      <td>{transfer?.procurement_title || "Передача"}</td>
                      <td>
                        <span className={transferStatusClass(transfer?.status)}>
                          {statusLabel(
                            transfer?.status,
                            TRANSFER_STATUS_LABELS,
                          )}
                        </span>
                      </td>
                      <td>{asDateTime(transfer?.created_at)}</td>
                      <td>{transfer?.note || "—"}</td>
                      <td>
                        <BuildingActionsMenu
                          actions={[
                            {
                              label: "Подробнее",
                              onClick: () =>
                                navigate(
                                  `/crm/building/stock/${warehouseId}/transfer/${transferId}`,
                                ),
                            },
                            isPending && {
                              label: "Принять",
                              onClick: () =>
                                openDecisionModal("accept", transfer),
                              disabled: deciding,
                            },
                            isPending && {
                              label: "Отклонить",
                              onClick: () =>
                                openDecisionModal("reject", transfer),
                              disabled: deciding,
                              danger: true,
                            },
                          ].filter(Boolean)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="flex justify-center mt-4">
            <BuildingPagination
              page={page}
              totalPages={totalPages}
              disabled={loading}
              onChange={setPage}
            />
          </div>
        </div>
        <h3
          className="warehouse-header__title"
          style={{ fontSize: 18, marginBottom: 12 }}
        >
          Остатки склада
        </h3>
        <div className="warehouse-table-container w-full">
          {itemsLoading && (
            <div className="warehouse-table__loading">Загрузка остатков...</div>
          )}
          {itemsError && (
            <div className="building-page__error" style={{ marginBottom: 8 }}>
              {String(
                validateResErrors(itemsError, "Не удалось загрузить остатки"),
              )}
            </div>
          )}
          {!itemsLoading && !itemsError && stockItems.length === 0 && (
            <div className="warehouse-table__empty">
              Нет данных по остаткам.
            </div>
          )}
          {!itemsLoading && !itemsError && stockItems.length > 0 && (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Склад</th>
                  <th>Количество</th>
                  <th>Ед. изм.</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((item) => (
                  <tr key={item?.id ?? item?.uuid}>
                    <td>{item?.name || "Товар"}</td>
                    <td>{item?.warehouse_name || "Склад"}</td>
                    <td>{item?.quantity || item?.qty || "0"}</td>
                    <td>{item?.unit || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DataContainer>

      <Modal
        open={Boolean(decisionModal.transfer)}
        onClose={closeDecisionModal}
        title={
          decisionModal.mode === "accept"
            ? "Принять передачу"
            : "Отклонить передачу"
        }
      >
        <form className="building-page" onSubmit={submitDecision}>
          <div className="building-page__muted">
            {decisionModal.transfer?.procurement_title || "Передача"}
          </div>
          <label>
            <div className="building-page__label">
              {decisionModal.mode === "accept"
                ? "Комментарий (необязательно)"
                : "Причина отклонения"}
            </div>
            <textarea
              className="building-page__textarea"
              rows={4}
              value={decisionModal.note}
              onChange={(e) =>
                setDecisionModal((prev) => ({ ...prev, note: e.target.value }))
              }
              required={decisionModal.mode === "reject"}
            />
          </label>
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              disabled={isSubmitting}
              onClick={closeDecisionModal}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`building-btn ${
                decisionModal.mode === "accept"
                  ? "building-btn--primary"
                  : "building-btn--danger"
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Сохранение..." : "Подтвердить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
