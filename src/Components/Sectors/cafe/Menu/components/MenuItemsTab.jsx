import {
  FaSearch,
  FaPlus,
  FaUtensils,
  FaTag,
  FaTrash,
  FaEdit,
} from "react-icons/fa";

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
}) => {
  return (
    <>
      <div className="menu__actions" style={{ marginTop: -6 }}>
        <div className="menu__search">
          <FaSearch className="menu__searchIcon" aria-hidden />
          <input
            className="menu__searchInput"
            placeholder="Поиск: блюдо или категория…"
            value={queryItems}
            onChange={(e) => setQueryItems(e.target.value)}
          />
        </div>

        <button
          className="menu__btn menu__btn--primary"
          onClick={onCreate}
          disabled={!hasCategories}
          title={!hasCategories ? "Сначала добавьте категорию" : ""}
        >
          <FaPlus /> Новая позиция
        </button>
      </div>

      <div className="menu__list">
        {loadingItems && <div className="menu__alert">Загрузка…</div>}

        {!loadingItems &&
          filteredItems.map((m) => (
            <article key={m.id} className="menu__card">
              <div className="menu__cardLeft">
                <div className="menu__avatar" aria-hidden>
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.title || "Фото блюда"} />
                  ) : (
                    <FaUtensils />
                  )}
                </div>
                <div>
                  <h3 className="menu__name">{m.title}</h3>
                  <div className="menu__meta">
                    <span className="menu__muted">
                      <FaTag /> &nbsp;{categoryTitle(m.category)}
                    </span>
                    <span className="menu__muted">
                      Цена: {fmtMoney(m.price)} сом
                    </span>
                    <span
                      className={`menu__status ${
                        m.is_active ? "menu__status--on" : "menu__status--off"
                      }`}
                    >
                      {m.is_active ? "Активно" : "Скрыто"}
                    </span>
                  </div>

                  {Array.isArray(m.ingredients) &&
                    m.ingredients.length > 0 && (
                      <ul className="menu__recipeMini">
                        {m.ingredients.slice(0, 4).map((ing, i) => (
                          <li
                            key={`${ing.id || ing.product}-${i}`}
                            className="menu__muted"
                          >
                            •{" "}
                            {ing.product_title || productTitle(ing.product)} —{" "}
                            {toNum(ing.amount)}{" "}
                            {ing.product_unit || productUnit(ing.product)}
                          </li>
                        ))}
                        {m.ingredients.length > 4 && (
                          <li className="menu__muted">…</li>
                        )}
                      </ul>
                    )}
                </div>
              </div>

              <div className="menu__rowActions">
                <button
                  className="menu__btn menu__btn--secondary"
                  onClick={() => onEdit(m)}
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="menu__btn menu__btn--danger"
                  onClick={() => onDelete(m.id)}
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loadingItems && !filteredItems.length && (
          <div className="menu__alert">
            Ничего не найдено по «{queryItems}».
          </div>
        )}
      </div>
    </>
  );
};

export default MenuItemsTab;
