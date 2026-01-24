// ClientsHeader.jsx
import React, { useState } from "react";
import { FaPlus, FaSearch, FaThLarge, FaList, FaFilter, FaTimes } from "react-icons/fa";
import BarberSelect from "../../common/BarberSelect";

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "Активен", label: "Активен" },
  { value: "VIP", label: "VIP" },
  { value: "Неактивен", label: "Неактивен" },
  { value: "В черном списке", label: "В чёрном списке" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "name_asc", label: "Имя А-Я" },
  { value: "name_desc", label: "Имя Я-А" },
  { value: "visits_desc", label: "По визитам" },
  { value: "last_visit", label: "По посл. визиту" },
];

const ClientsHeader = ({
  fltStatus,
  onStatusChange,
  sortBy,
  onSortChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onReset,
  onAdd,
  hasFilters,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Считаем активные фильтры (кроме поиска)
  const activeFiltersCount = [
    fltStatus && fltStatus !== "all" ? fltStatus : null,
    sortBy !== "newest" ? sortBy : null,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    onStatusChange("all");
    onSortChange("newest");
  };

  const handleResetAll = () => {
    onReset();
    setFiltersOpen(false);
  };

  return (
    <>
      <header className="barberclient__header">
        <div className="barberclient__actions">
          <div className="barberclient__searchWrap">
            <FaSearch className="barberclient__searchIcon" />
            <input
              className="barberclient__searchInput"
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          {/* Кнопка "Фильтры" */}
          <div className="barberclient__filtersWrap">
            <button
              type="button"
              className={`barberclient__filtersBtn ${filtersOpen ? "is-open" : ""} ${activeFiltersCount > 0 ? "has-active" : ""}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <FaFilter />
              <span>Фильтры</span>
              {activeFiltersCount > 0 && (
                <span className="barberclient__filtersBadge">{activeFiltersCount}</span>
              )}
            </button>
          </div>

          <div className="barberclient__viewToggle">
            <button
              className={`barberclient__viewBtn ${viewMode === "table" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("table")}
              title="Таблица"
              aria-label="Вид таблицей"
            >
              <FaList />
            </button>
            <button
              className={`barberclient__viewBtn ${viewMode === "cards" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("cards")}
              title="Карточки"
              aria-label="Вид карточками"
            >
              <FaThLarge />
            </button>
          </div>

          <button
            className="barberclient__addBtn"
            onClick={onAdd}
            type="button"
            aria-label="Добавить клиента"
            title="Добавить клиента"
          >
            <FaPlus />
          </button>

          {hasFilters && (
            <button
              type="button"
              className="barberclient__resetBtn"
              onClick={handleResetAll}
            >
              Сбросить всё
            </button>
          )}
        </div>
      </header>

      {/* Модальное окно фильтров */}
      {filtersOpen && (
        <>
          <div className="barberclient__filtersOverlay" onClick={() => setFiltersOpen(false)} />
          <div className="barberclient__filtersPanel">
            <div className="barberclient__filtersPanelHeader">
              <span className="barberclient__filtersPanelTitle">Фильтры</span>
              <button
                type="button"
                className="barberclient__filtersPanelClose"
                onClick={() => setFiltersOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberclient__filtersPanelBody">
              <div className="barberclient__filtersPanelRow">
                <label className="barberclient__filtersPanelLabel">Статус</label>
                <BarberSelect
                  value={fltStatus}
                  onChange={onStatusChange}
                  options={STATUS_OPTIONS}
                  placeholder="Все статусы"
                />
              </div>

              <div className="barberclient__filtersPanelRow">
                <label className="barberclient__filtersPanelLabel">Сортировка</label>
                <BarberSelect
                  value={sortBy}
                  onChange={onSortChange}
                  options={SORT_OPTIONS}
                  placeholder="Сортировка"
                />
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="barberclient__filtersPanelFooter">
                <button
                  type="button"
                  className="barberclient__filtersPanelClear"
                  onClick={handleClearFilters}
                >
                  Очистить фильтры
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default ClientsHeader;
