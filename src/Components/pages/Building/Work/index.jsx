import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
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

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            Процесс работ
          </h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Здесь фиксируются дефекты,
            заметки и другие события по объекту.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Добавить запись
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters">
          <input
            className="building-page__input"
            value={search}
            placeholder="Поиск по названию/описанию/клиенту/договору"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <select
            className="building-page__select"
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
        </div>
        {error && (
          <div className="building-page__error">
            {String(
              validateResErrors(error, "Не удалось загрузить процесс работ")
            )}
          </div>
        )}
      </div>

      <div className="building-page__card">
        {(!selectedProjectId || loading) && (
          <div className="building-page__muted">
            {!selectedProjectId
              ? "Выберите жилой комплекс в шапке раздела."
              : "Загрузка..."}
          </div>
        )}
        {selectedProjectId && !loading && list.length === 0 && (
          <div className="building-page__muted">
            Записей пока нет.
          </div>
        )}
        {selectedProjectId && !loading && list.length > 0 && (
          <div className="building-table building-table--shadow">
            <table>
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
                {list.map((entry) => {
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
                      <td>{asDateTime(entry?.occurred_at || entry?.created_at)}</td>
                      <td>{CATEGORY_LABELS[entry?.category] || entry?.category || "—"}</td>
                      <td>{entry?.title || "—"}</td>
                      <td>{entry?.description || "—"}</td>
                      <td>{entry?.created_by_display || "—"}</td>
                      <td>
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
                })}
              </tbody>
            </table>
          </div>
        )}
        <BuildingPagination
          page={page}
          totalPages={totalPages}
          disabled={loading}
          onChange={setPage}
        />
        {actionError && (
          <div className="building-page__error" style={{ marginTop: 8 }}>
            {String(
              validateResErrors(actionError, "Ошибка при сохранении/удалении записи")
            )}
          </div>
        )}
      </div>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить запись" : "Добавить запись"}
      >
        <form className="building-page" onSubmit={handleSubmit}>
          <label>
            <div className="building-page__label">Категория</div>
            <select
              className="building-page__select"
              value={form.category}
              onChange={handleFormChange("category")}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Название</div>
            <input
              className="building-page__input"
              value={form.title}
              onChange={handleFormChange("title")}
              required
            />
          </label>
          <label>
            <div className="building-page__label">Описание</div>
            <textarea
              className="building-page__textarea"
              rows={4}
              value={form.description}
              onChange={handleFormChange("description")}
            />
          </label>
          <label>
            <div className="building-page__label">Когда произошло</div>
            <input
              type="datetime-local"
              className="building-page__input"
              value={form.occurred_at}
              onChange={handleFormChange("occurred_at")}
            />
          </label>
          {formError && (
            <div className="building-page__error">
              {String(formError)}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeModal}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
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

