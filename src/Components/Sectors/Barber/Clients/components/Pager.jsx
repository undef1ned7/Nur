// Pager.jsx
import React from "react";
import { PAGE_SIZE } from "../barberClientConstants";

const Pager = ({ filteredCount, page, totalPages, onChange }) => {
  if (filteredCount <= PAGE_SIZE) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
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
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
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
                className={`barberclient__pageBtn ${p === page ? "is-active" : ""}`}
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
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Далее
      </button>
    </nav>
  );
};

export default Pager;
