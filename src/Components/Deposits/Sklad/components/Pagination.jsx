/**
 * Компонент пагинации
 */
const Pagination = ({
  currentPage,
  totalPages,
  next,
  previous,
  loading,
  creating,
  updating,
  deleting,
  onNextPage,
  onPreviousPage,
}) => {
  return (
    <div className="sklad__pagination">
      <span>
        {currentPage} из {totalPages}
      </span>
      <button
        onClick={onPreviousPage}
        disabled={!previous || loading || creating || updating || deleting}
      >
        ←
      </button>
      <button
        onClick={onNextPage}
        disabled={!next || loading || creating || updating || deleting}
      >
        →
      </button>
    </div>
  );
};

export default Pagination;
