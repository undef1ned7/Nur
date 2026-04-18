/**
 * Совпадение отсканированного кода с основным или дополнительным штрихкодом товара (сфера Магазин).
 * @param {object} product
 * @param {string} scanned
 * @returns {boolean}
 */
export function productMatchesBarcode(product, scanned) {
  if (!product || scanned == null) return false;
  const code = String(scanned).trim();
  if (!code) return false;
  const main =
    product.barcode != null ? String(product.barcode).trim() : "";
  if (main && main === code) return true;
  const alts = product.alternate_barcodes;
  if (!Array.isArray(alts)) return false;
  return alts.some((b) => String(b ?? "").trim() === code);
}

/**
 * Строка для клиентского поиска (includes по подстроке), с учётом доп. штрихкодов.
 * @param {object} product
 * @returns {string}
 */
export function productSearchHaystackLower(product) {
  const parts = [
    product?.name,
    product?.title,
    product?.code,
    product?.article,
    product?.barcode,
  ];
  if (Array.isArray(product?.alternate_barcodes)) {
    for (const b of product.alternate_barcodes) {
      if (b != null && String(b).trim()) parts.push(b);
    }
  }
  return parts
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v).toLowerCase())
    .join(" ");
}
