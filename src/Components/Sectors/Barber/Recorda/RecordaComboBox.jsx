// RecordaComboBox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import "./Recorda.scss";

const RecordaComboBox = ({
  items,
  value,
  onChange,
  placeholder = "Выберите",
  triggerClass = "",
  listMaxHeight = 260,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return items;
    return items.filter((i) =>
      (i.search || i.label).toLowerCase().includes(text)
    );
  }, [items, q]);

  // закрываем по клику вне и по Esc
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

  // когда дропдаун открыт — фокус в поиск
  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus?.();
      });
    }
  }, [open]);

  // если value поменялся снаружи (выбор или сброс) — гарантированно закрываем
  useEffect(() => {
    setOpen(false);
    setQ("");
  }, [value]);

  const selected = items.find((i) => String(i.id) === String(value));

  return (
    <div
      className={`barberrecorda__combo ${open ? "is-open" : ""}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className={`barberrecorda__comboTrigger ${triggerClass}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label || placeholder}
      >
        <span
          className={`barberrecorda__comboText ${
            selected ? "" : "is-placeholder"
          }`}
        >
          {selected?.label || placeholder}
        </span>
        <FaChevronDown className="barberrecorda__comboCaret" />
      </button>

      {open && (
        <div
          className="barberrecorda__comboPopup"
          role="listbox"
          style={{ maxHeight: listMaxHeight }}
        >
          <div className="barberrecorda__comboSearch">
            <FaSearch className="barberrecorda__comboSearchIcon" />
            <input
              ref={inputRef}
              className="barberrecorda__comboSearchInput"
              placeholder={`Поиск ${placeholder.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="barberrecorda__comboList">
            {filtered.length === 0 ? (
              <div className="barberrecorda__comboEmpty">
                Ничего не найдено
              </div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`barberrecorda__comboOption ${
                    it.disabled ? "is-disabled" : ""
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!it.disabled) {
                      onChange?.(it.id, it);
                      setOpen(false); // ← жёстко закрываем
                      setQ("");
                    }
                  }}
                  disabled={it.disabled}
                  title={it.hint || it.label}
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

export default RecordaComboBox;
