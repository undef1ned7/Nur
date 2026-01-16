/**
 * Утилиты для работы со штрих-кодами
 */

/**
 * Вычисляет контрольную сумму EAN-13
 * @param {string} digits - 12 цифр штрих-кода
 * @returns {number} Контрольная сумма
 */
export const calculateEAN13Checksum = (digits) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i]);
    // Нечетные позиции (1, 3, 5, 7, 9, 11) умножаем на 1
    // Четные позиции (2, 4, 6, 8, 10, 12) умножаем на 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return checksum;
};

/**
 * Генерирует EAN-13 штрих-код
 * @returns {string} Полный EAN-13 код (13 цифр)
 */
export const generateEAN13Barcode = () => {
  // Генерируем 12 случайных цифр
  const randomDigits = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");

  // Вычисляем контрольную сумму
  const checksum = calculateEAN13Checksum(randomDigits);

  // Формируем полный EAN-13 код (12 цифр + контрольная сумма)
  return randomDigits + checksum;
};

