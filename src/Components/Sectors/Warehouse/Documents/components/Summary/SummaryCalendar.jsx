import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./Summary.scss";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/**
 * Месячный календарь с выбором дня и индикатором количества сводок.
 * @param month "YYYY-MM"
 * @param countsByDate { "YYYY-MM-DD": number }
 */
const SummaryCalendar = ({
  month,
  selectedDate,
  countsByDate = {},
  onSelectDate,
  onMonthChange,
}) => {
  const [yearStr, monthStr] = (month || "").split("-");
  const year = Number(yearStr);
  const mIdx = Number(monthStr) - 1;

  const cells = useMemo(() => {
    if (!year || Number.isNaN(mIdx)) return [];
    const first = new Date(year, mIdx, 1);
    const startOffset = (first.getDay() + 6) % 7; // понедельник = 0
    const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startOffset; i += 1) arr.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) arr.push(d);
    return arr;
  }, [year, mIdx]);

  const shiftMonth = (delta) => {
    const dt = new Date(year, mIdx + delta, 1);
    onMonthChange?.(`${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`);
  };

  const todayStr = useMemo(() => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  return (
    <div className="summary-cal">
      <div className="summary-cal__head">
        <button className="summary-cal__nav" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
          <ChevronLeft size={18} />
        </button>
        <div className="summary-cal__title">
          {MONTHS[mIdx] || ""} {year || ""}
        </div>
        <button className="summary-cal__nav" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="summary-cal__weekdays">
        {WD.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="summary-cal__grid">
        {cells.map((d, i) => {
          if (d == null) return <span key={`e${i}`} className="summary-cal__cell is-empty" />;
          const dateStr = ymd(year, mIdx, d);
          const count = countsByDate[dateStr] || 0;
          const isSel = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          return (
            <button
              key={dateStr}
              className={`summary-cal__cell ${isSel ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
              onClick={() => onSelectDate?.(dateStr)}
            >
              <span className="summary-cal__day">{d}</span>
              {count > 0 && <span className="summary-cal__badge">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SummaryCalendar;
