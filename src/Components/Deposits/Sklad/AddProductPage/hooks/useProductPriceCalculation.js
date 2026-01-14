import { useEffect, useState } from "react";

/**
 * Хук для автоматического расчета цены продажи на основе цены закупки и наценки
 * @param {Object} params - Параметры
 * @returns {Object} Состояние и методы
 */
export const useProductPriceCalculation = ({
  itemType,
  purchasePrice,
  markup,
  setPrice,
  setMarkup,
}) => {
  const [isPriceManuallyChanged, setIsPriceManuallyChanged] = useState(false);
  const [isMarkupManuallyChanged, setIsMarkupManuallyChanged] = useState(false);

  // Автоматический расчет цены продажи на основе цены закупки и наценки
  useEffect(() => {
    if (itemType === "product" && !isPriceManuallyChanged) {
      const purchasePriceValue = parseFloat(purchasePrice) || 0;
      const markupValue = parseFloat(markup) || 0;

      if (purchasePriceValue > 0 && markupValue >= 0) {
        const sellingPrice = purchasePriceValue * (1 + markupValue / 100);
        const calculatedPrice = Math.round(sellingPrice * 100) / 100;
        setPrice(calculatedPrice.toString());
      } else if (purchasePriceValue === 0 && markupValue === 0) {
        setPrice("");
      }
    }
  }, [purchasePrice, markup, itemType, isPriceManuallyChanged, setPrice]);

  // Сброс флага ручного изменения при изменении цены закупки или наценки
  useEffect(() => {
    if (itemType === "product") {
      setIsPriceManuallyChanged(false);
    }
  }, [purchasePrice, markup, itemType]);

  /**
   * Обработчик изменения цены продажи вручную
   * @param {string} value - Новое значение цены
   * @param {Function} setPriceCallback - Callback для установки цены
   */
  const handlePriceChange = (value, setPriceCallback) => {
    setIsPriceManuallyChanged(true);
    setPriceCallback(value);

    // Если пользователь сам НЕ трогал наценку, считаем её из цены закупки и цены продажи
    if (itemType === "product" && !isMarkupManuallyChanged) {
      const purchasePriceValue = parseFloat(purchasePrice) || 0;
      const sellingPrice = parseFloat(value) || 0;

      if (purchasePriceValue > 0 && sellingPrice > 0) {
        const markupPercent = (sellingPrice / purchasePriceValue - 1) * 100;
        const roundedMarkup = Math.round(markupPercent * 100) / 100;
        setMarkup(roundedMarkup.toString());
      }
    }
  };

  /**
   * Обработчик изменения наценки вручную
   * @param {string} value - Новое значение наценки
   * @param {Function} setMarkupCallback - Callback для установки наценки
   */
  const handleMarkupChange = (value, setMarkupCallback) => {
    setIsMarkupManuallyChanged(true);
    setMarkupCallback(value);
  };

  return {
    isPriceManuallyChanged,
    isMarkupManuallyChanged,
    handlePriceChange,
    handleMarkupChange,
  };
};

