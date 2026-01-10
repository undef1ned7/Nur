import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Warehouses.scss";
import WarehouseHeader from "./components/WarehouseHeader";
import SearchSection from "./components/SearchSection";
import WarehouseTable from "./components/WarehouseTable";
import Pagination from "./components/Pagination";
import CreateWarehouseModal from "./components/CreateWarehouseModal";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useWarehousesData } from "./hooks/useWarehousesData";
import {
  createWarehouseAsync,
  fetchWarehousesAsync,
} from "../../../../store/creators/warehouseCreators";

const Warehouses = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Состояние модального окна
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    return params;
  }, [currentPageFromUrl, debouncedSearchTerm]);

  // Загрузка складов
  const { warehouses, loading, count, next, previous } =
    useWarehousesData(requestParams);

  // Хук для пагинации
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

  // Обработчики событий
  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage);
    },
    [handlePageChangeBase]
  );

  const handleOpenWarehouse = useCallback(
    (warehouse) => {
      navigate(`/crm/warehouse/stocks?warehouse_id=${warehouse.id}`);
    },
    [navigate]
  );

  const handleCreateWarehouse = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCreateWarehouseSubmit = useCallback(
    async (formData) => {
      try {
        await dispatch(createWarehouseAsync(formData)).unwrap();
        // Обновляем список складов после создания
        dispatch(fetchWarehousesAsync(requestParams));
      } catch (error) {
        console.error("Ошибка при создании склада:", error);
        throw error;
      }
    },
    [dispatch, requestParams]
  );

  return (
    <div className="warehouse-page">
      <WarehouseHeader onCreateWarehouse={handleCreateWarehouse} />

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        count={count}
        foundCount={warehouses.length}
      />

      <div className="warehouse-table-container w-full">
        <WarehouseTable
          warehouses={warehouses}
          loading={loading}
          onOpenWarehouse={handleOpenWarehouse}
          getRowNumber={getRowNumber}
        />

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

      {showCreateModal && (
        <CreateWarehouseModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWarehouseSubmit}
        />
      )}
    </div>
  );
};

export default Warehouses;
