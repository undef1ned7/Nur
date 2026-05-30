import React, { useMemo } from "react";
import { CheckSquare, Search, Square, X } from "lucide-react";

const safeStr = (value) => String(value ?? "").trim();

const TechCardsPickerModal = ({
  open,
  onClose,
  dishes = [],
  categories = [],
  searchValue = "",
  onSearchChange,
  categoryId = "",
  onCategoryChange,
  selectedIds,
  onToggleDish,
  onToggleSelectAll,
  isAllFilteredSelected,
  onDownload,
  downloading = false,
  loadingDishes = false,
}) => {
  const categoryOptions = useMemo(() => {
    const base = (Array.isArray(categories) ? categories : [])
      .map((cat) => ({
        value: String(cat.id || ""),
        label: safeStr(cat.title) || "Категория",
      }))
      .filter((opt) => opt.value);
    return [{ value: "", label: "Все категории" }, ...base];
  }, [categories]);

  if (!open) return null;

  const selectedCount = selectedIds.size;
  const list = Array.isArray(dishes) ? dishes : [];

  return (
    <div className="cafe-costing-page__overlay" onClick={onClose}>
      <div
        className="cafe-costing-page__modal cafe-costing-page__modal--wide cafe-costing-page__techcards-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="techcards-picker-title"
      >
        <div className="cafe-costing-page__modal-head">
          <div>
            <span className="cafe-costing-page__eyebrow">Технические карты</span>
            <h3 id="techcards-picker-title">Выбор блюд для PDF</h3>
            <p>
              Отметьте блюда, по которым нужно сформировать техкарты. На каждое блюдо —
              отдельная страница в PDF.
            </p>
          </div>
          <button
            type="button"
            className="cafe-costing-page__modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cafe-costing-page__techcards-picker-toolbar">
          <label className="cafe-costing-page__search cafe-costing-page__techcards-picker-search">
            <Search size={16} />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск по названию блюда"
            />
          </label>
          <select
            className="cafe-costing-page__input cafe-costing-page__techcards-picker-category"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="cafe-costing-page__btn cafe-costing-page__btn--secondary cafe-costing-page__techcards-picker-select-all"
            onClick={onToggleSelectAll}
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
          <span className="cafe-costing-page__techcards-picker-count">
            Выбрано: <strong>{selectedCount}</strong>
          </span>
        </div>

        <div className="cafe-costing-page__techcards-picker-grid">
          {loadingDishes ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="cafe-costing-page__skeleton-card cafe-costing-page__techcards-picker-skeleton"
              />
            ))
          ) : list.length === 0 ? (
            <div className="cafe-costing-page__empty cafe-costing-page__techcards-picker-empty">
              Блюда не найдены. Измените поиск или категорию.
            </div>
          ) : (
            list.map((item) => {
              const id = String(item?.id || "");
              const title = safeStr(item?.title) || "Блюдо";
              const category =
                item?.category_title ||
                item?.category_name ||
                "Без категории";
              const image = item?.image_url || item?.image || "";
              const isSelected = selectedIds.has(id);
              const ingredientsCount = Number(item?.ingredients_count) || 0;

              return (
                <article
                  key={id}
                  className={`cafe-costing-page__techcards-picker-card ${
                    isSelected ? "cafe-costing-page__techcards-picker-card--selected" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`cafe-costing-page__techcards-picker-check ${
                      isSelected ? "cafe-costing-page__techcards-picker-check--on" : ""
                    }`}
                    onClick={() => onToggleDish(id)}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `Снять выбор: ${title}` : `Выбрать: ${title}`}
                  >
                    {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
                  </button>
                  <button
                    type="button"
                    className="cafe-costing-page__techcards-picker-card-body"
                    onClick={() => onToggleDish(id)}
                  >
                    <div className="cafe-costing-page__techcards-picker-media">
                      {image ? (
                        <img src={image} alt="" />
                      ) : (
                        <span>{title.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="cafe-costing-page__techcards-picker-info">
                      <strong title={title}>{title}</strong>
                      <span>{category}</span>
                      <small>
                        {ingredientsCount > 0
                          ? `${ingredientsCount} ингредиент(ов)`
                          : "Состав не заполнен"}
                      </small>
                    </div>
                  </button>
                </article>
              );
            })
          )}
        </div>

        <div className="cafe-costing-page__modal-actions">
          <button
            type="button"
            className="cafe-costing-page__btn cafe-costing-page__btn--secondary"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="cafe-costing-page__btn cafe-costing-page__btn--dark"
            disabled={downloading || selectedCount === 0}
            onClick={onDownload}
          >
            {downloading ? "Формирование PDF..." : "Скачать PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TechCardsPickerModal;
