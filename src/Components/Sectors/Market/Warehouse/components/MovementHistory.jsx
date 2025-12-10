import React, { useState, useEffect } from "react";
import { Calendar, Filter, X } from "lucide-react";
import "../Warehouse.scss";
import api from "../../../../../api";

const MovementHistory = ({ productId, productCode }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    store: "",
    type: "",
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const params = {
          product: productId,
          ...filters,
        };
        const response = await api.get("/main/warehouse/history/", { params });
        setHistory(response.data.results || response.data || []);
      } catch (error) {
        console.error("Ошибка при загрузке истории:", error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchHistory();
    }
  }, [productId, filters]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const months = [
      "янв",
      "фев",
      "мар",
      "апр",
      "май",
      "июн",
      "июл",
      "авг",
      "сен",
      "окт",
      "ноя",
      "дек",
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatPrice = (price) => {
    return parseFloat(price || 0).toFixed(2);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilter = (field) => {
    setFilters((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  return (
    <div className="movement-history">
      <div className="movement-history__code">
        Код товара: {productCode || "—"}
      </div>

      {/* Filters */}
      <div className="movement-history__filters">
        <button className="movement-history__date-btn">
          <Calendar size={16} />
          дата {filters.dateFrom || "..."} — {filters.dateTo || "..."}
        </button>
        <div className="movement-history__filter-input">
          <input
            type="text"
            placeholder="магазин введи"
            value={filters.store}
            onChange={(e) => handleFilterChange("store", e.target.value)}
          />
          {filters.store && (
            <button
              className="movement-history__clear-btn"
              onClick={() => clearFilter("store")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="movement-history__filter-input">
          <input
            type="text"
            placeholder="тип введите"
            value={filters.type}
            onChange={(e) => handleFilterChange("type", e.target.value)}
          />
          {filters.type && (
            <button
              className="movement-history__clear-btn"
              onClick={() => clearFilter("type")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button className="movement-history__filter-btn">
          <Filter size={16} />
          Фильтр
        </button>
      </div>

      {/* History Table */}
      <div className="movement-history__table-container">
        <table className="movement-history__table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Документ</th>
              <th>Себестоимость</th>
              <th>Цена</th>
              <th>Приход</th>
              <th>Расход</th>
              <th>Остаток</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="movement-history__loading">
                  Загрузка...
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={7} className="movement-history__empty">
                  История движения не найдена
                </td>
              </tr>
            ) : (
              history.map((item, index) => (
                <tr key={item.id || index}>
                  <td>{formatDate(item.date)}</td>
                  <td>
                    <div className="movement-history__document">
                      <div className="movement-history__document-name">
                        {item.document_type} #{item.document_number}
                      </div>
                      {item.client_name && (
                        <div className="movement-history__document-client">
                          {item.client_name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{formatPrice(item.cost_price)}</td>
                  <td>{formatPrice(item.price)}</td>
                  <td>
                    {item.quantity_in > 0 ? formatNumber(item.quantity_in) : ""}
                  </td>
                  <td>
                    {item.quantity_out > 0
                      ? `-${formatNumber(item.quantity_out)}`
                      : ""}
                  </td>
                  <td>{formatNumber(item.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && history.length > 0 && (
        <div className="movement-history__footer">
          Всего документов: {history.length}
        </div>
      )}
    </div>
  );
};

export default MovementHistory;
