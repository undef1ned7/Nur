import React from "react";
import { ITEM_TYPES } from "../constants";

/**
 * Компонент выбора типа товара (Товар/Услуга/Комплект)
 */
const ProductTypeSelector = ({ itemType, setItemType, isEditMode = false }) => {
  if (isEditMode) return null;

  return (
    <div className="market-product-form__type-selector">
      <button
        className={`market-product-form__type-card ${
          itemType === ITEM_TYPES.PRODUCT
            ? "market-product-form__type-card--active"
            : ""
        }`}
        onClick={() => setItemType(ITEM_TYPES.PRODUCT)}
      >
        <h3 className="text-center">Товар</h3>
        <p className="text-center">
          Продукт, имеющий остаток, который необходимо восполнять
        </p>
      </button>
      <button
        className={`market-product-form__type-card ${
          itemType === ITEM_TYPES.SERVICE
            ? "market-product-form__type-card--active"
            : ""
        }`}
        onClick={() => setItemType(ITEM_TYPES.SERVICE)}
      >
        <h3 className="text-center">Услуга</h3>
        <p className="text-center">Продукт, не имеющий остатка на складе</p>
      </button>
      <button
        className={`market-product-form__type-card ${
          itemType === ITEM_TYPES.KIT
            ? "market-product-form__type-card--active"
            : ""
        }`}
        onClick={() => setItemType(ITEM_TYPES.KIT)}
      >
        <h3 className="text-center">Комплект</h3>
        <p className="text-center">
          Продукт, состоящий из нескольких других
        </p>
      </button>
    </div>
  );
};

export default React.memo(ProductTypeSelector);

