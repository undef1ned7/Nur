import React, { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  createBuildingProcurement,
  createBuildingTransferFromProcurement,
  fetchBuildingProcurements,
  submitBuildingProcurementToCash,
} from "@/store/creators/building/procurementsCreators";
import { fetchBuildingWarehouses } from "@/store/creators/building/warehousesCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import { useDispatch } from "react-redux";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import {
  PROCUREMENT_STATUS_LABELS,
  asCurrency,
  asDateTime,
  statusLabel,
} from "../shared/constants";
import { useBuildingProcurements } from "@/store/slices/building/procurementsSlice";
import { useNavigate } from "react-router-dom";
import "./Procurement.scss";

const CREATE_INITIAL = {
  title: "",
  comment: "",
};

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

const STORAGE_KEY = "building_procurements_view_mode";

const statusClass = (status) => {
  if (status === "cash_rejected" || status === "partially_transferred") {
    return "building-page__status is-danger";
  }
  if (status === "cash_approved" || status === "transferred") {
    return "building-page__status is-success";
  }
  if (status === "submitted_to_cash" || status === "transfer_created") {
    return "building-page__status is-warning";
  }
  return "building-page__status";
};

function ProcurementPagination({ page, totalPages, count, loading, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const hasPrevPage = page > 1;
  const hasNextPage = totalPages && page < totalPages;

  return (
    <div className="warehouse-pagination">
      <button
        type="button"
        className="warehouse-pagination__btn"
        onClick={() => onChange(page - 1)}
        disabled={!hasPrevPage || loading}
      >
        Назад
      </button>
      <span className="warehouse-pagination__info">
        Страница {page} из {totalPages ?? 1}
        {typeof count === "number" ? ` (${count} закупок)` : ""}
      </span>
      <button
        type="button"
        className="warehouse-pagination__btn"
        onClick={() => onChange(page + 1)}
        disabled={!hasNextPage || loading}
      >
        Вперед
      </button>
    </div>
  );
}

export default function BuildingProcurement() {
  const alert = useAlert();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedProjectId, items: projects } = useBuildingProjects();

  const {
    list,
    count,
    loading,
    error,
    creating,
    createError: createErrorFromSlice,
    submittingToCashIds,
    creatingTransferIds,
    actionError,
  } = useBuildingProcurements();
  const {
    list: warehouses,
    loading: warehousesLoading,
    error: warehousesError,
  } = useBuildingWarehouses();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState(CREATE_INITIAL);
  const [transferModal, setTransferModal] = useState({
    open: false,
    procurement: null,
    warehouseId: "",
    note: "",
  });
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });

  const selectedProjectName = useMemo(() => {
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (project) =>
        String(project?.id ?? project?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [projects, selectedProjectId]);

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingProcurements({
        residential_complex: selectedProjectId,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      }),
    );
  }, [dispatch, filters.search, filters.status, page, selectedProjectId]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке", true);
      return;
    }
    if (!String(createForm.title).trim()) return;

    try {
      const res = await dispatch(
        createBuildingProcurement({
          residential_complex: selectedProjectId,
          title: String(createForm.title || "").trim(),
          comment: String(createForm.comment || "").trim(),
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        setCreateForm(CREATE_INITIAL);
        setOpenCreate(false);
        alert("Закупка успешно создана");
        setPage(1);
      } else {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Ошибка создания закупки",
          ),
          true,
        );
      }
    } catch (err) {
      alert(validateResErrors(err, "Ошибка создания закупки"), true);
    }
  };

  const onSubmitToCash = (procurement) => {
    const procurementId = procurement?.id ?? procurement?.uuid;
    if (!procurementId) return;
    confirm("Отправить закупку в кассу?", async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(
          submitBuildingProcurementToCash(procurementId),
        );
        if (res.meta.requestStatus === "fulfilled") {
          alert("Закупка отправлена в кассу");
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              "Не удалось отправить в кассу",
            ),
            true,
          );
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось отправить в кассу"), true);
      }
    });
  };

  const openTransferModal = (procurement) => {
    setTransferModal({
      open: true,
      procurement,
      warehouseId: "",
      note: "",
    });
    const rcId =
      procurement?.residential_complex ?? selectedProjectId;
    if (rcId) {
      dispatch(
        fetchBuildingWarehouses({
          residential_complex: rcId,
          is_active: true,
          page_size: 100,
        }),
      );
    }
  };

  const closeTransferModal = () => {
    setTransferModal({ open: false, procurement: null, warehouseId: "", note: "" });
  };

  const submitTransfer = async (e) => {
    e.preventDefault();
    const procurement = transferModal.procurement;
    const procurementId = procurement?.id ?? procurement?.uuid;
    if (!procurementId || !String(transferModal.warehouseId || "").trim()) {
      alert("Выберите склад", true);
      return;
    }
    try {
      const res = await dispatch(
        createBuildingTransferFromProcurement({
          procurementId,
          payload: {
            note: String(transferModal.note || "").trim(),
            warehouse: transferModal.warehouseId,
          },
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Передача на склад создана");
        closeTransferModal();
        dispatch(
          fetchBuildingProcurements({
            residential_complex: selectedProjectId,
            status: filters.status || undefined,
            search: filters.search || undefined,
            page,
            page_size: DEFAULT_PAGE_SIZE,
          }),
        );
      } else {
        alert(
          validateResErrors(res.payload || res.error, "Не удалось создать передачу"),
          true,
        );
      }
    } catch (err) {
      alert(validateResErrors(err, "Не удалось создать передачу"), true);
    }
  };

  const renderActions = (procurement) => {
    const status = procurement?.status;
    const pid = procurement?.id ?? procurement?.uuid;
    if (status === "draft") {
      const busy = pid != null && submittingToCashIds?.[pid] === true;
      return (
        <button
          type="button"
          className="building-btn building-btn--primary !py-2"
          onClick={() => onSubmitToCash(procurement)}
          disabled={busy}
        >
          {busy ? "Отправка..." : "Отправить в кассу"}
        </button>
      );
    }
    if (status === "cash_approved") {
      const busy = pid != null && creatingTransferIds?.[pid] === true;
      return (
        <button
          type="button"
          className="building-btn building-btn--primary !py-2"
          onClick={() => openTransferModal(procurement)}
          disabled={busy}
        >
          {busy ? "Создание..." : "Отправить на склад"}
        </button>
      );
    }
    return null;
  };

  const totalProcurements = typeof count === "number" ? count : 0;
  const pageCount = Array.isArray(list) ? list.length : 0;

  return (
    <div className="warehouse-page building-page building-page--procurement">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">📦</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Закупки строительства</h1>
            <p className="warehouse-header__subtitle">
              ЖК: <b>{selectedProjectName}</b>. Управляйте заявками, отправкой в
              кассу и созданием передач на склад.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          onClick={() => setOpenCreate(true)}
          disabled={!selectedProjectId}
        >
          Новая закупка
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={filters.search}
            placeholder="Поиск по названию и комментарию"
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, search: e.target.value }));
            }}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <select
            className="warehouse-filter-modal__select-medium"
            style={{ padding: "11px 12px" }}
            value={filters.status}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, status: e.target.value }));
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(PROCUREMENT_STATUS_LABELS).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          <span>
            {selectedProjectId
              ? `Найдено ${pageCount} из ${totalProcurements} закупок`
              : "Выберите проект, чтобы увидеть закупки."}
          </span>

          <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.TABLE
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <Table2 size={16} />
              Таблица
            </button>

            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.CARDS)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.CARDS
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-500">{String(error)}</div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {viewMode === VIEW_MODES.TABLE ? (
            <>
              <table className="warehouse-table w-full">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Сумма / дата</th>
                    <th>Статус</th>
                    <th className="flex justify-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedProjectId ? (
                    <tr>
                      <td colSpan={4} className="warehouse-table__empty">
                        Выберите проект, чтобы увидеть закупки.
                      </td>
                    </tr>
                  ) : loading && list.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="warehouse-table__loading">
                        Загрузка...
                      </td>
                    </tr>
                  ) : !loading && list.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="warehouse-table__empty">
                        Закупки не найдены.
                      </td>
                    </tr>
                  ) : (
                    list.map((procurement) => {
                      const procurementId =
                        procurement?.id ?? procurement?.uuid;
                      return (
                        <tr key={procurementId}>
                          <td>{procurement?.title || "Без названия"}</td>
                          <td>
                            <div className="text-sm text-slate-900">
                              {asCurrency(procurement?.total_amount)}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {asDateTime(procurement?.created_at)}
                            </div>
                          </td>
                          <td>
                            <span className={statusClass(procurement?.status)}>
                              {statusLabel(
                                procurement?.status,
                                PROCUREMENT_STATUS_LABELS,
                              )}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                className="px-3 py-3 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                onClick={() =>
                                  navigate(
                                    `/crm/building/procurement/${procurementId}`,
                                  )
                                }
                              >
                                Открыть
                              </button>
                              {renderActions(procurement)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <ProcurementPagination
                page={page}
                totalPages={totalPages}
                count={count}
                loading={loading}
                onChange={setPage}
              />
            </>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите проект, чтобы увидеть закупки.
                </div>
              ) : loading && list.length === 0 ? (
                <div className="warehouse-table__loading">Загрузка...</div>
              ) : !loading && list.length === 0 ? (
                <div className="warehouse-table__empty">
                  Закупки не найдены.
                </div>
              ) : (
                list.map((procurement) => {
                  const procurementId = procurement?.id ?? procurement?.uuid;
                  return (
                    <div
                      key={procurementId}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                      onClick={() =>
                        navigate(`/crm/building/procurement/${procurementId}`)
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {procurement?.title || "Без названия"}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {asCurrency(procurement?.total_amount)} •{" "}
                            {asDateTime(procurement?.created_at)}
                          </div>
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <span className={statusClass(procurement?.status)}>
                            {statusLabel(
                              procurement?.status,
                              PROCUREMENT_STATUS_LABELS,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 w-1/2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/crm/building/procurement/${procurementId}`,
                            );
                          }}
                        >
                          Открыть
                        </button>
                        <div
                          className="w-1/2 flex justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderActions(procurement)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </DataContainer>

      <Modal
        open={transferModal.open}
        onClose={closeTransferModal}
        title="Отправить на склад"
      >
        <form className="building-page" onSubmit={submitTransfer}>
          <div className="building-page__muted" style={{ marginBottom: 8 }}>
            {transferModal.procurement?.title || "Закупка"}
          </div>
          <label>
            <div className="building-page__label">Склад *</div>
            <select
              className="building-page__select"
              value={transferModal.warehouseId}
              onChange={(e) =>
                setTransferModal((prev) => ({
                  ...prev,
                  warehouseId: e.target.value,
                }))
              }
              disabled={warehousesLoading}
              required
            >
              <option value="">
                {warehousesLoading ? "Загрузка складов..." : "Выберите склад"}
              </option>
              {warehousesError && (
                <option value="" disabled>
                  {String(warehousesError)}
                </option>
              )}
              {warehouses.map((w) => (
                <option key={w.id ?? w.uuid} value={w.id ?? w.uuid}>
                  {w.name || "Без названия"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Комментарий (необязательно)</div>
            <textarea
              rows={3}
              className="building-page__textarea"
              value={transferModal.note}
              onChange={(e) =>
                setTransferModal((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Примечание к передаче"
            />
          </label>
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeTransferModal}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={!transferModal.warehouseId || creatingTransferIds?.[transferModal.procurement?.id ?? transferModal.procurement?.uuid]}
            >
              Создать передачу
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Создать закупку"
      >
        <form className="building-page" onSubmit={onCreate}>
          <label>
            <div className="building-page__label">Название</div>
            <input
              className="building-page__input"
              value={createForm.title}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </label>
          <label>
            <div className="building-page__label">Комментарий</div>
            <textarea
              className="building-page__textarea"
              rows={4}
              value={createForm.comment}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, comment: e.target.value }))
              }
            />
          </label>
          {(createErrorFromSlice || actionError) && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  createErrorFromSlice || actionError,
                  "Ошибка",
                ),
              )}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              disabled={creating}
              onClick={() => setOpenCreate(false)}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={creating || !String(createForm.title).trim()}
            >
              {creating ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
