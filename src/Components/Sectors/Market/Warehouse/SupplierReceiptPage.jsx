import { useCallback, useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  PackageCheck,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../../../api";
import AddProductPage from "../../../Deposits/Sklad/AddProductPage";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import DataContainer from "../../../common/DataContainer/DataContainer";
import InvoicePdfDocument from "../Documents/components/InvoicePdfDocument";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
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
  const confirm = useConfirm();

  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [createSupplierName, setCreateSupplierName] = useState("");
  const [createSupplierPhone, setCreateSupplierPhone] = useState("");
  const [createSupplierSaving, setCreateSupplierSaving] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [modalProducts, setModalProducts] = useState([]);
  const [modalProductsLoading, setModalProductsLoading] = useState(false);
  const [modalProductsPage, setModalProductsPage] = useState(1);
  const [modalProductsCount, setModalProductsCount] = useState(0);
  const [modalProductsHasNext, setModalProductsHasNext] = useState(false);
  const [modalProductsHasPrev, setModalProductsHasPrev] = useState(false);
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [productsModalSearch, setProductsModalSearch] = useState("");
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

  const loadModalProducts = async (page = 1, searchValue = "") => {
    try {
      setModalProductsLoading(true);
      const params = {
        page,
      };
      const normalizedSearch = String(searchValue || "").trim();
      if (normalizedSearch) {
        params.search = normalizedSearch;
      }
      const res = await api.get("/main/products/list/", {
        params,
      });
      const data = res?.data || {};
      const nextProducts = Array.isArray(data?.results) ? data.results : [];
      setModalProducts(nextProducts);
      setModalProductsPage(Number(data?.page || page || 1));
      setModalProductsCount(Number(data?.count || 0));
      setModalProductsHasNext(Boolean(data?.next));
      setModalProductsHasPrev(Boolean(data?.previous));
    } catch (error) {
      const errorMessage = validateResErrors(error, "Ошибка при загрузке товаров");
      alert(errorMessage, true);
      setModalProducts([]);
      setModalProductsCount(0);
      setModalProductsHasNext(false);
      setModalProductsHasPrev(false);
    } finally {
      setModalProductsLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    const full_name = String(createSupplierName || "").trim();
    const phone = String(createSupplierPhone || "").trim();
    if (!full_name) {
      alert("Введите имя поставщика.", true);
      return;
    }
    if (!phone) {
      alert("Введите телефон поставщика.", true);
      return;
    }
    try {
      setCreateSupplierSaving(true);
      const { data } = await api.post("/main/clients/", {
        type: "suppliers",
        full_name,
        phone,
      });
      const createdId = String(data?.id || "").trim();
      await loadSuppliers();
      if (createdId) setSelectedSupplierId(createdId);
      setCreateSupplierOpen(false);
      setCreateSupplierName("");
      setCreateSupplierPhone("");
    } catch (error) {
      const errorMessage = validateResErrors(error, "Ошибка создания поставщика");
      alert(errorMessage, true);
    } finally {
      setCreateSupplierSaving(false);
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

  useEffect(() => {
    if (!productsModalOpen) return;
    setProductsModalSearch("");
    void loadModalProducts(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsModalOpen]);

  const tableProducts = useMemo(() => {
    if (!selectedSupplierId) return [];
    return products;
  }, [products, selectedSupplierId]);

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

  const getSupplierIdFromProduct = useCallback((product) => {
    if (!product || typeof product !== "object") return "";
    const rawSupplier =
      product.client ??
      product.client_id ??
      product.supplier ??
      product.supplier_id ??
      product.provider ??
      product.provider_id;
    if (!rawSupplier) return "";
    if (typeof rawSupplier === "object") {
      return String(rawSupplier.id || "").trim();
    }
    return String(rawSupplier).trim();
  }, []);

  const addProductToReceipt = useCallback(
    async (productId, productData = null) => {
      const normalizedProductId = String(productId || "").trim();
      if (!normalizedProductId) return;
      const supplierId = getSupplierIdFromProduct(productData);
      const selectedId = String(selectedSupplierId || "").trim();
      const productName = buildProductLabel(productData);

      const askConfirm = (message) =>
        new Promise((resolve) => {
          confirm(message, (ok) => resolve(Boolean(ok)));
        });

      const ensureProductInCurrentList = () => {
        if (!productData) return;
        setProducts((prev) => {
          const exists = prev.some(
            (item) => String(item?.id || "") === normalizedProductId,
          );
          if (exists) return prev;
          return [productData, ...prev];
        });
        setPriceByProductId((prev) => ({
          ...prev,
          [normalizedProductId]:
            prev[normalizedProductId] ??
            formatPriceInput(
              productData?.purchase_price ?? productData?.price ?? "",
            ),
        }));
      };

      // Если поставщик в форме уже выбран, предлагаем привязать товар к нему
      if (selectedId) {
        const productSupplierId = String(supplierId || "").trim();
        if (!productSupplierId) {
          const shouldBind = await askConfirm(
            `У товара "${productName}" не указан поставщик. Привязать товар к выбранному поставщику?`,
          );
          if (!shouldBind) return;
          try {
            await api.patch(`/main/products/${normalizedProductId}/`, {
              client: selectedId,
            });
            ensureProductInCurrentList();
          } catch (error) {
            const errorMessage = validateResErrors(
              error,
              "Не удалось привязать товар к выбранному поставщику",
            );
            alert(errorMessage, true);
            return;
          }
        } else if (productSupplierId !== selectedId) {
          try {
            await api.patch(`/main/products/${normalizedProductId}/`, {
              client: selectedId,
            });
            ensureProductInCurrentList();
          } catch (error) {
            const errorMessage = validateResErrors(
              error,
              "Не удалось обновить поставщика у товара",
            );
            alert(errorMessage, true);
            return;
          }
        }
      } else {
        // Если поставщик в форме не выбран, пробуем подставить из товара
        if (!supplierId) {
          alert(
            "У выбранного товара не указан поставщик. Укажите поставщика в карточке товара.",
            true,
          );
          return;
        }
        setSelectedSupplierId(String(supplierId));
        ensureProductInCurrentList();
      }

      setQtyByProductId((prev) => ({
        ...prev,
        [normalizedProductId]: prev[normalizedProductId] || "1",
      }));
    },
    [
      alert,
      confirm,
      getSupplierIdFromProduct,
      selectedSupplierId,
      setQtyByProductId,
    ],
  );

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
            onClick={() => navigate("/crm/market/procurement")}
            type="button"
          >
            <ArrowLeft size={16} />
            Назад к закупкам
          </button>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Закупки</h1>
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
              <div className="market-receipt-page__supplier-row">
                <SearchableCombobox
                  value={selectedSupplierId}
                  onChange={setSelectedSupplierId}
                  options={supplierOptions}
                  placeholder={
                    suppliersLoading ? "Загрузка поставщиков..." : "Выберите поставщика"
                  }
                  classNamePrefix="searchableCombo"
                />
                <button
                  type="button"
                  className="market-receipt-page__supplier-add"
                  onClick={() => setCreateSupplierOpen(true)}
                  title="Добавить поставщика"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

          </div>

          <div className="market-receipt-page__summary">
            <div className="market-receipt-page__summary-item">
              <span className="market-receipt-page__summary-label">Поставщик</span>
              <strong>{selectedSupplier ? buildSupplierLabel(selectedSupplier) : "—"}</strong>
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
              onClick={() => setProductsModalOpen(true)}
              disabled={productsLoading}
            >
              Товары
            </button>
            <button
              type="button"
              className="market-receipt-page__secondary-button"
              onClick={() => setCreateProductOpen(true)}
              disabled={!selectedSupplierId || submitting || productsLoading}
            >
              <Plus size={16} />
              Добавить товар
            </button>
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
          </div>

          {!selectedSupplierId ? (
            <div className="market-receipt-page__empty">
              Сначала выберите поставщика, чтобы загрузить его товары.
            </div>
          ) : productsLoading ? (
            <div className="market-receipt-page__empty">Загрузка товаров...</div>
          ) : tableProducts.length === 0 ? (
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
                    {tableProducts.map((product) => {
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
                {tableProducts.map((product) => {
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
          <div className="market-receipt-page__actions market-receipt-page__submit-actions">
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
        </div>
      </DataContainer>
      {createSupplierOpen && (
        <div className="market-receipt-page__modal-overlay" onClick={() => setCreateSupplierOpen(false)}>
          <div className="market-receipt-page__modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="market-receipt-page__modal-title">Новый поставщик</h3>
            <div className="market-receipt-page__field">
              <label className="market-receipt-page__label">Имя *</label>
              <input
                className="market-receipt-page__qty-input market-receipt-page__qty-input--mobile"
                value={createSupplierName}
                onChange={(e) => setCreateSupplierName(e.target.value)}
                placeholder="Название/ФИО"
              />
            </div>
            <div className="market-receipt-page__field">
              <label className="market-receipt-page__label">Телефон *</label>
              <input
                className="market-receipt-page__qty-input market-receipt-page__qty-input--mobile"
                value={createSupplierPhone}
                onChange={(e) => setCreateSupplierPhone(e.target.value)}
                placeholder="+996..."
              />
            </div>
            <div className="market-receipt-page__actions">
              <button
                type="button"
                className="market-receipt-page__secondary-button"
                onClick={() => setCreateSupplierOpen(false)}
                disabled={createSupplierSaving}
              >
                Отмена
              </button>
              <button
                type="button"
                className="market-receipt-page__primary-button"
                onClick={handleCreateSupplier}
                disabled={createSupplierSaving}
              >
                {createSupplierSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
      {createProductOpen && (
        <div className="market-receipt-page__modal-overlay" onClick={() => setCreateProductOpen(false)}>
          <div
            className="market-receipt-page__modal-card market-receipt-page__modal-card--full"
            onClick={(e) => e.stopPropagation()}
          >
            <AddProductPage
              embedded
              forceProductOnly
              embeddedPrefillSupplierId={selectedSupplierId}
              embeddedReturnTo="/crm/market/procurement/receipt"
              onEmbeddedClose={() => setCreateProductOpen(false)}
              onEmbeddedSaved={async () => {
                setCreateProductOpen(false);
                await loadSupplierProducts(selectedSupplierId);
                alert("Товар создан и привязан к поставщику");
              }}
            />
          </div>
        </div>
      )}
      {productsModalOpen && (
        <div
          className="market-receipt-page__modal-overlay"
          onClick={() => setProductsModalOpen(false)}
        >
          <div
            className="market-receipt-page__modal-card market-receipt-page__modal-card--products"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="market-receipt-page__modal-title">Товары поставщика</h3>
            <div className="market-receipt-page__field market-receipt-page__modal-search-row">
              <input
                className="market-receipt-page__qty-input market-receipt-page__qty-input--mobile"
                value={productsModalSearch}
                onChange={(e) => setProductsModalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadModalProducts(1, productsModalSearch);
                  }
                }}
                placeholder="Название, код, артикул, штрихкод"
              />
              <button
                type="button"
                className="market-receipt-page__secondary-button"
                onClick={() => void loadModalProducts(1, productsModalSearch)}
                disabled={modalProductsLoading}
              >
                Поиск
              </button>
            </div>
            <div className="market-receipt-page__field market-receipt-page__modal-products-list">
              {modalProductsLoading || productsLoading ? (
                <div className="market-receipt-page__empty">Загрузка товаров...</div>
              ) : modalProducts.length === 0 ? (
                <div className="market-receipt-page__empty">Товары не найдены</div>
              ) : (
                <div className="market-receipt-page__modal-products-grid">
                  {modalProducts.map((product) => {
                    const productId = String(product?.id || "");
                    return (
                      <button
                        key={`modal-product-${productId}`}
                        type="button"
                        className="market-receipt-page__modal-product-item"
                        onClick={() => {
                          addProductToReceipt(productId, product);
                          setProductsModalOpen(false);
                        }}
                      >
                        <span className="market-receipt-page__modal-product-title">
                          {buildProductLabel(product)}
                        </span>
                        <span className="market-receipt-page__modal-product-code">
                          {product.code || product.article || "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="market-receipt-page__actions market-receipt-page__modal-actions market-receipt-page__modal-pagination">
              <button
                type="button"
                className="market-receipt-page__secondary-button market-receipt-page__pagination-button"
                onClick={() => void loadModalProducts(modalProductsPage - 1, productsModalSearch)}
                disabled={!modalProductsHasPrev || modalProductsLoading}
                aria-label="Предыдущая страница"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="market-receipt-page__modal-hint">
                Страница {modalProductsPage}, всего: {modalProductsCount}
              </span>
              <button
                type="button"
                className="market-receipt-page__secondary-button market-receipt-page__pagination-button"
                onClick={() => void loadModalProducts(modalProductsPage + 1, productsModalSearch)}
                disabled={!modalProductsHasNext || modalProductsLoading}
                aria-label="Следующая страница"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="market-receipt-page__actions">
              <button
                type="button"
                className="market-receipt-page__secondary-button"
                onClick={() => setProductsModalOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
