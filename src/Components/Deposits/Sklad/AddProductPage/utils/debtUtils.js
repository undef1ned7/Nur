/**
 * Утилиты для работы с долгами
 */
import api from "../../../../../api";

/**
 * Создает долг через API
 * @param {Object} payload - Данные долга
 * @returns {Promise} Результат создания долга
 */
export const createDebt = async (payload) => {
  const res = await api.post("/main/debts/", payload);
  return res.data;
};

/**
 * Валидация данных долга
 * @param {Object} debtData - Данные долга
 * @param {Object} company - Информация о компании
 * @returns {Object} Объект с ошибками валидации
 */
export const validateDebtData = (debtData, company) => {
  const errors = {};

  if (debtData.debt === "Долги") {
    if (!debtData.debtMonths || Number(debtData.debtMonths) <= 0) {
      errors.debtMonths = "Введите корректный срок долга";
    }
    if (company?.subscription_plan?.name === "Старт") {
      if (!debtData.debtState?.dueDate) {
        errors.dueDate = "Выберите дату оплаты";
      }
      if (!debtData.debtState?.phone) {
        errors.phone = "Введите номер телефона поставщика";
      }
    }
  }

  if (debtData.debt === "Предоплата") {
    if (!debtData.amount || Number(debtData.amount) <= 0) {
      errors.amount = "Введите корректную сумму предоплаты";
    }
    const totalAmount =
      Number(debtData.purchasePrice) * Number(debtData.quantity);
    if (Number(debtData.amount) > totalAmount) {
      errors.amount = "Сумма предоплаты не может превышать общую сумму";
    }
    if (!debtData.debtMonths || Number(debtData.debtMonths) <= 0) {
      errors.debtMonths = "Введите корректный срок долга";
    }
  }

  return errors;
};

