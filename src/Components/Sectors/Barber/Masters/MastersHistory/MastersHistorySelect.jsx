// MastersHistorySelect.jsx
import React, { useEffect, useRef, useState } from "react";

const MastersHistorySelect = ({
  value,
  onChange,
  options,
  placeholder = "Все",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current =
    options.find((o) => String(o.value) === String(value)) || null;

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div
      className={`mh-select ${disabled ? "mh-select--disabled" : ""}`}
      ref={ref}
    >
      <button
        type="button"
        className={`mh-select__control ${
          open ? "mh-select__control--open" : ""
        }`}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
      >
        <span className="mh-select__value">
          {current ? current.label : placeholder}
        </span>
        <span
          className={`mh-select__arrow ${
            open ? "mh-select__arrow--open" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="mh-select__dropdown">
          <ul className="mh-select__list">
            <li
              className={`mh-select__option ${
                value === "" ? "mh-select__option--active" : ""
              }`}
              onClick={() => handleSelect("")}
            >
              {placeholder}
            </li>
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`mh-select__option ${
                  String(opt.value) === String(value)
                    ? "mh-select__option--active"
                    : ""
                }`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MastersHistorySelect;
