import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { LayoutGrid, Table2 } from "lucide-react";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import BuildingPagination from "../shared/Pagination";
import { asDateTime } from "../shared/constants";
import {
  fetchBuildingDrawings,
  createBuildingDrawing,
  updateBuildingDrawing,
  deleteBuildingDrawing,
} from "@/store/creators/building/drawingsCreators";
import { useBuildingDrawings } from "@/store/slices/building/drawingsSlice";
import Modal from "@/Components/common/Modal/Modal";
import BuildingActionsMenu from "../shared/ActionsMenu";
import "./Drawings.scss";

const DRAWING_INITIAL = {
  title: "",
  description: "",
  is_active: true,
};

const VIEW_MODES = {
  CARDS: "cards",
  TABLE: "table",
};

const STORAGE_KEY = "building_drawings_view_mode";

export default function BuildingDrawings() {
  const dispatch = useDispatch();
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
  } = useBuildingDrawings();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("active");
  const debouncedSearch = useDebouncedValue(search, 400);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DRAWING_INITIAL);
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState(null);
  const [openPreviewModal, setOpenPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);
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
      is_active:
        isActive === "all"
          ? undefined
          : isActive === "active"
          ? "true"
          : "false",
      search: debouncedSearch || undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    };
    dispatch(fetchBuildingDrawings(params));
  }, [dispatch, selectedProjectId, isActive, debouncedSearch, page]);

  const handleOpenCreate = () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    setEditing(null);
    setForm(DRAWING_INITIAL);
    setFile(null);
    setFormError(null);
    setOpenModal(true);
  };

  const handleOpenEdit = (drawing) => {
    setEditing(drawing);
    setForm({
      title: drawing?.title || "",
      description: drawing?.description || "",
      is_active: Boolean(drawing?.is_active),
    });
    setFile(null);
    setFormError(null);
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(DRAWING_INITIAL);
    setFile(null);
    setFormError(null);
  };

  const handleFormChange = (key) => (e) => {
    const value =
      key === "is_active" ? Boolean(e.target.checked) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e) => {
    const next = e.target.files?.[0] || null;
    setFile(next);
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
    if (!editing && !file) {
      setFormError("Файл чертежа обязателен");
      return;
    }
    const payload = {
      residential_complex: selectedProjectId,
      title: String(form.title || "").trim(),
      description: String(form.description || "").trim() || "",
      is_active: Boolean(form.is_active),
      file,
    };
    try {
      let res;
      if (editing) {
        const id = editing?.id ?? editing?.uuid;
        if (!id) return;
        res = await dispatch(
          updateBuildingDrawing({ id, payload })
        );
      } else {
        res = await dispatch(createBuildingDrawing(payload));
      }
      if (res.meta.requestStatus === "fulfilled") {
        alert(editing ? "Чертёж обновлён" : "Чертёж добавлен");
        closeModal();
        setPage(1);
        dispatch(
          fetchBuildingDrawings({
            residential_complex: selectedProjectId,
            is_active:
              isActive === "all"
                ? undefined
                : isActive === "active"
                ? "true"
                : "false",
            search: debouncedSearch || undefined,
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
          })
        );
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить чертёж"
          )
        );
      }
    } catch (err) {
      setFormError(
        validateResErrors(err, "Не удалось сохранить чертёж")
      );
    }
  };

  const handleDelete = (drawing) => {
    const id = drawing?.id ?? drawing?.uuid;
    if (!id) return;
    confirm(
      `Удалить чертёж «${drawing?.title || "чертёж"}»?`,
      async (ok) => {
        if (!ok) return;
        try {
          const res = await dispatch(deleteBuildingDrawing(id));
          if (res.meta.requestStatus === "fulfilled") {
            alert("Чертёж удалён");
            dispatch(
              fetchBuildingDrawings({
                residential_complex: selectedProjectId,
                is_active:
                  isActive === "all"
                    ? undefined
                    : isActive === "active"
                    ? "true"
                    : "false",
                search: debouncedSearch || undefined,
                page,
                page_size: DEFAULT_PAGE_SIZE,
              })
            );
          } else {
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось удалить чертёж"
              ),
              true
            );
          }
        } catch (err) {
          alert(
            validateResErrors(err, "Не удалось удалить чертёж"),
            true
          );
        }
      }
    );
  };

  const handleOpenPreview = (drawing) => {
    const url = drawing?.file_url || drawing?.file || "";
    if (!url) return;
    setPreviewDrawing({
      url,
      title: drawing?.title || "",
      description: drawing?.description || "",
      created_at: drawing?.created_at,
    });
    setOpenPreviewModal(true);
  };

  return (
    <div className="building-page building-page--drawings">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">Проекты (чертежи)</h1>
          <p className="sell-header__subtitle">
            {selectedProjectId ? (
              <>
                ЖК <strong>{selectedProjectName}</strong> · Загрузка и управление
                файлами чертежей
              </>
            ) : (
              "Выберите жилой комплекс в шапке раздела"
            )}
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn"
          disabled={!selectedProjectId}
          onClick={handleOpenCreate}
        >
          Добавить чертёж
        </button>
      </header>

      {!selectedProjectId && (
        <div className="sell-empty-hint">
          <span className="sell-empty-hint__icon">📐</span>
          <p className="sell-empty-hint__text">
            Выберите ЖК в шапке — откроется список чертежей с поиском и
            фильтрами.
          </p>
        </div>
      )}

      {selectedProjectId && (
        <div className="sell-card drawings-card">
          <div className="sell-toolbar drawings-toolbar">
            <div className="drawings-toolbar__search-wrap">
              <input
                className="drawings-toolbar__search"
                value={search}
                placeholder="Поиск по названию/описанию"
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="drawings-toolbar__meta">
              <span className="drawings-toolbar__count">
                Показано {list.length} из {count ?? 0}
              </span>
              <div className="drawings-toolbar__view">
                <button
                  type="button"
                  className={`drawings-toolbar__viewBtn${viewMode === VIEW_MODES.TABLE ? " drawings-toolbar__viewBtn--active" : ""}`}
                  onClick={() => setViewMode(VIEW_MODES.TABLE)}
                >
                  <Table2 size={16} />
                  Таблица
                </button>
                <button
                  type="button"
                  className={`drawings-toolbar__viewBtn${viewMode === VIEW_MODES.CARDS ? " drawings-toolbar__viewBtn--active" : ""}`}
                  onClick={() => setViewMode(VIEW_MODES.CARDS)}
                >
                  <LayoutGrid size={16} />
                  Карточки
                </button>
              </div>
              <select
                className="drawings-toolbar__select"
                value={isActive}
                onChange={(e) => {
                  setPage(1);
                  setIsActive(e.target.value);
                }}
              >
                <option value="active">Только активные</option>
                <option value="all">Все</option>
                <option value="inactive">Только неактивные</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="building-page__error" style={{ marginBottom: 12 }}>
              {String(validateResErrors(error, "Не удалось загрузить чертежи"))}
            </div>
          )}

          {loading && list.length === 0 ? (
            <div className="sell-loading">
              <div className="sell-loading__spinner" />
              <p className="sell-loading__text">Загрузка чертежей...</p>
            </div>
          ) : !loading && list.length === 0 ? (
            <div className="sell-empty">
              <p className="sell-empty__text">Чертежи не найдены.</p>
            </div>
          ) : viewMode === VIEW_MODES.TABLE ? (
            <div className="drawings-table-wrap">
              <table className="drawings-table">
                <thead>
                  <tr>
                    <th className="drawings-table__previewCell">Превью</th>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Активен</th>
                    <th>Создан</th>
                    <th className="drawings-table__actionsCol">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((drawing) => {
                    const id = drawing?.id ?? drawing?.uuid;
                    const busy =
                      updatingIds?.[id] === true || deletingIds?.[id] === true;
                    const url = drawing?.file_url || drawing?.file || "";
                    return (
                      <tr key={id} className="drawings-table__row">
                        <td>
                          {url ? (
                            <img
                              src={url}
                              alt={drawing?.title || "Чертёж"}
                              className="drawings-table__previewImg"
                              onClick={() => handleOpenPreview(drawing)}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{drawing?.title || "—"}</td>
                        <td>{drawing?.description || "—"}</td>
                        <td>
                          {drawing?.is_active ? (
                            <span className="clients-table__status clients-table__status--active">
                              Да
                            </span>
                          ) : (
                            <span className="clients-table__status clients-table__status--inactive">
                              Нет
                            </span>
                          )}
                        </td>
                        <td>{asDateTime(drawing?.created_at)}</td>
                        <td className="drawings-table__actionsCol">
                          <BuildingActionsMenu
                            actions={[
                              url && {
                                label: "Открыть",
                                onClick: () => handleOpenPreview(drawing),
                              },
                              {
                                label: "Изменить",
                                onClick: () => handleOpenEdit(drawing),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(drawing),
                                disabled: busy,
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
          ) : (
            <div className="drawings-grid">
              {list.map((drawing) => {
                const id = drawing?.id ?? drawing?.uuid;
                const busy =
                  updatingIds?.[id] === true || deletingIds?.[id] === true;
                const url = drawing?.file_url || drawing?.file || "";
                return (
                  <div key={id} className="drawings-grid__card">
                    {url ? (
                      <img
                        src={url}
                        alt={drawing?.title || "Чертёж"}
                        className="drawings-grid__cardPreview"
                        onClick={() => handleOpenPreview(drawing)}
                      />
                    ) : (
                      <div
                        className="drawings-grid__cardPreview"
                        style={{
                          cursor: "default",
                          background: "rgba(11, 35, 68, 0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          color: "rgba(11, 35, 68, 0.5)",
                        }}
                      >
                        Нет превью
                      </div>
                    )}
                    <div className="drawings-grid__cardHead">
                      <div className="drawings-grid__cardTitle">
                        {drawing?.title || "—"}
                      </div>
                      <div className="drawings-grid__cardMeta">
                        {drawing?.is_active ? (
                          <span className="clients-table__status clients-table__status--active">
                            Активен
                          </span>
                        ) : (
                          <span className="clients-table__status clients-table__status--inactive">
                            Неактивен
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="drawings-grid__cardBody">
                      <span>{asDateTime(drawing?.created_at)}</span>
                      {drawing?.description && (
                        <p className="drawings-grid__cardDescription">
                          {drawing.description}
                        </p>
                      )}
                    </div>
                    <div className="drawings-grid__cardActions">
                      {url && (
                        <button
                          type="button"
                          className="drawings-grid__cardBtn"
                          onClick={() => handleOpenPreview(drawing)}
                        >
                          Открыть
                        </button>
                      )}
                      <button
                        type="button"
                        className="drawings-grid__cardBtn"
                        disabled={busy}
                        onClick={() => handleOpenEdit(drawing)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="drawings-grid__cardBtn drawings-grid__cardBtn--danger"
                        disabled={busy}
                        onClick={() => handleDelete(drawing)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="drawings-pagination">
            <BuildingPagination
              page={page}
              totalPages={totalPages}
              disabled={loading}
              onChange={setPage}
            />
          </div>

          {actionError && (
            <div className="building-page__error" style={{ marginTop: 12 }}>
              {String(
                validateResErrors(
                  actionError,
                  "Ошибка при сохранении/удалении чертежа"
                )
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить чертёж" : "Добавить чертёж"}
      >
        <form className="sell-form" onSubmit={handleSubmit}>
          <section className="sell-form__section">
            <h4 className="sell-form__sectionTitle">Основное</h4>
            <label>
              <div className="sell-form__label">Название *</div>
              <input
                className="building-page__input"
                value={form.title}
                onChange={handleFormChange("title")}
                placeholder="Чертёж этажа"
                required
              />
            </label>
            <label>
              <div className="sell-form__label">Описание</div>
              <textarea
                className="building-page__input building-page__textarea"
                rows={3}
                value={form.description}
                onChange={handleFormChange("description")}
                placeholder="Краткое описание"
              />
            </label>
            <label>
              <div className="sell-form__label">
                Файл чертежа {editing ? "(оставьте пустым, чтобы не менять)" : ""}
              </div>
              <input
                type="file"
                className="building-page__input"
                onChange={handleFileChange}
              />
            </label>
            <label className="drawings-form__activeCheck">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={handleFormChange("is_active")}
              />
              <span>Показывать по умолчанию</span>
            </label>
          </section>
          {formError && (
            <div className="building-page__error">{String(formError)}</div>
          )}
          <div className="sell-form__actions">
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
      <Modal
        open={openPreviewModal}
        onClose={() => {
          setOpenPreviewModal(false);
          setPreviewDrawing(null);
        }}
        title={previewDrawing?.title || "Просмотр чертежа"}
      >
        {previewDrawing && (
          <div className="building-page">
            <div
              style={{
                width: "100%",
                maxHeight: "70vh",
                overflow: "auto",
              }}
            >
              <img
                src={previewDrawing.url}
                alt={previewDrawing.title || "Чертёж"}
                style={{ width: "100%", height: "auto" }}
              />
            </div>
            {previewDrawing.description && (
              <div className="building-page__label" style={{ marginTop: 8 }}>
                {previewDrawing.description}
              </div>
            )}
            <div className="building-page__label" style={{ marginTop: 4 }}>
              {asDateTime(previewDrawing.created_at)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

