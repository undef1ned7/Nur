import React, { useMemo, useCallback } from "react";
import { GripVertical } from "lucide-react";
import { formatPrice, formatStock, getPrimaryImage } from "../utils";
import noImage from "./placeholder.png";
import "./ProductTable.scss";

/**
 * Мемоизированный компонент строки таблицы
 */
const ProductRow = React.memo(
  ({
    product,
    primaryImage,
    isSelected,
    rowNumber,
    onRowSelect,
    onProductClick,
    enableDrag,
    onProductDragStart,
  }) => {
    return (
      <tr
        className="warehouse-table__row"
        onClick={() => onProductClick(product)}
      >
        <td onClick={(e) => onRowSelect(product.id, e)}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(product.id, e)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>

        <td>{rowNumber}</td>

        <td className="warehouse-table__name">
          <div className="warehouse-table__name-cell">
            {enableDrag && onProductDragStart && (
              <button
                type="button"
                className="warehouse-drag-handle"
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
                <GripVertical size={16} />
              </button>
            )}
            <img
              src={primaryImage?.image_url || noImage}
              alt={product.name || "Товар"}
              className="warehouse-table__product-image"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.src = noImage;
              }}

            />
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
    );
  },
  (prevProps, nextProps) => {
    // Кастомное сравнение для оптимизации ререндеров
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber &&
      prevProps.primaryImage?.image_url === nextProps.primaryImage?.image_url &&
      prevProps.enableDrag === nextProps.enableDrag &&
      prevProps.onProductDragStart === nextProps.onProductDragStart
    );
  }
);

ProductRow.displayName = "ProductRow";

/**
 * Компонент таблицы товаров
 */
const ProductTable = ({
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
}) => {
  // Мемоизация вычислений для всех товаров (критическая оптимизация)
  const primaryImagesMap = useMemo(() => {
    const map = new Map();
    products.forEach(product => {
      map.set(product.id, getPrimaryImage(product));
    });
    return map;
  }, [products]);

  const rowNumbers = useMemo(() => {
    return products.map((_, index) => getRowNumber(index, products.length));
  }, [products, getRowNumber]);

  const isSelected = useCallback((id) => {
    return selectedRows.has(id);
  }, [selectedRows]);

  // Показываем старые данные во время загрузки (оптимистичное обновление)
  // Только если данных нет вообще - показываем загрузку
  if (loading && products.length === 0) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[1100px]">
          <tbody>
            <tr>
              <td colSpan={9} className="warehouse-table__loading">
                Загрузка...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (products.length === 0 && !loading) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[1100px]">
          <tbody>
            <tr>
              <td colSpan={9} className="warehouse-table__empty">
                Товары не найдены
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative">
      {loading && products.length > 0 && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-sm text-slate-600">Загрузка...</div>
        </div>
      )}
      <table className="warehouse-table w-full min-w-[1100px]">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onSelectAll}
                disabled={loading}
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
          {products.map((productData, index) => (
            <ProductRow
              key={productData.id}
              product={productData}
              primaryImage={primaryImagesMap.get(productData.id)}
              isSelected={isSelected(productData.id)}
              rowNumber={rowNumbers[index]}
              onRowSelect={onRowSelect}
              onProductClick={onProductClick}
              enableDrag={enableDrag}
              onProductDragStart={onProductDragStart}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Оптимизированное сравнение для React.memo
const areEqual = (prevProps, nextProps) => {
  // Быстрые проверки сначала
  if (
    prevProps.loading !== nextProps.loading ||
    prevProps.isAllSelected !== nextProps.isAllSelected ||
    prevProps.selectedRows.size !== nextProps.selectedRows.size ||
    prevProps.getRowNumber !== nextProps.getRowNumber ||
    prevProps.enableDrag !== nextProps.enableDrag ||
    prevProps.onProductDragStart !== nextProps.onProductDragStart
  ) {
    return false;
  }

  // Проверка длины массива (O(1))
  if (prevProps.products.length !== nextProps.products.length) {
    return false;
  }

  // Если массивы одинаковые по ссылке - пропускаем проверку
  if (prevProps.products === nextProps.products) {
    return true;
  }

  // При смене страницы данные всегда должны обновляться
  // Проверяем только первые элементы - если они разные, значит это новая страница
  if (prevProps.products.length > 0 && nextProps.products.length > 0) {
    if (prevProps.products[0]?.id !== nextProps.products[0]?.id) {
      return false; // Разные данные - нужно обновить
    }
  }

  // Если первые элементы совпадают и длина совпадает, считаем что данные не изменились
  // Это оптимизация для случая, когда меняется только selectedRows или другие пропсы
  return true;
};

export default React.memo(ProductTable, areEqual);

