import React, { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import { createSummary, updateSummary } from "../../../../../../api/warehouseSummaries";
import { fetchEmployeesApi } from "../../../../../../api/employees";
import { listWarehouses } from "../../../../../../api/warehouse";
import { useAlert } from "../../../../../../hooks/useDialog";
import "./Summary.scss";

const empName = (e) =>
  e?.full_name ||
  `${e?.first_name || ""} ${e?.last_name || ""}`.trim() ||
  e?.name ||
  e?.email ||
  "Без имени";

const asList = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

/**
 * Модалка создания/редактирования сводки.
 * Создание: нужен warehouse + date. Редактирование (summary передан): name/comment/type/agents.
 */
const SummaryCreateModal = ({ date, summary, onClose, onSaved }) => {
  const alert = useAlert();
  const isEdit = Boolean(summary?.id);

  const [name, setName] = useState(summary?.name || "");
  const [comment, setComment] = useState(summary?.comment || "");
  const [type, setType] = useState(summary?.type || "general");
  const [warehouse, setWarehouse] = useState(summary?.warehouse?.id || "");
  const [agentIds, setAgentIds] = useState(
    (summary?.agents || []).map((a) => String(a.id)),
  );
  const [warehouses, setWarehouses] = useState([]);
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listWarehouses({ page_size: 200 }).catch(() => []),
      fetchEmployeesApi({ page_size: 500 }).catch(() => []),
    ]).then(([whData, empData]) => {
      if (cancelled) return;
      const whs = asList(whData).map((w) => ({ id: String(w.id), name: w.name }));
      setWarehouses(whs);
      if (!isEdit && !warehouse && whs.length) setWarehouse(whs[0].id);
      const ags = asList(empData)
        .filter((e) => String(e.role || "").toLowerCase() === "agent")
        .map((e) => ({ id: String(e.id), name: empName(e) }));
      setAgents(ags);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAgent = (id) =>
    setAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const allSelected = agents.length > 0 && agentIds.length === agents.length;
  const toggleAll = () =>
    setAgentIds(allSelected ? [] : agents.map((a) => a.id));

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!isEdit && !warehouse) return false;
    if (type === "by_agents" && agentIds.length === 0) return false;
    return true;
  }, [name, warehouse, type, agentIds, isEdit]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let result;
      if (isEdit) {
        result = await updateSummary(summary.id, {
          name: name.trim(),
          comment: comment.trim(),
          type,
          agents: type === "by_agents" ? agentIds : [],
        });
      } else {
        result = await createSummary({
          name: name.trim(),
          comment: comment.trim(),
          type,
          date,
          warehouse,
          agents: type === "by_agents" ? agentIds : [],
        });
      }
      onSaved?.(result);
    } catch (e) {
      const msg =
        e?.detail || e?.message || (typeof e === "string" ? e : "") ||
        "Не удалось сохранить сводку";
      alert(msg, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="summary-modal__header">
          <h2 className="summary-modal__title">
            {isEdit ? "Редактировать сводку" : "Создать сводку"}
          </h2>
          <button className="summary-modal__close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="summary-modal__body">
          <label className="summary-field">
            <span className="summary-field__label">Название</span>
            <input
              className="summary-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр.: Утренняя, Общая, Сводка агентов"
              maxLength={120}
            />
          </label>

          <label className="summary-field">
            <span className="summary-field__label">Комментарий</span>
            <textarea
              className="summary-field__input summary-field__textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Будет сохранён и показан в документе"
              rows={3}
            />
          </label>

          {!isEdit && (
            <label className="summary-field">
              <span className="summary-field__label">Склад</span>
              <select
                className="summary-field__input"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              >
                {warehouses.length === 0 && <option value="">—</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="summary-field">
            <span className="summary-field__label">Тип сводки</span>
            <div className="summary-typeToggle">
              <button
                type="button"
                className={`summary-typeToggle__btn ${type === "general" ? "is-active" : ""}`}
                onClick={() => setType("general")}
              >
                Общая
                <small>Все накладные даты</small>
              </button>
              <button
                type="button"
                className={`summary-typeToggle__btn ${type === "by_agents" ? "is-active" : ""}`}
                onClick={() => setType("by_agents")}
              >
                По агентам
                <small>Только выбранные агенты</small>
              </button>
            </div>
          </div>

          {type === "by_agents" && (
            <div className="summary-field">
              <div className="summary-agents__head">
                <span className="summary-field__label">Агенты</span>
                <button
                  type="button"
                  className="summary-agents__all"
                  onClick={toggleAll}
                >
                  {allSelected ? "Снять все" : "Выбрать всех"}
                </button>
              </div>
              <div className="summary-agents__list">
                {agents.length === 0 && (
                  <div className="summary-agents__empty">Агенты не найдены</div>
                )}
                {agents.map((a) => {
                  const checked = agentIds.includes(a.id);
                  return (
                    <button
                      type="button"
                      key={a.id}
                      className={`summary-agents__item ${checked ? "is-checked" : ""}`}
                      onClick={() => toggleAgent(a.id)}
                    >
                      <span className="summary-agents__check">
                        {checked && <Check size={14} />}
                      </span>
                      <span>{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="summary-modal__footer">
          <button className="summary-btn summary-btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            className="summary-btn summary-btn--primary"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryCreateModal;
