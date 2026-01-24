import React from "react";
import { FaSearch, FaPlus, FaTag, FaTrash, FaEdit } from "react-icons/fa";

const MenuCategoriesTab = ({
  loadingCats,
  filteredCats,
  queryCats,
  setQueryCats,
  onCreateCat,
  onEditCat,
  onDeleteCat,
}) => (
  <>
    <div className="cafeMenu__header">
      <div className="cafeMenu__actions">
        <div className="cafeMenu__search">
          <input
            className="cafeMenu__searchInput"
            placeholder="Поиск категории…"
            value={queryCats}
            onChange={(e) => setQueryCats(e.target.value)}
            autoComplete="off"
          />
          <FaSearch className="cafeMenu__searchIcon" aria-hidden="true" />
        </div>

        <button
          type="button"
          className="cafeMenu__btn cafeMenu__btn--primary"
          onClick={onCreateCat}
          title="Создать новую категорию"
        >
          <FaPlus /> Новая категория
        </button>
      </div>
    </div>

    <div className="cafeMenu__list">
      {loadingCats && <div className="cafeMenu__alert">Загрузка…</div>}

      {!loadingCats &&
        filteredCats.map((cat) => (
          <article key={cat.id} className="cafeMenu__card">
            <div className="cafeMenu__cardLeft">
              <div className="cafeMenu__avatar" aria-hidden="true">
                <FaTag />
              </div>
              <div>
                <h3 className="cafeMenu__name">{cat.title}</h3>
              </div>
            </div>

            <div className="cafeMenu__rowActions">
              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--secondary"
                onClick={() => onEditCat(cat)}
                title="Редактировать"
              >
                <FaEdit /> Изменить
              </button>
              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--danger"
                onClick={() => onDeleteCat(cat.id)}
                title="Удалить"
              >
                <FaTrash /> Удалить
              </button>
            </div>
          </article>
        ))}

      {!loadingCats && filteredCats.length === 0 && (
        <div className="cafeMenu__alert">
          {queryCats ? `Ничего не найдено по «${queryCats}»` : "Список категорий пуст"}
        </div>
      )}
    </div>
  </>
);

export default MenuCategoriesTab;
