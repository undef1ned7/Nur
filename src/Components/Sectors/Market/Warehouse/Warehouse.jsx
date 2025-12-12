import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Plus } from "lucide-react";
import "./Warehouse.scss";
import FilterModal from "./components/FilterModal";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import { useProducts } from "../../../../store/slices/productSlice";

const Warehouse = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: products, loading, count } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({});
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Загрузка товаров
  useEffect(() => {
    const params = {
      page: 1,
      search: searchTerm,
      ...filters,
    };
    dispatch(fetchProductsAsync(params));
  }, [dispatch, searchTerm, filters]);

  // Фильтрация товаров по поиску
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const search = searchTerm.toLowerCase();
    return products.filter(
      (product) =>
        product.name?.toLowerCase().includes(search) ||
        product.code?.toLowerCase().includes(search) ||
        product.barcode?.toLowerCase().includes(search)
    );
  }, [products, searchTerm]);

  const handleProductClick = (product) => {
    navigate(`/crm/market/warehouse/${product.id}`);
  };

  const handleRowSelect = (productId, e) => {
    e.stopPropagation();
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
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

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const formatPrice = (price) => {
    return parseFloat(price || 0).toFixed(2);
  };

  const formatStock = (stock) => {
    if (stock === null || stock === undefined) return "—";
    return stock.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
        <div className="warehouse-search__info">
          <span>
            Всего: {count || 0} • Найдено: {filteredProducts.length}
          </span>
          <button
            className="warehouse-search__filter-btn"
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={16} />
            Фильтры
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="warehouse-table-container">
        <table className="warehouse-table">
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
                  <td>{index + 1}</td>
                  <td className="warehouse-table__name">
                    {product.name || "—"}
                  </td>
                  <td>{product.code || "—"}</td>
                  <td>{product.article || "—"}</td>
                  <td>{product.unit || "—"}</td>
                  <td>{formatPrice(product.price)}</td>
                  <td>{formatPrice(product.discount || 0)}</td>
                  <td>{formatStock(product.stock)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={filters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
        />
      )}
    </div>
  );
};

export default Warehouse;
