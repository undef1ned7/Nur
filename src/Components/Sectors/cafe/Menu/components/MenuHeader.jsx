import { FaUtensils, FaTag } from "react-icons/fa";

const MenuHeader = ({ activeTab, onTabChange }) => {
  return (
    <div className="menu__header">
      <div>
        <h2 className="menu__title">Меню</h2>
        <div className="menu__subtitle">Позиции, категории и рецептуры.</div>
      </div>

      <div className="menu__actions">
        <button
          className={`menu__btn ${
            activeTab === "items"
              ? "menu__btn--primary"
              : "menu__btn--secondary"
          }`}
          onClick={() => onTabChange("items")}
        >
          <FaUtensils /> Позиции
        </button>
        <button
          className={`menu__btn ${
            activeTab === "categories"
              ? "menu__btn--primary"
              : "menu__btn--secondary"
          }`}
          onClick={() => onTabChange("categories")}
        >
          <FaTag /> Категории
        </button>
      </div>
    </div>
  );
};

export default MenuHeader;
