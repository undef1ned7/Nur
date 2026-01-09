// Утилиты форматирования для компонента Warehouse

/**
 * Форматирует цену с двумя знаками после запятой
 * @param {number|string} price - Цена для форматирования
 * @returns {string} Отформатированная цена
 */
export const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

/**
 * Форматирует остатки товара с разделителями тысяч
 * @param {number|null|undefined} stock - Количество товара
 * @returns {string} Отформатированное количество или "—"
 */
export const formatStock = (stock) => {
  if (stock === null || stock === undefined) return "—";
  return stock.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

/**
 * Получает основное изображение товара
 * @param {Object} product - Объект товара
 * @returns {Object|null} Объект изображения или null
 */
export const getPrimaryImage = (product) => {
  if (!product?.images || !Array.isArray(product.images)) return null;
  const primaryImage = product.images.find((img) => img.is_primary);
  return primaryImage || product.images[0] || null;
};

/**
 * Форматирует сообщение для модального окна удаления
 * @param {number} count - Количество выбранных товаров
 * @returns {string} Отформатированное сообщение
 */
export const formatDeleteMessage = (count) => {
  const word = count === 1 ? "товар" : count < 5 ? "товара" : "товаров";
  return `Вы уверены, что хотите удалить выбранные ${count} ${word}? Это действие нельзя отменить.`;
};

