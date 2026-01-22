// src/pages/Warehouse/FinishedGoods/FinishedGoods.jsx
import {
  MoreVertical,
  Plus,
  X,
  Search,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

/* ---- Thunks / Creators ---- */
import {
  consumeItemsMake,
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
import { useAlert, useConfirm, useErrorModal } from "../../../../hooks/useDialog";
import usePlurize from "../../../../hooks/usePlurize";

/* ============================================================
   Модалка добавления товара (Redux, без localStorage)
   ============================================================ */
const AddModal = ({ onClose, onSaveSuccess, selectCashBox }) => {
  const error = useErrorModal()
  const alert = useAlert()
  const dispatch = useDispatch();
  // Категории/бренды из product slice
  const { categories, brands } = useProducts();

  // Сырьё
  const materials = useSelector((s) => s.product?.itemsMake ?? []);
  const materialsLoading =
    useSelector(
      (s) => s.product?.itemsMakeLoading ?? s.product?.loadingItemsMake
    ) ?? false;

  // Поставщики
  const { list: clients } = useClient();
  const suppliers = useMemo(
    () => (clients || []).filter((c) => c.type === "suppliers"),
    [clients]
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
    purchase_price: "",
    stock: false, // Акционный товар
  });

  // Изображения (динамически добавляемые)
  const [images, setImages] = useState([]);

  const handleImageChange = useCallback((idx, file) => {
    setImages((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, file } : it))
    );
  }, []);

  // const handleImageAltChange = (idx, alt) => {
  //   setImages((prev) => prev.map((it, i) => (i === idx ? { ...it, alt } : it)));
  // };

  const handlePrimarySelect = useCallback((idx) => {
    setImages((prev) =>
      prev.map((it, i) => ({ ...it, is_primary: i === idx }))
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
  const [dealStatus, setDealStatus] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [prepayment, setPrepayment] = useState("");

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
      (m) => m && m.id != null
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

    // quantity и price удобно хранить строкой (пустое значение тоже валидно)
    if (name === "quantity" || name === "price" || name === "purchase_price") {
      setProduct((prev) => ({ ...prev, [name]: value }));
      return;
    }

    setProduct((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  }, []);

  const onSupplierChange = useCallback((e) => {
    const { name, value } = e.target;
    setSupplier((prev) => ({ ...prev, [name]: value }));
  }, []);

  const createSupplier = async (e) => {
    e.preventDefault();
    if (!supplier.full_name?.trim()) {
      alert("Укажите ФИО поставщика");
      return;
    }
    try {
      await dispatch(createClientAsync(supplier)).unwrap();
      setShowSupplierForm(false);
    } catch (err) {
      alert(`Не удалось создать поставщика: ${err?.message || "ошибка"}`);
    }
  };

  // Рецепт — выбор/изменение/удаление
  // ВАЖНО: Добавление сырья ВСЕГДА разрешено, независимо от:
  // - количества сырья на складе (даже если 0)
  // - количества товара (можно добавить до указания количества)
  // - недостаточности сырья (показывается предупреждение, но не блокируется)
  const toggleRecipeItem = (materialId) => {
    // Защита от отсутствия ID
    if (materialId === null || materialId === undefined || materialId === "") {
      return;
    }

    // Всегда используем строковое представление для консистентности
    const key = String(materialId);
    const exists = recipeMap.has(key);

    if (exists) {
      // Удаление из списка
      setRecipeItems((prev) =>
        prev.filter((it) => String(it.materialId) !== key)
      );
    } else {
      // ДОБАВЛЕНИЕ: всегда разрешено
      // При добавлении ставим количество как у товара, или "1" если количество товара не указано
      const syncedQty = String(product.quantity || "1");
      const material = (Array.isArray(materials) ? materials : []).find(
        (m) => m && m.id != null && String(m.id) === key
      );

      // Добавляем сырье (всегда разрешено, даже если материал не найден в списке)
      // Сохраняем materialId как есть (может быть строкой или UUID), но при сравнении всегда используем строку
      setRecipeItems((prev) => [...prev, { materialId, quantity: syncedQty }]);

      // Предупреждаем, если сырья может быть недостаточно (но НЕ блокируем добавление)
      if (material) {
        const availableQty = Number(material.quantity || 0);
        const requestedQty = Number(syncedQty || 0);
        const units = Number(product.quantity || 0);
        const totalNeeded = requestedQty * units;

        // Показываем предупреждение только если:
        // 1. Количество товара указано (units > 0)
        // 2. Требуется больше, чем доступно
        // Но добавление НЕ блокируется!
        if (units > 0 && totalNeeded > availableQty) {
          setTimeout(() => {
            alert(
              `Внимание: может быть недостаточно сырья "${
                material.name || material.title || `#${material.id}`
              }"!\n` +
                `Доступно: ${availableQty}\n` +
                `Требуется: ${totalNeeded} (${requestedQty} × ${units} единиц товара)\n\n` +
                `Вы можете изменить количество сырья в списке выбранных материалов.`
            );
          }, 100);
        }
      }
    }
  };

  const changeRecipeQty = useCallback((materialId, qty) => {
    // Защита от отсутствия ID
    if (materialId === null || materialId === undefined || materialId === "") {
      return;
    }

    const key = String(materialId);
    const material = (Array.isArray(materials) ? materials : []).find(
      (m) => m && m.id != null && String(m.id) === key
    );

    // Проверка доступного количества (только если указано количество товара)
    const availableQty = Number(material?.quantity || 0);
    const requestedQty = Number(qty || 0);
    const units = Number(product.quantity || 0);
    const totalNeeded = requestedQty * units;

    // Блокируем только если количество товара указано и сырья действительно недостаточно
    if (material && units > 0 && totalNeeded > availableQty) {
      alert(
        `Недостаточно сырья "${
          material.name || material.title || `#${material.id}`
        }"!\n` +
          `Доступно: ${availableQty}\n` +
          `Требуется: ${totalNeeded} (${requestedQty} × ${units} единиц товара)\n\n` +
          `Пожалуйста, уменьшите количество сырья или количество товара.`
      );
      return;
    }

    // Разрешаем изменение, если количество товара не указано (пользователь может указать позже)
    setRecipeItems((prev) =>
      prev.map((it) =>
        String(it.materialId) === key ? { ...it, quantity: qty } : it
      )
    );
  }, [materials, product]);

  const removeRecipeItem = useCallback((materialId) => {
    const key = String(materialId);
    setRecipeItems((prev) =>
      prev.filter((it) => String(it.materialId) !== key)
    );
  }, []);

  // НОВОЕ: авто-синхронизация количества сырья при изменении количества товара
  useEffect(() => {
    const syncedQty = String(product.quantity ?? "");
    setRecipeItems((prev) =>
      prev.map((it) => ({ ...it, quantity: syncedQty }))
    );
  }, [product.quantity]);

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
      ([k]) => product[k] === "" || product[k] === null
    );
    if (missed.length) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return false;
    }

    // Проверка количества сырья
    const units = Number(product.quantity || 0);
    if (recipeItems.length > 0 && units > 0) {
      for (const recipeItem of recipeItems) {
        const material = (Array.isArray(materials) ? materials : []).find(
          (m) => String(m.id) === String(recipeItem.materialId)
        );

        if (!material) {
          alert(`Сырьё с ID ${recipeItem.materialId} не найдено.`);
          return false;
        }

        const availableQty = Number(material.quantity || 0);
        const requestedQty = Number(recipeItem.quantity || 0);
        const totalNeeded = requestedQty * units;

        if (totalNeeded > availableQty) {
          alert(
            `Недостаточно сырья "${
              material.name || material.title || `#${material.id}`
            }"!\n` +
              `Доступно: ${availableQty}\n` +
              `Требуется: ${totalNeeded} (${requestedQty} × ${units} единиц товара)`
          );
          return false;
        }
      }
    }

    return true;
  }, [product, recipeItems, materials]);

  // submit
  const handleSubmit = async () => {
    setCreateError(null);
    if (!validateProduct()) return;

    // рецепт для списания: [{id, qty_per_unit}]
    // ВАЖНО: сейчас quantity у сырья = общему количеству товара,
    // если нужно списывать на весь объём, можно интерпретировать как "на 1 ед."
    // и умножать на units (ниже уже есть логика units).
    const recipe = recipeItems
      .map((it) => ({
        id: String(it.materialId),
        qty_per_unit: Number(it.quantity || 0),
      }))
      .filter((r) => r.qty_per_unit > 0);

    // сколько ед. готового товара делаем
    const units = Number(product.quantity || 0);

    // item_make — только ID
    const item_make = recipeItems.map((it) => it.materialId);

    setCreating(true);
    try {
      // списание сырья
      if (recipe.length && units > 0) {
        await dispatch(consumeItemsMake({ recipe, units })).unwrap();
      }

      if (product.client !== "") {
        const result = await dispatch(
          createDeal({
            clientId: product.client,
            title: dealStatus, // заголовок
            statusRu: dealStatus, // маппинг в kind внутри thunk
            amount: product.price * product.quantity,
            // prepayment только при "Предоплата"
            prepayment:
              dealStatus === "Предоплата" ? Number(prepayment) : undefined,
            // debtMonths и для "Долги", и для "Предоплата"
            debtMonths:
              dealStatus === "Долги" || dealStatus === "Предоплата"
                ? Number(debtMonths)
                : undefined,
          })
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
        purchase_price: product.purchase_price,
        stock: Boolean(product.stock), // Акционный товар
        item_make,
      };

      const created = await dispatch(createProductAsync(payload)).unwrap();

      await dispatch(
        addCashFlows({
          ...cashData,
          amount: (product?.purchase_price * product?.quantity).toFixed(2),
          source_cashbox_flow_id: created.id,
        })
      ).unwrap();

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
      alert('Товар добавлен!', () => {
        onClose?.();
        setCreating(false);
        onSaveSuccess?.();
      })
    } catch (err) {
      setCreating(false);
      setCreateError(err);
      alert(
        `Ошибка при добавлении товара: ${err?.message || "неизвестная ошибка"}`
      );
    }
  };

  // актуализируем данные по кассе при изменениях
  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: product.name,
      amount: product.price,
    }));
  }, [product, selectCashBox]);

  /* ------------------------ Верстка ------------------------ */
  return (
    <div className="finished-goods-add-modal">
      <div className="finished-goods-add-modal__overlay" onClick={onClose} />
      <div className="finished-goods-add-modal__content">
        <div className="finished-goods-add-modal__header">
          <h3>Добавление товара</h3>
          <button
            className="finished-goods-add-modal__close-icon"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

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
          <label>Поставщик *</label>
          <select
            name="client"
            className="finished-goods-add-modal__input"
            value={product.client}
            onChange={onProductChange}
            required
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

        <div className="finished-goods-add-modal__section">
          <label>Тип оплаты *</label>
          <select
            name="category_name"
            className="finished-goods-add-modal__input"
            value={dealStatus}
            onChange={(e) => setDealStatus(e.target.value)}
            required
          >
            <option value="">-- Выберите тип оплаты --</option>
            {DEAL_STATUS_RU?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {dealStatus === "Долги" && (
          <div className="finished-goods-add-modal__section">
            <label>Срок долга</label>
            <input
              className="finished-goods-add-modal__input"
              type="number"
              min={1}
              step={1}
              value={debtMonths}
              onChange={(e) => setDebtMonths(e.target.value)}
              placeholder="Например, 6"
            />
          </div>
        )}

        {dealStatus === "Предоплата" && (
          <>
            <div className="finished-goods-add-modal__section">
              <label>Предоплата</label>
              <input
                className="finished-goods-add-modal__input"
                type="number"
                min={1}
                step={1}
                value={prepayment}
                onChange={(e) => setPrepayment(e.target.value)}
                placeholder="Сумма предоплаты"
              />
            </div>
            <div className="finished-goods-add-modal__section">
              <label>Срок долга</label>
              <input
                className="finished-goods-add-modal__input"
                type="number"
                min={1}
                step={1}
                value={debtMonths}
                onChange={(e) => setDebtMonths(e.target.value)}
                placeholder="Например, 6"
              />
            </div>
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
            min="0"
            step="0.01"
            required
          />
        </div>

        {/* Фото (динамические) */}

        <div className="finished-goods-add-modal__section">
          <label>Закупочная цена *</label>
          <input
            type="number"
            name="purchase_price"
            className="finished-goods-add-modal__input"
            placeholder="110"
            value={product.purchase_price}
            onChange={onProductChange}
            min="0"
            step="0.01"
            required
          />
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
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
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
              {
                filteredMaterials
                  ?.map((m) => {
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

                      return (
                        <div
                          key={materialId}
                          className="select-materials__item"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr 160px",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 4px",
                            backgroundColor: isInsufficient
                              ? "#ffebee"
                              : "transparent",
                          }}
                        >
                          <Checkbox
                            icon={
                              <CheckBoxOutlineBlankIcon sx={{ fontSize: 28 }} />
                            }
                            checkedIcon={<CheckBoxIcon sx={{ fontSize: 28 }} />}
                            checked={checked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleRecipeItem(materialId);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            sx={{
                              color: "#000",
                              "&.Mui-checked": { color: "#f9cf00" },
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
                              {checked && units > 0 && (
                                <span
                                  style={{
                                    color: isInsufficient ? "#d32f2f" : "#666",
                                  }}
                                >
                                  {" "}
                                  | Нужно: {totalNeeded}
                                  {isInsufficient && " ⚠️"}
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
                              max: units > 0 ? availableQty / units : undefined,
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
                      );
                    } catch (error) {
                      // Пропускаем проблемный материал, но не блокируем остальные
                      return null;
                    }
                  })
              }
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
                const mat = (Array.isArray(materials) ? materials : []).find(
                  (m) => String(m.id) === String(it.materialId)
                );
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
                          {mat?.name ?? mat?.title ?? `ID ${it.materialId}`}
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
      </div>
    </div>
  );
};

/* ============================================================
   Модалка редактирования товара
   ============================================================ */
const EditModal = ({ item, onClose, onSaveSuccess, onDeleteConfirm }) => {
  const dispatch = useDispatch();
  const alert = useAlert()
  const confirm = useConfirm()
  const { updating, updateError, deleting, deleteError } = useSelector(
    (state) => state.product
  );

  const { brands, categories } = useProducts();
  const { list } = useClient();
  const filterClient1 = (list || []).filter((c) => c.type === "suppliers");

  // Нормализуем имена полей, чтобы соответствовали select'ам: brand_name / category_name
  const [editedItem, setEditedItem] = useState({
    id: item.id || "",
    name: item.name || "",
    barcode: item.barcode || "",
    brand_name: item.brand_name || item.brand || "",
    category_name: item.category_name || item.category || "",
    client: item.client || "",
    price: item.price ?? "",
    purchase_price: item.purchase_price ?? "",
    quantity: item.quantity ?? "",
    stock: item.stock ?? false, // Акционный товар
  });

  // Состояние для изображений
  // existingImages: [{ id, image, alt, is_primary }] - существующие изображения с сервера
  // newImages: [{ file, alt, is_primary }] - новые изображения для загрузки
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  // Загрузка существующих изображений
  useEffect(() => {
    const loadImages = async () => {
      if (!item?.id) return;
      setImagesLoading(true);
      try {
        const response = await api.get(`/main/products/${item.id}/images/`);
        // Поддержка разных форматов ответа: массив или объект с results
        const imagesData = response.data?.results || response.data || [];
        setExistingImages(Array.isArray(imagesData) ? imagesData : []);
      } catch (error) {
        console.error("Ошибка загрузки изображений:", error);
        // Если изображений нет, это не критично
        setExistingImages([]);
      } finally {
        setImagesLoading(false);
      }
    };
    loadImages();
  }, [item?.id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Обработка чекбоксов
    if (type === "checkbox") {
      setEditedItem((prevData) => ({
        ...prevData,
        [name]: checked,
      }));
      return;
    }

    setEditedItem((prevData) => ({
      ...prevData,
      [name]: type === "number" ? (value === "" ? "" : value) : value,
    }));
  };

  // Обработчики для существующих изображений
  const handleDeleteExistingImage = (imageId) => {
    confirm("Удалить это изображение?", async (result) => {
      if (result) {
        try {
          await api.delete(`/main/products/${item.id}/images/${imageId}/`);
          setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
        } catch (error) {
          console.error("Ошибка удаления изображения:", error);
          alert("Не удалось удалить изображение", null, true);
        }
      }
    })
  };

  const handleSetPrimaryExisting = async (imageId) => {
    try {
      await api.patch(`/main/products/${item.id}/images/${imageId}/`, {
        is_primary: true,
      });
      // Обновляем локальное состояние
      setExistingImages((prev) =>
        prev.map((img) => ({
          ...img,
          is_primary: img.id === imageId,
        }))
      );
    } catch (error) {
      console.error("Ошибка установки главного изображения:", error);
      alert("Не удалось установить главное изображение");
    }
  };

  // Обработчики для новых изображений
  const handleNewImageChange = (idx, file) => {
    setNewImages((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, file } : it))
    );
  };

  const handleNewImageAltChange = (idx, alt) => {
    setNewImages((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, alt } : it))
    );
  };

  const handleNewPrimarySelect = (idx) => {
    setNewImages((prev) =>
      prev.map((it, i) => ({ ...it, is_primary: i === idx }))
    );
    // Также снимаем главное с существующих
    setExistingImages((prev) =>
      prev.map((it) => ({ ...it, is_primary: false }))
    );
  };

  const addNewImageSlot = () => {
    setNewImages((prev) => {
      const hasPrimary = prev.some((p) => p.is_primary);
      const hasPrimaryExisting = existingImages.some((p) => p.is_primary);
      return [
        ...prev,
        { file: null, alt: "", is_primary: !hasPrimary && !hasPrimaryExisting },
      ];
    });
  };

  const removeNewImageSlot = (idx) => {
    setNewImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // если удалили главное, назначаем первое как главное
      if (next.length && !next.some((p) => p.is_primary)) {
        const hasPrimaryExisting = existingImages.some((p) => p.is_primary);
        if (!hasPrimaryExisting && next.length > 0) {
          next[0] = { ...next[0], is_primary: true };
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      const dataToSave = {
        ...editedItem,
        price: parseFloat(editedItem.price),
        purchase_price: parseFloat(editedItem.purchase_price),
        quantity: parseInt(editedItem.quantity, 10),
      };

      await dispatch(
        updateProductAsync({ productId: item.id, updatedData: dataToSave })
      ).unwrap();

      // Загрузка новых изображений
      try {
        const uploads = newImages
          .filter((im) => im.file)
          .map(async (im) => {
            const fd = new FormData();
            fd.append("image", im.file);
            if (im.alt) fd.append("alt", im.alt || editedItem.name);
            fd.append("is_primary", String(Boolean(im.is_primary)));
            return api.post(`/main/products/${item.id}/images/`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          });
        if (uploads.length) await Promise.allSettled(uploads);
      } catch (e) {
        alert("Загрузка новых изображений не удалась", true);
        // не блокируем основной флоу
      }
      alert('Товар отредактирован!', () => {
        onClose();
        onSaveSuccess?.();
      })
    } catch (err) {
      console.error("Failed to update product:", err);
      alert(
        `Ошибка при обновлении товара: ${err.message || JSON.stringify(err)}`,
        true
      );
    }
  };

  const handleDelete = useCallback(async () => {
    confirm(`Вы уверены, что хотите удалить товар "${item?.name}"?`, async (result) => {
      if (result) {
        try {
          await dispatch(deleteProductAsync(item.id)).unwrap();
          alert('Удалено!', () => {
            onClose();
            onDeleteConfirm?.();
          })
        } catch (err) {
          console.error("Failed to delete product:", err);
          alert(
            `Ошибка при удалении товара: ${err.message || JSON.stringify(err)}`,
            null,
            true
          );
        }
      }
    })
  }, [item]);

  useEffect(() => {
    // Обновим справочники на случай, если не загружены
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  return (
    <div className="product-edit-modal z-50!">
      <div className="product-edit-modal__backdrop" onClick={onClose} />
      <div className="product-edit-modal__container">
        <div className="product-edit-modal__wrapper">
          {/* Header */}
          <header className="product-edit-modal__header">
            <h2 className="product-edit-modal__title">Редактирование товара</h2>
            <button
              type="button"
              className="product-edit-modal__close"
              onClick={onClose}
              aria-label="Закрыть модальное окно"
            >
              <X size={24} />
            </button>
          </header>

          {/* Alerts */}
          {(updateError || deleteError) && (
            <div className="product-edit-modal__alerts">
              {updateError && (
                <div className="product-edit-modal__alert product-edit-modal__alert--error">
                  <span className="product-edit-modal__alert-icon">⚠️</span>
                  <div className="product-edit-modal__alert-content">
                    <strong>Ошибка обновления:</strong>
                    <span>
                      {updateError.message || JSON.stringify(updateError)}
                    </span>
                  </div>
                </div>
              )}
              {deleteError && (
                <div className="product-edit-modal__alert product-edit-modal__alert--error">
                  <span className="product-edit-modal__alert-icon">⚠️</span>
                  <div className="product-edit-modal__alert-content">
                    <strong>Ошибка удаления:</strong>
                    <span>
                      {deleteError.message || JSON.stringify(deleteError)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Content */}
          <div className="product-edit-modal__content">
            <form
              className="product-edit-modal__form"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* Основная информация */}
              <section className="product-edit-modal__group">
                <h3 className="product-edit-modal__group-title">
                  Основная информация
                </h3>

                <div className="product-edit-modal__fields">
                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Название товара{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      className="product-edit-modal__input"
                      value={editedItem.name}
                      onChange={handleChange}
                      placeholder="Введите название товара"
                      required
                    />
                  </div>

                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Штрих-код{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      className="product-edit-modal__input"
                      value={editedItem.barcode}
                      onChange={handleChange}
                      placeholder="Введите штрих-код"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Категория и бренд */}
              <section className="product-edit-modal__group">
                <h3 className="product-edit-modal__group-title">
                  Классификация
                </h3>

                <div className="product-edit-modal__fields">
                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Бренд{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <div className="product-edit-modal__select-wrapper">
                      <select
                        name="brand_name"
                        className="product-edit-modal__select"
                        value={editedItem.brand_name}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Выберите бренд</option>
                        {brands?.map((brand) => (
                          <option key={brand.id} value={brand.name}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Категория{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <div className="product-edit-modal__select-wrapper">
                      <select
                        name="category_name"
                        className="product-edit-modal__select"
                        value={editedItem.category_name}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Выберите категорию</option>
                        {categories?.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Поставщик{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <div className="product-edit-modal__select-wrapper">
                      <select
                        name="client"
                        className="product-edit-modal__select"
                        value={editedItem.client}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Выберите поставщика</option>
                        {filterClient1?.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Цены и количество */}
              <section className="product-edit-modal__group">
                <h3 className="product-edit-modal__group-title">
                  Цены и количество
                </h3>

                <div className="product-edit-modal__fields product-edit-modal__fields--grid">
                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Розничная цена{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <div className="product-edit-modal__input-wrapper">
                      <input
                        type="number"
                        name="price"
                        className="product-edit-modal__input"
                        value={editedItem.price}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                      <span className="product-edit-modal__input-suffix">
                        сом
                      </span>
                    </div>
                  </div>

                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Закупочная цена{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <div className="product-edit-modal__input-wrapper">
                      <input
                        type="number"
                        name="purchase_price"
                        className="product-edit-modal__input"
                        value={editedItem.purchase_price}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                      <span className="product-edit-modal__input-suffix">
                        сом
                      </span>
                    </div>
                  </div>

                  <div className="product-edit-modal__field">
                    <label className="product-edit-modal__label">
                      Количество{" "}
                      <span className="product-edit-modal__required">*</span>
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      className="product-edit-modal__input"
                      value={editedItem.quantity}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Дополнительные настройки */}
              <section className="product-edit-modal__group">
                <h3 className="product-edit-modal__group-title">
                  Дополнительно
                </h3>

                <div className="product-edit-modal__field">
                  <label className="product-edit-modal__checkbox">
                    <input
                      type="checkbox"
                      name="stock"
                      checked={editedItem.stock}
                      onChange={handleChange}
                      className="product-edit-modal__checkbox-input"
                    />
                    <span className="product-edit-modal__checkbox-label">
                      Акционный товар
                    </span>
                  </label>
                </div>
              </section>

              {/* Изображения */}
              <section className="product-edit-modal__group product-edit-modal__group--images">
                <h3 className="product-edit-modal__group-title">
                  Изображения товара
                </h3>

                {imagesLoading ? (
                  <div className="product-edit-modal__images-loading">
                    <div className="product-edit-modal__spinner" />
                    <span>Загрузка изображений...</span>
                  </div>
                ) : existingImages.length > 0 ? (
                  <div className="product-edit-modal__images-grid">
                    {existingImages.map((img) => (
                      <div
                        key={img.id}
                        className="product-edit-modal__image-card"
                      >
                        {(img.image || img.image_url || img.url) && (
                          <div className="product-edit-modal__image-preview">
                            <img
                              src={img.image || img.image_url || img.url}
                              alt={img.alt || editedItem.name}
                              className="product-edit-modal__image"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                            {img.is_primary && (
                              <div className="product-edit-modal__image-badge">
                                Главное
                              </div>
                            )}
                          </div>
                        )}
                        <div className="product-edit-modal__image-actions">
                          <label className="product-edit-modal__image-radio">
                            <input
                              type="radio"
                              name="existing_primary_image"
                              checked={Boolean(img.is_primary)}
                              onChange={() => handleSetPrimaryExisting(img.id)}
                            />
                            <span>Сделать главным</span>
                          </label>
                          <button
                            type="button"
                            className="product-edit-modal__image-delete"
                            onClick={() => handleDeleteExistingImage(img.id)}
                            aria-label="Удалить изображение"
                          >
                            <X size={16} />
                            Удалить
                          </button>
                        </div>
                        {img.alt && (
                          <p className="product-edit-modal__image-alt">
                            Alt: {img.alt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="product-edit-modal__images-empty">
                    <span>Нет загруженных изображений</span>
                  </div>
                )}

                <button
                  type="button"
                  className="product-edit-modal__add-image"
                  onClick={addNewImageSlot}
                >
                  <Plus size={20} />
                  Добавить изображение
                </button>

                {newImages.length > 0 && (
                  <div className="product-edit-modal__new-images">
                    {newImages.map((im, idx) => (
                      <div
                        key={idx}
                        className="product-edit-modal__new-image-card"
                      >
                        <div className="product-edit-modal__new-image-header">
                          <span className="product-edit-modal__new-image-number">
                            Изображение #{idx + 1}
                          </span>
                          <div className="product-edit-modal__new-image-controls">
                            <label className="product-edit-modal__image-radio">
                              <input
                                type="radio"
                                name="new_primary_image"
                                checked={Boolean(im.is_primary)}
                                onChange={() => handleNewPrimarySelect(idx)}
                              />
                              <span>Главное</span>
                            </label>
                            <button
                              type="button"
                              className="product-edit-modal__new-image-remove"
                              onClick={() => removeNewImageSlot(idx)}
                              aria-label="Удалить"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="product-edit-modal__new-image-upload">
                          <FileInput
                            onChange={(e) =>
                              handleNewImageChange(
                                idx,
                                e.target.files?.[0] || null
                              )
                            }
                            accept="image/*"
                            name="image"
                            label="Выберите файл"
                          />
                        </div>
                        {im.file && (
                          <div className="product-edit-modal__new-image-alt">
                            <input
                              type="text"
                              placeholder="Alt текст (опционально)"
                              className="product-edit-modal__input"
                              value={im.alt}
                              onChange={(e) =>
                                handleNewImageAltChange(idx, e.target.value)
                              }
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </form>
          </div>

          {/* Footer */}
          <footer className="product-edit-modal__footer">
            <button
              type="button"
              className="product-edit-modal__btn product-edit-modal__btn--danger"
              onClick={handleDelete}
              disabled={deleting || updating}
            >
              {deleting ? (
                <>
                  <span className="product-edit-modal__spinner product-edit-modal__spinner--small" />
                  Удаление...
                </>
              ) : (
                "Удалить товар"
              )}
            </button>
            <button
              type="button"
              className="product-edit-modal__btn product-edit-modal__btn--primary"
              onClick={handleSave}
              disabled={updating || deleting}
            >
              {updating ? (
                <>
                  <span className="product-edit-modal__spinner product-edit-modal__spinner--small" />
                  Сохранение...
                </>
              ) : (
                "Сохранить изменения"
              )}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
};

const TransferProductModal = ({
  onClose,
  onChanged,
  item,
  /** Необязательно: можно передать список материалов и флаг загрузки
   * Материал: { id, name?, title? }
   */
  // materials: products = [],
  materialsLoading = false,
}) => {
  const { plurizeWithNumber } = usePlurize()
  const alert = useAlert()
  const error = useErrorModal()
  // const { list: clients } = useClient();
  const { employees } = useDepartments();
  const { creating, createError } = useSelector((state) => state.transfer);
  const { list: products } = useProducts();

  const [state, setState] = useState({
    agent: "",
    product: item?.id || "",
    qty_transferred: "",
  });
  const [validationError, setValidationError] = useState("");

  // New state for bulk transfers
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);

  // Добавление товара в список для передачи
  const addProductToTransfer = (product) => {
    if (selectedProducts.find((p) => p.id === product.id)) return;

    setSelectedProducts((prev) => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        quantity: product.quantity,
        qty_transferred: 1,
      },
    ]);
  };

  // Удаление товара из списка
  const removeProductFromTransfer = (productId) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Обновление количества для передачи
  const updateProductQuantity = (productId, quantity) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, qty_transferred: quantity } : p
      )
    );
  };
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getEmployees());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchProductsAsync({ search: debouncedSearchQuery }));
  }, [debouncedSearchQuery])
  // Проверяем, что товар существует и есть в наличии
  if (!item) {
    return (
      <div className="finished-goods-modal">
        <div className="finished-goods-modal__overlay" onClick={onClose} />
        <div className="finished-goods-modal__content">
          <div className="finished-goods-modal__header">
            <h3>Ошибка</h3>
            <X
              className="finished-goods-modal__close-icon"
              size={20}
              onClick={onClose}
            />
          </div>
          <p className="finished-goods-modal__error-message">
            Товар не найден или недоступен для передачи
          </p>
        </div>
      </div>
    );
  }

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
    setValidationError(""); // Очищаем ошибку при изменении
  }, []);

  const validateForm = useCallback(() => {
    if (!state.agent) {
      setValidationError("Выберите агента");
      return false;
    }

    if (selectedProducts.length === 0) {
      setValidationError("Выберите хотя бы один товар для передачи");
      return false;
    }

    // Проверяем количество для каждого товара
    for (const product of selectedProducts) {
      if (!product.qty_transferred || Number(product.qty_transferred) <= 0) {
        setValidationError(
          `Введите корректное количество для товара "${product.name}"`
        );
        return false;
      }
      if (Number(product.qty_transferred) > Number(product.quantity)) {
        setValidationError(
          `Недостаточно товара "${product.name}". Доступно: ${product.quantity}`
        );
        return false;
      }
    }

    return true;
  }, [selectedProducts, state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      // Bulk transfer
      const items = selectedProducts.map((product) => ({
        product: product.id,
        qty_transferred: Number(product.qty_transferred),
      }));

      await dispatch(
        createBulkTransferAsync({
          agent: state.agent,
          items: items,
        })
      ).unwrap();

      alert(`Успешно передано ${plurizeWithNumber(selectedProducts.length, 'products')} агенту!`, () => {
        onChanged?.();
        onClose();
      });
    } catch (error) {
      console.error("Transfer creation failed:", error);
      error(
        `Ошибка при создании передачи: ${error?.message || "неизвестная ошибка"
        }`
      );
    }
  };

  return (
    <div className="finished-goods-modal">
      <div className="finished-goods-modal__overlay" onClick={onClose} />
      <div className="finished-goods-modal__content">
        <div className="finished-goods-modal__header">
          <h3>Передать товар</h3>
          <X
            className="finished-goods-modal__close-icon"
            size={20}
            onClick={onClose}
          />
        </div>

        {createError && (
          <p className="finished-goods-modal__error-message">
            Ошибка создания передачи: {createError?.message || "ошибка"}
          </p>
        )}
        {validationError && (
          <p className="finished-goods-modal__error-message">
            {validationError}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="finished-goods-add-modal__section">
            <label>Агент *</label>
            <select
              className="finished-goods-add-modal__input"
              onChange={onChange}
              name="agent"
              value={state.agent}
              required
            >
              <option value="" disabled>
                Выберите реализатора
              </option>
              {employees?.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="finished-goods-add-modal__section">
            <h4
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "var(--text)",
              }}
            >
              Выбор товаров для передачи
            </h4>

            {/* Поиск товаров */}
            <div className="finished-goods-modal__search-wrapper">
              <input
                type="text"
                placeholder="Поиск товаров..."
                className="finished-goods-add-modal__input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Список доступных товаров */}
            <div className="finished-goods-modal__products-list">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="finished-goods-modal__product-item"
                >
                  <div className="finished-goods-modal__product-info">
                    <strong>{product.name}</strong>
                    <small>Доступно: {product.quantity}</small>
                  </div>
                  <button
                    type="button"
                    className={`finished-goods-modal__add-product-btn ${
                      selectedProducts.find((p) => p.id === product.id) ||
                      product.quantity <= 0
                        ? "finished-goods-modal__add-product-btn--disabled"
                        : ""
                    }`}
                    onClick={() => addProductToTransfer(product)}
                    disabled={
                      selectedProducts.find((p) => p.id === product.id) ||
                      product.quantity <= 0
                    }
                  >
                    {selectedProducts.find((p) => p.id === product.id)
                      ? "Добавлен"
                      : "Добавить"}
                  </button>
                </div>
              ))}
            </div>

            {/* Выбранные товары */}
            {selectedProducts.length > 0 && (
              <div className="finished-goods-modal__selected-products">
                <h5>Выбранные товары:</h5>
                {selectedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="finished-goods-modal__selected-item"
                  >
                    <div className="finished-goods-modal__product-info">
                      <strong>{product.name}</strong>
                      <small>Доступно: {product.quantity}</small>
                    </div>
                    <div className="finished-goods-modal__selected-controls">
                      <input
                        type="number"
                        min="1"
                        max={product.quantity}
                        value={product.qty_transferred}
                        onChange={(e) =>
                          updateProductQuantity(product.id, e.target.value)
                        }
                        className="finished-goods-modal__quantity-input"
                      />
                      <button
                        type="button"
                        className="finished-goods-modal__remove-btn"
                        onClick={() => removeProductFromTransfer(product.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="finished-goods-modal__submit-btn"
            type="submit"
            disabled={creating}
          >
            {creating ? "Создание..." : "Отправить"}
          </button>
        </form>
      </div>
    </div>
  );
};

// export default TransferProductModal;

const AcceptProductModal = ({ onClose, onChanged, item }) => {
  const alert = useAlert()
  const { acceptingInline, acceptInlineError } = useSelector(
    (state) => state.acceptance
  );
  const { employees } = useDepartments();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const [state, setState] = useState({
    agent_id: "",
    product_id: item?.id || "",
    qty: "",
  });
  const [selectedCashBox, setSelectedCashBox] = useState("");
  const [validationError, setValidationError] = useState("");
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getEmployees());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Проверяем, что товар существует
  if (!item) {
    return (
      <div className="finished-goods-modal">
        <div className="finished-goods-modal__overlay" onClick={onClose} />
        <div className="finished-goods-modal__content">
          <div className="finished-goods-modal__header">
            <h3>Ошибка</h3>
            <X
              className="finished-goods-modal__close-icon"
              size={20}
              onClick={onClose}
            />
          </div>
          <p className="finished-goods-modal__error-message">
            Товар не найден или недоступен для приёмки
          </p>
        </div>
      </div>
    );
  }

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
    setValidationError(""); // Очищаем ошибку при изменении
  }, []);

  const validateForm = useCallback(() => {
    if (!state.agent_id) {
      setValidationError("Выберите агента");
      return false;
    }
    if (!selectedCashBox) {
      setValidationError("Выберите кассу");
      return false;
    }
    if (!state.qty || Number(state.qty) <= 0) {
      setValidationError("Введите корректное количество");
      return false;
    }
    return true;
  }, [state, selectedCashBox]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const result = await dispatch(
        acceptInlineAsync({
          agent_id: state.agent_id,
          product_id: state.product_id,
          qty: Number(state.qty),
        })
      ).unwrap();

      // Обновляем количество товара на складе
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: {
            quantity:
              Number(item.quantity) + Number(result.qty_remaining_after),
          },
        })
      ).unwrap();

      // Добавляем приход в кассу
      await dispatch(
        addCashFlows({
          cashbox: selectedCashBox,
          type: "income",
          name: `Приёмка: ${item.name}`,
          amount: (Number(state.qty) * Number(item.purchase_price)).toFixed(1),
          source_cashbox_flow_id: item.id,
          source_business_operation_id: "Склад производство",
          status:
            company?.subscription_plan?.name === "Старт"
              ? "approved"
              : "pending",
        })
      ).unwrap();

      alert(
        `Приёмка успешно создана!\nАгент: ${result.agent}\nТовар: ${result.product}\nПринято: ${result.qty_accept}\nОстаток: ${result.qty_remaining_after}`, () => {
          onChanged?.();
          onClose();
        }
      );

    } catch (error) {
      console.error("Accept inline failed:", error);
      alert(
        `Ошибка при создании приёмки: ${error?.message || "неизвестная ошибка"}`, true
      );
    }
  };

  return (
    <div className="finished-goods-modal">
      <div className="finished-goods-modal__overlay" onClick={onClose} />
      <div className="finished-goods-modal__content">
        <div className="finished-goods-modal__header">
          <h3>Принять товар</h3>
          <X
            className="finished-goods-modal__close-icon"
            size={20}
            onClick={onClose}
          />
        </div>

        {acceptInlineError && (
          <p className="finished-goods-modal__error-message">
            Ошибка приёмки: {acceptInlineError?.message || "ошибка"}
          </p>
        )}

        {validationError && (
          <p className="finished-goods-modal__error-message">
            {validationError}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="finished-goods-add-modal__section">
            <label>Агент *</label>
            <select
              className="finished-goods-add-modal__input"
              onChange={onChange}
              name="agent_id"
              value={state.agent_id}
              required
            >
              <option value="" disabled>
                Выберите агента
              </option>
              {employees?.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="finished-goods-add-modal__section">
            <label>Касса *</label>
            <select
              className="finished-goods-add-modal__input"
              onChange={(e) => setSelectedCashBox(e.target.value)}
              name="cashbox_id"
              value={selectedCashBox}
              required
            >
              <option value="" disabled>
                Выберите кассу
              </option>
              {cashBoxes?.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name ?? cashbox.department_name}
                </option>
              ))}
            </select>
          </div>

          <div className="finished-goods-add-modal__section">
            <h4>Товар: {item?.name}</h4>
            <p className="finished-goods-modal__info-text">
              Текущее количество на складе:{" "}
              <strong>{item?.quantity || 0}</strong>
            </p>
            <p className="finished-goods-modal__info-text">
              Закупочная цена: <strong>{item?.purchase_price || 0} сом</strong>
            </p>
          </div>

          <div className="finished-goods-add-modal__section">
            <label>Количество *</label>
            <input
              type="number"
              name="qty"
              placeholder="Количество"
              className="finished-goods-add-modal__input"
              value={state.qty}
              onChange={onChange}
              min={1}
              step={1}
              required
            />
            <small className="finished-goods-modal__hint">
              Сумма к зачислению:{" "}
              {state.qty && item?.purchase_price
                ? (Number(state.qty) * Number(item.purchase_price)).toFixed(1)
                : 0}{" "}
              сом
            </small>
          </div>

          <button
            className="finished-goods-modal__submit-btn"
            type="submit"
            disabled={acceptingInline}
          >
            {acceptingInline ? "Приёмка..." : "Принять"}
          </button>
        </form>
      </div>
    </div>
  );
};

const ReturnProductModal = ({ onClose, onChanged, item }) => {
  const alert = useAlert();
  const { creating, createError } = useSelector(
    (state) => state.return || { creating: false, createError: null }
  );
  const [state, setState] = useState({
    subreal: item?.id || "",
    qty: "",
  });
  const [validationError, setValidationError] = useState("");

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getEmployees());
  }, [dispatch]);

  // Проверяем, что товар существует
  if (!item) {
    return (
      <div className="finished-goods-modal">
        <div className="finished-goods-modal__overlay" onClick={onClose} />
        <div className="finished-goods-modal__content">
          <div className="finished-goods-modal__header">
            <h3>Ошибка</h3>
            <X
              className="finished-goods-modal__close-icon"
              size={20}
              onClick={onClose}
            />
          </div>
          <p className="finished-goods-modal__error-message">
            Товар не найден или недоступен для возврата
          </p>
        </div>
      </div>
    );
  }

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
    setValidationError("");
  }, []);

  const validateForm = useCallback(() => {
    if (!state.qty || Number(state.qty) <= 0) {
      setValidationError("Введите корректное количество");
      return false;
    }
    return true;
  }, [state]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(
        createReturnAsync({
          subreal: state.subreal,
          qty: Number(state.qty),
        })
      ).unwrap();
      alert(`Возврат успешно создан!\nКоличество: ${state.qty}`, () => {
        onChanged?.();
        onClose();
      });

    } catch (error) {
      console.error("Return creation failed:", error);
      alert(
        `Ошибка при создании возврата: ${error?.message || "неизвестная ошибка", true
        }`
      );
    }
  };

  return (
    <div className="finished-goods-modal">
      <div className="finished-goods-modal__overlay" onClick={onClose} />
      <div className="finished-goods-modal__content">
        <div className="finished-goods-modal__header">
          <h3>Вернуть товар</h3>
          <X
            className="finished-goods-modal__close-icon"
            size={20}
            onClick={onClose}
          />
        </div>

        {createError && (
          <p className="finished-goods-modal__error-message">
            Ошибка создания возврата: {createError?.message || "ошибка"}
          </p>
        )}

        {validationError && (
          <p className="finished-goods-modal__error-message">
            {validationError}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="finished-goods-add-modal__section">
            <h4>Товар: {item?.name}</h4>
            <p className="finished-goods-modal__info-text">
              Текущее количество у агента:{" "}
              <strong>{item?.qty_on_agent || 0}</strong>
            </p>
          </div>

          <div className="finished-goods-add-modal__section">
            <label>Количество для возврата *</label>
            <input
              type="number"
              name="qty"
              placeholder="Количество"
              className="finished-goods-add-modal__input"
              value={state.qty}
              onChange={onChange}
              min={1}
              max={item?.qty_on_agent || 0}
              step={1}
              required
            />
            <small className="finished-goods-modal__hint">
              Максимум: {item?.qty_on_agent || 0}
            </small>
          </div>

          <button
            className="finished-goods-modal__submit-btn"
            type="submit"
            disabled={creating}
          >
            {creating ? "Возврат..." : "Вернуть"}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ============================================================
   Основной экран «Склад готовой продукции»
   ============================================================ */
const toStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const toEndOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const safeDate = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const FinishedGoods = ({ products, onChanged }) => {
  const dispatch = useDispatch();
  const { loading, error } = useProducts();
  const { list: cashBoxes } = useCash();

  const [showAdd, setShowAdd] = useState(false);
  const [selectCashBox, setSelectCashBox] = useState("");

  // состояние для редактирования
  const [showEdit, setShowEdit] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [showTransferProductModal, setShowTransferProductModal] =
    useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const [showAcceptProductModal, setShowAcceptProductModal] = useState(false);
  const [showReturnProductModal, setShowReturnProductModal] = useState(false);
  const [itemId, setItemId] = useState({});
  const [itemId1, setItemId1] = useState({});
  const [itemId2, setItemId2] = useState({});
  const [itemId3, setItemId3] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    dispatch(fetchProductsAsync({
      search: debouncedSearch
    }))
  }, [debouncedSearch])

  // Фильтр по дате
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  // View mode (table/cards) - сохраняем в localStorage
  const STORAGE_KEY = "finished_goods_view_mode";
  const getInitialViewMode = useCallback(() => {
    if (typeof window === "undefined") return "table";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "table" || saved === "cards") return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? "cards" : "table";
  }, []);
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const debounceTimerRef = useRef(null);

  // Сохраняем режим просмотра в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  useEffect(() => {

    dispatch(fetchCategoriesAsync());
    dispatch(getCashBoxes());
    dispatch(getItemsMake()); // сырьё для модалки
    dispatch(fetchBrandsAsync());
    // чтобы EditModal сразу имел список поставщиков:
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const onSaveSuccess = () => {
    setShowAdd(false);
    dispatch(fetchProductsAsync());
    dispatch(getItemsMake());
  };

  const onEditSaved = () => {
    setShowEdit(false);
    setSelectedItem(null);
    dispatch(fetchProductsAsync());
  };
  const handleOpen = (id) => {
    setShowMarriageModal(true);
    setItemId(id);
  };

  const handleOpen1 = (id) => {
    setShowAddProductModal(true);
    setItemId1(id);
  };

  const handleOpen2 = (item) => {
    setShowAcceptProductModal(true);
    setItemId2(item);
  };
  const handleOpen3 = (item) => {
    setShowReturnProductModal(true);
    setItemId3(item);
  };

  const onEditDeleted = () => {
    setShowEdit(false);
    setSelectedItem(null);
    dispatch(fetchProductsAsync());
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
  };

  // Фильтрация по названию, категории и ДАТЕ created_at
  const viewProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const from = dateFrom ? toStartOfDay(dateFrom) : null;
    const to = dateTo ? toEndOfDay(dateTo) : null;

    let filteredProducts = (products || []).filter((p) => {
      const okName = !q || (p.name || "").toLowerCase().includes(q);
      const okCat =
        !categoryFilter ||
        String(p.category_id || p.category)?.toLowerCase() ===
          String(categoryFilter).toLowerCase();

      // фильтр по дате
      const created = safeDate(p.created_at);
      if (!created) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;

      return okName && okCat;
    });

    // Показываем все товары (можно раскомментировать строку ниже для фильтрации только принятых агентами)
    // filteredProducts = filteredProducts.filter((p) => p.qty_on_agent > 0);

    return filteredProducts.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [products, debouncedSearch, categoryFilter, dateFrom, dateTo]);

  const openEdit = (product) => {
    setSelectedItem(product);
    setShowEdit(true);
  };

  // get primary image
  const getPrimaryImage = (product) => {
    if (!product?.images || !Array.isArray(product.images)) return null;
    const primaryImage = product.images.find((img) => img.is_primary);
    return primaryImage || product.images[0] || null;
  };

  // get image URL with fallback
  const getImageUrl = (image) => {
    if (!image) return noImage;
    // Поддержка разных форматов URL изображений
    const url = image.image_url || image.image || image.url || image.preview;
    if (!url || url === "null" || url === "undefined") return noImage;
    // Если URL относительный, добавляем базовый URL API
    if (url.startsWith("/")) {
      return url;
    }
    return url;
  };

  const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

  return (
    <div className="warehouse-page">
      {/* Header */}
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📦</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Склад готовой продукции</h1>
            <p className="warehouse-header__subtitle">
              Управление готовыми товарами
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap flex-1 justify-end md:w-full md:justify-center lg:justify-end">
          <button
            className="warehouse-header__create-btn"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={16} />
            Добавить товар
          </button>
          <button
            className="warehouse-header__create-btn"
            onClick={() => setShowTransferProductModal(true)}
          >
            <Plus size={16} />
            Передать товар
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <Search className="warehouse-search__icon" size={18} />
          <input
            type="text"
            className="warehouse-search__input"
            placeholder="Поиск по названию товара..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            Всего: {products?.length || 0} • Найдено: {viewProducts.length}
          </span>

          {/* Date filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 flex gap-2 justify-between items-center">
              <label className="text-sm text-slate-600">От:</label>
              <input
                type="date"
                className="warehouse-search__input flex-1"
                style={{ width: "auto", minWidth: "140px" }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 items-center gap-2 flex justify-between">
              <label className="text-sm  text-slate-600">До:</label>
              <input
                type="date"
                className="warehouse-search__input flex-1"
                style={{ width: "auto", minWidth: "140px" }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {(dateFrom || dateTo || search || categoryFilter) && (
              <button
                type="button"
                className="warehouse-search__filter-btn"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="ml-auto justify-center flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                viewMode === "table"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Table2 size={16} />
              Таблица
            </button>

            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                viewMode === "cards"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="warehouse-table-container w-full">
        {/* ===== TABLE ===== */}
        {viewMode === "table" && (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="warehouse-table w-full min-w-275">
              <thead>
                <tr>
                  <th></th>
                  <th>№</th>
                  <th></th>
                  <th>Название</th>
                  <th>Поставщик</th>
                  <th>Цена</th>
                  <th>Дата</th>
                  <th>Количество / У агентов</th>
                  <th>Категория</th>
                  <th>Действия</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="warehouse-table__empty">
                      Ошибка загрузки
                    </td>
                  </tr>
                ) : viewProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="warehouse-table__empty">
                      Товары не найдены
                    </td>
                  </tr>
                ) : (
                  viewProducts.map((item, idx) => {
                    const primaryImage = getPrimaryImage(item);
                    return (
                      <tr
                        key={item.id}
                        className="warehouse-table__row"
                        onClick={() => openEdit(item)}
                      >
                        <td>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                            className="warehouse-table__edit-btn"
                            title="Редактировать"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>

                        <td>{idx + 1}</td>

                        <td>
                          <img
                            src={getImageUrl(primaryImage)}
                            alt={primaryImage?.alt || item.name || "Товар"}
                            className="warehouse-table__product-image"
                            onError={(e) => {
                              e.currentTarget.src = noImage;
                            }}
                            loading="lazy"
                          />
                        </td>

                        <td className="warehouse-table__name">
                          <div className="warehouse-table__name-cell">
                            <span>{item.name || "—"}</span>
                          </div>
                        </td>

                        <td>{item.client_name || "—"}</td>
                        <td>{formatPrice(item.price)}</td>
                        <td>
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <div>На складе: {item.quantity || 0}</div>
                            {item.qty_on_agent > 0 && (
                              <div style={{ fontSize: "12px", color: "#666" }}>
                                У агентов: {item.qty_on_agent}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{item.category || item.category_name || "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="warehouse-header__create-btn"
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                background: "#f59e0b",
                                color: "white",
                              }}
                              onClick={() => handleOpen(item)}
                            >
                              В брак
                            </button>
                            <button
                              className="warehouse-header__create-btn"
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                background: "#f7d74f",
                                color: "black",
                              }}
                              onClick={() => handleOpen1(item)}
                            >
                              Добавить
                            </button>
                            {item.qty_on_agent > 0 && (
                              <button
                                className="warehouse-header__create-btn"
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  background: "#3b82f6",
                                  color: "white",
                                }}
                                onClick={() => handleOpen3(item)}
                              >
                                Принять возврат
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== CARDS ===== */}
        {viewMode === "cards" && (
          <div className="block">
            {loading ? (
              <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                Загрузка...
              </div>
            ) : error ? (
              <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                Ошибка загрузки
              </div>
            ) : viewProducts.length === 0 ? (
              <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                Товары не найдены
              </div>
            ) : (
              <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {viewProducts.map((item, idx) => {
                  const primaryImage = getPrimaryImage(item);
                  return (
                    <div
                      key={item.id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      onClick={() => openEdit(item)}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={getImageUrl(primaryImage)}
                          alt={item.name || "Товар"}
                          className="warehouse-table__product-image h-12 w-12 flex-none rounded-xl border border-slate-200 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = noImage;
                          }}
                          loading="lazy"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500">
                            #{idx + 1}
                          </div>
                          <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
                            {item.name || "—"}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="whitespace-nowrap">
                              Поставщик:{" "}
                              <span className="font-medium">
                                {item.client_name || "—"}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">
                              Категория:{" "}
                              <span className="font-medium">
                                {item.category || item.category_name || "—"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Цена</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {formatPrice(item.price)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Дата</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="col-span-2 rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Количество</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            На складе: {item.quantity || 0}
                            {item.qty_on_agent > 0 && (
                              <span className="ml-2 text-xs text-slate-600">
                                • У агентов: {item.qty_on_agent}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="mt-4 flex flex-wrap gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="warehouse-header__create-btn"
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            background: "#f59e0b",
                            color: "white",
                            flex: "1",
                            minWidth: "80px",
                          }}
                          onClick={() => handleOpen(item)}
                        >
                          В брак
                        </button>
                        <button
                          className="warehouse-header__create-btn"
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            background: "#f7d74f",
                            color: "black",
                            flex: "1",
                            minWidth: "80px",
                          }}
                          onClick={() => handleOpen1(item)}
                        >
                          Добавить
                        </button>
                        {item.qty_on_agent > 0 && (
                          <button
                            className="warehouse-header__create-btn"
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              background: "#3b82f6",
                              color: "white",
                              flex: "1",
                              minWidth: "80px",
                            }}
                            onClick={() => handleOpen3(item)}
                          >
                            Принять возврат
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaveSuccess={onSaveSuccess}
          selectCashBox={selectCashBox}
        />
      )}

      {showEdit && selectedItem && (
        <EditModal
          item={selectedItem}
          onClose={() => {
            setShowEdit(false);
            setSelectedItem(null);
          }}
          onSaveSuccess={onEditSaved}
          onDeleteConfirm={onEditDeleted}
        />
      )}
      {showMarriageModal && (
        <MarriageModal
          onClose={() => setShowMarriageModal(false)}
          onChanged={onChanged}
          item={itemId}
        />
      )}
      {showTransferProductModal && (
        <TransferProductModal
          onClose={() => setShowTransferProductModal(false)}
          onChanged={onChanged}
          item={itemId1}
        />
      )}
      {showAcceptProductModal && (
        <AcceptProductModal
          onClose={() => setShowAcceptProductModal(false)}
          onChanged={onChanged}
          item={itemId2}
        />
      )}
      {showReturnProductModal && (
        <ReturnProductModal
          onClose={() => setShowReturnProductModal(false)}
          onChanged={onChanged}
          item={itemId3}
        />
      )}
      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onChanged={() => dispatch(fetchProductsAsync()).unwrap()}
          item={itemId1}
        />
      )}
    </div>
  );
};

export default FinishedGoods;
