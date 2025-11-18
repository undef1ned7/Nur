import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import "./Sklad.scss";

// Redux
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../store/creators/productCreators";
import { clearProducts } from "../../../store/slices/productSlice";
import { getCashBoxes, useCash } from "../../../store/slices/cashSlice";
import { useUser } from "../../../store/slices/userSlice";

// Компоненты
import EditModal from "./EditModal/EditModal";
import AddProductModal from "./AddProduct/AddProductModal";
import MarriageModal from "./MarriageModal";
import AlertModal from "../../common/AlertModal/AlertModal";
import SkladTab from "./components/SkladTab";
import HistoryTab from "./components/HistoryTab";

// Модальные окна
import AddBrandModal from "./components/modals/AddBrandModal";
import FilterModal from "./components/modals/FilterModal";
import AcceptPendingModal from "./components/modals/AcceptPendingModal";
import AcceptHistoryModal from "./components/modals/AcceptHistoryModal";
import AddModal from "./components/modals/AddModal";
import SellModal from "./components/modals/SellModal";

// Хуки
import { useBulkSelection } from "./hooks/useBulkSelection";
import { useSkladFilters } from "./hooks/useSkladFilters";
import { useSkladPagination } from "./hooks/useSkladPagination";
import { useBulkDelete } from "./hooks/useBulkDelete";

