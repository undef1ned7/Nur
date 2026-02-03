
export const validateResErrors = (err, fallbackText = "Произошла ошибка") => {
  const data =
    err?.data ??
    err?.response?.data ??
    err?.payload?.data ??
    err?.payload ??
    err;

  // 0) Если это просто строка
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  // 1) Полевые/валидационные ошибки: { phone: ["..."], other: ["..."] }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const messages = [];

    // DRF: non_field_errors
    const nonField = data.non_field_errors;
    if (Array.isArray(nonField)) {
      nonField.forEach((m) => m && messages.push(String(m)));
    } else if (typeof nonField === "string" && nonField.trim()) {
      messages.push(nonField.trim());
    }

    Object.entries(data).forEach(([key, value]) => {
      if (key === "detail" || key === "message" || key === "non_field_errors") {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((m) => m && messages.push(String(m)));
      } else if (typeof value === "string" && value.trim()) {
        messages.push(value.trim());
      }
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

