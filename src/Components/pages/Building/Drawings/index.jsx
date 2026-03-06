import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { useDebouncedValue } from "@/hooks/useDebounce";
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

const DRAWING_INITIAL = {
  title: "",
  description: "",
  is_active: true,
};

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
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Проекты (чертежи)</h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Загрузка и управление файлами
            чертежей.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={handleOpenCreate}
          disabled={!selectedProjectId}
        >
          Добавить чертёж
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters">
          <input
            className="building-page__input"
            value={search}
            placeholder="Поиск по названию/описанию"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <select
            className="building-page__select"
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
        {error && (
          <div className="building-page__error">
            {String(
              validateResErrors(error, "Не удалось загрузить чертежи")
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
            Чертежи не найдены.
          </div>
        )}
        {selectedProjectId && !loading && list.length > 0 && (
          <div className="building-table building-table--shadow">
            <table>
              <thead>
                <tr>
                  <th>Превью</th>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Активен</th>
                  <th>Создан</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {list.map((drawing) => {
                  const id = drawing?.id ?? drawing?.uuid;
                  const busy =
                    updatingIds?.[id] === true ||
                    deletingIds?.[id] === true;
                  const url =
                    drawing?.file_url ||
                    drawing?.file ||
                    "";
                  return (
                    <tr key={id}>
                      <td>
                        {url ? (
                          <img
                            src={url}
                            alt={drawing?.title || "Чертёж"}
                            style={{
                              maxHeight: 48,
                              maxWidth: 80,
                              objectFit: "cover",
                              cursor: "pointer",
                            }}
                            onClick={() => handleOpenPreview(drawing)}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{drawing?.title || "—"}</td>
                      <td>{drawing?.description || "—"}</td>
                      <td>{drawing?.is_active ? "Да" : "Нет"}</td>
                      <td>{asDateTime(drawing?.created_at)}</td>
                      <td>
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
              validateResErrors(
                actionError,
                "Ошибка при сохранении/удалении чертежа"
              )
            )}
          </div>
        )}
      </div>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить чертёж" : "Добавить чертёж"}
      >
        <form className="building-page" onSubmit={handleSubmit}>
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
              rows={3}
              value={form.description}
              onChange={handleFormChange("description")}
            />
          </label>
          <label>
            <div className="building-page__label">
              Файл чертежа {editing ? "(если нужно заменить)" : ""}
            </div>
            <input
              type="file"
              className="building-page__input"
              onChange={handleFileChange}
            />
          </label>
          <label>
            <div className="building-page__label">Активен</div>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={handleFormChange("is_active")}
            />{" "}
            <span>Показывать по умолчанию</span>
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

