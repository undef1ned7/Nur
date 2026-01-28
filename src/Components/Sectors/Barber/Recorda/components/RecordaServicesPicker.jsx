// RecordaServicesPicker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import "../Recorda.scss";
import { fmtMoney } from "./RecordaUtils";

const RecordaServicesPicker = ({
  items = [],

  // multi
  selectedIds,
  summary,

  // single
  selectedId,

  onChange,

  mode = "multi", // "multi" | "single"

  placeholder = "Поиск...",
  placeholderSelected = "Выберите",

  renderMeta = true,

  // для создания снаружи (кнопка рядом с +)
  allowCreate = false,
  onQueryChange,
  onCreateAvailabilityChange,
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

  const already = useMemo(() => new Set(safeSelected.map(String)), [safeSelected]);

  const selectedOne = useMemo(() => {
    if (!isSingle) return null;
    const id = safeSelected[0];
    if (!id) return null;
    return items.find((x) => String(x.id) === String(id)) || null;
  }, [isSingle, safeSelected, items]);

  const qTrim = useMemo(() => String(q || "").trim(), [q]);

  const hasExactMatch = useMemo(() => {
    if (!qTrim) return false;
    const t = qTrim.toLowerCase();
    return (items || []).some(
      (it) => String(it.label || "").trim().toLowerCase() === t
    );
  }, [items, qTrim]);

  const canCreateNow = useMemo(() => {
    if (!isSingle) return false;
    if (!allowCreate) return false;
    if (!qTrim) return false;
    if (hasExactMatch) return false;
    return true;
  }, [isSingle, allowCreate, qTrim, hasExactMatch]);

  const filtered = useMemo(() => {
    const text = qTrim.toLowerCase();

    const base = (items || []).filter((it) =>
      isSingle ? true : !already.has(String(it.id))
    );

    if (!text) return base;

    return base.filter((it) =>
      String(it.search || it.label || "").toLowerCase().includes(text)
    );
  }, [items, qTrim, already, isSingle]);
  // console.log('312', filtered);
  

  // закрытие по клику вне и по Esc
  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      // Игнорируем клики внутри карточек услуг и кнопок удаления
      if (e.target?.closest?.(".barberrecorda__svcCard")) return;
      if (e.target?.closest?.(".barberrecorda__svcCardDel")) return;
      // Закрываем дропдаун только если клик был вне компонента
      if (!wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
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

  // фокус в поиск при открытии
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => inputRef.current?.focus?.());
  }, [open]);

  // отдаём наружу: текущий запрос + можно ли создавать
  useEffect(() => {
    if (!isSingle) return;
    onQueryChange?.(qTrim);
    onCreateAvailabilityChange?.(canCreateNow);
  }, [isSingle, qTrim, canCreateNow, onQueryChange, onCreateAvailabilityChange]);

  const resetCreateSignals = () => {
    if (!isSingle) return;
    onQueryChange?.("");
    onCreateAvailabilityChange?.(false);
  };

  const handlePickMulti = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const sid = String(id);
    if (!already.has(sid)) onChange?.([...safeSelected, sid]);
    setQ("");
    setOpen(false);
    resetCreateSignals();
  };

  const handleRemoveMulti = (e, serviceId) => {
    // Останавливаем всплытие события
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Получаем текущий список выбранных услуг
    const currentIds = Array.isArray(selectedIds) 
      ? [...selectedIds].map(String) 
      : [];
    
    // Удаляем услугу из списка
    const serviceIdStr = String(serviceId);
    const next = currentIds.filter((id) => String(id) !== serviceIdStr);
    
    // Обновляем состояние через onChange
    if (onChange) {
      onChange(next);
    }
  };

  /* ===========================
     SINGLE
     =========================== */
  if (isSingle) {
    return (
      <div className="barberrecorda__svcField" ref={wrapRef}>
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
              className={`barberrecorda__comboText ${selectedOne ? "" : "is-placeholder"}`}
            >
              {selectedOne?.label || placeholderSelected}
            </span>
            <FaChevronDown className="barberrecorda__comboCaret" />
          </button>
        )}

        {open && (
          <div className="barberrecorda__svcSearchWrap is-open">
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
                    className={`barberrecorda__svcOption ${it.disabled ? "is-disabled" : ""}`}
                    disabled={!!it.disabled}
                    title={it.hint || it.label}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (it.disabled) return;
                      onChange?.(String(it.id));
                      setQ("");
                      setOpen(false);
                      resetCreateSignals();
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
     MULTI
     =========================== */
  return (
    <div className="barberrecorda__svcField" ref={wrapRef}>
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
                        <span className="barberrecorda__svcOptionCat">{it.categoryName}</span>
                      )}
                      {it.minutes ? <span>⏱ {it.minutes} мин</span> : null}
                      {Number.isFinite(it.price) ? <span>💰 {fmtMoney(it.price)}</span> : null}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {safeSelected.length > 0 && (
        <>
          {summary && (
            <div className="barberrecorda__svcSummaryCard">
              <div className="barberrecorda__svcSummaryCol">
                <span className="barberrecorda__svcSummaryValue">{summary.count}</span>
                <span className="barberrecorda__svcSummaryLabel">услуг</span>
                
              </div>
              <div className="barberrecorda__svcSummaryCol">
                <span className="barberrecorda__svcSummaryValue">{summary.totalMinutes}</span>
                <span className="barberrecorda__svcSummaryLabel">мин</span>
              </div>
              <div className="barberrecorda__svcSummaryCol">
                <span className="barberrecorda__svcSummaryValue">{fmtMoney(summary.totalPrice)}</span>
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveMulti(e, id);
                    }}
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
