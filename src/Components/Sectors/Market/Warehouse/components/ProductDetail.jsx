import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
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
  Plus,
  AlertTriangle,
} from "lucide-react";
import "../Warehouse.scss";
import MovementHistory from "./MovementHistory";
import api from "../../../../../api";
import noImage from "./placeholder.png";
import AddProductModal from "../../../../Deposits/Sklad/AddProduct/AddProductModal";
import MarriageModal from "../../../../Deposits/Sklad/MarriageModal";
import { deleteProductAsync } from "../../../../../store/creators/productCreators";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import { validateResErrors } from "../../../../../../tools/validateResErrors";
import {useAlert} from "@/hooks/useDialog";

const ProductDetail = () => {
  const { id } = useParams();
  const alert = useAlert();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/main/products/${id}/`);
      setProduct(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке товара:", error);
      const errorMessage = validateResErrors(error, "Ошибка при загрузке товара. ")
      alert(
        errorMessage,
        true
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const handleEdit = () => {
    navigate(`/crm/sklad/add-product/${id}`);
  };

  const handleDuplicate = () => {
    // Переходим на страницу создания товара с данными для дублирования
    navigate("/crm/sklad/add-product", {
      state: {
        duplicate: true,
        productData: product,
      },
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await dispatch(deleteProductAsync(product.id)).unwrap();
      setShowDeleteConfirm(false);
      navigate(-1); // Возвращаемся назад после удаления
    } catch (error) {
      console.error("Ошибка при удалении товара:", error);
      setShowDeleteConfirm(false);
      const errorMessage = validateResErrors(error, "Ошибка при удалении товара. ")
      alert(
        errorMessage,
        true
      );
    }
  };

  const handleDeleteConfirm = () => {
    navigate(-1); // Возвращаемся назад после удаления
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

  // Получаем список изображений
  const imagesList = Array.isArray(product?.images) ? product.images : [];
  const hasImages = imagesList.length > 0;

  // Находим индекс основного изображения или используем первое
  useEffect(() => {
    if (hasImages) {
      const primaryIndex = imagesList.findIndex((img) => img.is_primary);
      setCurrentImageIndex(primaryIndex >= 0 ? primaryIndex : 0);
    }
  }, [product?.images]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imagesList.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(
      (prev) => (prev - 1 + imagesList.length) % imagesList.length
    );
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
      <div className="product-detail__header flex-wrap">
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
        <button
          className="product-detail__add-btn"
          onClick={() => setShowAddProductModal(true)}
        >
          <Plus size={16} />
          Добавить
        </button>
        <button
          className="product-detail__marriage-btn"
          onClick={() => setShowMarriageModal(true)}
        >
          <AlertTriangle size={16} />
          Брак
        </button>
      </div>

      {/* Main Content */}
      <div className="product-detail__content">
        {/* Image Section */}
        <div className="block lg:flex gap-3">
          <div className="product-detail__image-section w-1/2">
            {hasImages ? (
              <>
                <div className="product-detail__main-image ">
                  <img
                    src={imagesList[currentImageIndex]?.image_url}
                    alt={product.name || "Товар"}
                    className="product-detail__image"
                  />
                  {imagesList.length > 1 && (
                    <>
                      <button
                        className="product-detail__image-nav product-detail__image-nav--prev"
                        onClick={prevImage}
                      >
                        ‹
                      </button>
                      <button
                        className="product-detail__image-nav product-detail__image-nav--next"
                        onClick={nextImage}
                      >
                        ›
                      </button>
                    </>
                  )}
                  {imagesList[currentImageIndex]?.is_primary && (
                    <div className="product-detail__image-primary-badge">
                      Главное
                    </div>
                  )}
                </div>
                {imagesList.length > 1 && (
                  <div className="product-detail__image-thumbnails">
                    {imagesList.map((image, index) => (
                      <div
                        key={image.id || index}
                        className={`product-detail__thumbnail ${
                          index === currentImageIndex
                            ? "product-detail__thumbnail--active"
                            : ""
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      >
                        <img
                          src={image.image_url}
                          alt={`${product.name} ${index + 1}`}
                        />
                        {image.is_primary && (
                          <div className="product-detail__thumbnail-badge">
                            ★
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="product-detail__image-placeholder w-full max-w-full lg:max-w-[400px]">
                <img
                  src={noImage}
                  alt="Нет изображения"
                  className="product-detail__placeholder-image"
                />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="product-detail__info-section w-1/2">
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
                <span className="product-detail__detail-label">
                  Код товара:
                </span>
                <span className="product-detail__detail-value">
                  {product.code || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {/* <div className="product-detail__tabs">
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
        </div> */}

        {/* Tab Content */}
        {/* {activeTab === "info" ? ( */}
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
                    {product.category || "—"}
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
                    {product.expiration_date
                      ? formatDate(product.expiration_date)
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
              <table className="product-detail__prices-table overflow-auto">
                <thead>
                  <tr>
                    <th>Цена продажи</th>
                    <th>Цена закупки</th>
                    {/* <th>Себестоимость</th> */}
                    <th>Наценка</th>
                    {/* <th>Маржинальность</th> */}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatPrice(product.price)} сом</td>
                    <td>{formatPrice(product.purchase_price)} сом</td>
                    {/* <td>
                      {formatPrice(product.purchase_price)} сом
                      <span className="product-detail__help-icon">?</span>
                    </td> */}
                    <td>{product.markup_percent}%</td>
                    {/* <td>
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
                    </td> */}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warehouse Section */}
            {/* <div className="product-detail__section">
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
            </div> */}
          </div>
        {/* ) : ( */}
          {/* <MovementHistory productId={id} productCode={product.code} /> */}
        {/* )} */}
      </div>

      {/* Модальные окна */}
      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onChanged={() => {
            fetchProduct();
            setShowAddProductModal(false);
          }}
          item={product}
        />
      )}

      {showMarriageModal && (
        <MarriageModal
          onClose={() => setShowMarriageModal(false)}
          onChanged={() => {
            fetchProduct();
            setShowMarriageModal(false);
          }}
          item={product}
        />
      )}

      {/* Модалка подтверждения удаления */}
      <AlertModal
        open={showDeleteConfirm}
        type="warning"
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить."
        okText="Удалить"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default ProductDetail;
