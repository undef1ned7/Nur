import { useEffect, useMemo, useState } from "react";
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
import { sendProductsToScales } from "../../../store/creators/userCreators";

// Компоненты
import EditModal from "./EditModal/EditModal";
import AddProductModal from "./AddProduct/AddProductModal";
import MarriageModal from "./MarriageModal";
import AlertModal from "../../common/AlertModal/AlertModal";
import SkladTab from "./components/SkladTab";
import HistoryTab from "./components/HistoryTab";
import SkladHeader from "./components/SkladHeader";
import SkladSearchSection from "./components/SkladSearchSection";

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
  const isMarketCompany =
    sectorName === "магазин" || sectorName === "цветочный магазин";
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
    // Navigation will be handled by SkladHeader component
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

  // Отправка товаров на весы
  const handleSendToScales = async () => {
    try {
      const payload = {
        plu_start: 1, // По умолчанию начинаем с 1
      };

      // Если есть выбранные товары, добавляем их ID
      const selectedCount =
        selectedIds && selectedIds.size > 0 ? selectedIds.size : 0;
      if (selectedCount > 0) {
        payload.product_ids = Array.from(selectedIds);
      }

      await dispatch(sendProductsToScales(payload)).unwrap();

      const productCount = selectedCount > 0 ? selectedCount : products.length;
      const productText =
        productCount === 1 ? "товар" : productCount < 5 ? "товара" : "товаров";
      setAlertMessage(
        selectedCount > 0
          ? `Выбранные товары (${productCount} ${productText}) успешно отправлены на весы`
          : `Все товары успешно отправлены на весы`
      );
      setShowSuccessAlert(true);
    } catch (err) {
      const errorMessage =
        err?.detail ||
        err?.message ||
        (typeof err === "string" ? err : "Не удалось отправить товары на весы");
      setAlertMessage(errorMessage);
      setShowErrorAlert(true);
    }
  };

  const totalPages =
    count && products.length > 0 ? Math.ceil(count / products.length) : 1;

  // Фильтрация товаров по типу для маркета
  const pieceProducts = useMemo(
    () => products.filter((p) => p.scale_type === "piece"),
    [products]
  );
  const weightProducts = useMemo(
    () => products.filter((p) => p.scale_type === "weight"),
    [products]
  );

  // Базовые табы (для строительной компании и других)
  const baseTabs = [
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
          isMarketCompany={isMarketCompany}
          onShowReceiveModal={() => setShowReceiveModal(true)}
          onShowHistoryModal={() => setShowHistoryModal(true)}
          selectCashBox={selectCashBox}
          onSelectCashBox={setSelectCashBox}
          cashBoxes={cashBoxes}
          onAdd={handleAdd}
          onSendToScales={handleSendToScales}
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
          showHeader={true}
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

  // Табы для маркета (четыре таба)
  const marketTabs = [
    {
      label: "Все товары",
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
          isMarketCompany={isMarketCompany}
          onShowReceiveModal={() => setShowReceiveModal(true)}
          onShowHistoryModal={() => setShowHistoryModal(true)}
          selectCashBox={selectCashBox}
          onSelectCashBox={setSelectCashBox}
          cashBoxes={cashBoxes}
          onAdd={handleAdd}
          onSendToScales={handleSendToScales}
          onShowFilterModal={() => setShowFilterModal(true)}
          showHeader={false}
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
      label: "Штучные",
      content: (
        <SkladTab
          products={pieceProducts}
          loading={loading}
          error={error}
          count={pieceProducts.length}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChangeWithReset}
          isFiltered={isFiltered}
          onResetFilters={handleResetAllFiltersWithReset}
          isBuildingCompany={isBuildingCompany}
          isMarketCompany={isMarketCompany}
          onShowReceiveModal={() => setShowReceiveModal(true)}
          onShowHistoryModal={() => setShowHistoryModal(true)}
          selectCashBox={selectCashBox}
          onSelectCashBox={setSelectCashBox}
          cashBoxes={cashBoxes}
          onAdd={handleAdd}
          onSendToScales={handleSendToScales}
          onShowFilterModal={() => setShowFilterModal(true)}
          showHeader={false}
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
      label: "Килограммовые",
      content: (
        <SkladTab
          products={weightProducts}
          loading={loading}
          error={error}
          count={weightProducts.length}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChangeWithReset}
          isFiltered={isFiltered}
          onResetFilters={handleResetAllFiltersWithReset}
          isBuildingCompany={isBuildingCompany}
          isMarketCompany={isMarketCompany}
          onShowReceiveModal={() => setShowReceiveModal(true)}
          onShowHistoryModal={() => setShowHistoryModal(true)}
          selectCashBox={selectCashBox}
          onSelectCashBox={setSelectCashBox}
          cashBoxes={cashBoxes}
          onAdd={handleAdd}
          onSendToScales={handleSendToScales}
          onShowFilterModal={() => setShowFilterModal(true)}
          showHeader={false}
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
  ];

  // Выбираем табы в зависимости от типа компании
  const tabs = isMarketCompany ? marketTabs : baseTabs;

  return (
    <div className="sklad sklad-market">
      {isStartPlan ? (
        <>
          {/* Для тарифа "старт" показываем заголовок и контент первого таба */}
          <SkladHeader
            isBuildingCompany={isBuildingCompany}
            isMarketCompany={isMarketCompany}
            onShowReceiveModal={() => setShowReceiveModal(true)}
            onShowHistoryModal={() => setShowHistoryModal(true)}
            selectCashBox={selectCashBox}
            onSelectCashBox={setSelectCashBox}
            cashBoxes={cashBoxes}
            onAdd={handleAdd}
            onSendToScales={handleSendToScales}
          />
          {/* Контент первого таба без заголовка (так как он уже показан выше) */}
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
            isMarketCompany={isMarketCompany}
            onShowReceiveModal={() => setShowReceiveModal(true)}
            onShowHistoryModal={() => setShowHistoryModal(true)}
            selectCashBox={selectCashBox}
            onSelectCashBox={setSelectCashBox}
            cashBoxes={cashBoxes}
            onAdd={handleAdd}
            onSendToScales={handleSendToScales}
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
            showHeader={false}
          />
        </>
      ) : isBuildingCompany || isMarketCompany ? (
        <>
          {/* Для маркета: сначала заголовок, потом табы, потом поиск, потом контент */}
          {isMarketCompany ? (
            <>
              {/* Заголовок */}
              <SkladHeader
                isBuildingCompany={isBuildingCompany}
                isMarketCompany={isMarketCompany}
                onShowReceiveModal={() => setShowReceiveModal(true)}
                onShowHistoryModal={() => setShowHistoryModal(true)}
                selectCashBox={selectCashBox}
                onSelectCashBox={setSelectCashBox}
                cashBoxes={cashBoxes}
                onAdd={handleAdd}
                onSendToScales={handleSendToScales}
              />
              {/* Табы после заголовка */}
              <div className="vitrina__tabs">
                {tabs.map((tab, index) => (
                  <button
                    key={index}
                    className={`vitrina__tab ${
                      index === activeTab && "vitrina__tab--active"
                    }`}
                    onClick={() => setActiveTab(index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Поиск и фильтры после табов */}
              <SkladSearchSection
                searchTerm={searchTerm}
                onSearchChange={handleSearchChangeWithReset}
                count={count}
                productsLength={
                  activeTab === 0
                    ? products.length
                    : activeTab === 1
                    ? pieceProducts.length
                    : activeTab === 2
                    ? weightProducts.length
                    : products.length
                }
                isFiltered={isFiltered}
                onResetFilters={handleResetAllFiltersWithReset}
                onShowFilterModal={() => setShowFilterModal(true)}
              />
              {/* Контент активного таба (без заголовка) */}
              {tabs[activeTab].content}
            </>
          ) : (
            <>{tabs[activeTab].content}</>
          )}
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

      {/* AlertModal для успешных операций */}
      <AlertModal
        open={showSuccessAlert}
        type="success"
        title="Успешно!"
        message={
          alertMessage ||
          (successProductName
            ? `Товар "${successProductName}" успешно добавлен в склад`
            : "Операция выполнена успешно")
        }
        okText="ОК"
        onClose={() => {
          setShowSuccessAlert(false);
          setSuccessProductName("");
          setAlertMessage("");
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
