// src/pages/Warehouse/FinishedGoods/FinishedGoods.jsx
import {
  ArrowLeft,
  MoreVertical,
  Plus,
  X,
  Search,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

/* ---- Thunks / Creators ---- */
import {
  createProductAsync,
  deleteProductAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
  fetchProductsAsync,
  getItemsMake,
  // +++ добавлено для редактирования/удаления:
  updateProductAsync,
} from "../../../../store/creators/productCreators";

/* ---- Transfer / Acceptance ---- */
import {
  acceptInlineAsync,
  createBulkTransferAsync,
  createReturnAsync,
} from "../../../../store/creators/transferCreators";

/* ---- Cash ---- */
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";

/* ---- Products slice selector ---- */
import { useProducts } from "../../../../store/slices/productSlice";
// import api from "../../../api";

/* ---- Clients ---- */
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";

/* ---- UI ---- */
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import { Checkbox, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getEmployees } from "../../../../store/creators/departmentCreators";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import MarriageModal from "../../../Deposits/Sklad/MarriageModal";
import { useUser } from "../../../../store/slices/userSlice";
import AddProductModal from "../../../Deposits/Sklad/AddProduct/AddProductModal";
import { DEAL_STATUS_RU } from "../../../pages/Sell/Sell";
import { createDeal } from "../../../../store/creators/saleThunk";
import api from "../../../../api";
import FileInput from "./FileInput/FileInput";
import "../../../Deposits/Sklad/Sklad.scss";
import "./finishedGoods.scss";
import noImage from "../../Market/Warehouse/components/placeholder.png";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import {
  useAlert,
  useConfirm,
  useErrorModal,
} from "../../../../hooks/useDialog";
import usePlurize from "../../../../hooks/usePlurize";
import useResize from "../../../../hooks/useResize";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import DataContainer from "../../../common/DataContainer/DataContainer";
import "./ProductionFinishedGoodsAddPage.scss";

const ProductionFinishedGoodsAddPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const [selectCashBox, setSelectCashBox] = useState("");
  const isPage = true;
  const onClose = () => navigate("/crm/production/warehouse");
  const onSaveSuccess = () => navigate("/crm/production/warehouse");

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const error = useErrorModal();
  const alert = useAlert();
  // Категории/бренды из product slice
  const { categories, brands } = useProducts();

  // Сырьё
  const materials = useSelector((s) => s.product?.itemsMake ?? []);
  const materialsLoading =
    useSelector(
      (s) => s.product?.itemsMakeLoading ?? s.product?.loadingItemsMake,
    ) ?? false;

  // Поставщики
  const { list: clients } = useClient();
  const suppliers = useMemo(
    () => (clients || []).filter((c) => c.type === "suppliers"),
    [clients],
  );

  // Форма товара
  const [product, setProduct] = useState({
    name: "",
    barcode: "",
    brand_name: "",
    category_name: "",
    price: "",
    quantity: "", // ВАЖНО: храним как строку для удобного двустороннего биндинга
    client: "",
    purchase_price: "0",
    stock: false, // Акционный товар
  });

  // Изображения (динамически добавляемые)
  const [images, setImages] = useState([]);

  const handleImageChange = useCallback((idx, file) => {
    setImages((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, file } : it)),
    );
  }, []);

  // const handleImageAltChange = (idx, alt) => {
  //   setImages((prev) => prev.map((it, i) => (i === idx ? { ...it, alt } : it)));
  // };

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
      // если удалили главное, назначаем первое как главное
      if (next.length && !next.some((p) => p.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  }, []);

  // Движение по кассе
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Склад производство",
  });
  // console.log(cashData);

  // Быстрое создание поставщика
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

  // Рецепт: [{ materialId, quantity }]
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

  const getMaterialUnitPrice = useCallback(
    (material) => Number(material?.purchase_price ?? material?.price ?? 0),
    [],
  );

  // Себестоимость сырья на 1 единицу готового товара (по рецепту)
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

  // Итоговая закупочная цена за единицу: пользовательское значение поля закупки
  const effectivePurchasePricePerUnit = useMemo(() => {
    return Number(product.purchase_price || 0);
  }, [product.purchase_price]);

  // Карта выбранных материалов
  const recipeMap = useMemo(() => {
    const m = new Map();
    recipeItems.forEach((it) => {
      // Пропускаем элементы с отсутствующими ID
      if (it.materialId != null) {
        m.set(String(it.materialId), String(it.quantity ?? ""));
      }
    });
    return m;
  }, [recipeItems]);

  // Фильтрация сырья
  const filteredMaterials = useMemo(() => {
    // Фильтруем только материалы с валидными ID
    const list = (Array.isArray(materials) ? materials : []).filter(
      (m) => m && m.id != null,
    );
    const q = materialQuery.trim().toLowerCase();
    if (!q) return list;
    // Фильтруем по имени (даже если имя пустое, материал все равно показывается если нет поиска)
    return list.filter((m) => {
      const name = (m.name || m.title || "").toLowerCase();
      if (!m || m.id == null) {
        return false;
      }
      return name.includes(q);
    });
  }, [materials, materialQuery]);

  // Подгрузка в модалке
  useEffect(() => {
    dispatch(getItemsMake());
    dispatch(fetchClientsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(fetchBrandsAsync());
  }, [dispatch]);

  // Хэндлеры
  const onProductChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;

    // Обработка чекбоксов
    if (type === "checkbox") {
      setProduct((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    // Поставщик: при смене/очистке сбрасываем зависимые поля долга/предоплаты
    if (name === "client") {
      setProduct((prev) => ({ ...prev, [name]: value }));
      setDealStatus("Полная оплата");
      setDebtMonths("");
      setPrepayment("");
      return;
    }

    // quantity и price удобно хранить строкой (пустое значение тоже валидно)
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

  useEffect(() => {
    if (isPurchasePriceManuallyEdited) return;
    setProduct((prev) => ({
      ...prev,
      purchase_price:
        recipeItems.length > 0 ? String(roundPrice(recipeMaterialCostPerUnit)) : "0",
    }));
  }, [
    isPurchasePriceManuallyEdited,
    recipeItems,
    recipeMaterialCostPerUnit,
    roundPrice,
  ]);

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

  const createSupplier = useCallback(
    async (e) => {
      e.preventDefault();
      if (!supplier.full_name?.trim()) {
        error("Укажите ФИО поставщика");
        return;
      }
      try {
        await dispatch(createClientAsync(supplier)).unwrap();
        setShowSupplierForm(false);
      } catch (err) {
        error(`Не удалось создать поставщика: ${err?.message || "ошибка"}`);
      }
    },
    [supplier],
  );

  // Рецепт — выбор/изменение/удаление
  // ВАЖНО:
  // - нельзя добавить сырьё, если остаток <= 0
  // - если товар уже имеет количество, показываем предупреждение о нехватке, но добавление не блокируем
  const toggleRecipeItem = useCallback(
    (materialId) => {
      // Защита от отсутствия ID
      if (
        materialId === null ||
        materialId === undefined ||
        materialId === ""
      ) {
        return;
      }

      // Всегда используем строковое представление для консистентности
      const key = String(materialId);
      const exists = recipeMap.has(key);

      if (exists) {
        // Удаление из списка
        setRecipeItems((prev) =>
          prev.filter((it) => String(it.materialId) !== key),
        );
      } else {
        // ДОБАВЛЕНИЕ: всегда разрешено
        // ВАЖНО: quantity в recipeItems — это расход сырья НА 1 ЕДИНИЦУ товара (qty_per_unit),
        // а общий расход считается как qty_per_unit × product.quantity.
        // Поэтому по умолчанию ставим "1", а не product.quantity (иначе получится product.quantity²).
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

        // Добавляем сырье
        // Сохраняем materialId как есть (может быть строкой или UUID), но при сравнении всегда используем строку
        setRecipeItems((prev) => [
          ...prev,
          { materialId, quantity: perUnitQty },
        ]);

        // Предупреждаем, если сырья может быть недостаточно (но НЕ блокируем добавление)
        if (material) {
          const availableQty = Number(material.quantity || 0);
          const requestedQty = Number(perUnitQty || 0);
          const units = Number(product.quantity || 0);
          const totalNeeded = requestedQty * units;

          // Показываем предупреждение только если:
          // 1. Количество товара указано (units > 0)
          // 2. Требуется больше, чем доступно
          // Но добавление НЕ блокируется!
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
      // Защита от отсутствия ID
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

      // Проверка доступного количества (только если указано количество товара)
      const availableQty = Number(material?.quantity || 0);
      const requestedQty = Number(qty || 0);
      const units = Number(product.quantity || 0);
      const totalNeeded = requestedQty * units;

      // Блокируем только если количество товара указано и сырья действительно недостаточно
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

      // Разрешаем изменение, если количество товара не указано (пользователь может указать позже)
      setRecipeItems((prev) =>
        prev.map((it) =>
          String(it.materialId) === key ? { ...it, quantity: qty } : it,
        ),
      );
    },
    [materials, product],
  );

  const removeRecipeItem = useCallback((materialId) => {
    const key = String(materialId);
    setRecipeItems((prev) =>
      prev.filter((it) => String(it.materialId) !== key),
    );
  }, []);

  // ВАЖНО: recipeItems[].quantity — это qty_per_unit (расход на 1 ед. товара),
  // поэтому НЕ синхронизируем его с количеством готового товара.

  // валидатор товара
  const validateProduct = useCallback(() => {
    const required = [
      ["name", "Название"],
      ["barcode", "Штрихкод"],
      ["price", "Розничная цена"],
      ["quantity", "Количество"],
      ["purchase_price", "Закупочная цена"],
    ];
    const missed = required.filter(
      ([k]) => product[k] === "" || product[k] === null,
    );
    if (missed.length) {
      error("Пожалуйста, заполните все обязательные поля.");
      return false;
    }

    // Долги: срок долга обязателен (только если выбран поставщик)
    if (product.client && dealStatus === "Долги") {
      if (!debtMonths || Number(debtMonths) < 1) {
        error("Укажите срок долга.");
        return false;
      }
    }

    // Предоплата: сумма предоплаты и срок долга обязательны (только если выбран поставщик)
    if (product.client && dealStatus === "Предоплата") {
      if (!prepayment || Number(prepayment) < 0) {
        error("Укажите сумму предоплаты.");
        return false;
      }
      // ВАЖНО: мы покупаем у поставщика => все расчёты идут по закупочной цене
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

    // Проверка количества сырья
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
  ]);

  // submit
  const handleSubmit = async () => {
    setCreateError(null);
    if (!validateProduct()) return;

    // рецепт для списания: [{id, qty_per_unit}]
    // API допускает не более 3 знаков после запятой — округляем, чтобы избежать 84072.79999999999
    const roundTo3 = (v) => Math.round(Number(v) * 1000) / 1000;
    const recipe = recipeItems
      .map((it) => ({
        id: String(it.materialId),
        qty_per_unit: roundTo3(it.quantity || 0),
      }))
      .filter((r) => r.qty_per_unit > 0);

    // сколько ед. готового товара делаем
    const units = Number(product.quantity || 0);

    // item_make — только ID
    const item_make = recipeItems.map((it) => it.materialId);

    setCreating(true);
    try {
      if (product.client !== "" && dealStatus !== "Полная оплата") {
        // ВАЖНО: расчёт суммы для поставщика — по закупочной цене (а не по розничной)
        const purchaseTotal =
          effectivePurchasePricePerUnit * Number(product.quantity || 0);
        const result = await dispatch(
          createDeal({
            clientId: product.client,
            title: dealStatus, // заголовок
            statusRu: dealStatus, // маппинг в kind внутри thunk
            amount: purchaseTotal,
            // prepayment только при "Предоплата"
            prepayment:
              dealStatus === "Предоплата" ? Number(prepayment) : undefined,
            // debtMonths и для "Долги", и для "Предоплата"
            debtMonths:
              dealStatus === "Долги" || dealStatus === "Предоплата"
                ? Number(debtMonths)
                : undefined,
          }),
        ).unwrap();
      }

      // создание товара
      const payload = {
        name: product.name,
        barcode: product.barcode,
        brand_name: product.brand_name,
        category_name: product.category_name,
        price: Number(product.price || 0),
        quantity: Number(product.quantity || 0),
        client: product.client, // id поставщика
        purchase_price: roundTo3(effectivePurchasePricePerUnit),
        stock: Boolean(product.stock), // Акционный товар
        // Новый формат (см. docs/PRODUCTION_FINISHED_GOODS_RECIPE_AND_AUTO_CONSUMPTION_API.md)
        // Backend сам списывает/возвращает сырьё по дельте.
        recipe,
        // Оставляем item_make для совместимости/поиска на бэке (можно удалить, когда бэк перейдёт полностью на recipe)
        item_make,
      };

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

      // Загрузка изображений (после создания товара)
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
              // quantity опционально — если потребуется
              return api.post(`/main/products/${newId}/images/`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
              });
            });
          if (uploads.length) await Promise.allSettled(uploads);
        }
      } catch (e) {
        console.warn("Загрузка изображений не удалась:", e);
        // не блокируем основной флоу
      }
      alert("Товар добавлен!", () => {
        onClose?.();
        setCreating(false);
        onSaveSuccess?.();
      });
    } catch (err) {
      setCreating(false);
      setCreateError(err);
      console.log("ERERERRR", err);

      error(validateResErrors(err, "Ошибка при добавлении товара"));
    }
  };

  // актуализируем данные по кассе при изменениях
  useEffect(() => {
    const purchaseTotal =
      effectivePurchasePricePerUnit * Number(product.quantity || 0);
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: product.name,
      // по смыслу это закупка (расход) => сумма по закупочной цене
      amount:
        recipeItems.length === 0 && purchaseTotal
          ? purchaseTotal.toFixed(2)
          : "",
    }));
  }, [product, recipeItems, selectCashBox, effectivePurchasePricePerUnit]);

  return (
    <div className="prod-goods-page">
      <div className="prod-goods-page__header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="prod-goods-page__back" onClick={onClose}>
            <ArrowLeft size={16} />
            Назад
          </button>
          <div className="prod-goods-page__title-section">
            <div className="prod-goods-page__icon">
              <Plus size={24} />
            </div>
            <div>
              <h1 className="prod-goods-page__title">Добавление товара</h1>
              <p className="prod-goods-page__subtitle">
                Производство - готовая продукция
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="prod-goods-page__content !p-0">
        <div
          className={`finished-goods-add-modal${isPage ? " finished-goods-add-modal--page" : ""}`}
        >
          {!isPage && (
            <div
              className="finished-goods-add-modal__overlay"
              onClick={onClose}
            />
          )}
          <div
            className="finished-goods-add-modal__content"
            style={
              isPage
                ? {
                    position: "static",
                    transform: "none",
                    width: "100%",
                    maxWidth: "1200px",
                    margin: "24px auto",
                    boxShadow: "none",
                  }
                : undefined
            }
          >
            {/* <div className="finished-goods-add-modal__header">
              <h3>Добавление товара</h3>
              {!isPage && (
                <button
                  className="finished-goods-add-modal__close-icon"
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              )}
            </div> */}
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => e.preventDefault()}
            >
              {createError && (
                <p className="finished-goods-add-modal__error-message">
                  Ошибка добавления: {createError.message || "ошибка"}
                </p>
              )}

              {/* Основные поля */}
              <div className="finished-goods-add-modal__section">
                <label>Название *</label>
                <input
                  name="name"
                  className="finished-goods-add-modal__input"
                  placeholder="Например, Буханка хлеба"
                  value={product.name}
                  onChange={onProductChange}
                  required
                />
              </div>

              <div className="finished-goods-add-modal__section">
                <label>Штрих код *</label>
                <input
                  name="barcode"
                  className="finished-goods-add-modal__input"
                  placeholder="Штрих код"
                  value={product.barcode}
                  onChange={onProductChange}
                  required
                />
              </div>

              <div className="finished-goods-add-modal__section">
                <label>Бренд *</label>
                <select
                  name="brand_name"
                  className="finished-goods-add-modal__input"
                  value={product.brand_name}
                  onChange={onProductChange}
                  required
                >
                  <option value="">-- Выберите бренд --</option>
                  {categories &&
                    brands?.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="finished-goods-add-modal__section">
                <label>Категория *</label>
                <select
                  name="category_name"
                  className="finished-goods-add-modal__input"
                  value={product.category_name}
                  onChange={onProductChange}
                  required
                >
                  <option value="">-- Выберите категорию --</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Поставщик + быстрое создание */}
              <div className="finished-goods-add-modal__section">
                <label>Поставщик</label>
                <select
                  name="client"
                  className="finished-goods-add-modal__input"
                  value={product.client}
                  onChange={onProductChange}
                >
                  <option value="">-- Выберите поставщика --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>

                <button
                  className="create-client"
                  onClick={() => setShowSupplierForm((v) => !v)}
                >
                  {showSupplierForm ? "Отменить" : "Создать поставщика"}
                </button>

                {showSupplierForm && (
                  <form
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      rowGap: "10px",
                    }}
                    onSubmit={createSupplier}
                  >
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      placeholder="ФИО"
                      name="full_name"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="llc"
                      placeholder="ОсОО"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="inn"
                      placeholder="ИНН"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="okpo"
                      placeholder="ОКПО"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="score"
                      placeholder="Р/СЧЁТ"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="bik"
                      placeholder="БИК"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="address"
                      placeholder="Адрес"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="text"
                      name="phone"
                      placeholder="Телефон"
                    />
                    <input
                      className="finished-goods-add-modal__input"
                      onChange={onSupplierChange}
                      type="email"
                      name="email"
                      placeholder="Почта"
                    />
                    <div style={{ display: "flex", columnGap: "10px" }}>
                      <button
                        className="create-client"
                        type="button"
                        onClick={() => setShowSupplierForm(false)}
                      >
                        Отмена
                      </button>
                      <button className="create-client">Создать</button>
                    </div>
                  </form>
                )}
              </div>

              {product.client && (
                <>
                  <div className="finished-goods-add-modal__section">
                    <label>Тип оплаты *</label>
                    <select
                      name="category_name"
                      className="finished-goods-add-modal__input"
                      value={dealStatus}
                      onChange={(e) => setDealStatus(e.target.value)}
                    >
                      <option value="Полная оплата">Полная оплата</option>
                      {DEAL_STATUS_RU?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {dealStatus === "Долги" && (
                    <div className="finished-goods-add-modal__section">
                      <label>Срок долга *</label>
                      <input
                        className="finished-goods-add-modal__input"
                        type="number"
                        min={1}
                        step={1}
                        value={debtMonths}
                        onChange={(e) => setDebtMonths(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="Например, 6"
                        required
                      />
                    </div>
                  )}

                  {dealStatus === "Предоплата" && (
                    <>
                      <div className="finished-goods-add-modal__section">
                        <label>Предоплата *</label>
                        <input
                          className="finished-goods-add-modal__input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={prepayment}
                          onChange={(e) => setPrepayment(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="Сумма предоплаты"
                          required
                        />
                      </div>
                      <div className="finished-goods-add-modal__section">
                        <label>Срок долга *</label>
                        <input
                          className="finished-goods-add-modal__input"
                          type="number"
                          min={1}
                          step={1}
                          value={debtMonths}
                          onChange={(e) => setDebtMonths(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="Например, 6"
                          required
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Цена и количество */}
              <div className="finished-goods-add-modal__section">
                <label>Розничная цена *</label>
                <input
                  type="number"
                  name="price"
                  className="finished-goods-add-modal__input"
                  placeholder="120"
                  value={product.price}
                  onChange={onProductChange}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              {/* Фото (динамические) */}

              <div className="finished-goods-add-modal__section">
                <label>Закупочная цена *</label>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                <input
                  type="number"
                  name="purchase_price"
                  className="finished-goods-add-modal__input"
                  placeholder="110"
                  value={product.purchase_price}
                  onChange={onProductChange}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  step="0.01"
                  required
                />
                  <button
                    type="button"
                    className="create-client"
                    onClick={recalculatePurchasePriceFromRecipe}
                  >
                    Пересчитать
                  </button>
                </div>
                {recipeItems.length > 0 && (
                  <small style={{ opacity: 0.75 }}>
                    Сырьё по рецепту: {recipeMaterialCostPerUnit.toFixed(2)} |
                    Итоговая закупочная цена:{" "}
                    {effectivePurchasePricePerUnit.toFixed(2)}
                  </small>
                )}
              </div>

              <div className="finished-goods-add-modal__section">
                <label>Количество *</label>
                <input
                  type="number"
                  name="quantity"
                  className="finished-goods-add-modal__input"
                  placeholder="100"
                  value={product.quantity}
                  onChange={onProductChange}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  required
                />
              </div>

              <div className="finished-goods-add-modal__section">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="stock"
                    checked={product.stock}
                    onChange={onProductChange}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <span>Акционный товар</span>
                </label>
              </div>
              <div className="finished-goods-add-modal__section">
                <label>Фото товара</label>
                <button
                  type="button"
                  className="create-client"
                  onClick={addImageSlot}
                  style={{ marginBottom: 10 }}
                >
                  + Добавить картинку
                </button>
                {images.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 12,
                    }}
                  >
                    {images.map((im, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px dashed #ccc",
                          borderRadius: 8,
                          padding: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 6,
                            gap: 8,
                          }}
                        >
                          <span style={{ opacity: 0.8 }}>Фото #{idx + 1}</span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <input
                                type="radio"
                                name="primary_image"
                                checked={Boolean(im.is_primary)}
                                onChange={() => handlePrimarySelect(idx)}
                              />
                              Главная
                            </label>
                            <button
                              type="button"
                              className="select-materials__remove"
                              onClick={() => removeImageSlot(idx)}
                              aria-label="Удалить изображение"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                border: "1px solid var(--border,#444)",
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {/* <input
                  type="file"
                  accept="image/*"
                  className="finished-goods-add-modal__input"
                  onChange={(e) =>
                    handleImageChange(idx, e.target.files?.[0] || null)
                  }
                /> */}
                        <FileInput
                          onChange={(e) =>
                            handleImageChange(idx, e.target.files?.[0] || null)
                          }
                          accept={`image/*`}
                          name="image"
                          label="Image"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Состав (сырьё) */}
              <div className="finished-goods-add-modal__section">
                <div
                  className="select-materials__head"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <label>Состав (сырьё)</label>
                  <button
                    type="button"
                    className="create-client"
                    onClick={() => setMaterialsOpen((prev) => !prev)}
                    disabled={materialsLoading}
                  >
                    {materialsOpen
                      ? "Скрыть список"
                      : materialsLoading
                        ? "Загрузка…"
                        : "+ Добавить сырьё"}
                  </button>
                </div>

                {materialsOpen && (
                  <div
                    className="select-materials__head-search"
                    style={{ marginTop: 8 }}
                  >
                    <input
                      className="finished-goods-add-modal__input"
                      name="materialQuery"
                      placeholder="Поиск сырья"
                      value={materialQuery}
                      onChange={(e) => setMaterialQuery(e.target.value)}
                    />
                  </div>
                )}

                {materialsOpen && (
                  <div
                    className="select-materials__check active"
                    style={{
                      marginTop: 8,
                      position: "relative",
                      maxHeight: 260,
                      overflow: "auto",
                      border: "1px solid var(--border,#333)",
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    {filteredMaterials?.map((m) => {
                      try {
                        const materialId = m.id;
                        const materialKey = String(materialId);
                        const checked = recipeMap.has(materialKey);
                        const qty = recipeMap.get(materialKey) ?? "";
                        const availableQty = Number(m.quantity || 0);
                        const requestedQty = Number(qty || 0);
                        const units = Number(product.quantity || 0);
                        const totalNeeded = requestedQty * units;
                        const isInsufficient =
                          checked && totalNeeded > availableQty;
                        const isOutOfStock = availableQty <= 0;

                        return (
                          <div
                            key={materialId}
                            className="select-materials__item"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              // Не переключать при клике по полю количества
                              if (e.target.closest?.(".MuiTextField-root"))
                                return;
                              if (isOutOfStock && !checked) return;
                              toggleRecipeItem(materialId);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (e.target.closest?.(".MuiTextField-root"))
                                  return;
                                if (isOutOfStock && !checked) return;
                                toggleRecipeItem(materialId);
                              }
                            }}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto 1fr 160px",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 4px",
                              backgroundColor: isInsufficient
                                ? "#ffebee"
                                : "transparent",
                              opacity: isOutOfStock && !checked ? 0.6 : 1,
                              cursor: "pointer",
                            }}
                          >
                            <Checkbox
                              icon={
                                <CheckBoxOutlineBlankIcon
                                  sx={{ fontSize: 28 }}
                                />
                              }
                              checkedIcon={
                                <CheckBoxIcon sx={{ fontSize: 28 }} />
                              }
                              checked={checked}
                              onClick={(e) => {
                                e.preventDefault();
                                if (isOutOfStock && !checked) return;
                                // Даём клику всплыть до строки — переключение через onClick строки
                                // (на десктопе клик часто попадает по иконке, а не по input)
                              }}
                              sx={{
                                color: "#000",
                                "&.Mui-checked": { color: "#f9cf00" },
                                pointerEvents: "auto",
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                            >
                              <p
                                title={m.name || m.title || `#${materialId}`}
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  margin: 0,
                                }}
                              >
                                {m.name || m.title || `#${materialId}`}
                              </p>
                              <small
                                style={{
                                  fontSize: "11px",
                                  opacity: 0.7,
                                  color: isInsufficient ? "#d32f2f" : "inherit",
                                }}
                              >
                                Доступно: {availableQty}
                                {isOutOfStock && !checked && (
                                  <span style={{ color: "#d32f2f" }}>
                                    {" "}
                                    | Нет остатка
                                  </span>
                                )}
                                {checked && units > 0 && (
                                  <span
                                    style={{
                                      color: isInsufficient
                                        ? "#d32f2f"
                                        : "#666",
                                    }}
                                  >
                                    {" "}
                                    | Нужно: {totalNeeded}
                                    {isInsufficient && " ⚠️"}
                                  </span>
                                )}
                              </small>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <TextField
                                size="small"
                                placeholder="Кол-во"
                                type="number"
                                inputProps={{
                                  step: "0.0001",
                                  min: "0",
                                  max:
                                    units > 0
                                      ? availableQty / units
                                      : undefined,
                                  onWheel: (e) => e.currentTarget.blur(),
                                }}
                                disabled={!checked}
                                value={qty}
                                onChange={(e) =>
                                  changeRecipeQty(materialId, e.target.value)
                                }
                                error={isInsufficient}
                                helperText={
                                  isInsufficient
                                    ? `Недостаточно! Нужно ${totalNeeded}, доступно ${availableQty}`
                                    : ""
                                }
                              />
                            </div>
                          </div>
                        );
                      } catch (error) {
                        // Пропускаем проблемный материал, но не блокируем остальные
                        return null;
                      }
                    })}
                    {(!filteredMaterials || filteredMaterials.length === 0) &&
                      !materialsLoading && (
                        <div style={{ padding: 8, opacity: 0.7 }}>
                          Ничего не найдено…
                        </div>
                      )}
                  </div>
                )}

                {recipeItems.length > 0 && (
                  <div
                    className="select-materials__selected"
                    style={{ marginTop: 10 }}
                  >
                    {recipeItems.map((it) => {
                      const mat = (
                        Array.isArray(materials) ? materials : []
                      ).find((m) => String(m.id) === String(it.materialId));
                      const availableQty = Number(mat?.quantity || 0);
                      const requestedQty = Number(it.quantity || 0);
                      const units = Number(product.quantity || 0);
                      const totalNeeded = requestedQty * units;
                      const isInsufficient = totalNeeded > availableQty;

                      return (
                        <div
                          key={it.materialId}
                          className="select-materials__selected-item"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 160px 40px",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 0",
                            borderBottom: "1px dashed var(--border,#444)",
                            backgroundColor: isInsufficient
                              ? "#ffebee"
                              : "transparent",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Checkbox
                                checked
                                onChange={() => removeRecipeItem(it.materialId)}
                                sx={{
                                  color: "#000",
                                  "&.Mui-checked": { color: "#f9cf00" },
                                }}
                              />
                              <p style={{ margin: 0 }}>
                                {mat?.name ??
                                  mat?.title ??
                                  `ID ${it.materialId}`}
                              </p>
                            </div>
                            <small
                              style={{
                                fontSize: "11px",
                                opacity: 0.7,
                                color: isInsufficient ? "#d32f2f" : "inherit",
                                marginLeft: "40px",
                              }}
                            >
                              Доступно: {availableQty}
                              {units > 0 && (
                                <span
                                  style={{
                                    color: isInsufficient ? "#d32f2f" : "#666",
                                  }}
                                >
                                  {" "}
                                  | Нужно: {totalNeeded}
                                  {isInsufficient && " ⚠️ Недостаточно!"}
                                </span>
                              )}
                            </small>
                          </div>
                          <TextField
                            size="small"
                            placeholder="Кол-во"
                            type="number"
                            inputProps={{
                              step: "0.0001",
                              min: "0",
                              max: availableQty / (units || 1),
                              onWheel: (e) => e.currentTarget.blur(),
                            }}
                            value={it.quantity}
                            onChange={(e) =>
                              changeRecipeQty(it.materialId, e.target.value)
                            }
                            error={isInsufficient}
                            helperText={
                              isInsufficient
                                ? `Нужно ${totalNeeded}, есть ${availableQty}`
                                : ""
                            }
                          />
                          <button
                            type="button"
                            className="select-materials__remove"
                            onClick={() => removeRecipeItem(it.materialId)}
                            aria-label="Удалить"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              border: "1px solid var(--border,#444)",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Кнопки */}
              <div className="finished-goods-add-modal__footer">
                <button
                  className="finished-goods-add-modal__cancel"
                  onClick={onClose}
                  disabled={creating}
                >
                  Отмена
                </button>
                <button
                  className="finished-goods-add-modal__save"
                  onClick={handleSubmit}
                  disabled={creating || materialsLoading}
                >
                  {creating ? "Добавление..." : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionFinishedGoodsAddPage;
