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
import { Trash2 } from "lucide-react";

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

  const [transferToWorkModalOpen, setTransferToWorkModalOpen] = useState(false);
  const [transferWorkEntryId, setTransferWorkEntryId] = useState("");
  const [transferWorkSearch, setTransferWorkSearch] = useState("");
  const [transferWorkOptions, setTransferWorkOptions] = useState([]);
  const [transferWorkLoading, setTransferWorkLoading] = useState(false);
  const [transferWorkError, setTransferWorkError] = useState(null);
  const [transferItems, setTransferItems] = useState([]);
  const [transferIssuedTo, setTransferIssuedTo] = useState("");
  const [transferComment, setTransferComment] = useState("");
  const [transferError, setTransferError] = useState(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [addPositionModalOpen, setAddPositionModalOpen] = useState(false);
  const [addPositionSearch, setAddPositionSearch] = useState("");
  const [transferWorkPickerOpen, setTransferWorkPickerOpen] = useState(false);
  const [selectItemModalOpen, setSelectItemModalOpen] = useState(false);
  const [selectItemRowIndex, setSelectItemRowIndex] = useState(0);
  const [selectItemSearch, setSelectItemSearch] = useState("");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [decisionModal, setDecisionModal] = useState(DECISION_INITIAL);
  const [requestIssuedToMap, setRequestIssuedToMap] = useState({});
  const debouncedSearch = useDebouncedValue(search, 400);
  const debouncedWorkSearch = useDebouncedValue(transferWorkSearch, 400);
  const debouncedItemSearch = useDebouncedValue(selectItemSearch, 400);
  const debouncedAddPositionSearch = useDebouncedValue(addPositionSearch, 300);

  const totalPages = useMemo(
    () => getPageCount(transfersTotalCount, DEFAULT_PAGE_SIZE),
    [transfersTotalCount]
  );

  useEffect(() => {
    if (!warehouseId) return;
    dispatch(fetchBuildingWarehouseById(warehouseId));
  }, [dispatch, warehouseId]);

  // Загрузка процессов работ для выбранного ЖК (через склад)
  useEffect(() => {
    if (!transferToWorkModalOpen) return;
    const rcId =
      warehouse?.residential_complex ||
      warehouse?.residential_complex_id ||
      null;
    if (!rcId) return;
    const loadWorkEntries = async () => {
      setTransferWorkLoading(true);
      setTransferWorkError(null);
      try {
        const { data } = await api.get("/building/work-entries/", {
          params: {
            residential_complex: rcId,
            search: debouncedWorkSearch || undefined,
            page_size: 20,
          },
        });
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setTransferWorkOptions(
          list.filter(
            (e) =>
              e.work_status !== "cancelled" && e.work_status !== "completed",
          ),
        );
      } catch (err) {
        setTransferWorkError(
          validateResErrors(
            err,
            "Не удалось загрузить процессы работ для выбора",
          ),
        );
      } finally {
        setTransferWorkLoading(false);
      }
    };
    loadWorkEntries();
  }, [transferToWorkModalOpen, warehouse, debouncedWorkSearch]);

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
      issued_to: requestIssuedToMap[String(requestId)]?.trim() || undefined,
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
      setRequestIssuedToMap((prev) => {
        const next = { ...prev };
        delete next[String(requestId)];
        return next;
      });
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
            onClick={() => setTransferToWorkModalOpen(true)}
            disabled={!warehouseId}
          >
            Передать в процесс работ
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
            <div className="building-table building-table--shadow building-table--small">
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
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <input
                                className="building-page__input"
                                value={requestIssuedToMap[String(req.id ?? req.uuid)] || ""}
                                onChange={(e) =>
                                  setRequestIssuedToMap((prev) => ({
                                    ...prev,
                                    [String(req.id ?? req.uuid)]: e.target.value,
                                  }))
                                }
                                placeholder="Кому передали"
                                style={{ minWidth: 160 }}
                              />
                              <button
                                type="button"
                                className="building-btn building-btn--primary"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                disabled={busy}
                                onClick={() => handleIssueRequest(req)}
                              >
                                {busy ? "Выдача..." : "Выдать материалы"}
                              </button>
                            </div>
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
        open={selectItemModalOpen}
        onClose={() => {
          setSelectItemModalOpen(false);
          setSelectItemSearch("");
        }}
        title="Выбрать позицию склада"
      >
        <div className="building-page">
          <div className="building-page__filters" style={{ marginBottom: 8 }}>
            <input
              className="building-page__input"
              value={selectItemSearch}
              onChange={(e) => setSelectItemSearch(e.target.value)}
              placeholder="Поиск по названию товара"
            />
          </div>
          {itemsLoading && (
            <div className="building-page__muted">Загрузка остатков...</div>
          )}
          {itemsError && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  itemsError,
                  "Не удалось загрузить остатки склада",
                ),
              )}
            </div>
          )}
          {!itemsLoading && !itemsError && stockItems.length === 0 && (
            <div className="building-page__muted">Нет позиций на складе.</div>
          )}
          {!itemsLoading && !itemsError && stockItems.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 14,
                maxHeight: 380,
                overflowY: "auto",
              }}
            >
              {stockItems
                .filter((item) => {
                  const q = debouncedItemSearch
                    .toLowerCase()
                    .trim();
                  if (!q) return true;
                  const hay = `${item?.name || ""} ${
                    item?.warehouse_name || ""
                  }`
                    .toLowerCase()
                    .trim();
                  return hay.includes(q);
                })
                .map((item) => {
                  const iid =
                    item?.id ?? item?.uuid ?? item?.stock_item ?? "";
                  const name = item?.name || "Товар";
                  const qty = item?.quantity || item?.qty || "0";
                  const unit = item?.unit || "";
                  return (
                    <button
                      key={iid}
                      type="button"
                      className="building-page__card"
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setTransferItems((prev) => {
                          const next = [...prev];
                          const row = next[selectItemRowIndex] || {
                            nomenclature: "",
                            quantity: "",
                            unit: "",
                          };
                          next[selectItemRowIndex] = {
                            ...row,
                            nomenclature: iid,
                            unit: row.unit || unit,
                          };
                          return next;
                        });
                        setSelectItemModalOpen(false);
                        setSelectItemSearch("");
                      }}
                    >
                      <div
                        className="building-page__value"
                        style={{ marginBottom: 6, fontSize: 14 }}
                      >
                        {name}
                      </div>
                      <div
                        className="building-page__label"
                        style={{ fontSize: 12 }}
                      >
                        Остаток: {qty} {unit}
                      </div>
                      <div
                        className="building-page__label"
                        style={{ fontSize: 12 }}
                      >
                        Склад: {item?.warehouse_name || "—"}
                      </div>
                    </button>
                  );
                })}
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
              <div className="building-table building-table--shadow building-table--small">
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

      <Modal
        open={transferToWorkModalOpen}
        onClose={() => {
          if (transferSubmitting) return;
          setTransferToWorkModalOpen(false);
          setTransferError(null);
          setTransferWorkEntryId("");
          setTransferWorkSearch("");
          setTransferItems([]);
          setTransferComment("");
          setAddPositionModalOpen(false);
          setAddPositionSearch("");
          setTransferWorkPickerOpen(false);
        }}
        title="Передача материалов в процесс работ"
      >
        <form
          className="building-page"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!warehouseId) return;
            const workEntry = transferWorkEntryId.trim();
            if (!workEntry) {
              setTransferError("Выберите процесс работ");
              return;
            }
            const balanceErrors = transferItems
              .map((row, i) => {
                const q = parseFloat(String(row.quantity).replace(",", "."));
                const maxQ = Number(row.balance);
                if (Number.isNaN(q) || q <= 0)
                  return `Укажите количество для позиции «${row.name || row.nomenclature}»`;
                if (!Number.isFinite(maxQ) || q > maxQ)
                  return `Количество не может превышать остаток на складе (${maxQ}) для «${row.name || row.nomenclature}»`;
                return null;
              })
              .filter(Boolean);
            if (balanceErrors.length > 0) {
              setTransferError(balanceErrors[0]);
              return;
            }
            const items = transferItems
              .map((row) => ({
                nomenclature: String(row.nomenclature).trim(),
                quantity: String(row.quantity).trim(),
                unit: String(row.unit || "").trim(),
              }))
              .filter((row) => row.nomenclature && row.quantity);
            if (items.length === 0) {
              setTransferError("Добавьте хотя бы одну позицию и укажите количество.");
              return;
            }
            setTransferSubmitting(true);
            setTransferError(null);
            try {
              await api.post(
                "/building/warehouse-movements/transfer-to-work-entry/",
                {
                  work_entry: workEntry,
                  warehouse: warehouseId,
                  issued_to: transferIssuedTo.trim() || undefined,
                  items,
                  comment: transferComment.trim() || undefined,
                },
              );
              alert("Материалы переданы в процесс работ");
              setTransferToWorkModalOpen(false);
              setTransferWorkEntryId("");
              setTransferWorkSearch("");
              setTransferItems([]);
              setTransferIssuedTo("");
              setTransferComment("");
              setAddPositionModalOpen(false);
              setAddPositionSearch("");
              reloadBalances();
              reloadMoves();
            } catch (err) {
              setTransferError(
                validateResErrors(
                  err,
                  "Не удалось создать передачу в процесс работ",
                ),
              );
            } finally {
              setTransferSubmitting(false);
            }
          }}
        >
          <div className="building-page__filters" style={{ marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="building-page__label">Процесс работ</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  className="building-page__input"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "#fff",
                    cursor: "default",
                    minHeight: 40,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {transferWorkOptions.find(
                    (e) => (e?.uuid ?? e?.id) === transferWorkEntryId,
                  )?.title ||
                    transferWorkOptions.find(
                      (e) => (e?.uuid ?? e?.id) === transferWorkEntryId,
                    )?.description ||
                    transferWorkEntryId ||
                    "Выберите процесс работ"}
                </div>
                <button
                  type="button"
                  className="building-btn building-btn--primary"
                  onClick={() => setTransferWorkPickerOpen(true)}
                >
                  Выбрать
                </button>
              </div>
              {transferWorkLoading && (
                <div className="building-page__muted" style={{ marginTop: 4 }}>
                  Загрузка...
                </div>
              )}
              {transferWorkError && (
                <div className="building-page__error" style={{ marginTop: 4 }}>
                  {String(transferWorkError)}
                </div>
              )}
            </div>
          </div>

          <div
            className="building-page__filters"
            style={{ gridTemplateColumns: "1fr", gap: 12 }}
          >
            <div className="building-page__label">Позиции</div>
            {transferItems.map((row, index) => {
              const maxQty = Number(row.balance);
              const isOver = (() => {
                const q = parseFloat(String(row.quantity).replace(",", "."));
                return !Number.isNaN(q) && Number.isFinite(maxQty) && q > maxQty;
              })();
              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: "12px",
                    border: "1px solid rgba(11, 35, 68, 0.12)",
                    borderRadius: 12,
                    background: "rgba(11, 35, 68, 0.02)",
                  }}
                >
                  <div>
                    <label
                      className="building-page__muted"
                      style={{ fontSize: 12, marginBottom: 4, display: "block" }}
                    >
                      Наименование
                    </label>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#0b2344",
                        fontWeight: 600,
                        wordBreak: "break-word",
                      }}
                    >
                      {row.name || row.nomenclature || "—"}
                    </div>
                  </div>
                  <div>
                    <label
                      className="building-page__muted"
                      style={{ fontSize: 12, marginBottom: 4, display: "block" }}
                    >
                      Ед. измерения
                    </label>
                    <div style={{ fontSize: 13, color: "#0b2344" }}>
                      {row.unit || "—"}
                    </div>
                  </div>
                  <div>
                    <label
                      className="building-page__muted"
                      style={{ fontSize: 12, marginBottom: 4, display: "block" }}
                    >
                      Количество {Number.isFinite(maxQty) ? `(макс. ${maxQty})` : ""}
                    </label>
                    <input
                      className="building-page__input"
                      type="number"
                      min={0}
                      max={Number.isFinite(maxQty) ? maxQty : undefined}
                      step="any"
                      value={row.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTransferItems((prev) => {
                          const next = [...prev];
                          next[index] = { ...next[index], quantity: val };
                          return next;
                        });
                      }}
                      placeholder="0"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        fontSize: 13,
                        ...(isOver
                          ? {
                              borderColor: "var(--danger, #c00)",
                              color: "var(--danger, #c00)",
                            }
                          : {}),
                      }}
                    />
                    {isOver && (
                      <div
                        className="building-page__error"
                        style={{ fontSize: 12, marginTop: 4 }}
                      >
                        Больше остатка на складе ({maxQty})
                      </div>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      className="building-btn"
                      onClick={() => {
                        setTransferItems((prev) => prev.filter((_, i) => i !== index));
                      }}
                      title="Удалить"
                      style={{
                        width: "100%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        color: "var(--danger, #c00)",
                      }}
                    >
                      <Trash2 size={18} />
                      Удалить позицию
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="building-btn"
              style={{ marginTop: 4, width: "100%", justifyContent: "center" }}
              onClick={() => setAddPositionModalOpen(true)}
            >
              Добавить позицию
            </button>
          </div>

          <div className="building-page__filters" style={{ marginTop: 12 }}>
            <div style={{ width: "100%" }}>
              <label className="building-page__label">Кому передали</label>
              <input
                className="building-page__input"
                value={transferIssuedTo}
                onChange={(e) => setTransferIssuedTo(e.target.value)}
                placeholder="ФИО / кому передали"
              />
            </div>
          </div>

          <div className="building-page__filters" style={{ marginTop: 12 }}>
            <div style={{ width: "100%" }}>
              <label className="building-page__label">Комментарий</label>
              <textarea
                className="building-page__textarea"
                rows={3}
                value={transferComment}
                onChange={(e) => setTransferComment(e.target.value)}
                placeholder="Необязательно"
              />
            </div>
          </div>

          {transferError && (
            <div className="building-page__error" style={{ marginTop: 8 }}>
              {String(transferError)}
            </div>
          )}

          <div className="building-page__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="building-btn"
              onClick={() => {
                if (transferSubmitting) return;
                setTransferToWorkModalOpen(false);
                setTransferError(null);
                setTransferWorkEntryId("");
                setTransferWorkSearch("");
                setTransferItems([]);
                setTransferIssuedTo("");
                setTransferComment("");
                setAddPositionModalOpen(false);
                setAddPositionSearch("");
              }}
              disabled={transferSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={transferSubmitting}
            >
              {transferSubmitting ? "Создание..." : "Создать передачу"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={transferWorkPickerOpen}
        onClose={() => setTransferWorkPickerOpen(false)}
        title="Выбрать процесс работ"
      >
        <div className="building-page">
          <div className="building-page__filters" style={{ marginBottom: 8 }}>
            <input
              className="building-page__input"
              value={transferWorkSearch}
              onChange={(e) => setTransferWorkSearch(e.target.value)}
              placeholder="Поиск по процессам работ..."
            />
          </div>
          {transferWorkLoading && (
            <div className="building-page__muted">Загрузка...</div>
          )}
          {transferWorkError && (
            <div className="building-page__error">
              {String(transferWorkError)}
            </div>
          )}
          {!transferWorkLoading && !transferWorkError && transferWorkOptions.length === 0 && (
            <div className="building-page__muted">
              Процессы работ не найдены. Введите другой поиск.
            </div>
          )}
          {!transferWorkLoading && !transferWorkError && transferWorkOptions.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              {transferWorkOptions.map((entry) => {
                const uid = entry?.uuid ?? entry?.id ?? "";
                const label =
                  entry?.title ||
                  entry?.description ||
                  uid ||
                  "Без названия";
                return (
                  <button
                    key={uid}
                    type="button"
                    className="building-page__card"
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: transferWorkEntryId === uid ? "rgba(11, 35, 68, 0.06)" : "#ffffff",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setTransferWorkEntryId(uid);
                      setTransferWorkPickerOpen(false);
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={addPositionModalOpen}
        onClose={() => {
          setAddPositionModalOpen(false);
          setAddPositionSearch("");
        }}
        title="Выбрать позицию со склада"
      >
        <div className="building-page">
          <div className="building-page__filters" style={{ marginBottom: 8 }}>
            <input
              className="building-page__input"
              value={addPositionSearch}
              onChange={(e) => setAddPositionSearch(e.target.value)}
              placeholder="Поиск по названию"
            />
          </div>
          {itemsLoading && (
            <div className="building-page__muted">Загрузка остатков...</div>
          )}
          {itemsError && (
            <div className="building-page__error">
              {String(validateResErrors(itemsError, "Не удалось загрузить остатки склада"))}
            </div>
          )}
          {!itemsLoading && !itemsError && stockItems.length === 0 && (
            <div className="building-page__muted">Нет позиций на складе.</div>
          )}
          {!itemsLoading && !itemsError && stockItems.length > 0 && (() => {
            const addedIds = new Set(
              transferItems.map((r) => String(r.nomenclature).trim()).filter(Boolean),
            );
            const filtered = stockItems
              .filter((item) => {
                const q = debouncedAddPositionSearch.toLowerCase().trim();
                if (q) {
                  const hay = `${item?.name || ""} ${item?.warehouse_name || ""}`.toLowerCase();
                  if (!hay.includes(q)) return false;
                }
                const iid = item?.id ?? item?.uuid ?? item?.stock_item ?? "";
                return !addedIds.has(String(iid));
              })
              .map((item) => {
                const iid = item?.id ?? item?.uuid ?? item?.stock_item ?? "";
                const name = item?.name || "Товар";
                const qty = Number(item?.quantity ?? item?.qty ?? 0);
                const unit = item?.unit || "";
                return { iid, name, qty, unit, item };
              });
            if (filtered.length === 0) {
              return (
                <div className="building-page__muted">
                  {addedIds.size > 0 && !debouncedAddPositionSearch
                    ? "Все позиции уже добавлены. Укажите поиск или удалите позицию из списка."
                    : "Нет подходящих позиций."}
                </div>
              );
            }
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {filtered.map(({ iid, name, qty, unit }) => (
                  <button
                    key={iid}
                    type="button"
                    className="building-page__card"
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setTransferItems((prev) => [
                        ...prev,
                        {
                          nomenclature: iid,
                          name,
                          quantity: "",
                          unit,
                          balance: qty,
                        },
                      ]);
                      setAddPositionModalOpen(false);
                      setAddPositionSearch("");
                    }}
                  >
                    <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
                      {name}
                    </div>
                    <div className="building-page__muted" style={{ fontSize: 12 }}>
                      Остаток: {qty} {unit}
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
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

