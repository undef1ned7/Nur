import { useState, useMemo } from "react";

/**
 * Хук для управления товарами в комплекте
 * @param {Array} products - Список всех товаров для поиска
 * @returns {Object} Состояние и методы для работы с комплектом
 */
export const useKitProducts = (products = []) => {
  const [kitProducts, setKitProducts] = useState([]);
  const [kitSearchTerm, setKitSearchTerm] = useState("");
  const [showKitSearch, setShowKitSearch] = useState(false);

  /**
   * Результаты поиска товаров для комплекта
   */
  const kitSearchResults = useMemo(() => {
    if (!kitSearchTerm.trim()) {
      return [];
    }
    return products
      .filter((p) =>
        p.name?.toLowerCase().includes(kitSearchTerm.toLowerCase())
      )
      .slice(0, 10);
  }, [kitSearchTerm, products]);

  /**
   * Обработка поиска товаров
   * @param {string} searchTerm - Поисковый запрос
   */
  const handleKitSearch = (searchTerm) => {
    setKitSearchTerm(searchTerm);
    setShowKitSearch(searchTerm.trim().length > 0);
  };

  /**
   * Добавляет товар в комплект
   * @param {Object} product - Товар для добавления
   */
  const addProductToKit = (product) => {
    if (!kitProducts.find((p) => p.id === product.id)) {
      setKitProducts((prev) => [...prev, { ...product, quantity: 1 }]);
    }
    setKitSearchTerm("");
    setShowKitSearch(false);
  };

  /**
   * Удаляет товар из комплекта
   * @param {string|number} productId - ID товара
   */
  const removeProductFromKit = (productId) => {
    setKitProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  /**
   * Обновляет количество товара в комплекте
   * @param {string|number} productId - ID товара
   * @param {number} quantity - Новое количество
   */
  const updateKitProductQuantity = (productId, quantity) => {
    setKitProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, quantity: parseFloat(quantity) || 1 }
          : p
      )
    );
  };

  /**
   * Пересчитывает стоимость комплекта
   * @returns {number} Общая стоимость комплекта
   */
  const recalculateKitPrice = () => {
    return kitProducts.reduce((sum, item) => {
      const itemPrice = parseFloat(item.price || item.purchase_price || 0);
      const itemQuantity = parseFloat(item.quantity || 1);
      return sum + itemPrice * itemQuantity;
    }, 0);
  };

  /**
   * Очищает комплект
   */
  const clearKit = () => {
    setKitProducts([]);
    setKitSearchTerm("");
    setShowKitSearch(false);
  };

  return {
    kitProducts,
    setKitProducts,
    kitSearchTerm,
    showKitSearch,
    setShowKitSearch,
    kitSearchResults,
    handleKitSearch,
    addProductToKit,
    removeProductFromKit,
    updateKitProductQuantity,
    recalculateKitPrice,
    clearKit,
  };
};

