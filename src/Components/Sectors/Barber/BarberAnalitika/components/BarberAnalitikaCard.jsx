// BarberAnalitikaCard.jsx
import React from "react";
import { FiInfo } from "react-icons/fi";
import { usePaged } from "../BarberAnalitikaUtils";

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
    <div className="barber-analitika-card">
      <div className="barber-analitika-card__head">
        <div className="barber-analitika-card__title">
          {icon}
          <span>{title}</span>
        </div>
        <button
          className="barber-analitika-card__more"
          aria-label="Подробнее"
          title="Подробнее"
          type="button"
          onClick={() =>
            onOpenModal({ title: moreTitle || title, columns, rows })
          }
        >
          <FiInfo size={16} />
        </button>
      </div>

      <div className="barber-analitika-table-wrap">
        <table className="barber-analitika-table">
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
                <td colSpan={columns.length} className="barber-analitika-table__empty">
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

      <div className="barber-analitika-card__pager">
        <button
          className="barber-analitika-pager__btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label="Назад"
          type="button"
        >
          ←
        </button>
        <span className="barber-analitika-pager__info">
          {page} / {pages}
        </span>
        <button
          className="barber-analitika-pager__btn"
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
