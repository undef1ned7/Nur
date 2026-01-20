import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const Pager = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const delta = 1;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - delta && i <= page + delta)
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
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
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
                className={`barberrequests__pageBtn ${p === page ? "is-active" : ""}`}
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
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Следующая"
      >
        <FaChevronRight />
      </button>
    </div>
  );
};

export default Pager;
