import { FaSearch, FaPlus, FaTag, FaTrash, FaEdit } from "react-icons/fa";

const MenuCategoriesTab = ({
  loadingCats,
  filteredCats,
  queryCats,
  setQueryCats,
  onCreateCat,
  onEditCat,
  onDeleteCat,
}) => {
  return (
    <>
      <div className="menu__actions" style={{ marginTop: -6 }}>
        <div className="menu__search">
          <FaSearch className="menu__searchIcon" aria-hidden />
          <input
            className="menu__searchInput"
            placeholder="Поиск категории…"
            value={queryCats}
            onChange={(e) => setQueryCats(e.target.value)}
          />
        </div>

        <button
          className="menu__btn menu__btn--primary"
          onClick={onCreateCat}
        >
          <FaPlus /> Новая категория
        </button>
      </div>

      <div className="menu__list">
        {loadingCats && <div className="menu__alert">Загрузка…</div>}

        {!loadingCats &&
          filteredCats.map((c) => (
            <article key={c.id} className="menu__card">
              <div className="menu__cardLeft">
                <div className="menu__avatar" aria-hidden>
                  <FaTag />
                </div>
                <div>
                  <h3 className="menu__name">{c.title}</h3>
                </div>
              </div>

              <div className="menu__rowActions">
                <button
                  className="menu__btn menu__btn--secondary"
                  onClick={() => onEditCat(c)}
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="menu__btn menu__btn--danger"
                  onClick={() => onDeleteCat(c.id)}
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loadingCats && !filteredCats.length && (
          <div className="menu__alert">
            Ничего не найдено по «{queryCats}».
          </div>
        )}
      </div>
    </>
  );
};

export default MenuCategoriesTab;
