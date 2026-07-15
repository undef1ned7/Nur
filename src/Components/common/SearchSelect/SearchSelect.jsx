import { useEffect, useMemo, useRef, useState } from "react";
import "./SearchSelect.scss";

/**
 * Селект с поиском (общий компонент).
 *
 * Оптимизирован под длинные списки: в выпадашке рендерятся только первые
 * `maxVisible` совпадений (остальное отсекается подсказкой «уточните поиск»),
 * поэтому открытие не подвисает даже на сотнях позиций. Адаптивен —
 * растягивается на ширину контейнера, меню скроллится.
 *
 * @param {string|number} value — значение выбранной опции
 * @param {(value) => void} onChange
 * @param {Array<{value, label, searchText?}>} options
 */
const SearchSelect = ({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  disabled = false,
  emptyText = "Ничего не найдено",
  maxVisible = 150,
  className = "",
}) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const v = value == null ? "" : String(value);
    if (!v) return null;
    return (Array.isArray(options) ? options : []).find(
      (o) => String(o.value) === v,
    );
  }, [options, value]);

  const filtered = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) =>
      String(o.searchText || o.label || "")
        .toLowerCase()
        .includes(q),
    );
  }, [options, query]);

  const visible = useMemo(
    () => (filtered.length > maxVisible ? filtered.slice(0, maxVisible) : filtered),
    [filtered, maxVisible],
  );
  const hiddenCount = filtered.length - visible.length;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        close();
        inputRef.current?.blur?.();
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`cmn-searchselect${className ? ` ${className}` : ""}`}
      ref={containerRef}
    >
      <input
        ref={inputRef}
        className="cmn-searchselect__input"
        type="text"
        disabled={disabled}
        value={open ? query : selected?.label || ""}
        placeholder={selected?.label || placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          if (!open) setOpen(true);
          setQuery(e.target.value);
        }}
      />
      <span className="cmn-searchselect__arrow" aria-hidden>
        ▾
      </span>

      {open && !disabled && (
        <div className="cmn-searchselect__menu">
          {visible.length === 0 ? (
            <div className="cmn-searchselect__empty">{emptyText}</div>
          ) : (
            <>
              {visible.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  className={`cmn-searchselect__item${
                    String(o.value) === String(value ?? "")
                      ? " cmn-searchselect__item--active"
                      : ""
                  }`}
                  onClick={() => {
                    onChange?.(o.value);
                    close();
                    inputRef.current?.blur?.();
                  }}
                >
                  {o.label}
                </button>
              ))}
              {hiddenCount > 0 && (
                <div className="cmn-searchselect__more">
                  Ещё {hiddenCount} — уточните поиск
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchSelect;
