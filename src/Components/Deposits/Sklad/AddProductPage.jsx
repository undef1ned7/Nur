import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import { useClient } from "../../../store/slices/ClientSlice";
import { useProducts } from "../../../store/slices/productSlice";
import { useUser } from "../../../store/slices/userSlice";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { createDeal } from "../../../store/creators/saleThunk";
import AddProductBarcode from "./AddProductBarcode";
import {
  createProductAsync,
  updateProductAsync,
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
  createBrandAsync,
  createCategoryAsync,
} from "../../../store/creators/productCreators";
import { countries } from "../../../data/countries";
import api from "../../../api";
import AlertModal from "../../common/AlertModal/AlertModal";
import "./AddProductPage.scss";

// Импорт модулей
import * as constants from "./AddProductPage/constants";
import * as utils from "./AddProductPage/utils";
import { useProductImages, useKitProducts } from "./AddProductPage/hooks";
import {
  ProductTypeSelector,
  ProductBasicInfo,
  ProductImagesSection,
} from "./AddProductPage/components";
import axios from "axios";

const AddProductPage = () => {
  const { id: productId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list } = useClient();
  const {
    creating,
    updating,
    createError,
    brands,
    categories,
    scannedProduct,
    list: products,
    count,
    weightProductsCount,
  } = useProducts();
  const { company } = useUser();
  const { list: cashBoxes } = useCash();

  // Режим редактирования
  const isEditMode = !!productId;
  const [loadingProduct, setLoadingProduct] = useState(isEditMode);

  const [activeTab, setActiveTab] = useState(0); // 0 - Ввод вручную, 1 - Сканирование
  const [productType, setProductType] = useState("piece"); // "piece" или "weight"
  const [selectCashBox, setSelectCashBox] = useState("");

  // Для маркета: тип товара (товар/услуга/комплект)
  const [itemType, setItemType] = useState("product"); // "product", "service", "kit"

  // const [state1, setState2] = useState([]);
  // useEffect(() => {
  //   axios
  //     .get("https://example.com")
  //     .then(({ data }) => setState2(data))
  //     .catch((error) => console.error("Error:", error));
  // }, []);

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

  // Для поиска товаров в комплекте - используем хук
  const {
    kitProducts: kitProductsFromHook,
    setKitProducts: setKitProductsFromHook,
    kitSearchTerm: kitSearchTermFromHook,
    showKitSearch: showKitSearchFromHook,
    setShowKitSearch: setShowKitSearchFromHook,
    kitSearchResults: kitSearchResultsFromHook,
    handleKitSearch: handleKitSearchFromHook,
    addProductToKit: addProductToKitFromHook,
    removeProductFromKit: removeProductFromKitFromHook,
    updateKitProductQuantity: updateKitProductQuantityFromHook,
    recalculateKitPrice: recalculateKitPriceFromHook,
  } = useKitProducts(products);

  // Обработчик изменения данных для маркета (мемоизирован для оптимизации)
  // Объявляем ДО использования в useEffect
  const handleMarketDataChange = useCallback((field, value) => {
    setMarketData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Синхронизируем с marketData
  useEffect(() => {
    if (marketData.kitProducts !== kitProductsFromHook) {
      handleMarketDataChange("kitProducts", kitProductsFromHook);
    }
  }, [kitProductsFromHook, marketData.kitProducts, handleMarketDataChange]);

  // Синхронизируем kitSearchTerm
  useEffect(() => {
    if (marketData.kitSearchTerm !== kitSearchTermFromHook) {
      handleMarketDataChange("kitSearchTerm", kitSearchTermFromHook);
    }
  }, [kitSearchTermFromHook, marketData.kitSearchTerm, handleMarketDataChange]);

  const [showKitRecalculateTooltip, setShowKitRecalculateTooltip] =
    useState(false);

  // Изображения товара - используем хук
  const {
    images,
    setImages,
    fileInputRef,
    addImages,
    removeImage,
    setPrimaryImage,
  } = useProductImages();

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
    brand_name: "",
    category_name: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "",
    plu: "",
    scale_type: "",
  });

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

  // Id изображений при загрузке товара (для удаления с сервера при редактировании)
  const [initialProductImageIds, setInitialProductImageIds] = useState([]);

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
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
    // Загружаем все товары для точного подсчета весовых товаров
    // Оптимизация: загружаем только необходимое количество товаров
    dispatch(fetchProductsAsync({ page_size: 100 }));
  }, [dispatch]);
  console.log(cashData);

  // Загрузка данных товара для редактирования
  useEffect(() => {
    if (isEditMode && productId) {
      const loadProduct = async () => {
        try {
          setLoadingProduct(true);
          const response = await api.get(`/main/products/${productId}/`);
          const product = response.data;

          // Определяем тип товара на основе kind
          let detectedItemType = "product";
          if (product.kind === "service") {
            detectedItemType = "service";
          } else if (product.kind === "bundle") {
            detectedItemType = "kit";
          }
          setItemType(detectedItemType);

          // Заполняем основные данные
          // Форматируем цену до 3 знаков после запятой при загрузке для редактирования
          const formatPrice3Decimals = (v) => {
            if (v === null || v === undefined || v === "") return "";
            const n = Number(String(v).replace(",", "."));
            return Number.isFinite(n)
              ? (Math.round(n * 1000) / 1000).toString()
              : String(v);
          };
          setNewItemData({
            name: product.name || "",
            barcode: product.barcode || "",
            brand_name: product.brand_name || "",
            category_name: product.category_name || "",
            price: formatPrice3Decimals(product.price),
            quantity: product.quantity || "",
            client: product.client || "",
            purchase_price: formatPrice3Decimals(product.purchase_price),
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
            purchasePrice: formatPrice3Decimals(product.purchase_price) || "",
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

          // Загружаем изображения используя хук
          if (product.images && product.images.length > 0) {
            const loadedImages = product.images.map((img) => ({
              file: null,
              alt: img.alt || "",
              is_primary: img.is_primary || false,
              preview: img.image_url || img.image || "",
              id: img.id,
            }));
            setImages(loadedImages);
            setInitialProductImageIds(
              product.images.map((img) => img.id).filter(Boolean)
            );
          } else {
            setInitialProductImageIds([]);
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
  }, [isEditMode, productId]);

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

      // Форматируем цену до 3 знаков при дублировании
      const formatPrice3DecimalsDup = (v) => {
        if (v === null || v === undefined || v === "") return "";
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n)
          ? (Math.round(n * 1000) / 1000).toString()
          : String(v);
      };
      // Заполняем основные данные (очищаем ID, штрих-код и количество для нового товара)
      setNewItemData({
        name: product.name || "",
        barcode: "", // Очищаем штрих-код для нового товара
        brand_name: product.brand_name || "",
        category_name: product.category_name || "",
        price: formatPrice3DecimalsDup(product.price),
        quantity: "", // Очищаем количество для нового товара
        client: product.client || "",
        purchase_price: formatPrice3DecimalsDup(product.purchase_price),
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

      // Загружаем изображения (копируем ссылки, но не файлы); для нового товара не храним id для удаления
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
      setInitialProductImageIds([]);

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

  // Ограничение цены: максимум 3 знака после запятой
  const sanitizePriceTo3Decimals = (val) => {
    const s = String(val ?? "").replace(",", ".");
    const cleaned = s.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return parts[0] + "." + parts.slice(1).join("").slice(0, 3);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue =
      type === "number" ? (value === "" ? "" : parseInt(value)) : value;
    if (name === "price" || name === "purchase_price") {
      finalValue = sanitizePriceTo3Decimals(value);
    }
    setNewItemData((prevData) => ({
      ...prevData,
      [name]: finalValue,
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
      brand_name,
      category_name,
      price,
      quantity,
      client,
      purchase_price,
    } = newItemData;

    // Сбрасываем предыдущие ошибки
    setFieldErrors({});

    // Валидация товара
    const productErrors = utils.validateProductData({
      newItemData,
      marketData,
      itemType,
    });

    if (Object.keys(productErrors).length > 0) {
      setFieldErrors(productErrors);
      showAlert("Пожалуйста, заполните обязательные поля.");
      return;
    }

    // Валидация для долговых операций
    if (debt && !client) {
      showAlert("Выберите поставщика для долговой операции");
      return;
    }

    const debtErrors = utils.validateDebtData(
      {
        debt,
        debtMonths,
        amount,
        purchasePrice: purchase_price,
        quantity,
        debtState,
      },
      company
    );

    if (Object.keys(debtErrors).length > 0) {
      const firstError = Object.values(debtErrors)[0];
      showAlert(firstError);
      return;
    }

    // Формируем payload используя утилиту (убрано ~150 строк дублирующего кода)
    const payload = utils.buildProductPayload({
      newItemData,
      marketData,
      itemType,
      weightProductsCount,
    });

    try {
      let product;
      if (isEditMode && productId) {
        // Режим редактирования
        product = await dispatch(
          updateProductAsync({
            productId,
            updatedData: payload,
          })
        ).unwrap();
      } else {
        // Режим создания
        product = await dispatch(createProductAsync(payload)).unwrap();
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
        if (targetProductId) {
          // В режиме редактирования: удаляем с сервера изображения, которые пользователь убрал из списка
          if (isEditMode && initialProductImageIds.length > 0) {
            const currentIds = images.filter((im) => im.id).map((im) => im.id);
            const removedIds = initialProductImageIds.filter(
              (id) => !currentIds.includes(id)
            );
            if (removedIds.length > 0) {
              await Promise.allSettled(
                removedIds.map((imageId) =>
                  api.delete(
                    `/main/products/${targetProductId}/images/${imageId}/`
                  )
                )
              );
            }
          }
          // Загружаем только новые изображения (с файлами)
          if (images.length > 0) {
            const newImages = images.filter((im) => im.file);
            if (newImages.length > 0) {
              const uploads = newImages.map(async (im) => {
                const fd = new FormData();
                fd.append("image", im.file);
                if (im.alt) fd.append("alt", im.alt || name);
                fd.append("is_primary", String(Boolean(im.is_primary)));
                return api.post(
                  `/main/products/${targetProductId}/images/`,
                  fd,
                  {
                    headers: { "Content-Type": "multipart/form-data" },
                  }
                );
              });
              if (uploads.length) await Promise.allSettled(uploads);
            }
          }
        }
      } catch (e) {
        console.warn("Загрузка изображений не удалась:", e);
        // не блокируем основной флоу
      }

      // Создание долга, если выбран
      if (debt === "Долги" && client) {
        if (company?.subscription_plan?.name === "Старт") {
          await utils.createDebt({
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

      // Добавление денежного потока при создании товара
      // Создаем запрос на кассу только если не долг и не режим редактирования
      if (!isEditMode && debt !== "Долги") {
        // Сумма в кассу: количество × закупочная цена за единицу (для Предоплаты — переданная сумма)
        const purchaseUnitPrice =
          purchase_price || newItemData.purchase_price || "0";
        const amountForCash =
          debt === "Предоплата"
            ? Number(amount || "0")
            : qty * Number(purchaseUnitPrice);
        // Используем selectCashBox если cashData.cashbox пустой
        const cashboxId = cashData.cashbox || selectCashBox;

        // Создаем денежный поток если есть касса и сумма больше 0
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
            // Не блокируем создание товара, если ошибка с кассой
          }
        } else {
          console.log("CashFlow не создан:", {
            cashboxId,
            amountForCash,
            hasCashbox: !!cashboxId,
            amountGreaterThanZero: Number(amountForCash) > 0,
          });
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
        navigate("/crm/sklad");
      }, 1500);
    } catch (err) {
      console.error("Failed to create product:", err);
      showAlert(
        `Ошибка при добавлении товара: ${err.message || JSON.stringify(err)}`,
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
        createBrandAsync({ name: newBrand.name.trim() })
      ).unwrap();
      dispatch(fetchBrandsAsync());
      setShowBrandInputs(false);
      // Автоматически выбираем созданный бренд
      setNewItemData((prev) => ({
        ...prev,
        brand_name: brand.name || newBrand.name.trim(),
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
        createCategoryAsync({ name: newCategory.name.trim() })
      ).unwrap();
      dispatch(fetchCategoriesAsync());
      setShowCategoryInputs(false);
      // Автоматически выбираем созданную категорию
      setNewItemData((prev) => ({
        ...prev,
        category_name: category.name || newCategory.name.trim(),
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

  // Используем утилиту для вычисления контрольной суммы
  const calculateEAN13Checksum = utils.calculateEAN13Checksum;

  // Генерируем EAN-13 штрих-код автоматически при загрузке (только для создания)
  useEffect(() => {
    if (!isEditMode && !newItemData.barcode) {
      const barcode = utils.generateEAN13Barcode();
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

  // Генерация EAN-13 штрих-кода для маркета
  const generateBarcode = () => {
    const barcode = utils.generateEAN13Barcode();
    setNewItemData((prev) => ({ ...prev, barcode }));
  };

  // Используем функции и переменные из хука useKitProducts
  const handleKitSearch = handleKitSearchFromHook;
  const addProductToKit = addProductToKitFromHook;
  const removeProductFromKit = removeProductFromKitFromHook;
  const handleUpdateKitProductQuantity = updateKitProductQuantityFromHook;
  const recalculateKitPrice = recalculateKitPriceFromHook;
  const kitSearchResults = kitSearchResultsFromHook;
  const showKitSearch = showKitSearchFromHook;
  const setShowKitSearch = setShowKitSearchFromHook;

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
            onClick={() => navigate("/crm/sklad")}
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
                onClose={() => navigate("/crm/sklad")}
                onShowSuccessAlert={(productName) => {
                  showAlert(
                    `Товар "${productName}" успешно добавлен!`,
                    "success",
                    "Успех"
                  );
                  setTimeout(() => {
                    navigate("/crm/sklad");
                  }, 1500);
                }}
                onShowErrorAlert={(errorMsg) => {
                  showAlert(errorMsg, "error", "Ошибка");
                }}
                onShowSupplierCreated={(message) => {
                  showAlert(message, "success", "Успех");
                }}
                selectCashBox={selectCashBox}
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
              addImages={addImages}
              removeImage={removeImage}
              setPrimaryImage={setPrimaryImage}
              isEditMode={isEditMode}
              fieldErrors={fieldErrors}
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
                            name="brand_name"
                            className="add-product-page__input"
                            value={newItemData.brand_name}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Выберите бренд</option>
                            {brands.map((brand, idx) => (
                              <option key={brand.id ?? idx} value={brand.name}>
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
                            name="category_name"
                            className="add-product-page__input"
                            value={newItemData.category_name}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Выберите категорию</option>
                            {categories.map((category, idx) => (
                              <option
                                key={category.id ?? idx}
                                value={category.name}
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
                        placeholder="0.000"
                        inputMode="decimal"
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
                        placeholder="0.000"
                        inputMode="decimal"
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
                    onClick={() => navigate("/crm/sklad")}
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
  addImages,
  removeImage,
  setPrimaryImage,
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
  company,
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

  // Сброс флага только при явном редактировании полей (не при программном обновлении наценки из handlePriceChange)
  const handlePurchasePriceChange = (e) => {
    if (itemType === "product") setIsPriceManuallyChanged(false);
    handleChange(e);
  };
  const handleMarkupFieldChange = (e) => {
    setIsMarkupManuallyChanged(true);
    if (itemType === "product") setIsPriceManuallyChanged(false);
    handleMarketDataChange("markup", e.target.value);
  };

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
      {/* Выбор типа: Товар, Услуга, Комплект */}
      <ProductTypeSelector
        itemType={itemType}
        setItemType={setItemType}
        isEditMode={isEditMode}
      />

      {/* Основная информация */}
      <ProductBasicInfo
        newItemData={newItemData}
        handleChange={handleChange}
        marketData={marketData}
        handleMarketDataChange={handleMarketDataChange}
        generateBarcode={generateBarcode}
        fieldErrors={fieldErrors}
        itemType={itemType}
      />

      {/* Изображение */}
      <ProductImagesSection
        images={images}
        fileInputRef={fileInputRef}
        onImageAdd={addImages}
        onImageRemove={removeImage}
        onSetPrimary={setPrimaryImage}
      />

      {/* Категория и Бренд */}
      <div className="market-product-form__section">
        <div className="market-product-form__two-columns">
          <div className="market-product-form__form-group">
            <label className="market-product-form__label">Категория</label>
            <div className="add-product-page__supplier-row">
              <select
                name="category_name"
                className="market-product-form__input"
                value={newItemData.category_name}
                onChange={handleChange}
                required
              >
                <option value="">Выберите категорию</option>
                {categories.map((category, idx) => (
                  <option key={category.id ?? idx} value={category.name}>
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
                name="brand_name"
                className="market-product-form__input"
                value={newItemData.brand_name}
                onChange={handleChange}
                required
              >
                <option value="">Выберите бренд</option>
                {brands.map((brand, idx) => (
                  <option key={brand.id ?? idx} value={brand.name}>
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
                    onChange={handlePurchasePriceChange}
                    placeholder="0.000"
                    inputMode="decimal"
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
                    onChange={handleMarkupFieldChange}
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
                    placeholder="0.000 или рассчитывается автоматически"
                    inputMode="decimal"
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
                    placeholder="0.000"
                    inputMode="decimal"
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
                    placeholder="0.000"
                    inputMode="decimal"
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

export default AddProductPage;
