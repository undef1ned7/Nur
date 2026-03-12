import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, LayoutGrid, Table2 } from "lucide-react";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingWorkEntries } from "@/store/slices/building/workEntriesSlice";
import {
  fetchBuildingWorkEntries,
  fetchBuildingWorkEntryById,
  createBuildingWorkEntry,
  updateBuildingWorkEntry,
  deleteBuildingWorkEntry,
} from "@/store/creators/building/workEntriesCreators";
import { fetchBuildingContractors } from "@/store/creators/building/contractorsCreators";
import { fetchBuildingClients } from "@/store/creators/building/clientsCreators";
import { fetchBuildingTreaties } from "@/store/creators/building/treatiesCreators";
import { useBuildingContractors } from "@/store/slices/building/contractorsSlice";
import { useBuildingClients } from "@/store/slices/building/clientsSlice";
import { useBuildingTreaties } from "@/store/slices/building/treatiesSlice";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import BuildingPagination from "../shared/Pagination";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asDateTime } from "../shared/constants";
import BuildingActionsMenu from "../shared/ActionsMenu";
import "./Work.scss";

const VIEW_MODES = { TABLE: "table", CARDS: "cards" };
const STORAGE_KEY = "building_work_view_mode";

const CATEGORY_LABELS = {
  note: "Заметка",
  treaty: "По договору",
  defect: "Дефект",
  report: "Отчёт",
  other: "Другое",
};

const WORK_STATUS_LABELS = {
  planned: "Запланировано",
  in_progress: "В работе",
  paused: "Приостановлено",
  completed: "Завершено",
  cancelled: "Отменено",
};

const FORM_INITIAL = {
  residential_complex: "",
  contractor: "",
  contract_amount: "",
  contract_term_start: "",
  contract_term_end: "",
  work_status: "planned",
  client: "",
  treaty: "",
  category: "note",
  title: "",
  description: "",
  occurred_at: "",
};

