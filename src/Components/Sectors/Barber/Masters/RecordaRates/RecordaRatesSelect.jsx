// RecordaRatesSelect.jsx
import React, { useEffect, useRef, useState } from "react";

export const RRSelect = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current =
    options.find((o) => String(o.value) === String(value)) || null;

  const handleSelect = (val) => {
    onChange?.(val);
    setOpen(false);
  };

  return (
    <div className="rr-select" ref={ref} style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <button
        type="button"
        className={`rr-select__control ${
          open ? "rr-select__control--open" : ""
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="rr-select__value">
          {current ? current.label : placeholder}
        </span>
        <span
          className={`rr-select__arrow ${
            open ? "rr-select__arrow--open" : ""
          }`}
        />
      </button>

      {open && (
        <div className="rr-select__dropdown" style={{ position: "absolute", zIndex: 1001 }}>
          <ul className="rr-select__list">
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`rr-select__option ${
                  String(opt.value) === String(value)
                    ? "rr-select__option--active"
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
