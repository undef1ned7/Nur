import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, LayoutGrid, Table2 } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingTasks } from "../../../../store/slices/building/tasksSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import {
  fetchBuildingTasks,
  deleteBuildingTask,
} from "../../../../store/creators/building/tasksCreators";
import BuildingActionsMenu from "../shared/ActionsMenu";
import "./Notification.scss";

const STATUS_LABELS = {
  open: "Открыта",
  done: "Выполнена",
  cancelled: "Отменена",
};

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
  CALENDAR: "calendar",
};

const STORAGE_KEY = "building_notifications_view_mode";

export default function BuildingNotification() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const { selectedProjectId, items: projects } = useBuildingProjects();

  const { list, loading, error, updatingIds, deletingIds, actionError } =
    useBuildingTasks();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (
      saved === VIEW_MODES.TABLE ||
      saved === VIEW_MODES.CARDS ||
      saved === VIEW_MODES.CALENDAR
    )
      return saved;
    return VIEW_MODES.TABLE;
  });

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const arr = Array.isArray(projects) ? projects : [];
    const found = arr.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

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

  const totalTasks = Array.isArray(list) ? list.length : 0;
  const filteredCount = Array.isArray(effectiveList) ? effectiveList.length : 0;

  const calendarEvents = useMemo(() => {
    const arr = Array.isArray(effectiveList) ? effectiveList : [];
    return arr
      .filter((t) => t?.due_at)
      .map((t) => {
        const id = t?.id ?? t?.uuid;
        const start = new Date(t.due_at);
        return {
          id: String(id),
          title: t?.title || "Без названия",
          start: start.toISOString(),
          allDay: false,
          extendedProps: { task: t },
        };
      });
  }, [effectiveList]);

  const handleCalendarDateClick = (info) => {
    if (!selectedProjectId) return;
    const dateStr = info.dateStr;
    const dueAt = dateStr.includes("T") ? dateStr.slice(0, 16) : `${dateStr}T09:00`;
    navigate("/crm/building/notification/new", { state: { due_at: dueAt } });
  };

  const handleCalendarEventClick = (info) => {
    const task = info.event.extendedProps?.task;
    if (task) openEdit(task);
  };

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
    <div className="warehouse-page building-page building-page--tasks">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">🔔</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Напоминания</h1>
            <p className="warehouse-header__subtitle">
              ЖК: <b>{selectedProjectName}</b>. Управление напоминаниями и
              задачами по объектам строительства.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          onClick={openCreate}
          disabled={!selectedProjectId}
        >
          Новое напоминание
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по названию и описанию"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            {selectedProjectId
              ? `Найдено ${filteredCount} из ${totalTasks} напоминаний`
              : "Выберите жилой комплекс в шапке раздела, чтобы увидеть напоминания."}
          </span>

          <select
            className="warehouse-filter-modal__select-small"
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

            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.CALENDAR)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.CALENDAR
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <CalendarIcon size={16} />
              Календарь
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-500">
          {String(validateResErrors(error, "Не удалось загрузить напоминания"))}
        </div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {viewMode === VIEW_MODES.CALENDAR ? (
            <div className="building-notification-calendar">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите жилой комплекс в шапке раздела, чтобы увидеть
                  напоминания в календаре.
                </div>
              ) : (
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale="ru"
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,dayGridWeek",
                  }}
                  events={calendarEvents}
                  dateClick={handleCalendarDateClick}
                  eventClick={handleCalendarEventClick}
                  height="auto"
                  eventDisplay="block"
                  dayMaxEvents={4}
                  moreLinkClick="popover"
                  classNames="building-notification-calendar__fc"
                />
              )}
            </div>
          ) : viewMode === VIEW_MODES.TABLE ? (
            <table className="warehouse-table w-full">
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
                {!selectedProjectId ? (
                  <tr>
                    <td colSpan={6} className="warehouse-table__empty">
                      Выберите жилой комплекс в шапке раздела, чтобы увидеть
                      напоминания.
                    </td>
                  </tr>
                ) : loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="warehouse-table__loading">
                      Загрузка напоминаний...
                    </td>
                  </tr>
                ) : !loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="warehouse-table__empty">
                      Напоминаний пока нет. Создайте первое.
                    </td>
                  </tr>
                ) : (
                  effectiveList.map((t) => {
                    const id = t?.id ?? t?.uuid;
                    const busy =
                      (id != null && updatingIds[id]) ||
                      (id != null && deletingIds[id]);
                    const items = Array.isArray(t.checklist_items)
                      ? t.checklist_items
                      : [];
                    const doneCount = items.filter((i) => i.is_done).length;
                    return (
                      <tr key={id} onClick={() => openEdit(t)}>
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
                        <td
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
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
                  })
                )}
              </tbody>
            </table>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите жилой комплекс в шапке раздела, чтобы увидеть
                  напоминания.
                </div>
              ) : loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__loading">
                  Загрузка напоминаний...
                </div>
              ) : !loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__empty">
                  Напоминаний пока нет. Создайте первое.
                </div>
              ) : (
                effectiveList.map((t) => {
                  const id = t?.id ?? t?.uuid;
                  const busy =
                    (id != null && updatingIds[id]) ||
                    (id != null && deletingIds[id]);
                  const items = Array.isArray(t.checklist_items)
                    ? t.checklist_items
                    : [];
                  const doneCount = items.filter((i) => i.is_done).length;

                  return (
                    <div
                      key={id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                      onClick={() => openEdit(t)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {t?.title || "—"}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {t?.description || "—"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {t?.status && (
                              <span className="building-page__status">
                                {STATUS_LABELS[t?.status] || t?.status || "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Статус</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {STATUS_LABELS[t?.status] || t?.status || "—"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Срок</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {t?.due_at
                              ? new Date(t.due_at).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                        <div className="col-span-2 rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Чек-лист</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {items.length === 0
                              ? "—"
                              : `${doneCount}/${items.length} выполнено`}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="px-3cursor-pointer py-2 w-1/2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t);
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="px-3 cursor-pointer py-2 w-1/2 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t);
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
      </DataContainer>
    </div>
  );
}
