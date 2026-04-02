import {
  ArrowLeft,
  Menu,
  Minus,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import useScanDetection from "use-scan-detection";
import { useDebounce } from "../../../../hooks/useDebounce";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import {
  addCustomItem,
  deleteProductInCart,
  getSale,
  manualFilling,
  sendBarCode,
  startSale,
  updateManualFilling,
  updateProductInCart,
} from "../../../../store/creators/saleThunk";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { fetchShiftsAsync } from "../../../../store/creators/shiftThunk";
import { getCashBoxes, useCash } from "../../../../store/slices/cashSlice";
import api from "../../../../api";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useProducts } from "../../../../store/slices/productSlice";
import { resetPosSale, useSale } from "../../../../store/slices/saleSlice";
import { useShifts } from "../../../../store/slices/shiftSlice";
import { useUser } from "../../../../store/slices/userSlice";
import AlertModal from "../../../common/AlertModal/AlertModal";
import CustomServiceModal from "../../../pages/Sell/components/CustomServiceModal";
import DiscountModal from "../../../pages/Sell/components/DiscountModal";
import "./CashierPage.scss";
import CloseShiftPage from "./CloseShiftPage";
import CustomerModal from "./components/CustomerModal";
import DebtPaymentModal from "./components/DebtPaymentModal";
import MenuModal from "./components/MenuModal";
import ReceiptsModal from "./components/ReceiptsModal";
import OpenShiftPage from "./OpenShiftPage";
import PaymentPage from "./PaymentPage";
import ShiftPage from "./ShiftPage";
import { Button } from "@mui/material";
import sleep from "../../../../../tools/sleep";
import { useAlert } from "../../../../hooks/useDialog";

