// RecordaHeader.jsx
import React, { useRef, useState } from "react";
import { FaPlus, FaChevronLeft, FaChevronRight, FaCalendarAlt, FaFilter, FaTimes } from "react-icons/fa";
import BarberSelect from "../../common/BarberSelect";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "booked", label: "Забронировано" },
  { value: "confirmed", label: "Подтверждено" },
  { value: "completed", label: "Завершено" },
  { value: "cancelled", label: "Отменено" },
  { value: "no_show", label: "Не пришёл" },
];

const RecordaHeader = ({
  fltDate,
  fltBarber,
  fltStatus,
  barbers,
  recordsCount,
  onDateChange,
  onBarberChange,
  onStatusChange,
  onPrevDay,
  onNextDay,
  onToday,
  isToday,
  onAddClick,
}) => {
  const dateInputRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const barberOptions = [
    { value: "", label: "Все сотрудники" },
    ...barbers.map((b) => ({ value: String(b.id), label: b.name })),
  ];

  // Считаем активные фильтры
  const activeFiltersCount = [
    fltBarber ? fltBarber : null,
    fltStatus ? fltStatus : null,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    onBarberChange("");
    onStatusChange("");
  };

  // Форматирование даты для отображения
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const options = { weekday: "short", day: "numeric", month: "short" };
    return d.toLocaleDateString("ru-RU", options);
  };

  // Открыть пикер даты
  const openDatePicker = () => {
    dateInputRef.current?.showPicker?.();
  };

  return (
    <>
      <div className="barberrecorda__topBar">
        {/* Навигация по датам */}
        <div className="barberrecorda__dateNav">
          <button
            type="button"
            className="barberrecorda__navBtn"
            onClick={onPrevDay}
            aria-label="Предыдущий день"
            title="Предыдущий день"
          >
            <FaChevronLeft />
          </button>

          <button
            type="button"
            className="barberrecorda__dateDisplay"
            onClick={openDatePicker}
            title="Выбрать дату"
          >
            <input
              ref={dateInputRef}
              type="date"
              className="barberrecorda__dateHidden"
              value={fltDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
            <FaCalendarAlt className="barberrecorda__calIcon" />
            <span className="barberrecorda__dateText">
              {formatDisplayDate(fltDate)}
            </span>
          </button>

          <button
            type="button"
            className="barberrecorda__navBtn"
            onClick={onNextDay}
            aria-label="Следующий день"
            title="Следующий день"
          >
            <FaChevronRight />
          </button>

          {!isToday && (
            <button
              type="button"
              className="barberrecorda__todayBtn"
              onClick={onToday}
            >
              Сегодня
            </button>
          )}
        </div>

        {/* Счётчик записей */}
        <div className="barberrecorda__counter">
          <span className="barberrecorda__counterNum">{recordsCount}</span>
          <span className="barberrecorda__counterLabel">
            {recordsCount === 1 ? "запись" : recordsCount >= 2 && recordsCount <= 4 ? "записи" : "записей"}
          </span>
        </div>

        {/* Кнопка "Фильтры" */}
        <div className="barberrecorda__filtersWrap">
          <button
            type="button"
            className={`barberrecorda__filtersBtn ${filtersOpen ? "is-open" : ""} ${activeFiltersCount > 0 ? "has-active" : ""}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <FaFilter />
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="barberrecorda__filtersBadge">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        {/* Кнопка добавления */}
        <button
          type="button"
          className="barberrecorda__btn barberrecorda__btn--primary"
          onClick={onAddClick}
          aria-label="Добавить запись"
        >
          <FaPlus />
          <span className="barberrecorda__btnText">Добавить</span>
        </button>
      </div>

      {/* Модальное окно фильтров */}
      {filtersOpen && (
        <>
          <div className="barberrecorda__filtersOverlay" onClick={() => setFiltersOpen(false)} />
          <div className="barberrecorda__filtersPanel">
            <div className="barberrecorda__filtersPanelHeader">
              <span className="barberrecorda__filtersPanelTitle">Фильтры</span>
              <button
                type="button"
                className="barberrecorda__filtersPanelClose"
                onClick={() => setFiltersOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberrecorda__filtersPanelBody">
              <div className="barberrecorda__filtersPanelRow">
                <label className="barberrecorda__filtersPanelLabel">Сотрудник</label>
                <BarberSelect
                  value={fltBarber}
                  onChange={onBarberChange}
                  options={barberOptions}
                  placeholder="Все сотрудники"
                />
              </div>

              <div className="barberrecorda__filtersPanelRow">
                <label className="barberrecorda__filtersPanelLabel">Статус</label>
                <BarberSelect
                  value={fltStatus}
                  onChange={onStatusChange}
                  options={STATUS_OPTIONS}
                  placeholder="Все статусы"
                />
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="barberrecorda__filtersPanelFooter">
                <button
                  type="button"
                  className="barberrecorda__filtersPanelClear"
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

export default RecordaHeader;
