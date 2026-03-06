import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import "./BarberSelect.scss";

const safeStr = (value) => String(value ?? "").trim();

// Порог опций для показа поиска (если меньше - поиск скрыт)
const SEARCH_THRESHOLD = 6;

const BarberSelect = ({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  disabled = false,
  hideClear = true,
  hideSearch: hideSearchProp,
  className = "",
}) => {
  const rootRef = useRef(null);

  const opts = Array.isArray(options) ? options : [];

  // Автоматически скрываем поиск если опций мало
  const hideSearch = hideSearchProp ?? opts.length < SEARCH_THRESHOLD;

  const selectedLabel = useMemo(() => {
    const val = safeStr(value);
    const found = opts.find((opt) => safeStr(opt?.value) === val);
    return found?.label ? safeStr(found.label) : "";
  }, [opts, value]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const [dropdownPosition, setDropdownPosition] = useState("bottom");

  // Вычисляем позицию dropdown (Portal)
  const calculatePosition = useCallback(() => {
    if (!rootRef.current) return;

    const rect = rootRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 280;

    const isTop = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setDropdownPosition(isTop ? "top" : "bottom");
    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      ...(isTop
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  // Закрыть при клике вне компонента
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        // Проверяем, не кликнули ли на dropdown в portal
        const dropdown = document.querySelector(".barber-select__dropdown--portal");
        if (dropdown && dropdown.contains(e.target)) return;
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Пересчитать позицию при открытии и при скролле/ресайзе
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      
      // Throttle для скролла - не чаще чем раз в 16мс (60fps)
      let rafId = null;
      const handleScroll = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          calculatePosition();
          rafId = null;
        });
      };
      
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", calculatePosition);
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", calculatePosition);
      };
    }
  }, [isOpen, calculatePosition]);

  // Очистить запрос при закрытии
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  // Отфильтрованные опции
  const filteredOptions = useMemo(() => {
    if (hideSearch) return opts;
    const searchQuery = safeStr(query).toLowerCase();
    if (!searchQuery) return opts;
    return opts.filter((opt) =>
      safeStr(opt?.label).toLowerCase().includes(searchQuery)
    );
  }, [opts, query, hideSearch]);

  // Выбрать опцию
  const selectOption = (val, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (typeof onChange === "function") {
      onChange(val);
    }
    setIsOpen(false);
  };

  // Очистить значение
  const clearValue = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (typeof onChange === "function") {
      onChange("");
    }
    setQuery("");
    setIsOpen(false);
  };

  // Переключить dropdown
  const toggleDropdown = (e) => {
    if (disabled) return;
    e?.preventDefault();
    e?.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  // Обработка клавиш
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      const firstOption = filteredOptions[0];
      if (firstOption?.value != null) {
        e.preventDefault();
        selectOption(String(firstOption.value), e);
      }
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    }
  };

  const hasClearButton = !disabled && !hideClear && safeStr(value);

  // Dropdown через Portal
  const dropdownElement = isOpen && !disabled && (
    <div
      className={`barber-select__dropdown barber-select__dropdown--portal barber-select__dropdown--${dropdownPosition}`}
      style={dropdownStyle}
      role="listbox"
    >
      {/* Поле поиска внутри dropdown если нужно */}
      {!hideSearch && (
        <div className="barber-select__search">
          <FaSearch className="barber-select__search-icon" />
          <input
            type="text"
            className="barber-select__search-input"
            placeholder="Поиск..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {filteredOptions.length === 0 ? (
        <div className="barber-select__empty">Ничего не найдено</div>
      ) : (
        <div className="barber-select__list">
          {filteredOptions.map((opt) => {
            const optValue = safeStr(opt?.value);
            const optLabel = safeStr(opt?.label);
            const isActive = optValue && optValue === safeStr(value);

            return (
              <button
                key={`${optValue}-${optLabel}`}
                type="button"
                className={`barber-select__item ${isActive ? "barber-select__item--active" : ""}`}
                onClick={(e) => selectOption(optValue, e)}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`barber-select ${disabled ? "barber-select--disabled" : ""} ${isOpen ? "barber-select--open" : ""} ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      <div
        className={`barber-select__control ${isOpen ? "barber-select__control--open" : ""}`}
        onClick={toggleDropdown}
      >
        <span className="barber-select__value">
          {selectedLabel || <span className="barber-select__placeholder">{placeholder}</span>}
        </span>

        <div className="barber-select__actions">
          {hasClearButton && (
            <button
              type="button"
              className="barber-select__btn barber-select__btn--clear"
              onClick={clearValue}
              aria-label="Очистить"
            >
              <FaTimes />
            </button>
          )}

          <span className="barber-select__btn barber-select__btn--toggle">
            <FaChevronDown className={`barber-select__chevron ${isOpen ? "barber-select__chevron--up" : ""}`} />
          </span>
        </div>
      </div>

      {/* Portal - рендерим dropdown в body */}
      {dropdownElement && createPortal(dropdownElement, document.body)}
    </div>
  );
};

export default BarberSelect;
