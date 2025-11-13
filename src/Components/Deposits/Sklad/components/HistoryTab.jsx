import SkladHeader from "./SkladHeader";
import SkladTable from "./SkladTable";
import SelectionActions from "./SelectionActions";
import Pagination from "./Pagination";

/**
 * Компонент вкладки "История"
 */
const HistoryTab = ({
  products,
  loading,
  error,
  count,
  searchTerm,
  onSearchChange,
  isFiltered,
  onResetFilters,
  isSelected,
  toggleRow,
  toggleSelectAllOnPage,
  onEdit,
  currentPage,
  totalPages,
  next,
  previous,
  creating,
  updating,
  deleting,
  onNextPage,
  onPreviousPage,
  selectedIds,
  onBulkDelete,
  onClearSelection,
  bulkDeleting,
}) => {
  const filteredHistory = products.filter((item) => item.status === "history");

  return (
    <>
      <SkladHeader
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        count={count}
        productsLength={products.length}
        isFiltered={isFiltered}
        onResetFilters={onResetFilters}
        isBuildingCompany={false}
        selectCashBox=""
        cashBoxes={[]}
      />

      {filteredHistory.length !== 0 && (
        <SelectionActions
          pageItems={products}
          selectedIds={selectedIds}
          toggleSelectAllOnPage={toggleSelectAllOnPage}
          onBulkDelete={onBulkDelete}
          onClearSelection={onClearSelection}
          bulkDeleting={bulkDeleting}
        />
      )}

      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки</p>
      ) : filteredHistory.length === 0 ? (
        <p className="sklad__no-products-message">Нет доступных товаров.</p>
      ) : (
        <SkladTable
          products={filteredHistory}
          onEdit={onEdit}
          isSelected={isSelected}
          toggleRow={toggleRow}
          toggleSelectAllOnPage={toggleSelectAllOnPage}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        next={next}
        previous={previous}
        loading={loading}
        creating={creating}
        updating={updating}
        deleting={deleting}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
      />
    </>
  );
};

export default HistoryTab;
