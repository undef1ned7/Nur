const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const unwrapErrorData = (error) => {
  const responseData = asObject(error?.response?.data);
  if (responseData) return responseData;

  const serializedData = asObject(error?.data);
  if (serializedData) return serializedData;

  return asObject(error);
};

export const serializeApiError = (error) => {
  const data = unwrapErrorData(error);
  const status = error?.response?.status ?? error?.status ?? null;
  const message =
    data?.message ??
    data?.detail ??
    data?.error ??
    error?.message ??
    "Ошибка запроса";

  return {
    status,
    data,
    message: typeof message === "string" ? message : "Ошибка запроса",
  };
};

export const getBarcodeAmbiguity = (error) => {
  const data = unwrapErrorData(error);
  const status = error?.response?.status ?? error?.status ?? null;
  const rawMatches = Array.isArray(data?.matches) ? data.matches : [];
  const matches = rawMatches
    .map((match) => ({
      id: match?.id ?? match?.uuid ?? match?.product_id ?? null,
      name: String(match?.name ?? match?.product_name ?? "Товар").trim(),
    }))
    .filter((match) => match.id != null && String(match.id).trim());

  if (status !== 409 && data?.ambiguous !== true) return null;
  if (!matches.length) return null;

  return {
    ambiguous: true,
    message:
      String(
        data?.message ??
          data?.detail ??
          "Штрихкод найден у нескольких товаров — выберите нужный.",
      ).trim() ||
      "Штрихкод найден у нескольких товаров — выберите нужный.",
    matches,
  };
};
