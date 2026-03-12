import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
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
import {
  fetchBuildingWarehouseById,
} from "@/store/creators/building/warehousesCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import api from "../../../../api";
import StockBalancesTab from "./StockBalancesTab";
import StockHistoryTab from "./StockHistoryTab";
import { useDebouncedValue } from "@/hooks/useDebounce";

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
    count: transfersTotalCount,
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

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState(null);
  const [issuingRequestId, setIssuingRequestId] = useState(null);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [transfersModalOpen, setTransfersModalOpen] = useState(false);
  const [requestsTab, setRequestsTab] = useState("pending"); // "pending" | "processed"
  const [transfersTab, setTransfersTab] = useState("pending"); // "pending" | "processed"
  const [mainTab, setMainTab] = useState("balances"); // "balances" | "history"

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [decisionModal, setDecisionModal] = useState(DECISION_INITIAL);
  const debouncedSearch = useDebouncedValue(search, 400);

  const totalPages = useMemo(
    () => getPageCount(transfersTotalCount, DEFAULT_PAGE_SIZE),
    [transfersTotalCount]
  );

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(fetchBuildingWarehouseById(warehouseId));
  }, [dispatch, warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    const loadRequests = async () => {
      setRequestsLoading(true);
      setRequestsError(null);
      try {
        const { data } = await api.get(
          "/building/work-entries/warehouse-requests/",
          {
            params: {
              warehouse: warehouseId,
              page_size: 50,
              search: debouncedSearch || undefined,
            },
          },
        );
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setRequests(list);
      } catch (err) {
        setRequestsError(
          validateResErrors(
            err,
            "Не удалось загрузить заявки на материалы",
          ),
        );
      } finally {
        setRequestsLoading(false);
      }
    };
    loadRequests();
  }, [warehouseId, debouncedSearch]);

  const reloadRequests = async () => {
    if (!warehouseId) return;
    try {
      const { data } = await api.get(
        "/building/work-entries/warehouse-requests/",
        {
          params: {
            warehouse: warehouseId,
            page_size: 50,
            search: debouncedSearch || undefined,
          },
        },
      );
      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setRequests(list);
    } catch (err) {
      // при фоновой перезагрузке не затираем основное сообщение
      // только логируем в стейт, если раньше не было ошибки
      setRequestsError((prev) =>
        prev || validateResErrors(err, "Не удалось обновить заявки на материалы"),
      );
    }
  };

  const handleIssueRequest = async (req) => {
    const requestId = req?.id ?? req?.uuid;
    if (!requestId || !warehouseId) return;

    const items = Array.isArray(req.items) ? req.items : [];
    if (!items.length) {
      alert("У заявки нет позиций для выдачи", true);
      return;
    }

    const payload = {
      warehouse_request: requestId,
      // Явно передаём процесс работ и склад, чтобы удовлетворить валидацию backend
      work_entry: req.work_entry,
      warehouse: warehouseId,
      items: items.map((it) => ({
        nomenclature: it.nomenclature || it.stock_item || it.id,
        quantity: String(it.quantity ?? ""),
        unit: it.unit || "",
      })),
      comment: "Выдача материалов по заявке из процесса работ",
    };

    setIssuingRequestId(requestId);
    try {
      await api.post(
        "/building/warehouse-movements/transfer-to-work-entry/",
        payload,
      );
      alert("Материалы по заявке выданы со склада");
      await reloadRequests();
      // обновим остатки и движения склада
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
    } catch (err) {
      alert(
        validateResErrors(
          err,
          "Не удалось выдать материалы по заявке. Проверьте остатки и запрошенные количества.",
        ),
        true,
      );
    } finally {
      setIssuingRequestId(null);
    }
  };

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(
      fetchBuildingWarehouseTransfers({
        warehouse: warehouseId,
        search: debouncedSearch || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      })
    );
  }, [dispatch, page, debouncedSearch, warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(
      fetchBuildingWarehouseStockItems({
        warehouse: warehouseId,
        page: 1,
        page_size: 10,
        search: debouncedSearch || undefined,
      })
    );
    dispatch(
      fetchBuildingWarehouseStockMoves({
        warehouse: warehouseId,
        page: 1,
        page_size: 10,
        search: debouncedSearch || undefined,
      })
    );
  }, [dispatch, warehouseId, debouncedSearch]);

  const reloadBalances = () => {
    if (!warehouseId) return;
    dispatch(
      fetchBuildingWarehouseStockItems({
        warehouse: warehouseId,
        page: 1,
        page_size: 10,
        search: debouncedSearch || undefined,
      }),
    );
  };

  const reloadMoves = () => {
    if (!warehouseId) return;
    dispatch(
      fetchBuildingWarehouseStockMoves({
        warehouse: warehouseId,
        page: 1,
        page_size: 10,
        search: debouncedSearch || undefined,
      }),
    );
  };

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
    const transferId = decisionModal.transfer?.id ?? decisionModal.transfer?.uuid;
    if (!transferId) return false;
    return decidingIds?.[transferId] === true;
  }, [decisionModal.transfer, decidingIds]);

  const submitDecision = async (e) => {
    e.preventDefault();
    const transferId = decisionModal.transfer?.id ?? decisionModal.transfer?.uuid;
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
            })
          );
          if (res.meta.requestStatus === "fulfilled") alert("Передача принята складом");
          else alert(validateResErrors(res.payload || res.error, "Не удалось принять"), true);
        } else {
          const res = await dispatch(
            rejectBuildingWarehouseTransfer({
              transferId,
              payload: { reason: String(decisionModal.note || "").trim() },
            })
          );
          if (res.meta.requestStatus === "fulfilled") alert("Передача отклонена складом");
          else alert(validateResErrors(res.payload || res.error, "Не удалось отклонить"), true);
        }
        closeDecisionModal();
        if (warehouseId) {
          dispatch(
            fetchBuildingWarehouseTransfers({
              warehouse: warehouseId,
              search: search || undefined,
              page,
              page_size: DEFAULT_PAGE_SIZE,
            })
          );
          dispatch(
            fetchBuildingWarehouseStockItems({
              warehouse: warehouseId,
              page: 1,
              page_size: 10,
            })
          );
          dispatch(
            fetchBuildingWarehouseStockMoves({
              warehouse: warehouseId,
              page: 1,
              page_size: 10,
            })
          );
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось выполнить действие"), true);
      }
    });
  };

  const requestsCount = useMemo(
    () => requests.filter((el) => el.status === "pending").length,
    [requests],
  );
  const transfersCount = useMemo(() => transfers.filter(el => el.status === "pending_receipt").length, [transfers]);

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            Склад: {warehouse?.name || "—"}
          </h1>
          <p className="building-page__subtitle">
            ЖК: {warehouse?.residential_complex_name || "—"}
          </p>
          {currentLoading && (
            <div className="building-page__muted">Загрузка склада...</div>
          )}
          {currentError && (
            <div className="building-page__error">
              {String(
                validateResErrors(currentError, "Не удалось загрузить склад"),
              )}
            </div>
          )}
        </div>
        <div className="building-page__actions">
          <button
            type="button"
            className="building-btn"
            onClick={() => setRequestsModalOpen(true)}
          >
            Запросы
            {requestsCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  minWidth: 18,
                  height: 18,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {requestsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="building-btn"
            onClick={() => setTransfersModalOpen(true)}
          >
            Передачи
            {transfersCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  minWidth: 18,
                  height: 18,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {transfersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters" style={{ alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <input
              className="building-page__input"
              value={search}
              placeholder="Поиск по передаче/комментарию"
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="building-btn"
              onClick={() => setMainTab("balances")}
              style={{
                background: mainTab === "balances" ? "#0f172a" : "#ffffff",
                color: mainTab === "balances" ? "#ffffff" : "#0f172a",
              }}
            >
              Остатки
            </button>
            <button
              type="button"
              className="building-btn"
              onClick={() => setMainTab("history")}
              style={{
                background: mainTab === "history" ? "#0f172a" : "#ffffff",
                color: mainTab === "history" ? "#ffffff" : "#0f172a",
              }}
            >
              История движений
            </button>
          </div>
        </div>
        {error && <div className="building-page__error">{String(error)}</div>}
        {decisionError && (
          <div className="building-page__error">
            {String(validateResErrors(decisionError, "Ошибка"))}
          </div>
        )}
      </div>

      <Modal
        open={requestsModalOpen}
        onClose={() => setRequestsModalOpen(false)}
        title="Заявки на материалы из процессов работ"
      >
        <div className="building-page">
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              className="building-btn"
              onClick={() => setRequestsTab("pending")}
              style={{
                background:
                  requestsTab === "pending" ? "#0f172a" : "#ffffff",
                color: requestsTab === "pending" ? "#ffffff" : "#0f172a",
              }}
            >
              Ждут выдачи
            </button>
            <button
              type="button"
              className="building-btn"
              onClick={() => setRequestsTab("processed")}
              style={{
                background:
                  requestsTab === "processed" ? "#0f172a" : "#ffffff",
                color: requestsTab === "processed" ? "#ffffff" : "#0f172a",
              }}
            >
              Выданные / отклонённые
            </button>
            <button
              type="button"
              className="building-btn"
              onClick={reloadRequests}
              style={{ marginLeft: "auto" }}
            >
              Обновить
            </button>
          </div>

          {requestsLoading && (
            <div className="building-page__muted">Загрузка заявок...</div>
          )}
          {requestsError && (
            <div className="building-page__error">
              {String(requestsError)}
            </div>
          )}
          {!requestsLoading && !requestsError && requests.length === 0 && (
            <div className="building-page__muted">
              Заявки на материалы для этого склада пока не найдены.
            </div>
          )}
          {!requestsLoading && !requestsError && requests.length > 0 && (
            <div className="building-table building-table--shadow">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Процесс работ</th>
                    <th>Статус</th>
                    <th>Позиции</th>
                    <th>Создана</th>
                    <th>Обновлена</th>
                    <th style={{ width: 140 }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {requests
                    .filter((req) =>
                      requestsTab === "pending"
                        ? req.status === "pending"
                        : req.status !== "pending",
                    )
                    .map((req, index) => {
                    const items = Array.isArray(req.items) ? req.items : [];
                    const statusText =
                      req.status === "pending"
                        ? "Ожидает склада"
                        : req.status === "approved"
                        ? "Одобрена"
                        : req.status === "rejected"
                        ? "Отклонена"
                        : req.status === "partially_approved"
                        ? "Частично выдано"
                        : req.status === "completed"
                        ? "Всё выдано"
                        : req.status || "—";

                    const canIssue =
                      req.status === "pending" ||
                      req.status === "partially_approved";
                    const busy =
                      issuingRequestId &&
                      issuingRequestId === (req.id ?? req.uuid);

                    return (
                      <tr key={req.id ?? req.uuid ?? index}>
                        <td>{index + 1}</td>
                        <td>
                          {req.work_entry_title || req.work_entry || "—"}
                        </td>
                        <td>{statusText}</td>
                        <td>
                          {items.length > 0
                            ? `${items.length} поз.`
                            : "Позиции не заданы"}
                        </td>
                        <td>{asDateTime(req.created_at)}</td>
                        <td>{asDateTime(req.updated_at)}</td>
                        <td>
                          {canIssue && (
                            <button
                              type="button"
                              className="building-btn building-btn--primary"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              disabled={busy}
                              onClick={() => handleIssueRequest(req)}
                            >
                              {busy ? "Выдача..." : "Выдать материалы"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
      <Modal
        open={transfersModalOpen}
        onClose={() => setTransfersModalOpen(false)}
        title="Передачи на склад"
      >
        <div className="building-page">
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              className="building-btn"
              onClick={() => setTransfersTab("pending")}
              style={{
                background:
                  transfersTab === "pending" ? "#0f172a" : "#ffffff",
                color: transfersTab === "pending" ? "#ffffff" : "#0f172a",
              }}
            >
              Ожидают приёмки
            </button>
            <button
              type="button"
              className="building-btn"
              onClick={() => setTransfersTab("processed")}
              style={{
                background:
                  transfersTab === "processed" ? "#0f172a" : "#ffffff",
                color: transfersTab === "processed" ? "#ffffff" : "#0f172a",
              }}
            >
              Принятые / отклонённые
            </button>
            <button
              type="button"
              className="building-btn"
              onClick={() => {
                if (!warehouseId) return;
                dispatch(
                  fetchBuildingWarehouseTransfers({
                    warehouse: warehouseId,
                    search: search || undefined,
                    page,
                    page_size: DEFAULT_PAGE_SIZE,
                  }),
                );
              }}
              style={{ marginLeft: "auto" }}
            >
              Обновить
            </button>
          </div>

          {loading && (
            <div className="building-page__muted">Загрузка передач...</div>
          )}

          {!loading && transfers.length === 0 && (
            <div className="building-page__muted">Передач пока нет.</div>
          )}

          {!loading && transfers.length > 0 && (
            <>
              <div className="building-table building-table--shadow">
                <table>
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
                    {transfers
                      .filter((transfer) =>
                        transfersTab === "pending"
                          ? transfer?.status === "pending_receipt"
                          : transfer?.status !== "pending_receipt",
                      )
                      .map((transfer) => {
                      const transferId = transfer?.id ?? transfer?.uuid;
                      const isPending =
                        transfer?.status === "pending_receipt";
                      const deciding =
                        transferId != null &&
                        decidingIds?.[transferId] === true;
                      return (
                        <tr key={transferId}>
                          <td>{transfer?.procurement_title || "Передача"}</td>
                          <td>
                            <span
                              className={transferStatusClass(transfer?.status)}
                            >
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
              </div>
              <BuildingPagination
                page={page}
                totalPages={totalPages}
                disabled={loading}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </Modal>
      {mainTab === "balances" && (
        <StockBalancesTab
          items={stockItems}
          loading={itemsLoading}
          error={itemsError}
          onRefresh={reloadBalances}
        />
      )}
      {mainTab === "history" && (
        <StockHistoryTab
          moves={stockMoves}
          loading={movesLoading}
          error={movesError}
          onRefresh={reloadMoves}
        />
      )}

      <Modal
        open={Boolean(decisionModal.transfer)}
        onClose={closeDecisionModal}
        title={
          decisionModal.mode === "accept" ? "Принять передачу" : "Отклонить передачу"
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

