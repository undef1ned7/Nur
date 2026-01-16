import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Edit, Copy, Trash2, ArrowLeftRight, Calendar, Tag, Globe, Box, FileText } from "lucide-react";
import "../../Market/Warehouse/Warehouse.scss";
import api from "../../../../api";
import noImage from "../../Market/Warehouse/components/placeholder.png";
import AlertModal from "../../../common/AlertModal/AlertModal";
import WarehouseMoveProductModal from "./WarehouseMoveProductModal";

const WarehouseProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/warehouse/products/${id}/`);
      setProduct(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Ошибка при загрузке товара склада:", error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Изображения
  const imagesList = Array.isArray(product?.images) ? product.images : [];
  const hasImages = imagesList.length > 0;

  useEffect(() => {
    if (hasImages) {
      const primaryIndex = imagesList.findIndex((img) => img.is_primary);
      setCurrentImageIndex(primaryIndex >= 0 ? primaryIndex : 0);
    } else {
      setCurrentImageIndex(0);
    }
  }, [hasImages, product?.images]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imagesList.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imagesList.length) % imagesList.length);
  };

  const handleEdit = () => {
    const warehouseId = product?.warehouse || product?.warehouse_id || "";
    const qs = warehouseId ? `?warehouse_id=${warehouseId}` : "";
    navigate(`/crm/warehouse/stocks/add-product/${id}${qs}`);
  };

  const handleDuplicate = () => {
    const warehouseId = product?.warehouse || product?.warehouse_id || "";
    const qs = warehouseId ? `?warehouse_id=${warehouseId}` : "";
    navigate(`/crm/warehouse/stocks/add-product${qs}`, {
      state: { duplicate: true, productData: product },
    });
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/warehouse/products/${id}/`);
      setShowDeleteConfirm(false);
      navigate(-1);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Ошибка при удалении товара склада:", error);
      setShowDeleteConfirm(false);
      alert(
        "Ошибка при удалении товара: " +
          (error?.response?.data?.detail || error?.message || JSON.stringify(error))
      );
    }
  };

  const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";
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

  if (loading) return <div className="product-detail-loading">Загрузка...</div>;
  if (!product) return <div className="product-detail-error">Товар не найден</div>;

  return (
    <div className="product-detail">
      <div className="product-detail__header flex-wrap">
        <button className="product-detail__close-btn" onClick={() => navigate(-1)}>
          <X size={20} />
        </button>

        <button className="product-detail__edit-btn" onClick={handleEdit}>
          <Edit size={16} />
          Редактировать
        </button>

        <button className="product-detail__duplicate-btn" onClick={handleDuplicate}>
          <Copy size={16} />
          Дублировать товар
        </button>

        <button
          className="product-detail__duplicate-btn"
          onClick={() => setShowMoveModal(true)}
          type="button"
        >
          <ArrowLeftRight size={16} />
          Переместить
        </button>

        <button className="product-detail__delete-btn" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={16} />
          Удалить
        </button>
      </div>

      <div className="product-detail__content">
        <div className="block lg:flex gap-3">
          <div className="product-detail__image-section w-1/2">
            {hasImages ? (
              <>
                <div className="product-detail__main-image ">
                  <img
                    src={imagesList[currentImageIndex]?.image_url || imagesList[currentImageIndex]?.image}
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
                    <div className="product-detail__image-primary-badge">Главное</div>
                  )}
                </div>
                {imagesList.length > 1 && (
                  <div className="product-detail__image-thumbnails">
                    {imagesList.map((image, index) => (
                      <div
                        key={image.id || index}
                        className={`product-detail__thumbnail ${
                          index === currentImageIndex ? "product-detail__thumbnail--active" : ""
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      >
                        <img src={image.image_url || image.image} alt={`${product.name} ${index + 1}`} />
                        {image.is_primary && (
                          <div className="product-detail__thumbnail-badge">★</div>
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

          <div className="product-detail__info-section w-1/2">
            <div className="product-detail__type-badge">товар</div>
            <h2 className="product-detail__name">{product.name || "—"}</h2>
            <div className="product-detail__details">
              <div className="product-detail__detail-item">
                <span className="product-detail__detail-label">Штрих-код:</span>
                <span className="product-detail__detail-value">{product.barcode || "—"}</span>
              </div>
              <div className="product-detail__detail-item">
                <span className="product-detail__detail-label">Артикул:</span>
                <span className="product-detail__detail-value">{product.article || "—"}</span>
              </div>
              <div className="product-detail__detail-item">
                <span className="product-detail__detail-label">Код товара:</span>
                <span className="product-detail__detail-value">{product.code || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="product-detail__tabs">
          <button
            className={`product-detail__tab ${activeTab === "info" ? "product-detail__tab--active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            Информация
          </button>
        </div>

        {activeTab === "info" && (
          <div className="product-detail__tab-content">
            <div className="product-detail__section">
              <h3 className="product-detail__section-title">Информация</h3>
              <div className="product-detail__info-list">
                <div className="product-detail__info-item">
                  <Calendar className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Создан:</span>
                  <span className="product-detail__info-value">{formatDate(product.created_at)}</span>
                </div>
                <div className="product-detail__info-item">
                  <Tag className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Категория:</span>
                  <span className="product-detail__info-value">
                    {product.category_name || product.category || "—"}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <Globe className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Страна:</span>
                  <span className="product-detail__info-value">{product.country || "—"}</span>
                </div>
                <div className="product-detail__info-item">
                  <Calendar className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Срок годности:</span>
                  <span className="product-detail__info-value">
                    {product.expiration_date ? formatDate(product.expiration_date) : "—"}
                  </span>
                </div>
                <div className="product-detail__info-item">
                  <Box className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Группа:</span>
                  <span className="product-detail__info-value">{product.group || "Товары и услуги"}</span>
                </div>
                <div className="product-detail__info-item">
                  <FileText className="product-detail__info-icon" size={18} />
                  <span className="product-detail__info-label">Описание:</span>
                  <span className="product-detail__info-value">{product.description || "—"}</span>
                </div>
              </div>
            </div>

            <div className="product-detail__section">
              <h3 className="product-detail__section-title">ЦЕНЫ</h3>
              <table className="product-detail__prices-table overflow-auto">
                <thead>
                  <tr>
                    <th>Цена продажи</th>
                    <th>Цена закупки</th>
                    <th>Наценка</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatPrice(product.price)} сом</td>
                    <td>{formatPrice(product.purchase_price)} сом</td>
                    <td>{product.markup_percent ?? "—"}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AlertModal
        open={showDeleteConfirm}
        type="warning"
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить."
        okText="Удалить"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
      />

      <WarehouseMoveProductModal
        open={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        product={product}
        onMoved={fetchProduct}
      />
    </div>
  );
};

export default WarehouseProductDetail;


