import React, { useMemo } from "react";
import { formatPrice, formatStock, getPrimaryImage } from "../utils";
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
  }) => {
    return (
      <div
        className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        onClick={() => onProductClick(product)}
      >
        <div className="flex items-start gap-3">
          <div className="pt-1" onClick={(e) => onRowSelect(product.id, e)}>
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
            className="warehouse-table__product-image h-12 w-12 flex-none rounded-xl border border-slate-200 object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = noImage;
            }}
          />

          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">#{rowNumber}</div>
            <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
              {product.name || "—"}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="whitespace-nowrap">
                Код:{" "}
                <span className="font-medium">{product.code || "—"}</span>
              </span>
              <span className="whitespace-nowrap">
                Арт:{" "}
                <span className="font-medium">
                  {product.article || "—"}
                </span>
              </span>
              <span className="whitespace-nowrap">
                Ед:{" "}
                <span className="font-medium">{product.unit || "—"}</span>
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
  },
  (prevProps, nextProps) => {
    // Кастомное сравнение для оптимизации ререндеров
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber &&
      prevProps.primaryImage?.image_url === nextProps.primaryImage?.image_url
    );
  }
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
}) => {
  // Мемоизация вычислений для всех товаров (критическая оптимизация)
  const productsData = useMemo(() => {
    return products.map((product, index) => ({
      product,
      primaryImage: getPrimaryImage(product),
      isSelected: selectedRows.has(product.id),
      rowNumber: getRowNumber(index, products.length),
    }));
  }, [products, selectedRows, getRowNumber]);

  if (loading) {
    return (
      <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Загрузка...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Товары не найдены
      </div>
    );
  }

  return (
    <div className="block">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label
          className="flex items-center gap-2 text-sm text-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onSelectAll}
            className="h-4 w-4 rounded border-slate-300"
          />
          Выбрать все
        </label>

        <div className="text-sm text-slate-600">
          Выбрано: <span className="font-semibold">{selectedRows.size}</span>
        </div>
      </div>

      <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productsData.map((productData) => (
          <ProductCard
            key={productData.product.id}
            product={productData.product}
            primaryImage={productData.primaryImage}
            isSelected={productData.isSelected}
            rowNumber={productData.rowNumber}
            onRowSelect={onRowSelect}
            onProductClick={onProductClick}
          />
        ))}
      </div>
    </div>
  );
};

// Оптимизированное сравнение для React.memo
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.loading === nextProps.loading &&
    prevProps.isAllSelected === nextProps.isAllSelected &&
    prevProps.products.length === nextProps.products.length &&
    prevProps.selectedRows.size === nextProps.selectedRows.size &&
    prevProps.products.every(
      (p, i) => p.id === nextProps.products[i]?.id
    ) &&
    // Проверяем, что функции не изменились (они должны быть мемоизированы через useCallback)
    prevProps.getRowNumber === nextProps.getRowNumber
  );
};

export default React.memo(ProductCards, areEqual);

