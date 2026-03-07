import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ClipboardList, LayoutGrid, Table2 } from "lucide-react";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingWorkEntries } from "@/store/slices/building/workEntriesSlice";
import {
  fetchBuildingWorkEntries,
  createBuildingWorkEntry,
  updateBuildingWorkEntry,
  deleteBuildingWorkEntry,
} from "@/store/creators/building/workEntriesCreators";
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

const FORM_INITIAL = {
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
  const {
    list,
    count,
    loading,
    error,
    creating,
    updatingIds,
    deletingIds,
    actionError,
  } = useBuildingWorkEntries();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

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
    const params = {
      residential_complex: selectedProjectId,
      category: category || undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    };
    dispatch(fetchBuildingWorkEntries(params));
  }, [dispatch, selectedProjectId, category, debouncedSearch, page]);

  const openCreate = () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    setEditing(null);
    setForm(FORM_INITIAL);
    setFormError(null);
    setOpenModal(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      category: entry?.category || "note",
      title: entry?.title || "",
      description: entry?.description || "",
      occurred_at: entry?.occurred_at
        ? entry.occurred_at.slice(0, 16)
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
    const payload = {
      residential_complex: selectedProjectId,
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
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Автор</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {!selectedProjectId ? (
                  <tr>
                    <td colSpan={6} className="warehouse-table__empty">
                      Выберите жилой комплекс в шапке раздела.
                    </td>
                  </tr>
                ) : loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : !loading && list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="warehouse-table__empty">
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