export default function BuildingWorkProcess() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    list,
    count,
    loading,
    error,
    creating,
    updatingIds,
    deletingIds,
    actionError,
    current: currentEntry,
  } = useBuildingWorkEntries();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [workStatusFilter, setWorkStatusFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const { list: contractorsList } = useBuildingContractors();
  const { list: clientsList } = useBuildingClients();
  const { list: treatiesList } = useBuildingTreaties();

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [formError, setFormError] = useState(null);

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count]
  );

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const list = Array.isArray(projects) ? projects : [];
    const found = list.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId)
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingContractors({ residential_complex: selectedProjectId }));
    dispatch(fetchBuildingClients({ residential_complex: selectedProjectId }));
    dispatch(fetchBuildingTreaties({ residential_complex: selectedProjectId }));
  }, [dispatch, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const params = {
      residential_complex: selectedProjectId,
      category: category || undefined,
      work_status: workStatusFilter || undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    };
    dispatch(fetchBuildingWorkEntries(params));
  }, [dispatch, selectedProjectId, category, workStatusFilter, debouncedSearch, page]);

  const editIdFromUrl = searchParams.get("edit");
  useEffect(() => {
    if (!editIdFromUrl) return;
    dispatch(fetchBuildingWorkEntryById(editIdFromUrl));
  }, [dispatch, editIdFromUrl]);

  useEffect(() => {
    if (!editIdFromUrl || !currentEntry) return;
    const id = currentEntry?.id ?? currentEntry?.uuid;
    if (String(id) !== String(editIdFromUrl)) return;
    const entry = currentEntry;
    setEditing(entry);
    const rcId = entry?.residential_complex ?? entry?.residential_complex_id ?? selectedProjectId ?? "";
    setForm({
      residential_complex: rcId || selectedProjectId || "",
      contractor: entry?.contractor ?? entry?.contractor_id ?? "",
      contract_amount: entry?.contract_amount != null ? String(entry.contract_amount) : "",
      contract_term_start: entry?.contract_term_start
        ? String(entry.contract_term_start).slice(0, 10)
        : "",
      contract_term_end: entry?.contract_term_end
        ? String(entry.contract_term_end).slice(0, 10)
        : "",
      work_status: entry?.work_status || "planned",
      client: entry?.client ?? entry?.client_id ?? "",
      treaty: entry?.treaty ?? entry?.treaty_id ?? "",
      category: entry?.category || "note",
      title: entry?.title || "",
      description: entry?.description || "",
      occurred_at: entry?.occurred_at
        ? String(entry.occurred_at).slice(0, 16)
        : "",
    });
    setFormError(null);
    setOpenModal(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("edit");
      return next;
    });
  }, [editIdFromUrl, currentEntry, selectedProjectId, setSearchParams]);

  const openCreate = () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    setEditing(null);
    setForm({
      ...FORM_INITIAL,
      residential_complex: selectedProjectId,
      work_status: "planned",
    });
    setFormError(null);
    setOpenModal(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    const rcId = entry?.residential_complex ?? entry?.residential_complex_id ?? selectedProjectId ?? "";
    setForm({
      residential_complex: rcId || selectedProjectId || "",
      contractor: entry?.contractor ?? entry?.contractor_id ?? "",
      contract_amount: entry?.contract_amount != null ? String(entry.contract_amount) : "",
      contract_term_start: entry?.contract_term_start
        ? String(entry.contract_term_start).slice(0, 10)
        : "",
      contract_term_end: entry?.contract_term_end
        ? String(entry.contract_term_end).slice(0, 10)
        : "",
      work_status: entry?.work_status || "planned",
      client: entry?.client ?? entry?.client_id ?? "",
      treaty: entry?.treaty ?? entry?.treaty_id ?? "",
      category: entry?.category || "note",
      title: entry?.title || "",
      description: entry?.description || "",
      occurred_at: entry?.occurred_at
        ? String(entry.occurred_at).slice(0, 16)
        : "",
    });
    setFormError(null);
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(FORM_INITIAL);
    setFormError(null);
  };

  const handleFormChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    if (!String(form.title || "").trim()) {
      setFormError("Название обязательно");
      return;
    }
    const rcId = form.residential_complex || selectedProjectId;
    const payload = {
      residential_complex: rcId || null,
      contractor: form.contractor || null,
      contract_amount:
        form.contract_amount !== "" && !Number.isNaN(Number(form.contract_amount))
          ? String(form.contract_amount)
          : null,
      contract_term_start: form.contract_term_start || null,
      contract_term_end: form.contract_term_end || null,
      work_status: form.work_status || "planned",
      client: form.client || null,
      treaty: form.treaty || null,
      category: form.category || "note",
      title: String(form.title || "").trim(),
      description: String(form.description || "").trim() || "",
      occurred_at: form.occurred_at || null,
    };

    try {
      let res;
      if (editing) {
        const id = editing?.id ?? editing?.uuid;
        if (!id) return;
        res = await dispatch(updateBuildingWorkEntry({ id, payload }));
      } else {
        res = await dispatch(createBuildingWorkEntry(payload));
      }
      if (res.meta.requestStatus === "fulfilled") {
        alert(editing ? "Запись обновлена" : "Запись создана");
        closeModal();
        setPage(1);
        dispatch(
          fetchBuildingWorkEntries({
            residential_complex: selectedProjectId,
            category: category || undefined,
            work_status: workStatusFilter || undefined,
            search: debouncedSearch || undefined,
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
          })
        );
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить запись"
          )
        );
      }
    } catch (err) {
      setFormError(
        validateResErrors(err, "Не удалось сохранить запись")
      );
    }
  };

  const handleDelete = (entry) => {
    const id = entry?.id ?? entry?.uuid;
    if (!id) return;
    confirm(
      `Удалить запись «${entry?.title || "запись"}»?`,
      async (ok) => {
        if (!ok) return;
        try {
          const res = await dispatch(deleteBuildingWorkEntry(id));
          if (res.meta.requestStatus === "fulfilled") {
            alert("Запись удалена");
            dispatch(
              fetchBuildingWorkEntries({
                residential_complex: selectedProjectId,
                category: category || undefined,
                search: debouncedSearch || undefined,
                page,
                page_size: DEFAULT_PAGE_SIZE,
              })
            );
          } else {
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось удалить запись"
              ),
              true
            );
          }
        } catch (err) {
          alert(
            validateResErrors(err, "Не удалось удалить запись"),
            true
          );
        }
      }
    );
  };

  const displayCount = Array.isArray(list) ? list.length : 0;
  const totalCount = count ?? 0;

  return (
    <div className="warehouse-page building-page building-page--work">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">
            <ClipboardList size={24} />
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Процесс работ</h1>
            <p className="warehouse-header__subtitle">
              {selectedProjectId ? (
                <>
                  ЖК: <b>{selectedProjectName}</b>. Дефекты, заметки и события по
                  объекту.
                </>
              ) : (
                "Выберите жилой комплекс в шапке раздела."
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Добавить запись
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по названию/описанию/клиенту/договору"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            {selectedProjectId
              ? `Показано ${displayCount} из ${totalCount} записей`
              : "Выберите жилой комплекс в шапке раздела."}
          </span>
          <select
            className="warehouse-filter-modal__select-small"
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
          >
            <option value="">Все категории</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="warehouse-filter-modal__select-small"
            value={workStatusFilter}
            onChange={(e) => {
              setPage(1);
              setWorkStatusFilter(e.target.value);
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(WORK_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
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
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
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
        <div className="mt-2 text-sm text-red-500">
          {String(
            validateResErrors(error, "Не удалось загрузить процесс работ"),
          )}
        </div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {viewMode === VIEW_MODES.TABLE ? (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Категория</th>
                  <th>Статус</th>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Автор</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {!selectedProjectId ? (
                  <tr>
                    <td colSpan={7} className="warehouse-table__empty">
                      Выберите жилой комплекс в шапке раздела.
                    </td>
                  </tr>
                ) : loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : !loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="warehouse-table__empty">
                      Записей пока нет.
                    </td>
                  </tr>
                ) : (
                  list.map((entry) => {
                    const id = entry?.id ?? entry?.uuid;
                    const busyDelete = id != null && deletingIds?.[id];
                    const busyUpdate = id != null && updatingIds?.[id];
                    const busy = busyDelete || busyUpdate;
                    return (
                      <tr
                        key={id}
                        onClick={() => navigate(`/crm/building/work/${id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          {asDateTime(
                            entry?.occurred_at || entry?.created_at,
                          )}
                        </td>
                        <td>
                          {CATEGORY_LABELS[entry?.category] ||
                            entry?.category ||
                            "—"}
                        </td>
                        <td>
                          {WORK_STATUS_LABELS[entry?.work_status] ||
                            entry?.work_status ||
                            "—"}
                        </td>
                        <td>{entry?.title || "—"}</td>
                        <td>{entry?.description || "—"}</td>
                        <td>{entry?.created_by_display || "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <BuildingActionsMenu
                            actions={[
                              {
                                label: "Открыть",
                                onClick: () =>
                                  navigate(`/crm/building/work/${id}`),
                              },
                              {
                                label: "Изменить",
                                onClick: () => openEdit(entry),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(entry),
                                disabled: busy,
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите жилой комплекс в шапке раздела.
                </div>
              ) : loading && list.length === 0 ? (
                <div className="warehouse-table__loading">Загрузка...</div>
              ) : !loading && list.length === 0 ? (
                <div className="warehouse-table__empty">
                  Записей пока нет.
                </div>
              ) : (
                list.map((entry) => {
                  const id = entry?.id ?? entry?.uuid;
                  const busy =
                    (id != null && deletingIds?.[id]) ||
                    (id != null && updatingIds?.[id]);
                  return (
                    <div
                      key={id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                      onClick={() => navigate(`/crm/building/work/${id}`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {entry?.title || "—"}
                          </div>
                          <div className="mt-1 text-xs text-slate-600 line-clamp-2">
                            {entry?.description || "—"}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {CATEGORY_LABELS[entry?.category] ||
                            entry?.category ||
                            "—"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        {WORK_STATUS_LABELS[entry?.work_status] ||
                          entry?.work_status ||
                          "—"}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Дата</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {asDateTime(
                              entry?.occurred_at || entry?.created_at,
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Автор</div>
                          <div className="mt-0.5 font-semibold text-slate-900 truncate">
                            {entry?.created_by_display || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="px-3 py-2 flex-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(entry);
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="px-3 py-2 flex-1 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <BuildingPagination
            page={page}
            totalPages={totalPages}
            disabled={loading}
            onChange={setPage}
          />

          {actionError && (
            <div className="building-page__error" style={{ marginTop: 12 }}>
              {String(
                validateResErrors(
                  actionError,
                  "Ошибка при сохранении/удалении записи",
                ),
              )}
            </div>
          )}
        </div>
      </DataContainer>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить запись" : "Добавить запись"}
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleSubmit}
        >
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Жилой комплекс</label>
            <select
              className="add-product-page__input"
              value={form.residential_complex}
              onChange={handleFormChange("residential_complex")}
            >
              <option value="">—</option>
              {(Array.isArray(projects) ? projects : []).map((p) => {
                const pid = p?.id ?? p?.uuid;
                return (
                  <option key={pid} value={pid}>
                    {p?.name || pid}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Подрядчик</label>
            <select
              className="add-product-page__input"
              value={form.contractor}
              onChange={handleFormChange("contractor")}
            >
              <option value="">—</option>
              {(Array.isArray(contractorsList) ? contractorsList : []).map((c) => {
                const cid = c?.id ?? c?.uuid;
                return (
                  <option key={cid} value={cid}>
                    {c?.company_name ?? c?.name ?? c?.title ?? cid}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Клиент</label>
            <select
              className="add-product-page__input"
              value={form.client}
              onChange={handleFormChange("client")}
            >
              <option value="">—</option>
              {(Array.isArray(clientsList) ? clientsList : []).map((c) => {
                const cid = c?.id ?? c?.uuid;
                return (
                  <option key={cid} value={cid}>
                    {c?.name ?? c?.title ?? cid}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Договор</label>
            <select
              className="add-product-page__input"
              value={form.treaty}
              onChange={handleFormChange("treaty")}
            >
              <option value="">—</option>
              {(Array.isArray(treatiesList) ? treatiesList : []).map((t) => {
                const tid = t?.id ?? t?.uuid;
                return (
                  <option key={tid} value={tid}>
                    {t?.number ?? t?.title ?? tid}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Статус работ</label>
            <select
              className="add-product-page__input"
              value={form.work_status}
              onChange={handleFormChange("work_status")}
            >
              {Object.entries(WORK_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Сумма договора</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="add-product-page__input"
              value={form.contract_amount}
              onChange={handleFormChange("contract_amount")}
              placeholder="0"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Начало работ</label>
              <input
                type="date"
                className="add-product-page__input"
                value={form.contract_term_start}
                onChange={handleFormChange("contract_term_start")}
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Окончание работ</label>
              <input
                type="date"
                className="add-product-page__input"
                value={form.contract_term_end}
                onChange={handleFormChange("contract_term_end")}
              />
            </div>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Категория</label>
            <select
              className="add-product-page__input"
              value={form.category}
              onChange={handleFormChange("category")}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Название</label>
            <input
              className="add-product-page__input"
              value={form.title}
              onChange={handleFormChange("title")}
              required
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Описание</label>
            <textarea
              className="add-product-page__input"
              rows={4}
              value={form.description}
              onChange={handleFormChange("description")}
              style={{ resize: "vertical", minHeight: 80 }}
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">
              Когда произошло
            </label>
            <input
              type="datetime-local"
              className="add-product-page__input"
              value={form.occurred_at}
              onChange={handleFormChange("occurred_at")}
            />
          </div>
          {formError && (
            <div className="add-product-page__error">{String(formError)}</div>
          )}
          <div className="add-product-page__actions">
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={closeModal}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={creating}
            >
              {creating ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

