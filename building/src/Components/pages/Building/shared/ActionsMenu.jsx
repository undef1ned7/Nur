import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function BuildingActionsMenu({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const positionRef = useRef({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleToggle = (e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      positionRef.current = { top: rect.bottom + 4, left: rect.right };
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!Array.isArray(actions) || actions.length === 0) return null;

  const pos = positionRef.current;
  const dropdownEl = open && (
    <div
      ref={dropdownRef}
      className="building-actionsMenu__dropdown building-actionsMenu__dropdown--portal"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-100%, 0)",
      }}
    >
      {actions.map((action) => {
        if (!action) return null;
        const { label, onClick, danger, disabled } = action;
        return (
          <button
            key={label}
            type="button"
            className={`building-actionsMenu__item${
              danger ? " building-actionsMenu__item--danger" : ""
            }`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setOpen(false);
              onClick?.();
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="building-actionsMenu">
      <button
        ref={triggerRef}
        type="button"
        className="building-btn building-actionsMenu__trigger"
        onClick={handleToggle}
      >
        ⋮
      </button>
      {typeof document !== "undefined" && dropdownEl
        ? createPortal(dropdownEl, document.body)
        : null}
    </div>
  );
}

