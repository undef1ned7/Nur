import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Counterparties.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import CounterpartyHeader from "./components/CounterpartyHeader";
import CounterpartySearchSection from "./components/CounterpartySearchSection";
import BulkActionsBar from "./components/BulkActionsBar";
import CounterpartyTable from "./components/CounterpartyTable";
import CounterpartyCards from "./components/CounterpartyCards";
import Pagination from "./components/Pagination";
import CreateCounterpartyModal from "./components/CreateCounterpartyModal";
import {
  bulkDeleteWarehouseCounterparties,
  fetchWarehouseCounterparties,
} from "../../../../store/creators/warehouseThunk";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useCounterpartySelection } from "./hooks/useCounterpartySelection";
import { useCounterpartyData } from "./hooks/useCounterpartyData";
import { STORAGE_KEY, VIEW_MODES } from "./constants";
import { formatDeleteMessage } from "./utils";
import ReactPortal from "../../../common/Portal/ReactPortal";

const Counterparties = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Состояние фильтров и модальных окон
  const [filters, setFilters] = useState({});
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const [searchParams] = useSearchParams();

  // Получаем текущую страницу из URL
  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

  // Параметры запроса
  const requestParams = useMemo(() => {
    const params = {
      page: currentPageFromUrl,
      ...filters,
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    return params;
  }, [currentPageFromUrl, filters, debouncedSearchTerm]);

  // Загрузка контрагентов
  const { counterparties, loading, count, next, previous } =
    useCounterpartyData(requestParams);

  // Хук для пагинации с реальными данными
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(count, next, previous);

  // Сброс на первую страницу при изменении поиска
  useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  // Хук для выбора контрагентов
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useCounterpartySelection(counterparties);

  // Сохранение режима просмотра
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleCounterpartyClick = useCallback(
    (counterparty) => {
      navigate(`/crm/warehouse/counterparties/${counterparty.id}`);
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage, () => setSelectedRows(new Set()));
    },
    [handlePageChangeBase, setSelectedRows]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setShowDeleteConfirmModal(true);
  }, [selectedCount]);

  const confirmBulkDelete = useCallback(async () => {
    setShowDeleteConfirmModal(false);
    setBulkDeleting(true);
    try {
      await dispatch(
        bulkDeleteWarehouseCounterparties(Array.from(selectedRows))
      ).unwrap();

      setSelectedRows(new Set());
      dispatch(fetchWarehouseCounterparties(requestParams));
    } catch (e) {
      console.error("Ошибка при удалении контрагентов:", e);
      alert(
        "Не удалось удалить контрагентов: " +
          (e?.message || e?.detail || "Неизвестная ошибка")
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCreateCounterparty = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount]
  );

  return (
    <div className="warehouse-page">
      <CounterpartyHeader onCreateCounterparty={handleCreateCounterparty} />

      <CounterpartySearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        count={count}
        foundCount={counterparties.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting}
      />

      <div className="warehouse-table-container w-full">
        {viewMode === VIEW_MODES.TABLE ? (
          <CounterpartyTable
            counterparties={counterparties}
            loading={loading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onCounterpartyClick={handleCounterpartyClick}
            getRowNumber={getRowNumber}
          />
        ) : (
          <CounterpartyCards
            counterparties={counterparties}
            loading={loading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onCounterpartyClick={handleCounterpartyClick}
            getRowNumber={getRowNumber}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={count}
          loading={loading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </div>

      <AlertModal
        open={showDeleteConfirmModal}
        type="warning"
        title="Подтверждение удаления"
        message={deleteModalMessage}
        okText="Удалить"
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmBulkDelete}
      />

      {showCreateModal && (
        <ReactPortal wrapperId="create_counter_modal">
          <CreateCounterpartyModal onClose={() => setShowCreateModal(false)} />
        </ReactPortal>
      )}
    </div>
  );
};

export default Counterparties;
