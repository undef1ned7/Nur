// src/Components/Sectors/cafe/Menu/components/SearchableCombobox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";

const safeStr = (v) => String(v ?? "").trim();

const SearchableCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Поиск…",
  disabled = false,
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const opts = Array.isArray(options) ? options : [];

  const selectedLabel = useMemo(() => {
    const v = safeStr(value);
    const found = opts.find((o) => safeStr(o?.value) === v);
    return found?.label ? safeStr(found.label) : "";
  }, [opts, value]);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const onDocDown = (e) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const filtered = useMemo(() => {
    const query = safeStr(q).toLowerCase();
    if (!query) return opts;
    return opts.filter((o) => safeStr(o?.label).toLowerCase().includes(query));
  }, [opts, q]);

  const showValueInInput = open ? q : (selectedLabel || "");

  const setSelected = (val) => {
    if (typeof onChange === "function") onChange(val);
    setOpen(false);
  };

  const clear = () => {
    if (typeof onChange === "function") onChange("");
    setQ("");
    setOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  const onFocus = () => {
    if (disabled) return;
    setOpen(true);
  };

  const onInputChange = (e) => {
    if (disabled) return;
    setQ(e.target.value);
    if (!open) setOpen(true);
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (e.key === "Enter") {
      if (!open) return;
      const first = filtered[0];
      if (first?.value != null) setSelected(String(first.value));
    }
  };

  const hasClear = !disabled && (safeStr(value) || safeStr(q));

  return (
    <div ref={rootRef} className={`menu-combo ${disabled ? "menu-combo--disabled" : ""}`}>
      <div className={`menu-combo__control ${open ? "menu-combo__control--open" : ""}`}>
        <FaSearch className="menu-combo__icon" aria-hidden />

        <input
          ref={inputRef}
          className="menu-combo__input"
          value={showValueInInput}
          onFocus={onFocus}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          type="text"
          autoComplete="off"
          disabled={disabled}
        />

        <div className="menu-combo__right">
          {hasClear && (
            <button type="button" className="menu-combo__btn" onClick={clear} aria-label="Очистить">
              <FaTimes />
            </button>
          )}

          <button
            type="button"
            className="menu-combo__btn"
            onClick={() => !disabled && setOpen((s) => !s)}
            aria-label="Открыть"
          >
            <FaChevronDown className={`menu-combo__chev ${open ? "menu-combo__chev--up" : ""}`} />
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="menu-combo__dropdown" role="listbox">
          {filtered.length === 0 && <div className="menu-combo__empty">Ничего не найдено</div>}

          {filtered.length > 0 && (
            <div className="menu-combo__list">
              {filtered.map((o) => {
                const v = safeStr(o?.value);
                const label = safeStr(o?.label);
                const active = v && v === safeStr(value);

                return (
                  <button
                    key={v || label}
                    type="button"
                    className={`menu-combo__item ${active ? "menu-combo__item--active" : ""}`}
                    onClick={() => setSelected(v)}
                  >
                    {label}
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
