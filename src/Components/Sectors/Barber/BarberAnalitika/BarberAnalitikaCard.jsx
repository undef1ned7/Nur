// BarberAnalitikaCard.jsx
import React from "react";
import { Info } from "lucide-react";
import { usePaged } from "./BarberAnalitikaUtils";

const BarberAnalitikaCard = ({
  icon,
  title,
  columns,
  rows,
  moreTitle,
  onOpenModal,
  pageSize = 12,
}) => {
  const { page, pages, setPage, slice } = usePaged(rows, pageSize);

  return (
    <div className="ba-card">
      <div className="ba-card__head">
        <div className="ba-card__title">
          {icon}
          <span>{title}</span>
        </div>
        <button
          className="ba-card__more"
          aria-label="Подробнее"
          title="Подробнее"
          type="button"
          onClick={() =>
            onOpenModal({ title: moreTitle || title, columns, rows })
          }
        >
          <Info size={16} />
        </button>
      </div>

      <div className="ba-tableWrap">
        <table className="ba-table">
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
                <td colSpan={columns.length} className="ba-empty">
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

      <div className="ba-card__pager">
        <button
          className="ba-pager__btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label="Назад"
          type="button"
        >
          ←
        </button>
        <span className="ba-pager__info">
          {page} / {pages}
        </span>
        <button
          className="ba-pager__btn"
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

export default BarberAnalitikaCard;
