// BarberServicesPager.jsx
import React from "react";
import "./Services.scss";
import { PAGE_SIZE } from "./BarberServicesUtils";

const BarberServicesPager = ({
  filteredCount,
  page,
  totalPages,
  onChange,
}) => {
  if (filteredCount <= PAGE_SIZE) return null;

  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const onPrev = () => onChange(Math.max(1, pageSafe - 1));
  const onNext = () => onChange(Math.min(totalPages, pageSafe + 1));

  const pages = new Set([
    1,
    pageSafe - 1,
    pageSafe,
    pageSafe + 1,
    totalPages,
  ]);

  const list = [...pages]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav className="barberservices__pager" aria-label="Пагинация">
      <button
        className="barberservices__pageBtn"
        onClick={onPrev}
        disabled={pageSafe === 1}
      >
        Назад
      </button>
      <ul className="barberservices__pageList">
        {list.map((n, i) => {
          const prev = list[i - 1];
          const needDots = prev && n - prev > 1;
          return (
            <React.Fragment key={n}>
              {needDots && <li className="barberservices__dots">…</li>}
              <li>
                <button
                  className={`barberservices__pageBtn ${
                    n === pageSafe ? "is-active" : ""
                  }`}
                  aria-current={n === pageSafe ? "page" : undefined}
                  onClick={() => onChange(n)}
                >
                  {n}
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
      <button
        className="barberservices__pageBtn"
        onClick={onNext}
        disabled={pageSafe === totalPages}
      >
        Далее
      </button>
    </nav>
  );
};

export default BarberServicesPager;
