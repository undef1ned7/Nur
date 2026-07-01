import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useScanDetection from "use-scan-detection";
import { generateEAN13Barcode } from "../../../Deposits/Sklad/AddProductPage/utils/barcodeUtils";
import {
  ArrowRight,
  Box,
  Calculator,
  ChefHat,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Checkbox, TextField } from "@mui/material";
import {
  createProductAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
  getProcessedItemsMake,
} from "../../../../store/creators/productCreators";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import { createDeal } from "../../../../store/creators/saleThunk";
import { addCashFlows } from "../../../../store/slices/cashSlice";
import { useProducts } from "../../../../store/slices/productSlice";
import { useClient } from "../../../../store/slices/ClientSlice";
import { DEAL_STATUS_RU } from "../../../pages/Sell/Sell";
import {
  useAlert,
  useErrorModal,
} from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import api from "../../../../api";
import FileInput from "./FileInput/FileInput";
import { toDecimal2, toDecimal3 } from "../itemMakeHelpers";
import "./FinishedGoodsAddModal.scss";

const UNIT_PRESETS = ["шт.", "кг", "л", "уп."];

const FinishedGoodsAddModal = ({
  onClose,
  onSaveSuccess,
  selectCashBox,
  isPage = false,
}) => {
  const dispatch = useDispatch();
  const alert = useAlert();
  const error = useErrorModal();

  const { categories, brands } = useProducts();
  const materials = useSelector((s) => s.product?.itemsMakeProcessed ?? []);
  const materialsLoading =
    useSelector(
      (s) => s.product?.itemsMakeLoading ?? s.product?.loadingItemsMake,
    ) ?? false;
  const { list: clients } = useClient();
  const suppliers = useMemo(
    () => (clients || []).filter((c) => c.type === "suppliers"),
    [clients],
  );

  const barcodeInputRef = useRef(null);

  const [product, setProduct] = useState({
    name: "",
    barcode: "",
    brand_name: "",
    category_name: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "0",
    unit: "шт.",
    stock: false,
  });

  const [images, setImages] = useState([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplier, setSupplier] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "suppliers",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });
  const [showPayment, setShowPayment] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);

  const [recipeItems, setRecipeItems] = useState([]);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialQuery, setMaterialQuery] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [dealStatus, setDealStatus] = useState("Полная оплата");
  const [debtMonths, setDebtMonths] = useState("");
  const [prepayment, setPrepayment] = useState("");
  const [isPurchasePriceManuallyEdited, setIsPurchasePriceManuallyEdited] =
    useState(false);
  const [calcPurchasePriceFromRecipe, setCalcPurchasePriceFromRecipe] =
    useState(true);
  const [markupPercent, setMarkupPercent] = useState("1350");

  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Склад производство",
  });

  const getMaterialUnitPrice = useCallback(
    (material) => Number(material?.price ?? 0),
    [],
  );

  const recipeMaterialCostPerUnit = useMemo(() => {
    return recipeItems.reduce((acc, recipeItem) => {
      const material = (Array.isArray(materials) ? materials : []).find(
        (m) => String(m.id) === String(recipeItem.materialId),
      );
      if (!material) return acc;
      return (
        acc +
        Number(recipeItem.quantity || 0) *
          Number(getMaterialUnitPrice(material))
      );
    }, 0);
  }, [recipeItems, materials, getMaterialUnitPrice]);

  const roundPrice = useCallback((value) => {
    const num = Number(value || 0);
    return Math.round(num * 1000) / 1000;
  }, []);

  const effectivePurchasePricePerUnit = useMemo(() => {
    if (calcPurchasePriceFromRecipe) {
      return recipeMaterialCostPerUnit;
    }
    return Number(product.purchase_price || 0);
  }, [
    calcPurchasePriceFromRecipe,
    product.purchase_price,
    recipeMaterialCostPerUnit,
  ]);

  const previewSalePrice = useMemo(() => {
    if (!calcPurchasePriceFromRecipe) return null;
    const pp = recipeMaterialCostPerUnit;
    const markup = Number(markupPercent || 0);
    return pp * (1 + markup / 100);
  }, [calcPurchasePriceFromRecipe, recipeMaterialCostPerUnit, markupPercent]);

  const recipeMap = useMemo(() => {
    const map = new Map();
    recipeItems.forEach((it) => {
      if (it.materialId != null) {
        map.set(String(it.materialId), String(it.quantity ?? ""));
      }
    });
    return map;
  }, [recipeItems]);

  const filteredMaterials = useMemo(() => {
    const list = (Array.isArray(materials) ? materials : []).filter(
      (m) => m && m.id != null,
    );
    const q = materialQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => {
      const name = (m.name || m.title || "").toLowerCase();
      if (!m || m.id == null) return false;
      return name.includes(q);
    });
  }, [materials, materialQuery]);

  const handleImageChange = useCallback((idx, file) => {
    setImages((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, file } : it)),
    );
  }, []);

  const handlePrimarySelect = useCallback((idx) => {
    setImages((prev) =>
      prev.map((it, i) => ({ ...it, is_primary: i === idx })),
    );
  }, []);

  const addImageSlot = useCallback(() => {
    setImages((prev) => {
      const hasPrimary = prev.some((p) => p.is_primary);
      return [...prev, { file: null, alt: "", is_primary: !hasPrimary }];
    });
  }, []);

  const removeImageSlot = useCallback((idx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length && !next.some((p) => p.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    dispatch(getProcessedItemsMake());
    // Поставщиков грузим тем же запросом, что и страница /crm/production/suppliers
    dispatch(fetchClientsAsync({ type: "suppliers" }));
    dispatch(fetchCategoriesAsync());
    dispatch(fetchBrandsAsync());
  }, [dispatch]);

  useEffect(() => {
    setProduct((prev) => {
      if (String(prev.barcode ?? "").trim()) return prev;
      return { ...prev, barcode: generateEAN13Barcode() };
    });
  }, []);

  useEffect(() => {
    if (!calcPurchasePriceFromRecipe || isPurchasePriceManuallyEdited) return;
    setProduct((prev) => ({
      ...prev,
      purchase_price:
        recipeItems.length > 0 ? String(roundPrice(recipeMaterialCostPerUnit)) : "0",
    }));
  }, [
    calcPurchasePriceFromRecipe,
    isPurchasePriceManuallyEdited,
    recipeItems,
    recipeMaterialCostPerUnit,
    roundPrice,
  ]);

  useEffect(() => {
    const purchaseTotal =
      effectivePurchasePricePerUnit * Number(product.quantity || 0);
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: product.name,
      amount:
        recipeItems.length === 0 && purchaseTotal
          ? purchaseTotal.toFixed(2)
          : "",
    }));
  }, [product, recipeItems, selectCashBox, effectivePurchasePricePerUnit]);

  const generateBarcode = useCallback(() => {
    setProduct((prev) => ({ ...prev, barcode: generateEAN13Barcode() }));
    requestAnimationFrame(() => barcodeInputRef.current?.focus());
  }, []);

  const applyScannedBarcode = useCallback((raw) => {
    const code = String(raw ?? "").trim();
    if (code.length < 3) return;

    const invalidPatterns = [
      "Backspace",
      "Delete",
      "Enter",
      "Tab",
      "Escape",
      "Arrow",
      "Control",
      "Alt",
      "Meta",
      "Shift",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Insert",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ];
    if (invalidPatterns.some((p) => code.includes(p))) return;
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9\-_.]+$/.test(code)) return;

    setProduct((prev) => ({ ...prev, barcode: code }));
    requestAnimationFrame(() => barcodeInputRef.current?.focus());
  }, []);

  useScanDetection({
    minLength: 3,
    onComplete: applyScannedBarcode,
  });

  const onProductChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setProduct((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === "client") {
      setProduct((prev) => ({ ...prev, [name]: value }));
      setDealStatus("Полная оплата");
      setDebtMonths("");
      setPrepayment("");
      return;
    }

    if (name === "quantity" || name === "price" || name === "purchase_price") {
      if (name === "purchase_price") {
        setIsPurchasePriceManuallyEdited(true);
      }
      setProduct((prev) => ({ ...prev, [name]: value }));
      return;
    }

    setProduct((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  }, []);

  const recalculatePurchasePriceFromRecipe = useCallback(() => {
    setIsPurchasePriceManuallyEdited(false);
    setProduct((prev) => ({
      ...prev,
      purchase_price:
        recipeItems.length > 0 ? String(roundPrice(recipeMaterialCostPerUnit)) : "0",
    }));
  }, [recipeItems.length, recipeMaterialCostPerUnit, roundPrice]);

  const onSupplierChange = useCallback((e) => {
    const { name, value } = e.target;
    setSupplier((prev) => ({ ...prev, [name]: value }));
  }, []);

  const createSupplier = useCallback(async () => {
    if (!supplier.full_name?.trim()) {
      error("Укажите ФИО поставщика");
      return;
    }
    try {
      await dispatch(createClientAsync(supplier)).unwrap();
      await dispatch(fetchClientsAsync({ type: "suppliers" })).unwrap();
      setShowSupplierForm(false);
      setSupplier({
        full_name: "",
        phone: "",
        email: "",
        date: new Date().toISOString().split("T")[0],
        type: "suppliers",
        llc: "",
        inn: "",
        okpo: "",
        score: "",
        bik: "",
        address: "",
      });
    } catch (err) {
      error(`Не удалось создать поставщика: ${err?.message || "ошибка"}`);
    }
  }, [dispatch, supplier, error]);

  const toggleRecipeItem = useCallback(
    (materialId) => {
      if (
        materialId === null ||
        materialId === undefined ||
        materialId === ""
      ) {
        return;
      }

      const key = String(materialId);
      const exists = recipeMap.has(key);

      if (exists) {
        setRecipeItems((prev) =>
          prev.filter((it) => String(it.materialId) !== key),
        );
      } else {
        const perUnitQty = "1";
        const material = (Array.isArray(materials) ? materials : []).find(
          (m) => m && m.id != null && String(m.id) === key,
        );

        if (material && Number(material.quantity || 0) <= 0) {
          error(
            `Сырьё "${
              material.name || material.title || `#${material.id}`
            }" закончилось и не может быть добавлено.`,
          );
          return;
        }

        setRecipeItems((prev) => [...prev, { materialId, quantity: perUnitQty }]);

        if (material) {
          const availableQty = Number(material.quantity || 0);
          const requestedQty = Number(perUnitQty || 0);
          const units = Number(product.quantity || 0);
          const totalNeeded = requestedQty * units;

          if (units > 0 && totalNeeded > availableQty) {
            setTimeout(() => {
              error(
                `Внимание: может быть недостаточно сырья "${
                  material.name || material.title || `#${material.id}`
                }"!\n` +
                  `Доступно: ${availableQty}\n` +
                  `Требуется: ${totalNeeded} (${requestedQty} × ${units} единиц товара)\n\n` +
                  `Вы можете изменить количество сырья в списке выбранных материалов.`,
              );
            }, 100);
          }
        }
      }
    },
    [recipeMap, materials, product.quantity, error],
  );

  const changeRecipeQty = useCallback(
    (materialId, qty) => {
      if (
        materialId === null ||
        materialId === undefined ||
        materialId === ""
      ) {
        return;
      }

      const key = String(materialId);
      const material = (Array.isArray(materials) ? materials : []).find(
        (m) => m && m.id != null && String(m.id) === key,
      );

      const availableQty = Number(material?.quantity || 0);
      const requestedQty = Number(qty || 0);
      const units = Number(product.quantity || 0);
      const totalNeeded = requestedQty * units;

      if (material && units > 0 && totalNeeded > availableQty) {
        error(
          `Недостаточно сырья "${
            material.name || material.title || `#${material.id}`
          }"!\n` +
            `Доступно: ${availableQty}\n` +
            `Требуется: ${totalNeeded} (${requestedQty} × ${units} единиц товара)\n\n` +
            `Пожалуйста, уменьшите количество сырья или количество товара.`,
        );
        return;
      }

      setRecipeItems((prev) =>
        prev.map((it) =>
          String(it.materialId) === key ? { ...it, quantity: qty } : it,
        ),
      );
    },
    [materials, product, error],
  );

  const removeRecipeItem = useCallback((materialId) => {
    const key = String(materialId);
    setRecipeItems((prev) =>
      prev.filter((it) => String(it.materialId) !== key),
    );
  }, []);

  const validateProduct = useCallback(() => {
    const required = [
      ["name", "Название"],
      ["barcode", "Штрихкод"],
      ["quantity", "Количество"],
    ];

    if (!calcPurchasePriceFromRecipe) {
      required.push(["purchase_price", "Закупочная цена"]);
      required.push(["price", "Розничная цена"]);
    } else if (String(product.price ?? "").trim()) {
      // цена не обязательна, если включен авто-расчет
    } else if (!markupPercent && markupPercent !== 0) {
      error("Укажите наценку (%) для расчёта розничной цены.");
      return false;
    }

    const missed = required.filter(
      ([k]) => product[k] === "" || product[k] === null,
    );
    if (missed.length) {
      error("Пожалуйста, заполните все обязательные поля.");
      return false;
    }

    if (product.client && dealStatus === "Долги") {
      if (!debtMonths || Number(debtMonths) < 1) {
        error("Укажите срок долга.");
        return false;
      }
    }

    if (product.client && dealStatus === "Предоплата") {
      if (!prepayment || Number(prepayment) < 0) {
        error("Укажите сумму предоплаты.");
        return false;
      }
      const purchaseTotal =
        effectivePurchasePricePerUnit * Number(product.quantity || 0);
      if (Number(prepayment) > purchaseTotal) {
        error(
          `Предоплата не может быть больше суммы закупки (${purchaseTotal.toFixed(2)}).`,
        );
        return false;
      }
      if (!debtMonths || Number(debtMonths) < 1) {
        error("Укажите срок долга.");
        return false;
      }
    }

    const units = Number(product.quantity || 0);
    if (recipeItems.length > 0 && units > 0) {
      for (const recipeItem of recipeItems) {
        const material = (Array.isArray(materials) ? materials : []).find(
          (m) => String(m.id) === String(recipeItem.materialId),
        );

        if (!material) {
          error(`Сырьё с ID ${recipeItem.materialId} не найдено.`);
          return false;
        }

        const availableQty = Number(material.quantity || 0);
        const requestedQty = Number(recipeItem.quantity || 0);
        const totalNeeded = requestedQty * units;

        if (totalNeeded > availableQty) {
          error(
            `Недостаточно сырья "${
              material.name || material.title || `#${material.id}`
            }"!\n` +
              `Доступно: ${availableQty}\n` +
              `Требуется: ${totalNeeded} (${requestedQty} × ${units} единиц товара)`,
          );
          return false;
        }
      }
    }

    return true;
  }, [
    product,
    recipeItems,
    materials,
    dealStatus,
    debtMonths,
    prepayment,
    effectivePurchasePricePerUnit,
    calcPurchasePriceFromRecipe,
    markupPercent,
    error,
  ]);

  const handleSubmit = async () => {
    setCreateError(null);
    if (!validateProduct()) return;

    const recipe = recipeItems
      .map((it) => ({
        id: String(it.materialId),
        qty_per_unit: toDecimal3(it.quantity || 0),
      }))
      .filter((r) => Number(r.qty_per_unit) > 0);

    const item_make = recipeItems.map((it) => it.materialId);

    setCreating(true);
    try {
      if (product.client !== "" && dealStatus !== "Полная оплата") {
        const purchaseTotal =
          effectivePurchasePricePerUnit * Number(product.quantity || 0);
        await dispatch(
          createDeal({
            clientId: product.client,
            title: dealStatus,
            statusRu: dealStatus,
            amount: purchaseTotal,
            prepayment:
              dealStatus === "Предоплата" ? Number(prepayment) : undefined,
            debtMonths:
              dealStatus === "Долги" || dealStatus === "Предоплата"
                ? Number(debtMonths)
                : undefined,
          }),
        ).unwrap();
      }

      const payload = {
        name: product.name,
        barcode: product.barcode,
        unit: product.unit || "шт.",
        quantity: toDecimal2(product.quantity || 0),
        client: product.client,
        stock: Boolean(product.stock),
        calc_purchase_price_from_recipe: calcPurchasePriceFromRecipe,
        recipe,
        item_make,
      };

      if (String(product.brand_name ?? "").trim()) {
        payload.brand_name = product.brand_name.trim();
      }
      if (String(product.category_name ?? "").trim()) {
        payload.category_name = product.category_name.trim();
      }

      if (calcPurchasePriceFromRecipe) {
        payload.markup_percent = String(markupPercent || "0");
        if (String(product.price ?? "").trim()) {
          payload.price = toDecimal2(product.price);
        }
      } else {
        payload.purchase_price = toDecimal2(effectivePurchasePricePerUnit);
        if (String(product.price ?? "").trim()) {
          payload.price = toDecimal2(product.price);
        }
      }

      const created = await dispatch(createProductAsync(payload)).unwrap();

      const purchaseTotal =
        effectivePurchasePricePerUnit * Number(product?.quantity || 0);
      const hasRecipeMaterials = recipeItems.length > 0;
      const amountForCash =
        dealStatus === "Долги"
          ? 0
          : dealStatus === "Предоплата"
            ? Number(prepayment || 0)
            : purchaseTotal;

      if (!hasRecipeMaterials && amountForCash > 0) {
        await dispatch(
          addCashFlows({
            ...cashData,
            amount: amountForCash.toFixed(2),
            source_cashbox_flow_id: created.id,
          }),
        ).unwrap();
      }

      try {
        const newId = created?.id || created?.product?.id || created?.data?.id;
        if (newId) {
          const uploads = images
            .filter((im) => im.file)
            .map(async (im) => {
              const fd = new FormData();
              fd.append("image", im.file);
              if (im.alt) fd.append("alt", product.name);
              fd.append("is_primary", String(Boolean(im.is_primary)));
              return api.post(`/main/products/${newId}/images/`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
              });
            });
          if (uploads.length) await Promise.allSettled(uploads);
        }
      } catch (uploadError) {
        console.warn("Загрузка изображений не удалась:", uploadError);
      }

      alert("Товар добавлен!", () => {
        onClose?.();
        setCreating(false);
        onSaveSuccess?.();
      });
    } catch (err) {
      setCreating(false);
      setCreateError(err);
      error(validateResErrors(err, "Ошибка при добавлении товара"));
    }
  };

  const purchaseTotal = useMemo(
    () => effectivePurchasePricePerUnit * Number(product.quantity || 0),
    [effectivePurchasePricePerUnit, product.quantity],
  );

  const retailValue = useMemo(() => {
    if (String(product.price ?? "").trim()) return Number(product.price || 0);
    if (previewSalePrice != null) return previewSalePrice;
    return 0;
  }, [product.price, previewSalePrice]);

  const flowStepClass = (isActive) =>
    `fg-add-modal__flow-step${isActive ? " fg-add-modal__flow-step--active" : ""}`;

  return (
    <div className={`fg-add-modal${isPage ? " fg-add-modal--page" : ""}`}>
      {!isPage && <div className="fg-add-modal__overlay" onClick={onClose} />}
      <form
        className="fg-add-modal__dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!creating) handleSubmit();
        }}
      >
        <header className="fg-add-modal__header">
          <div className="fg-add-modal__title-row">
            <div className="fg-add-modal__icon">
              <Box size={22} />
            </div>
            <div>
              <h2 className="fg-add-modal__title">Создание готовой продукции</h2>
              <p className="fg-add-modal__subtitle">
                Добавьте товар с рецептом, партией и опциональной оплатой поставщику
              </p>
            </div>
          </div>
          {!isPage && (
            <button
              type="button"
              className="fg-add-modal__close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <div className="fg-add-modal__flow">
          <div className={flowStepClass(!product.name)}>
            <span>Сырьё</span>
            <strong>{recipeItems.length ? `${recipeItems.length} позиций` : "Подберите основу"}</strong>
          </div>
          <div className="fg-add-modal__flow-arrow">
            <ArrowRight size={16} />
          </div>
          <div className={flowStepClass(recipeItems.length > 0)}>
            <span>Рецепт</span>
            <strong>
              {recipeItems.length > 0 ? "Собран" : "Не выбран"}
            </strong>
          </div>
          <div className="fg-add-modal__flow-arrow">
            <ArrowRight size={16} />
          </div>
          <div className={flowStepClass(Boolean(product.quantity))}>
            <span>Партия</span>
            <strong>
              {product.quantity ? `${product.quantity} ${product.unit}` : "Укажите объём"}
            </strong>
          </div>
          <div className="fg-add-modal__flow-arrow">
            <ArrowRight size={16} />
          </div>
          <div className={flowStepClass(Boolean(product.name && product.quantity))}>
            <span>Склад</span>
            <strong>{product.name || "Новая продукция"}</strong>
          </div>
        </div>

        <div className="fg-add-modal__body">
          <div className="fg-add-modal__main">
            {createError && (
              <p className="fg-add-modal__error">
                {validateResErrors(createError, "Ошибка при сохранении")}
              </p>
            )}

            <section className="fg-add-card">
              <div className="fg-add-card__head">
                <span className="fg-add-step">1</span>
                <h3>Что производим</h3>
              </div>
              <div className="fg-add-grid-2">
                <label className="fg-add-field">
                  <span>Название *</span>
                  <input
                    name="name"
                    value={product.name}
                    onChange={onProductChange}
                    placeholder="Например, Булочка с маком"
                    required
                    autoFocus
                  />
                </label>
                <label className="fg-add-field">
                  <span>
                    Штрихкод *
                    <button
                      type="button"
                      className="fg-add-link-btn"
                      onClick={generateBarcode}
                    >
                      сгенерировать
                    </button>
                  </span>
                  <div className="fg-add-barcode-row">
                    <input
                      ref={barcodeInputRef}
                      name="barcode"
                      value={product.barcode}
                      onChange={onProductChange}
                      placeholder="Сканируйте или введите код"
                      required
                    />
                  </div>
                </label>
                <label className="fg-add-field">
                  <span>
                    Бренд
                    <small style={{ marginLeft: 6, fontWeight: 400, color: "#64748b" }}>
                      необязательно
                    </small>
                  </span>
                  <select
                    name="brand_name"
                    value={product.brand_name}
                    onChange={onProductChange}
                  >
                    <option value="">— Без бренда —</option>
                    {brands?.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fg-add-field">
                  <span>
                    Категория
                    <small style={{ marginLeft: 6, fontWeight: 400, color: "#64748b" }}>
                      необязательно
                    </small>
                  </span>
                  <select
                    name="category_name"
                    value={product.category_name}
                    onChange={onProductChange}
                  >
                    <option value="">— Без категории —</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="fg-add-field">
                <span>Единица *</span>
                <div className="fg-add-units">
                  {UNIT_PRESETS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`fg-add-units__btn ${product.unit === u ? "is-active" : ""}`}
                      onClick={() =>
                        setProduct((prev) => ({
                          ...prev,
                          unit: u,
                        }))
                      }
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  name="unit"
                  value={product.unit}
                  onChange={onProductChange}
                  placeholder="или своя единица"
                />
              </label>
              <label className="fg-add-check">
                <input
                  type="checkbox"
                  name="stock"
                  checked={Boolean(product.stock)}
                  onChange={onProductChange}
                />
                <span>Акционный товар</span>
              </label>
            </section>

            <section className="fg-add-card fg-add-card--accent">
              <div className="fg-add-card__head">
                <span className="fg-add-step">2</span>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ChefHat size={16} />
                  Рецепт
                </h3>
                <div className="fg-add-card__head-actions">
                  <button
                    type="button"
                    className="fg-add-btn fg-add-btn--ghost fg-add-btn--sm"
                    onClick={() => setMaterialsOpen((v) => !v)}
                    disabled={materialsLoading}
                  >
                    <Plus size={15} />
                    {materialsOpen ? "Скрыть" : "Выбрать сырьё"}
                  </button>
                </div>
              </div>
              <p className="fg-add-hint">
                Укажите расход сырья на 1 единицу готового товара. Общий расход
                считается автоматически как расход на единицу × объём партии.
              </p>

              {recipeItems.length > 0 && (
                <div className="fg-add-recipe-selected">
                  {recipeItems.map((it) => {
                    const mat = (Array.isArray(materials) ? materials : []).find(
                      (m) => String(m.id) === String(it.materialId),
                    );
                    const unitPrice = Number(mat?.price || 0);
                    const availableQty = Number(mat?.quantity || 0);
                    const requestedQty = Number(it.quantity || 0);
                    const units = Number(product.quantity || 0);
                    const totalNeeded = requestedQty * units;
                    const isInsufficient = units > 0 && totalNeeded > availableQty;

                    return (
                      <div
                        key={it.materialId}
                        className={`fg-add-recipe-item${isInsufficient ? " fg-add-recipe-item--warn" : ""}`}
                      >
                        <div>
                          <p className="fg-add-recipe-item__name">
                            {mat?.name ?? mat?.title ?? `ID ${it.materialId}`}
                          </p>
                          <p className="fg-add-recipe-item__meta">
                            Доступно: {availableQty}
                            {unitPrice > 0 ? ` | ${toDecimal2(unitPrice)} сом/ед.` : ""}
                            {units > 0 ? ` | Нужно: ${toDecimal3(totalNeeded)}` : ""}
                          </p>
                        </div>
                        <TextField
                          size="small"
                          type="number"
                          value={it.quantity}
                          onChange={(e) =>
                            changeRecipeQty(it.materialId, e.target.value)
                          }
                          inputProps={{
                            min: "0",
                            step: "0.0001",
                            onWheel: (e) => e.currentTarget.blur(),
                          }}
                        />
                        <button
                          type="button"
                          className="fg-add-recipe-item__remove"
                          onClick={() => removeRecipeItem(it.materialId)}
                          aria-label="Удалить сырьё из рецепта"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {materialsOpen && (
                <div className="fg-add-recipe-picker">
                  <div className="fg-add-recipe-picker__search">
                    <TextField
                      fullWidth
                      size="small"
                      value={materialQuery}
                      onChange={(e) => setMaterialQuery(e.target.value)}
                      placeholder="Поиск сырья"
                      InputProps={{
                        startAdornment: <Search size={15} style={{ marginRight: 8 }} />,
                      }}
                    />
                  </div>
                  <div className="fg-add-recipe-picker__list">
                    {filteredMaterials.map((m) => {
                      const materialId = m.id;
                      const materialKey = String(materialId);
                      const checked = recipeMap.has(materialKey);
                      const qty = recipeMap.get(materialKey) ?? "";
                      const availableQty = Number(m.quantity || 0);
                      const requestedQty = Number(qty || 0);
                      const units = Number(product.quantity || 0);
                      const totalNeeded = requestedQty * units;
                      const isInsufficient = checked && units > 0 && totalNeeded > availableQty;
                      const isOutOfStock = availableQty <= 0;

                      return (
                        <div
                          key={materialId}
                          className={`fg-add-recipe-picker__row${
                            isOutOfStock && !checked
                              ? " fg-add-recipe-picker__row--disabled"
                              : ""
                          }${isInsufficient ? " fg-add-recipe-picker__row--warn" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            if (e.target.closest?.(".MuiTextField-root")) return;
                            if (isOutOfStock && !checked) return;
                            toggleRecipeItem(materialId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            if (e.target.closest?.(".MuiTextField-root")) return;
                            if (isOutOfStock && !checked) return;
                            toggleRecipeItem(materialId);
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            onClick={(e) => e.preventDefault()}
                            sx={{
                              color: "#64748b",
                              "&.Mui-checked": { color: "#f9cf00" },
                            }}
                          />
                          <div>
                            <p>{m.name || m.title || `#${materialId}`}</p>
                            <small>
                              Доступно: {availableQty}
                              {checked && units > 0 ? ` | Нужно: ${toDecimal3(totalNeeded)}` : ""}
                              {isOutOfStock && !checked ? " | Нет остатка" : ""}
                            </small>
                          </div>
                          <TextField
                            size="small"
                            type="number"
                            disabled={!checked}
                            value={qty}
                            onChange={(e) => changeRecipeQty(materialId, e.target.value)}
                            inputProps={{
                              min: "0",
                              step: "0.0001",
                              onWheel: (e) => e.currentTarget.blur(),
                            }}
                          />
                        </div>
                      );
                    })}
                    {!filteredMaterials.length && !materialsLoading && (
                      <div className="fg-add-empty">Ничего не найдено</div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="fg-add-card">
              <div className="fg-add-card__head">
                <span className="fg-add-step">3</span>
                <h3>Партия и цены</h3>
              </div>
              <div className="fg-add-grid-2">
                <label className="fg-add-field">
                  <span>Количество партии *</span>
                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    value={product.quantity}
                    onChange={onProductChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="100"
                    required
                  />
                </label>
                <label className="fg-add-field">
                  <span>Розничная цена {calcPurchasePriceFromRecipe ? "" : "*"}</span>
                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    value={product.price}
                    onChange={onProductChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder={
                      calcPurchasePriceFromRecipe && previewSalePrice != null
                        ? `Авто: ${toDecimal2(previewSalePrice)}`
                        : "120.00"
                    }
                    required={!calcPurchasePriceFromRecipe}
                  />
                </label>
              </div>

              <div className="fg-add-path">
                <button
                  type="button"
                  className={`fg-add-path__option ${
                    calcPurchasePriceFromRecipe ? "is-active" : ""
                  }`}
                  onClick={() => {
                    setCalcPurchasePriceFromRecipe(true);
                    setIsPurchasePriceManuallyEdited(false);
                    recalculatePurchasePriceFromRecipe();
                  }}
                >
                  <Calculator size={18} />
                  <div>
                    <strong>Авто из рецепта</strong>
                    <p>Себестоимость = сумма сырья на 1 единицу продукции</p>
                  </div>
                </button>
                <button
                  type="button"
                  className={`fg-add-path__option ${
                    !calcPurchasePriceFromRecipe ? "is-active" : ""
                  }`}
                  onClick={() => setCalcPurchasePriceFromRecipe(false)}
                >
                  <Calculator size={18} />
                  <div>
                    <strong>Ручная себестоимость</strong>
                    <p>Задайте закупочную цену вручную для всей партии</p>
                  </div>
                </button>
              </div>

              {calcPurchasePriceFromRecipe ? (
                <div className="fg-add-grid-2">
                  <label className="fg-add-field">
                    <span>Наценка, %</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={markupPercent}
                      onChange={(e) => setMarkupPercent(e.target.value)}
                    />
                  </label>
                  <label className="fg-add-field">
                    <span>Себестоимость (авто)</span>
                    <div className="fg-add-barcode-row">
                      <input
                        name="purchase_price"
                        value={toDecimal3(recipeMaterialCostPerUnit)}
                        disabled
                        readOnly
                      />
                      <button
                        type="button"
                        className="fg-add-btn fg-add-btn--ghost fg-add-btn--sm"
                        onClick={recalculatePurchasePriceFromRecipe}
                      >
                        Пересчитать
                      </button>
                    </div>
                  </label>
                </div>
              ) : (
                <label className="fg-add-field">
                  <span>Закупочная цена (себестоимость) *</span>
                  <input
                    type="number"
                    name="purchase_price"
                    min="0"
                    step="0.01"
                    value={product.purchase_price}
                    onChange={onProductChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    required
                  />
                </label>
              )}
            </section>

            <section className="fg-add-card fg-add-card--collapsible">
              <button
                type="button"
                className="fg-add-card__toggle"
                onClick={() => setShowPayment((v) => !v)}
              >
                <span className="fg-add-step">4</span>
                <span>
                  Поставщик и оплата
                  <small>необязательно</small>
                </span>
                <span className="fg-add-card__toggle-icon">{showPayment ? "−" : "+"}</span>
              </button>

              {showPayment && (
                <div className="fg-add-card__collapse">
                  <label className="fg-add-field">
                    <span>Поставщик</span>
                    <select
                      name="client"
                      value={product.client}
                      onChange={onProductChange}
                    >
                      <option value="">— Без поставщика —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="fg-add-link-btn"
                    onClick={() => setShowSupplierForm((v) => !v)}
                  >
                    {showSupplierForm ? "Скрыть форму" : "+ Новый поставщик"}
                  </button>

                  {showSupplierForm && (
                    <div className="fg-add-grid-2">
                      <label className="fg-add-field">
                        <span>ФИО / название *</span>
                        <input
                          name="full_name"
                          value={supplier.full_name}
                          onChange={onSupplierChange}
                        />
                      </label>
                      <label className="fg-add-field">
                        <span>Телефон</span>
                        <input
                          name="phone"
                          value={supplier.phone}
                          onChange={onSupplierChange}
                        />
                      </label>
                      <label className="fg-add-field">
                        <span>Email</span>
                        <input
                          name="email"
                          type="email"
                          value={supplier.email}
                          onChange={onSupplierChange}
                        />
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                        <button
                          type="button"
                          className="fg-add-btn fg-add-btn--ghost fg-add-btn--sm"
                          onClick={() => setShowSupplierForm(false)}
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          className="fg-add-btn fg-add-btn--primary fg-add-btn--sm"
                          onClick={createSupplier}
                        >
                          Создать
                        </button>
                      </div>
                    </div>
                  )}

                  {product.client && (
                    <div className="fg-add-grid-2">
                      <label className="fg-add-field">
                        <span>Тип оплаты</span>
                        <select
                          value={dealStatus}
                          onChange={(e) => setDealStatus(e.target.value)}
                        >
                          <option value="Полная оплата">Полная оплата</option>
                          {DEAL_STATUS_RU.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      {dealStatus === "Долги" && (
                        <label className="fg-add-field">
                          <span>Срок долга, мес. *</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={debtMonths}
                            onChange={(e) => setDebtMonths(e.target.value)}
                          />
                        </label>
                      )}
                      {dealStatus === "Предоплата" && (
                        <>
                          <label className="fg-add-field">
                            <span>Предоплата *</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={prepayment}
                              onChange={(e) => setPrepayment(e.target.value)}
                            />
                          </label>
                          <label className="fg-add-field">
                            <span>Срок долга, мес. *</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={debtMonths}
                              onChange={(e) => setDebtMonths(e.target.value)}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="fg-add-card fg-add-card--collapsible">
              <button
                type="button"
                className="fg-add-card__toggle"
                onClick={() => setShowPhotos((v) => !v)}
              >
                <span className="fg-add-step">5</span>
                <span>
                  Фото
                  <small>необязательно</small>
                </span>
                <span className="fg-add-card__toggle-icon">{showPhotos ? "−" : "+"}</span>
              </button>

              {showPhotos && (
                <div className="fg-add-card__collapse">
                  <button
                    type="button"
                    className="fg-add-btn fg-add-btn--ghost fg-add-btn--sm"
                    onClick={addImageSlot}
                  >
                    <Plus size={15} />
                    Добавить фото
                  </button>
                  {images.length > 0 ? (
                    <div className="fg-add-images">
                      {images.map((im, idx) => (
                        <div key={idx} className="fg-add-image-slot">
                          <div className="fg-add-image-slot__head">
                            <span>Фото #{idx + 1}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <label className="fg-add-check">
                                <input
                                  type="radio"
                                  name="primary_image"
                                  checked={Boolean(im.is_primary)}
                                  onChange={() => handlePrimarySelect(idx)}
                                />
                                <span>Главная</span>
                              </label>
                              <button
                                type="button"
                                className="fg-add-btn fg-add-btn--ghost fg-add-btn--sm"
                                onClick={() => removeImageSlot(idx)}
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                          <FileInput
                            onChange={(e) =>
                              handleImageChange(idx, e.target.files?.[0] || null)
                            }
                            accept="image/*"
                            name="image"
                            label="Image"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fg-add-empty">Фото пока не добавлены</div>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="fg-add-summary">
            <h3>Итог</h3>
            <ul>
              <li>
                <span>Продукт</span>
                <strong>{product.name || "—"}</strong>
              </li>
              <li>
                <span>Рецепт</span>
                <strong>{recipeItems.length} поз.</strong>
              </li>
              <li>
                <span>Себестоимость / ед.</span>
                <strong>{toDecimal3(effectivePurchasePricePerUnit)} сом</strong>
              </li>
              <li>
                <span>Розница / ед.</span>
                <strong>{retailValue ? `${toDecimal2(retailValue)} сом` : "—"}</strong>
              </li>
              <li className="fg-add-summary__total">
                <span>Сумма закупки</span>
                <strong>{toDecimal2(purchaseTotal)} сом</strong>
              </li>
            </ul>
            <p className="fg-add-summary__note">
              {calcPurchasePriceFromRecipe
                ? `По рецепту: ${toDecimal3(recipeMaterialCostPerUnit)} сом/ед.`
                : "Себестоимость введена вручную."}
            </p>
            <div className="fg-add-summary__actions">
              <button
                type="button"
                className="fg-add-btn fg-add-btn--ghost-dark"
                onClick={onClose}
                disabled={creating}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="fg-add-btn fg-add-btn--primary"
                disabled={creating || materialsLoading}
              >
                {creating ? "Сохранение…" : "Создать продукцию"}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
};

export const AddModal = FinishedGoodsAddModal;
export default FinishedGoodsAddModal;
