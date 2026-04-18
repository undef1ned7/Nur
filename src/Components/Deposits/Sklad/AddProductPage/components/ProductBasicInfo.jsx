import React from "react";

const HOTKEY_GROUP_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = `F${index + 1}`;
  return { value, label: value };
});

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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
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

        <div className="market-product-form__form-group col-span-full">
          <label className="market-product-form__label">
            Дополнительные штрихкоды
          </label>
          <textarea
            className="market-product-form__input market-product-form__textarea"
            rows={3}
            placeholder="По одному коду в строке (или через запятую)"
            value={marketData.alternateBarcodesText ?? ""}
            onChange={(e) =>
              handleMarketDataChange("alternateBarcodesText", e.target.value)
            }
          />
          <p className="market-product-form__hint">
            Учитываются при поиске на складе и сканировании на кассе. Не должны
            совпадать с основным штрихкодом.
          </p>
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

        <div className="market-product-form__form-group col-span-full xl:col-span-1">
          <label className="market-product-form__label">Горячая клавиша</label>
          <select
            className="market-product-form__input"
            value={marketData.hotkeyGroup || ""}
            onChange={(e) =>
              handleMarketDataChange("hotkeyGroup", e.target.value)
            }
          >
            <option value="">Без горячей клавиши</option>
            {HOTKEY_GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductBasicInfo);

