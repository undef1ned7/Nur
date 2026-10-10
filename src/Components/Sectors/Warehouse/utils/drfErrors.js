// Разбор ошибок DRF вида {field: ["msg"], non_field_errors: [...], detail: "..."}
// на ошибки по полям формы и общее сообщение.

const toText = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return toText(value.message ?? value.detail ?? Object.values(value));
  }
  return String(value);
};

/**
 * @param {unknown} payload — тело ответа (rejectWithValue(error.response.data)) или axios-ошибка
 * @param {string[]} fields — поля формы, которые нужно выделить отдельно
 * @returns {{ fieldErrors: Record<string,string>, message: string }}
 */
export const parseDrfErrors = (payload, fields = []) => {
  const data = payload?.response?.data ?? payload;
  const fieldErrors = {};
  if (data == null) return { fieldErrors, message: "" };
  if (typeof data === "string") return { fieldErrors, message: data.trim() };
  if (typeof data !== "object" || Array.isArray(data)) {
    return { fieldErrors, message: toText(data) };
  }

  const rest = [];
  Object.entries(data).forEach(([key, value]) => {
    const text = toText(value);
    if (!text) return;
    if (fields.includes(key)) {
      fieldErrors[key] = text;
    } else if (key !== "status_code" && key !== "code") {
      rest.push(text);
    }
  });

  return { fieldErrors, message: rest.join("\n") };
};
