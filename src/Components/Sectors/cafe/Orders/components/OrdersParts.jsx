// src/.../OrdersParts.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaClipboardList, FaPlus, FaSearch, FaTimes } from "react-icons/fa";

/* =========================================================
   SearchSelect — один открытый и закрывается после выбора
   ========================================================= */
export const SearchSelect = ({
  id,
  openId,
  setOpenId,
  label,
  placeholder = "Выберите…",
  value,
  onChange,
  options = [],
  disabled = false,
  hint,
  allowClear = true,
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const open = openId === id;

  const [q, setQ] = useState("");
  const [dir, setDir] = useState("down"); // down | up

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;

    return options.filter((o) => {
      const hay = String(o.search ?? o.label ?? "").toLowerCase();
      return hay.includes(s);
    });
  }, [options, q]);

  const closeDropdown = useCallback(() => {
    setOpenId(null);
    setQ("");
  }, [setOpenId]);

  const computeDir = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight || 0;

    const estimated = Math.min(320, 56 + (options?.length || 0) * 44);
    const spaceBelow = viewportH - r.bottom;
    const spaceAbove = r.top;

    if (spaceBelow < estimated && spaceAbove > spaceBelow) setDir("up");
    else setDir("down");
  }, [options]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) closeDropdown();
    };

    const onKey = (e) => {
      if (e.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", computeDir, { passive: true });
    window.addEventListener("scroll", computeDir, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", computeDir);
      window.removeEventListener("scroll", computeDir);
    };
  }, [open, computeDir, closeDropdown]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    computeDir();
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(t);
  }, [open, computeDir]);

  const openDropdown = () => {
    if (disabled) return;
    setOpenId(id);
    setQ("");
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setOpenId((prev) => (prev === id ? null : id));
    setQ("");
  };

  const pick = (opt) => {
    onChange?.(opt.value);
    closeDropdown();
  };

  const clear = () => {
    onChange?.("");
    closeDropdown();
  };

  const shownValue = open ? q : selected?.label || "";

  return (
    <div ref={rootRef} className={`cafeOrdersSselect ${open ? "cafeOrdersSselect--open" : ""}`}>
      {label ? <div className="cafeOrdersSselect__label">{label}</div> : null}

      <div
        className={`cafeOrdersSselect__control ${open ? "cafeOrdersSselect__control--open" : ""} ${
          disabled ? "cafeOrdersSselect__control--disabled" : ""
        }`}
        onMouseDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          if (open && e.target === inputRef.current) return;
          toggleDropdown();
        }}
        role="combobox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          className="cafeOrdersSselect__input"
          value={shownValue}
          onChange={(e) => {
            if (!open) setOpenId(id);
            setQ(e.target.value);
          }}
          onFocus={() => openDropdown()}
          placeholder={placeholder}
          readOnly={!open}
          disabled={disabled}
        />

        {allowClear && !disabled && value ? (
          <button
            type="button"
            className="cafeOrdersSselect__clear"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }}
            aria-label="Очистить"
            title="Очистить"
          >
            <FaTimes />
          </button>
        ) : null}

        <span className="cafeOrdersSselect__icon" aria-hidden>
          <FaChevronDown />
        </span>

        {open && (
          <div
            className={`cafeOrdersSselect__dropdown ${dir === "up" ? "cafeOrdersSselect__dropdown--up" : ""}`}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cafeOrdersSselect__list">
              {filtered.length ? (
                filtered.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      className={`cafeOrdersSselect__item ${active ? "cafeOrdersSselect__item--active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pick(opt);
                      }}
                      title={opt.label}
                    >
                      <span className="cafeOrdersSselect__itemLabel">{opt.label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="cafeOrdersSselect__empty">Ничего не найдено</div>
              )}
            </div>
          </div>
        )}
      </div>

      {hint ? <div className="cafeOrdersSselect__hint">{hint}</div> : null}
    </div>
  );
};

/* =========================================================
   Правая панель меню
   ========================================================= */
export const RightMenuPanel = ({ open, onClose, menuItems, menuImageUrl, onPick, fmtMoney, currentItems = [] }) => {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return menuItems || [];
    return (menuItems || []).filter((m) => String(m?.title || "").toLowerCase().includes(s));
  }, [menuItems, q]);

  // Создаем карту количества добавленных блюд
  const itemsCountMap = useMemo(() => {
    const map = new Map();
    currentItems.forEach((item) => {
      const key = String(item.menu_item);
      const currentQty = Number(item.quantity) || 0;
      map.set(key, (map.get(key) || 0) + currentQty);
    });
    return map;
  }, [currentItems]);

  if (!open) return null;

  return (
    <aside className="cafeOrdersRpanel" aria-label="Меню">
      <div className="cafeOrdersRpanel__head">
        <div className="cafeOrdersRpanel__title">
          Меню
          {currentItems.length > 0 && (
            <span className="cafeOrdersRpanel__titleBadge">{currentItems.length}</span>
          )}
        </div>
        <button type="button" className="cafeOrdersRpanel__close" onClick={onClose} aria-label="Закрыть">
          <FaTimes />
        </button>
      </div>

      <div className="cafeOrdersRpanel__search">
        <FaSearch className="cafeOrdersRpanel__searchIcon" />
        <input
          className="cafeOrdersRpanel__searchInput"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск блюд…"
        />
      </div>

      <div className="cafeOrdersRpanel__list">
        {filtered.length ? (
          filtered.map((m) => {
            const img = menuImageUrl?.(m.id);
            const itemQty = itemsCountMap.get(String(m.id)) || 0;
            const isAdded = itemQty > 0;

            return (
              <button
                key={m.id}
                type="button"
                className={`cafeOrdersRpanel__item ${isAdded ? "cafeOrdersRpanel__item--added" : ""}`}
                onClick={() => onPick(m)}
                title={m.title}
              >
                <span className="cafeOrdersRpanel__thumb" aria-hidden>
                  {img ? <img src={img} alt="" /> : <FaClipboardList />}
                </span>

                <span className="cafeOrdersRpanel__meta">
                  <span className="cafeOrdersRpanel__name">{m.title}</span>
                  <span className="cafeOrdersRpanel__price">{fmtMoney?.(m.price)} сом</span>
                </span>

                <span className="cafeOrdersRpanel__add" aria-hidden>
                  {isAdded ? (
                    <span className="cafeOrdersRpanel__qtyBadge">{itemQty}</span>
                  ) : (
                    <FaPlus />
                  )}
                </span>
              </button>
            );
          })
        ) : (
          <div className="cafeOrdersRpanel__empty">Ничего не найдено</div>
        )}
      </div>

      <div className="cafeOrdersRpanel__footer">
        <button type="button" className="cafeOrders__btn cafeOrders__btn--primary cafeOrders__btn--wide" onClick={onClose}>
          Готов
        </button>
      </div>
    </aside>
  );
};
