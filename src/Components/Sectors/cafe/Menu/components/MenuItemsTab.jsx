import React, { useMemo } from "react";
import { FaPlus, FaPen, FaTrash, FaSearch } from "react-icons/fa";

const safeStr = (v) => String(v ?? "").trim();

const MenuItemsTab = ({
  loadingItems,
  filteredItems,
  queryItems,
  setQueryItems,
  onCreate,
  onEdit,
  onDelete,
  hasCategories,
  categoryTitle,
  fmtMoney,
  toNum,
  productTitle,
  productUnit,
  viewMode, // "list" | "cards"
}) => {
  const items = Array.isArray(filteredItems) ? filteredItems : [];

  const emptyText = useMemo(() => {
    if (loadingItems) return "";
    if (!hasCategories) return "Сначала создайте категорию.";
    if (safeStr(queryItems)) return "Ничего не найдено.";
    return "Список блюд пуст.";
  }, [loadingItems, hasCategories, queryItems]);

  const renderRecipeMini = (row) => {
    const ings = Array.isArray(row?.ingredients) ? row.ingredients : [];
    if (!ings.length) return null;

    return (
      <ul className="menu__recipeMini">
        {ings.slice(0, 3).map((ing) => {
          const pid = ing?.product;
          const title = productTitle(pid);
          const unit = productUnit(pid);
          const amount = toNum(ing?.amount);
          return (
            <li key={ing?.id || `${pid}-${amount}`}>
              {title}: {amount} {unit}
            </li>
          );
        })}
        {ings.length > 3 && <li>… ещё {ings.length - 3}</li>}
      </ul>
    );
  };

  const renderList = () => {
    return (
      <div className="menu__list">
        {items.map((m) => {
          const title = safeStr(m?.title) || "—";
          const cat = categoryTitle(m?.category);
          const price = fmtMoney(m?.price);
          const isOn = !!m?.is_active;
          const img = m?.image_url || m?.image || "";

          return (
            <div className="menu__card" key={m?.id}>
              <div className="menu__cardLeft">
                <div className="menu__avatar" aria-hidden="true">
                  {img ? (
                    <img src={img} alt={title} />
                  ) : (
                    <span>{title.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <p className="menu__name" title={title}>
                    {title}
                  </p>

                  <div className="menu__meta">
                    <span className="menu__muted">{cat}</span>
                    <span className="menu__muted">{price}</span>

                    <span className={`menu__status ${isOn ? "menu__status--on" : "menu__status--off"}`}>
                      {isOn ? "Активно" : "Не активно"}
                    </span>
                  </div>

                  {renderRecipeMini(m)}
                </div>
              </div>

              <div className="menu__rowActions">
                <button
                  type="button"
                  className="menu__btn menu__btn--secondary"
                  onClick={() => onEdit(m)}
                  title="Редактировать"
                >
                  <FaPen /> Изменить
                </button>

                <button
                  type="button"
                  className="menu__btn menu__btn--danger"
                  onClick={() => onDelete(m?.id)}
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
  };

  const renderCards = () => {
    return (
      <div className="menu__grid">
        {items.map((m) => {
          const title = safeStr(m?.title) || "—";
          const cat = categoryTitle(m?.category);
          const price = fmtMoney(m?.price);
          const isOn = !!m?.is_active;
          const img = m?.image_url || m?.image || "";

          return (
            <article className="menu__tile" key={m?.id}>
              <div className="menu__tileMedia">
                {img ? (
                  <img src={img} alt={title} />
                ) : (
                  <div className="menu__avatar" style={{ width: "100%", height: "100%", borderRadius: 0 }}>
                    <span style={{ fontSize: 28, fontWeight: 900 }}>
                      {title.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="menu__tileBody">
                <h4 className="menu__tileTitle" title={title}>
                  {title}
                </h4>

                <div className="menu__tileRow">
                  <span className="menu__tileCat">{cat}</span>
                  <span className="menu__tilePrice">{price}</span>
                </div>

                <div className="menu__tileRow">
                  <span className={`menu__status ${isOn ? "menu__status--on" : "menu__status--off"}`}>
                    {isOn ? "Активно" : "Не активно"}
                  </span>
                </div>

                {renderRecipeMini(m)}
              </div>

              <div className="menu__tileActions">
                <div className="menu__tileActionsRow">
                  <button
                    type="button"
                    className="menu__btn menu__btn--secondary"
                    onClick={() => onEdit(m)}
                    title="Редактировать"
                  >
                    <FaPen /> Изменить
                  </button>

                  <button
                    type="button"
                    className="menu__btn menu__btn--danger"
                    onClick={() => onDelete(m?.id)}
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
  };

  return (
    <>
      <div className="menu__header">
        <div className="menu__actions">
          <div className="menu__search">
            <FaSearch className="menu__searchIcon" />
            <input
              className="menu__searchInput"
              value={queryItems}
              onChange={(e) => setQueryItems(e.target.value)}
              placeholder="Поиск по названию или категории…"
              type="text"
              autoComplete="off"
            />
          </div>

          <button
            type="button"
            className="menu__btn menu__btn--primary"
            onClick={onCreate}
            disabled={!hasCategories}
            title={!hasCategories ? "Сначала создайте категорию" : "Добавить блюдо"}
          >
            <FaPlus /> Добавить
          </button>
        </div>
      </div>

      {loadingItems && <div className="menu__alert">Загрузка…</div>}

      {!loadingItems && (items?.length || 0) === 0 && (
        <div className="menu__alert">{emptyText}</div>
      )}

      {!loadingItems && (items?.length || 0) > 0 && (
        <>{viewMode === "cards" ? renderCards() : renderList()}</>
      )}
    </>
  );
};

export default MenuItemsTab;
