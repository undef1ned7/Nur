/**
 * Validation Service
 * Модуль для валидации форм и данных продажи
 */

/**
 * Валидация формы клиента
 */
export function validateClientForm(form) {
  const errors = {};
  if (!form.full_name.trim()) {
    errors.full_name = "Это поле не может быть пустым.";
  }
  const ph = form.phone.trim();
  if (!ph) {
    errors.phone = "Это поле не может быть пустым.";
  } else if (!/^\+?\d[\d\s\-()]{5,}$/.test(ph)) {
    errors.phone = "Неверный формат телефона.";
  }
  return errors;
}

/**
 * Валидация долга
 */
export function validateDebt({
  debt,
  clientId,
  amount,
  debtMonths,
  total,
  state,
  company,
}) {
  const errors = [];

  if (!clientId) {
    errors.push("Выберите клиента");
  }

  if (debt === "Долги") {
    // Для долга: проверяем обязательные поля для тарифа "Старт"
    if (company?.subscription_plan?.name === "Старт") {
      if (!state?.phone) {
        errors.push("Введите номер телефона");
      }
      if (!state?.dueDate) {
        errors.push("Выберите дату оплаты");
      }
    }
    if (!debtMonths || Number(debtMonths) <= 0) {
      errors.push("Введите корректный срок долга");
    }
  } else if (debt === "Предоплата") {
    // Для предоплаты: проверяем сумму и срок
    if (!amount || Number(amount) <= 0) {
      errors.push("Введите корректную сумму предоплаты");
    } else if (total && Number(amount) > Number(total)) {
      errors.push("Сумма предоплаты не может превышать общую сумму");
    }
    if (!debtMonths || Number(debtMonths) <= 0) {
      errors.push("Введите корректный срок долга");
    }
  }

  return errors;
}

/**
 * Валидация оплаты наличными
 */
export function validateCashPayment(cashReceived, total) {
  const received = Number(cashReceived);
  const totalNum = Number(total);

  if (!cashReceived || received <= 0) {
    return "Введите сумму, полученную от покупателя";
  }
  if (received < totalNum) {
    return `Недостаточно средств. К оплате: ${totalNum.toFixed(2)} сом`;
  }
  return null;
}

/**
 * Валидация checkout
 */
export function validateCheckout({
  cashData,
  start,
  debt,
  clientId,
  state,
  company,
  amount,
  debtMonths,
  finalPaymentType,
  cashReceived,
  currentTotal,
}) {
  const errors = [];

  if (!cashData?.cashbox) {
    errors.push("Выберите кассу для проведения операции");
  }

  const itemsToCheck = start?.items;
  if (!itemsToCheck || itemsToCheck.length === 0) {
    errors.push("Добавьте товар для проведения операции");
  }

  if (debt && !clientId) {
    errors.push("Выберите клиента для долговой операции");
  }

  // Валидация долга
  if (debt) {
    const debtErrors = validateDebt({
      debt,
      clientId,
      amount,
      debtMonths,
      total: start?.total,
      state,
      company,
    });
    errors.push(...debtErrors);
  }

  // Валидация оплаты наличными
  if (finalPaymentType === "cash") {
    const cashError = validateCashPayment(cashReceived, currentTotal);
    if (cashError) {
      errors.push(cashError);
    }
  }

  return errors;
}
