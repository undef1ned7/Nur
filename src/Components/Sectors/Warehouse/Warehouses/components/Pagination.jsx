import React from "react";
import "./Pagination.scss";

/**
 * Компонент пагинации
 */
const Pagination = ({
  currentPage,
  totalPages,
  count,
  loading,
  hasNextPage,
  hasPrevPage,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="warehouse-pagination">
      <button
        type="button"
        className="warehouse-pagination__btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading || !hasPrevPage}
      >
        Назад
      </button>
      <span className="warehouse-pagination__info">
        Страница {currentPage} из {totalPages ?? 1}
        {count ? ` (${count} складов)` : ""}
      </span>
      <button
        type="button"
        className="warehouse-pagination__btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={loading || !hasNextPage || (totalPages && currentPage >= totalPages)}
      >
        Вперед
      </button>
    </div>
  );
};

export default React.memo(Pagination);

