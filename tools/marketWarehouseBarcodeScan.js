import {
  fetchProductsApi,
  getProductByBarcodeApi,
  lookupWarehouseProductByBarcodeApi,
} from "../src/api/products";
import { productMatchesBarcode } from "./productBarcode";

/** Источник найденного товара: локальный склад / глобальный каталог / список компании. */
export const WAREHOUSE_BARCODE_SOURCE = {
  warehouse: "warehouse",
  global: "global",
  alternate: "alternate",
};

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
 *
 * Важно: `source: "global"` — это GlobalProduct. Его id нельзя передавать в
 * GET /main/products/{id}/ и нельзя открывать как карточку склада — сначала
 * нужно завести товар в компанию через create-by-barcode.
 *
 * @returns {Promise<{ product: object, source: string } | null>}
 */
export async function lookupMarketWarehouseProductByBarcode(barcode, params = {}) {
  const code = String(barcode || "").trim();
  if (!code) return null;

  try {
    const data = await lookupWarehouseProductByBarcodeApi(code, params);
    const product = normalizeWarehouseBarcodeProduct(data);
    if (product) {
      return { product, source: WAREHOUSE_BARCODE_SOURCE.warehouse };
    }
  } catch (err) {
    if (!isBarcodeNotFound(err)) throw err;
  }

  // Фолбэк по дополнительным штрихкодам среди товаров компании
  // (`alternate_barcodes`): barcode-эндпоинты ищут только по основному коду.
  const alternateProduct = await findProductByAlternateBarcode(code);
  if (alternateProduct) {
    return {
      product: alternateProduct,
      source: WAREHOUSE_BARCODE_SOURCE.alternate,
    };
  }

  try {
    const data = await getProductByBarcodeApi(code);
    const product = normalizeWarehouseBarcodeProduct(data);
    if (product) {
      return { product, source: WAREHOUSE_BARCODE_SOURCE.global };
    }
  } catch (err) {
    if (!isBarcodeNotFound(err)) throw err;
  }

  return null;
}

/** Товар компании (локальный Product), найденный по любому штрихкоду. */
export function isCompanyWarehouseBarcodeProduct(result) {
  const source = result?.source;
  return (
    source === WAREHOUSE_BARCODE_SOURCE.warehouse ||
    source === WAREHOUSE_BARCODE_SOURCE.alternate
  );
}

/** Поиск товара по доп. штрихкоду через обычный список товаров. */
async function findProductByAlternateBarcode(code) {
  try {
    const data = await fetchProductsApi({
      search: code,
      page: 1,
      page_size: 50,
    });
    const list = Array.isArray(data) ? data : data?.results || [];
    const match = list.find((item) => productMatchesBarcode(item, code));
    return match ? normalizeWarehouseBarcodeProduct(match) : null;
  } catch {
    return null;
  }
}
