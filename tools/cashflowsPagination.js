/**
 * Есть ли следующая страница движений кассы (DRF /construction/cashflows/).
 */
export function computeCashflowsHasNext({
  dataNext,
  count,
  pageNum,
  pageSize,
  resultsLength,
}) {
  const page = Math.max(1, pageNum);
  return (
    Boolean(dataNext) ||
    (count != null && page * pageSize < count) ||
    (count == null && resultsLength === pageSize)
  );
}

/** Показывать ли блок пагинации (кнопки и/или счётчик). */
export function shouldShowCashflowsPagination({
  loading,
  itemsLength,
  pageNum,
  hasNext,
}) {
  if (loading) return false;
  return itemsLength > 0 || pageNum > 1 || hasNext;
}

/** Показывать ли кнопки «Назад» / «Вперёд». */
export function cashflowsPaginationButtons({ pageNum, hasNext }) {
  return {
    showPrev: pageNum > 1,
    showNext: Boolean(hasNext),
  };
}
