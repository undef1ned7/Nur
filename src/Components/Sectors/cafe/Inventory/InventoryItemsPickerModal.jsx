import React from "react";
import {
  FaCheckSquare,
  FaSearch,
  FaSquare,
  FaTimes,
} from "react-icons/fa";

const InventoryItemsPickerModal = ({
  open,
  onClose,
  title,
  description,
  searchValue = "",
  onSearchChange,
  items = [],
  selectedIds,
  onToggle,
  onToggleSelectAll,
  isAllFilteredSelected = false,
  onConfirm,
  confirmLabel = "Добавить выбранные",
  emptyText = "Ничего не найдено",
  icon: Icon = null,
}) => {
  if (!open) return null;

  const selectedCount = selectedIds?.size ?? 0;
  const list = Array.isArray(items) ? items : [];

  return (
    <div
      className="cafeInventory__pickerOverlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="cafeInventory__pickerModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-items-picker-title"
      >
        <div className="cafeInventory__pickerHead">
          <div>
            <h3 id="inventory-items-picker-title" className="cafeInventory__pickerTitle">
              {title}
            </h3>
            {description ? (
              <p className="cafeInventory__pickerDesc">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="cafeInventory__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="cafeInventory__pickerToolbar">
          <label className="cafeInventory__pickerSearch">
            <FaSearch />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Поиск…"
              autoFocus
            />
          </label>
          <button
            type="button"
            className="cafeInventory__btn cafeInventory__btn--secondary"
            onClick={onToggleSelectAll}
            disabled={list.length === 0}
          >
            {isAllFilteredSelected ? (
              <>
                <FaCheckSquare /> Снять выбор
              </>
            ) : (
              <>
                <FaSquare /> Выбрать все
              </>
            )}
          </button>
          <span className="cafeInventory__pickerCount">
            Выбрано: <strong>{selectedCount}</strong>
          </span>
        </div>

        <div className="cafeInventory__pickerGrid">
          {list.length === 0 ? (
            <div className="cafeInventory__pickerEmpty">{emptyText}</div>
          ) : (
            list.map((item) => {
              const id = String(item.id || "");
              const isSelected = selectedIds?.has(id);
              const ItemIcon = item.icon || Icon;

              return (
                <article
                  key={id}
                  className={`cafeInventory__pickerCard ${
                    isSelected ? "cafeInventory__pickerCard--selected" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`cafeInventory__pickerCheck ${
                      isSelected ? "cafeInventory__pickerCheck--on" : ""
                    }`}
                    onClick={() => onToggle?.(id)}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? `Снять выбор: ${item.title}`
                        : `Выбрать: ${item.title}`
                    }
                  >
                    {isSelected ? <FaCheckSquare /> : <FaSquare />}
                  </button>
                  <button
                    type="button"
                    className="cafeInventory__pickerCardBody"
                    onClick={() => onToggle?.(id)}
                  >
                    <div className="cafeInventory__pickerMedia">
                      {ItemIcon ? (
                        <ItemIcon />
                      ) : (
                        <span>{String(item.title || "?").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="cafeInventory__pickerInfo">
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

        <div className="cafeInventory__pickerActions">
          <button
            type="button"
            className="cafeInventory__btn cafeInventory__btn--secondary"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="cafeInventory__btn cafeInventory__btn--primary"
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

export default InventoryItemsPickerModal;
