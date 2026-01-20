// RecordaRatesPager.jsx
import React from "react";

const RecordaRatesPager = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  return (
    <nav className="barberrecordarates__pager" aria-label="Пагинация">
      <button
        className="barberrecordarates__pageBtn"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        type="button"
      >
        Назад
      </button>
      <span className="barberrecordarates__pageInfo">
        Стр. {page}/{totalPages}
      </span>
      <button
        className="barberrecordarates__pageBtn"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        type="button"
      >
        Далее
      </button>
    </nav>
  );
};

export default RecordaRatesPager;
