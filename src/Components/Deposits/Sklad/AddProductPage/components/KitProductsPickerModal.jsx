import React from "react";
import { CheckSquare, Package, Search, Square, X } from "lucide-react";
import "./KitProductsPickerModal.scss";

const KitProductsPickerModal = ({
  open,
  onClose,
  searchValue = "",
  onSearchChange,
  categoryId = "",
  onCategoryChange,
  categories = [],
  items = [],
  selectedIds,
  onToggle,
  onToggleSelectAll,
  isAllFilteredSelected = false,
  onConfirm,
  confirmLabel = "Добавить выбранные",
  emptyText = "Товары не найдены",
  loading = false,
}) => {
  if (!open) return null;

  const selectedCount = selectedIds?.size ?? 0;
  const list = Array.isArray(items) ? items : [];
  const categoryOptions = [
    { value: "", label: "Все категории" },
    ...(Array.isArray(categories) ? categories : [])
      .map((cat) => ({
        value: String(cat.id || ""),
        label: cat.name || "Категория",
      }))
      .filter((opt) => opt.value),
  ];

  return (
    <div className="kit-picker-modal__overlay" onClick={onClose} role="presentation">
      <div
        className="kit-picker-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kit-picker-modal-title"
      >
        <div className="kit-picker-modal__head">
          <div>
            <h3 id="kit-picker-modal-title">Выбор товаров для комплекта</h3>
            <p>
              Только товары в наличии. Отметьте позиции или выберите все из списка.
            </p>
          </div>
          <button
            type="button"
            className="kit-picker-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="kit-picker-modal__toolbar">
          <label className="kit-picker-modal__search">
            <Search size={16} />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Поиск по названию, артикулу, штрих-коду…"
              autoFocus
            />
          </label>
          <select
            className="kit-picker-modal__category"
            value={categoryId}
            onChange={(e) => onCategoryChange?.(e.target.value)}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="kit-picker-modal__select-all"
            onClick={onToggleSelectAll}
            disabled={loading || list.length === 0}
          >
            {isAllFilteredSelected ? (
              <>
                <CheckSquare size={16} />
                Снять выбор
              </>
            ) : (
              <>
                <Square size={16} />
                Выбрать все
              </>
            )}
          </button>
          <span className="kit-picker-modal__count">
            Выбрано: <strong>{selectedCount}</strong>
          </span>
        </div>

        <div className="kit-picker-modal__grid">
          {loading ? (
            <div className="kit-picker-modal__empty">Загрузка товаров…</div>
          ) : list.length === 0 ? (
            <div className="kit-picker-modal__empty">{emptyText}</div>
          ) : (
            list.map((item) => {
              const isSelected = selectedIds?.has(item.id);
              return (
                <article
                  key={item.id}
                  className={`kit-picker-modal__card ${
                    isSelected ? "kit-picker-modal__card--selected" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`kit-picker-modal__check ${
                      isSelected ? "kit-picker-modal__check--on" : ""
                    }`}
                    onClick={() => onToggle?.(item.id)}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? `Снять выбор: ${item.title}`
                        : `Выбрать: ${item.title}`
                    }
                  >
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                  <button
                    type="button"
                    className="kit-picker-modal__card-body"
                    onClick={() => onToggle?.(item.id)}
                  >
                    <div className="kit-picker-modal__media">
                      <Package size={20} />
                    </div>
                    <div className="kit-picker-modal__info">
                      <strong title={item.title}>{item.title}</strong>
                      {item.subtitle ? <span>{item.subtitle}</span> : null}
                      {item.meta ? <small>{item.meta}</small> : null}
                    </div>
                  </button>
                </article>
              );
            })
          )}
        </div>

        <div className="kit-picker-modal__actions">
          <button
            type="button"
            className="kit-picker-modal__btn kit-picker-modal__btn--secondary"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="kit-picker-modal__btn kit-picker-modal__btn--primary"
            disabled={selectedCount === 0}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitProductsPickerModal;
