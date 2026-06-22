import React from "react";

export default function BuildingPagination({
  page = 1,
  totalPages = 1,
  onChange,
  disabled = false,
}) {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="building-page__pagination">
      <button
        type="button"
        className="building-btn"
        disabled={disabled || !canPrev}
        onClick={() => onChange?.(page - 1)}
      >
        Назад
      </button>
      <div className="building-page__paginationInfo">
        Страница {page} из {totalPages}
      </div>
      <button
        type="button"
        className="building-btn"
        disabled={disabled || !canNext}
        onClick={() => onChange?.(page + 1)}
      >
        Вперед
      </button>
    </div>
  );
}
