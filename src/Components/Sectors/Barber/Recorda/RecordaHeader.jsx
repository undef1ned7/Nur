// RecordaHeader.jsx
import React from "react";
import { FaPlus, FaCalendarAlt } from "react-icons/fa";

const RecordaHeader = ({
  fltDate,
  fltBarber,
  barbers,
  onDateChange,
  onBarberChange,
  onAddClick,
}) => {
  return (
    <div className="barberrecorda__topBar">
      <div className="barberrecorda__dateFilter">
        <FaCalendarAlt className="barberrecorda__dateIcon" />
        <input
          className="barberrecorda__dateInput"
          type="date"
          value={fltDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Дата расписания"
        />
      </div>

      <div className="barberrecorda__selectWrap">
        <select
          className="barberrecorda__input barberrecorda__input--select"
          value={fltBarber}
          onChange={(e) => onBarberChange(e.target.value)}
          aria-label="Фильтр по сотруднику"
        >
          <option value="">Все сотрудники</option>
          {barbers.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="barberrecorda__btn barberrecorda__btn--primary"
        onClick={onAddClick}
        aria-label="Добавить запись"
      >
        <FaPlus />
        <span>Добавить</span>
      </button>
    </div>
  );
};

export default RecordaHeader;
