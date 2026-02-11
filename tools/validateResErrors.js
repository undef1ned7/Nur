
export const validateResErrors = (err, fallbackText = "Произошла ошибка") => {
  const data =
    err?.data ??
    err?.response?.data ??
    err?.payload?.data ??
    err?.payload ??
    err;

  const messages = [];
  const pushMsg = (m) => {
    if (m == null) return;
    const s = String(m).trim();
    if (!s) return;
    messages.push(s);
  };

  // Рекурсивно собираем сообщения из вложенных структур:
  // { ingredients: [ {}, { amount: ["..."] } ] }
  const collectMessagesDeep = (value, depth = 0) => {
    if (value == null) return;
    if (depth > 12) return; // защита от слишком глубоких/цикличных структур

    if (typeof value === "string") {
      pushMsg(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((v) => collectMessagesDeep(v, depth + 1));
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => {
        // эти ключи обрабатываются отдельно (чтобы не было дублей)
        if (k === "detail" || k === "message" || k === "non_field_errors") {
          return;
        }
        collectMessagesDeep(v, depth + 1);
      });
    }
  };

  // 0) Если это просто строка
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  // 0.1) Иногда сервер возвращает массив ошибок
  if (Array.isArray(data)) {
    collectMessagesDeep(data);
    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  // 1) Полевые/валидационные ошибки: { phone: ["..."], other: ["..."] }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    // DRF: non_field_errors
    const nonField = data.non_field_errors;
    if (Array.isArray(nonField)) {
      nonField.forEach((m) => pushMsg(m));
    } else if (typeof nonField === "string" && nonField.trim()) {
      pushMsg(nonField);
    }

    Object.entries(data).forEach(([key, value]) => {
      if (key === "detail" || key === "message" || key === "non_field_errors") {
        return;
      }
      // Поддержка вложенных ошибок вида:
      // { ingredients: [ {}, { amount: ["..."] } ] }
      collectMessagesDeep(value);
    });

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  // 2) detail
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  if (Array.isArray(detail) && detail.length) {
    return detail.map((x) => String(x)).join("\n");
  }

  // 3) message
  const msg = data?.message ?? err?.message;
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim();
  }

  // 4) fallback
  return String(fallbackText || "Произошла ошибка");
};

