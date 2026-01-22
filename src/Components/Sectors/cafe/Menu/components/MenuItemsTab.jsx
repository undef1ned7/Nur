import React, { useMemo } from "react";
import { FaPlus, FaPen, FaTrash, FaSearch } from "react-icons/fa";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";

const safeStr = (value) => String(value ?? "").trim();

const toNumberSafe = (value) => {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const percent = (num, den) => {
  const n = toNumberSafe(num);
  const d = toNumberSafe(den);
  if (!d) return 0;
  return (n / d) * 100;
};

const MenuItemsTab = ({
  loadingItems,
  filteredItems,
  queryItems,
  setQueryItems,
  categories,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  onCreate,
  onEdit,
  onDelete,
  hasCategories,
  categoryTitle,
  formatMoney,
  viewMode,
}) => {
  const items = Array.isArray(filteredItems) ? filteredItems : [];

  const categoryOptions = useMemo(() => {
    const baseOptions = (Array.isArray(categories) ? categories : [])
      .map((cat) => ({
        value: String(cat.id),
        label: safeStr(cat.title),
      }))
      .filter((opt) => opt.value && opt.label);

    return [{ value: "", label: "Все категории" }, ...baseOptions];
  }, [categories]);

  const emptyMessage = useMemo(() => {
    if (loadingItems) return "";
    if (!hasCategories) return "Сначала создайте категорию";
    if (safeStr(queryItems) || safeStr(selectedCategoryFilter)) return "Ничего не найдено";
    return "Список блюд пуст";
  }, [loadingItems, hasCategories, queryItems, selectedCategoryFilter]);

  const renderEconomics = (item) => {
    const price = Math.max(0, toNumberSafe(item?.price));
    const ing = Math.max(0, toNumberSafe(item?.ingredients_cost));
    const other = Math.max(0, toNumberSafe(item?.other_expenses));

    // ВАЖНО: прибыль = цена - ингредиенты
    // (если цена = ингредиенты + прочие, то прибыль == прочие)
    const profit = Math.max(0, price - ing);

    // Маржа от цены продажи
    const margin = percent(profit, price);

    return (
      <div className="cafeMenu__meta" style={{ marginTop: 6 }}>
        <span className="cafeMenu__muted">Ингр.: {formatMoney(ing)} сом</span>
        <span className="cafeMenu__muted">Прочие: {formatMoney(other)} сом</span>
        <span className="cafeMenu__muted">Прибыль: {formatMoney(profit)} сом</span>
        <span className="cafeMenu__muted">Маржа: {Math.round(margin)}%</span>
      </div>
    );
  };

  const renderListView = () => (
    <div className="cafeMenu__list">
      {items.map((item) => {
        const title = safeStr(item?.title) || "—";
        const category = categoryTitle(item?.category);
        const priceTxt = `${formatMoney(item?.price)} сом`;
        const isActive = !!item?.is_active;
        const image = item?.image_url || item?.image || "";

        return (
          <div className="cafeMenu__card" key={item?.id}>
            <div className="cafeMenu__cardLeft">
              <div className="cafeMenu__avatar" aria-hidden="true">
                {image ? (
                  <img src={image} alt={title} />
                ) : (
                  <span>{title.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <p className="cafeMenu__name" title={title}>
                  {title}
                </p>

                <div className="cafeMenu__meta">
                  <span className="cafeMenu__muted">{category}</span>
                  <span className="cafeMenu__muted">{priceTxt}</span>

                  <span
                    className={`cafeMenu__status ${
                      isActive ? "cafeMenu__status--on" : "cafeMenu__status--off"
                    }`}
                  >
                    {isActive ? "Активно" : "Не активно"}
                  </span>
                </div>

                {/* Экономика: Ингр / Прочие / Прибыль / Маржа */}
                {renderEconomics(item)}
              </div>
            </div>

            <div className="cafeMenu__rowActions">
              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--secondary"
                onClick={() => onEdit(item)}
                title="Редактировать"
              >
                <FaPen /> Изменить
              </button>

              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--danger"
                onClick={() => onDelete(item?.id)}
                title="Удалить"
              >
                <FaTrash /> Удалить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCardsView = () => (
    <div className="cafeMenu__grid">
      {items.map((item) => {
        const title = safeStr(item?.title) || "—";
        const category = categoryTitle(item?.category);
        const priceTxt = `${formatMoney(item?.price)} сом`;
        const isActive = !!item?.is_active;
        const image = item?.image_url || item?.image || "";

        return (
          <article className="cafeMenu__tile" key={item?.id}>
            <div className="cafeMenu__tileMedia">
              {image ? (
                <img src={image} alt={title} />
              ) : (
                <div
                  className="cafeMenu__avatar"
                  style={{ width: "100%", height: "100%", borderRadius: 0 }}
                >
                  <span style={{ fontSize: 28, fontWeight: 900 }}>
                    {title.slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="cafeMenu__tileBody">
              <h4 className="cafeMenu__tileTitle" title={title}>
                {title}
              </h4>

              <div className="cafeMenu__tileRow">
                <span className="cafeMenu__tileCat">{category}</span>
                <span className="cafeMenu__tilePrice">{priceTxt}</span>
              </div>

              <div className="cafeMenu__tileRow">
                <span
                  className={`cafeMenu__status ${
                    isActive ? "cafeMenu__status--on" : "cafeMenu__status--off"
                  }`}
                >
                  {isActive ? "Активно" : "Не активно"}
                </span>
              </div>

              {/* Экономика: Ингр / Прочие / Прибыль / Маржа */}
              {renderEconomics(item)}
            </div>

            <div className="cafeMenu__tileActions">
              <div className="cafeMenu__tileActionsRow">
                <button
                  type="button"
                  className="cafeMenu__btn cafeMenu__btn--secondary"
                  onClick={() => onEdit(item)}
                  title="Редактировать"
                >
                  <FaPen /> Изменить
                </button>

                <button
                  type="button"
                  className="cafeMenu__btn cafeMenu__btn--danger"
                  onClick={() => onDelete(item?.id)}
                  title="Удалить"
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="cafeMenu__header">
        <div className="cafeMenu__actions">
          <div className="cafeMenu__filters">
            <div className="cafeMenu__search">
              <input
                className="cafeMenu__searchInput"
                value={queryItems}
                onChange={(e) => setQueryItems(e.target.value)}
                placeholder="Поиск по названию или категории…"
                type="text"
                autoComplete="off"
              />
              <FaSearch className="cafeMenu__searchIcon" aria-hidden="true" />
            </div>

            {hasCategories && (
              <div className="cafeMenu__filterCategory">
                <SearchableCombobox
                  value={selectedCategoryFilter}
                  onChange={(val) => setSelectedCategoryFilter(val || "")}
                  options={categoryOptions}
                  placeholder="Фильтр по категории…"
                  disabled={!categoryOptions.length}
                  classNamePrefix="cafeMenuCombo"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="cafeMenu__btn cafeMenu__btn--primary"
            onClick={onCreate}
            disabled={!hasCategories}
            title={!hasCategories ? "Сначала создайте категорию" : "Добавить блюдо"}
          >
            <FaPlus /> Добавить
          </button>
        </div>
      </div>

      {loadingItems && <div className="cafeMenu__alert">Загрузка…</div>}

      {!loadingItems && items.length === 0 && (
        <div className="cafeMenu__alert">{emptyMessage}</div>
      )}

      {!loadingItems && items.length > 0 && (
        <>{viewMode === "cards" ? renderCardsView() : renderListView()}</>
      )}
    </>
  );
};

export default MenuItemsTab;
