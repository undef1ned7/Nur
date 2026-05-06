export const validateResErrors = (
  error,
  fallbackMessage = "Произошла ошибка",
) => {
  if (!error) return fallbackMessage;

  if (typeof error === "string") {
    return error.trim() || fallbackMessage;
  }

  const candidates = [
    error?.response?.data?.detail,
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.data?.detail,
    error?.data?.message,
    error?.detail,
    error?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
    if (Array.isArray(candidate) && candidate.length > 0) {
      const joined = candidate
        .map((item) => (typeof item === "string" ? item : ""))
        .filter(Boolean)
        .join(", ");
      if (joined) return joined;
    }
  }

  const objectCandidates = [error?.response?.data, error?.data, error];
  for (const obj of objectCandidates) {
    if (!obj || typeof obj !== "object") continue;
    const firstArray = Object.values(obj).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray) && firstArray.length > 0) {
      const first = firstArray[0];
      if (typeof first === "string" && first.trim()) {
        return first;
      }
    }
  }

  return fallbackMessage;
};
