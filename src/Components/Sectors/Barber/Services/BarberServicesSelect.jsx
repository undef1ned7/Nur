// BarberServicesSelect.jsx
import React, { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaCheck } from "react-icons/fa";
import "./Services.scss";

const BarberServicesSelect = ({ value, onChange, options, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className="barberservices__selectWrap" ref={ref}>
      <button
        type="button"
        className="barberservices__selectBtn"
        aria-label={ariaLabel}
        onClick={() => setOpen((p) => !p)}
      >
        <span className="barberservices__selectText">{current.label}</span>
        <FaChevronDown
          className={`barberservices__selectArrow ${
            open ? "is-open" : ""
          }`}
        />
      </button>

      {open && (
        <div className="barberservices__dropdown" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`barberservices__option ${
                o.value === value ? "is-active" : ""
              }`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <FaCheck className="barberservices__optionCheck" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BarberServicesSelect;
