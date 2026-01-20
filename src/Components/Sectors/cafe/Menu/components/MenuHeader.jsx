import React from "react";
import { FaUtensils, FaTag } from "react-icons/fa";

const MenuHeader = ({ activeTab, onTabChange }) => (
  <div className="cafeMenu__head">
    <div className="cafeMenu__headLeft">
      <h2 className="cafeMenu__title">Меню</h2>
      <div className="cafeMenu__subtitle">Позиции, категории и рецептуры</div>
    </div>

    <div className="cafeMenu__headRight">
      <div className="cafeMenu__tabs" role="tablist" aria-label="Разделы меню">
        <button
          type="button"
          className={`cafeMenu__tab ${activeTab === "items" ? "cafeMenu__tab--active" : ""}`}
          onClick={() => onTabChange("items")}
          role="tab"
          aria-selected={activeTab === "items"}
        >
          <FaUtensils /> Позиции
        </button>

        <button
          type="button"
          className={`cafeMenu__tab ${activeTab === "categories" ? "cafeMenu__tab--active" : ""}`}
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

export default MenuHeader;
