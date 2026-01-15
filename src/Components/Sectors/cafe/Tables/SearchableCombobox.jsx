import React, { useMemo, useState } from "react";
import { FaCheck, FaChevronDown, FaChevronUp, FaSearch } from "react-icons/fa";

const asKey = (v) => (v === null || v === undefined ? "" : String(v));

const SearchableCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  disabled = false,
  ariaLabel = "Выбор",
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = useMemo(
    () => options.find((o) => asKey(o.value) === asKey(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => String(o.label || "").toLowerCase().includes(s));
  }, [options, q]);

  const choose = (v) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && !open) setOpen(true);
  };

  return (
    <div className={`tables__combo ${disabled ? "tables__combo--disabled" : ""}`}>
      <button
        type="button"
        className="tables__comboBtn"
        onClick={() => !disabled && setOpen((x) => !x)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`tables__comboValue ${selected ? "" : "tables__comboValue--muted"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="tables__comboIcon" aria-hidden>
          {open ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </button>

      {open && (
        <div className="tables__comboDrop" role="listbox">
          <div className="tables__comboSearch">
            <FaSearch className="tables__comboSearchIcon" />
            <input
              className="tables__comboSearchInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск…"
              autoFocus
            />
          </div>

          <div className="tables__comboList">
            {filtered.map((o) => {
              const isSel = asKey(o.value) === asKey(value);
              return (
                <button
                  key={asKey(o.value)}
                  type="button"
                  className={`tables__comboItem ${isSel ? "tables__comboItem--active" : ""}`}
                  onClick={() => choose(o.value)}
                >
                  <span className="tables__comboItemLabel">{o.label}</span>
                  {isSel && (
                    <span className="tables__comboItemCheck" aria-hidden>
                      <FaCheck />
                    </span>
                  )}
                </button>
              );
            })}

            {!filtered.length && <div className="tables__comboEmpty">Ничего не найдено</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableCombobox;
