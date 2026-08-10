import React, { useMemo } from "react";
import { GripVertical } from "lucide-react";
import { formatPrice, formatStock, getPrimaryImage } from "../utils";
import {
  SERVICE_STOCK_LABEL,
  isMarketWarehouseServiceProduct,
} from "../../../../../tools/marketWarehouseFilters";
import noImage from "./placeholder.png";
import "./ProductCards.scss";

/**
 * Мемоизированный компонент карточки товара
 */
const ProductCard = React.memo(
  ({
    product,
    primaryImage,
    isSelected,
    rowNumber,
    onRowSelect,
    onProductClick,
    enableDrag,
    onProductDragStart,
    isOutOfStock,
  }) => {
    const outOfStock = isOutOfStock?.(product) ?? false;
    return (
      <div
        className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
        onClick={() => onProductClick(product)}
      >
        <div className="warehouse-card__top">
          {enableDrag && onProductDragStart && (
            <button
              type="button"
              className="warehouse-drag-handle warehouse-drag-handle--card"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                onProductDragStart(product, e);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              title="Перетащить"
              aria-label="Перетащить"
            >
              <GripVertical size={18} />
            </button>
          )}
          <div className="pt-1 shrink-0" onClick={(e) => onRowSelect(product.id, e)}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onRowSelect(product.id, e)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>

          <img
            src={primaryImage?.image_url || noImage}
            alt={product.name || "Товар"}
            className="warehouse-table__product-image h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = noImage;
            }}
          />

          <div className="warehouse-card__body">
            <div className="text-xs text-slate-500">#{rowNumber}</div>
            <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
              {product.name || "—"}
            </div>

            <div className="warehouse-card__meta">
              <span className="warehouse-card__meta-item">
                Код:{" "}
                <span className="font-medium">{product.code || "—"}</span>
              </span>
              <span className="warehouse-card__meta-item">
                Арт:{" "}
                <span className="font-medium">{product.article || "—"}</span>
              </span>
              <span className="warehouse-card__meta-item">
                Ед:{" "}
                <span className="font-medium">{product.unit || "—"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="warehouse-card__metrics">
          <div className="warehouse-card__metric">
            <div className="warehouse-card__metric-label">Цена продажи</div>
            <div className="warehouse-card__metric-value">
              {formatPrice(product.price)}
            </div>
          </div>

          <div className="warehouse-card__metric">
            <div className="warehouse-card__metric-label">Скидка</div>
            <div className="warehouse-card__metric-value">
              {formatPrice(product.discount_percent || 0)}%
            </div>
          </div>

          <div className="warehouse-card__metric warehouse-card__metric--full">
            <div className="warehouse-card__metric-label">Остатки</div>
            <div
              className={`warehouse-card__metric-value ${outOfStock ? "text-red-600" : ""}`}
            >
              {isMarketWarehouseServiceProduct(product)
                ? SERVICE_STOCK_LABEL
                : formatStock(product.quantity)}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber &&
      prevProps.primaryImage?.image_url === nextProps.primaryImage?.image_url &&
      prevProps.enableDrag === nextProps.enableDrag &&
      prevProps.onProductDragStart === nextProps.onProductDragStart &&
      prevProps.isOutOfStock === nextProps.isOutOfStock
    );
  },
);

ProductCard.displayName = "ProductCard";

/**
 * Компонент карточек товаров
 */
const ProductCards = ({
  products,
  loading,
  selectedRows,
  isAllSelected,
  onRowSelect,
  onSelectAll,
  onProductClick,
  getRowNumber,
  enableDrag = false,
  onProductDragStart,
  isOutOfStock,
}) => {
  const selectedRowsSize = selectedRows.size;
  const productsData = useMemo(() => {
    return products.map((product, index) => ({
      product,
      primaryImage: getPrimaryImage(product),
      isSelected: selectedRows.has(String(product.id)),
      rowNumber: getRowNumber(index, products.length),
    }));
  }, [products, selectedRows, selectedRowsSize, getRowNumber]);

  if (loading && products.length === 0) {
    return (
      <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Загрузка...
      </div>
    );
  }

  if (products.length === 0 && !loading) {
    return (
      <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Товары не найдены
      </div>
    );
  }

  return (
    <div className="warehouse-cards relative">
      {loading && products.length > 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-sm">
          <div className="text-sm text-slate-600">Загрузка...</div>
        </div>
      )}
      <div className="warehouse-cards__toolbar">
        <label
          className="flex items-center gap-2 text-sm text-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onSelectAll}
            disabled={loading}
            className="h-4 w-4 rounded border-slate-300"
          />
          Выбрать все
        </label>

        <div className="text-sm text-slate-600">
          Выбрано: <span className="font-semibold">{selectedRows.size}</span>
        </div>
      </div>

      <div className="warehouse-cards__grid">
        {productsData.map((productData) => (
          <ProductCard
            key={productData.product.id}
            product={productData.product}
            primaryImage={productData.primaryImage}
            isSelected={productData.isSelected}
            rowNumber={productData.rowNumber}
            onRowSelect={onRowSelect}
            onProductClick={onProductClick}
            enableDrag={enableDrag}
            onProductDragStart={onProductDragStart}
            isOutOfStock={isOutOfStock}
          />
        ))}
      </div>
    </div>
  );
};

const areEqual = (prevProps, nextProps) => {
  if (
    prevProps.loading !== nextProps.loading ||
    prevProps.isAllSelected !== nextProps.isAllSelected ||
    prevProps.selectedRows.size !== nextProps.selectedRows.size ||
    prevProps.getRowNumber !== nextProps.getRowNumber ||
    prevProps.enableDrag !== nextProps.enableDrag ||
    prevProps.onProductDragStart !== nextProps.onProductDragStart ||
    prevProps.isOutOfStock !== nextProps.isOutOfStock
  ) {
    return false;
  }

  if (prevProps.products.length !== nextProps.products.length) {
    return false;
  }

  if (prevProps.products === nextProps.products) {
    return true;
  }

  if (prevProps.products.length > 0 && nextProps.products.length > 0) {
    if (prevProps.products[0]?.id !== nextProps.products[0]?.id) {
      return false;
    }
  }

  return true;
};

export default React.memo(ProductCards, areEqual);
