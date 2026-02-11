import { useEffect, useState, useMemo, useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Package,
  ShoppingBag,
  Scan,
  Search,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useProducts } from "../../../../store/slices/productSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { useSelector } from "react-redux";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { createDeal } from "../../../../store/creators/saleThunk";
import AddProductBarcode from "../../../Deposits/Sklad/AddProductBarcode";
import {
  createProductAsync,
  updateProductAsync,
  fetchProductsAsync,
} from "../../../../store/creators/productCreators";
import {
  fetchWarehousesAsync,
  fetchWarehouseBrandsAsync,
  createWarehouseBrandAsync,
  fetchWarehouseCategoriesAsync,
  createWarehouseCategoryAsync,
} from "../../../../store/creators/warehouseCreators";
import { countries } from "../../../../data/countries";
import api from "../../../../api";
import AlertModal from "../../../common/AlertModal/AlertModal";
import "../../../Deposits/Sklad/AddProductPage.scss";
import { validateResErrors } from "../../../../../tools/validateResErrors";

// Функция для создания долга
async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const AddWarehouseProductPage = () => {
  const { id: productId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const { list } = useClient();
  const {
    creating,
    updating,
    createError,
    scannedProduct,
    list: products,
    count,
    weightProductsCount,
  } = useProducts();
  const { company } = useUser();
  const { list: cashBoxes } = useCash();

  // Получаем список складов, брендов и категорий из Redux
  const warehouses = useSelector((state) => state.warehouse.list || []);
  const brands = useSelector((state) => state.warehouse.brands || []);
  const categories = useSelector((state) => state.warehouse.categories || []);

  const warehousesLoading = useSelector(
    (state) => state.warehouse.loading || false
  );

  // Состояние для выбора склада
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  // Режим редактирования
  const isEditMode = !!productId;
  const [loadingProduct, setLoadingProduct] = useState(isEditMode);

  const [activeTab, setActiveTab] = useState(0); // 0 - Ввод вручную, 1 - Сканирование
  const [productType, setProductType] = useState("piece"); // "piece" или "weight"
  const [selectCashBox, setSelectCashBox] = useState("");

  // Для маркета: тип товара (товар/услуга/комплект)
  const [itemType, setItemType] = useState("product"); // "product", "service", "kit"

  // Дополнительные поля для маркета
  const [marketData, setMarketData] = useState({
    code: "",
    article: "",
    unit: "шт",
    isWeightProduct: false,
    isFractionalService: false,
    plu: "", // PLU код для весового товара
    height: "0",
    width: "0",
    depth: "0",
    weight: "0",
    description: "",
    country: "",
    purchasePrice: "",
    markup: "0",
    discount: "0",
    supplier: "",
    minStock: "0",
    expiryDate: "",
    kitProducts: [], // Для комплекта
    kitSearchTerm: "",
    packagings: [], // Список упаковок
  });

  // Для поиска товаров в комплекте
  const [kitSearchResults, setKitSearchResults] = useState([]);
  const [showKitSearch, setShowKitSearch] = useState(false);
  const [showKitRecalculateTooltip, setShowKitRecalculateTooltip] =
    useState(false);

  // Изображения товара
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);

  // Состояние для AlertModal
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  // Функция для показа алерта
  const showAlert = (message, type = "error", title = "") => {
    setAlertModal({
      open: true,
      type,
      title,
      message,
    });
  };

  const [newItemData, setNewItemData] = useState({
    name: "",
    barcode: "",
    brand: "",
    category: "",
    product_group: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "",
    plu: "",
    scale_type: "",
  });

  const [warehouseGroups, setWarehouseGroups] = useState([]);
  const [warehouseGroupsLoading, setWarehouseGroupsLoading] = useState(false);
  const [warehouseGroupsError, setWarehouseGroupsError] = useState(null);

  const [state, setState] = useState({
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

  const [newBrand, setNewBrand] = useState({
    name: "",
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
  });

  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Склад",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });
  const [showInputs, setShowInputs] = useState(false);
  const [showBrandInputs, setShowBrandInputs] = useState(false);
  const [showCategoryInputs, setShowCategoryInputs] = useState(false);

  // Ошибки для обязательных полей
  const [fieldErrors, setFieldErrors] = useState({});

  // Состояния для долга
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtState, setDebtState] = useState({
    phone: "",
    dueDate: "",
  });

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    dispatch(fetchWarehouseBrandsAsync());
    dispatch(fetchWarehouseCategoriesAsync());
    dispatch(fetchWarehousesAsync({ page_size: 1000 })); // Загружаем склады

    // Загружаем товары для подсчета весовых товаров
    const searchParams = new URLSearchParams(location.search);
    const warehouseIdFromUrl = searchParams.get("warehouse_id");

    const fetchParams = { page_size: 10000 };
    if (warehouseIdFromUrl) {
      fetchParams.warehouse = warehouseIdFromUrl;
    }
    dispatch(fetchProductsAsync(fetchParams));
  }, [dispatch, location.search]);

  // Автоматически выбираем склад из URL параметра
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const warehouseId = searchParams.get("warehouse_id");
    if (warehouseId && warehouses.length > 0) {
      setSelectedWarehouse(warehouseId);
    }
  }, [location.search, warehouses]);

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      if (!selectedWarehouse) {
        setWarehouseGroups([]);
        setWarehouseGroupsError(null);
        setWarehouseGroupsLoading(false);
        return;
      }

      // Если меняем склад при создании — сбрасываем выбранную группу
      if (!isEditMode) {
        setNewItemData((prev) => ({ ...prev, product_group: "" }));
      }

      setWarehouseGroupsLoading(true);
      setWarehouseGroupsError(null);
      try {
        const { data } = await api.get(`/warehouse/${selectedWarehouse}/groups/`);
        const list = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) setWarehouseGroups(list);
      } catch (e) {
        console.error("Ошибка при загрузке групп склада:", e);
        if (!cancelled) {
          setWarehouseGroups([]);
          setWarehouseGroupsError(e);
        }
      } finally {
        if (!cancelled) setWarehouseGroupsLoading(false);
      }
    };

    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [selectedWarehouse, isEditMode]);

  const groupOptions = useMemo(() => {
    const groups = Array.isArray(warehouseGroups) ? warehouseGroups : [];
    const byParent = new Map();
    groups.forEach((g) => {
      const parent = g?.parent ?? null;
      const key = parent === null ? "root" : String(parent);
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(g);
    });
    for (const [k, arr] of byParent.entries()) {
      arr.sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""))
      );
      byParent.set(k, arr);
    }

    const out = [];
    const walk = (parentKey, depth) => {
      const list = byParent.get(parentKey) || [];
      list.forEach((g) => {
        const gid = g?.id ?? g?.uuid;
        if (!gid) return;
        const key = String(gid);
        const prefix = depth > 0 ? `${"—".repeat(depth)} ` : "";
        out.push({ value: key, label: `${prefix}${g?.name || "—"}` });
        walk(key, depth + 1);
      });
    };
    walk("root", 0);
    return out;
  }, [warehouseGroups]);

  // Загрузка данных товара для редактирования
  useEffect(() => {
    if (isEditMode && productId) {
      const loadProduct = async () => {
        try {
          setLoadingProduct(true);
          // Для просмотра/редактирования товара склада используем единый эндпоинт:
          // /warehouse/products/{productId}/
          const response = await api.get(`/warehouse/products/${productId}/`);
          const product = response.data;

          // Если API возвращает склад товара — фиксируем выбранный склад
          if (product?.warehouse && !selectedWarehouse) {
            setSelectedWarehouse(String(product.warehouse));
          }

          // Определяем тип товара на основе kind
          let detectedItemType = "product";
          if (product.kind === "service") {
            detectedItemType = "service";
          } else if (product.kind === "bundle") {
            detectedItemType = "kit";
          }
          setItemType(detectedItemType);

          // Заполняем основные данные
          setNewItemData({
            name: product.name || "",
            barcode: product.barcode || "",
            brand: product.brand || product.brand_name || "",
            category: product.category || product.category_name || "",
            product_group:
              String(
                product?.product_group?.id ??
                  product?.product_group?.uuid ??
                  product?.product_group ??
                  ""
              ) || "",
            price: product.price || "",
            quantity: product.quantity || "",
            client: product.client || "",
            purchase_price: product.purchase_price || "",
            plu: product.plu || "",
            scale_type: product.scale_type || "",
          });

          // Заполняем данные для маркета
          setMarketData({
            code: product.code || "",
            article: product.article || "",
            unit: product.unit || "шт",
            isWeightProduct: product.is_weight || false,
            isFractionalService: product.is_weight || false,
            plu: product.plu ? String(product.plu) : "",
            height: product.characteristics?.height_cm || "0",
            width: product.characteristics?.width_cm || "0",
            depth: product.characteristics?.depth_cm || "0",
            weight: product.characteristics?.factual_weight_kg || "0",
            description: product.characteristics?.description || "",
            country: product.country || "",
            purchasePrice: product.purchase_price || "",
            markup: product.markup_percent || "0",
            discount: product.discount_percent || "0",
            supplier: product.client || "",
            minStock: "0", // Нет в API
            expiryDate: product.expiration_date || "",
            kitProducts: [], // Будет загружено из packages
            kitSearchTerm: "",
            packagings: (product.packages || []).map((pkg, idx) => ({
              id: Date.now() + idx,
              name: pkg.name || "",
              quantity: String(pkg.quantity_in_package || 1),
            })),
          });

          // Загружаем изображения
          if (product.images && product.images.length > 0) {
            const loadedImages = product.images.map((img) => ({
              file: null, // Файл не загружаем, только URL
              alt: img.alt || "",
              is_primary: img.is_primary || false,
              preview: img.image_url || img.image || "",
              id: img.id,
            }));
            setImages(loadedImages);
          }

          // Для комплекта загружаем состав из packages
          if (detectedItemType === "kit" && product.packages) {
            // Нужно найти товары по названиям из packages
            // Пока оставляем пустым, можно будет доработать
          }
        } catch (error) {
          console.error("Ошибка при загрузке товара:", error);
          showAlert(
            "Ошибка при загрузке товара: " +
              (error.message || JSON.stringify(error)),
            "error",
            "Ошибка"
          );
        } finally {
          setLoadingProduct(false);
        }
      };
      loadProduct();
    }
  }, [isEditMode, productId, selectedWarehouse]);

  // Обработка дублирования товара
  useEffect(() => {
    const duplicateData = location.state?.duplicate
      ? location.state.productData
      : null;
    if (duplicateData && !isEditMode) {
      const product = duplicateData;

      // Определяем тип товара на основе kind
      let detectedItemType = "product";
      if (product.kind === "service") {
        detectedItemType = "service";
      } else if (product.kind === "bundle") {
        detectedItemType = "kit";
      }
      setItemType(detectedItemType);

      // Заполняем основные данные (очищаем ID, штрих-код и количество для нового товара)
      setNewItemData({
        name: product.name || "",
        barcode: "", // Очищаем штрих-код для нового товара
        brand: product.brand || product.brand_name || "",
        category: product.category || product.category_name || "",
        product_group:
          String(
            product?.product_group?.id ??
              product?.product_group?.uuid ??
              product?.product_group ??
              ""
          ) || "",
        price: product.price || "",
        quantity: "", // Очищаем количество для нового товара
        client: product.client || "",
        purchase_price: product.purchase_price || "",
        plu: product.plu || "",
        scale_type: product.scale_type || "",
      });

      // Заполняем данные для маркета
      setMarketData({
        code: product.code || "",
        article: product.article || "",
        unit: product.unit || "шт",
        isWeightProduct: product.is_weight || false,
        isFractionalService: product.is_weight || false,
        plu: product.plu ? String(product.plu) : "",
        height: product.characteristics?.height_cm || "0",
        width: product.characteristics?.width_cm || "0",
        depth: product.characteristics?.depth_cm || "0",
        weight: product.characteristics?.factual_weight_kg || "0",
        description: product.characteristics?.description || "",
        country: product.country || "",
        purchasePrice: product.purchase_price || "",
        markup: product.markup_percent || "0",
        discount: product.discount_percent || "0",
        supplier: product.client || "",
        minStock: "0",
        expiryDate: product.expiration_date || "",
        kitProducts: [], // Для комплекта можно будет доработать
        kitSearchTerm: "",
        packagings: (product.packages || []).map((pkg, idx) => ({
          id: Date.now() + idx,
          name: pkg.name || "",
          quantity: String(pkg.quantity_in_package || 1),
        })),
      });

      // Загружаем изображения (копируем ссылки, но не файлы)
      if (product.images && product.images.length > 0) {
        const loadedImages = product.images.map((img) => ({
          file: null, // Файл не копируем, только URL для предпросмотра
          alt: img.alt || "",
          is_primary: img.is_primary || false,
          preview: img.image_url || img.image || "",
          id: img.id,
        }));
        setImages(loadedImages);
      }

      // Очищаем state после использования, чтобы при возврате назад не дублировалось снова
      if (location.state) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, isEditMode, navigate, location.pathname]);

  // Автоматически выбираем первую кассу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: newItemData.name,
      amount: newItemData.price,
    }));
  }, [newItemData, selectCashBox]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setNewItemData((prevData) => ({
      ...prevData,
      [name]: type === "number" ? (value === "" ? "" : parseInt(value)) : value,
      scale_type:
        name === "scale_type"
          ? value
          : prevData.scale_type || productType === "piece"
          ? "piece"
          : "weight",
    }));
  };

  const onChangeDebt = (e) => {
    const { name, value } = e.target;
    setDebtState((prev) => ({ ...prev, [name]: value }));
  };

  // Получаем выбранного поставщика для долга
  const pickSupplier = useMemo(() => {
    if (!newItemData.client) return null;
    return list.find((x) => String(x.id) === String(newItemData.client));
  }, [list, newItemData.client]);

  // Автоматическое заполнение телефона при выборе поставщика в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickSupplier?.phone) {
      setDebtState((prev) => ({ ...prev, phone: pickSupplier.phone }));
    }
  }, [newItemData.client, pickSupplier, company?.subscription_plan?.name]);

  const handleSubmit = async () => {
    const {
      name,
      barcode,
      brand,
      category,
      price,
      quantity,
      client,
      purchase_price,
    } = newItemData;

    // Сбрасываем предыдущие ошибки
    const errors = {};
    setFieldErrors({});

    // Нормализуем наценку: если не заполнена, считаем её 0
    const normalizedMarkup =
      marketData.markup !== undefined &&
      marketData.markup !== null &&
      String(marketData.markup).trim() !== ""
        ? String(marketData.markup)
        : "0";

    // Проверяем обязательные поля
    if (!selectedWarehouse) {
      errors.warehouse = "Обязательное поле.";
    }
    if (!category || (typeof category === "string" && !category.trim())) {
      errors.category = "Обязательное поле.";
    }
    if (!name || !name.trim()) {
      errors.name = "Обязательное поле";
    }
    if (!barcode || !barcode.trim()) {
      errors.barcode = "Обязательное поле";
    }

    const purchasePriceValue = purchase_price ? String(purchase_price) : "";
    const priceValue = price ? String(price) : "";

    if (itemType === "product") {
      if (purchasePriceValue.trim() === "") {
        errors.purchase_price = "Обязательное поле";
      }
      if (priceValue.trim() === "") {
        errors.price = "Обязательное поле";
      }
    }

    if (itemType === "service") {
      if (priceValue.trim() === "") {
        errors.price = "Обязательное поле";
      }
    }

    if (itemType === "kit") {
      if (priceValue.trim() === "") {
        errors.price = "Обязательное поле";
      }
      if (!marketData.kitProducts || marketData.kitProducts.length === 0) {
        errors.kitProducts = "Добавьте хотя бы один товар в комплект";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showAlert("Пожалуйста, заполните обязательные поля.");
      return;
    }

    // Валидация для долговых операций
    if (debt && !client) {
      showAlert("Выберите поставщика для долговой операции");
      return;
    }

    if (debt === "Долги") {
      if (!debtMonths || Number(debtMonths) <= 0) {
        showAlert("Введите корректный срок долга");
        return;
      }
      if (company?.subscription_plan?.name === "Старт") {
        if (!debtState.dueDate) {
          showAlert("Выберите дату оплаты");
          return;
        }
        if (!debtState.phone) {
          showAlert("Введите номер телефона поставщика");
          return;
        }
      }
    }

    if (debt === "Предоплата") {
      if (!amount || Number(amount) <= 0) {
        showAlert("Введите корректную сумму предоплаты");
        return;
      }
      const totalAmount = Number(purchase_price) * Number(quantity);
      if (Number(amount) > totalAmount) {
        showAlert("Сумма предоплаты не может превышать общую сумму");
        return;
      }
      if (!debtMonths || Number(debtMonths) <= 0) {
        showAlert("Введите корректный срок долга");
        return;
      }
    }

    // Формируем payload
    let payload = {
      name,
      barcode: barcode || null,
      brand: brand || null,
      category: category || null,
      price: price ? price.toString() : "0",
      client: client || null,
      plu: newItemData.plu ? Number(newItemData.plu) : null,
    };

    // Формируем payload согласно API схеме
    const characteristics = {
      height_cm:
        marketData.height && marketData.height !== "0"
          ? marketData.height.toString()
          : null,
      width_cm:
        marketData.width && marketData.width !== "0"
          ? marketData.width.toString()
          : null,
      depth_cm:
        marketData.depth && marketData.depth !== "0"
          ? marketData.depth.toString()
          : null,
      factual_weight_kg:
        marketData.weight && marketData.weight !== "0"
          ? marketData.weight.toString()
          : null,
      description: marketData.description || "",
    };

    // Проверяем, есть ли хотя бы одно заполненное поле в characteristics
    const hasCharacteristics =
      characteristics.height_cm !== null ||
      characteristics.width_cm !== null ||
      characteristics.depth_cm !== null ||
      characteristics.factual_weight_kg !== null ||
      (characteristics.description &&
        characteristics.description.trim() !== "");

    // Определяем is_weight для товара или услуги
    const isWeight =
      itemType === "product"
        ? marketData.isWeightProduct
        : itemType === "service"
        ? marketData.isFractionalService
        : false;

    // Автоматическая генерация PLU для весовых товаров или дробных услуг, если не указан
    let pluValue = null;
    if (isWeight) {
      // Если PLU уже указан пользователем, используем его
      if (marketData.plu && marketData.plu.trim() !== "") {
        pluValue = Number(marketData.plu);
      } else if (newItemData.plu && newItemData.plu.trim() !== "") {
        pluValue = Number(newItemData.plu);
      } else {
        // Генерируем PLU автоматически на основе количества весовых товаров
        // Используем weightProductsCount из store, который считается в fetchProductsAsync
        pluValue = weightProductsCount + 1;
      }
    }

    // Базовый payload для маркета
    // Убеждаемся, что цена правильно извлекается
    const finalPrice = price && price.trim() !== "" ? price.toString() : "0";

    // Определяем kind на основе itemType
    let kindValue = "product"; // default
    if (itemType === "service") {
      kindValue = "service";
    } else if (itemType === "kit") {
      kindValue = "bundle";
    }

    payload = {
      name,
      barcode: barcode || null,
      brand: brand || null,
      category: category || null,
      warehouse: selectedWarehouse, // Добавляем ID склада
      product_group: newItemData.product_group || null,
      article: marketData.article || "",
      unit: marketData.unit || "шт",
      is_weight: isWeight,
      price: finalPrice,
      discount_percent: (marketData.discount || "0").toString(),
      country: marketData.country || "",
      expiration_date: marketData.expiryDate || null,
      client: client || null,
      plu: pluValue,
      description: marketData.description || "",
      characteristics: hasCharacteristics ? characteristics : null,
      kind: kindValue,
    };

    // Извлекаем количество из newItemData, убеждаемся что это число
    const quantityValue =
      quantity && quantity.toString().trim() !== "" ? Number(quantity) : 0;

    if (itemType === "product") {
      // Для товара
      payload = {
        ...payload,
        purchase_price: (purchase_price || "0").toString(),
        markup_percent: normalizedMarkup,
        quantity: quantityValue,
        stock: true, // Товар есть на складе
      };
    } else if (itemType === "service") {
      // Для услуги
      payload = {
        ...payload,
        purchase_price: "0",
        markup_percent: normalizedMarkup,
        quantity: 0,
        stock: false, // Услуги не имеют остатка
        is_weight: marketData.isFractionalService, // Дробная услуга
      };
    } else if (itemType === "kit") {
      // Для комплекта - преобразуем товары из состава комплекта в packages_input
      // Каждый товар из kitProducts становится элементом packages_input
      const kitPackages = (marketData.kitProducts || [])
        .filter((product) => product.id) // Фильтруем только товары с ID
        .map((product) => ({
          name: product.name || "", // Название товара
          quantity_in_package: Number(product.quantity || 1), // Количество товара в комплекте
          unit: product.unit || marketData.unit || "шт", // Единица измерения
        }));

      // Также добавляем упаковки из packagings
      const packagingItems = (marketData.packagings || [])
        .filter((pkg) => pkg.name && pkg.name.trim()) // Фильтруем только заполненные упаковки
        .map((pkg) => ({
          name: pkg.name.trim(),
          quantity_in_package: Number(pkg.quantity || 1),
          unit: marketData.unit || "шт",
        }));

      // Объединяем товары из комплекта и упаковки
      const allPackages = [...kitPackages, ...packagingItems];

      payload = {
        ...payload,
        packages_input: allPackages.length > 0 ? allPackages : [], // Отправляем состав комплекта в packages_input
        purchase_price: "0", // Комплект не имеет цены закупки
        markup_percent: normalizedMarkup,
        quantity: quantityValue, // Используем количество из формы
        stock: false,
      };
    }

    try {
      let product;
      if (isEditMode && productId) {
        // Режим редактирования - используем единый эндпоинт товара склада:
        // /warehouse/products/{productId}/
        const response = await api.patch(
          `/warehouse/products/${productId}/`,
          payload
        );
        product = response.data;
      } else {
        // Режим создания - используем warehouse API
        const response = await api.post(
          `/warehouse/${selectedWarehouse}/products/`,
          payload
        );
        product = response.data;
      }

      // Packages (упаковки/состав) — используем эндпоинт склада:
      // /warehouse/products/{productId}/packages/
      try {
        const targetProductId = isEditMode
          ? productId
          : product?.id || product?.data?.id;

        // Для комплекта используем packages_input (состав + упаковки),
        // для остальных типов — только упаковки (packagings).
        const packagingItems = (marketData.packagings || [])
          .filter((pkg) => pkg.name && String(pkg.name).trim())
          .map((pkg) => ({
            name: String(pkg.name).trim(),
            quantity_in_package: Number(pkg.quantity || 1),
            unit: marketData.unit || "шт",
          }));

        const kitPackages =
          itemType === "kit"
            ? (marketData.kitProducts || [])
                .filter((p) => p.id)
                .map((p) => ({
                  name: p.name || "",
                  quantity_in_package: Number(p.quantity || 1),
                  unit: p.unit || marketData.unit || "шт",
                }))
            : [];

        const packagesPayload =
          itemType === "kit"
            ? [...kitPackages, ...packagingItems]
            : packagingItems;

        if (targetProductId && packagesPayload.length > 0) {
          // Сначала пробуем bulk (если API поддерживает), иначе — постим по одному
          try {
            await api.post(
              `/warehouse/products/${targetProductId}/packages/`,
              packagesPayload
            );
          } catch (_) {
            await Promise.allSettled(
              packagesPayload.map((pkg) =>
                api.post(
                  `/warehouse/products/${targetProductId}/packages/`,
                  pkg
                )
              )
            );
          }
        }
      } catch (e) {
        console.warn("Загрузка packages не удалась:", e);
        // не блокируем основной флоу
      }

      // Вычисляем totalAmount
      let totalAmount = 0;
      const purchasePrice =
        itemType === "product" ? purchase_price || "0" : "0";
      const qty = itemType === "product" ? Number(quantity || "0") : 0;
      totalAmount = Number(purchasePrice) * qty;

      // Загрузка изображений (после создания товара или при редактировании)
      try {
        const targetProductId = isEditMode
          ? productId
          : product?.id || product?.data?.id;
        if (targetProductId && images.length > 0) {
          // Загружаем только новые изображения (с файлами)
          const newImages = images.filter((im) => im.file);
          if (newImages.length > 0) {
            const uploads = newImages.map(async (im) => {
              const fd = new FormData();
              fd.append("image", im.file);
              if (im.alt) fd.append("alt", im.alt || name);
              fd.append("is_primary", String(Boolean(im.is_primary)));
              // Для склада используем единый эндпоинт загрузки изображений:
              // /warehouse/products/{productId}/images/
              const imagesEndpoint = `/warehouse/products/${targetProductId}/images/`;
              return api.post(imagesEndpoint, fd, {
                headers: { "Content-Type": "multipart/form-data" },
              });
            });
            if (uploads.length) await Promise.allSettled(uploads);
          }
        }
      } catch (e) {
        console.warn("Загрузка изображений не удалась:", e);
        // не блокируем основной флоу
      }

      // Создание долга, если выбран
      if (debt === "Долги" && client) {
        if (company?.subscription_plan?.name === "Старт") {
          await createDebt({
            name: pickSupplier?.full_name,
            phone: debtState.phone,
            due_date: debtState.dueDate,
            amount: totalAmount,
          });
        }

        // Создание сделки
        await dispatch(
          createDeal({
            clientId: client,
            title: `Долг ${pickSupplier?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      if (debt === "Предоплата" && client) {
        await dispatch(
          createDeal({
            clientId: client,
            title: `Предоплата ${pickSupplier?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            prepayment: Number(amount),
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      // Запрос на кассу при добавлении товара вручную (не в режиме редактирования и не долг)
      if (!isEditMode && debt !== "Долги") {
        const sellingPrice = price || newItemData.price || "0";
        const amountForCash = debt === "Предоплата" ? amount : sellingPrice;
        const cashboxId =
          cashData.cashbox ||
          selectCashBox ||
          (cashBoxes?.[0]?.id ?? cashBoxes?.[0]);

        if (cashboxId && Number(amountForCash) > 0) {
          try {
            await dispatch(
              addCashFlows({
                cashbox: cashboxId,
                type: "expense",
                name: name || product?.name || "Новый товар",
                amount: amountForCash,
                source_cashbox_flow_id: product.id,
                source_business_operation_id: "Склад",
                status:
                  company?.subscription_plan?.name === "Старт"
                    ? "approved"
                    : "pending",
              })
            ).unwrap();
          } catch (cashError) {
            console.warn("Ошибка при создании денежного потока:", cashError);
          }
        }
      }

      if (client !== "" && !debt) {
        await dispatch(
          createDeal({
            clientId: newItemData?.client,
            title: newItemData?.name,
            statusRu: "Продажа",
            amount: totalAmount,
          })
        ).unwrap();
      }

      // Очищаем данные долга
      setDebt("");
      setAmount("");
      setDebtMonths("");
      setShowDebtForm(false);
      setDebtState({
        phone: "",
        dueDate: "",
      });

      showAlert(
        isEditMode ? "Товар успешно обновлен!" : "Товар успешно добавлен!",
        "success",
        "Успех"
      );
      setTimeout(() => {
        if (selectedWarehouse) {
          navigate(`/crm/warehouse/stocks/${selectedWarehouse}`);
        } else {
          navigate("/crm/warehouse/stocks");
        }
      }, 1500);
    } catch (err) {
      console.error("Failed to create product:", err);
      const errorMessage = validateResErrors(err, 'Ошибка при добавлении товара')
      showAlert(
        errorMessage,
        "error",
        "Ошибка"
      );
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const client = await dispatch(createClientAsync(state)).unwrap();
      dispatch(fetchClientsAsync());
      setShowInputs(false);
      // Автоматически выбираем созданного поставщика
      if (client?.id) {
        setNewItemData((prev) => ({
          ...prev,
          client: String(client.id),
        }));
      }
      setState({
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
      showAlert("Поставщик успешно создан!", "success", "Успех");
    } catch (e) {
      console.log(e);
      showAlert(
        `Ошибка при создании поставщика: ${e.message || JSON.stringify(e)}`,
        "error",
        "Ошибка"
      );
    }
  };

  const onSubmitBrand = async (e) => {
    e.preventDefault();
    if (!newBrand.name || !newBrand.name.trim()) {
      showAlert("Введите название бренда", "error", "Ошибка");
      return;
    }
    try {
      const brand = await dispatch(
        createWarehouseBrandAsync({ name: newBrand.name.trim() })
      ).unwrap();
      dispatch(fetchWarehouseBrandsAsync());
      setShowBrandInputs(false);
      // Автоматически выбираем созданный бренд
      setNewItemData((prev) => ({
        ...prev,
        brand: brand.id || brand.name || newBrand.name.trim(),
      }));
      setNewBrand({ name: "" });
      showAlert("Бренд успешно создан!", "success", "Успех");
    } catch (e) {
      console.log(e);
      showAlert(
        `Ошибка при создании бренда: ${e.message || JSON.stringify(e)}`,
        "error",
        "Ошибка"
      );
    }
  };

  const onSubmitCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name || !newCategory.name.trim()) {
      showAlert("Введите название категории", "error", "Ошибка");
      return;
    }
    try {
      const category = await dispatch(
        createWarehouseCategoryAsync({ name: newCategory.name.trim() })
      ).unwrap();
      dispatch(fetchWarehouseCategoriesAsync());
      setShowCategoryInputs(false);
      // Автоматически выбираем созданную категорию
      setNewItemData((prev) => ({
        ...prev,
        category: category.id || category.name || newCategory.name.trim(),
      }));
      setNewCategory({ name: "" });
      showAlert("Категория успешно создана!", "success", "Успех");
    } catch (e) {
      console.log(e);
      showAlert(
        `Ошибка при создании категории: ${e.message || JSON.stringify(e)}`,
        "error",
        "Ошибка"
      );
    }
  };
  const filterClient = list.filter((item) => item.type === "suppliers");

  // Функция для вычисления контрольной суммы EAN-13
  const calculateEAN13Checksum = (digits) => {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits[i]);
      // Нечетные позиции (1, 3, 5, 7, 9, 11) умножаем на 1
      // Четные позиции (2, 4, 6, 8, 10, 12) умножаем на 3
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return checksum;
  };

  // Генерируем EAN-13 штрих-код автоматически при загрузке (только для создания)
  useEffect(() => {
    if (!isEditMode && !newItemData.barcode) {
      // Генерируем 12 случайных цифр
      const randomDigits = Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 10)
      ).join("");

      // Вычисляем контрольную сумму
      const checksum = calculateEAN13Checksum(randomDigits);

      // Формируем полный EAN-13 код (12 цифр + контрольная сумма)
      const barcode = randomDigits + checksum;

      setNewItemData((prev) => ({
        ...prev,
        barcode: barcode,
      }));
    }
  }, [isEditMode]);

  // Генерируем ПЛУ автоматически если пустой
  useEffect(() => {
    if (!newItemData.plu) {
      setNewItemData((prev) => ({
        ...prev,
        plu: "0001",
      }));
    }
  }, []);

  // Генерируем код товара на основе count из API (только для создания)
  useEffect(() => {
    if (!isEditMode && !marketData.code) {
      // Новый код = count + 1, форматируем как 4-значное число
      // Например, если count = 20, новый будет 0021
      const newCode = String((count || 0) + 1).padStart(4, "0");
      setMarketData((prev) => ({ ...prev, code: newCode }));
    }
  }, [isEditMode, count, marketData.code]);

  // Автоматическая генерация PLU для весового товара или дробной услуги
  useEffect(() => {
    const isWeight =
      (itemType === "product" && marketData.isWeightProduct) ||
      (itemType === "service" && marketData.isFractionalService);

    // Генерируем PLU только если:
    // 1. Товар/услуга весовой/дробный
    // 2. PLU еще не заполнен вручную
    // 3. weightProductsCount доступен
    if (isWeight && (!marketData.plu || marketData.plu.trim() === "")) {
      const generatedPlu = weightProductsCount + 1;
      setMarketData((prev) => ({ ...prev, plu: String(generatedPlu) }));
    } else if (!isWeight && marketData.plu) {
      // Если весовой режим выключен, очищаем PLU
      setMarketData((prev) => ({ ...prev, plu: "" }));
    }
  }, [
    itemType,
    marketData.isWeightProduct,
    marketData.isFractionalService,
    weightProductsCount,
    marketData.plu,
  ]);

  // Обработчик изменения данных для маркета
  const handleMarketDataChange = (field, value) => {
    setMarketData((prev) => ({ ...prev, [field]: value }));
  };

  // Генерация EAN-13 штрих-кода для маркета
  const generateBarcode = () => {
    // Генерируем 12 случайных цифр
    const randomDigits = Array.from({ length: 12 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");

    // Вычисляем контрольную сумму
    const checksum = calculateEAN13Checksum(randomDigits);

    // Формируем полный EAN-13 код (12 цифр + контрольная сумма)
    const barcode = randomDigits + checksum;

    setNewItemData((prev) => ({ ...prev, barcode }));
  };

  // Поиск товаров для комплекта
  const handleKitSearch = (searchTerm) => {
    handleMarketDataChange("kitSearchTerm", searchTerm);
    if (searchTerm.trim()) {
      const filtered = products.filter((p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setKitSearchResults(filtered.slice(0, 10));
      setShowKitSearch(true);
    } else {
      setKitSearchResults([]);
      setShowKitSearch(false);
    }
  };

  // Добавление товара в комплект
  const addProductToKit = (product) => {
    if (!marketData.kitProducts.find((p) => p.id === product.id)) {
      const updatedKitProducts = [
        ...marketData.kitProducts,
        { ...product, quantity: 1 },
      ];
      setMarketData((prev) => ({
        ...prev,
        kitProducts: updatedKitProducts,
      }));
      // Цена будет автоматически пересчитана через useEffect
    }
    handleMarketDataChange("kitSearchTerm", "");
    setShowKitSearch(false);
  };

  // Удаление товара из комплекта
  const removeProductFromKit = (productId) => {
    const updatedKitProducts = marketData.kitProducts.filter(
      (p) => p.id !== productId
    );
    setMarketData((prev) => ({
      ...prev,
      kitProducts: updatedKitProducts,
    }));
    // Цена будет автоматически пересчитана через useEffect
  };

  // Обновление количества товара в комплекте
  const handleUpdateKitProductQuantity = (productId, quantity) => {
    const updatedKitProducts = marketData.kitProducts.map((p) =>
      p.id === productId ? { ...p, quantity: parseFloat(quantity) || 1 } : p
    );
    setMarketData((prev) => ({
      ...prev,
      kitProducts: updatedKitProducts,
    }));
    // Цена будет автоматически пересчитана через useEffect
  };

  // Пересчет стоимости комплекта
  const recalculateKitPrice = () => {
    const totalCost = marketData.kitProducts.reduce((sum, item) => {
      // Используем цену продажи товара, если есть, иначе цену закупки
      const itemPrice = parseFloat(item.price || item.purchase_price || 0);
      const itemQuantity = parseFloat(item.quantity || 1);
      return sum + itemPrice * itemQuantity;
    }, 0);
    const calculatedPrice = Math.round(totalCost * 100) / 100;
    handleMarketDataChange("purchasePrice", calculatedPrice.toString());
    // Устанавливаем цену продажи равной сумме стоимостей товаров
    setNewItemData((prev) => ({
      ...prev,
      price: calculatedPrice.toString(),
    }));
  };

  return (
    <>
      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
      />
      <div className="add-product-page">
        <div className="add-product-page__header">
          <button
            className="add-product-page__back"
            onClick={() => {
              if (selectedWarehouse) {
                navigate(`/crm/warehouse/stocks/${selectedWarehouse}`);
              } else {
                navigate("/crm/warehouse/stocks");
              }
            }}
          >
            <ArrowLeft size={20} />
            Вернуться к складу
          </button>
          <div className="add-product-page__title-section flex-col-reverse md:flex-row">
            <div className="add-product-page__icon h-[40px] md:h-[64px] md:w-[64px] w-full">
              <Plus size={24} className="md:w-[24px] w-[16px]" />
            </div>
            <div>
              <h1 className="add-product-page__title">
                {isEditMode ? "Редактирование товара" : "Создание товара"}
              </h1>
              <p className="add-product-page__subtitle">
                {isEditMode
                  ? "Измените информацию о товаре"
                  : "Заполните информацию о новом товаре"}
              </p>
            </div>
          </div>
        </div>

        <div className="add-product-page__content">
          {/* Индикатор загрузки в режиме редактирования */}
          {isEditMode && loadingProduct && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p>Загрузка данных товара...</p>
            </div>
          )}

          {/* Табы для выбора метода ввода - скрыты в режиме редактирования */}
          {!isEditMode && !loadingProduct && (
            <div className="add-product-page__tabs">
              <button
                className={`add-product-page__tab  text-[12px] md:text-[14px] ${
                  activeTab === 0 ? "add-product-page__tab--active" : ""
                }`}
                onClick={() => setActiveTab(0)}
              >
                <Package size={18} />
                Ввод вручную
              </button>
              <button
                className={`add-product-page__tab  text-[12px] md:text-[14px] py-2.5 px-3 md:py-3 md:px-6 ${
                  activeTab === 1 ? "add-product-page__tab--active" : ""
                }`}
                onClick={() => setActiveTab(1)}
              >
                <Scan size={18} />
                Сканирование
              </button>
            </div>
          )}

          {!isEditMode && !loadingProduct && activeTab === 1 ? (
            // Вкладка сканирования (для всех секторов)
            <div className="add-product-page__scan-section">
              {!scannedProduct && (
                <div className="add-product-page__scan-box">
                  <Scan size={48} />
                  <h3>Сканирование товара</h3>
                  <p>
                    Отсканируйте штрих-код товара для автоматического добавления
                    в склад
                  </p>
                </div>
              )}
              <AddProductBarcode
                warehouseUuid={selectedWarehouse || undefined}
                warehouseCategories={categories}
                warehouseCategory={newItemData.category}
                onWarehouseCategoryChange={(value) =>
                  setNewItemData((prev) => ({ ...prev, category: value }))
                }
                selectCashBox={selectCashBox}
                cashBoxes={cashBoxes}
                onClose={() => {
                  if (selectedWarehouse) {
                    navigate(`/crm/warehouse/stocks/${selectedWarehouse}`);
                  } else {
                    navigate("/crm/warehouse/stocks");
                  }
                }}
                onShowSuccessAlert={(productName) => {
                  showAlert(
                    `Товар "${productName}" успешно добавлен!`,
                    "success",
                    "Успех"
                  );
                  setTimeout(() => {
                    if (selectedWarehouse) {
                      navigate(`/crm/warehouse/stocks/${selectedWarehouse}`);
                    } else {
                      navigate("/crm/warehouse/stocks");
                    }
                  }, 1500);
                }}
                onShowErrorAlert={(errorMsg) => {
                  showAlert(errorMsg, "error", "Ошибка");
                }}
              />
            </div>
          ) : !loadingProduct ? (
            // Форма для маркета с выбором типа товара/услуги/комплекта
            <MarketProductForm
              itemType={itemType}
              setItemType={setItemType}
              newItemData={newItemData}
              setNewItemData={setNewItemData}
              marketData={marketData}
              groupOptions={groupOptions}
              handleMarketDataChange={handleMarketDataChange}
              handleChange={handleChange}
              brands={brands || []}
              categories={categories || []}
              products={products || []}
              filterClient={list.filter((item) => item.type === "suppliers")}
              handleSubmit={handleSubmit}
              creating={creating || updating}
              navigate={navigate}
              generateBarcode={generateBarcode}
              handleKitSearch={handleKitSearch}
              kitSearchResults={kitSearchResults}
              showKitSearch={showKitSearch}
              setShowKitSearch={setShowKitSearch}
              addProductToKit={addProductToKit}
              removeProductFromKit={removeProductFromKit}
              recalculateKitPrice={recalculateKitPrice}
              handleUpdateKitProductQuantity={handleUpdateKitProductQuantity}
              showKitRecalculateTooltip={showKitRecalculateTooltip}
              setShowKitRecalculateTooltip={setShowKitRecalculateTooltip}
              images={images}
              setImages={setImages}
              fileInputRef={fileInputRef}
              isEditMode={isEditMode}
              fieldErrors={fieldErrors}
              selectedWarehouse={selectedWarehouse}
              setSelectedWarehouse={setSelectedWarehouse}
              warehouses={warehouses}
              warehousesLoading={warehousesLoading}
              showBrandInputs={showBrandInputs}
              setShowBrandInputs={setShowBrandInputs}
              newBrand={newBrand}
              setNewBrand={setNewBrand}
              onSubmitBrand={onSubmitBrand}
              showCategoryInputs={showCategoryInputs}
              setShowCategoryInputs={setShowCategoryInputs}
              newCategory={newCategory}
              setNewCategory={setNewCategory}
              onSubmitCategory={onSubmitCategory}
              showInputs={showInputs}
              setShowInputs={setShowInputs}
              state={state}
              setState={setState}
              onSubmit={onSubmit}
              debt={debt}
              setDebt={setDebt}
              amount={amount}
              setAmount={setAmount}
              debtMonths={debtMonths}
              setDebtMonths={setDebtMonths}
              showDebtForm={showDebtForm}
              setShowDebtForm={setShowDebtForm}
              debtState={debtState}
              setDebtState={setDebtState}
              onChangeDebt={onChangeDebt}
              pickSupplier={pickSupplier}
              company={company}
            />
          ) : (
            <>
              {/* Вкладка ручного ввода (для других секторов) */}
              <div className="add-product-page__form">
                {/* Выбор типа товара */}
                <div className="add-product-page__section">
                  <label className="add-product-page__section-label">
                    Тип товара *
                  </label>
                  <div className="add-product-page__type-selector">
                    <button
                      className={`add-product-page__type-card ${
                        productType === "piece"
                          ? "add-product-page__type-card--active"
                          : ""
                      }`}
                      onClick={() => {
                        setProductType("piece");
                        setNewItemData((prev) => ({
                          ...prev,
                          scale_type: "piece",
                        }));
                      }}
                    >
                      <Package size={32} />
                      <span>Штучный товар</span>
                    </button>
                    <button
                      className={`add-product-page__type-card ${
                        productType === "weight"
                          ? "add-product-page__type-card--active"
                          : ""
                      }`}
                      onClick={() => {
                        setProductType("weight");
                        setNewItemData((prev) => ({
                          ...prev,
                          scale_type: "weight",
                        }));
                      }}
                    >
                      <ShoppingBag size={32} />
                      <span>Килограммовый товар</span>
                    </button>
                  </div>
                </div>

                {/* Основная информация */}
                <div className="add-product-page__section">
                  <div className="add-product-page__section-header">
                    <div className="add-product-page__section-number">1</div>
                    <h3 className="add-product-page__section-title">
                      Основная информация
                    </h3>
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Название товара *
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="Например, Монитор Dell 24 дюйма"
                      className="add-product-page__input"
                      value={newItemData.name}
                      onChange={handleChange}
                      required
                    />
                    {fieldErrors.name && (
                      <p className="add-product-page__error">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Штрих-код *
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      className="add-product-page__input"
                      value={newItemData.barcode}
                      onChange={handleChange}
                      required
                    />
                    {fieldErrors.barcode && (
                      <p className="add-product-page__error">
                        {fieldErrors.barcode}
                      </p>
                    )}
                  </div>

                  {company?.sector?.name !== "Барбершоп" && (
                    <>
                      <div className="add-product-page__form-group">
                        <label className="add-product-page__label">
                          ПЛУ (номер для весов)
                        </label>
                        <input
                          type="text"
                          name="plu"
                          placeholder="0001"
                          className="add-product-page__input"
                          value={newItemData.plu}
                          onChange={handleChange}
                        />
                        <span className="add-product-page__hint">
                          4-значный код для весов
                        </span>
                      </div>

                      <div className="add-product-page__form-group">
                        <label className="add-product-page__label">
                          Бренд *
                        </label>
                        <div className="add-product-page__supplier-row">
                          <select
                            name="brand"
                            className="add-product-page__input"
                            value={newItemData.brand}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Выберите бренд</option>
                            {brands.map((brand, idx) => (
                              <option key={brand.id ?? idx} value={brand.id}>
                                {brand.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="add-product-page__create-supplier"
                            onClick={() => setShowBrandInputs(!showBrandInputs)}
                            type="button"
                          >
                            + Создать бренд
                          </button>
                        </div>
                        {showBrandInputs && (
                          <form
                            className="add-product-page__supplier-form"
                            onSubmit={onSubmitBrand}
                          >
                            <input
                              className="add-product-page__input"
                              onChange={(e) =>
                                setNewBrand({
                                  ...newBrand,
                                  name: e.target.value,
                                })
                              }
                              type="text"
                              placeholder="Название бренда"
                              name="name"
                              value={newBrand.name}
                              required
                            />
                            <div className="add-product-page__form-actions">
                              <button
                                type="button"
                                className="add-product-page__cancel-btn"
                                onClick={() => {
                                  setShowBrandInputs(false);
                                  setNewBrand({ name: "" });
                                }}
                              >
                                Отмена
                              </button>
                              <button
                                type="submit"
                                className="add-product-page__save-btn"
                              >
                                Создать
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                      <div className="add-product-page__form-group">
                        <label className="add-product-page__label">
                          Категория *
                        </label>
                        <div className="add-product-page__supplier-row">
                          <select
                            name="category"
                            className="add-product-page__input"
                            value={newItemData.category}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Выберите категорию</option>
                            {categories.map((category, idx) => (
                              <option
                                key={category.id ?? idx}
                                value={category.id}
                              >
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="add-product-page__create-supplier"
                            onClick={() =>
                              setShowCategoryInputs(!showCategoryInputs)
                            }
                            type="button"
                          >
                            + Создать категорию
                          </button>
                        </div>
                        {showCategoryInputs && (
                          <form
                            className="add-product-page__supplier-form"
                            onSubmit={onSubmitCategory}
                          >
                            <input
                              className="add-product-page__input"
                              onChange={(e) =>
                                setNewCategory({
                                  ...newCategory,
                                  name: e.target.value,
                                })
                              }
                              type="text"
                              placeholder="Название категории"
                              name="name"
                              value={newCategory.name}
                              required
                            />
                            <div className="add-product-page__form-actions">
                              <button
                                type="button"
                                className="add-product-page__cancel-btn"
                                onClick={() => {
                                  setShowCategoryInputs(false);
                                  setNewCategory({ name: "" });
                                }}
                              >
                                Отмена
                              </button>
                              <button
                                type="submit"
                                className="add-product-page__save-btn"
                              >
                                Создать
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                      <div className="add-product-page__form-group">
                        <label className="add-product-page__label">
                          Группа (необязательно)
                        </label>
                        <select
                          name="product_group"
                          className="add-product-page__input"
                          value={newItemData.product_group}
                          onChange={handleChange}
                          disabled={!selectedWarehouse}
                          title={
                            !selectedWarehouse
                              ? "Сначала выберите склад"
                              : warehouseGroupsLoading
                              ? "Загрузка…"
                              : ""
                          }
                        >
                          <option value="">Без группы</option>
                          {groupOptions?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {warehouseGroupsError && (
                          <p className="add-product-page__hint">
                            Не удалось загрузить группы склада
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Информация о поставщике */}
                <div className="add-product-page__section">
                  <div className="add-product-page__section-header">
                    <div className="add-product-page__section-number">2</div>
                    <h3 className="add-product-page__section-title">
                      Информация о поставщике
                    </h3>
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Поставщик *
                    </label>
                    <div className="add-product-page__supplier-row">
                      <select
                        name="client"
                        className="add-product-page__input"
                        value={newItemData.client}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Выберите поставщика</option>
                        {filterClient.map((client, idx) => (
                          <option key={client.id ?? idx} value={client.id}>
                            {client.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-product-page__create-supplier"
                        onClick={() => setShowInputs(!showInputs)}
                      >
                        + Создать поставщика
                      </button>
                    </div>
                    {showInputs && (
                      <form
                        className="add-product-page__supplier-form"
                        onSubmit={onSubmit}
                      >
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          placeholder="ФИО"
                          name="full_name"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="llc"
                          placeholder="ОсОО"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="inn"
                          placeholder="ИНН"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="okpo"
                          placeholder="ОКПО"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="score"
                          placeholder="Р/СЧЁТ"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="bik"
                          placeholder="БИК"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="address"
                          placeholder="Адрес"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="text"
                          name="phone"
                          placeholder="Телефон"
                        />
                        <input
                          className="add-product-page__input"
                          onChange={onChange}
                          type="email"
                          name="email"
                          placeholder="Почта"
                        />
                        <div className="add-product-page__form-actions">
                          <button
                            type="button"
                            className="add-product-page__cancel-btn"
                            onClick={() => setShowInputs(false)}
                          >
                            Отмена
                          </button>
                          <button
                            type="submit"
                            className="add-product-page__save-btn"
                          >
                            Создать
                          </button>
                        </div>
                      </form>
                    )}

                    <label className="add-product-page__checkbox-label">
                      <input
                        type="checkbox"
                        checked={showDebtForm}
                        onChange={(e) => setShowDebtForm(e.target.checked)}
                      />
                      Добавить долг по этому товару
                    </label>

                    {showDebtForm && (
                      <div className="add-product-page__debt-form">
                        {!newItemData.client && (
                          <p className="add-product-page__error">
                            Выберите поставщика в форме выше!
                          </p>
                        )}
                        {company?.subscription_plan?.name === "Старт" &&
                          newItemData.client && (
                            <>
                              <div className="add-product-page__form-group">
                                <label className="add-product-page__label">
                                  Телефон поставщика
                                </label>
                                <input
                                  type="text"
                                  onChange={onChangeDebt}
                                  name="phone"
                                  value={debtState.phone}
                                  className="add-product-page__input"
                                />
                              </div>
                              <div className="add-product-page__form-group">
                                <label className="add-product-page__label">
                                  Дата оплаты
                                </label>
                                <input
                                  type="date"
                                  onChange={onChangeDebt}
                                  name="dueDate"
                                  value={debtState.dueDate}
                                  className="add-product-page__input"
                                />
                              </div>
                            </>
                          )}
                        <div className="add-product-page__form-group">
                          <label className="add-product-page__label">
                            Тип оплаты
                          </label>
                          <select
                            value={debt}
                            onChange={(e) => setDebt(e.target.value)}
                            className="add-product-page__input"
                          >
                            <option value="">Тип оплаты</option>
                            <option value="Предоплата">Предоплата</option>
                            <option value="Долги">Долг</option>
                          </select>
                        </div>
                        {debt === "Предоплата" && (
                          <>
                            <div className="add-product-page__form-group">
                              <label className="add-product-page__label">
                                Сумма предоплаты
                              </label>
                              <input
                                type="text"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="add-product-page__input"
                              />
                            </div>
                            <div className="add-product-page__form-group">
                              <label className="add-product-page__label">
                                Срок долга (мес.)
                              </label>
                              <input
                                type="text"
                                value={debtMonths}
                                onChange={(e) => setDebtMonths(e.target.value)}
                                className="add-product-page__input"
                              />
                            </div>
                          </>
                        )}
                        {debt === "Долги" && (
                          <div className="add-product-page__form-group">
                            <label className="add-product-page__label">
                              Срок долга (мес.)
                            </label>
                            <input
                              type="text"
                              value={debtMonths}
                              onChange={(e) => setDebtMonths(e.target.value)}
                              className="add-product-page__input"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Цена и количество */}
                <div className="add-product-page__section">
                  <div className="add-product-page__section-header">
                    <div className="add-product-page__section-number">3</div>
                    <h3 className="add-product-page__section-title">
                      Цена и количество
                    </h3>
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Закупочная цена *
                    </label>
                    <div className="add-product-page__price-input">
                      <input
                        type="text"
                        name="purchase_price"
                        placeholder="0.00"
                        className="add-product-page__input"
                        value={newItemData.purchase_price}
                        onChange={handleChange}
                        required
                      />
                      <span className="add-product-page__currency">P</span>
                    </div>
                    {fieldErrors.purchase_price && (
                      <p className="add-product-page__error">
                        {fieldErrors.purchase_price}
                      </p>
                    )}
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Розничная цена *
                    </label>
                    <div className="add-product-page__price-input">
                      <input
                        type="text"
                        name="price"
                        placeholder="0.00"
                        className="add-product-page__input"
                        value={newItemData.price}
                        onChange={handleChange}
                        required
                      />
                      <span className="add-product-page__currency">P</span>
                    </div>
                    {fieldErrors.price && (
                      <p className="add-product-page__error">
                        {fieldErrors.price}
                      </p>
                    )}
                  </div>

                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Количество *
                    </label>
                    <div className="add-product-page__price-input">
                      <input
                        type="text"
                        name="quantity"
                        placeholder="0"
                        className="add-product-page__input"
                        value={newItemData.quantity}
                        onChange={handleChange}
                        required
                      />
                      <span className="add-product-page__currency">шт</span>
                    </div>
                    {fieldErrors.quantity && (
                      <p className="add-product-page__error">
                        {fieldErrors.quantity}
                      </p>
                    )}
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="add-product-page__actions">
                  <button
                    className="add-product-page__cancel-btn"
                    onClick={() => {
                      if (selectedWarehouse) {
                        navigate(`/crm/warehouse/stocks/${selectedWarehouse}`);
                      } else {
                        navigate("/crm/warehouse/stocks");
                      }
                    }}
                    disabled={creating}
                  >
                    Отмена
                  </button>
                  <button
                    className="add-product-page__submit-btn"
                    onClick={handleSubmit}
                    disabled={creating}
                  >
                    {creating ? "Добавление..." : "Добавить товар"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Компонент формы для маркета
const MarketProductForm = ({
  itemType,
  setItemType,
  newItemData,
  setNewItemData,
  marketData,
  handleMarketDataChange,
  handleChange,
  brands,
  categories,
  products,
  filterClient,
  handleSubmit,
  creating,
  navigate,
  generateBarcode,
  handleKitSearch,
  kitSearchResults,
  showKitSearch,
  setShowKitSearch,
  addProductToKit,
  removeProductFromKit,
  recalculateKitPrice,
  handleUpdateKitProductQuantity,
  showKitRecalculateTooltip,
  setShowKitRecalculateTooltip,
  images,
  setImages,
  fileInputRef,
  isEditMode = false,
  fieldErrors = {},
  showBrandInputs,
  setShowBrandInputs,
  newBrand,
  setNewBrand,
  onSubmitBrand,
  showCategoryInputs,
  setShowCategoryInputs,
  newCategory,
  setNewCategory,
  onSubmitCategory,
  showInputs,
  setShowInputs,
  state,
  setState,
  onSubmit,
  debt,
  setDebt,
  amount,
  setAmount,
  debtMonths,
  setDebtMonths,
  showDebtForm,
  setShowDebtForm,
  debtState,
  setDebtState,
  onChangeDebt,
  pickSupplier,
  groupOptions,
  company,
  selectedWarehouse,
  setSelectedWarehouse,
  warehouses = [],
  warehousesLoading = false,
}) => {
  const [showPluTooltip, setShowPluTooltip] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState("");
  const countryDropdownRef = useRef(null);

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target)
      ) {
        setShowCountryDropdown(false);
        setCountrySearchTerm("");
      }
    };

    if (showCountryDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCountryDropdown]);

  // Добавление новой упаковки
  const handleAddPackaging = () => {
    const packaging = {
      id: Date.now(),
      name: "",
      quantity: "1",
    };
    const currentPackagings = marketData.packagings || [];
    handleMarketDataChange("packagings", [...currentPackagings, packaging]);
  };

  // Обновление упаковки
  const handleUpdatePackaging = (id, field, value) => {
    const currentPackagings = marketData.packagings || [];
    const updatedPackagings = currentPackagings.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    handleMarketDataChange("packagings", updatedPackagings);
  };

  // Удаление упаковки
  const handleRemovePackaging = (id) => {
    const currentPackagings = marketData.packagings || [];
    handleMarketDataChange(
      "packagings",
      currentPackagings.filter((p) => p.id !== id)
    );
  };

  // Фильтрация стран по поисковому запросу
  const filteredCountries = useMemo(() => {
    if (!countrySearchTerm.trim()) {
      return countries;
    }
    const searchLower = countrySearchTerm.toLowerCase();
    return countries.filter((country) =>
      country.name.toLowerCase().includes(searchLower)
    );
  }, [countrySearchTerm]);

  // Выбор страны
  const handleSelectCountry = (countryName) => {
    handleMarketDataChange("country", countryName);
    setShowCountryDropdown(false);
    setCountrySearchTerm("");
  };

 
  // Автоматический расчет цены продажи для комплекта при изменении состава
  useEffect(() => {
    if (itemType === "kit") {
      if (marketData.kitProducts.length > 0) {
        const totalCost = marketData.kitProducts.reduce((sum, item) => {
          // Используем цену продажи товара, если есть, иначе цену закупки
          const itemPrice = parseFloat(item.price || item.purchase_price || 0);
          const itemQuantity = parseFloat(item.quantity || 1);
          return sum + itemPrice * itemQuantity;
        }, 0);
        const calculatedPrice = Math.round(totalCost * 100) / 100;

        // Всегда автоматически обновляем цену продажи для комплекта
        setNewItemData((prev) => ({
          ...prev,
          price: calculatedPrice.toString(),
        }));
      } else {
        // Если товаров нет, очищаем цену
        setNewItemData((prev) => ({
          ...prev,
          price: "",
        }));
      }
    }
  }, [marketData.kitProducts, itemType]);

  // Состояние для отслеживания, была ли цена продажи изменена вручную
  const [isPriceManuallyChanged, setIsPriceManuallyChanged] = useState(false);
  // Состояние для отслеживания, была ли наценка изменена вручную
  const [isMarkupManuallyChanged, setIsMarkupManuallyChanged] = useState(false);

  // Автоматический расчет цены продажи на основе цены закупки и наценки
  useEffect(() => {
    if (itemType === "product" && !isPriceManuallyChanged) {
      const purchasePrice = parseFloat(newItemData.purchase_price) || 0;
      const markup = parseFloat(marketData.markup) || 0;

      if (purchasePrice > 0 && markup >= 0) {
        const sellingPrice = purchasePrice * (1 + markup / 100);
        const calculatedPrice = Math.round(sellingPrice * 100) / 100; // Округляем до 2 знаков

        setNewItemData((prev) => ({
          ...prev,
          price: calculatedPrice.toString(),
        }));
      } else if (purchasePrice === 0 && markup === 0) {
        setNewItemData((prev) => ({
          ...prev,
          price: "",
        }));
      }
    }
  }, [
    newItemData.purchase_price,
    marketData.markup,
    itemType,
    isPriceManuallyChanged,
  ]);

  // Сброс флага ручного изменения при изменении цены закупки или наценки
  useEffect(() => {
    if (itemType === "product") {
      setIsPriceManuallyChanged(false);
    }
  }, [newItemData.purchase_price, marketData.markup, itemType]);

  // Обработчик изменения цены продажи вручную
  const handlePriceChange = (e) => {
    const { value } = e.target;
    setIsPriceManuallyChanged(true);
    handleChange(e);

    // Если пользователь сам НЕ трогал наценку, считаем её из цены закупки и цены продажи
    if (itemType === "product" && !isMarkupManuallyChanged) {
      const purchasePrice = parseFloat(newItemData.purchase_price) || 0;
      const sellingPrice = parseFloat(value) || 0;

      if (purchasePrice > 0 && sellingPrice > 0) {
        const markupPercent = (sellingPrice / purchasePrice - 1) * 100;
        const roundedMarkup = Math.round(markupPercent * 100) / 100;
        handleMarketDataChange("markup", roundedMarkup.toString());
      }
    }
  };

  return (
    <div className="market-product-form">
      {/* Выбор типа: Товар, Услуга, Комплект - скрыт в режиме редактирования */}
      {!isEditMode && (
        <div className="market-product-form__type-selector">
          <button
            className={`market-product-form__type-card ${
              itemType === "product"
                ? "market-product-form__type-card--active"
                : ""
            }`}
            onClick={() => setItemType("product")}
          >
            <h3 className="text-center">Товар</h3>
            <p className="text-center">
              Продукт, имеющий остаток, который необходимо восполнять
            </p>
          </button>
          <button
            className={`market-product-form__type-card ${
              itemType === "service"
                ? "market-product-form__type-card--active"
                : ""
            }`}
            onClick={() => setItemType("service")}
          >
            <h3 className="text-center">Услуга</h3>
            <p className="text-center">Продукт, не имеющий остатка на складе</p>
          </button>
          <button
            className={`market-product-form__type-card ${
              itemType === "kit" ? "market-product-form__type-card--active" : ""
            }`}
            onClick={() => setItemType("kit")}
          >
            <h3 className="text-center">Комплект</h3>
            <p className="text-center">
              Продукт, состоящий из нескольких других
            </p>
          </button>
        </div>
      )}

      {/* Выбор склада */}
      <div className="market-product-form__section">
        <h3 className="market-product-form__section-title">Выбор склада</h3>
        <div className="market-product-form__form-group">
          <label className="market-product-form__label">Склад *</label>
          <select
            className="market-product-form__input"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            required
            disabled={isEditMode || warehousesLoading}
          >
            <option value="">Выберите склад</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name || warehouse.title || `Склад #${warehouse.id}`}
              </option>
            ))}
          </select>
          {fieldErrors.warehouse && (
            <p className="add-product-page__error">{fieldErrors.warehouse}</p>
          )}
        </div>
      </div>

      {/* Основная информация */}
      <div className="market-product-form__section">
        <h3 className="market-product-form__section-title">
          Основная информация
        </h3>

        <div className="market-product-form__form-group">
          <label className="market-product-form__label">Наименование *</label>
          <input
            type="text"
            name="name"
            placeholder="Введите наименование"
            className="market-product-form__input"
            value={newItemData.name}
            onChange={handleChange}
            required
          />
          {fieldErrors.name && (
            <p className="add-product-page__error">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">
              {itemType === "service" ? "Код услуги" : "Код товара"}
            </label>
            <input
              type="text"
              className="market-product-form__input"
              value={marketData.code}
              readOnly
              placeholder="Генерируется автоматически"
            />
          </div>

          <div className="market-product-form__form-group">
            <label className="market-product-form__label">
              Штрих-код{" "}
              <button
                type="button"
                className="market-product-form__generate-link"
                onClick={generateBarcode}
              >
                (Сгенерировать)
              </button>
            </label>
            <input
              type="text"
              name="barcode"
              placeholder="Введите штрих-код"
              className="market-product-form__input"
              value={newItemData.barcode}
              onChange={handleChange}
            />
            {fieldErrors.barcode && (
              <p className="add-product-page__error">{fieldErrors.barcode}</p>
            )}
          </div>

          <div className="market-product-form__form-group col-span-full xl:col-span-1">
            <label className="market-product-form__label">Артикул</label>
            <input
              type="text"
              placeholder="Введите артикул"
              className="market-product-form__input"
              value={marketData.article}
              onChange={(e) =>
                handleMarketDataChange("article", e.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* Изображение */}
      <div className="market-product-form__section">
        <h3 className="market-product-form__section-title">Изображение</h3>
        <div className="market-product-form__image-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const newImages = files.map((file, idx) => ({
                file,
                alt: "",
                is_primary: images.length === 0 && idx === 0,
                preview: URL.createObjectURL(file),
              }));
              setImages((prev) => [...prev, ...newImages]);
              // Сброс input для возможности повторного выбора того же файла
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
          />
          <div
            className="market-product-form__image-placeholder"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files || []).filter((f) =>
                f.type.startsWith("image/")
              );
              const newImages = files.map((file, idx) => ({
                file,
                alt: "",
                is_primary: images.length === 0 && idx === 0,
                preview: URL.createObjectURL(file),
              }));
              setImages((prev) => [...prev, ...newImages]);
            }}
            style={{ cursor: "pointer" }}
          >
            <p>Выберите фото для загрузки</p>
            <p>или перетащите его мышью</p>
            <button
              type="button"
              className="market-product-form__image-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              +
            </button>
          </div>
          {images.length > 0 && (
            <div className="market-product-form__image-list">
              {images.map((img, idx) => (
                <div key={idx} className="market-product-form__image-item">
                  <img
                    src={img.preview}
                    alt={img.alt || "Preview"}
                    className="market-product-form__image-preview"
                  />
                  <button
                    type="button"
                    className="market-product-form__image-remove"
                    onClick={() => {
                      if (img.preview) URL.revokeObjectURL(img.preview);
                      const newImages = images.filter((_, i) => i !== idx);
                      // Если удалили главное, назначаем первое как главное
                      if (
                        img.is_primary &&
                        newImages.length > 0 &&
                        !newImages.some((p) => p.is_primary)
                      ) {
                        newImages[0] = { ...newImages[0], is_primary: true };
                      }
                      setImages(newImages);
                    }}
                  >
                    ×
                  </button>
                  {img.is_primary && (
                    <span className="market-product-form__image-primary">
                      Главное
                    </span>
                  )}
                  <button
                    type="button"
                    className="market-product-form__image-set-primary"
                    onClick={() => {
                      setImages((prev) =>
                        prev.map((it, i) => ({
                          ...it,
                          is_primary: i === idx,
                        }))
                      );
                    }}
                  >
                    {img.is_primary ? "Главное" : "Сделать главным"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Категория и Бренд */}
      <div className="market-product-form__section">
        <div className="market-product-form__two-columns">
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">Категория</label>
            <div className="add-product-page__supplier-row">
              <select
                name="category"
                className="market-product-form__input"
                value={newItemData.category}
                onChange={handleChange}
                required
              >
                <option value="">Выберите категорию</option>
                {categories.map((category, idx) => (
                  <option key={category.id ?? idx} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                className="add-product-page__create-supplier"
                onClick={() => setShowCategoryInputs(!showCategoryInputs)}
                type="button"
              >
                + Создать категорию
              </button>
            </div>
            {fieldErrors.category && (
              <p className="add-product-page__error">{fieldErrors.category}</p>
            )}
            {showCategoryInputs && (
              <form
                className="add-product-page__supplier-form"
                onSubmit={onSubmitCategory}
              >
                <input
                  className="add-product-page__input"
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  type="text"
                  placeholder="Название категории"
                  name="name"
                  value={newCategory.name}
                  required
                />
                <div className="add-product-page__form-actions">
                  <button
                    type="button"
                    className="add-product-page__cancel-btn"
                    onClick={() => {
                      setShowCategoryInputs(false);
                      setNewCategory({ name: "" });
                    }}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="add-product-page__save-btn">
                    Создать
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="market-product-form__form-group">
            <label className="market-product-form__label">Бренд</label>
            <div className="add-product-page__supplier-row">
              <select
                name="brand"
                className="market-product-form__input"
                value={newItemData.brand}
                onChange={handleChange}
                required
              >
                <option value="">Выберите бренд</option>
                {brands.map((brand, idx) => (
                  <option key={brand.id ?? idx} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <button
                className="add-product-page__create-supplier"
                onClick={() => setShowBrandInputs(!showBrandInputs)}
                type="button"
              >
                + Создать бренд
              </button>
            </div>
            {showBrandInputs && (
              <form
                className="add-product-page__supplier-form"
                onSubmit={onSubmitBrand}
              >
                <input
                  className="add-product-page__input"
                  onChange={(e) =>
                    setNewBrand({ ...newBrand, name: e.target.value })
                  }
                  type="text"
                  placeholder="Название бренда"
                  name="name"
                  value={newBrand.name}
                  required
                />
                <div className="add-product-page__form-actions">
                  <button
                    type="button"
                    className="add-product-page__cancel-btn"
                    onClick={() => {
                      setShowBrandInputs(false);
                      setNewBrand({ name: "" });
                    }}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="add-product-page__save-btn">
                    Создать
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="market-product-form__form-group">
          <label className="market-product-form__label">
            Группа (необязательно)
          </label>
          <select
            name="product_group"
            className="market-product-form__input"
            value={newItemData.product_group}
            onChange={handleChange}
            disabled={!selectedWarehouse}
            title={
              !selectedWarehouse
                ? "Сначала выберите склад"
                : "Загрузка…"
            }
          >
            <option value="">Без группы</option>
            {groupOptions?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        
        </div>
      </div>

      {/* Единица измерения и Количество */}
      <div className="market-product-form__section">
        <div className="market-product-form__unit-row justify-between items-center">
          <div className="market-product-form__form-group w-full">
            <label className="market-product-form__label">
              Единица измерения
            </label>
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                className="market-product-form__input"
                value={marketData.unit}
                onChange={(e) => handleMarketDataChange("unit", e.target.value)}
              />
              <button
                type="button"
                className="market-product-form__add-packaging-btn"
                onClick={handleAddPackaging}
              >
                Добавить упаковку
              </button>
            </div>
          </div>

          {/* Чекбокс показывается только для товара и услуги, не для комплекта */}
          {itemType !== "kit" && (
            <div className="market-product-form__toggle-group">
              <label className="market-product-form__toggle">
                <input
                  type="checkbox"
                  checked={
                    itemType === "product"
                      ? marketData.isWeightProduct
                      : marketData.isFractionalService
                  }
                  onChange={(e) =>
                    handleMarketDataChange(
                      itemType === "product"
                        ? "isWeightProduct"
                        : "isFractionalService",
                      e.target.checked
                    )
                  }
                />
                <span>
                  {itemType === "product" ? "Весовой товар" : "Дробная услуга"}
                </span>
              </label>
            </div>
          )}
        </div>
        {marketData.packagings && marketData.packagings.length > 0 && (
          <div className="market-product-form__packaging-list">
            {marketData.packagings.map((packaging) => (
              <div
                key={packaging.id}
                className="market-product-form__packaging-item"
              >
                <div className="market-product-form__packaging-item-row">
                  <div className="market-product-form__form-group">
                    <label className="market-product-form__label">
                      Упаковка
                    </label>
                    <input
                      type="text"
                      className="market-product-form__input"
                      placeholder="Введите название упаковки"
                      value={packaging.name}
                      onChange={(e) =>
                        handleUpdatePackaging(
                          packaging.id,
                          "name",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="market-product-form__form-group">
                    <label className="market-product-form__label">
                      Количество в упаковке
                    </label>
                    <div className="market-product-form__packaging-quantity">
                      <input
                        type="text"
                        className="market-product-form__input"
                        value={packaging.quantity}
                        onChange={(e) =>
                          handleUpdatePackaging(
                            packaging.id,
                            "quantity",
                            e.target.value
                          )
                        }
                      />
                      <span className="market-product-form__unit-label">
                        ШТ
                      </span>
                      <button
                        type="button"
                        className="market-product-form__remove-packaging-btn"
                        onClick={() => handleRemovePackaging(packaging.id)}
                        title="Удалить упаковку"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="market-product-form__form-group mt-4">
          <label className="market-product-form__label">Количество *</label>
          <div className="market-product-form__price-input">
            <input
              type="text"
              name="quantity"
              className="market-product-form__input"
              value={newItemData.quantity}
              onChange={handleChange}
              placeholder="0"
              required
            />
            <span className="market-product-form__currency">
              {marketData.unit || "шт"}
            </span>
          </div>
        </div>

        {/* Список упаковок */}
      </div>

      {/* Добавить PLU код - показывается для весового товара или дробной услуги */}
      {((itemType === "product" && marketData.isWeightProduct) ||
        (itemType === "service" && marketData.isFractionalService)) && (
        <div className="market-product-form__section">
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">
              Добавить PLU код
            </label>
            <div className="market-product-form__plu-input-wrapper">
              <input
                type="text"
                className="market-product-form__input"
                placeholder="Введите PLU код"
                value={marketData.plu}
                onChange={(e) => handleMarketDataChange("plu", e.target.value)}
              />
              <div className="market-product-form__help-wrapper">
                <button
                  type="button"
                  className="market-product-form__help-btn"
                  onMouseEnter={() => setShowPluTooltip(true)}
                  onMouseLeave={() => setShowPluTooltip(false)}
                >
                  <HelpCircle size={20} />
                </button>
                {showPluTooltip && (
                  <div className="market-product-form__tooltip">
                    <p>
                      PLU код применяется в весах с печатью этикетки содержащей
                      информацию о весе товара. Формат штрих-кода для настройки
                      весов: undefined PPPPP WWWWW S где: PPPPP - PLU код
                      товара; WWWWW - вес товара в тысячных единицах; S -
                      контрольная сумма
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Характеристики товара */}
      <div className="market-product-form__section">
        <h3 className="market-product-form__section-title">
          Характеристики товара
        </h3>
        <div className="market-product-form__characteristics-grid grid-cols-1 sm:grid-cols-2">
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">Высота, см</label>
            <input
              type="text"
              className="market-product-form__input"
              value={marketData.height}
              onChange={(e) => handleMarketDataChange("height", e.target.value)}
            />
          </div>
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">Ширина, см</label>
            <input
              type="text"
              className="market-product-form__input"
              value={marketData.width}
              onChange={(e) => handleMarketDataChange("width", e.target.value)}
            />
          </div>
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">Глубина, см</label>
            <input
              type="text"
              className="market-product-form__input"
              value={marketData.depth}
              onChange={(e) => handleMarketDataChange("depth", e.target.value)}
            />
          </div>
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">
              Фактический вес, кг
            </label>
            <input
              type="text"
              className="market-product-form__input"
              value={marketData.weight}
              onChange={(e) => handleMarketDataChange("weight", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Описание */}
      <div className="market-product-form__section">
        <h3 className="market-product-form__section-title">Описание</h3>
        <textarea
          className="market-product-form__textarea"
          placeholder="Введите описание товара"
          value={marketData.description}
          onChange={(e) =>
            handleMarketDataChange("description", e.target.value)
          }
        />
      </div>

      {/* Контент в зависимости от типа */}
      {itemType === "product" && (
        <>
          {/* Страна */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">
              Страна производства товара
            </h3>
            <div
              className="market-product-form__country-wrapper"
              ref={countryDropdownRef}
            >
              <div
                className="market-product-form__country-select"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              >
                <div className="market-product-form__country-select-input">
                  {marketData.country ? (
                    <span>
                      {
                        countries.find((c) => c.name === marketData.country)
                          ?.flag
                      }{" "}
                      {marketData.country}
                    </span>
                  ) : (
                    <span className="market-product-form__country-placeholder">
                      Выберите страну
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={20}
                  className={`market-product-form__country-chevron ${
                    showCountryDropdown ? "open" : ""
                  }`}
                />
              </div>
              {showCountryDropdown && (
                <div className="market-product-form__country-dropdown">
                  <div className="market-product-form__country-search">
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Поиск страны..."
                      value={countrySearchTerm}
                      onChange={(e) => setCountrySearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="market-product-form__country-list">
                    {filteredCountries.length > 0 ? (
                      filteredCountries.map((country) => (
                        <div
                          key={country.code}
                          className={`market-product-form__country-item ${
                            marketData.country === country.name
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => handleSelectCountry(country.name)}
                        >
                          <span className="market-product-form__country-flag">
                            {country.flag}
                          </span>
                          <span className="market-product-form__country-name">
                            {country.name}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="market-product-form__country-no-results">
                        Страна не найдена
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Цены для товара */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">Цены</h3>
            <div className="market-product-form__prices-grid">
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">
                  Цена закупки
                </label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    name="purchase_price"
                    className="market-product-form__input"
                    value={newItemData.purchase_price}
                    onChange={handleChange}
                  />
                  <span className="market-product-form__currency">COM</span>
                </div>
                {fieldErrors.purchase_price && (
                  <p className="add-product-page__error">
                    {fieldErrors.purchase_price}
                  </p>
                )}
              </div>
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">Наценка</label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    className="market-product-form__input"
                    value={marketData.markup}
                    onChange={(e) => {
                      setIsMarkupManuallyChanged(true);
                      handleMarketDataChange("markup", e.target.value);
                    }}
                  />
                  <span className="market-product-form__currency">%</span>
                </div>
              </div>
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">
                  Цена продажи
                </label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    name="price"
                    className="market-product-form__input"
                    value={newItemData.price}
                    onChange={handlePriceChange}
                    placeholder="Рассчитывается автоматически"
                  />
                  <span className="market-product-form__currency">COM</span>
                </div>
                {fieldErrors.price && (
                  <p className="add-product-page__error">{fieldErrors.price}</p>
                )}
              </div>
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">Скидка</label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    className="market-product-form__input"
                    value={marketData.discount}
                    onChange={(e) =>
                      handleMarketDataChange("discount", e.target.value)
                    }
                  />
                  <span className="market-product-form__currency">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Склад для товара */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">Склад</h3>
            <div className="market-product-form__form-group">
              <label className="market-product-form__label">
                Выберите поставщика
              </label>
              <div className="add-product-page__supplier-row">
                <select
                  className="market-product-form__input"
                  value={newItemData.client}
                  onChange={handleChange}
                  name="client"
                >
                  <option value="">Выберите поставщика</option>
                  {filterClient.map((client, idx) => (
                    <option key={client.id || idx} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
                <button
                  className="add-product-page__create-supplier"
                  onClick={() => setShowInputs(!showInputs)}
                  type="button"
                >
                  + Создать поставщика
                </button>
              </div>
              {showInputs && (
                <form
                  className="add-product-page__supplier-form"
                  onSubmit={onSubmit}
                >
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    placeholder="ФИО"
                    name="full_name"
                    value={state.full_name}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="llc"
                    placeholder="ОсОО"
                    value={state.llc}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="inn"
                    placeholder="ИНН"
                    value={state.inn}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="okpo"
                    placeholder="ОКПО"
                    value={state.okpo}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="score"
                    placeholder="Р/СЧЁТ"
                    value={state.score}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="bik"
                    placeholder="БИК"
                    value={state.bik}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="address"
                    placeholder="Адрес"
                    value={state.address}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="text"
                    name="phone"
                    placeholder="Телефон"
                    value={state.phone}
                  />
                  <input
                    className="add-product-page__input"
                    onChange={(e) =>
                      setState({ ...state, [e.target.name]: e.target.value })
                    }
                    type="email"
                    name="email"
                    placeholder="Почта"
                    value={state.email}
                  />
                  <div className="add-product-page__form-actions">
                    <button
                      type="button"
                      className="add-product-page__cancel-btn"
                      onClick={() => {
                        setShowInputs(false);
                        setState({
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
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="add-product-page__save-btn"
                    >
                      Создать
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Чекбокс для добавления долга */}
            <label className="add-product-page__checkbox-label">
              <input
                type="checkbox"
                checked={showDebtForm}
                onChange={(e) => setShowDebtForm(e.target.checked)}
              />
              Добавить долг по этому товару
            </label>

            {/* Форма долга */}
            {showDebtForm && (
              <div className="add-product-page__debt-form">
                {!newItemData.client && (
                  <p className="add-product-page__error">
                    Выберите поставщика в форме выше!
                  </p>
                )}
                {company?.subscription_plan?.name === "Старт" &&
                  newItemData.client && (
                    <>
                      <div className="market-product-form__form-group">
                        <label className="market-product-form__label">
                          Телефон поставщика
                        </label>
                        <input
                          type="text"
                          onChange={onChangeDebt}
                          name="phone"
                          value={debtState.phone}
                          className="market-product-form__input"
                        />
                      </div>
                      <div className="market-product-form__form-group">
                        <label className="market-product-form__label">
                          Дата оплаты
                        </label>
                        <input
                          type="date"
                          onChange={onChangeDebt}
                          name="dueDate"
                          value={debtState.dueDate}
                          className="market-product-form__input"
                        />
                      </div>
                    </>
                  )}
                <div className="market-product-form__form-group">
                  <label className="market-product-form__label">
                    Тип оплаты
                  </label>
                  <select
                    value={debt}
                    onChange={(e) => setDebt(e.target.value)}
                    className="market-product-form__input"
                  >
                    <option value="">Тип оплаты</option>
                    <option value="Предоплата">Предоплата</option>
                    <option value="Долги">Долг</option>
                  </select>
                </div>
                {debt === "Предоплата" && (
                  <>
                    <div className="market-product-form__form-group">
                      <label className="market-product-form__label">
                        Сумма предоплаты
                      </label>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="market-product-form__input"
                      />
                    </div>
                    <div className="market-product-form__form-group">
                      <label className="market-product-form__label">
                        Срок долга (мес.)
                      </label>
                      <input
                        type="text"
                        value={debtMonths}
                        onChange={(e) => setDebtMonths(e.target.value)}
                        className="market-product-form__input"
                      />
                    </div>
                  </>
                )}
                {debt === "Долги" && (
                  <div className="market-product-form__form-group">
                    <label className="market-product-form__label">
                      Срок долга (мес.)
                    </label>
                    <input
                      type="text"
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      className="market-product-form__input"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="market-product-form__form-group">
              <label className="market-product-form__label">
                Минимальный остаток
              </label>
              <input
                type="text"
                className="market-product-form__input"
                value={marketData.minStock}
                onChange={(e) =>
                  handleMarketDataChange("minStock", e.target.value)
                }
              />
            </div>
          </div>

          {/* Срок годности */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">
              Срок годности
            </h3>
            <div className="market-product-form__form-group">
              <input
                type="date"
                className="market-product-form__input"
                value={marketData.expiryDate}
                onChange={(e) =>
                  handleMarketDataChange("expiryDate", e.target.value)
                }
                placeholder="дд. мм. гггг"
              />
            </div>
          </div>
        </>
      )}

      {itemType === "service" && (
        <>
          {/* Цены для услуги */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">Цены</h3>
            <div className="market-product-form__prices-grid">
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">
                  Цена продажи
                </label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    name="price"
                    className="market-product-form__input"
                    value={newItemData.price}
                    onChange={handleChange}
                  />
                  <span className="market-product-form__currency">COM</span>
                </div>
              </div>
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">Скидка</label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    className="market-product-form__input"
                    value={marketData.discount}
                    onChange={(e) =>
                      handleMarketDataChange("discount", e.target.value)
                    }
                  />
                  <span className="market-product-form__currency">%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {itemType === "kit" && (
        <>
          {/* Состав комплекта */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">
              Состав комплекта
            </h3>
            <div className="market-product-form__form-group">
              <div className="market-product-form__search-wrapper">
                <Search
                  className="market-product-form__search-icon"
                  size={18}
                />
                <input
                  type="text"
                  className="market-product-form__input"
                  placeholder="поиск..."
                  value={marketData.kitSearchTerm}
                  onChange={(e) => handleKitSearch(e.target.value)}
                />
              </div>
              {showKitSearch && kitSearchResults.length > 0 && (
                <div className="market-product-form__search-results">
                  {kitSearchResults.map((product) => (
                    <div
                      key={product.id}
                      className="market-product-form__search-result-item"
                      onClick={() => addProductToKit(product)}
                    >
                      {product.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Список товаров в комплекте */}
            {marketData.kitProducts.length > 0 && (
              <div className="market-product-form__kit-products">
                {marketData.kitProducts.map((product) => (
                  <div
                    key={product.id}
                    className="market-product-form__kit-product-item"
                  >
                    <span>{product.name}</span>
                    <div className="market-product-form__kit-product-actions">
                      <input
                        type="text"
                        className="market-product-form__kit-quantity-input"
                        value={product.quantity || 1}
                        min="1"
                        onChange={(e) =>
                          handleUpdateKitProductQuantity(
                            product.id,
                            e.target.value
                          )
                        }
                      />
                      <button
                        className="market-product-form__remove-kit-btn"
                        onClick={() => removeProductFromKit(product.id)}
                        title="Удалить из комплекта"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <button className="market-product-form__show-more-btn">
                  ПОКАЗАТЬ ЕЩЕ
                </button>
              </div>
            )}

            {/* Область для выбранных товаров */}
            <div className="market-product-form__kit-selection-area">
              <p>← Выберите товары</p>
            </div>
          </div>

          {/* Цены для комплекта */}
          <div className="market-product-form__section">
            <h3 className="market-product-form__section-title">Цены</h3>
            <div className="market-product-form__prices-grid">
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">
                  Цена продажи
                </label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    name="price"
                    className="market-product-form__input"
                    value={newItemData.price}
                    onChange={handleChange}
                  />
                  <span className="market-product-form__currency">COM</span>
                  <div className="market-product-form__recalculate-wrapper">
                    <button
                      className="market-product-form__recalculate-btn"
                      onClick={recalculateKitPrice}
                    >
                      Пересчитать стоимость
                    </button>
                    <div className="market-product-form__help-wrapper">
                      <button
                        type="button"
                        className="market-product-form__help-btn"
                        onMouseEnter={() => setShowKitRecalculateTooltip(true)}
                        onMouseLeave={() => setShowKitRecalculateTooltip(false)}
                      >
                        <HelpCircle size={20} />
                      </button>
                      {showKitRecalculateTooltip && (
                        <div className="market-product-form__tooltip market-product-form__tooltip--kit">
                          <p>
                            Цена продажи комплекта будет пересчитана и равна
                            сумме стоимостей товаров состава по текущим ценам
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="market-product-form__form-group">
                <label className="market-product-form__label">Скидка</label>
                <div className="market-product-form__price-input">
                  <input
                    type="text"
                    className="market-product-form__input"
                    value={marketData.discount}
                    onChange={(e) =>
                      handleMarketDataChange("discount", e.target.value)
                    }
                  />
                  <span className="market-product-form__currency">%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Кнопки действий */}
      <div className="market-product-form__actions">
        <button
          className="market-product-form__cancel-btn"
          onClick={() => navigate("/crm/sklad")}
          disabled={creating}
        >
          Отмена
        </button>
        <button
          className="market-product-form__submit-btn"
          onClick={handleSubmit}
          disabled={creating}
        >
          {creating
            ? isEditMode
              ? "Сохранение..."
              : "Создание..."
            : isEditMode
            ? "Сохранить изменения"
            : "Создать товар"}
        </button>
      </div>
    </div>
  );
};

export default AddWarehouseProductPage;
