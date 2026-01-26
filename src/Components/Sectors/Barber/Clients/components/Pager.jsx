// Pager.jsx
import React from "react";

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

  const pages = [];
  for (let i = 1; i <= calculatedTotalPages; i++) {
    if (i === 1 || i === calculatedTotalPages || (i >= pageSafe - 1 && i <= pageSafe + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav className="barberclient__pager" aria-label="Пагинация">
      <button
        type="button"
        className="barberclient__pageBtn"
        disabled={!hasPrev || pageSafe <= 1}
        onClick={() => {
          if (hasPrev) {
            onChange(Math.max(1, pageSafe - 1));
          }
        }}
      >
        Назад
      </button>

      <ul className="barberclient__pageList">
        {pages.map((p, idx) =>
          p === "..." ? (
            <li key={`dots-${idx}`} className="barberclient__dots">...</li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={`barberclient__pageBtn ${p === pageSafe ? "is-active" : ""}`}
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
        className="barberclient__pageBtn"
        disabled={!hasNext || pageSafe >= calculatedTotalPages}
        onClick={() => {
          if (hasNext) {
            onChange(Math.min(calculatedTotalPages, pageSafe + 1));
          }
        }}
      >
        Далее
      </button>
    </nav>
  );
};

export default Pager;
