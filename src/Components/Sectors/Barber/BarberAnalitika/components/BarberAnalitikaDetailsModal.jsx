// BarberAnalitikaDetailsModal.jsx
import React, { useEffect } from "react";
import { FiInbox, FiX } from "react-icons/fi";
import ReactPortal from "../../../../common/Portal/ReactPortal";
import { usePaged } from "../BarberAnalitikaUtils";

const BarberAnalitikaDetailsModal = ({
  title,
  columns,
  rows,
  getKey,
  onClose,
  pageSize = 12,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const { page, pages, setPage, slice } = usePaged(safeRows, pageSize);
  const hasRows = slice.length > 0;

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <ReactPortal wrapperId="barber-analitika-details-modal">
      <div
        className="barber-analitika-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barber-analitika-modal-title"
        onClick={handleOverlayClick}
      >
        <div
          className="barber-analitika-modal__card"
          aria-label={title}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="barber-analitika-modal__head">
            <h3
              id="barber-analitika-modal-title"
              className="barber-analitika-modal__title"
            >
              {title}
            </h3>
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
            {hasRows ? (
              <div className="barber-analitika-table-wrap barber-analitika-table-wrap--modal">
                <table className="barber-analitika-table barber-analitika-table--modal">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          className={c.headerClassName || ""}
                        >
                          {c.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((row, index) => (
                      <tr key={getKey(row, index)}>
                        {columns.map((c) => (
                          <td key={c.key} className={c.className || ""}>
                            {c.render ? c.render(row) : row[c.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="barber-analitika-modal__empty">
                <FiInbox size={32} aria-hidden="true" />
                <p>Нет данных за выбранный период</p>
              </div>
            )}
          </div>

          {hasRows && pages > 1 && (
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
          )}
        </div>
      </div>
    </ReactPortal>
  );
};

export default BarberAnalitikaDetailsModal;
