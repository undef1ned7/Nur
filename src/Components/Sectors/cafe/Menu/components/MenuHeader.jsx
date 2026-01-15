// src/.../Menu/components/MenuHeader.jsx
import React from "react";
import { FaUtensils, FaTag } from "react-icons/fa";

const MenuHeader = ({ activeTab, onTabChange }) => {
  return (
    <div className="menu__head">
      <div className="menu__headLeft">
        <h2 className="menu__title">Меню</h2>
        <div className="menu__subtitle">Позиции, категории и рецептуры.</div>
      </div>

      <div className="menu__headRight">
        <div className="menu__tabs" role="tablist" aria-label="Разделы меню">
          <button
            type="button"
            className={`menu__tab ${activeTab === "items" ? "menu__tab--active" : ""}`}
            onClick={() => onTabChange("items")}
            role="tab"
            aria-selected={activeTab === "items"}
          >
            <FaUtensils /> Позиции
          </button>

          <button
            type="button"
            className={`menu__tab ${activeTab === "categories" ? "menu__tab--active" : ""}`}
            onClick={() => onTabChange("categories")}
            role="tab"
            aria-selected={activeTab === "categories"}
          >
            <FaTag /> Категории
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuHeader;
