// CatalogAnalyticsDetailsModal.jsx
import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./CatalogAnalytics.scss";
import { usePaged } from "./CatalogAnalyticsUtils";

const CatalogAnalyticsDetailsModal = ({
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
    <div className="ca-modal" role="dialog" aria-modal="true">
      <div className="ca-modal__overlay" onClick={onClose} />
      <div className="ca-modal__card" aria-label={title}>
        <div className="ca-modal__head">
          <h3 className="ca-modal__title">{title}</h3>
          <button
            className="ca-modal__icon"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="ca-modal__body">
          <div className="ca-tableWrap ca-tableWrap--modal">
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

        <div className="ca-modal__footer">
          <div className="ca-pager" aria-label="Пагинация">
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
              Страница {page} из {pages}
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
      </div>
    </div>
  );
};

export default CatalogAnalyticsDetailsModal;
