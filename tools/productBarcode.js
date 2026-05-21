const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

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

  const nestedCandidates = [
    product?.alternate_barcodes,
    product?.barcodes,
    product?.codes,
  ];
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

const digitsOnly = (raw) => String(raw ?? "").replace(/\D/g, "");

const normalizeEan13Digits = (digits) => {
  if (digits.length === 13) return digits;
  if (digits.length !== 12) return "";
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const d = Number(digits[i] || 0);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return digits + String(check);
};

const normalizeEan8Digits = (digits) => {
  if (digits.length === 8) return digits;
  if (digits.length !== 7) return "";
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = Number(digits[i] || 0);
    sum += (i % 2 === 0 ? 3 : 1) * d;
  }
  const check = (10 - (sum % 10)) % 10;
  return digits + String(check);
};

/**
 * Формат печати штрих-кода (принтер / JsBarcode).
 * CODE128 сохраняет ведущие нули; EAN-13 при сканировании часто отдаёт 12 цифр без первой «0».
 * @returns {{ code: string, format: "EAN13" | "EAN8" | "CODE128" }}
 */
export function getBarcodePrintEncoding(raw) {
  const digits = digitsOnly(raw);
  if (!digits) {
    throw new Error("Пустой штрих-код");
  }

  if (/^0/.test(digits)) {
    if (digits.length <= 32) {
      return { code: digits, format: "CODE128" };
    }
    throw new Error(
      `Штрих-код слишком длинный (макс. 32 символа для CODE128). Сейчас: ${digits.length} цифр.`,
    );
  }

  if (digits.length === 12 || digits.length === 13) {
    const code = normalizeEan13Digits(digits);
    if (code) return { code, format: "EAN13" };
  }

  if (digits.length === 7 || digits.length === 8) {
    const code = normalizeEan8Digits(digits);
    if (code) return { code, format: "EAN8" };
  }

  if (digits.length === 10 || digits.length === 11) {
    const padded = digits.padStart(12, "0");
    const code = normalizeEan13Digits(padded);
    if (code) return { code, format: "EAN13" };
  }

  if (digits.length >= 1 && digits.length <= 32) {
    return { code: digits, format: "CODE128" };
  }

  throw new Error(
    `Штрих-код слишком длинный (макс. 32 символа для CODE128). Сейчас: ${digits.length} цифр.`,
  );
};
