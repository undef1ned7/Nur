import React from "react";
import { FileText, Edit2, Trash2, Eye } from "lucide-react";
import { toNum } from "./summaryAggregation";
import "./Summary.scss";

const TYPE_LABEL = { general: "Общая", by_agents: "По агентам" };
const n2 = (v) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(v));

/**
 * Список сводок (карточки) для выбранного дня/фильтров.
 * Карточки — облегчённые (GET list): без documents/products.
 */
const SummaryList = ({ items = [], loading, onOpen, onEdit, onDelete, onPdf }) => {
  if (loading) {
    return <div className="summary-empty">Загрузка…</div>;
  }
  if (!items.length) {
    return (
      <div className="summary-empty">
        Нет сводок. Создайте первую кнопкой «Создать сводку».
      </div>
    );
  }

  return (
    <div className="summary-list">
      {items.map((s) => (
        <div
          key={s.id}
          className="summary-card"
          onClick={() => onOpen?.(s)}
          role="button"
          tabIndex={0}
        >
          <div className="summary-card__main">
            <div className="summary-card__top">
              <span className="summary-card__name">{s.name}</span>
              <span
                className={`summary-card__type ${s.type === "by_agents" ? "is-agents" : ""}`}
              >
                {TYPE_LABEL[s.type] || s.type}
              </span>
            </div>
            <div className="summary-card__meta">
              {s.number ? <span>№ {s.number}</span> : null}
              <span>Накладных: {toNum(s.documents_count)}</span>
              {s.type === "by_agents" && (
                <span>Агентов: {toNum(s.agents_count)}</span>
              )}
              <span className="summary-card__sum">{n2(s.total_amount)}</span>
            </div>
            {s.created_by?.full_name && (
              <div className="summary-card__author">
                Автор: {s.created_by.full_name}
              </div>
            )}
          </div>

          <div
            className="summary-card__actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button title="Открыть" onClick={() => onOpen?.(s)}>
              <Eye size={16} />
            </button>
            <button title="PDF" onClick={() => onPdf?.(s)}>
              <FileText size={16} />
            </button>
            <button title="Изменить" onClick={() => onEdit?.(s)}>
              <Edit2 size={16} />
            </button>
            <button
              title="Удалить"
              className="is-danger"
              onClick={() => onDelete?.(s)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SummaryList;
