// PayrollDailyComboBox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";

const PayrollDailyComboBox = ({
  items,
  value,
  onChange,
  placeholder = "Выберите",
  popupMaxHeight = 280,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = items.find((i) => String(i.id) === String(value));

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return items;
    return items.filter((i) =>
      (i.search || i.label || "").toLowerCase().includes(text)
    );
  }, [items, q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    }
  }, [open]);

  return (
    <div className={`pd-combo ${open ? "pd-combo--open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="pd-combo__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label || placeholder}
      >
        <span
          className={`pd-combo__text ${
            selected ? "" : "pd-combo__text--ph"
          }`}
        >
          {selected?.label || placeholder}
        </span>
        <FaChevronDown className="pd-combo__caret" />
      </button>

      {open && (
        <div
          className="pd-combo__popup"
          role="listbox"
          style={{ maxHeight: popupMaxHeight }}
        >
          <div className="pd-combo__search">
            <FaSearch className="pd-combo__searchIcon" />
            <input
              ref={inputRef}
              className="pd-combo__searchInput"
              placeholder="Поиск..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="pd-combo__list">
            {filtered.length === 0 ? (
              <div className="pd-combo__empty">Ничего не найдено</div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="pd-combo__option"
                  onClick={() => {
                    onChange?.(it.id, it);
                    setOpen(false);
                    setQ("");
                  }}
                  title={it.label}
                >
                  {it.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollDailyComboBox;
