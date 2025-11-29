// BarberClientsHeader.jsx
import React from "react";
import { FaPlus, FaSearch } from "react-icons/fa";
import { STATUS_FILTER_OPTIONS } from "./barberClientConstants";

const BarberClientsHeader = ({
  loading,
  totalCount,
  fltStatus,
  statusOpen,
  onToggleStatusOpen,
  onStatusChange,
  search,
  onSearchChange,
  onAdd,
}) => {
  return (
    <header className="barberclient__header">
      <div className="barberclient__counter">
        {loading ? "Загрузка…" : `${totalCount} клиентов`}
      </div>

      <div className="barberclient__actions">
        {/* кастомный дропдаун статусов */}
        <div
          className="barberclient__selectWrapper"
          tabIndex={-1}
          onBlur={(e) => {
            const rt = e.relatedTarget;
            if (!rt || !e.currentTarget.contains(rt)) {
              onToggleStatusOpen(false);
            }
          }}
        >
          <button
            type="button"
            className={`barberclient__selectTrigger ${
              statusOpen ? "barberclient__selectTrigger--open" : ""
            }`}
            onClick={() => onToggleStatusOpen(!statusOpen)}
          >
            <span>{fltStatus}</span>
            <span className="barberclient__selectArrow" />
          </button>

          {statusOpen && (
            <div className="barberclient__selectMenu">
              {STATUS_FILTER_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`barberclient__selectOption ${
                    fltStatus === s
                      ? "barberclient__selectOption--active"
                      : ""
                  }`}
                  onClick={() => onStatusChange(s)}
                >
                  <span>{s}</span>
                  {fltStatus === s && (
                    <span className="barberclient__selectCheck">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="barberclient__search">
          <FaSearch className="barberclient__search-icon" />
          <input
            className="barberclient__search-input"
            type="text"
            placeholder="Поиск по ФИО или телефону"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
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
      </div>
    </header>
  );
};

export default BarberClientsHeader;
