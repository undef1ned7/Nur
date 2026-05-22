const AXIOS_STATUS_MESSAGE = /^Request failed with status code \d+$/i;
const GENERIC_ERROR_MESSAGE = /^(Rejected|Aborted)$/i;

const isAxiosError = (error) =>
  error?.isAxiosError === true ||
  (error?.config != null && typeof error?.response !== "undefined");

/** Тело ошибки API из axios или из Promise.reject(response.data) */
export const getApiErrorPayload = (error) => {
  if (error == null) return null;
  if (typeof error === "string") return error;
  if (error?.response?.data != null) return error.response.data;
  if (typeof error === "object" && !isAxiosError(error)) {
    return error;
  }
  const msg = error?.message;
  return typeof msg === "string" ? msg : null;
};

const isGenericMessage = (message) => {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return true;
  return (
    AXIOS_STATUS_MESSAGE.test(trimmed) || GENERIC_ERROR_MESSAGE.test(trimmed)
  );
};

const formatCandidate = (candidate) => {
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  if (Array.isArray(candidate) && candidate.length > 0) {
    const joined = candidate
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return (
            item.message ||
            item.msg ||
            item.detail ||
            (typeof item.toString === "function" ? String(item) : "")
          );
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
    if (joined) return joined;
  }
  if (candidate && typeof candidate === "object") {
    const nested = formatCandidate(
      candidate.detail ?? candidate.message ?? candidate.error,
    );
    if (nested) return nested;
  }
  return null;
};

const extractFromResponseData = (data) => {
  if (!data) return null;
  if (typeof data === "string" && data.trim()) {
    const trimmed = data.trim();
    return isGenericMessage(trimmed) ? null : trimmed;
  }

  if (typeof data !== "object") return null;

  for (const key of ["detail", "message", "error", "errors"]) {
    const parsed = formatCandidate(data[key]);
    if (parsed) return parsed;
  }

  const nonField = formatCandidate(data.non_field_errors);
  if (nonField) return nonField;

  const fieldMessages = [];
  const skipKeys = new Set([
    "detail",
    "message",
    "error",
    "errors",
    "non_field_errors",
    "name",
    "stack",
    "code",
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (skipKeys.has(key)) continue;
    const parsed = formatCandidate(value);
    if (parsed) {
      fieldMessages.push(parsed);
    }
  }

  if (fieldMessages.length > 0) {
    return fieldMessages.join("; ");
  }

  return null;
};

export const validateResErrors = (
  error,
  fallbackMessage = "Произошла ошибка",
) => {
  if (!error) return fallbackMessage;

  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed && !isGenericMessage(trimmed)) return trimmed;
    return fallbackMessage;
  }

  const payload = getApiErrorPayload(error);

  const fromAxios = extractFromResponseData(error?.response?.data);
  if (fromAxios) return fromAxios;

  const fromPayload = extractFromResponseData(payload);
  if (fromPayload) return fromPayload;

  const genericMessage =
    typeof error?.message === "string" ? error.message.trim() : "";
  if (genericMessage && !isGenericMessage(genericMessage)) {
    return genericMessage;
  }

  return fallbackMessage;
};
