import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export const PaginatedTable = ({
  head,
  rows,
  pageSize = 10,
  colTemplate,
  numeric = [],
}) => {
  const [page, setPage] = useState(1);
  const total = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.max(1, Math.min(page, total));
  const slice = rows.slice((cur - 1) * pageSize, cur * pageSize);

  useEffect(() => {
    if (page > total) setPage(total);
  }, [page, total]);

  const colSizes = (colTemplate || "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, head.length);
  const getColStyle = (idx) => {
    const s = colSizes[idx];
    if (!s) return undefined;
    if (/^\d+(\.\d+)?(px|%|rem|em|vw)$/.test(s)) return { width: s };
    return undefined;
  };

  return (
    <div className="warehouse-analytics-tableWrap">
      <div className="warehouse-analytics-tableScroll">
        <table className="warehouse-analytics-table">
          <colgroup>
            {head.map((_, i) => (
              <col key={i} style={getColStyle(i)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={numeric.includes(j) ? "is-num" : ""}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!slice.length && (
        <div className="warehouse-analytics-table__empty">Нет данных.</div>
      )}

      {rows.length > pageSize && (
        <div className="warehouse-analytics__pager" aria-label="Пагинация">
          <ul className="warehouse-analytics__pageList">
            {Array.from({ length: total }).map((_, i) => {
              const p = i + 1;
              return (
                <li key={p}>
                  <button
                    type="button"
                    className={`warehouse-analytics__pageBtn ${
                      p === cur ? "is-active" : ""
                    }`}
                    onClick={() => setPage(p)}
                    aria-current={p === cur ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export const KpiCard = ({ label, value, description, icon: Icon }) => (
  <div className="warehouse-analytics__kpi">
    {Icon && (
      <div className="warehouse-analytics__kpiIcon">
        <Icon size={24} strokeWidth={2} />
      </div>
    )}
    <div className="warehouse-analytics__kpiLabel">{label}</div>
    <div className="warehouse-analytics__kpiValue">{value}</div>
    {description && (
      <div className="warehouse-analytics__kpiDesc">{description}</div>
    )}
  </div>
);

export const AccordionItem = ({
  id,
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const btnId = `${id}-button`;

  return (
    <div className={`warehouse-analytics__accItem ${open ? "is-open" : ""}`}>
      <button
        id={btnId}
        type="button"
        className="warehouse-analytics__accBtn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="warehouse-analytics__accLeft">
          {Icon && (
            <span className="warehouse-analytics__accIcon" aria-hidden="true">
              <Icon size={18} />
            </span>
          )}
          <span className="warehouse-analytics__accTitle">{title}</span>
        </span>

        <span className="warehouse-analytics__accRight">
          {badge != null && badge !== "" && (
            <span className="warehouse-analytics__accBadge">{badge}</span>
          )}
          <ChevronDown
            size={18}
            className="warehouse-analytics__accChevron"
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        className="warehouse-analytics__accBody"
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
};

export const AnalyticsPeriodControls = ({
  period,
  onPeriodChange,
  date,
  onDateChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}) => (
  <>
    <div
      className="warehouse-analytics__seg"
      role="tablist"
      aria-label="Период"
    >
      {[
        { value: "day", label: "День" },
        { value: "week", label: "Неделя" },
        { value: "month", label: "Месяц" },
        { value: "custom", label: "Период" },
      ].map((p) => (
        <button
          key={p.value}
          type="button"
          role="tab"
          aria-selected={period === p.value}
          className={`warehouse-analytics__segBtn ${period === p.value ? "is-active" : ""}`}
          onClick={() => onPeriodChange(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
    {period === "custom" && (
      <div className="warehouse-analytics__range">
        <label>
          С
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="warehouse-analytics__input"
          />
        </label>
        <label>
          По
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="warehouse-analytics__input"
          />
        </label>
      </div>
    )}
    {period !== "custom" && date != null && onDateChange && (
      <div className="warehouse-analytics__range">
        <label>
          Дата
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="warehouse-analytics__input"
          />
        </label>
      </div>
    )}
  </>
);
