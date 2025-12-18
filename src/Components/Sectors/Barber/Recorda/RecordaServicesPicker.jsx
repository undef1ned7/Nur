// RecordaServicesPicker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import "./Recorda.scss";
import { fmtMoney } from "./RecordaUtils";

const RecordaServicesPicker = ({
  items = [],

  // multi (услуги)
  selectedIds,
  summary,

  // single (клиент/сотрудник)
  selectedId,

  onChange,

  mode = "multi", // "multi" | "single"

  // тексты
  placeholder = "Поиск...",
  placeholderSelected = "Выберите",

  // показывать мету (⏱💰) в списке
  renderMeta = true,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const isSingle = mode === "single";

  const safeSelected = useMemo(() => {
    if (isSingle) return selectedId ? [String(selectedId)] : [];
    return Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  }, [isSingle, selectedIds, selectedId]);

  const already = useMemo(
    () => new Set(safeSelected.map(String)),
    [safeSelected]
  );

  const selectedOne = useMemo(() => {
    if (!isSingle) return null;
    const id = safeSelected[0];
    if (!id) return null;
    return items.find((x) => String(x.id) === String(id)) || null;
  }, [isSingle, safeSelected, items]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();

    // single: показываем всех (можно пере-выбрать)
    // multi: скрываем уже выбранные
    const base = (items || []).filter((it) =>
      isSingle ? true : !already.has(String(it.id))
    );

    if (!text) return base;

    return base.filter((it) =>
      String(it.search || it.label || "").toLowerCase().includes(text)
    );
  }, [items, q, already, isSingle]);

  // закрытие по клику вне и по Esc
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

  // фокус в поиск при открытии (и single, и multi)
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => inputRef.current?.focus?.());
  }, [open]);

  const handlePickMulti = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const sid = String(id);
    if (!already.has(sid)) {
      onChange?.([...safeSelected, sid]);
    }
    setQ("");
    setOpen(false);
  };

  const handleRemoveMulti = (e, sid) => {
    e.preventDefault();
    e.stopPropagation();
    const next = safeSelected.filter((x) => String(x) !== String(sid));
    onChange?.(next);
    setOpen(false);
  };

  const handlePickSingle = (e, id, disabled) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onChange?.(String(id));
    setQ("");
    setOpen(false);
  };

  const clearSingle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("");
    setQ("");
    setOpen(false);
  };

  /* ===========================
     SINGLE: как select (как на фото)
     =========================== */
if (isSingle) {
  return (
    <div className="barberrecorda__svcField" ref={wrapRef}>
      {/* CLOSED: выглядит как select (показывает выбранное) */}
      {!open && (
        <button
          type="button"
          className="barberrecorda__comboTrigger"
          onClick={() => setOpen(true)}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={selectedOne?.label || placeholderSelected}
        >
          <span
            className={`barberrecorda__comboText ${
              selectedOne ? "" : "is-placeholder"
            }`}
          >
            {selectedOne?.label || placeholderSelected}
          </span>
          <FaChevronDown className="barberrecorda__comboCaret" />
        </button>
      )}

      {/* OPENED: как УСЛУГИ (поиск + список), без “Выберите …” */}
      {open && (
        <div className={`barberrecorda__svcSearchWrap is-open`}>
          <div className="barberrecorda__svcSearch">
            <FaSearch className="barberrecorda__svcSearchIcon" />
            <input
              ref={inputRef}
              type="text"
              className="barberrecorda__svcSearchInput"
              placeholder={placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div
            className="barberrecorda__svcDropdown"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {filtered.length === 0 ? (
              <div className="barberrecorda__svcEmpty">Ничего не найдено</div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`barberrecorda__svcOption ${
                    it.disabled ? "is-disabled" : ""
                  }`}
                  disabled={!!it.disabled}
                  title={it.hint || it.label}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (it.disabled) return;
                    onChange?.(String(it.id));
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <div className="barberrecorda__svcOptionTitle">{it.label}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


  /* ===========================
     MULTI: услуги (как было)
     =========================== */
  return (
    <div className="barberrecorda__svcField" ref={wrapRef}>
      {/* Поиск услуг с дропдауном */}
      <div className={`barberrecorda__svcSearchWrap ${open ? "is-open" : ""}`}>
        <div className="barberrecorda__svcSearch" onClick={() => setOpen(true)}>
          <FaSearch className="barberrecorda__svcSearchIcon" />
          <input
            ref={inputRef}
            type="text"
            className="barberrecorda__svcSearchInput"
            placeholder={placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!open) setOpen(true);
            }}
          />
        </div>

        {open && (
          <div
            className="barberrecorda__svcDropdown"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {filtered.length === 0 ? (
              <div className="barberrecorda__svcEmpty">Ничего не найдено</div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="barberrecorda__svcOption"
                  onClick={(e) => handlePickMulti(e, it.id)}
                >
                  <div className="barberrecorda__svcOptionTitle">{it.label}</div>

                  {renderMeta && (
                    <div className="barberrecorda__svcOptionMeta">
                      {it.categoryName && (
                        <span className="barberrecorda__svcOptionCat">
                          {it.categoryName}
                        </span>
                      )}
                      {it.minutes ? <span>⏱ {it.minutes} мин</span> : null}
                      {Number.isFinite(it.price) ? (
                        <span>💰 {fmtMoney(it.price)}</span>
                      ) : null}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Резюме + выбранные услуги */}
      {safeSelected.length > 0 && (
        <>
          {summary && (
            <div className="barberrecorda__svcSummaryCard">
              <div className="barberrecorda__svcSummaryCol">
                <div className="barberrecorda__svcSummaryLabel">Услуг</div>
                <div className="barberrecorda__svcSummaryValue">
                  {summary.count}
                </div>
              </div>
              <div className="barberrecorda__svcSummaryCol">
                <div className="barberrecorda__svcSummaryLabel">Время</div>
                <div className="barberrecorda__svcSummaryValue">
                  {summary.totalMinutes}м
                </div>
              </div>
              <div className="barberrecorda__svcSummaryCol">
                <div className="barberrecorda__svcSummaryLabel">Сумма</div>
                <div className="barberrecorda__svcSummaryValue">
                  {fmtMoney(summary.totalPrice)}
                </div>
              </div>
            </div>
          )}

          <div className="barberrecorda__svcCards">
            {safeSelected.map((id, idx) => {
              const it = items.find((x) => String(x.id) === String(id));
              if (!it) return null;

              const name = it.label || "Услуга";
              const mm = it.minutes || 0;
              const price = it.price;

              return (
                <div key={id} className="barberrecorda__svcCard" title={name}>
                  <div className="barberrecorda__svcCardIndex">{idx + 1}</div>
                  <div className="barberrecorda__svcCardMain">
                    <div className="barberrecorda__svcCardTitle">{name}</div>
                    <div className="barberrecorda__svcCardMeta">
                      {mm ? `${mm}м` : "—"}{" "}
                      {Number.isFinite(price) ? `· ${fmtMoney(price)}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="barberrecorda__svcCardDel"
                    aria-label="Убрать услугу"
                    onClick={(e) => handleRemoveMulti(e, id)}
                  >
                    <FaTimes />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default RecordaServicesPicker;
