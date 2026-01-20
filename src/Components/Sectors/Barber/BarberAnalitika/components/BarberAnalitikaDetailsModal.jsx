// BarberAnalitikaDetailsModal.jsx
import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";
import { usePaged } from "../BarberAnalitikaUtils";

const BarberAnalitikaDetailsModal = ({
  title,
  columns,
  rows,
  getKey,
  onClose,
  pageSize = 12,
}) => {
  const { page, pages, setPage, slice } = usePaged(rows, pageSize);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="barber-analitika-modal" role="dialog" aria-modal="true">
      <div className="barber-analitika-modal__overlay" onClick={onClose} />
      <div className="barber-analitika-modal__card" aria-label={title}>
        <div className="barber-analitika-modal__head">
          <h3 className="barber-analitika-modal__title">{title}</h3>
          <button
            className="barber-analitika-modal__icon"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="barber-analitika-modal__body">
          <div className="barber-analitika-table-wrap barber-analitika-table-wrap--modal">
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
                    <tr key={getKey(r, i)}>
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
        </div>

        <div className="barber-analitika-modal__footer">
          <div className="barber-analitika-pager" aria-label="Пагинация">
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
              Страница {page} из {pages}
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
      </div>
    </div>
  );
};

export default BarberAnalitikaDetailsModal;
