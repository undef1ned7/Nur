import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  LayoutGrid,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import "./Warehouse.scss";
import FilterModal from "./components/FilterModal";
import AlertModal from "../../../common/AlertModal/AlertModal";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
  bulkDeleteProductsAsync,
} from "../../../../store/creators/productCreators";
import { useProducts } from "../../../../store/slices/productSlice";

import noImage from "./components/placeholder.png";

const STORAGE_KEY = "warehouse_view_mode";

const getInitialViewMode = () => {
  if (typeof window === "undefined") return "table";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "table" || saved === "cards") return saved;

  const isSmall = window.matchMedia("(max-width: 1199px)").matches;
  return isSmall ? "cards" : "table";
};

const Warehouse = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { list: products, loading, count, next, previous } = useProducts();
  const brands = useSelector((state) => state.product.brands || []);
  const categories = useSelector((state) => state.product.categories || []);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({});
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const debounceTimerRef = useRef(null);

  // view toggle
  const [viewMode, setViewMode] = useState(getInitialViewMode); // "table" | "cards"

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
  }, [dispatch]);

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  // Загрузка товаровф
  useEffect(() => {
    const params = {
      page: currentPage,
      ...filters,
    };

    // Используем параметр search для всех запросов (включая штрих-коды)
    // API должен обрабатывать поиск по штрих-коду через параметр search
    if (debouncedSearchTerm) {
      params.search = debouncedSearchTerm.trim();
    }

    dispatch(fetchProductsAsync(params));
  }, [dispatch, debouncedSearchTerm, filters, currentPage]);

  // Обновляем pageSize при каждой загрузке списка
  useEffect(() => {
    if (products && products.length) {
      setPageSize(products.length);
    }
  }, [products]);

  // При смене фильтров / поиска возвращаемся на первую страницу
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filters]);

  const filteredProducts = products;

  const totalPages =
    pageSize && count
      ? Math.ceil(count / pageSize)
      : count && products.length
      ? Math.ceil(count / products.length)
      : 1;

  const getRowNumber = (index) => {
    const effectivePageSize = pageSize || products.length || 1;
    return (currentPage - 1) * effectivePageSize + index + 1;
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    setSelectedRows(new Set());
    setCurrentPage(newPage);
  };

  const handleProductClick = (product) => {
    navigate(`/crm/sklad/${product.id}`);
  };

  const handleRowSelect = (productId, e) => {
    e.stopPropagation();
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) newSet.delete(productId);
      else newSet.add(productId);
      return newSet;
    });
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (selectedRows.size === filteredProducts.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    setShowDeleteConfirmModal(true);
  };

  const confirmBulkDelete = async () => {
    setShowDeleteConfirmModal(false);
    setBulkDeleting(true);
    try {
      await dispatch(
        bulkDeleteProductsAsync({
          ids: Array.from(selectedRows),
          soft: true,
          require_all: false,
        })
      ).unwrap();

      setSelectedRows(new Set());

      // Обновляем список товаров
      const params = {
        page: currentPage,
        ...filters,
      };
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm.trim();
      }
      dispatch(fetchProductsAsync(params));
    } catch (e) {
      alert("Не удалось удалить товары: " + (e.message || e));
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedRows(new Set());
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

  const formatStock = (stock) => {
    if (stock === null || stock === undefined) return "—";
    return stock.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  // get primary image
  const getPrimaryImage = (product) => {
    if (!product?.images || !Array.isArray(product.images)) return null;
    const primaryImage = product.images.find((img) => img.is_primary);
    return primaryImage || product.images[0] || null;
  };

  return (
    <div className="warehouse-page">
      {/* Header */}
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📦</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Склад</h1>
            <p className="warehouse-header__subtitle">
              Управление товарами и запасами
            </p>
          </div>
        </div>
        <button
          className="warehouse-header__create-btn"
          onClick={() => navigate("/crm/sklad/add-product")}
        >
          <Plus size={16} />
          Создать товар
        </button>
      </div>

      {/* Search and Filters */}
      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <Search className="warehouse-search__icon" size={18} />
          <input
            type="text"
            className="warehouse-search__input"
            placeholder="Поиск по названию товара..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            Всего: {count || 0} • Найдено: {filteredProducts.length}
          </span>

          {/* view toggle */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === "table"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <Table2 size={16} />
              Таблица
            </button>

            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === "cards"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>

            <button
              className="warehouse-search__filter-btn"
              onClick={() => setShowFilterModal(true)}
            >
              <Filter size={16} />
              Фильтры
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <div className="warehouse-bulk-actions">
          <div className="warehouse-bulk-actions__content">
            <div className="warehouse-bulk-actions__info">
              <div className="warehouse-bulk-actions__badge">
                <span className="warehouse-bulk-actions__count">
                  {selectedRows.size}
                </span>
                <span className="warehouse-bulk-actions__text">
                  {selectedRows.size === 1
                    ? "товар выбран"
                    : selectedRows.size < 5
                    ? "товара выбрано"
                    : "товаров выбрано"}
                </span>
              </div>
            </div>
            <div className="warehouse-bulk-actions__buttons">
              <button
                className="warehouse-bulk-actions__clear-btn"
                onClick={handleClearSelection}
                disabled={bulkDeleting}
                title="Снять выбор"
              >
                <X size={16} />
                Сбросить
              </button>
              <button
                className="warehouse-bulk-actions__delete-btn"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                title="Удалить выбранные товары"
              >
                <Trash2 size={16} />
                {bulkDeleting ? "Удаление..." : "Удалить выбранные"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="warehouse-table-container w-full">
        {/* ===== TABLE (with overflow-auto) ===== */}
        {viewMode === "table" && (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="warehouse-table w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedRows.size === filteredProducts.length
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>№</th>
                  <th>Название</th>
                  <th>Код</th>
                  <th>Артикул</th>
                  <th>Ед. изм.</th>
                  <th>Цена продажи</th>
                  <th>Скидка</th>
                  <th>Остатки</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="warehouse-table__empty">
                      Товары не найдены
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className="warehouse-table__row"
                      onClick={() => handleProductClick(product)}
                    >
                      <td onClick={(e) => handleRowSelect(product.id, e)}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(product.id)}
                          onChange={(e) => handleRowSelect(product.id, e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      <td>{getRowNumber(index)}</td>

                      <td className="warehouse-table__name">
                        <div className="warehouse-table__name-cell">
                          {(() => {
                            const primaryImage = getPrimaryImage(product);
                            return (
                              <img
                                src={primaryImage?.image_url || noImage}
                                alt={product.name || "Товар"}
                                className="warehouse-table__product-image"
                                onError={(e) => {
                                  e.currentTarget.src = noImage;
                                }}
                              />
                            );
                          })()}
                          <span>{product.name || "—"}</span>
                        </div>
                      </td>

                      <td>{product.code || "—"}</td>
                      <td>{product.article || "—"}</td>
                      <td>{product.unit || "—"}</td>
                      <td>{formatPrice(product.price)}</td>
                      <td>{formatPrice(product.discount_percent || 0)}</td>
                      <td>{formatStock(product.quantity)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== CARDS ===== */}
        {viewMode === "cards" && (
          <div className="block">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <label
                className="flex items-center gap-2 text-sm text-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={
                    filteredProducts.length > 0 &&
                    selectedRows.size === filteredProducts.length
                  }
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Выбрать все
              </label>

              <div className="text-sm text-slate-600">
                Выбрано:{" "}
                <span className="font-semibold">{selectedRows.size}</span>
              </div>
            </div>

            {loading ? (
              <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                Загрузка...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                Товары не найдены
              </div>
            ) : (
              <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product, index) => {
                  const primaryImage = getPrimaryImage(product);

                  return (
                    <div
                      key={product.id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      onClick={() => handleProductClick(product)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="pt-1"
                          onClick={(e) => handleRowSelect(product.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRows.has(product.id)}
                            onChange={(e) => handleRowSelect(product.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </div>

                        <img
                          src={primaryImage?.image_url || noImage}
                          alt={product.name || "Товар"}
                          className="warehouse-table__product-image h-12 w-12 flex-none rounded-xl border border-slate-200 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = noImage;
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500">
                            #{getRowNumber(index)}
                          </div>
                          <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
                            {product.name || "—"}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="whitespace-nowrap">
                              Код:{" "}
                              <span className="font-medium">
                                {product.code || "—"}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">
                              Арт:{" "}
                              <span className="font-medium">
                                {product.article || "—"}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">
                              Ед:{" "}
                              <span className="font-medium">
                                {product.unit || "—"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Цена продажи</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {formatPrice(product.price)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Скидка</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {formatPrice(product.discount_percent || 0)}%
                          </div>
                        </div>

                        <div className="col-span-2 rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Остатки</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {formatStock(product.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* Пагинация */}
        {count > (pageSize || filteredProducts.length || 0) && (
          <div className="warehouse-pagination">
            <button
              type="button"
              className="warehouse-pagination__btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading || !previous}
            >
              Назад
            </button>
            <span className="warehouse-pagination__info">
              Страница {currentPage} из {totalPages || 1} ({count} товаров)
            </span>
            <button
              type="button"
              className="warehouse-pagination__btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={
                loading || !next || (totalPages && currentPage >= totalPages)
              }
            >
              Вперед
            </button>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={filters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          brands={brands}
          categories={categories}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertModal
        open={showDeleteConfirmModal}
        type="warning"
        title="Подтверждение удаления"
        message={`Вы уверены, что хотите удалить выбранные ${
          selectedRows.size
        } ${
          selectedRows.size === 1
            ? "товар"
            : selectedRows.size < 5
            ? "товара"
            : "товаров"
        }? Это действие нельзя отменить.`}
        okText="Удалить"
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
};

export default Warehouse;