const CashierPage = () => {
  const alert = useAlert();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    list: products,
    count,
    next,
    previous,
    loading: productsLoading,
  } = useProducts();
  const { list: clients } = useClient();
  const { start: currentSale, loading: saleLoading } = useSale();
  const { shifts } = useShifts();
  const { list: cashBoxes } = useCash();
  const { currentUser, userId } = useUser();
  const [openShiftState, setOpenShiftState] = useState(null); // Локальное состояние для открытой смены

  // Функция для форматирования количества (убирает лишние нули)
  const formatQuantity = (qty) => {
    if (qty === null || qty === undefined || qty === "") return "0";
    const num = parseFloat(qty);
    if (isNaN(num)) return "0";
    // Если целое число, возвращаем без десятичной части
    if (num % 1 === 0) return String(num);
    // Иначе убираем лишние нули в конце
    return String(num).replace(/\.?0+$/, "");
  };

  // Функция для нормализации количества перед отправкой на сервер
  const normalizeQuantity = (qty) => {
    if (qty === null || qty === undefined || qty === "") return 0;
    const num = parseFloat(qty);
    if (isNaN(num)) return 0;
    // Округляем до 4 знаков после запятой, чтобы убрать ошибки округления
    const rounded = Math.round(num * 10000) / 10000;
    // Если результат целое число, возвращаем целое
    if (rounded % 1 === 0) return Math.floor(rounded);
    return rounded;
  };

  // Функция для нормализации цены перед отправкой на сервер
  const normalizePrice = (price) => {
    if (price === null || price === undefined || price === "") return 0;
    const num = parseFloat(price);
    if (isNaN(num)) return 0;
    // Округляем до 2 знаков после запятой для цены
    const rounded = Math.round(num * 100) / 100;
    // Если результат целое число, возвращаем целое
    if (rounded % 1 === 0) return Math.floor(rounded);
    return rounded;
  };

  // Функция для форматирования цены для отображения (убирает лишние нули)
  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") return "0";
    const num = parseFloat(price);
    if (isNaN(num)) return "0";
    // Если целое число, возвращаем без десятичной части
    if (num % 1 === 0) return String(num);
    // Иначе убираем лишние нули в конце
    return String(num).replace(/\.?0+$/, "");
  };

  const getDefaultPiecePackage = (product) => {
    const packages = Array.isArray(product?.packages) ? product.packages : [];
    return packages.find((pkg) => Number(pkg?.quantity_in_package) > 0) || null;
  };

  /**
   * Считает суммарное потребление пачек для товара по всем строкам корзины.
   * items — currentSale.items
   * productId — ID товара
   * productsList — список товаров (для поиска packages)
   */
  const calcTotalConsumeForProduct = (items, productId, productsList) => {
    const product = productsList.find((p) => p.id === productId);
    return items
      .filter((item) => (item.product || item.product_id) === productId)
      .reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        if (item.sale_package) {
          const pkg = product?.packages?.find((p) => p.id === item.sale_package);
          const qip = Number(pkg?.quantity_in_package);
          return sum + (qip > 0 ? qty / qip : 0);
        }
        return sum + qty;
      }, 0);
  };

  // Функция для поиска открытой смены на всех страницах
  const findOpenShift = useCallback(async () => {
    try {
      // Пробуем загрузить с фильтром по статусу (если API поддерживает)
      try {
        const response = await api.get("/construction/shifts/", {
          params: { status: "open" },
        });
        const openShiftFromApi = response.data?.results?.[0];
        if (openShiftFromApi && openShiftFromApi.status === "open") {
          setOpenShiftState(openShiftFromApi);
          return openShiftFromApi;
        }
        // Если фильтр поддерживается и открытой смены нет — прекращаем поиск.
        // Иначе будет лишнее сканирование страниц (много повторных запросов).
        setOpenShiftState(null);
        return null;
      } catch (e) {
        // Если фильтр не поддерживается, продолжаем поиск по страницам
        console.log("Filter by status not supported, searching all pages");
      }

      // Если не нашли, ищем по всем страницам
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        const response = await api.get("/construction/shifts/", {
          params: { page },
        });
        const data = response.data;
        const results = data?.results || [];

        const openShift = results.find((s) => s.status === "open");
        if (openShift) {
          setOpenShiftState(openShift);
          return openShift;
        }

        hasNext = !!data?.next;
        page++;

        // Защита от бесконечного цикла (максимум 10 страниц)
        if (page > 10) break;
      }

      setOpenShiftState(null);
      return null;
    } catch (error) {
      console.error("Ошибка при поиске открытой смены:", error);
      setOpenShiftState(null);
      return null;
    }
  }, []);

  // Получаем текущую открытую смену (мемоизируем, чтобы избежать лишних пересчетов)
  // Используем локальное состояние, если оно есть, иначе ищем в загруженных сменах
  const openShift = React.useMemo(() => {
    if (openShiftState) return openShiftState;
    return shifts.find((s) => s.status === "open");
  }, [shifts, openShiftState]);
  const openShiftId = openShift?.id;
  const openShiftStatus = openShift?.status;

  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(pageFromUrl || 1);
  const debounceTimerRef = React.useRef(null);
  const [cart, setCart] = useState([]);
  const cartOrderRef = React.useRef([]); // Сохраняем порядок элементов корзины
  const [cartQuantities, setCartQuantities] = useState({}); // Локальные значения количества для каждого товара
  const [cartPrices, setCartPrices] = useState({}); // Локальные значения цены за единицу (unit_price)
  const [cartDiscounts, setCartDiscounts] = useState({}); // Локальные значения скидки на позицию (discount_total)
  const [cartDiscountModes, setCartDiscountModes] = useState({}); // Режим скидки по позиции: "amount" (сом) или "percent"
  const lastSearchInputTime = React.useRef(0); // Время последнего ввода в поле поиска (для защиты от открытия страницы оплаты при сканировании)
  const searchInputRef = React.useRef(null); // Ref для поля поиска
  const lastScanTimeRef = React.useRef(0); // Время последнего сканирования (как в SellMainStart.jsx)
  const isScanningRef = React.useRef(false); // Флаг, указывающий что идет или недавно было сканирование
  const lastScannedBarcodeRef = React.useRef(""); // Последний отсканированный штрих-код
  const searchClearedAfterScanRef = React.useRef(false); // Флаг, что поле поиска было очищено после сканирования
  const scanKeysRef = React.useRef({ count: 0, lastTime: 0 }); // Отслеживание быстрого набора символов для детекции сканера
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [showShiftPage, setShowShiftPage] = useState(false);
  const [showOpenShiftPage, setShowOpenShiftPage] = useState(false);
  const [showCloseShiftPage, setShowCloseShiftPage] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [discountMode, setDiscountMode] = useState("amount"); // "amount" | "percent"
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  const [mobileProductsList, setMobileProductsList] = useState(false);
  // Функция для показа AlertModal
  const showAlert = (type, title, message) => {
    setAlertModal({
      open: true,
      type,
      title,
      message,
    });
  };

  const closeAlert = () => {
    setAlertModal((prev) => ({ ...prev, open: false }));
  };

  const handleProductCardClick = async (product, event) => {
    const timeSinceLastScan = Date.now() - lastScanTimeRef.current;

    // Некоторые сканеры отправляют завершающий Enter/клик, из-за чего
    // товар под курсором может случайно добавиться в корзину.
    // Игнорируем такие клики во время сканирования и сразу после него.
    if (
      barcodeProcessingRef.current ||
      isScanningRef.current ||
      timeSinceLastScan < 700
    ) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }

    await addToCart(product);
  };

  // Функция для обновления продажи после запросов
  const refreshSale = useCallback(async () => {
    // Не обновляем продажу, если нет открытой смены
    if (currentSale?.id && openShiftId) {
      try {
        const currentDiscount = normalizePrice(
          currentSale?.order_discount_total || 0,
        );
        await dispatch(
          startSale({
            discount_total: currentDiscount,
            shift: openShiftId,
          }),
        ).unwrap();
      } catch (error) {
        console.error("Ошибка при обновлении продажи:", error);
      }
    }
  }, [openShiftId, currentSale]);

  const debouncedDiscount = useDebounce((payload) => {
    if (!currentSale?.id || !openShiftId) return;
    dispatch(
      startSale({
        ...payload,
        shift: openShiftId,
      }),
    );
  }, 600);

  const handleDiscountChange = (discount, mode = "amount") => {
    const num = parseFloat(discount) || 0;

    if (mode === "percent") {
      // В процентах отправляем order_discount_percent
      debouncedDiscount({
        order_discount_percent: num,
      });
    } else {
      // В сомах отправляем order_discount_total
      debouncedDiscount({
        order_discount_total: normalizePrice(num),
      });
    }
  };

  // Функция для добавления доп. услуги
  const handleAddCustomService = async () => {
    try {
      if (!customService.name.trim()) {
        showAlert("error", "Ошибка", "Введите название услуги");
        return;
      }
      if (!customService.price.trim() || Number(customService.price) <= 0) {
        showAlert("error", "Ошибка", "Введите корректную цену услуги");
        return;
      }
      if (!currentSale?.id) {
        showAlert(
          "error",
          "Ошибка",
          "Корзина не инициализирована. Пожалуйста, подождите...",
        );
        return;
      }
      await dispatch(
        addCustomItem({
          id: currentSale.id,
          name: customService.name.trim(),
          price: normalizePrice(customService.price.trim()),
          quantity: normalizeQuantity(Number(customService.quantity) || 1),
        }),
      ).unwrap();
      await refreshSale();
      setCustomService({ name: "", price: "", quantity: "1" });
      setShowCustomServiceModal(false);
      showAlert("success", "Успех", "Дополнительная услуга успешно добавлена!");
    } catch (error) {
      console.error("Ошибка при добавлении дополнительной услуги:", error);
      showAlert(
        "error",
        "Ошибка",
        error?.data?.detail ||
          error?.message ||
          "Ошибка при добавлении дополнительной услуги",
      );
    }
  };

  // Автодобавление товара по сканеру штрих-кода
  // Отслеживаем сканирование напрямую для автоматического создания продажи
  const [scannedBarcode, setScannedBarcode] = useState("");
  const barcodeProcessingRef = React.useRef(false);

  useScanDetection({
    minLength: 3,
    onComplete: async (barcode) => {
      if (!barcode || barcode.length < 3) return;
      if (barcodeProcessingRef.current) return;

      // ВАЖНО: во время под-экранов (закрытие/открытие смены, оплата и т.д.)
      // не обрабатываем "сканирование", иначе быстрый ввод цифр (например сумма)
      // может быть принят за штрих-код и показать "Нет открытой смены".
      if (
        showCloseShiftPage ||
        showOpenShiftPage ||
        showPaymentPage ||
        showShiftPage ||
        showMenuModal ||
        showCustomerModal ||
        showDebtModal ||
        showReceiptsModal ||
        showCustomServiceModal ||
        showDiscountModal
      ) {
        return;
      }

      // Валидация штрих-кода: проверяем, что он не содержит служебные символы
      // Сканер не должен отправлять Backspace, Delete и другие служебные клавиши
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

      // Проверяем наличие служебных символов в штрих-коде
      const hasInvalidPattern = invalidPatterns.some((pattern) =>
        barcode.includes(pattern),
      );

      // Проверяем, что штрих-код содержит только допустимые символы
      // Допустимые: буквы (латиница, кириллица), цифры, дефисы, подчеркивания, точки
      const isValidFormat = /^[a-zA-Zа-яА-ЯёЁ0-9\-_.]+$/.test(barcode);

      if (hasInvalidPattern || !isValidFormat) {
        // Это не валидный штрих-код, игнорируем
        console.warn(
          "Некорректный штрих-код (содержит служебные символы):",
          barcode,
        );
        return;
      }

      // Запоминаем время сканирования и устанавливаем флаги
      const scanTime = Date.now();
      lastScanTimeRef.current = scanTime;
      isScanningRef.current = true;
      lastScannedBarcodeRef.current = barcode;
      setScannedBarcode(barcode);

      // Проверяем наличие открытой смены
      if (!openShiftId) {
        showAlert(
          "warning",
          "Нет открытой смены",
          "Для работы с кассой необходимо начать смену",
        );
        isScanningRef.current = false;
        return;
      }

      barcodeProcessingRef.current = true;

      try {
        let saleId = currentSale?.id;

        // Если нет продажи, создаем её
        if (!saleId) {
          const result = await dispatch(
            startSale({
              discount_total: 0,
              shift: openShiftId,
            }),
          ).unwrap();
          saleId = result?.id;
        }

        if (!saleId) {
          showAlert("error", "Ошибка", "Не удалось создать продажу");
          barcodeProcessingRef.current = false;
          return;
        }

        // Проверяем наличие товара ПЕРЕД добавлением в корзину
        // Ищем товар в списке продуктов по штрих-коду
        const scannedProduct = products.find(
          (p) => p.barcode === barcode || p.barcode?.toString() === barcode,
        );

        if (scannedProduct) {
          const availableQuantity = parseFloat(scannedProduct.quantity || 0);
          const isInStock = availableQuantity > 0;

          if (!isInStock) {
            showAlert(
              "warning",
              "Товар отсутствует",
              "Товар отсутствует в наличии",
            );
            barcodeProcessingRef.current = false;
            setScannedBarcode("");
            return;
          }
        }

        // Добавляем товар по штрих-коду
        const res = await dispatch(
          sendBarCode({ barcode, id: saleId }),
        ).unwrap();

        if (res?.error) {
          const msg =
            typeof res.error === "string"
              ? res.error
              : "Товар с таким штрих-кодом не найден";
          showAlert("error", "Ошибка сканирования", msg);
        } else {
          // Обновляем продажу после добавления товара
          await dispatch(
            startSale({ discount_total: 0, shift: openShiftId }),
          ).unwrap();
          // Обновляем время последнего сканирования после успешного добавления
          // Это защитит от открытия страницы оплаты при Enter от сканера
          lastScanTimeRef.current = Date.now();
          // Убеждаемся, что флаг сканирования установлен
          isScanningRef.current = true;
        }
      } catch (error) {
        console.error("Ошибка при сканировании:", error);
        showAlert(
          "error",
          "Ошибка сканирования",
          error?.message || "Не удалось добавить товар по штрих-коду",
        );
      } finally {
        barcodeProcessingRef.current = false;
        setScannedBarcode("");
        // Обновляем время последнего сканирования в любом случае
        // для защиты от открытия страницы оплаты
        lastScanTimeRef.current = Date.now();
        // Помечаем, что поле поиска было очищено после сканирования
        searchClearedAfterScanRef.current = true;
        // Убеждаемся, что флаг сканирования установлен (на случай, если он был сброшен)
        isScanningRef.current = true;

        // Сбрасываем флаг сканирования с задержкой, чтобы Enter от сканера успел обработаться
        // Задержка 3 секунды гарантирует, что Enter от сканера будет обработан даже при медленном соединении
        setTimeout(() => {
          isScanningRef.current = false;
          searchClearedAfterScanRef.current = false;
        }, 3000);
      }
    },
  });

  // Обновление URL только при изменении страницы (без поиска)
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    }
    const newSearchString = params.toString();
    const currentSearchString = searchParams.toString();
    // Обновляем URL только если параметры действительно изменились
    if (newSearchString !== currentSearchString) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  // Загрузка товаров с пагинацией и поиском
  useEffect(() => {
    const params = {
      page: currentPage,
    };
    if (debouncedSearchTerm && typeof debouncedSearchTerm === "string") {
      const trimmed = debouncedSearchTerm.trim();
      if (trimmed) {
        params.search = trimmed;
      }
    }
    dispatch(fetchProductsAsync(params));
  }, [dispatch, debouncedSearchTerm, currentPage]);

  // При изменении поиска возвращаемся на первую страницу
  useEffect(() => {
    if (debouncedSearchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  // Инициализация данных при первой загрузке
  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(fetchShiftsAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Поиск открытой смены при загрузке и обновлении списка смен
  useEffect(() => {
    // Проверяем, есть ли открытая смена в загруженных сменах
    const foundInLoaded = shifts.find((s) => s.status === "open");

    if (foundInLoaded) {
      // Если нашли в загруженных, обновляем состояние
      setOpenShiftState(foundInLoaded);
    } else if (!openShiftState) {
      // Если в загруженных нет и локального состояния тоже нет, ищем на всех страницах
      findOpenShift();
    } else {
      // Если есть локальное состояние, проверяем его актуальность
      // Проверяем, не была ли смена закрыта (если она есть в загруженных, но статус изменился)
      const shiftInLoaded = shifts.find((s) => s.id === openShiftState.id);
      if (shiftInLoaded && shiftInLoaded.status !== "open") {
        // Смена была закрыта, сбрасываем состояние
        setOpenShiftState(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts]);

  // Закрываем экран открытия смены, если смена открыта или пользователь на странице смены
  useEffect(() => {
    if (showShiftPage || openShift) {
      setShowOpenShiftPage(false);
    }
  }, [shifts, openShift, showShiftPage]);

  // Продажа создается только при добавлении товара в корзину, а не автоматически при загрузке страницы

  // Синхронизируем локальную корзину с данными из API, сохраняя порядок
  useEffect(() => {
    if (currentSale) {
      // startSale возвращает объект с полем items напрямую, а не cart.items
      const items = currentSale.items || currentSale.cart?.items || [];

      if (items.length > 0) {
        // MARKET_POS_CART: unit_price — базовая цена, line_discount — скидка на строку (сумма).
        // line_total = (unit_price × quantity) - line_discount
        const apiCart = items.map((item) => {
          const qty = normalizeQuantity(parseFloat(item.quantity || 0));
          const price = normalizePrice(
            parseFloat(item.unit_price || item.price || 0),
          );
          const discountTotal = normalizePrice(
            parseFloat(item.line_discount || item.discount_total || 0),
          );
          const productId = item.product || item.product_id;
          const cartItemId = item.id;
          const isCustom = !productId;
          const salePackage = item.sale_package || null;
          // Для обычных товаров ключ строим по itemId, чтобы не конфликтовали
          // строки одного и того же товара с разными sale_package.
          const localId = isCustom
            ? `custom-${cartItemId}`
            : `item-${cartItemId}`;
          return {
            id: localId, // ключ в UI (productId или custom-<cartItemId>)
            itemId: cartItemId, // ID элемента в корзине (для API: DELETE/PATCH /items/<itemId>/)
            productId: productId ?? null, // ID товара (если это товар)
            isCustom: isCustom,
            salePackage,
            name: item.product_name || item.display_name || item.name || "—",
            price: price,
            quantity: qty,
            discountTotal,
            unit: item.unit || "шт",
            image:
              item.primary_image_url ||
              (item.images && item.images[0]?.image_url) ||
              null,
          };
        });

        // Сохраняем порядок элементов: используем сохраненный порядок
        // Убираем дубликаты по itemId (уникальный ID элемента в корзине)
        const seenItemIds = new Set();
        const uniqueApiCart = apiCart.filter((item) => {
          if (item.itemId && seenItemIds.has(item.itemId)) {
            return false; // Пропускаем дубликаты по itemId
          }
          if (item.itemId) {
            seenItemIds.add(item.itemId);
          }
          return true;
        });

        const orderedCart = [];
        const processedProductIds = new Set();

        // Если у нас есть сохраненный порядок, используем его
        if (cartOrderRef.current.length > 0) {
          // Сначала добавляем элементы в сохраненном порядке
          cartOrderRef.current.forEach((savedProductId) => {
            const item = uniqueApiCart.find(
              (cartItem) => cartItem.id === savedProductId,
            );
            if (item && !processedProductIds.has(item.id)) {
              orderedCart.push(item);
              processedProductIds.add(item.id);
            }
          });
        }

        // Затем добавляем новые элементы, которых нет в сохраненном порядке
        uniqueApiCart.forEach((item) => {
          if (!processedProductIds.has(item.id)) {
            orderedCart.push(item);
            processedProductIds.add(item.id);
          }
        });

        // Обновляем сохраненный порядок
        cartOrderRef.current = orderedCart.map((item) => item.id);

        // Обновляем локальные значения количества, цены и скидки
        const newQuantities = {};
        const newPrices = {};
        orderedCart.forEach((item) => {
          newQuantities[item.id] = formatQuantity(item.quantity || 0);
          newPrices[item.id] = formatPrice(item.price ?? 0);
        });
        setCartQuantities((prev) => ({ ...prev, ...newQuantities }));
        setCartPrices((prev) => ({ ...prev, ...newPrices }));
        // Скидки по строкам: не перезатираем то, что уже ввёл продавец.
        setCartDiscounts((prev) => {
          const next = { ...prev };
          orderedCart.forEach((item) => {
            if (next[item.id] === undefined) {
              next[item.id] = formatPrice(item.discountTotal ?? 0);
            }
          });
          return next;
        });

        // Режим скидки по умолчанию — в сомах
        setCartDiscountModes((prev) => {
          const next = { ...prev };
          orderedCart.forEach((item) => {
            if (!next[item.id]) {
              next[item.id] = "amount";
            }
          });
          return next;
        });

        setCart(orderedCart);
      } else {
        // Если корзина пуста
        setCart([]);
        cartOrderRef.current = [];
      }
    }
  }, [currentSale]);

  const updateCustomQuantityByDelta = async (cartItem, delta) => {
    if (!currentSale?.id) return;
    if (!cartItem?.itemId) return;

    try {
      const currentQty = normalizeQuantity(cartItem.quantity);
      const newQuantity = normalizeQuantity(Math.max(0, currentQty + delta));

      if (newQuantity === 0) {
        await dispatch(
          deleteProductInCart({
            id: currentSale.id,
            productId: cartItem.itemId,
          }),
        );
        cartOrderRef.current = cartOrderRef.current.filter(
          (id) => id !== cartItem.id,
        );
        setCartQuantities((prev) => {
          const q = { ...prev };
          delete q[cartItem.id];
          return q;
        });
        setCartPrices((prev) => {
          const next = { ...prev };
          delete next[cartItem.id];
          return next;
        });
        setCartDiscounts((prev) => {
          const next = { ...prev };
          delete next[cartItem.id];
          return next;
        });
      } else {
        await dispatch(
          updateManualFilling({
            id: currentSale.id,
            productId: cartItem.itemId,
            quantity: newQuantity,
          }),
        );
        setCartQuantities((prev) => ({
          ...prev,
          [cartItem.id]: String(newQuantity),
        }));
      }
    } catch (error) {
      console.error("Ошибка при обновлении количества доп. услуги:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при обновлении количества: " +
          (error.message || "Неизвестная ошибка"),
      );
    }
  };

  const updateCustomQuantityDirect = async (cartItem, newQuantity) => {
    if (!currentSale?.id) return;
    if (!cartItem?.itemId) return;

    try {
      const qtyNum = normalizeQuantity(
        Math.max(0, parseFloat(newQuantity) || 0),
      );

      if (qtyNum === 0) {
        await removeCustomFromCart(cartItem);
        return;
      }

      await dispatch(
        updateManualFilling({
          id: currentSale.id,
          productId: cartItem.itemId,
          quantity: qtyNum,
        }),
      );
      setCartQuantities((prev) => ({
        ...prev,
        [cartItem.id]: String(qtyNum),
      }));
      await refreshSale();
    } catch (error) {
      console.error("Ошибка при обновлении количества доп. услуги:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при обновлении количества: " +
          (error.message || "Неизвестная ошибка"),
      );
    }
  };

  const removeCustomFromCart = async (cartItem) => {
    if (!currentSale?.id) return;
    if (!cartItem?.itemId) return;

    try {
      await dispatch(
        deleteProductInCart({
          id: currentSale.id,
          productId: cartItem.itemId,
        }),
      );
      cartOrderRef.current = cartOrderRef.current.filter(
        (id) => id !== cartItem.id,
      );
      setCartPrices((prev) => {
        const next = { ...prev };
        delete next[cartItem.id];
        return next;
      });
      setCartDiscounts((prev) => {
        const next = { ...prev };
        delete next[cartItem.id];
        return next;
      });
      setCartQuantities((prev) => {
        const q = { ...prev };
        delete q[cartItem.id];
        return q;
      });
    } catch (error) {
      console.error("Ошибка при удалении доп. услуги:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при удалении: " + (error.message || "Неизвестная ошибка"),
      );
    }
  };

  // Расчет пагинации
  // Используем фиксированный размер страницы
  // Если есть next или previous, значит есть еще страницы
  const PAGE_SIZE = 100; // Размер страницы для API
  const hasNextPage = !!next;
  const hasPrevPage = !!previous;

  // Если есть следующая страница, значит текущая не последняя
  // Если есть предыдущая страница, значит текущая не первая
  // Рассчитываем общее количество страниц на основе count и размера страницы
  const totalPages = count && PAGE_SIZE ? Math.ceil(count / PAGE_SIZE) : 1;

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    setCurrentPage(newPage);
  };

  // Объявляем handleCheckout до его использования в useEffect
  const handleCheckout = useCallback(() => {
    if (cart.length === 0 || !currentSale?.id) return;
    setShowPaymentPage(true);
  }, [cart.length, currentSale?.id]);

  // Обновляем время последнего ввода в поле поиска при каждом изменении (для защиты от открытия страницы оплаты при сканировании)
  // Это делается в onChange поля поиска, но оставляем useEffect как дополнительную защиту
  useEffect(() => {
    if (searchTerm) {
      lastSearchInputTime.current = Date.now();
    }
  }, [searchTerm]);

  // Глобальный обработчик Enter для открытия страницы оплаты (с защитой от сканера)
  useEffect(() => {
    const handleGlobalEnter = (e) => {
      const now = Date.now();
      const target = e.target;

      // Проверяем, что фокус находится в поле поиска
      const isSearchInputFocused =
        target === searchInputRef.current ||
        target?.className?.includes("cashier-page__search-input");

      // Детекция сканера по скорости набора символов
      // Сканер работает ТОЛЬКО в поле поиска, поэтому учитываем это
      const isChar = e.key.length === 1 && /^[0-9A-Za-z]$/.test(e.key);

      if (isChar && isSearchInputFocused) {
        // Сканер: символы вводятся в поле поиска очень быстро
        const dt = now - scanKeysRef.current.lastTime;
        scanKeysRef.current.count = dt < 50 ? scanKeysRef.current.count + 1 : 1;
        scanKeysRef.current.lastTime = now;

        if (scanKeysRef.current.count >= 6) {
          isScanningRef.current = true;
          lastScanTimeRef.current = now;
        }
      } else if (isChar && !isSearchInputFocused) {
        // Ручной ввод вне поля поиска - сбрасываем счетчик
        scanKeysRef.current.count = 0;
      } else if (!isChar && !isSearchInputFocused) {
        // Любой другой символ вне поля поиска - сбрасываем счетчик
        scanKeysRef.current.count = 0;
      }

      // Enter сразу после быстрой последовательности В ПОЛЕ ПОИСКА — это почти наверняка Enter сканера
      if (
        e.key === "Enter" &&
        scanKeysRef.current.count >= 6 &&
        isSearchInputFocused
      ) {
        lastScanTimeRef.current = now;
        isScanningRef.current = true;
        scanKeysRef.current.count = 0;

        setTimeout(() => {
          isScanningRef.current = false;
        }, 3000);

        return; // НЕ открываем оплату
      }

      // Пропускаем, если нажатие было в поле ввода или textarea
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Если это поле поиска, не обрабатываем здесь (обрабатывается в onKeyDown)
        if (target.className?.includes("cashier-page__search-input")) {
          return;
        }
        // Если это поле количества, не обрабатываем здесь
        if (
          target.className?.includes("cashier-page__cart-item-quantity-input")
        ) {
          return;
        }
        return;
      }

      // Пропускаем, если открыты модальные окна или экраны
      if (
        showMenuModal ||
        showCustomerModal ||
        showPaymentPage ||
        showShiftPage ||
        showOpenShiftPage ||
        showCloseShiftPage ||
        showDebtModal ||
        showReceiptsModal ||
        showCustomServiceModal ||
        showDiscountModal
      ) {
        return;
      }

      // НОВАЯ НАДЕЖНАЯ ЛОГИКА: НЕ открываем страницу, если было недавнее сканирование
      const timeSinceLastScan = Date.now() - lastScanTimeRef.current;
      const timeSinceLastInput = Date.now() - lastSearchInputTime.current;

      // ПРИОРИТЕТ 1: Если идет обработка сканирования, НЕ открываем страницу
      if (barcodeProcessingRef.current) {
        return;
      }

      // ПРИОРИТЕТ 2: Если флаг сканирования установлен, НЕ открываем страницу
      // Это работает даже если обработка уже завершена, но Enter от сканера еще не обработан
      if (isScanningRef.current) {
        // Обновляем время при каждом Enter во время сканирования
        if (e.key === "Enter") {
          lastScanTimeRef.current = Date.now();
        }
        return;
      }

      // ПРИОРИТЕТ 3: Если было недавнее сканирование (в течение 2000мс), НЕ открываем страницу
      // Уменьшили время с 5000мс до 2000мс, чтобы не блокировать обычный Enter слишком долго
      if (timeSinceLastScan < 2000 && isScanningRef.current) {
        // Если Enter приходит очень быстро после последнего сканирования (в течение 500мс),
        // это точно Enter от сканера - обновляем время и не открываем страницу
        if (e.key === "Enter" && timeSinceLastScan < 500) {
          lastScanTimeRef.current = Date.now();
          isScanningRef.current = true; // Устанавливаем флаг на случай повторного Enter
          // Сбрасываем флаг через 2 секунды
          setTimeout(() => {
            isScanningRef.current = false;
          }, 2000);
          return;
        }

        // Если поле поиска было очищено после сканирования, это точно сканер
        if (searchClearedAfterScanRef.current && e.key === "Enter") {
          lastScanTimeRef.current = Date.now();
          isScanningRef.current = true;
          setTimeout(() => {
            isScanningRef.current = false;
            searchClearedAfterScanRef.current = false;
          }, 2000);
          return;
        }

        // Если флаг сканирования установлен и Enter приходит в течение 2 секунд после сканирования
        // это может быть Enter от сканера - не открываем страницу
        if (e.key === "Enter" && timeSinceLastScan < 2000) {
          // Но только если счетчик сканера был высоким (>= 6), иначе это может быть обычный Enter
          // Сбрасываем флаг через 2 секунды
          setTimeout(() => {
            isScanningRef.current = false;
          }, 2000);
          return;
        }
      }

      // Если флаг сканирования установлен, но прошло больше 2 секунд - сбрасываем его
      if (isScanningRef.current && timeSinceLastScan >= 2000) {
        isScanningRef.current = false;
        scanKeysRef.current.count = 0;
      }

      // ПРИОРИТЕТ 4: Если был недавний ввод в поле поиска (не сканирование), не открываем страницу
      if (isSearchInputFocused && timeSinceLastInput < 1000) {
        // Сбрасываем счетчик, так как это не сканер
        if (e.key === "Enter") {
          scanKeysRef.current.count = 0;
        }
        return; // Не открываем страницу оплаты, если недавно был ручной ввод в поле поиска
      }

      // Если корзина не пуста, открываем страницу оплаты
      if (cart.length > 0 && currentSale?.id && e.key === "Enter") {
        // Сбрасываем счетчик, так как это обычный Enter (не от сканера)
        scanKeysRef.current.count = 0;
        e.preventDefault();
        handleCheckout();
      } else if (e.key === "Enter") {
        // Сбрасываем счетчик для любого другого Enter, который не открывает оплату
        scanKeysRef.current.count = 0;
      }
    };

    window.addEventListener("keydown", handleGlobalEnter);
    return () => {
      window.removeEventListener("keydown", handleGlobalEnter);
    };
  }, [
    cart.length,
    currentSale?.id,
    handleCheckout,
    showMenuModal,
    showCustomerModal,
    showPaymentPage,
    showShiftPage,
    showOpenShiftPage,
    showCloseShiftPage,
    showDebtModal,
    showReceiptsModal,
    showCustomServiceModal,
    showDiscountModal,
  ]);

  useEffect(() => {
    if (!openShiftId) return;
    dispatch(startSale({ discount_total: 0, shift: openShiftId }));
  }, [openShiftId]);

  const addToCartWithPackage = async (product, salePackageId = null) => {
    // Проверяем наличие товара
    // Для весовых товаров stock может быть false, но quantity > 0
    const availableQuantity = parseFloat(product.quantity || 0);
    const isInStock = availableQuantity > 0;

    if (!isInStock) {
      showAlert("warning", "Товар отсутствует", "Товар отсутствует в наличии");
      return;
    }

    try {
      // Проверяем наличие открытой смены перед добавлением товара
      if (!openShiftId) {
        showAlert(
          "warning",
          "Нет открытой смены",
          "Для работы с кассой необходимо начать смену",
        );
        return;
      }

      let saleId = currentSale?.id;

      // Если продажа еще не создана, создаем её
      if (!saleId) {
        const result = await dispatch(
          startSale({ discount_total: 0, shift: openShiftId }),
        );
        if (result.type === "sale/start/rejected") {
          showAlert(
            "error",
            "Ошибка",
            "Ошибка при создании продажи: " +
              (result.payload?.message || "Неизвестная ошибка"),
          );
          return;
        }
        saleId = result.payload?.id;
      }

      if (!saleId) {
        showAlert("error", "Ошибка", "Не удалось получить ID продажи");
        return;
      }

      // Проверяем, есть ли товар уже в корзине
      // startSale возвращает items напрямую, а не cart.items
      const items = currentSale?.items || currentSale?.cart?.items || [];
      const existingItem = items.find((item) => {
        const itemProductId = item.product || item.product_id;
        const itemSalePackage = item.sale_package || null;
        const normalizedItemPkg = itemSalePackage ?? null;
        const normalizedNewPkg = salePackageId ?? null;
        return (
          itemProductId === product.id &&
          normalizedItemPkg === normalizedNewPkg
        );
      });

      if (existingItem) {
        // Проверяем, не превышает ли новое количество доступное
        const currentQty = normalizeQuantity(existingItem.quantity);
        const newQuantity = normalizeQuantity(currentQty + 1);
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: saleId,
            productId: existingItem.id,
            quantity: newQuantity,
          }),
        );
        // Обновляем продажу после успешного обновления
        // await refreshSale();
      } else {
        // Добавляем новый товар
        await dispatch(
          manualFilling({
            id: saleId,
            productId: product.id,
            quantity: normalizeQuantity(1),
            ...(salePackageId ? { salePackageId } : {}),
          }),
        );
        // Обновляем продажу после успешного добавления
        // cartOrderRef будет обновлен автоматически в useEffect при обновлении currentSale
        // await refreshSale();
      }
    } catch (error) {
      console.error("Ошибка при добавлении товара в корзину:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при добавлении товара: " +
          (error.message || "Неизвестная ошибка"),
      );
    }
  };

  const addToCart = async (product) => {
    return addToCartWithPackage(product, null);
  };

  const updateQuantity = async (item, delta) => {
    if (!currentSale?.id) return;

    try {
      if (!item?.itemId || !item?.productId) return;
      // Находим товар в списке продуктов для проверки наличия
      const product = products.find((p) => p.id === item.productId);
      if (!product) return;

      // startSale возвращает items напрямую, а не cart.items
      const items = currentSale?.items || currentSale?.cart?.items || [];
      const existingItem = items.find((el) => el.id === item.itemId);

      if (!existingItem) return;

      const currentQty = normalizeQuantity(existingItem.quantity);
      const newQuantity = normalizeQuantity(Math.max(0, currentQty + delta));
      const availableQuantity = parseFloat(product.quantity || 0);

      // Проверяем наличие при увеличении количества
      if (delta > 0 && !item.salePackage) {
        // Для весовых товаров stock может быть false, но quantity > 0
        const isInStock = availableQuantity > 0;

        if (!isInStock) {
          showAlert(
            "warning",
            "Товар отсутствует",
            "Товар отсутствует в наличии",
          );
          return;
        }

        if (availableQuantity > 0 && newQuantity > availableQuantity) {
          showAlert(
            "warning",
            "Недостаточно товара",
            `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
          );
          return;
        }
      } else if (delta > 0 && item.salePackage) {
        const isInStock = availableQuantity > 0;
        if (!isInStock) {
          showAlert(
            "warning",
            "Товар отсутствует",
            "Товар отсутствует в наличии",
          );
          return;
        }
        const qip = Number(
          product?.packages?.find((p) => p.id === item.salePackage)
            ?.quantity_in_package,
        );
        if (!(qip > 0)) {
          showAlert(
            "error",
            "Ошибка упаковки",
            "Для поштучной продажи не найдена корректная упаковка товара",
          );
          return;
        }
        const totalConsume = calcTotalConsumeForProduct(
          items,
          item.productId,
          products,
        );
        const newTotalConsume =
          totalConsume - currentQty / qip + newQuantity / qip;
        if (newTotalConsume > availableQuantity) {
          showAlert(
            "warning",
            "Недостаточно товара",
            `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
          );
          return;
        }
      }

      if (newQuantity === 0) {
        // Удаляем товар из корзины
        await dispatch(
          deleteProductInCart({
            id: currentSale.id,
            productId: item.itemId,
          }),
        );
        // Удаляем товар из сохраненного порядка
        cartOrderRef.current = cartOrderRef.current.filter(
          (id) => id !== item.id,
        );
        // Удаляем из локальных значений количества
        setCartQuantities((prev) => {
          const newQuantities = { ...prev };
          delete newQuantities[item.id];
          return newQuantities;
        });
        // Обновляем продажу после успешного удаления
        // await refreshSale();
      } else {
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: currentSale.id,
            productId: item.itemId,
            quantity: newQuantity,
          }),
        );
        // Обновляем локальное значение количества
        setCartQuantities((prev) => ({
          ...prev,
          [item.id]: String(newQuantity),
        }));
        // Обновляем продажу после успешного обновления
        // await refreshSale();
      }
    } catch (error) {
      console.error("Ошибка при обновлении количества:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при обновлении количества: " +
          (error.message || "Неизтвестная ошибка"),
      );
    }
  };

  // Функция для обновления количества напрямую (без дельты)
  const updateQuantityDirect = async (item, newQuantity) => {
    if (!currentSale?.id) return;

    try {
      if (!item?.itemId || !item?.productId) return;
      // Находим товар в списке продуктов для проверки наличия
      const product = products.find((p) => p.id === item.productId);
      if (!product) return;

      const qtyNum = normalizeQuantity(
        Math.max(0, parseFloat(newQuantity) || 0),
      );
      const availableQuantity = parseFloat(product.quantity || 0);

      // Проверяем наличие
      if (
        !item.salePackage &&
        availableQuantity > 0 &&
        qtyNum > availableQuantity
      ) {
        showAlert(
          "warning",
          "Недостаточно товара",
          `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
        );
        return;
      } else if (item.salePackage) {
        if (!(availableQuantity > 0)) {
          showAlert(
            "warning",
            "Товар отсутствует",
            "Товар отсутствует в наличии",
          );
          return;
        }
        const items = currentSale?.items || currentSale?.cart?.items || [];
        const currentItem = items.find((el) => el.id === item.itemId);
        const currentQty = normalizeQuantity(currentItem?.quantity || 0);
        const qip = Number(
          product?.packages?.find((p) => p.id === item.salePackage)
            ?.quantity_in_package,
        );
        if (!(qip > 0)) {
          showAlert(
            "error",
            "Ошибка упаковки",
            "Для поштучной продажи не найдена корректная упаковка товара",
          );
          return;
        }
        const totalConsume = calcTotalConsumeForProduct(
          items,
          item.productId,
          products,
        );
        const newTotalConsume = totalConsume - currentQty / qip + qtyNum / qip;
        if (newTotalConsume > availableQuantity) {
          showAlert(
            "warning",
            "Недостаточно товара",
            `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
          );
          return;
        }
      }

      if (qtyNum === 0) {
        await removeFromCart(item);
      } else {
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: currentSale.id,
            productId: item.itemId,
            quantity: qtyNum,
          }),
        );
        // Обновляем локальное значение количества
        setCartQuantities((prev) => ({
          ...prev,
          [item.id]: String(qtyNum),
        }));
        // Обновляем продажу после успешного обновления
        await refreshSale();
      }
    } catch (error) {
      console.error("Ошибка при обновлении количества:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при обновлении количества: " +
          (error.message || "Неизвестная ошибка"),
      );
    }
  };

  const removeFromCart = async (item) => {
    if (!currentSale?.id) return;

    try {
      if (!item?.itemId) return;
      // Удаляем товар из корзины
      await dispatch(
        deleteProductInCart({
          id: currentSale.id,
          productId: item.itemId,
        }),
      );
      // Удаляем товар из сохраненного порядка
      cartOrderRef.current = cartOrderRef.current.filter(
        (id) => id !== item.id,
      );
      // Удаляем из локальных значений количества, цены и скидки
      setCartQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[item.id];
        return newQuantities;
      });
      setCartPrices((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setCartDiscounts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      // Обновляем продажу после успешного удаления
      // await refreshSale();
    } catch (error) {
      console.error("Ошибка при удалении товара:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при удалении товара: " +
          (error.message || "Неизвестная ошибка"),
      );
    }
  };

  // PATCH: только unit_price (MARKET_POS_CART — цена и скидка меняются независимо).
  // Без скидки по строке — цена не может быть ниже закупочной; при наличии скидки — можно.
  const patchCartItemPrice = async (item, value) => {
    if (!currentSale?.id) return;
    const cartItemId = item.itemId;
    const num = normalizePrice(parseFloat(value) || 0);
    const hasDiscount = parseFloat(item.discountTotal ?? 0) > 0;
    if (!item.isCustom && item.productId && !hasDiscount) {
      const product = products.find((p) => p.id === item.productId);
      const purchasePrice = product ? parseFloat(product.purchase_price) : NaN;
      if (!isNaN(purchasePrice) && num < purchasePrice) {
        showAlert(
          "warning",
          "Закупочная цена",
          `Цена не может быть ниже закупочной (${formatPrice(purchasePrice)} сом). При необходимости используйте скидку.`,
        );
        setCartPrices((prev) => ({
          ...prev,
          [item.id]: formatPrice(item.price ?? 0),
        }));
        return;
      }
    }
    try {
      await dispatch(
        updateProductInCart({
          id: currentSale.id,
          productId: cartItemId,
          data: { unit_price: String(num.toFixed(2)) },
        }),
      ).unwrap();
      setCartPrices((prev) => ({ ...prev, [item.id]: formatPrice(num) }));
      await refreshSale();
    } catch (err) {
      console.error("Ошибка при изменении цены:", err);
      showAlert("error", "Ошибка", err?.message || "Не удалось изменить цену");
      setCartPrices((prev) => ({
        ...prev,
        [item.id]: formatPrice(item.price ?? 0),
      }));
    }
  };

  // PATCH: только discount_total (MARKET_POS_CART — цена и скидка меняются независимо).
  // API хранит line_discount (сумма); в запросе — discount_total. Итог по строке: (unit_price × quantity) - line_discount.
  // Скидка не может превышать сумму строки (итог не уходит в минус).
  const patchCartItemDiscount = async (item, value, options = {}) => {
    const { mode = "amount", displayValue } = options;
    if (!currentSale?.id) return;
    const cartItemId = item.itemId;
    const lineTotal = (item.price || 0) * (item.quantity || 0);
    let num = Math.max(0, normalizePrice(parseFloat(value) || 0));
    if (num > lineTotal) {
      num = lineTotal;
      showAlert(
        "warning",
        "Скидка",
        `Скидка не может быть больше суммы по строке (${formatPrice(lineTotal)} сом). Установлено ${formatPrice(lineTotal)} сом.`,
      );
    }
    const data = { discount_total: String(num.toFixed(2)) };
    try {
      await dispatch(
        updateProductInCart({
          id: currentSale.id,
          productId: cartItemId,
          data,
        }),
      ).unwrap();
      setCartDiscounts((prev) => {
        // В режиме процентов сохраняем именно введённое значение (проценты),
        // в режиме суммы — форматированную сумму.
        if (mode === "percent" && displayValue !== undefined) {
          return {
            ...prev,
            [item.id]: displayValue,
          };
        }
        return { ...prev, [item.id]: formatPrice(num) };
      });
      await refreshSale();
    } catch (err) {
      console.error("Ошибка при изменении скидки:", err);
      showAlert(
        "error",
        "Ошибка",
        err?.message || "Не удалось изменить скидку",
      );
      setCartDiscounts((prev) => ({
        ...prev,
        [item.id]: formatPrice(item.discountTotal ?? 0),
      }));
    }
  };

  const total =
    parseFloat(currentSale?.total || 0) ||
    cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  const handleMenuAction = (action) => {
    setShowMenuModal(false);
    if (action === "shifts") {
      setShowShiftPage(true);
    } else if (action === "debt") {
      setShowDebtModal(true);
    } else if (action === "receipts") {
      setShowReceiptsModal(true);
    }
  };

  const handleCloseShift = () => {
    if (!openShift?.id) return;
    // Показываем экран закрытия смены
    setShowCloseShiftPage(true);
  };

  // Функция для открытия смены
  const handleStartShift = () => {
    // Показываем экран открытия смены
    setShowOpenShiftPage(true);
  };

  const filteredProducts = useMemo(() => {
    const items = currentSale?.items || [];
    return products
      .map((el) => {
        const qty = parseFloat(el.quantity);
        const cartQty = calcTotalConsumeForProduct(items, el.id, products);
        const primaryImg = el.images.find((el) => el.is_primary);
        return {
          ...el,
          quantity: qty,
          isCart: !!cartQty,
          cartQty,
          img:
            primaryImg?.image_url ??
            el.images[0]?.image_url ??
            "/images/placeholder.avif",
        };
      })
      .filter((el) => !!el.quantity || el.isCart);
  }, [products, currentSale]);
  if (showShiftPage) {
    return <ShiftPage onBack={() => setShowShiftPage(false)} />;
  }

  if (showOpenShiftPage) {
    return (
      <OpenShiftPage
        onBack={() => {
          setShowOpenShiftPage(false);
          // Обновляем список смен после возврата
          dispatch(fetchShiftsAsync()).then(() => {
            // После обновления списка ищем открытую смену
            findOpenShift();
          });
        }}
      />
    );
  }

  if (showCloseShiftPage) {
    return (
      <CloseShiftPage
        onBack={() => {
          setShowCloseShiftPage(false);
          // Сбрасываем состояние открытой смены
          setOpenShiftState(null);
          // Обновляем список смен после возврата
          dispatch(fetchShiftsAsync());
          // Очищаем корзину и текущую продажу (после закрытия смены она невалидна)
          dispatch(resetPosSale());
          setCart([]);
          cartOrderRef.current = [];
          setSelectedCustomer(null);
          setDiscountValue("");
        }}
        shift={openShift}
      />
    );
  }

  if (showPaymentPage) {
    return (
      <PaymentPage
        cart={cart}
        total={total}
        customer={selectedCustomer}
        onBack={() => setShowPaymentPage(false)}
        onSelectCustomer={(customer) => {
          setSelectedCustomer(customer);
        }}
        onComplete={async () => {
          setShowPaymentPage(false);
          setCart([]);
          cartOrderRef.current = []; // Очищаем порядок при завершении продажи
          setSelectedCustomer(null);
          setDiscountValue(""); // Сбрасываем скидку
          // Начинаем новую продажу после завершения (только если есть открытая смена)
          // Важно: создаем новую корзину БЕЗ скидки (discount_total: 0)
          if (openShiftId) {
            await dispatch(
              startSale({ discount_total: 0, shift: openShiftId }),
            );
            // Не вызываем refreshSale() здесь, так как он использует старую скидку из currentSale
            // startSale уже обновляет состояние продажи
          }
          // После завершения продажи обновляем список товаров (остатки)
          try {
            await dispatch(fetchProductsAsync({ page: 1 })).unwrap();
          } catch (e) {
            console.error(
              "Не удалось обновить список товаров после продажи:",
              e,
            );
          }
        }}
        saleId={currentSale?.id}
        customers={clients}
        sale={currentSale}
      />
    );
  }

  return (
    <div className="cashier-page">
      <div className="cashier-page__header">
        <div className="cashier-page__header-left">
          <button
            className="cashier-page__back-btn"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="cashier-page__title">Касса</h1>
            <p className="cashier-page__subtitle">
              {openShiftId ? (
                <>
                  Смена #
                  {openShift?.code ||
                    (() => {
                      const idStr = openShiftId.toString();
                      // Извлекаем только цифры из ID
                      const digitsOnly = idStr.replace(/\D/g, "");
                      // Если есть достаточно цифр (минимум 4), используем последние 8, иначе используем последние 8 символов без дефисов
                      return digitsOnly.length >= 4
                        ? digitsOnly.slice(-8)
                        : idStr.replace(/-/g, "").slice(-8).toUpperCase();
                    })() ||
                    "—"}{" "}
                  • {openShift.cashier_display || "—"}
                </>
              ) : (
                "Нет открытой смены"
              )}
            </p>
          </div>
        </div>
        <div className="cashier-page__header-right">
          {openShiftId && openShift?.status === "open" ? (
            <button
              className="cashier-page__close-shift-btn"
              onClick={handleCloseShift}
            >
              Завершить смену
            </button>
          ) : (
            <button
              className="cashier-page__close-shift-btn"
              onClick={handleStartShift}
              style={{ backgroundColor: "#22c55e" }}
            >
              Начать смену
            </button>
          )}
          <button
            className="cashier-page__menu-btn"
            onClick={() => setShowMenuModal(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      <div className="cashier-page__content">
        <div
          className={`cashier-page__products ${mobileProductsList ? "active" : ""} `}
        >
          <div className="mobile-list-btn flex w-full justify-center py-2 md:hidden!">
            <Button
              onClick={() => setMobileProductsList(false)}
              className="mx-auto"
            >
              Скрыть
            </Button>
          </div>
          <div className="cashier-page__search">
            <Search size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => {
                const newValue = e.target.value;
                const oldValue = searchTerm;
                setSearchTerm(newValue);

                // Обновляем время последнего ввода при каждом изменении (для защиты от сканера)
                const now = Date.now();
                const timeSinceLastInput = now - lastSearchInputTime.current;
                lastSearchInputTime.current = now;

                // Если длина уменьшилась, значит пользователь удаляет символы (Backspace/Delete)
                // Это точно ручной ввод - сбрасываем все флаги сканера
                if (newValue.length < oldValue.length) {
                  scanKeysRef.current.count = 0;
                  scanKeysRef.current.lastTime = 0;
                  isScanningRef.current = false;
                  lastScanTimeRef.current = 0;
                  searchClearedAfterScanRef.current = false;
                }

                // Если ввод медленный (больше 100мс между символами), это ручной ввод - сбрасываем счетчик сканера
                if (timeSinceLastInput > 100) {
                  scanKeysRef.current.count = 0;
                  isScanningRef.current = false;
                }

                // Если пользователь вводит текст вручную, сбрасываем флаг очистки после сканирования
                if (newValue.length > 0) {
                  searchClearedAfterScanRef.current = false;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const now = Date.now();
                  const timeSinceLastInput = now - lastSearchInputTime.current;
                  const isScannerSubmit =
                    barcodeProcessingRef.current ||
                    isScanningRef.current ||
                    scanKeysRef.current.count >= 6;

                  // Если в поле поиска есть текст и нажат Enter, это может быть сканирование
                  // Обновляем время сканирования как fallback (на случай, если onScanned еще не сработал)
                  if (searchTerm.length > 0) {
                    // Если ввод был недавно (менее 500мс), считаем это сканированием
                    if (timeSinceLastInput < 500) {
                      lastScanTimeRef.current = now;
                      isScanningRef.current = true;
                      // Сбрасываем флаг через 2 секунды
                      setTimeout(() => {
                        isScanningRef.current = false;
                      }, 2000);
                    }
                  }

                  // Обновляем время последнего ввода (сканер завершает ввод Enter'ом)
                  lastSearchInputTime.current = now;

                  // Во время сканирования не берем первый товар из списка поиска:
                  // сканер сам добавляет товар через sendBarCode по точному barcode.
                  if (isScannerSubmit || timeSinceLastInput < 500) {
                    setSearchTerm("");
                    searchClearedAfterScanRef.current = true;
                    scanKeysRef.current.count = 0;
                    return;
                  }

                  // Если есть найденные товары, добавляем первый в корзину
                  if (filteredProducts.length > 0) {
                    addToCart(filteredProducts[0]);
                    // Очищаем поле поиска после добавления товара
                    setSearchTerm("");
                    // Сбрасываем флаг очистки после сканирования, так как это ручное добавление
                    searchClearedAfterScanRef.current = false;
                  }
                }
              }}
              className="cashier-page__search-input"
            />
          </div>

          <div className="cashier-page__products-grid">
            {productsLoading ? (
              <div className="cashier-page__products-loading">
                Загрузка товаров...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="cashier-page__products-empty">
                Товары не найдены
              </div>
            ) : (
              filteredProducts.map((product) => {
                const cartItem = cart.find(
                  (item) => !item.isCustom && item.productId === product.id,
                );
                return (
                  <div
                    key={product.id}
                    className={`cashier-page__product-card ${
                      cartItem ? "cashier-page__product-card--selected" : ""
                    }`}
                    onClick={(e) => handleProductCardClick(product, e)}
                  >
                    {cartItem && (
                      <div className="cashier-page__product-badge">
                        {formatQuantity(product.cartQty || 0)}
                      </div>
                    )}
                    <div className="cashier-page__product-name">
                      {product.name || "—"}
                    </div>
                    <div className="cashier-page__product-price">
                      {formatPrice(product.price || 0)} сом
                    </div>

                    <div className="cashier-page__product-stock flex items-center gap-2">
                      {product.quantity || 0} {product.unit || "шт"}
                      {getDefaultPiecePackage(product) && (
                        <button
                          type="button"
                          className="cashier-page__cart-item-btn cursor-pointer"
                          // style={{ marginTop: 8 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const pkg = getDefaultPiecePackage(product);
                            if (!pkg?.id) return;
                            addToCartWithPackage(product, pkg.id);
                          }}
                          title="Добавить 1 шт (поштучно)"
                        >
                          +1 шт
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="cashier-page__pagination">
              <button
                type="button"
                className="cashier-page__pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || productsLoading || !previous}
              >
                Назад
              </button>
              <span className="cashier-page__pagination-info">
                Страница {currentPage} из {totalPages || 1}
                {count && ` (${count} товаров)`}
              </span>
              <button
                type="button"
                className="cashier-page__pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={
                  productsLoading ||
                  !next ||
                  (totalPages && currentPage >= totalPages)
                }
              >
                Вперед
              </button>
            </div>
          )}
        </div>
        <Button
          className="min-[769px]:hidden!"
          onClick={() => setMobileProductsList(true)}
          color="info"
        >
          Добавить товар
        </Button>
        <div className="cashier-page__cart">
          <div className="cashier-page__cart-header">
            <h2 className="cashier-page__cart-title">Корзина</h2>
            <button
              className="cashier-page__cart-customer-btn"
              onClick={() => setShowCustomerModal(true)}
            >
              <UserPlus size={20} />
            </button>
          </div>

          {/* Кнопки для скидки и доп. услуг */}
          <div className="cashier-page__cart-actions">
            <button
              className="cashier-page__cart-action-btn"
              onClick={() => {
                // Инициализируем модалку текущими данными
                if (currentSale?.order_discount_percent) {
                  setDiscountMode("percent");
                  setDiscountValue(
                    String(currentSale.order_discount_percent || ""),
                  );
                } else {
                  setDiscountMode("amount");
                  setDiscountValue(
                    String(currentSale?.order_discount_total || ""),
                  );
                }
                setShowDiscountModal(true);
              }}
              title="Добавить общую скидку"
            >
              Скидка
            </button>
            <button
              className="cashier-page__cart-action-btn"
              onClick={() => setShowCustomServiceModal(true)}
              title="Добавить дополнительную услугу"
            >
              Доп. услуга
            </button>
          </div>

          <div className="cashier-page__cart-items">
            {cart.length === 0 ? (
              <div className="cashier-page__cart-empty">Корзина пуста</div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="cashier-page__cart-item">
                  <div className="cashier-page__cart-item-main">
                    <div className="cashier-page__cart-item-head">
                      <span className="cashier-page__cart-item-name">
                        {item.name}
                        {item.salePackage ? " (поштучно)" : ""}
                      </span>
                      <div className="cashier-page__cart-item-head-right">
                        <div className="cashier-page__cart-item-discount-modes">
                          <button
                            type="button"
                            className={`cashier-page__cart-item-discount-mode-btn ${
                              (cartDiscountModes[item.id] || "amount") ===
                              "amount"
                                ? "active"
                                : ""
                            }`}
                            onClick={() => {
                              const lineTotal =
                                (item.price || 0) * (item.quantity || 0);
                              const lineDiscount = parseFloat(
                                item.discountTotal ?? 0,
                              );
                              const discountToShow =
                                lineTotal > 0 && lineDiscount > lineTotal
                                  ? lineTotal
                                  : lineDiscount;
                              setCartDiscountModes((prev) => ({
                                ...prev,
                                [item.id]: "amount",
                              }));
                              setCartDiscounts((prev) => ({
                                ...prev,
                                [item.id]: formatPrice(discountToShow),
                              }));
                              if (lineTotal > 0 && lineDiscount > lineTotal) {
                                patchCartItemDiscount(item, lineTotal);
                              }
                            }}
                          >
                            сом
                          </button>
                          <button
                            type="button"
                            className={`cashier-page__cart-item-discount-mode-btn ${
                              cartDiscountModes[item.id] === "percent"
                                ? "active"
                                : ""
                            }`}
                            onClick={() => {
                              const wasAmount =
                                (cartDiscountModes[item.id] || "amount") ===
                                "amount";
                              const lineTotal =
                                (item.price || 0) * (item.quantity || 0);
                              const currentInput =
                                cartDiscounts[item.id] ??
                                formatPrice(item.discountTotal ?? 0);
                              const num = parseFloat(currentInput);

                              setCartDiscountModes((prev) => ({
                                ...prev,
                                [item.id]: "percent",
                              }));

                              if (
                                wasAmount &&
                                !isNaN(num) &&
                                num >= 0 &&
                                lineTotal > 0
                              ) {
                                const pct = Math.min(100, num);
                                const displayPct =
                                  pct === 100
                                    ? "100"
                                    : String(pct).replace(/\.?0+$/, "") || "0";
                                const discountSom = (lineTotal * pct) / 100;
                                setCartDiscounts((prev) => ({
                                  ...prev,
                                  [item.id]: displayPct,
                                }));
                                patchCartItemDiscount(item, discountSom, {
                                  mode: "percent",
                                  displayValue: displayPct,
                                });
                              } else {
                                const discountSom = parseFloat(
                                  item.discountTotal ?? 0,
                                );
                                const pct =
                                  lineTotal > 0 && discountSom > 0
                                    ? String(
                                        Number(
                                          (
                                            (discountSom / lineTotal) *
                                            100
                                          ).toFixed(2),
                                        ).replace(/\.?0+$/, ""),
                                      )
                                    : "";
                                setCartDiscounts((prev) => ({
                                  ...prev,
                                  [item.id]: pct,
                                }));
                              }
                            }}
                          >
                            %
                          </button>
                        </div>
                        <span className="cashier-page__cart-item-total">
                          {item.discountTotal > 0 ? (
                            <>
                              <span
                                style={{
                                  textDecoration: "line-through",
                                  opacity: 0.7,
                                  marginRight: 6,
                                }}
                              >
                                {Number(
                                  ((item.price || 0) * item.quantity).toFixed(
                                    2,
                                  ),
                                )}{" "}
                                сом
                              </span>
                              <span>
                                {Number(
                                  (
                                    (item.price || 0) * item.quantity -
                                    (item.discountTotal || 0)
                                  ).toFixed(2),
                                )}{" "}
                                сом
                              </span>
                            </>
                          ) : (
                            <>
                              {Number(
                                (
                                  (item.price || 0) * item.quantity -
                                  (item.discountTotal || 0)
                                ).toFixed(2),
                              )}{" "}
                              сом
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="cashier-page__cart-item-row">
                      <label className="cashier-page__cart-item-field">
                        <span className="cashier-page__cart-item-field-label">
                          Цена
                        </span>
                        <input
                          type="text"
                          className="cashier-page__cart-item-price-input"
                          value={
                            cartPrices[item.id] ?? formatPrice(item.price ?? 0)
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (
                              v === "" ||
                              v === "-" ||
                              /^\d*\.?\d*$/.test(v)
                            ) {
                              setCartPrices((prev) => ({
                                ...prev,
                                [item.id]: v,
                              }));
                            }
                          }}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const num = parseFloat(v);
                            if (v !== "" && !isNaN(num) && num !== item.price) {
                              patchCartItemPrice(item, v);
                            } else {
                              setCartPrices((prev) => ({
                                ...prev,
                                [item.id]: formatPrice(item.price ?? 0),
                              }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                      </label>
                      <label className="cashier-page__cart-item-field">
                        <span className="cashier-page__cart-item-field-label">
                          Скидка
                        </span>
                        <input
                          type="text"
                          className="cashier-page__cart-item-price-input"
                          value={cartDiscounts[item.id] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            // Разрешаем только число, пустую строку и "сырой" ввод до валидации
                            if (
                              v === "" ||
                              v === "-" ||
                              /^\d*\.?\d*$/.test(v)
                            ) {
                              setCartDiscounts((prev) => ({
                                ...prev,
                                [item.id]: v,
                              }));
                            }
                          }}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const mode = cartDiscountModes[item.id] || "amount";
                            const num = parseFloat(v);
                            const current = parseFloat(item.discountTotal ?? 0);
                            const lineTotal =
                              (item.price || 0) * (item.quantity || 0);

                            // Пустое поле — скидка 0 (по доке отправляем только discount_total)
                            if (v === "") {
                              if (current !== 0) {
                                patchCartItemDiscount(item, 0, {
                                  mode,
                                  displayValue: "",
                                });
                              } else {
                                setCartDiscounts((prev) => ({
                                  ...prev,
                                  [item.id]: "",
                                }));
                              }
                              return;
                            }
                            if (isNaN(num) || num < 0) return;

                            if (mode === "percent") {
                              if (lineTotal <= 0) return;
                              let discountSom =
                                (lineTotal * Math.max(0, num)) / 100;
                              if (discountSom > lineTotal)
                                discountSom = lineTotal;
                              if (discountSom !== current) {
                                patchCartItemDiscount(item, discountSom, {
                                  mode: "percent",
                                  displayValue: v,
                                });
                              }
                            } else {
                              if (num !== current) {
                                patchCartItemDiscount(item, v);
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                      </label>
                      <div className="cashier-page__cart-item-controls">
                        <button
                          type="button"
                          className="cashier-page__cart-item-btn"
                          onClick={() => {
                            if (item.isCustom)
                              return updateCustomQuantityByDelta(item, -1);
                            return updateQuantity(item, -1);
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="text"
                          className="cashier-page__cart-item-quantity-input"
                          value={
                            cartQuantities[item.id] ??
                            formatQuantity(item.quantity || 0)
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "" || value === "-") {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: value,
                              }));
                              return;
                            }
                            const numValue = parseFloat(value);
                            if (isNaN(numValue)) return;
                            if (!item.isCustom && !item.salePackage) {
                              const product = products.find(
                                (p) => p.id === item.productId,
                              );
                              if (product) {
                                const availableQuantity = parseFloat(
                                  product.quantity || 0,
                                );
                                if (
                                  availableQuantity > 0 &&
                                  numValue > availableQuantity
                                ) {
                                  setCartQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: String(availableQuantity),
                                  }));
                                  showAlert(
                                    "warning",
                                    "Недостаточно товара",
                                    `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
                                  );
                                  return;
                                }
                              }
                            }
                            if (!item.isCustom && item.salePackage) {
                              const product = products.find(
                                (p) => p.id === item.productId,
                              );
                              const items =
                                currentSale?.items || currentSale?.cart?.items || [];
                              const currentItem = items.find(
                                (el) => el.id === item.itemId,
                              );
                              const currentQty = normalizeQuantity(
                                currentItem?.quantity || 0,
                              );
                              const qip = Number(
                                product?.packages?.find(
                                  (p) => p.id === item.salePackage,
                                )?.quantity_in_package,
                              );
                              if (product && qip > 0) {
                                const totalConsume = calcTotalConsumeForProduct(
                                  items,
                                  item.productId,
                                  products,
                                );
                                const newTotalConsume =
                                  totalConsume - currentQty / qip + numValue / qip;
                                const availableQuantity = parseFloat(
                                  product.quantity || 0,
                                );
                                if (newTotalConsume > availableQuantity) {
                                  showAlert(
                                    "warning",
                                    "Недостаточно товара",
                                    `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
                                  );
                                  return;
                                }
                              }
                            }
                            if (numValue < 0) {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: "0",
                              }));
                              return;
                            }
                            setCartQuantities((prev) => ({
                              ...prev,
                              [item.id]: value,
                            }));
                          }}
                          onBlur={async (e) => {
                            const value = e.target.value;
                            const qtyNum = normalizeQuantity(
                              Math.max(0, parseFloat(value) || 0),
                            );
                            if (!item.isCustom && !item.salePackage) {
                              const product = products.find(
                                (p) => p.id === item.productId,
                              );
                              if (product) {
                                const availableQuantity = parseFloat(
                                  product.quantity || 0,
                                );
                                if (
                                  availableQuantity > 0 &&
                                  qtyNum > availableQuantity
                                ) {
                                  showAlert(
                                    "warning",
                                    "Недостаточно товара",
                                    `Доступно только ${availableQuantity} ${product.unit || "шт"}`,
                                  );
                                  setCartQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: formatQuantity(
                                      item.quantity || 0,
                                    ),
                                  }));
                                  return;
                                }
                              }
                            }
                            if (qtyNum === 0) {
                              if (item.isCustom) {
                                await removeCustomFromCart(item);
                              } else {
                                await removeFromCart(item);
                              }
                            } else if (qtyNum !== item.quantity) {
                              if (item.isCustom) {
                                await updateCustomQuantityDirect(item, qtyNum);
                              } else {
                                await updateQuantityDirect(item, qtyNum);
                              }
                            } else {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: formatQuantity(item.quantity || 0),
                              }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                        <button
                          type="button"
                          className="cashier-page__cart-item-btn"
                          onClick={() => {
                            if (item.isCustom)
                              return updateCustomQuantityByDelta(item, 1);
                            return updateQuantity(item, 1);
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="cashier-page__cart-item-remove"
                        onClick={() => {
                          if (item.isCustom) return removeCustomFromCart(item);
                          return removeFromCart(item);
                        }}
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cashier-page__cart-footer">
              {currentSale?.order_discount_total > 0 && (
                <div className="cashier-page__cart-discount">
                  <span>Скидка:</span>
                  <span>
                    -{formatPrice(currentSale.order_discount_total || 0)} сом
                  </span>
                </div>
              )}
              <div className="cashier-page__cart-total">
                <span>Итого:</span>
                <span>{formatPrice(total)} сом</span>
              </div>
              <button
                className="cashier-page__checkout-btn"
                onClick={handleCheckout}
              >
                ОФОРМИТЬ{" "}
              </button>
            </div>
          )}
        </div>
      </div>

      {showMenuModal && (
        <MenuModal
          onClose={() => setShowMenuModal(false)}
          onAction={handleMenuAction}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelect={(customer) => {
            setSelectedCustomer(customer);
            setShowCustomerModal(false);
          }}
          customers={clients}
        />
      )}

      {showDebtModal && (
        <DebtPaymentModal
          onClose={() => setShowDebtModal(false)}
          customers={clients}
        />
      )}

      {showReceiptsModal && (
        <ReceiptsModal onClose={() => setShowReceiptsModal(false)} />
      )}

      {showCustomServiceModal && (
        <CustomServiceModal
          show={showCustomServiceModal}
          onClose={() => {
            setShowCustomServiceModal(false);
            setCustomService({ name: "", price: "", quantity: "1" });
          }}
          customService={customService}
          setCustomService={setCustomService}
          onAdd={handleAddCustomService}
        />
      )}

      {showDiscountModal && (
        <DiscountModal
          show={showDiscountModal}
          onClose={() => {
            setShowDiscountModal(false);
          }}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          currentSubtotal={currentSale?.subtotal || 0}
          mode={discountMode}
          setMode={setDiscountMode}
          onApply={(discount) => {
            handleDiscountChange(discount, discountMode);
            setShowDiscountModal(false);
          }}
        />
      )}

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText="ОК"
        onClose={closeAlert}
        onConfirm={closeAlert}
      />
    </div>
  );
};

export default CashierPage;
