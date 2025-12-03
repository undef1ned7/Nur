import React from "react";
import ProductCard from "../ProductCard/ProductCard";
import "./ProductsGrid.scss";

const ProductsGrid = ({
  products,
  viewMode,
  onViewProduct,
  onDragStart,
  onDragEnd,
  draggedItem,
  onRequestProduct,
  onClearSearch,
}) => {
  return (
    <div className={`products-container ${viewMode}`}>
      <div style={{ margin: "8px 0", opacity: 0.8 }}>
        Найдено: {products?.length || 0} товаров
      </div>

      {!products || products.length === 0 ? (
        <div className="empty-state">
          <p>Товары не найдены</p>
          {onClearSearch && (
            <button onClick={onClearSearch}>Показать все товары</button>
          )}
        </div>
      ) : (
        <div className={`products-grid ${viewMode}`}>
          {products.map((product) => (
            <div key={product.id} className="grid-item">
              <ProductCard
                product={product}
                onView={onViewProduct}
                onDragStart={(e) => onDragStart(e, product.id)}
                onDragEnd={onDragEnd}
                isDragging={draggedItem === product.id}
                onRequestProduct={onRequestProduct}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsGrid;
