// RecordaServicesPicker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import "./Recorda.scss";
import { fmtMoney } from "./RecordaUtils";

const RecordaServicesPicker = ({ items, selectedIds, onChange, summary }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  const already = useMemo(
    () => new Set(selectedIds.map(String)),
    [selectedIds]
  );

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return items;
    return items.filter((it) =>
      (it.search || it.label || "").toLowerCase().includes(text)
    );
  }, [items, q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onPick = (id) => {
    const sid = String(id);
    if (!already.has(sid)) {
      onChange([...selectedIds, sid]);
    }
    setQ("");
    setOpen(false);
  };

  const remove = (sid) =>
    onChange(selectedIds.filter((id) => String(id) !== String(sid)));

  return (
    <div className="barberrecorda__svcField">
      {/* Поиск услуг с дропдауном */}
      <div
        className={`barberrecorda__svcSearchWrap ${open ? "is-open" : ""}`}
        ref={wrapRef}
      >
        <div
          className="barberrecorda__svcSearch"
          onClick={() => setOpen(true)}
        >
          <FaSearch className="barberrecorda__svcSearchIcon" />
          <input
            type="text"
            className="barberrecorda__svcSearchInput"
            placeholder="Поиск услуг..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!open) setOpen(true);
            }}
          />
        </div>

        {open && (
          <div className="barberrecorda__svcDropdown">
            {filtered.length === 0 ? (
              <div className="barberrecorda__svcEmpty">
                Ничего не найдено
              </div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="barberrecorda__svcOption"
                  onClick={() => onPick(it.id)}
                >
                  <div className="barberrecorda__svcOptionTitle">
                    {it.label}
                  </div>
                  <div className="barberrecorda__svcOptionMeta">
                    {it.categoryName && (
                      <span className="barberrecorda__svcOptionCat">
                        {it.categoryName}
                      </span>
                    )}
                    {it.minutes ? (
                      <span>⏱ {it.minutes} мин</span>
                    ) : null}
                    {Number.isFinite(it.price) ? (
                      <span>💰 {fmtMoney(it.price)}</span>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Резюме + выбранные услуги */}
      {selectedIds.length > 0 && (
        <>
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

          <div className="barberrecorda__svcCards">
            {selectedIds.map((id, idx) => {
              const it = items.find((x) => String(x.id) === String(id));
              if (!it) return null;
              const name = it.label || "Услуга";
              const mm = it.minutes || 0;
              const price = it.price;

              return (
                <div
                  key={id}
                  className="barberrecorda__svcCard"
                  title={name}
                >
                  <div className="barberrecorda__svcCardIndex">
                    {idx + 1}
                  </div>
                  <div className="barberrecorda__svcCardMain">
                    <div className="barberrecorda__svcCardTitle">
                      {name}
                    </div>
                    <div className="barberrecorda__svcCardMeta">
                      {mm ? `${mm}м` : "—"}{" "}
                      {Number.isFinite(price)
                        ? `· ${fmtMoney(price)}`
                        : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="barberrecorda__svcCardDel"
                    aria-label="Убрать услугу"
                    onClick={() => remove(id)}
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
