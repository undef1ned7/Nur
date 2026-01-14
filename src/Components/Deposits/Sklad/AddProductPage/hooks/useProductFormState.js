import { useState, useCallback } from "react";
import {
  DEFAULT_VALUES,
  DEFAULT_NEW_ITEM_DATA,
  DEFAULT_MARKET_DATA,
} from "../constants";

/**
 * Хук для управления состоянием формы товара
 * Централизует управление всеми состояниями формы
 */
export const useProductFormState = (isEditMode = false) => {
  // Основные данные товара
  const [newItemData, setNewItemData] = useState({
    name: "",
    barcode: "",
    brand_name: "",
    category_name: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "",
    plu: "",
    scale_type: "",
  });

  // Данные для маркета
  const [marketData, setMarketData] = useState({
    code: "",
    article: "",
    unit: DEFAULT_VALUES.UNIT,
    isWeightProduct: false,
    isFractionalService: false,
    plu: "",
    height: DEFAULT_VALUES.HEIGHT,
    width: DEFAULT_VALUES.WIDTH,
    depth: DEFAULT_VALUES.DEPTH,
    weight: DEFAULT_VALUES.WEIGHT,
    description: "",
    country: "",
    purchasePrice: "",
    markup: DEFAULT_VALUES.MARKUP,
    discount: DEFAULT_VALUES.DISCOUNT,
    supplier: "",
    minStock: DEFAULT_VALUES.MIN_STOCK,
    expiryDate: "",
    kitProducts: [],
    kitSearchTerm: "",
    packagings: [],
  });

  // Тип товара
  const [itemType, setItemType] = useState("product");

  // Ошибки валидации
  const [fieldErrors, setFieldErrors] = useState({});

  // Мемоизированный обработчик изменения marketData
  const handleMarketDataChange = useCallback((field, value) => {
    setMarketData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Мемоизированный обработчик изменения newItemData
  const handleChange = useCallback((e) => {
    const { name, value, type } = e.target;
    setNewItemData((prevData) => ({
      ...prevData,
      [name]:
        type === "number" ? (value === "" ? "" : parseInt(value)) : value,
    }));
  }, []);

  // Сброс формы
  const resetForm = useCallback(() => {
    setNewItemData(DEFAULT_NEW_ITEM_DATA);
    setMarketData(DEFAULT_MARKET_DATA);
    setFieldErrors({});
  }, []);

  return {
    newItemData,
    setNewItemData,
    marketData,
    setMarketData,
    itemType,
    setItemType,
    fieldErrors,
    setFieldErrors,
    handleMarketDataChange,
    handleChange,
    resetForm,
  };
};

