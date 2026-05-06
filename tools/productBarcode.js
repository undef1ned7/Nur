const normalize = (value) => String(value ?? "").trim().toLowerCase();

const getBarcodeCandidates = (product) => {
  const set = new Set();

  const directKeys = [
    "barcode",
    "bar_code",
    "barcode_value",
    "article",
    "sku",
    "code",
  ];

  for (const key of directKeys) {
    const value = product?.[key];
    if (value != null && String(value).trim()) {
      set.add(String(value));
    }
  }

  const nestedCandidates = [product?.barcodes, product?.codes];
  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (entry == null) continue;
        if (typeof entry === "string" || typeof entry === "number") {
          set.add(String(entry));
        } else if (typeof entry === "object") {
          const nested = entry.value ?? entry.code ?? entry.barcode;
          if (nested != null && String(nested).trim()) {
            set.add(String(nested));
          }
        }
      }
    }
  }

  return Array.from(set);
};

export const productSearchHaystackLower = (product) => {
  const parts = [
    product?.name,
    product?.title,
    product?.barcode,
    product?.code,
    product?.article,
    product?.sku,
    ...(getBarcodeCandidates(product) || []),
  ];

  return parts
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const productMatchesBarcode = (product, rawQuery) => {
  const query = normalize(rawQuery);
  if (!query) return false;

  const barcodeCandidates = getBarcodeCandidates(product).map(normalize);
  if (barcodeCandidates.some((value) => value === query)) return true;

  const haystack = productSearchHaystackLower(product);
  return haystack.includes(query);
};

