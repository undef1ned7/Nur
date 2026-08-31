/**
 * Извлекает human-readable текст ошибки из тела ответа DRF (400 и др.).
 * @param {unknown} error
 * @returns {string|null}
 */
export function extractApiError(error) {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (typeof data === "object" && data !== null) {
    const detail = data.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    const messages = Object.values(data)
      .flat()
      .filter((item) => typeof item === "string" && item.trim());
    if (messages.length) return messages.join(" ");
  }
  return null;
}
