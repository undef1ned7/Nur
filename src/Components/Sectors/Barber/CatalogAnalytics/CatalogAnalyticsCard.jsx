// CatalogAnalyticsCard.jsx
import React from "react";
import { Info } from "lucide-react";
import "./CatalogAnalytics.scss";
import { usePaged } from "./CatalogAnalyticsUtils";

const CatalogAnalyticsCard = ({
  icon,
  title,
  columns,
  rows,
  moreTitle,
  onMore,
  pageSize = 12,
}) => {
  const { page, pages, setPage, slice } = usePaged(rows, pageSize);

  return (
    <div className="ca-card">
      <div className="ca-card__head">
        <div className="ca-card__title">
          {icon}
          <span>{title}</span>
        </div>
        <button
          className="ca-card__more"
          aria-label="Подробнее"
          title="Подробнее"
          type="button"
          onClick={() => onMore({ title: moreTitle || title, columns, rows })}
        >
          <Info size={16} />
        </button>
      </div>

      <div className="ca-tableWrap">
        <table className="ca-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="ca-empty">
                  Нет данных
                </td>
              </tr>
            ) : (
              slice.map((r, i) => (
                <tr key={`${title}-${i}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className || ""}>
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ca-card__pager">
        <button
          className="ca-pager__btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label="Назад"
          type="button"
        >
          ←
        </button>
        <span className="ca-pager__info">
          {page} / {pages}
        </span>
        <button
          className="ca-pager__btn"
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages}
          aria-label="Вперёд"
          type="button"
        >
          →
        </button>
      </div>
    </div>
  );
};

export default CatalogAnalyticsCard;
