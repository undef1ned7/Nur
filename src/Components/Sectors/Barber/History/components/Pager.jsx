import React from "react";
import { PAGE_SIZE } from "../HistoryUtils";

const Pager = ({ filteredCount, page, totalPages, onChange }) => {
  if (filteredCount <= PAGE_SIZE) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - 1 && i <= page + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav className="barberhistory__pager" aria-label="Пагинация">
      <button
        type="button"
        className="barberhistory__pageBtn"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >
        Назад
      </button>

      <ul className="barberhistory__pageList">
        {pages.map((p, idx) =>
          p === "..." ? (
            <li key={`dots-${idx}`} className="barberhistory__dots">...</li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={`barberhistory__pageBtn ${p === page ? "is-active" : ""}`}
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
        className="barberhistory__pageBtn"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
      >
        Далее
      </button>
    </nav>
  );
};

export default Pager;
