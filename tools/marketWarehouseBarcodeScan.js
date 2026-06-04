import {
  getProductByBarcodeApi,
  lookupWarehouseProductByBarcodeApi,
} from "../src/api/products";

/** Нормализует ответ lookup / global-barcode / обёртку product. */
export const normalizeWarehouseBarcodeProduct = (data) => {
  if (!data || typeof data !== "object") return null;

  const product =
    data.product && typeof data.product === "object"
      ? data.product
      : data;

  const id = product.id ?? product.uuid ?? product.product_id;
  if (!id) return null;

  return { ...product, id: String(id) };
};

const isBarcodeNotFound = (err) => {
  const status = err?.status ?? err?.response?.status;
  if (status === 404 || status === 501) return true;
  const detail = String(
    err?.data?.detail ?? err?.detail ?? err?.data?.message ?? "",
  ).toLowerCase();
  return detail.includes("not found") || detail.includes("не найден");
};

/**
 * Поиск товара по штрихкоду для /crm/sklad (без POS start/scan/delete).
 * @returns {Promise<{ product: object } | null>}
 */
export async function lookupMarketWarehouseProductByBarcode(barcode, params = {}) {
  const code = String(barcode || "").trim();
  if (!code) return null;

  try {
    const data = await lookupWarehouseProductByBarcodeApi(code, params);
    const product = normalizeWarehouseBarcodeProduct(data);
    if (product) return { product };
  } catch (err) {
    if (!isBarcodeNotFound(err)) throw err;
  }

  try {
    const data = await getProductByBarcodeApi(code);
    const product = normalizeWarehouseBarcodeProduct(data);
    if (product) return { product };
  } catch (err) {
    if (isBarcodeNotFound(err)) return null;
    throw err;
  }

  return null;
}
