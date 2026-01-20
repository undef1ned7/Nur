// Pager.jsx
import React from "react";

const Pager = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

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
    <div className="barbermastershistory__pager">
      <button
        type="button"
        className="barbermastershistory__pageBtn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ←
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`dots-${idx}`} className="barbermastershistory__pageDots">
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`barbermastershistory__pageBtn ${p === page ? "is-active" : ""}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className="barbermastershistory__pageBtn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        →
      </button>
    </div>
  );
};

export default Pager;
