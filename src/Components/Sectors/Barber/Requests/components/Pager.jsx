import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

/**
 * Компонент пагинации для server-side списков
 * @param {number} count - Общее количество элементов
 * @param {number} page - Текущая страница
 * @param {number} totalPages - Общее количество страниц (опционально, вычисляется из count если не передано)
 * @param {string|null} next - URL следующей страницы (для определения наличия следующей страницы)
 * @param {string|null} previous - URL предыдущей страницы (для определения наличия предыдущей страницы)
 * @param {Function} onChange - Обработчик изменения страницы: (page) => void
 */
const Pager = ({ count, page, totalPages, next, previous, onChange }) => {
  // Если нет данных или только одна страница, не показываем пагинацию
  if (!count || count === 0) return null;

  // Вычисляем totalPages если не передано
  const calculatedTotalPages = totalPages || (next || previous ? page + (next ? 1 : 0) : 1);
  
  // Если только одна страница, не показываем
  if (calculatedTotalPages <= 1) return null;

  const pageSafe = Math.min(Math.max(1, page), calculatedTotalPages);
  const hasNext = !!next;
  const hasPrev = !!previous;

  const getPageNumbers = () => {
    const pages = [];
    const delta = 1;

    for (let i = 1; i <= calculatedTotalPages; i++) {
      if (
        i === 1 ||
        i === calculatedTotalPages ||
        (i >= pageSafe - delta && i <= pageSafe + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }

    return pages;
  };

  return (
    <div className="barberrequests__pager">
      <button
        type="button"
        className="barberrequests__pageBtn"
        disabled={!hasPrev || pageSafe <= 1}
        onClick={() => {
          if (hasPrev) {
            onChange(Math.max(1, pageSafe - 1));
          }
        }}
        aria-label="Предыдущая"
      >
        <FaChevronLeft />
      </button>

      <ul className="barberrequests__pageList">
        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <li key={`dots-${idx}`} className="barberrequests__dots">
              ...
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={`barberrequests__pageBtn ${p === pageSafe ? "is-active" : ""}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </li>
          )
        )}
      </ul>

      <button
        type="button"
        className="barberrequests__pageBtn"
        disabled={!hasNext || pageSafe >= calculatedTotalPages}
        onClick={() => {
          if (hasNext) {
            onChange(Math.min(calculatedTotalPages, pageSafe + 1));
          }
        }}
        aria-label="Следующая"
      >
        <FaChevronRight />
      </button>
    </div>
  );
};

export default Pager;
