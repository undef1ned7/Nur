// Утилиты форматирования для компонента Warehouse

/**
 * Убирает только нули после дробного разделителя: "10.500" → "10.5", "10.00" → "10"
 * @param {number|string} value - Значение для обработки
 * @returns {string} Значение без хвостовых нулей в дробной части
 */
const stripTrailingZeros = (value) => {
  const s = String(value);
  if (!/[.,]/.test(s)) return s;
  return s.replace(/0+$/, "").replace(/[.,]$/, "");
};

/**
 * Форматирует цену: до двух знаков после запятой, хвостовые нули убираются
 * @param {number|string} price - Цена для форматирования
 * @returns {string} Отформатированная цена
 */
export const formatPrice = (price) =>
  stripTrailingZeros(parseFloat(price || 0).toFixed(2));

/**
 * Форматирует остатки товара с разделителями тысяч, без хвостовых нулей в дробной части
 * @param {number|null|undefined} stock - Количество товара
 * @returns {string} Отформатированное количество или "—"
 */
export const formatStock = (stock) => {
  if (stock === null || stock === undefined) return "—";
  const trimmed = stripTrailingZeros(stock);
  const [intPart, decPart] = trimmed.split(/[.,]/);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${grouped}.${decPart}` : grouped;
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

