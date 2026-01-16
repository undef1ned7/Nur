import React from "react";

/**
 * Компонент основной информации о товаре
 */
const ProductBasicInfo = ({
  newItemData,
  handleChange,
  marketData,
  handleMarketDataChange,
  generateBarcode,
  fieldErrors,
  itemType,
}) => {
  return (
    <div className="market-product-form__section">
      <h3 className="market-product-form__section-title">
        Основная информация
      </h3>

      <div className="market-product-form__form-group">
        <label className="market-product-form__label">Наименование *</label>
        <input
          type="text"
          name="name"
          placeholder="Введите наименование"
          className="market-product-form__input"
          value={newItemData.name}
          onChange={handleChange}
          required
        />
        {fieldErrors.name && (
          <p className="add-product-page__error">{fieldErrors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="market-product-form__form-group">
          <label className="market-product-form__label">
            {itemType === "service" ? "Код услуги" : "Код товара"}
          </label>
          <input
            type="text"
            className="market-product-form__input"
            value={marketData.code}
            readOnly
            placeholder="Генерируется автоматически"
          />
        </div>

        <div className="market-product-form__form-group">
          <label className="market-product-form__label">
            Штрих-код{" "}
            <button
              type="button"
              className="market-product-form__generate-link"
              onClick={generateBarcode}
            >
              (Сгенерировать)
            </button>
          </label>
          <input
            type="text"
            name="barcode"
            placeholder="Введите штрих-код"
            className="market-product-form__input"
            value={newItemData.barcode}
            onChange={handleChange}
          />
          {fieldErrors.barcode && (
            <p className="add-product-page__error">{fieldErrors.barcode}</p>
          )}
        </div>

        <div className="market-product-form__form-group col-span-full xl:col-span-1">
          <label className="market-product-form__label">Артикул</label>
          <input
            type="text"
            placeholder="Введите артикул"
            className="market-product-form__input"
            value={marketData.article}
            onChange={(e) =>
              handleMarketDataChange("article", e.target.value)
            }
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductBasicInfo);

