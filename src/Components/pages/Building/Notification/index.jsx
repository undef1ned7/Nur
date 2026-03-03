import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingTasks } from "../../../../store/slices/building/tasksSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import {
  fetchBuildingTasks,
  deleteBuildingTask,
} from "../../../../store/creators/building/tasksCreators";
import BuildingActionsMenu from "../shared/ActionsMenu";

const STATUS_LABELS = {
  open: "Открыта",
  done: "Выполнена",
  cancelled: "Отменена",
};

export default function BuildingNotification() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const {
    selectedProjectId,
    items: projects,
  } = useBuildingProjects();

  const {
    list,
    loading,
    error,
    updatingIds,
    deletingIds,
    actionError,
  } = useBuildingTasks();
  console.log(list);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const arr = Array.isArray(projects) ? projects : [];
    const found = arr.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingTasks({
        residential_complex: selectedProjectId,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      }),
    );
  }, [dispatch, selectedProjectId, search, statusFilter]);

  const effectiveList = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    if (!search.trim() && !statusFilter) return arr;
    return arr.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const hay = `${t.title || ""} ${t.description || ""}`
        .toLowerCase()
        .trim();
      return hay.includes(search.toLowerCase().trim());
    });
  }, [list, search, statusFilter]);

  const openCreate = () => {
    if (!selectedProjectId) return;
    navigate("/crm/building/notification/new");
  };

  const openEdit = (task) => {
    const id = task?.id ?? task?.uuid;
    if (!id) return;
    navigate(`/crm/building/notification/${id}`);
  };

  const handleDelete = (task) => {
    const id = task?.id ?? task?.uuid;
    if (!id) return;
    confirm(
      `Удалить напоминание «${task?.title || "без названия"}»?`,
      async (ok) => {
        if (!ok) return;
        const res = await dispatch(deleteBuildingTask(id));
        if (res.meta.requestStatus === "fulfilled") {
          dispatch(
            fetchBuildingTasks({
              residential_complex: selectedProjectId,
              search: search.trim() || undefined,
              status: statusFilter || undefined,
            }),
          );
        }
      },
    );
  };

  return (
    <div className="building-page building-page--tasks">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Напоминания</h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Управление напоминаниями и задачами
            по объектам строительства.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={openCreate}
          disabled={!selectedProjectId}
        >
          Новое напоминание
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters building-page__filters--3">
          <input
            className="building-page__input"
            value={search}
            placeholder="Поиск по названию и описанию"
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="building-page__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Статус: все</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {!selectedProjectId && (
          <div className="building-page__muted">
            Выберите жилой комплекс в шапке раздела, чтобы увидеть напоминания.
          </div>
        )}
        {error && (
          <div className="building-page__error">
            {String(
              validateResErrors(error, "Не удалось загрузить напоминания"),
            )}
          </div>
        )}
      </div>

      {selectedProjectId && (
        <div className="building-page__card">
          {loading && (
            <div className="building-page__muted">Загрузка напоминаний...</div>
          )}
          {!loading && effectiveList.length === 0 && (
            <div className="building-page__muted">
              Напоминаний пока нет. Создайте первое.
            </div>
          )}
          {!loading && effectiveList.length > 0 && (
            <div className="building-table building-table--shadow">
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Статус</th>
                    <th>Срок</th>
                    <th>Чек-лист</th>
                    <th style={{ width: 80 }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveList.map((t) => {
                    const id = t?.id ?? t?.uuid;
                    const busy =
                      (id != null && updatingIds[id]) ||
                      (id != null && deletingIds[id]);
                    const items = Array.isArray(t.checklist_items)
                      ? t.checklist_items
                      : [];
                    const doneCount = items.filter((i) => i.is_done).length;
                  return (
                    <tr
                      key={id}
                      onClick={() => openEdit(t)}
                      style={{ cursor: "pointer" }}
                    >
                        <td>{t?.title || "—"}</td>
                        <td>{t?.description || "—"}</td>
                        <td>
                          <span className="building-page__status">
                            {STATUS_LABELS[t?.status] || t?.status || "—"}
                          </span>
                        </td>
                        <td>
                          {t?.due_at
                            ? new Date(t.due_at).toLocaleString()
                            : "—"}
                        </td>
                        <td>
                          {items.length === 0
                            ? "—"
                            : `${doneCount}/${items.length} выполнено`}
                        </td>
                        <td>
                          <BuildingActionsMenu
                            actions={[
                              {
                                label: "Изменить",
                                onClick: () => openEdit(t),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(t),
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
          {actionError && (
            <div className="building-page__error" style={{ marginTop: 8 }}>
              {String(
                validateResErrors(
                  actionError,
                  "Ошибка при выполнении операции с напоминанием",
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

