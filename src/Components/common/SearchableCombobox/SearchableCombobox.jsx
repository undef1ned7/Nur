import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import "./SearchableCombobox.scss";

const safeStr = (value) => String(value ?? "").trim();

const SearchableCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Поиск…",
  disabled = false,
  classNamePrefix = "searchableCombo", // Префикс для BEM классов
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const opts = Array.isArray(options) ? options : [];

  const selectedLabel = useMemo(() => {
    const val = safeStr(value);
    const found = opts.find((opt) => safeStr(opt?.value) === val);
    return found?.label ? safeStr(found.label) : "";
  }, [opts, value]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Закрыть при фокусе вне компонента
  useEffect(() => {
    const handleDocumentMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  // Очистить запрос при закрытии
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  // Отфильтрованные опции
  const filteredOptions = useMemo(() => {
    const searchQuery = safeStr(query).toLowerCase();
    if (!searchQuery) return opts;

    return opts.filter((opt) =>
      safeStr(opt?.label).toLowerCase().includes(searchQuery)
    );
  }, [opts, query]);

  // Значение в инпуте
  const displayValue = isOpen ? query : selectedLabel;

  // Выбрать опцию
  const selectOption = (val) => {
    if (typeof onChange === "function") {
      onChange(val);
    }
    setIsOpen(false);
  };

  // Очистить значение
  const clearValue = () => {
    if (typeof onChange === "function") {
      onChange("");
    }
    setQuery("");
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Обработка фокуса
  const handleFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  // Изменение поля ввода
  const handleInputChange = (e) => {
    if (!disabled) {
      setQuery(e.target.value);
      if (!isOpen) {
        setIsOpen(true);
      }
    }
  };

  // Обработка клавиш
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (e.key === "Enter") {
      if (!isOpen) return;
      const firstOption = filteredOptions[0];
      if (firstOption?.value != null) {
        selectOption(String(firstOption.value));
      }
    }
  };

  const hasClearButton = !disabled && (safeStr(value) || safeStr(query));

  // Генерация классов с префиксом
  const baseClass = classNamePrefix;
  const rootClass = `${baseClass}${disabled ? ` ${baseClass}--disabled` : ""}`;
  const controlClass = `${baseClass}__control${isOpen ? ` ${baseClass}__control--open` : ""}`;
  const chevClass = `${baseClass}__chev${isOpen ? ` ${baseClass}__chev--up` : ""}`;

  return (
    <div ref={rootRef} className={rootClass} data-prefix={classNamePrefix}>
      <div className={controlClass}>
        <FaSearch className={`${baseClass}__icon`} aria-hidden="true" />

        <input
          ref={inputRef}
          className={`${baseClass}__input`}
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          type="text"
          autoComplete="off"
          disabled={disabled}
        />

        <div className={`${baseClass}__right`}>
          {hasClearButton && (
            <button
              type="button"
              className={`${baseClass}__btn`}
              onClick={clearValue}
              aria-label="Очистить"
              title="Очистить"
            >
              <FaTimes />
            </button>
          )}

          <button
            type="button"
            className={`${baseClass}__btn`}
            onClick={() => !disabled && setIsOpen((s) => !s)}
            aria-label="Открыть"
            title={isOpen ? "Закрыть" : "Открыть"}
          >
            <FaChevronDown className={chevClass} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className={`${baseClass}__dropdown`} role="listbox">
          {filteredOptions.length === 0 && (
            <div className={`${baseClass}__empty`}>Ничего не найдено</div>
          )}

          {filteredOptions.length > 0 && (
            <div className={`${baseClass}__list`}>
              {filteredOptions.map((opt) => {
                const optValue = safeStr(opt?.value);
                const optLabel = safeStr(opt?.label);
                const isActive = optValue && optValue === safeStr(value);

                return (
                  <button
                    key={`${optValue}-${optLabel}`}
                    type="button"
                    className={`${baseClass}__item${
                      isActive ? ` ${baseClass}__item--active` : ""
                    }`}
                    onClick={() => selectOption(optValue)}
                  >
                    {optLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableCombobox;
