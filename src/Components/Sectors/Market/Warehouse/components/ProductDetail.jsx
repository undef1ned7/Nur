import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  X,
  Edit,
  Copy,
  Trash2,
  Calendar,
  Tag,
  Globe,
  Box,
  FileText,
} from "lucide-react";
import "../Warehouse.scss";
import MovementHistory from "./MovementHistory";
import api from "../../../../../api";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/main/products/${id}/`);
        setProduct(response.data);
      } catch (error) {
        console.error("Ошибка при загрузке товара:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  const handleEdit = () => {
    // Navigate to edit page or open edit modal
    console.log("Edit product");
  };

  const handleDuplicate = () => {
    // Duplicate product logic
    console.log("Duplicate product");
  };

  const handleDelete = () => {
    if (window.confirm("Вы уверены, что хотите удалить этот товар?")) {
      // Delete product logic
      console.log("Delete product");
    }
  };

  const formatPrice = (price) => {
    return parseFloat(price || 0).toFixed(2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const months = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  if (loading) {
    return <div className="product-detail-loading">Загрузка...</div>;
  }

  if (!product) {
    return <div className="product-detail-error">Товар не найден</div>;
  }

  return (
    <div className="product-detail">
      {/* Header */}
      <div className="product-detail__header">
        <button
          className="product-detail__close-btn"
          onClick={() => navigate(-1)}
        >
          <X size={20} />
        </button>
        <button className="product-detail__edit-btn" onClick={handleEdit}>
          <Edit size={16} />
          Редактировать
        </button>
        <button
          className="product-detail__duplicate-btn"
          onClick={handleDuplicate}
        >
          <Copy size={16} />
          Дублировать товар
        </button>
        <button className="product-detail__delete-btn" onClick={handleDelete}>
          <Trash2 size={16} />
          Удалить
        </button>
      </div>

      {/* Main Content */}
      <div className="product-detail__content">
        {/* Image Section */}
        <div className="product-detail__image-section">
          <div className="product-detail__image-placeholder">
            <div className="product-detail__image-icon">📦</div>
            <button className="product-detail__image-add-btn">+</button>
          </div>
        </div>

        {/* Product Info */}
        <div className="product-detail__info-section">
          <div className="product-detail__type-badge">товар</div>
          <h2 className="product-detail__name">{product.name || "—"}</h2>
          <div className="product-detail__details">
            <div className="product-detail__detail-item">
              <span className="product-detail__detail-label">Штрих-код:</span>
              <span className="product-detail__detail-value">
                {product.barcode || "—"}
              </span>
            </div>
            <div className="product-detail__detail-item">
              <span className="product-detail__detail-label">Артикул:</span>
              <span className="product-detail__detail-value">
                {product.article || "—"}
              </span>
            </div>
            <div className="product-detail__detail-item">
              <span className="product-detail__detail-label">Код товара:</span>
              <span className="product-detail__detail-value">
                {product.code || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="product-detail__tabs">
          <button
            className={`product-detail__tab ${
              activeTab === "info" ? "product-detail__tab--active" : ""
            }`}
            onClick={() => setActiveTab("info")}
          >
            Информация
          </button>
          <button
            className={`product-detail__tab ${
              activeTab === "history" ? "product-detail__tab--active" : ""
            }`}
            onClick={() => setActiveTab("history")}
          >
            История движения
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "info" ? (
          <div className="product-detail__tab-content">
            {/* Information Section */}
            <div className="product-detail__section">
              <h3 className="product-detail__section-title">Информация</h3>
              <div className="product-detail__info-list">
                <div className="product-detail__info-item">
                  <Calendar className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Создан:</span>
                  <span className="product-detail__info-value">
                    {formatDate(product.created_at)}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <Tag className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Категория:</span>
                  <span className="product-detail__info-value">
                    {product.category?.name || "—"}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <Globe className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Страна:</span>
                  <span className="product-detail__info-value">
                    {product.country || "—"}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <Calendar className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">
                    Срок годности:
                  </span>
                  <span className="product-detail__info-value">
                    {product.expiry_date
                      ? formatDate(product.expiry_date)
                      : "—"}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <Box className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Группа:</span>
                  <span className="product-detail__info-value">
                    {product.group || "Товары и услуги"}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <FileText className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Описание:</span>
                  <span className="product-detail__info-value">
                    {product.description || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Prices Section */}
            <div className="product-detail__section">
              <h3 className="product-detail__section-title">ЦЕНЫ</h3>
              <table className="product-detail__prices-table">
                <thead>
                  <tr>
                    <th>Цена продажи</th>
                    <th>Цена закупки</th>
                    <th>Себестоимость</th>
                    <th>Наценка</th>
                    <th>Маржинальность</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatPrice(product.price)} сом</td>
                    <td>{formatPrice(product.purchase_price)} сом</td>
                    <td>
                      {formatPrice(product.cost_price)} сом
                      <span className="product-detail__help-icon">?</span>
                    </td>
                    <td>
                      {product.purchase_price
                        ? `${Math.round(
                            ((product.price - product.purchase_price) /
                              product.purchase_price) *
                              100
                          )}%`
                        : "—"}
                    </td>
                    <td>
                      {product.price
                        ? `${Math.round(
                            ((product.price -
                              (product.cost_price ||
                                product.purchase_price ||
                                0)) /
                              product.price) *
                              100
                          )}%`
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warehouse Section */}
            <div className="product-detail__section">
              <h3 className="product-detail__section-title">СКЛАД</h3>
              <table className="product-detail__warehouse-table">
                <thead>
                  <tr>
                    <th>Магазин</th>
                    <th>Цена продажи, сом</th>
                    <th>Остаток, шт</th>
                    <th>По себестоимости, сом</th>
                    <th>По цене продажи, сом</th>
                  </tr>
                </thead>
                <tbody>
                  {product.warehouses?.map((warehouse, index) => (
                    <tr key={index}>
                      <td>{warehouse.name || "—"}</td>
                      <td>{formatPrice(warehouse.price || product.price)}</td>
                      <td>
                        {warehouse.stock !== null &&
                        warehouse.stock !== undefined
                          ? warehouse.stock
                              .toString()
                              .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                          : "—"}
                      </td>
                      <td>
                        {formatPrice(
                          (warehouse.cost_price || product.cost_price || 0) *
                            (warehouse.stock || 0)
                        )}
                      </td>
                      <td>
                        {formatPrice(
                          (warehouse.price || product.price) *
                            (warehouse.stock || 0)
                        )}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={5}>Нет данных о складах</td>
                    </tr>
                  )}
                  <tr className="product-detail__warehouse-total">
                    <td>Итог</td>
                    <td>—</td>
                    <td>
                      {product.total_stock !== null &&
                      product.total_stock !== undefined
                        ? product.total_stock
                            .toString()
                            .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                        : "—"}
                    </td>
                    <td>{formatPrice(product.total_cost || 0)}</td>
                    <td>{formatPrice(product.total_value || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <MovementHistory productId={id} productCode={product.code} />
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
