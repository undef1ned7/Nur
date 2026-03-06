import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingTasks } from "../../../../store/slices/building/tasksSlice";
import {
  fetchBuildingTaskById,
  createBuildingTask,
  updateBuildingTask,
  createBuildingTaskChecklistItem,
  updateBuildingTaskChecklistItem,
} from "../../../../store/creators/building/tasksCreators";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import { getEmployees } from "../../../../store/creators/departmentCreators";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { useBuildingClients } from "../../../../store/slices/building/clientsSlice";
import { useBuildingTreaties } from "../../../../store/slices/building/treatiesSlice";
import { fetchBuildingClients } from "../../../../store/creators/building/clientsCreators";
import { fetchBuildingTreaties } from "../../../../store/creators/building/treatiesCreators";
import "./Notification.scss";

const STATUS_LABELS = {
  open: "Открыта",
  done: "Выполнена",
  cancelled: "Отменена",
};

const TASK_FORM_INITIAL = {
  residential_complex: "",
  client: "",
  treaty: "",
  title: "",
  description: "",
  status: "open",
  due_at: "",
  assignee_ids: [],
};

const MultipleSearchSelect = ({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
}) => {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(
    () => (Array.isArray(value) ? value.map((v) => String(v)) : []),
    [value],
  );

  const selectedOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).filter((o) =>
        selectedIds.includes(String(o.value)),
      ),
    [options, selectedIds],
  );

  const filtered = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const text = String(o.searchText || o.label || "").toLowerCase();
      return text.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    const onDocDown = (e) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const toggleOption = (val) => {
    const str = String(val);
    if (selectedIds.includes(str)) {
      onChange?.(selectedIds.filter((id) => id !== str));
    } else {
      onChange?.([...selectedIds, str]);
    }
  };

  return (
    <div
      className="building-multiselect"
      ref={containerRef}
      style={{ position: "relative" }}
    >
      <input
        className="building-page__input"
        type="text"
        readOnly
        value={
          selectedOptions.length
            ? selectedOptions.map((o) => o.label).join(", ")
            : ""
        }
        placeholder={placeholder}
        onClick={() => setOpen((prev) => !prev)}
      />
      {open && (
        <div
          className="building-multiselect__menu"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: "auto",
            background: "#fff",
            borderRadius: 8,
            boxShadow:
              "0 8px 20px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.2)",
            marginTop: 4,
            padding: 8,
          }}
        >
          <input
            className="building-page__input"
            style={{ marginBottom: 8 }}
            placeholder="Поиск сотрудника..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filtered.length === 0 ? (
            <div className="building-page__muted">Ничего не найдено</div>
          ) : (
            filtered.map((o) => {
              const active = selectedIds.includes(String(o.value));
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  className="building-btn"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    marginBottom: 4,
                    background: active ? "#e0f2fe" : "#fff",
                    color: "#0f172a",
                  }}
                  onClick={() => toggleOption(o.value)}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      marginRight: 8,
                      background: active ? "#0284c7" : "#fff",
                    }}
                  />
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default function BuildingTaskDetail() {
  const { id } = useParams();
  const isNew = !id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const { employees = [], loading: employeesLoading } = useDepartments();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const { list: clientsList } = useBuildingClients();
  const { list: treatiesList } = useBuildingTreaties();

  const { current, currentLoading, currentError } = useBuildingTasks();

  const [form, setForm] = useState(TASK_FORM_INITIAL);
  const [formError, setFormError] = useState(null);
  const [checklistText, setChecklistText] = useState("");

  const complexesOptions = useMemo(
    () => (Array.isArray(projects) ? projects : []),
    [projects],
  );
  const clientsOptions = useMemo(
    () => (Array.isArray(clientsList) ? clientsList : []),
    [clientsList],
  );
  const treatiesOptions = useMemo(
    () => (Array.isArray(treatiesList) ? treatiesList : []),
    [treatiesList],
  );

  useEffect(() => {
    if (!employees || employees.length === 0) {
      dispatch(getEmployees());
    }
  }, [dispatch]);

  useEffect(() => {
    const complexId =
      form.residential_complex ||
      current?.residential_complex ||
      selectedProjectId;
    if (!complexId) return;
    dispatch(fetchBuildingClients({ residential_complex: complexId }));
    dispatch(
      fetchBuildingTreaties({
        residential_complex: complexId,
      }),
    );
  }, [
    dispatch,
    form.residential_complex,
    current?.residential_complex,
    selectedProjectId,
  ]);

  useEffect(() => {
    if (!isNew && id) {
      dispatch(fetchBuildingTaskById(id));
    } else if (isNew) {
      setForm((prev) => ({
        ...TASK_FORM_INITIAL,
        residential_complex: selectedProjectId || "",
      }));
    }
  }, [dispatch, id, isNew, selectedProjectId]);

  useEffect(() => {
    if (
      !isNew &&
      current &&
      (current.id === id || current.uuid === id || true)
    ) {
      setForm({
        residential_complex:
          current?.residential_complex || selectedProjectId || "",
        client: current?.client || "",
        treaty: current?.treaty || "",
        title: current?.title || "",
        description: current?.description || "",
        status: current?.status || "open",
        due_at: current?.due_at ? String(current.due_at).slice(0, 16) : "",
        assignee_ids: Array.isArray(current?.assignees)
          ? current.assignees.map((a) => a.id).filter(Boolean)
          : [],
      });
    }
  }, [isNew, current, id]);

  const handleFormChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!String(form.title || "").trim()) {
      setFormError("Укажите название напоминания");
      return;
    }

    const assigneeIds = Array.isArray(form.assignee_ids)
      ? form.assignee_ids.filter(Boolean)
      : [];

    const dueAt =
      form.due_at && !Number.isNaN(new Date(form.due_at).getTime())
        ? new Date(form.due_at).toISOString()
        : null;

    const payload = {
      residential_complex:
        form.residential_complex || selectedProjectId || null,
      client: form.client || null,
      treaty: form.treaty || null,
      title: form.title,
      description: form.description || "",
      status: form.status || "open",
      due_at: dueAt,
      assignee_ids: assigneeIds.length ? assigneeIds : undefined,
    };

    try {
      let res;
      if (isNew) {
        res = await dispatch(createBuildingTask(payload));
      } else {
        if (!id) return;
        res = await dispatch(updateBuildingTask({ id, data: payload }));
      }
      if (res.meta.requestStatus === "fulfilled") {
        const task = res.payload;
        const newId = task?.id ?? task?.uuid ?? id;
        alert(isNew ? "Напоминание создано" : "Напоминание обновлено");
        if (newId) {
          navigate(`/crm/building/notification/${newId}`);
        } else {
          navigate("/crm/building/notification");
        }
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить напоминание",
          ),
        );
      }
    } catch (err) {
      setFormError(validateResErrors(err, "Не удалось сохранить напоминание"));
    }
  };

  const handleChecklistAdd = async () => {
    if (!current || (!current.id && !current.uuid)) return;
    const text = checklistText.trim();
    if (!text) return;
    const taskId = current.id ?? current.uuid;
    const items = Array.isArray(current.checklist_items)
      ? current.checklist_items
      : [];
    const order = items.length + 1;
    try {
      const res = await dispatch(
        createBuildingTaskChecklistItem({ taskId, text, order }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        setChecklistText("");
      } else {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Не удалось добавить пункт чек-листа",
          ),
          true,
        );
      }
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось добавить пункт чек-листа"),
        true,
      );
    }
  };

  const handleChecklistToggle = async (item) => {
    const cid = item?.id ?? item?.uuid;
    if (!cid) return;
    try {
      const res = await dispatch(
        updateBuildingTaskChecklistItem({
          id: cid,
          data: { is_done: !item.is_done },
        }),
      );
      if (res.meta.requestStatus !== "fulfilled") {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Не удалось обновить пункт чек-листа",
          ),
          true,
        );
      }
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось обновить пункт чек-листа"),
        true,
      );
    }
  };

  const handleChecklistMove = async (item, direction) => {
    const cid = item?.id ?? item?.uuid;
    if (!cid || !current) return;
    const items = Array.isArray(current.checklist_items)
      ? current.checklist_items
      : [];
    if (items.length < 2) return;

    const index = items.findIndex(
      (ci) => String(ci.id ?? ci.uuid) === String(cid),
    );
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const sourceItem = items[index];
    const targetItem = items[targetIndex];
    const sourceId = sourceItem.id ?? sourceItem.uuid;
    const targetId = targetItem.id ?? targetItem.uuid;
    if (!sourceId || !targetId) return;

    const sourceOrder =
      typeof sourceItem.order === "number" ? sourceItem.order : index + 1;
    const targetOrder =
      typeof targetItem.order === "number" ? targetItem.order : targetIndex + 1;

    try {
      const [res1, res2] = await Promise.all([
        dispatch(
          updateBuildingTaskChecklistItem({
            id: sourceId,
            data: { order: targetOrder },
          }),
        ),
        dispatch(
          updateBuildingTaskChecklistItem({
            id: targetId,
            data: { order: sourceOrder },
          }),
        ),
      ]);

      const failed =
        res1.meta.requestStatus !== "fulfilled" ||
        res2.meta.requestStatus !== "fulfilled";
      if (failed) {
        const errPayload =
          (res1.meta.requestStatus !== "fulfilled" &&
            (res1.payload || res1.error)) ||
          (res2.meta.requestStatus !== "fulfilled" &&
            (res2.payload || res2.error));
        alert(
          validateResErrors(
            errPayload,
            "Не удалось поменять порядок пунктов чек-листа",
          ),
          true,
        );
      }
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось поменять порядок пунктов чек-листа"),
        true,
      );
    }
  };

  const [draggingId, setDraggingId] = useState(null);

  const handleChecklistDrop = async (targetItem) => {
    if (!current || !draggingId) return;
    const items = Array.isArray(current.checklist_items)
      ? current.checklist_items
      : [];
    if (items.length < 2) return;

    const fromIndex = items.findIndex(
      (ci) => String(ci.id ?? ci.uuid) === String(draggingId),
    );
    const toIndex = items.findIndex(
      (ci) =>
        String(ci.id ?? ci.uuid) === String(targetItem.id ?? targetItem.uuid),
    );
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const reordered = items.slice();
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updates = reordered
      .map((it, idx) => {
        const desiredOrder = idx + 1;
        const currentOrder =
          typeof it.order === "number" && Number.isFinite(it.order)
            ? it.order
            : idx + 1;
        if (currentOrder === desiredOrder) return null;
        const id = it.id ?? it.uuid;
        if (!id) return null;
        return { id, order: desiredOrder };
      })
      .filter(Boolean);

    if (!updates.length) return;

    try {
      const results = await Promise.all(
        updates.map((u) =>
          dispatch(
            updateBuildingTaskChecklistItem({
              id: u.id,
              data: { order: u.order },
            }),
          ),
        ),
      );
      const failed = results.find((r) => r.meta.requestStatus !== "fulfilled");
      if (failed) {
        alert(
          validateResErrors(
            failed.payload || failed.error,
            "Не удалось поменять порядок пунктов чек-листа",
          ),
          true,
        );
      }
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось поменять порядок пунктов чек-листа"),
        true,
      );
    } finally {
      setDraggingId(null);
    }
  };

  const checklistItems = (() => {
    const items = Array.isArray(current?.checklist_items)
      ? current.checklist_items
      : [];
    if (!items.length) return [];
    const withOrder = items.slice();
    withOrder.sort((a, b) => {
      const aIndex = items.indexOf(a);
      const bIndex = items.indexOf(b);
      const aOrder =
        typeof a.order === "number" && Number.isFinite(a.order)
          ? a.order
          : aIndex + 1;
      const bOrder =
        typeof b.order === "number" && Number.isFinite(b.order)
          ? b.order
          : bIndex + 1;
      return aOrder - bOrder;
    });
    return withOrder;
  })();
  return (
    <div className="warehouse-page building-page building-page--task-detail">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">🔔</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              {isNew ? "Новое напоминание" : "Напоминание"}
            </h1>
            {!isNew && (
              <p className="warehouse-header__subtitle">
                Статус:{" "}
                <b>
                  {STATUS_LABELS[current?.status] || current?.status || "—"}
                </b>
                {current?.due_at && (
                  <>
                    {" • "}Срок:{" "}
                    {new Date(current.due_at).toLocaleString() || "—"}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => navigate("/crm/building/notification")}
        >
          ← К списку
        </button>
      </div>
      {!isNew && (
        <div className="building-page__card" style={{ marginTop: 16 }}>
          <div className="building-page__header" style={{ marginBottom: 8 }}>
            <h2 className="building-page__title" style={{ fontSize: 18 }}>
              Чек-лист
            </h2>
          </div>
          <div
            style={{
              maxHeight: 260,
              overflowY: "auto",
              marginBottom: 8,
            }}
          >
            {checklistItems.length === 0 ? (
              <div className="building-page__muted" style={{ padding: 8 }}>
                Пункты чек-листа ещё не добавлены.
              </div>
            ) : (
              <div>
                {checklistItems.map((item, index) => (
                  <div
                    key={item.id ?? item.uuid}
                    draggable
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 4,
                      border:
                        String(draggingId) === String(item.id ?? item.uuid)
                          ? "1px dashed #1d6fdc"
                          : "1px solid rgba(0,0,0,0.06)",
                      marginBottom: 4,
                      backgroundColor:
                        String(draggingId) === String(item.id ?? item.uuid)
                          ? "rgba(29,111,220,0.04)"
                          : "#fff",
                    }}
                    onDragStart={() => setDraggingId(item.id ?? item.uuid)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleChecklistDrop(item);
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          cursor: "grab",
                          userSelect: "none",
                          fontSize: 14,
                          color: "rgba(0,0,0,0.45)",
                        }}
                      >
                        ⠿
                      </span>
                      <span
                        style={{
                          width: 24,
                          textAlign: "center",
                          fontSize: 12,
                          color: "rgba(0,0,0,0.45)",
                        }}
                      >
                        {item.order ?? index + 1}
                      </span>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(item.is_done)}
                          onChange={() => handleChecklistToggle(item)}
                        />
                        <span
                          style={{
                            textDecoration: item.is_done
                              ? "line-through"
                              : "none",
                            opacity: item.is_done ? 0.6 : 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.text}
                        </span>
                      </label>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        className="building-page__status"
                        style={{ fontSize: 11, whiteSpace: "nowrap" }}
                      >
                        {item.is_done ? "Выполнено" : "Открыт"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <input
              className="building-page__input"
              value={checklistText}
              onChange={(e) => setChecklistText(e.target.value)}
              placeholder="Новый пункт чек-листа"
            />
            <button
              type="button"
              className="building-btn building-btn--primary"
              onClick={handleChecklistAdd}
              disabled={!checklistText.trim()}
            >
              Добавить
            </button>
          </div>
        </div>
      )}
      {currentError && !isNew && (
        <div className="building-page__error" style={{ marginBottom: 12 }}>
          {String(
            validateResErrors(currentError, "Не удалось загрузить напоминание"),
          )}
        </div>
      )}

      <div className="building-page__card">
        {currentLoading && !isNew ? (
          <div className="building-page__muted">Загрузка напоминания...</div>
        ) : (
          <form className="building-page" onSubmit={handleSubmit}>
            <label>
              <div className="building-page__label">ЖК</div>
              <select
                className="building-page__select"
                value={form.residential_complex}
                onChange={handleFormChange("residential_complex")}
              >
                <option value="">Не выбран</option>
                {complexesOptions.map((c) => (
                  <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                    {c.name || "—"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Клиент</div>
              <select
                className="building-page__select"
                value={form.client}
                onChange={handleFormChange("client")}
              >
                <option value="">Не выбран</option>
                {clientsOptions.map((c) => (
                  <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                    {c.name || c.display || "—"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Договор</div>
              <select
                className="building-page__select"
                value={form.treaty}
                onChange={handleFormChange("treaty")}
              >
                <option value="">Не выбран</option>
                {treatiesOptions.map((t) => (
                  <option key={t.id ?? t.uuid} value={t.id ?? t.uuid}>
                    {t.number || t.title || "—"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Название *</div>
              <input
                className="building-page__input"
                value={form.title}
                onChange={handleFormChange("title")}
                placeholder="Например: Позвонить клиенту"
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
                placeholder="Дополнительные детали задачи..."
              />
            </label>
            <label>
              <div className="building-page__label">Статус</div>
              <select
                className="building-page__select"
                value={form.status}
                onChange={handleFormChange("status")}
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Срок</div>
              <input
                type="datetime-local"
                className="building-page__input"
                value={form.due_at}
                onChange={handleFormChange("due_at")}
              />
            </label>
            <label>
              <div className="building-page__label">Исполнители</div>
              <MultipleSearchSelect
                value={form.assignee_ids}
                onChange={(vals) =>
                  setForm((prev) => ({ ...prev, assignee_ids: vals }))
                }
                options={(employees || []).map((e) => {
                  const fullName =
                    [e.first_name, e.last_name].filter(Boolean).join(" ") ||
                    e.display ||
                    e.name ||
                    e.email ||
                    "Без имени";
                  return {
                    value: e.id ?? e.uuid,
                    label: fullName,
                    searchText: `${fullName}`.trim(),
                  };
                })}
                placeholder={
                  employeesLoading
                    ? "Загрузка сотрудников..."
                    : "Выберите сотрудников"
                }
              />
            </label>

            {formError && (
              <div className="building-page__error" style={{ marginTop: 8 }}>
                {String(formError)}
              </div>
            )}

            <div className="building-page__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => navigate("/crm/building/notification")}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
              >
                Сохранить
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
