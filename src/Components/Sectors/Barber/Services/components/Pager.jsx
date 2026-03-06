import React from "react";

const Pager = ({ count, page, hasNext, hasPrevious, onChange }) => {
  if (count === 0 || (!hasNext && !hasPrevious)) return null;

  const pageSafe = Math.max(1, page);

  const onPrev = () => {
    if (hasPrevious) {
      onChange(pageSafe - 1);
    }
  };

  const onNext = () => {
    if (hasNext) {
      onChange(pageSafe + 1);
    }
  };

  return (
    <nav className="barberservices__pager" aria-label="Пагинация">
      <button
        className="barberservices__pageBtn"
        onClick={onPrev}
        disabled={!hasPrevious}
      >
        Назад
      </button>
      <div className="barberservices__pageInfo">
        Страница {pageSafe}
      </div>
      <button
        className="barberservices__pageBtn"
        onClick={onNext}
        disabled={!hasNext}
      >
        Далее
      </button>
    </nav>
  );
};

export default Pager;
