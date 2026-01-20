// MastersHistoryHeader.jsx
import React, { useState } from "react";
import { FaSearch, FaThLarge, FaList, FaFilter, FaTimes } from "react-icons/fa";
import BarberSelect from "../../../common/BarberSelect";

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "completed", label: "Завершено" },
  { value: "booked", label: "Забронировано" },
  { value: "confirmed", label: "Подтверждено" },
  { value: "canceled", label: "Отменено" },
  { value: "no_show", label: "Не пришёл" },
];

const MastersHistoryHeader = ({
  totalCount,
  search,
  statusFilter,
  viewMode,
  employeeFilter,
  employeeOptions,
  yearFilter,
  monthFilter,
  dayFilter,
  yearOptions,
  monthOptions,
  dayOptions,
  onSearchChange,
  onStatusChange,
  onViewModeChange,
  onEmployeeChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  onReset,
  hasFilters,
  loading,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Считаем количество активных фильтров (все кроме поиска)
  const activeFiltersCount = [
    statusFilter && statusFilter !== "all" ? statusFilter : null,
    employeeFilter,
    yearFilter,
  ].filter(Boolean).length;

  const countLabel = loading
    ? "Загрузка…"
    : `${totalCount} ${totalCount === 1 ? "запись" : totalCount >= 2 && totalCount <= 4 ? "записи" : "записей"}`;

  const handleResetAll = () => {
    onReset();
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    onStatusChange("all");
    onEmployeeChange("");
    onYearChange("");
  };

  return (
    <>
      <header className="barbermastershistory__header">
        <div className="barbermastershistory__topRow">
          <span className="barbermastershistory__counter">{countLabel}</span>
          {hasFilters && (
            <button
              type="button"
              className="barbermastershistory__resetBtn"
              onClick={handleResetAll}
            >
              Сбросить всё
            </button>
          )}
        </div>

        <div className="barbermastershistory__actions">
          <div className="barbermastershistory__searchWrap">
            <FaSearch className="barbermastershistory__searchIcon" />
            <input
              type="text"
              className="barbermastershistory__searchInput"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          {/* Кнопка "Фильтры" */}
          <div className="barbermastershistory__filtersWrap">
            <button
              type="button"
              className={`barbermastershistory__filtersBtn ${filtersOpen ? "is-open" : ""} ${activeFiltersCount > 0 ? "has-active" : ""}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <FaFilter />
              <span>Фильтры</span>
              {activeFiltersCount > 0 && (
                <span className="barbermastershistory__filtersBadge">{activeFiltersCount}</span>
              )}
            </button>
          </div>

          <div className="barbermastershistory__viewToggle">
            <button
              type="button"
              className={`barbermastershistory__viewBtn ${viewMode === "table" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("table")}
              title="Таблица"
              aria-label="Вид таблицей"
            >
              <FaList />
            </button>
            <button
              type="button"
              className={`barbermastershistory__viewBtn ${viewMode === "cards" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("cards")}
              title="Карточки"
              aria-label="Вид карточками"
            >
              <FaThLarge />
            </button>
          </div>
        </div>
      </header>

      {/* Модальное окно фильтров */}
      {filtersOpen && (
        <>
          <div className="barbermastershistory__filtersOverlay" onClick={() => setFiltersOpen(false)} />
          <div className="barbermastershistory__filtersPanel">
            <div className="barbermastershistory__filtersPanelHeader">
              <span className="barbermastershistory__filtersPanelTitle">Фильтры</span>
              <button
                type="button"
                className="barbermastershistory__filtersPanelClose"
                onClick={() => setFiltersOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="barbermastershistory__filtersPanelBody">
              <div className="barbermastershistory__filtersPanelRow">
                <label className="barbermastershistory__filtersPanelLabel">Статус</label>
                <BarberSelect
                  value={statusFilter}
                  onChange={onStatusChange}
                  options={STATUS_OPTIONS}
                  placeholder="Все статусы"
                />
              </div>

              <div className="barbermastershistory__filtersPanelRow">
                <label className="barbermastershistory__filtersPanelLabel">Сотрудник</label>
                <BarberSelect
                  value={employeeFilter}
                  onChange={onEmployeeChange}
                  options={employeeOptions}
                  placeholder="Все сотрудники"
                />
              </div>

              <div className="barbermastershistory__filtersPanelRow">
                <label className="barbermastershistory__filtersPanelLabel">Год</label>
                <BarberSelect
                  value={yearFilter}
                  onChange={onYearChange}
                  options={yearOptions}
                  placeholder="Все годы"
                />
              </div>

              <div className="barbermastershistory__filtersPanelRow">
                <label className="barbermastershistory__filtersPanelLabel">Месяц</label>
                <BarberSelect
                  value={monthFilter}
                  onChange={onMonthChange}
                  options={monthOptions}
                  placeholder="Все месяцы"
                  disabled={!yearFilter}
                />
              </div>

              <div className="barbermastershistory__filtersPanelRow">
                <label className="barbermastershistory__filtersPanelLabel">День</label>
                <BarberSelect
                  value={dayFilter}
                  onChange={onDayChange}
                  options={dayOptions}
                  placeholder="Все дни"
                  disabled={!yearFilter || !monthFilter}
                />
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="barbermastershistory__filtersPanelFooter">
                <button
                  type="button"
                  className="barbermastershistory__filtersPanelClear"
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

export default MastersHistoryHeader;
