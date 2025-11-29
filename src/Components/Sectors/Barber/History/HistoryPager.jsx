import React from "react";
import "./History.scss";
import { PAGE_SIZE } from "./HistoryUtils";

const HistoryPager = ({ filteredCount, safePage, totalPages, onPrev, onNext }) => {
  if (filteredCount <= PAGE_SIZE) return null;

  return (
    <nav className="barberhistory__pager" aria-label="Пагинация">
      <button
        className="barberhistory__pageBtn"
        onClick={onPrev}
        disabled={safePage === 1}
      >
        Назад
      </button>
      <span className="barberhistory__pageInfo">
        Стр. {safePage}/{totalPages}
      </span>
      <button
        className="barberhistory__pageBtn"
        onClick={onNext}
        disabled={safePage === totalPages}
      >
        Далее
      </button>
    </nav>
  );
};

export default HistoryPager;
