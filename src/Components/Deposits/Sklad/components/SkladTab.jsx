import SkladHeader from "./SkladHeader";
import SkladTable from "./SkladTable";
import SelectionActions from "./SelectionActions";
import Pagination from "./Pagination";

/**
 * Компонент вкладки "Склад"
 */
const SkladTab = ({
  products,
  loading,
  error,
  count,
  searchTerm,
  onSearchChange,
  isFiltered,
  onResetFilters,
  isBuildingCompany,
  onShowReceiveModal,
  onShowHistoryModal,
  selectCashBox,
  onSelectCashBox,
  cashBoxes,
  onAdd,
  isSelected,
  toggleRow,
  toggleSelectAllOnPage,
  onEdit,
  onOpenMarriage,
  onOpenAddProduct,
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
  const filterProducts = products.filter((item) => item.status === "accepted");
  const filterP = isBuildingCompany ? filterProducts : products;

  return (
    <>
      <SkladHeader
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        count={count}
        productsLength={products.length}
        isFiltered={isFiltered}
        onResetFilters={onResetFilters}
        isBuildingCompany={isBuildingCompany}
        onShowReceiveModal={onShowReceiveModal}
        onShowHistoryModal={onShowHistoryModal}
        selectCashBox={selectCashBox}
        onSelectCashBox={onSelectCashBox}
        cashBoxes={cashBoxes}
        onAdd={onAdd}
      />

      {filterP.length !== 0 && (
        <SelectionActions
          pageItems={filterP}
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
        <p className="sklad__error-message">Ошибка загрузки:</p>
      ) : filterP.length === 0 ? (
        <p className="sklad__no-products-message">Нет доступных товаров.</p>
      ) : (
        <SkladTable
          products={filterP}
          onEdit={onEdit}
          onOpenMarriage={onOpenMarriage}
          onOpenAddProduct={onOpenAddProduct}
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

export default SkladTab;