export default function Sklad() {
  const dispatch = useDispatch();

  const {
    list: products,
    loading,
    error,
    count,
    next,
    previous,
    creating,
    updating,
    deleting,
  } = useSelector((state) => state.product);
  const { list: cashBoxes } = useCash();
  const { company } = useUser();

  // Модальные окна
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemId, setItemId] = useState(null);
  const [itemId1, setItemId1] = useState(null);
  const [selectCashBox, setSelectCashBox] = useState("");

  // Alert модалки
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [successProductName, setSuccessProductName] = useState("");

  // Табы
  const [activeTab, setActiveTab] = useState(0);

  // Хуки
  const {
    selectedIds,
    bulkDeleting,
    setBulkDeleting,
    isSelected,
    toggleRow,
    toggleSelectAllOnPage,
    clearSelection,
  } = useBulkSelection();

  const {
    searchTerm,
    currentFilters,
    isFiltered,
    handleSearchChange,
    handleApplyFilters,
    handleResetAllFilters,
    setSearchTerm,
    setCurrentFilters,
  } = useSkladFilters();

  const {
    currentPage,
    setCurrentPage,
    handleNextPage,
    handlePreviousPage,
    resetPage,
  } = useSkladPagination();

  const handleBulkDelete = useBulkDelete(
    selectedIds,
    clearSelection,
    currentPage,
    searchTerm,
    currentFilters
  );

  // Определение сектора и тарифа
  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";
  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  // Загрузка данных
  useEffect(() => {
    const params = {
      page: currentPage,
      search: searchTerm,
      ...currentFilters,
    };
    dispatch(fetchProductsAsync(params));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());

    return () => {
      dispatch(clearProducts());
    };
  }, [
    dispatch,
    currentPage,
    searchTerm,
    creating,
    updating,
    deleting,
    currentFilters,
  ]);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  // Обработка ESC для закрытия модалок
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        setShowAddModal(false);
        setShowSellModal(false);
        setShowEditModal(false);
        setShowFilterModal(false);
        setShowReceiveModal(false);
        setShowHistoryModal(false);
        setShowAddProductModal(false);
        setShowMarriageModal(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Обработчики
  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleSaveSuccess = () => {
    setShowEditModal(false);
    setShowAddModal(false);
    alert("Операция с товаром успешно завершена!");
    dispatch(
      fetchProductsAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleDeleteConfirm = () => {
    setShowEditModal(false);
    if (selectedItem?.id) {
      const newSelectedIds = new Set(selectedIds);
      newSelectedIds.delete(selectedItem.id);
      clearSelection();
      Array.from(newSelectedIds).forEach((id) => {
        toggleRow(id);
      });
    }
    alert("Товар успешно удален!");
    dispatch(
      fetchProductsAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleSearchChangeWithReset = (e) => {
    handleSearchChange(e);
    resetPage();
  };

  const handleApplyFiltersWithReset = (filters) => {
    handleApplyFilters(filters);
    resetPage();
  };

  const handleResetAllFiltersWithReset = () => {
    handleResetAllFilters();
    resetPage();
  };

  const handleOpenMarriage = (item) => {
    setShowMarriageModal(true);
    setItemId(item);
  };

  const handleOpenAddProduct = (item) => {
    setShowAddProductModal(true);
    setItemId1(item);
  };

  const totalPages =
    count && products.length > 0 ? Math.ceil(count / products.length) : 1;

  const tabs = [
    {
      label: "Склад",
      content: (
        <SkladTab
          products={products}
          loading={loading}
          error={error}
          count={count}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChangeWithReset}
          isFiltered={isFiltered}
          onResetFilters={handleResetAllFiltersWithReset}
          isBuildingCompany={isBuildingCompany}
          onShowReceiveModal={() => setShowReceiveModal(true)}
          onShowHistoryModal={() => setShowHistoryModal(true)}
          selectCashBox={selectCashBox}
          onSelectCashBox={setSelectCashBox}
          cashBoxes={cashBoxes}
          onAdd={handleAdd}
          isSelected={isSelected}
          toggleRow={toggleRow}
          toggleSelectAllOnPage={toggleSelectAllOnPage}
          onEdit={handleEdit}
          onOpenMarriage={handleOpenMarriage}
          onOpenAddProduct={handleOpenAddProduct}
          currentPage={currentPage}
          totalPages={totalPages}
          next={next}
          previous={previous}
          creating={creating}
          updating={updating}
          deleting={deleting}
          onNextPage={() => handleNextPage(next)}
          onPreviousPage={() => handlePreviousPage(previous)}
          selectedIds={selectedIds}
          onBulkDelete={handleBulkDelete}
          onClearSelection={clearSelection}
          bulkDeleting={bulkDeleting}
        />
      ),
    },
    {
      label: "История",
      content: (
        <HistoryTab
          products={products}
          loading={loading}
          error={error}
          count={count}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChangeWithReset}
          isFiltered={isFiltered}
          onResetFilters={handleResetAllFiltersWithReset}
          isSelected={isSelected}
          toggleRow={toggleRow}
          toggleSelectAllOnPage={toggleSelectAllOnPage}
          onEdit={handleEdit}
          currentPage={currentPage}
          totalPages={totalPages}
          next={next}
          previous={previous}
          creating={creating}
          updating={updating}
          deleting={deleting}
          onNextPage={() => handleNextPage(next)}
          onPreviousPage={() => handlePreviousPage(previous)}
          selectedIds={selectedIds}
          onBulkDelete={handleBulkDelete}
          onClearSelection={clearSelection}
          bulkDeleting={bulkDeleting}
        />
      ),
    },
  ];

  return (
    <div className="sklad">
      {isStartPlan ? (
        <>{tabs[0].content}</>
      ) : isBuildingCompany ? (
        <>
          <div className="vitrina__header" style={{ margin: "15px 0" }}>
            <div className="vitrina__tabs">
              {tabs.map((tab, index) => (
                <span
                  key={index}
                  className={`vitrina__tab ${
                    index === activeTab && "vitrina__tab--active"
                  }`}
                  onClick={() => setActiveTab(index)}
                >
                  {tab.label}
                </span>
              ))}
            </div>
          </div>
          {tabs[activeTab].content}
        </>
      ) : (
        <>{tabs[0].content}</>
      )}

      {/* Модальные окна */}
      {showEditModal && selectedItem && (
        <EditModal
          item={selectedItem}
          onClose={() => setShowEditModal(false)}
          onSaveSuccess={handleSaveSuccess}
          onDeleteConfirm={handleDeleteConfirm}
        />
      )}

      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={currentFilters}
          onApplyFilters={handleApplyFiltersWithReset}
          onResetFilters={handleResetAllFiltersWithReset}
        />
      )}

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onSaveSuccess={handleSaveSuccess}
          cashBoxes={cashBoxes}
          selectCashBox={selectCashBox}
          onShowSuccessAlert={(productName) => {
            setSuccessProductName(productName);
            setShowAddModal(false);
            setTimeout(() => {
              setShowSuccessAlert(true);
            }, 100);
          }}
          onShowErrorAlert={(errorMsg) => {
            setAlertMessage(errorMsg);
            setShowAddModal(false);
            setTimeout(() => {
              setShowErrorAlert(true);
            }, 100);
          }}
        />
      )}

      {showSellModal && <SellModal onClose={() => setShowSellModal(false)} />}

      {showBrandModal && (
        <AddBrandModal onClose={() => setShowBrandModal(false)} />
      )}

      {showReceiveModal && (
        <AcceptPendingModal
          onClose={() => setShowReceiveModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            )
          }
        />
      )}

      {showHistoryModal && (
        <AcceptHistoryModal
          onClose={() => setShowHistoryModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            )
          }
        />
      )}

      {showMarriageModal && (
        <MarriageModal
          onClose={() => setShowMarriageModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            )
          }
          item={itemId}
        />
      )}

      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            ).unwrap()
          }
          item={itemId1}
        />
      )}

      {/* AlertModal для успешного добавления товара */}
      <AlertModal
        open={showSuccessAlert}
        type="success"
        title="Успешно!"
        message={`Товар "${successProductName}" успешно добавлен в склад`}
        okText="ОК"
        onClose={() => {
          setShowSuccessAlert(false);
          setSuccessProductName("");
        }}
      />

      {/* AlertModal для ошибки при добавлении товара */}
      <AlertModal
        open={showErrorAlert}
        type="error"
        title="Ошибка!"
        message={alertMessage}
        okText="ОК"
        onClose={() => {
          setShowErrorAlert(false);
          setAlertMessage("");
        }}
      />
    </div>
  );
}
