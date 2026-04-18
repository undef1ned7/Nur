import { useCallback, useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  Download,
  PackageCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../../../api";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import DataContainer from "../../../common/DataContainer/DataContainer";
import InvoicePdfDocument from "../Documents/components/InvoicePdfDocument";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { productSearchHaystackLower } from "../../../../../tools/productBarcode";
import "./Warehouse.scss";
import "./SupplierReceiptPage.scss";

const listFrom = (res) => res?.data?.results || res?.data || [];

const formatQty = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatPriceInput = (value) => {
  const normalized = String(value ?? "").replace(",", ".").trim();
  if (!normalized) return "";
  const num = Number(normalized);
  if (!Number.isFinite(num)) return "";
  return String(num);
};

const parsePositiveQty = (value) => {
  const normalized = String(value ?? "").replace(",", ".").trim();
  if (!normalized) return 0;
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const parseNonNegativePrice = (value) => {
  const normalized = String(value ?? "").replace(",", ".").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

const buildSupplierLabel = (supplier) => {
  if (!supplier || typeof supplier !== "object") return "Без названия";
  return (
    String(
      supplier.full_name ||
        supplier.name ||
        supplier.company_name ||
        supplier.phone ||
        supplier.email ||
        "Без названия",
    ).trim() || "Без названия"
  );
};

const buildProductLabel = (product) =>
  String(
    product?.name ||
      product?.title ||
      product?.product_name ||
      product?.code ||
      "Товар",
  ).trim() || "Товар";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SupplierReceiptPage() {
  const navigate = useNavigate();
  const alert = useAlert();

  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [qtyByProductId, setQtyByProductId] = useState({});
  const [priceByProductId, setPriceByProductId] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        value: String(supplier.id || ""),
        label: buildSupplierLabel(supplier),
      })),
    [suppliers],
  );

  const selectedSupplier = useMemo(
    () =>
      suppliers.find((supplier) => String(supplier.id || "") === selectedSupplierId) ||
      null,
    [suppliers, selectedSupplierId],
  );

  const loadSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      const res = await api.get("/main/clients/", {
        params: { type: "suppliers", page_size: 500 },
      });
      setSuppliers(Array.isArray(listFrom(res)) ? listFrom(res) : []);
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при загрузке поставщиков",
      );
      alert(errorMessage, true);
      setSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const loadSupplierProducts = async (supplierId) => {
    const normalizedSupplierId = String(supplierId || "").trim();
    if (!normalizedSupplierId) {
      setProducts([]);
      return;
    }

    try {
      setProductsLoading(true);
      const res = await api.get(
        `/main/suppliers/${encodeURIComponent(normalizedSupplierId)}/products/`,
      );
      const nextProducts = Array.isArray(listFrom(res)) ? listFrom(res) : [];
      setProducts(nextProducts);
      setPriceByProductId(
        nextProducts.reduce((acc, product) => {
          const productId = String(product?.id || "");
          if (!productId) return acc;
          acc[productId] = formatPriceInput(
            product?.purchase_price ?? product?.price ?? "",
          );
          return acc;
        }, {}),
      );
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при загрузке товаров поставщика",
      );
      alert(errorMessage, true);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
    // intentionally once on mount to avoid refetch loops from unstable hook refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQtyByProductId({});
    setPriceByProductId({});
    if (!selectedSupplierId) {
      setProducts([]);
      return;
    }
    void loadSupplierProducts(selectedSupplierId);
    // refetch only when supplier actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupplierId]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      const haystack = productSearchHaystackLower(product);
      return haystack.includes(query);
    });
  }, [products, search]);

  const receiptItems = useMemo(
    () =>
      Object.entries(qtyByProductId)
        .map(([product, qty]) => {
          const purchasePrice = parseNonNegativePrice(priceByProductId[product]);
          return {
            product,
            qty: parsePositiveQty(qty),
            ...(purchasePrice !== null
              ? { purchase_price: purchasePrice }
              : {}),
          };
        })
        .filter((item) => item.qty > 0),
    [priceByProductId, qtyByProductId],
  );

  const totalReceiptQty = useMemo(
    () => receiptItems.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [receiptItems],
  );

  const receiptItemsForPdf = useMemo(
    () =>
      receiptItems.map((item) => {
        const product = products.find(
          (candidate) => String(candidate?.id || "") === String(item.product || ""),
        );
        return {
          productId: item.product,
          name: buildProductLabel(product),
          article: product?.article || product?.barcode || product?.code || "",
          unit: product?.unit || "ШТ",
          qty: Number(item.qty || 0),
          purchase_price: Number(item.purchase_price || 0),
        };
      }),
    [products, receiptItems],
  );

  const totalReceiptAmount = useMemo(
    () =>
      receiptItemsForPdf.reduce(
        (sum, item) =>
          sum + Number(item.qty || 0) * Number(item.purchase_price || 0),
        0,
      ),
    [receiptItemsForPdf],
  );

  const handleQtyChange = useCallback((productId, value) => {
    const nextValue = String(value ?? "");
    if (nextValue && !/^\d*([.,]\d*)?$/.test(nextValue)) return;
    setQtyByProductId((prev) => ({
      ...prev,
      [productId]: nextValue,
    }));
  }, []);

  const handlePriceChange = useCallback((productId, value) => {
    const nextValue = String(value ?? "");
    if (nextValue && !/^\d*([.,]\d*)?$/.test(nextValue)) return;
    setPriceByProductId((prev) => ({
      ...prev,
      [productId]: nextValue,
    }));
  }, []);

  const handleClearQty = useCallback(() => {
    setQtyByProductId({});
  }, []);

  const downloadBlob = useCallback((blob, filename) => {
    if (typeof window === "undefined" || !window.URL || !window.document) {
      throw new Error("Браузерное окружение недоступно");
    }
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }, []);

  const handleDownloadInvoice = useCallback(async () => {
    if (!selectedSupplier) {
      alert("Сначала выберите поставщика", true);
      return;
    }

    if (!receiptItemsForPdf.length) {
      alert("Добавьте хотя бы один товар в накладную", true);
      return;
    }

    setDownloadingInvoice(true);
    try {
      const timestamp = new Date();
      const invoiceNumber = `PR-${timestamp.getFullYear()}${String(
        timestamp.getMonth() + 1,
      ).padStart(2, "0")}${String(timestamp.getDate()).padStart(
        2,
        "0",
      )}-${String(timestamp.getHours()).padStart(2, "0")}${String(
        timestamp.getMinutes(),
      ).padStart(2, "0")}`;

      let companyName = "";
      let employeeName = "";
      try {
        companyName = localStorage.getItem("company_name") || "";
        const rawUser = localStorage.getItem("userData");
        const user = rawUser ? JSON.parse(rawUser) : null;
        employeeName =
          [user?.last_name || "", user?.first_name || ""].filter(Boolean).join(" ").trim() ||
          user?.email ||
          "";
      } catch {}

      const blob = await pdf(
        <InvoicePdfDocument
          data={{
            doc_type: "purchase",
            number: invoiceNumber,
            document: {
              type: "purchase_invoice",
              doc_type: "purchase",
              title: "Накладная",
              number: invoiceNumber,
              date: timestamp.toISOString().split("T")[0],
              datetime: timestamp.toISOString(),
              created_at: timestamp.toISOString(),
              discount_percent: 0,
            },
            seller: {
              name: buildSupplierLabel(selectedSupplier),
              address: selectedSupplier?.address || "",
              phone: selectedSupplier?.phone || null,
              email: selectedSupplier?.email || null,
            },
            buyer: {
              name: companyName || "Компания",
              full_name: companyName || "Компания",
              address: "",
              phone: null,
              email: null,
            },
            items: receiptItemsForPdf.map((item) => ({
              id: item.productId,
              name: item.name,
              article: item.article,
              unit: item.unit,
              qty: String(item.qty),
              unit_price: String(item.purchase_price.toFixed(2)),
              total: String((item.qty * item.purchase_price).toFixed(2)),
              discount_percent: 0,
              price_before_discount: String(item.purchase_price.toFixed(2)),
            })),
            totals: {
              subtotal: String(totalReceiptAmount.toFixed(2)),
              discount_total: "0.00",
              tax_total: "0.00",
              total: String(totalReceiptAmount.toFixed(2)),
            },
            warehouse: companyName || "Склад",
          }}
        />,
      ).toBlob();

      const supplierFilePart = buildSupplierLabel(selectedSupplier)
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9а-яё_()-]/gi, "")
        .slice(0, 40);

      downloadBlob(blob, `receipt_invoice_${supplierFilePart || "supplier"}.pdf`);
    } catch (error) {
      alert(
        error?.message || "Не удалось скачать накладную. Попробуйте позже.",
        true,
      );
    } finally {
      setDownloadingInvoice(false);
    }
  }, [alert, downloadBlob, receiptItemsForPdf, selectedSupplier]);

  const handleSubmit = useCallback(async () => {
    if (!selectedSupplierId) {
      alert("Сначала выберите поставщика", true);
      return;
    }

    if (receiptItems.length === 0) {
      alert("Укажите количество хотя бы для одного товара", true);
      return;
    }

    try {
      setSubmitting(true);
      await api.post(
        `/main/suppliers/${encodeURIComponent(selectedSupplierId)}/receipt/`,
        {
          items: receiptItems,
        },
      );
      alert("Товары успешно оприходованы");
      setQtyByProductId({});
      await loadSupplierProducts(selectedSupplierId);
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при оприходовании товаров",
      );
      alert(errorMessage, true);
    } finally {
      setSubmitting(false);
    }
  }, [alert, loadSupplierProducts, receiptItems, selectedSupplierId]);

  return (
    <div className="warehouse-page market-receipt-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <button
            className="market-receipt-page__back-button"
            onClick={() => navigate("/crm/sklad")}
            type="button"
          >
            <ArrowLeft size={16} />
            Назад к складу
          </button>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Прием товара</h1>
            <p className="warehouse-header__subtitle">
              Выберите поставщика и оприходуйте его товары на склад
            </p>
          </div>
        </div>
      </div>

      <DataContainer>
        <div className="market-receipt-page__card">
          <div className="market-receipt-page__toolbar">
            <div className="market-receipt-page__field">
              <label className="market-receipt-page__label">Поставщик</label>
              <SearchableCombobox
                value={selectedSupplierId}
                onChange={setSelectedSupplierId}
                options={supplierOptions}
                placeholder={
                  suppliersLoading ? "Загрузка поставщиков..." : "Выберите поставщика"
                }
                classNamePrefix="searchableCombo"
              />
            </div>

            <div className="market-receipt-page__field market-receipt-page__field--search">
              <label className="market-receipt-page__label">Поиск по товарам</label>
              <div className="market-receipt-page__search">
                <Search size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Название, код, артикул, штрихкод"
                  disabled={!selectedSupplierId}
                />
              </div>
            </div>
          </div>

          <div className="market-receipt-page__summary">
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Поставщик</span>
              <strong>{selectedSupplier ? buildSupplierLabel(selectedSupplier) : "Не выбран"}</strong>
            </div>
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Выбрано товаров</span>
              <strong>{receiptItems.length}</strong>
            </div>
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Общее количество</span>
              <strong>{formatQty(totalReceiptQty)}</strong>
            </div>
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Сумма накладной</span>
              <strong>{formatMoney(totalReceiptAmount)}</strong>
            </div>
          </div>

          <div className="market-receipt-page__actions">
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={() => loadSupplierProducts(selectedSupplierId)}
              disabled={!selectedSupplierId || productsLoading || submitting}
            >
              <RefreshCw size={16} />
              Обновить товары
            </button>
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={handleClearQty}
              disabled={receiptItems.length === 0 || submitting}
            >
              Очистить количества
            </button>
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={handleDownloadInvoice}
              disabled={
                !selectedSupplierId ||
                receiptItems.length === 0 ||
                downloadingInvoice
              }
            >
              <Download size={16} />
              {downloadingInvoice ? "Скачиваем..." : "Скачать накладную"}
            </button>
            <button
              type="button"
              className="market-receipt-page__primary-button"
              onClick={handleSubmit}
              disabled={!selectedSupplierId || receiptItems.length === 0 || submitting}
            >
              <PackageCheck size={16} />
              {submitting ? "Сохраняем..." : "Оприходовать товары"}
            </button>
          </div>

          {!selectedSupplierId ? (
            <div className="market-receipt-page__empty">
              Сначала выберите поставщика, чтобы загрузить его товары.
            </div>
          ) : productsLoading ? (
            <div className="market-receipt-page__empty">Загрузка товаров...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="market-receipt-page__empty">
              {products.length === 0
                ? "У выбранного поставщика пока нет товаров."
                : "По вашему поиску товары не найдены."}
            </div>
          ) : (
            <div className="market-receipt-page__results">
              <div className="market-receipt-page__table-wrap">
                <table className="market-receipt-page__table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Код</th>
                      <th>Артикул</th>
                      <th>Текущий остаток</th>
                      <th>Цена закупки</th>
                      <th>Количество для приема</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const productId = String(product.id || "");
                      return (
                        <tr key={productId}>
                          <td>{buildProductLabel(product)}</td>
                          <td>{product.code || "—"}</td>
                          <td>{product.article || "—"}</td>
                          <td>{formatQty(product.quantity || 0)}</td>
                          <td>
                            <input
                              className="market-receipt-page__price-input"
                              type="text"
                              inputMode="decimal"
                              value={priceByProductId[productId] ?? ""}
                              onChange={(e) =>
                                handlePriceChange(productId, e.target.value)
                              }
                              placeholder="0"
                            />
                          </td>
                          <td>
                            <input
                              className="market-receipt-page__qty-input"
                              type="text"
                              inputMode="decimal"
                              value={qtyByProductId[productId] ?? ""}
                              onChange={(e) =>
                                handleQtyChange(productId, e.target.value)
                              }
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="market-receipt-page__cards">
                {filteredProducts.map((product) => {
                  const productId = String(product.id || "");
                  return (
                    <div className="market-receipt-page__product-card" key={`card-${productId}`}>
                      <div className="market-receipt-page__product-title">
                        {buildProductLabel(product)}
                      </div>

                      <div className="market-receipt-page__product-meta">
                        <div className="market-receipt-page__product-meta-item">
                          <span>Код</span>
                          <strong>{product.code || "—"}</strong>
                        </div>
                        <div className="market-receipt-page__product-meta-item">
                          <span>Артикул</span>
                          <strong>{product.article || "—"}</strong>
                        </div>
                        <div className="market-receipt-page__product-meta-item">
                          <span>Остаток</span>
                          <strong>{formatQty(product.quantity || 0)}</strong>
                        </div>
                      </div>

                      <div className="market-receipt-page__product-inputs">
                        <div className="market-receipt-page__field">
                          <label className="market-receipt-page__label">
                            Цена закупки
                          </label>
                          <input
                            className="market-receipt-page__price-input market-receipt-page__price-input--mobile"
                            type="text"
                            inputMode="decimal"
                            value={priceByProductId[productId] ?? ""}
                            onChange={(e) =>
                              handlePriceChange(productId, e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>

                        <div className="market-receipt-page__field">
                          <label className="market-receipt-page__label">
                            Количество для приема
                          </label>
                          <input
                            className="market-receipt-page__qty-input market-receipt-page__qty-input--mobile"
                            type="text"
                            inputMode="decimal"
                            value={qtyByProductId[productId] ?? ""}
                            onChange={(e) =>
                              handleQtyChange(productId, e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DataContainer>
    </div>
  );
}
