import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import "./SearchableCombobox.scss";

const safeStr = (value) => String(value ?? "").trim();

const SearchableCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Поиск…",
  disabled = false,
  hideClear = false, // Скрыть кнопку очистки
  classNamePrefix = "searchableCombo", // Префикс для BEM классов
  /** Рендер списка в document.body — нужно внутри модалок с overflow:hidden */
  menuPortal = false,
}) => {
  const rootRef = useRef(null);
  const controlRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const opts = Array.isArray(options) ? options : [];

  const selectedLabel = useMemo(() => {
    const val = safeStr(value);
    const found = opts.find((opt) => safeStr(opt?.value) === val);
    return found?.label ? safeStr(found.label) : "";
  }, [opts, value]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [portalBox, setPortalBox] = useState(null);

  // Закрыть при фокусе вне компонента
  useEffect(() => {
    const handleDocumentMouseDown = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (menuPortal && dropdownRef.current?.contains(t)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [menuPortal]);

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

  const updatePortalBox = () => {
    const el = controlRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const maxListHeight = Math.min(280, Math.max(100, spaceBelow));
    setPortalBox({
      top: r.bottom + 8,
      left: r.left,
      width: r.width,
      maxListHeight,
    });
  };

  useLayoutEffect(() => {
    if (!isOpen || !menuPortal || disabled) {
      setPortalBox(null);
      return;
    }
    updatePortalBox();
    const onReposition = () => updatePortalBox();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, menuPortal, disabled, filteredOptions.length]);

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

  const hasClearButton = !disabled && !hideClear && (safeStr(value) || safeStr(query));

  // Генерация классов с префиксом
  const baseClass = classNamePrefix;
  const rootClass = `${baseClass}${disabled ? ` ${baseClass}--disabled` : ""}`;
  const controlClass = `${baseClass}__control${isOpen ? ` ${baseClass}__control--open` : ""}`;
  const chevClass = `${baseClass}__chev${isOpen ? ` ${baseClass}__chev--up` : ""}`;

  const dropdownInner = (
    <>
      {filteredOptions.length === 0 && (
        <div className={`${baseClass}__empty`}>Ничего не найдено</div>
      )}

      {filteredOptions.length > 0 && (
        <div
          className={`${baseClass}__list`}
          style={
            menuPortal && portalBox
              ? { maxHeight: portalBox.maxListHeight }
              : undefined
          }
        >
          {filteredOptions.map((opt) => {
            const optValue = safeStr(opt?.value);
            const optLabel = safeStr(opt?.label);
            const isActive = optValue && optValue === safeStr(value);

            return (
              <button
                key={`${optValue}-${optLabel}`}
                type="button"
                className={`${baseClass}__item${isActive ? ` ${baseClass}__item--active` : ""
                  }`}
                onClick={() => selectOption(optValue)}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  const dropdownNode =
    isOpen && !disabled ? (
      menuPortal && portalBox ? (
        <div
          ref={dropdownRef}
          className={`${baseClass}__dropdown ${baseClass}__dropdown--portal`}
          style={{
            position: "fixed",
            top: portalBox.top,
            left: portalBox.left,
            width: portalBox.width,
            zIndex: 10060,
          }}
          role="listbox"
        >
          {dropdownInner}
        </div>
      ) : !menuPortal ? (
        <div className={`${baseClass}__dropdown`} role="listbox">
          {dropdownInner}
        </div>
      ) : null
    ) : null;

  return (
    <div ref={rootRef} className={rootClass} data-prefix={classNamePrefix}>
      <div ref={controlRef} className={controlClass}>
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

      {menuPortal && dropdownNode
        ? createPortal(dropdownNode, document.body)
        : dropdownNode}
    </div>
  );
};

export default SearchableCombobox;
