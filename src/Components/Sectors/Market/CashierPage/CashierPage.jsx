import {
  ArrowLeft,
  Menu,
  Minus,
  Plus,
  Search,
  Star,
  Trash2,
  UserPlus,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useStore } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import useScanDetection from "use-scan-detection";
import { useDebounce, useDebounceByKey } from "../../../../hooks/useDebounce";
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
import { productMatchesBarcode } from "../../../../../tools/productBarcode";
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
import DeletionsLogModal from "./components/DeletionsLogModal";
import HotkeyProductsModal from "./components/HotkeyProductsModal";
import MenuModal from "./components/MenuModal";
import ReceiptsModal from "./components/ReceiptsModal";
import OpenShiftPage from "./OpenShiftPage";
import PaymentPage from "./PaymentPage";
import ShiftPage from "./ShiftPage";
import { Button } from "@mui/material";
import sleep from "../../../../../tools/sleep";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  MARKET_CASHIER_SALE_ID_PARAM,
  useMarketCashierMultiCart,
} from "../../../../hooks/useMarketCashierMultiCart";
import CashierCartsBar from "./components/CashierCartsBar";

const HOTKEY_GROUP_PATTERN = /^F(?:[1-9]|1[0-2])$/;
const MARKET_CASHIER_WHOLESALE_MODE_KEY = "market_cashier_is_wholesale";

const normalizeHotkeyGroup = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return HOTKEY_GROUP_PATTERN.test(normalized) ? normalized : "";
};

const normalizeCompactProductsResponse = (data) => {
  const rawList = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];

  return rawList.map((item) => ({
    ...item,
    images: Array.isArray(item?.images) ? item.images : [],
    packages: Array.isArray(item?.packages) ? item.packages : [],
  }));
};

/** Убирает хвост .00 только у дробей; «50» и «100» не трогать (иначе /\\.?0+$/ даёт «5» и «1»). */
const stripTrailingZerosAfterDecimal = (num) => {
  const s = String(num);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "") || "0";
};

const fmtSomShort = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n ?? "");
  return stripTrailingZerosAfterDecimal(Number(x.toFixed(2)));
};

const normalizeCartPromotionRules = (rules) => {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((r, idx) => ({
      position: Number(r?.position ?? idx),
      min_amount: parseFloat(String(r?.min_amount ?? "").replace(",", ".")) || 0,
      discount_percent:
        parseFloat(String(r?.discount_percent ?? "").replace(",", ".")) || 0,
      promo_quantity:
        r?.promo_quantity === null ||
        r?.promo_quantity === undefined ||
        String(r.promo_quantity).trim() === ""
          ? null
          : Math.max(0, parseFloat(String(r.promo_quantity).replace(",", ".")) || 0),
    }))
    .filter((r) => r.discount_percent > 0)
    .sort((a, b) => a.position - b.position);
};

const getActiveCartPromotionTier = (price, qty, rules) => {
  const list = normalizeCartPromotionRules(rules);
  if (!list.length) return null;
  const gross = (parseFloat(price) || 0) * (parseFloat(qty) || 0);
  const q = parseFloat(qty) || 0;
  let best = null;
  for (const r of list) {
    if (gross + 1e-9 < r.min_amount) continue;
    if (r.promo_quantity != null && r.promo_quantity > 0 && q + 1e-9 < r.promo_quantity)
      continue;
    if (!best || r.min_amount > best.min_amount) best = r;
  }
  return best;
};

const formatCartPromotionRulesLabel = (rules) => {
  const list = normalizeCartPromotionRules(rules);
  if (!list.length) return "";
  return list
    .map((r) => {
      const pq =
        r.promo_quantity != null && r.promo_quantity > 0
          ? `, от ${fmtSomShort(r.promo_quantity)} шт`
          : "";
      return `от ${fmtSomShort(r.min_amount)} сом${pq}: −${stripTrailingZerosAfterDecimal(r.discount_percent)}%`;
    })
    .join(" · ");
};

/** Процент скидки для поля в режиме «%» (как при переключении кнопки %). */
const getSaleShiftId = (sale) => {
  if (!sale) return null;
  const shift = sale.shift;
  if (shift != null && typeof shift === "object") {
    return shift.id ?? shift.pk ?? null;
  }
  return sale.shift_id ?? shift ?? null;
};

const isShiftNotOpenApiError = (error) => {
  const text = validateResErrors(error, "").toLowerCase();
  return (
    text.includes("смен") &&
    (text.includes("не открыт") ||
      text.includes("закрыт") ||
      text.includes("not open"))
  );
};

const formatDiscountPercentFromLine = (discountSom, lineTotal) => {
  const d = parseFloat(discountSom) || 0;
  const lt = parseFloat(lineTotal) || 0;
  if (lt <= 0) return "";
  if (d <= 0) return "0";
  const pctNum = Number(((d / lt) * 100).toFixed(2));
  return stripTrailingZerosAfterDecimal(pctNum) || "0";
};

const CashierPage = () => {
  const alert = useAlert();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const store = useStore();
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
  const { currentUser, profile, userId } = useUser();
  const cashierFullName = useMemo(() => {
    const src = profile || currentUser || {};
    const fullName = String(src?.full_name || "").trim();
    if (fullName) return fullName;
    const firstName = String(src?.first_name || "").trim();
    const lastName = String(src?.last_name || "").trim();
    const name = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (name) return name;
    return String(src?.username || src?.email || "Пользователь");
  }, [profile, currentUser]);
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

  const DECIMAL_INPUT_PATTERN = /^\d*[,.]?\d*$/;

  /** Ввод дроби не завершён: ждём цифру после «.»/«,» или blur */
  const isIncompleteDecimalInput = (rawValue) => {
    const raw = String(rawValue ?? "").trim();
    if (!raw || raw === "-") return true;
    if (raw === "." || raw === ",") return true;
    if (/[.,]$/.test(raw)) return true;
    const normalized = raw.replace(",", ".");
    if (normalized === "0" || normalized === "0.") return true;
    return false;
  };

  const parseDecimalInput = (rawValue) =>
    parseFloat(String(rawValue ?? "").trim().replace(",", "."));

  /** Не синхронизируем с API, пока дробь не дописана */
  const shouldSyncQuantityToApiWhileTyping = (rawValue) => {
    if (isIncompleteDecimalInput(rawValue)) return false;
    const num = parseDecimalInput(rawValue);
    return Number.isFinite(num) && num > 0;
  };

  const shouldSyncDecimalFieldWhileTyping = (rawValue) => {
    if (isIncompleteDecimalInput(rawValue)) return false;
    const num = parseDecimalInput(rawValue);
    return Number.isFinite(num) && num >= 0;
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
        // Пустой ответ фильтра не сбрасывает уже найденную открытую смену
        // (иначе UI показывает «смена открыта», а сканер — «нет смены»).
        setOpenShiftState((prev) => (prev?.status === "open" ? prev : null));
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

      setOpenShiftState((prev) => (prev?.status === "open" ? prev : null));
      return null;
    } catch (error) {
      console.error("Ошибка при поиске открытой смены:", error);
      setOpenShiftState((prev) => (prev?.status === "open" ? prev : null));
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
  const openShiftIdRef = useRef(openShiftId);
  const preferredWholesaleModeRef = useRef(false);

  useEffect(() => {
    openShiftIdRef.current = openShiftId;
  }, [openShiftId]);
  const [preferredWholesaleMode, setPreferredWholesaleMode] = useState(() => {
    try {
      return localStorage.getItem(MARKET_CASHIER_WHOLESALE_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const isWholesaleMode =
    currentSale?.is_wholesale !== undefined && currentSale?.is_wholesale !== null
      ? Boolean(currentSale.is_wholesale)
      : Boolean(preferredWholesaleMode);

  useEffect(() => {
    preferredWholesaleModeRef.current = preferredWholesaleMode;
  }, [preferredWholesaleMode]);

  const multiCart = useMarketCashierMultiCart({
    shiftId: openShiftId,
    dispatch,
    preferredWholesaleMode,
  });
  const multiCartRef = useRef(multiCart);
  useEffect(() => {
    multiCartRef.current = multiCart;
  }, [multiCart]);

  const waitForStartSaleIdle = useCallback(
    async (maxMs = 4000) => {
      const started = Date.now();
      while (Date.now() - started < maxMs) {
        const saleState = store.getState().sale;
        if (!saleState.startSaleLoading) {
          return saleState.start ?? null;
        }
        await sleep(50);
      }
      return store.getState().sale?.start ?? null;
    },
    [store],
  );

  const getSaleIdFromUrl = useCallback(() => {
    try {
      return new URLSearchParams(window.location.search).get(
        MARKET_CASHIER_SALE_ID_PARAM,
      );
    } catch {
      return null;
    }
  }, []);

  const getSelectedSaleId = useCallback(() => {
    const saleState = store.getState().sale;
    const id =
      multiCartRef.current?.getActiveSaleId?.() ||
      saleState?.activeSaleId ||
      saleState?.start?.id ||
      getSaleIdFromUrl();
    return id ? String(id) : null;
  }, [getSaleIdFromUrl, store]);

  const getCartLineSaleId = useCallback(
    (item) => (item?.saleId ? String(item.saleId) : getSelectedSaleId()),
    [getSelectedSaleId],
  );

  const ensureActiveSaleId = useCallback(
    async (shiftId) => {
      if (!shiftId) return null;

      const urlSaleId = getSaleIdFromUrl();
      const stateSale = store.getState().sale?.start ?? null;
      const activeId = multiCartRef.current?.getActiveSaleId?.();
      const targetId =
        activeId ||
        (stateSale?.id && String(getSaleShiftId(stateSale)) === String(shiftId)
          ? stateSale.id
          : null) ||
        multiCartRef.current?.resolveTargetSaleId(urlSaleId);

      if (targetId) {
        const current = store.getState().sale?.start ?? null;
        if (
          String(current?.id) === String(targetId) &&
          String(getSaleShiftId(current)) === String(shiftId)
        ) {
          return current.id;
        }
        try {
          const loaded = await dispatch(getSale({ id: targetId })).unwrap();
          if (String(getSaleShiftId(loaded)) === String(shiftId)) return loaded.id;
        } catch {
          // создадим новую продажу ниже
        }
      }

      const readSale = () => store.getState().sale?.start ?? null;
      let sale = readSale();
      if (sale?.id && String(getSaleShiftId(sale)) === String(shiftId)) {
        return sale.id;
      }

      try {
        const result = await dispatch(
          startSale({
            discount_total: 0,
            shift: shiftId,
            is_wholesale: Boolean(preferredWholesaleModeRef.current),
          }),
        ).unwrap();
        return result?.id ?? null;
      } catch (e) {
        const msg = String(e?.message || e || "");
        if (!msg.includes("condition callback returning false")) {
          throw e;
        }

        sale = await waitForStartSaleIdle();
        if (sale?.id && String(getSaleShiftId(sale)) === String(shiftId)) {
          return sale.id;
        }

        if (store.getState().sale.startSaleLoading) {
          sale = await waitForStartSaleIdle();
          if (sale?.id && String(getSaleShiftId(sale)) === String(shiftId)) {
            return sale.id;
          }
        }

        const retry = await dispatch(
          startSale({
            discount_total: 0,
            shift: shiftId,
            is_wholesale: Boolean(preferredWholesaleModeRef.current),
          }),
        ).unwrap();
        return retry?.id ?? null;
      }
    },
    [dispatch, store, waitForStartSaleIdle, getSaleIdFromUrl],
  );

  /** Подтянуть активную корзину (GET sale) или fallback startSale */
  const refreshSaleFromStore = useCallback(
    async (shiftId) => {
      if (!shiftId) return;
      try {
        await multiCartRef.current?.refreshCartsFromStart?.({});
      } catch (e) {
        const msg = String(e?.message || e || "");
        if (!msg.includes("condition callback returning false")) {
          throw e;
        }
        await waitForStartSaleIdle();
      }
    },
    [waitForStartSaleIdle],
  );

  const handleSwitchSaleMode = useCallback(
    async (nextWholesale) => {
      try {
        if (!openShiftId) {
          showAlert("warning", "Смена не открыта", "Сначала откройте смену");
          return;
        }

        const nextMode = Boolean(nextWholesale);
        const saleId = getSelectedSaleId();
        setPreferredWholesaleMode(nextMode);
        await dispatch(
          startSale({
            ...(saleId ? { sale_id: saleId } : {}),
            shift: openShiftId,
            is_wholesale: nextMode,
          }),
        ).unwrap();
      } catch (e) {
        showAlert("error", "Ошибка", "Не удалось переключить режим продажи");
      }
    },
    [dispatch, getSelectedSaleId, openShiftId],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        MARKET_CASHIER_WHOLESALE_MODE_KEY,
        String(Boolean(preferredWholesaleMode)),
      );
    } catch {
      // ignore localStorage issues
    }
  }, [preferredWholesaleMode]);

  useEffect(() => {
    if (currentSale?.is_wholesale === undefined || currentSale?.is_wholesale === null)
      return;
    setPreferredWholesaleMode(Boolean(currentSale.is_wholesale));
  }, [currentSale?.is_wholesale]);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSaleId = searchParams.get(MARKET_CASHIER_SALE_ID_PARAM);
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    if (!urlSaleId || !openShiftId) return;
    if (String(currentSale?.id) === String(urlSaleId)) return;
    multiCart.switchToCart(urlSaleId).catch(() => {});
  }, [urlSaleId, openShiftId, currentSale?.id, multiCart.switchToCart]);

  useEffect(() => {
    if (!currentSale?.id || !openShiftId) return;
    if (searchParams.get(MARKET_CASHIER_SALE_ID_PARAM)) return;
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set(MARKET_CASHIER_SALE_ID_PARAM, String(currentSale.id));
        return p;
      },
      { replace: true },
    );
  }, [currentSale?.id, openShiftId, searchParams, setSearchParams]);

  const handleSelectCashierCart = useCallback(
    async (saleId) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set(MARKET_CASHIER_SALE_ID_PARAM, String(saleId));
          return p;
        },
        { replace: true },
      );
      await multiCart.switchToCart(saleId);
    },
    [multiCart.switchToCart, setSearchParams],
  );

  const handleNewCashierCart = useCallback(async () => {
    try {
      const newId = await multiCart.parkAndNewCart();
      if (!newId) return;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set(MARKET_CASHIER_SALE_ID_PARAM, String(newId));
          return p;
        },
        { replace: true },
      );
    } catch (e) {
      alert(validateResErrors(e, "Не удалось создать новую корзину"), true);
    }
  }, [multiCart, setSearchParams, alert]);

  const handleDeleteCashierCart = useCallback(
    async (saleId) => {
      if (!saleId) return;
      confirm("Удалить эту корзину?", async (ok) => {
        if (!ok) return;

        try {
          const deletingActiveCart =
            String(saleId) === String(currentSale?.id) ||
            String(saleId) === String(urlSaleId);
          if (deletingActiveCart) {
            setSearchParams(
              (prev) => {
                const p = new URLSearchParams(prev);
                p.delete(MARKET_CASHIER_SALE_ID_PARAM);
                return p;
              },
              { replace: true },
            );
          }
          const nextId = await multiCart.deleteCart(saleId);
          setSearchParams(
            (prev) => {
              const p = new URLSearchParams(prev);
              if (nextId) {
                p.set(MARKET_CASHIER_SALE_ID_PARAM, String(nextId));
              } else {
                p.delete(MARKET_CASHIER_SALE_ID_PARAM);
              }
              return p;
            },
            { replace: true },
          );
          showAlert("success", "Успех", "Корзина удалена");
        } catch (e) {
          showAlert(
            "error",
            "Ошибка",
            validateResErrors(e, "Не удалось удалить корзину"),
          );
        }
      });
    },
    [confirm, currentSale?.id, multiCart.deleteCart, setSearchParams, urlSaleId],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(pageFromUrl || 1);
  const debounceTimerRef = React.useRef(null);
  const [cart, setCart] = useState([]);
  const cartRef = useRef([]);
  const cartOrderRef = React.useRef([]); // Сохраняем порядок элементов корзины
  const [cartQuantities, setCartQuantities] = useState({}); // Локальные значения количества для каждого товара
  const [cartPrices, setCartPrices] = useState({}); // Локальные значения цены за единицу (unit_price)
  const [cartDiscounts, setCartDiscounts] = useState({}); // Локальные значения скидки на позицию (discount_total)
  const [cartDiscountModes, setCartDiscountModes] = useState({}); // Режим скидки по позиции: "amount" (сом) или "percent"
  const cartDiscountModesRef = useRef({});
  const lastSearchInputTime = React.useRef(0); // Время последнего ввода в поле поиска (для защиты от открытия страницы оплаты при сканировании)
  const searchInputRef = React.useRef(null); // Ref для поля поиска
  const lastScanTimeRef = React.useRef(0); // Время последнего сканирования (как в SellMainStart.jsx)
  const isScanningRef = React.useRef(false); // Флаг, указывающий что идет или недавно было сканирование
  const lastScannedBarcodeRef = React.useRef(""); // Последний отсканированный штрих-код
  const searchClearedAfterScanRef = React.useRef(false); // Флаг, что поле поиска было очищено после сканирования
  const scanKeysRef = React.useRef({ count: 0, lastTime: 0 }); // Отслеживание быстрого набора символов для детекции сканера
  const qtyInputScanGuardRef = React.useRef({ count: 0, lastTime: 0 });
  const qtyInputFocusRef = React.useRef({ itemId: null, prevValue: "" });
  const suppressQtyBlurUpdateRef = React.useRef({});
  const cartQtyInputRefs = React.useRef(new Map()); // item.id -> input
  const pendingQtyFocusRef = React.useRef(null); // { itemId?, productId?, salePackage? }
  /** Последнее значение из инпута количества, для которого запланирован debounced API */
  const pendingQtyLineInputRef = React.useRef(new Map());
  const debouncedQtyApiByLine = useDebounceByKey(500);
  const debouncedDiscountApiByLine = useDebounceByKey(500);
  const pendingDiscountLineRef = useRef(new Map());

  const cancelPendingDiscountLineInput = (lineId) => {
    if (lineId == null) return;
    const k = String(lineId);
    debouncedDiscountApiByLine.cancel(k);
    pendingDiscountLineRef.current.delete(k);
  };

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [showShiftPage, setShowShiftPage] = useState(false);
  const [showOpenShiftPage, setShowOpenShiftPage] = useState(false);
  const [showCloseShiftPage, setShowCloseShiftPage] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [showDeletionsLogModal, setShowDeletionsLogModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showHotkeyProductsModal, setShowHotkeyProductsModal] = useState(false);
  const [hotkeyProductsGroup, setHotkeyProductsGroup] = useState("");
  const [hotkeyProducts, setHotkeyProducts] = useState([]);
  const [hotkeyProductsLoading, setHotkeyProductsLoading] = useState(false);
  const [hotkeyProductsError, setHotkeyProductsError] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountMode, setDiscountMode] = useState("amount"); // "amount" | "percent"
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const requestCartQuantityFocus = useCallback((target) => {
    pendingQtyFocusRef.current = target || null;
  }, []);
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  const [mobileProductsList, setMobileProductsList] = useState(false);
  const [favoriteOverrides, setFavoriteOverrides] = useState({});
  const [favoriteLoadingMap, setFavoriteLoadingMap] = useState({});
  const hotkeyProductsRequestIdRef = React.useRef(0);

  const normalizeMgmtRole = (raw) => {
    const l = String(raw || "").trim().toLowerCase();
    if (["owner", "владелец"].includes(l)) return "owner";
    if (["admin", "administrator", "админ", "администратор"].includes(l))
      return "admin";
    return l;
  };
  const permissionsSource = profile || currentUser || {};
  const mgmtRole = normalizeMgmtRole(permissionsSource?.role);
  const isPrivilegedRole = mgmtRole === "owner" || mgmtRole === "admin";
  const canMarketDiscount =
    isPrivilegedRole || permissionsSource?.can_view_market_discount === true;
  const canMarketEditPrice =
    isPrivilegedRole || permissionsSource?.can_view_market_edit_price === true;
  const canMarketDeleteCartItem =
    isPrivilegedRole ||
    permissionsSource?.can_view_market_delete_cart_item === true;
  const [isDesktopLayout, setIsDesktopLayout] = useState(
    () => window.innerWidth > 768,
  );
  const [desktopProductsWidth, setDesktopProductsWidth] = useState(() => {
    try {
      const raw = Number(localStorage.getItem("market_cashier_products_width_pct"));
      if (Number.isFinite(raw)) return Math.min(80, Math.max(40, raw));
    } catch {
      /* ignore */
    }
    return 64;
  });
  const contentRef = React.useRef(null);
  const isResizingRef = React.useRef(false);
  const cartWidthPercent = 100 - desktopProductsWidth;
  const isCompactCart = isDesktopLayout && cartWidthPercent <= 34;
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

  const getProductFavorite = useCallback(
    (product) => {
      if (!product?.id) return false;
      if (Object.prototype.hasOwnProperty.call(favoriteOverrides, product.id)) {
        return Boolean(favoriteOverrides[product.id]);
      }
      return Boolean(product?.is_favorite);
    },
    [favoriteOverrides],
  );

  const toggleFavorite = async (product, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const productId = product?.id;
    if (!productId || favoriteLoadingMap[productId]) return;

    const current = getProductFavorite(product);
    const next = !current;
    setFavoriteLoadingMap((prev) => ({ ...prev, [productId]: true }));
    setFavoriteOverrides((prev) => ({ ...prev, [productId]: next }));

    try {
      await api.post(`/main/products/${productId}/favorite/`, {
        is_favorite: next,
      });
    } catch (error) {
      setFavoriteOverrides((prev) => ({ ...prev, [productId]: current }));
      showAlert(
        "error",
        "Ошибка",
        "Не удалось обновить избранное. Попробуйте еще раз.",
      );
    } finally {
      setFavoriteLoadingMap((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleDesktopResizeStart = (e) => {
    if (window.innerWidth <= 768) return;
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onResize = () => setIsDesktopLayout(window.innerWidth > 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!isResizingRef.current || !contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const relativeX = e.clientX - rect.left;
      const nextPct = (relativeX / rect.width) * 100;
      setDesktopProductsWidth(Math.min(80, Math.max(40, nextPct)));
    };

    const onUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(
          "market_cashier_products_width_pct",
          String(desktopProductsWidth),
        );
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [desktopProductsWidth]);

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
    if (getSelectedSaleId() && openShiftId) {
      try {
        await multiCartRef.current?.refreshActiveSale?.();
      } catch (error) {
        console.error("Ошибка при обновлении продажи:", error);
      }
    }
  }, [getSelectedSaleId, openShiftId]);

  const debouncedDiscount = useDebounce((payload) => {
    const saleId = getSelectedSaleId();
    if (!saleId || !openShiftId) return;
    dispatch(
      startSale({
        ...payload,
        sale_id: saleId,
        shift: openShiftId,
        is_wholesale: Boolean(preferredWholesaleMode),
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
      const saleId = getSelectedSaleId() || (await ensureActiveSaleId(openShiftId));
      if (!saleId) {
        showAlert(
          "error",
          "Ошибка",
          "Корзина не инициализирована. Пожалуйста, подождите...",
        );
        return;
      }
      await dispatch(
        addCustomItem({
          id: saleId,
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

  const openHotkeyProductsModal = useCallback(async (group) => {
    const normalizedGroup = normalizeHotkeyGroup(group);
    if (!normalizedGroup) return;

    const requestId = hotkeyProductsRequestIdRef.current + 1;
    hotkeyProductsRequestIdRef.current = requestId;

    setHotkeyProductsGroup(normalizedGroup);
    setShowHotkeyProductsModal(true);
    setHotkeyProducts([]);
    setHotkeyProductsError("");
    setHotkeyProductsLoading(true);

    try {
      const { data } = await api.get("/main/products/list/", {
        params: { group: normalizedGroup },
      });

      if (hotkeyProductsRequestIdRef.current !== requestId) return;
      setHotkeyProducts(normalizeCompactProductsResponse(data));
    } catch (error) {
      if (hotkeyProductsRequestIdRef.current !== requestId) return;
      console.error("Ошибка при загрузке hotkey-товаров:", error);
      setHotkeyProducts([]);
      setHotkeyProductsError("Не удалось загрузить товары для выбранной клавиши");
    } finally {
      if (hotkeyProductsRequestIdRef.current === requestId) {
        setHotkeyProductsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const handleHotkeyGroupKeydown = (event) => {
      const group = normalizeHotkeyGroup(event.key);
      if (!group) return;

      if (
        showPaymentPage ||
        showShiftPage ||
        showOpenShiftPage ||
        showCloseShiftPage ||
        showMenuModal ||
        showCustomerModal ||
        showDebtModal ||
        showDeletionsLogModal ||
        showReceiptsModal ||
        showCustomServiceModal ||
        showDiscountModal
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void openHotkeyProductsModal(group);
    };

    window.addEventListener("keydown", handleHotkeyGroupKeydown, true);
    return () =>
      window.removeEventListener("keydown", handleHotkeyGroupKeydown, true);
  }, [
    openHotkeyProductsModal,
    showCloseShiftPage,
    showCustomServiceModal,
    showCustomerModal,
    showDebtModal,
    showDeletionsLogModal,
    showReceiptsModal,
    showDiscountModal,
    showMenuModal,
    showOpenShiftPage,
    showPaymentPage,
    showShiftPage,
  ]);

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
        showDeletionsLogModal ||
        showReceiptsModal ||
        showHotkeyProductsModal ||
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

      const shiftId = openShiftIdRef.current;
      if (!shiftId) {
        showAlert(
          "warning",
          "Нет открытой смены",
          "Для работы с кассой необходимо начать смену",
        );
        isScanningRef.current = false;
        return;
      }

      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement
      ) {
        const isSearch =
          activeEl === searchInputRef.current ||
          String(activeEl.className || "").includes(
            "cashier-page__search-input",
          );
        if (!isSearch) {
          return;
        }
      }

      barcodeProcessingRef.current = true;

      try {
        const scanSaleId =
          multiCartRef.current?.getActiveSaleId?.() || getSaleIdFromUrl() || null;
        const saleId = scanSaleId || (await ensureActiveSaleId(shiftId));

        if (!saleId) {
          showAlert("error", "Ошибка", "Не удалось создать продажу");
          barcodeProcessingRef.current = false;
          return;
        }

        const res = await dispatch(
          sendBarCode({
            barcode,
            id: saleId,
            sale_id: scanSaleId,
          }),
        ).unwrap();
        if (res?.error) {
          const msg =
            typeof res.error === "string"
              ? res.error
              : "Товар с таким штрих-кодом не найден";
          showAlert("error", "Ошибка сканирования", msg);
          return;
        }

        const scanItems = res?.items ?? res?.cart?.items;
        if (Array.isArray(scanItems) && scanItems.length > 0) {
          for (let i = scanItems.length - 1; i >= 0; i--) {
            const it = scanItems[i];
            const pid = it.product ?? it.product_id;
            const p = products.find((x) => x.id === pid);
            if (p && productMatchesBarcode(p, barcode)) {
              requestCartQuantityFocus({
                itemId: it.id,
                productId: pid,
                salePackage: it.sale_package ?? null,
              });
              break;
            }
          }
        }
        // Обновляем корзину из API (как раньше — startSale после scan)
        try {
          await refreshSaleFromStore(shiftId);
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (!msg.includes("condition callback returning false")) {
            throw e;
          }
        }
        // Обновляем время последнего сканирования после успешного добавления
        // Это защитит от открытия страницы оплаты при Enter от сканера
        lastScanTimeRef.current = Date.now();
        // Убеждаемся, что флаг сканирования установлен
        isScanningRef.current = true;
      } catch (error) {
        console.error("Ошибка при сканировании:", error);
        const message = validateResErrors(
          error,
          "Не удалось добавить товар по штрих-коду",
        );
        if (isShiftNotOpenApiError(error)) {
          await findOpenShift();
          dispatch(fetchShiftsAsync());
          showAlert(
            "warning",
            "Смена недоступна",
            `${message}. Обновите смену или откройте новую.`,
          );
        } else {
          showAlert("error", "Ошибка сканирования", message);
        }
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

  useEffect(() => {
    cartDiscountModesRef.current = cartDiscountModes;
  }, [cartDiscountModes]);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

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
            saleId: currentSale.id,
            itemId: cartItemId, // ID элемента в корзине (для API: DELETE/PATCH /items/<itemId>/)
            productId: productId ?? null, // ID товара (если это товар)
            isCustom: isCustom,
            isWeight: Boolean(item.is_weight),
            salePackage,
            name: item.product_name || item.display_name || item.name || "—",
            price: price,
            quantity: qty,
            discountTotal,
            unit: item.unit || "шт",
            promotionRules: Array.isArray(item.promotion_rules)
              ? item.promotion_rules
              : [],
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
          const lineKey = String(item.id);
          const isQtyFocused =
            String(qtyInputFocusRef.current.itemId) === lineKey;
          const hasPendingQty = pendingQtyLineInputRef.current.has(lineKey);
          if (!isQtyFocused && !hasPendingQty) {
            newQuantities[item.id] = formatQuantity(item.quantity || 0);
          }
          newPrices[item.id] = formatPrice(item.price ?? 0);
        });
        setCartQuantities((prev) => ({ ...prev, ...newQuantities }));
        setCartPrices((prev) => ({ ...prev, ...newPrices }));
        // Скидки: в сомах не затираем введённое; в % после смены кол-ва/цены пересчитываем из API (discount_total / строка).
        setCartDiscounts((prev) => {
          const next = { ...prev };
          const modes = cartDiscountModesRef.current || {};
          orderedCart.forEach((item) => {
            const mode = modes[item.id] || "amount";
            const lineTotal = (item.price || 0) * (item.quantity || 0);
            if (mode === "percent") {
              next[item.id] = formatDiscountPercentFromLine(
                item.discountTotal ?? 0,
                lineTotal,
              );
            } else if (next[item.id] === undefined) {
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

  useEffect(() => {
    const pending = pendingQtyFocusRef.current;
    if (!pending || !cart.length) return;

    const targetItem =
      cart.find((item) => pending.itemId && String(item.itemId) === String(pending.itemId)) ||
      cart.find(
        (item) =>
          pending.productId &&
          String(item.productId) === String(pending.productId) &&
          String(item.salePackage ?? "") === String(pending.salePackage ?? ""),
      );

    if (!targetItem?.id) return;

    const input = cartQtyInputRefs.current.get(String(targetItem.id));
    if (!input) return;

    pendingQtyFocusRef.current = null;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }, [cart]);

  const updateCustomQuantityByDelta = async (cartItem, delta) => {
    const saleId = getCartLineSaleId(cartItem);
    if (!saleId) return;
    if (!cartItem?.itemId) return;

    debouncedQtyApiByLine.cancel(String(cartItem.id));
    pendingQtyLineInputRef.current.delete(String(cartItem.id));
    cancelPendingDiscountLineInput(cartItem.id);

    try {
      const currentQty = normalizeQuantity(cartItem.quantity);
      const newQuantity = normalizeQuantity(Math.max(0, currentQty + delta));

      if (newQuantity === 0) {
        if (!canMarketDeleteCartItem) {
          showAlert(
            "warning",
            "Нет доступа",
            "У вас нет доступа на удаление позиций из корзины",
          );
          return;
        }
        await dispatch(
          deleteProductInCart({
            id: saleId,
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
            id: saleId,
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
    const saleId = getCartLineSaleId(cartItem);
    if (!saleId) return;
    if (!cartItem?.itemId) return;
    cancelPendingDiscountLineInput(cartItem.id);

    try {
      const qtyNum = normalizeQuantity(
        Math.max(0, parseFloat(newQuantity) || 0),
      );

      if (qtyNum === 0) {
        if (!canMarketDeleteCartItem) {
          showAlert(
            "warning",
            "Нет доступа",
            "У вас нет доступа на удаление позиций из корзины",
          );
          setCartQuantities((prev) => ({
            ...prev,
            [cartItem.id]: formatQuantity(cartItem.quantity || 0),
          }));
          return;
        }
        await removeCustomFromCart(cartItem);
        return;
      }

      await dispatch(
        updateManualFilling({
          id: saleId,
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
    const saleId = getCartLineSaleId(cartItem);
    if (!saleId) return;
    if (!cartItem?.itemId) return;

    debouncedQtyApiByLine.cancel(String(cartItem.id));
    pendingQtyLineInputRef.current.delete(String(cartItem.id));
    cancelPendingDiscountLineInput(cartItem.id);

    if (!canMarketDeleteCartItem) {
      showAlert(
        "warning",
        "Нет доступа",
        "У вас нет доступа на удаление позиций из корзины",
      );
      return;
    }

    try {
      await dispatch(
        deleteProductInCart({
          id: saleId,
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
    if (cart.length === 0 || !getSelectedSaleId()) return;
    setShowPaymentPage(true);
  }, [cart.length, getSelectedSaleId]);

  // Обновляем время последнего ввода в поле поиска при каждом изменении (для защиты от открытия страницы оплаты при сканировании)
  // Это делается в onChange поля поиска, но оставляем useEffect как дополнительную защиту
  useEffect(() => {
    if (searchTerm) {
      lastSearchInputTime.current = Date.now();
    }
  }, [searchTerm]);

  // Глобальный обработчик Enter для открытия страницы оплаты (с защитой от сканера)
  useEffect(() => {
    // Если сканер начинает "печатать" в инпут количества, сначала снимаем фокус с инпута,
    // чтобы символы скана не попали в поле количества (например "10").
    const blurQtyInputBeforeScan = (e) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement)) return;
      if (!active.classList.contains("cashier-page__cart-item-quantity-input")) {
        qtyInputScanGuardRef.current.count = 0;
        return;
      }

      const key = e.key || "";
      const isChar = key.length === 1 && /^[0-9A-Za-z]$/.test(key);
      const isScanTerminator = key === "Enter" || key === "Tab";
      if (!isChar && !isScanTerminator) return;

      const now = Date.now();
      const dt = now - qtyInputScanGuardRef.current.lastTime;
      qtyInputScanGuardRef.current.lastTime = now;

      // Для ручного ввода (в т.ч. дробных значений) guard НЕ должен срабатывать.
      // Считаем сканером только очень быстрый поток символов.
      if (dt < 40) {
        qtyInputScanGuardRef.current.count += 1;
      } else {
        qtyInputScanGuardRef.current.count = 1;
      }

      // Блокируем ввод в количество только при явном паттерне сканера
      // (несколько символов подряд с очень маленьким интервалом).
      if (qtyInputScanGuardRef.current.count >= 3) {
        e.preventDefault();
        const focusedItemId = active.dataset?.cartItemId;
        if (
          focusedItemId &&
          qtyInputFocusRef.current.itemId === focusedItemId &&
          qtyInputFocusRef.current.prevValue !== ""
        ) {
          suppressQtyBlurUpdateRef.current[focusedItemId] = true;
          setCartQuantities((prev) => ({
            ...prev,
            [focusedItemId]: qtyInputFocusRef.current.prevValue,
          }));
        }
        active.blur();
        qtyInputScanGuardRef.current.count = 0;
      }
    };

    window.addEventListener("keydown", blurQtyInputBeforeScan, true);
    return () => {
      window.removeEventListener("keydown", blurQtyInputBeforeScan, true);
    };
  }, []);

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
        showDeletionsLogModal ||
        showReceiptsModal ||
        showHotkeyProductsModal ||
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
      if (cart.length > 0 && getSelectedSaleId() && e.key === "Enter") {
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
    getSelectedSaleId,
    handleCheckout,
    showMenuModal,
    showCustomerModal,
    showPaymentPage,
    showShiftPage,
    showOpenShiftPage,
    showCloseShiftPage,
    showDebtModal,
    showDeletionsLogModal,
    showReceiptsModal,
    showHotkeyProductsModal,
    showCustomServiceModal,
    showDiscountModal,
  ]);

  useEffect(() => {
    if (!openShiftId) return;
    const saleId = getSelectedSaleId();
    dispatch(
      startSale({
        ...(saleId ? { sale_id: saleId } : {}),
        discount_total: 0,
        shift: openShiftId,
        is_wholesale: Boolean(preferredWholesaleMode),
      }),
    );
  }, [dispatch, getSelectedSaleId, openShiftId, preferredWholesaleMode]);

  const addToCartWithPackage = async (product, salePackageId = null) => {
    // Для весовых товаров при остатке < 1 добавляем весь остаток.
    // Если остаток 0/минус/некорректный — подставляем 1.
    const availableQuantity = normalizeQuantity(product?.quantity);
    const qtyFromStock =
      availableQuantity > 0 && availableQuantity < 1 ? availableQuantity : 1;

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

      let saleId;
      try {
        saleId = await ensureActiveSaleId(openShiftId);
      } catch (error) {
        const message = validateResErrors(
          error,
          "Не удалось создать продажу",
        );
        showAlert("error", "Ошибка", message);
        return;
      }

      if (!saleId) {
        showAlert("error", "Ошибка", "Не удалось получить ID продажи");
        return;
      }

      // Проверяем, есть ли товар уже в корзине
      // startSale возвращает items напрямую, а не cart.items
      const saleFromStore = store.getState().sale?.start;
      const items =
        saleFromStore?.items ||
        saleFromStore?.cart?.items ||
        currentSale?.items ||
        currentSale?.cart?.items ||
        [];
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
        const currentQty = normalizeQuantity(existingItem.quantity);
        const newQuantity = normalizeQuantity(currentQty + qtyFromStock);
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: saleId,
            productId: existingItem.id,
            quantity: newQuantity,
          }),
        );
        requestCartQuantityFocus({
          itemId: existingItem.id,
          productId: product.id,
          salePackage: salePackageId ?? null,
        });
        // Обновляем продажу после успешного обновления
        // await refreshSale();
      } else {
        // Добавляем новый товар
        await dispatch(
          manualFilling({
            id: saleId,
            productId: product.id,
            quantity: normalizeQuantity(qtyFromStock),
            ...(salePackageId ? { salePackageId } : {}),
          }),
        );
        requestCartQuantityFocus({
          productId: product.id,
          salePackage: salePackageId ?? null,
        });
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
    const saleId = getCartLineSaleId(item);
    if (!saleId) return;
    if (item?.id != null) {
      debouncedQtyApiByLine.cancel(String(item.id));
      pendingQtyLineInputRef.current.delete(String(item.id));
      cancelPendingDiscountLineInput(item.id);
    }

    try {
      if (!item?.itemId || !item?.productId) return;

      // startSale возвращает items напрямую, а не cart.items
      const items = currentSale?.items || currentSale?.cart?.items || [];
      const existingItem = items.find((el) => el.id === item.itemId);

      if (!existingItem) return;

      const currentQty = normalizeQuantity(existingItem.quantity);
      const newQuantity = normalizeQuantity(Math.max(0, currentQty + delta));

      if (newQuantity === 0) {
        if (!canMarketDeleteCartItem) {
          showAlert(
            "warning",
            "Нет доступа",
            "У вас нет доступа на удаление позиций из корзины",
          );
          return;
        }
        // Удаляем товар из корзины
        await dispatch(
          deleteProductInCart({
            id: saleId,
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
            id: saleId,
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
    const saleId = getCartLineSaleId(item);
    if (!saleId) return;
    cancelPendingDiscountLineInput(item.id);

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
        if (!canMarketDeleteCartItem) {
          showAlert(
            "warning",
            "Нет доступа",
            "У вас нет доступа на удаление позиций из корзины",
          );
          setCartQuantities((prev) => ({
            ...prev,
            [item.id]: formatQuantity(item.quantity || 0),
          }));
          return;
        }
        await removeFromCart(item);
      } else {
        // Обновляем количество
        await dispatch(
          updateManualFilling({
            id: saleId,
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

  const flushPendingQuantityLine = useCallback(
    async (lineId) => {
      const idKey = String(lineId);
      const pendingRaw = pendingQtyLineInputRef.current.get(idKey);
      if (pendingRaw === undefined) return;
      if (!shouldSyncQuantityToApiWhileTyping(pendingRaw)) {
        return;
      }

      const item = cart.find((c) => String(c.id) === idKey);
      if (!item) {
        pendingQtyLineInputRef.current.delete(idKey);
        return;
      }

      const qtyNum = normalizeQuantity(
        Math.max(0, parseFloat(pendingRaw) || 0),
      );
      pendingQtyLineInputRef.current.delete(idKey);

      if (qtyNum === normalizeQuantity(item.quantity || 0)) {
        setCartQuantities((prev) => ({
          ...prev,
          [item.id]: formatQuantity(item.quantity || 0),
        }));
        return;
      }

      if (item.isCustom) {
        await updateCustomQuantityDirect(item, qtyNum);
      } else {
        await updateQuantityDirect(item, qtyNum);
      }
    },
    [cart, updateCustomQuantityDirect, updateQuantityDirect],
  );

  const removeFromCart = async (item) => {
    const saleId = getCartLineSaleId(item);
    if (!saleId) return;

    debouncedQtyApiByLine.cancel(String(item.id));
    pendingQtyLineInputRef.current.delete(String(item.id));
    cancelPendingDiscountLineInput(item.id);

    if (!canMarketDeleteCartItem) {
      showAlert(
        "warning",
        "Нет доступа",
        "У вас нет доступа на удаление позиций из корзины",
      );
      return;
    }

    try {
      if (!item?.itemId) return;
      // Удаляем товар из корзины
      await dispatch(
        deleteProductInCart({
          id: saleId,
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
    const saleId = getCartLineSaleId(item);
    if (!saleId) return;
    cancelPendingDiscountLineInput(item.id);
    if (!canMarketEditPrice) {
      showAlert("warning", "Нет доступа", "У вас нет доступа на изменение цены");
      setCartPrices((prev) => ({
        ...prev,
        [item.id]: formatPrice(item.price ?? 0),
      }));
      return;
    }
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
          id: saleId,
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
    const saleId = getCartLineSaleId(item);
    if (!saleId) return;
    if (!canMarketDiscount) {
      showAlert("warning", "Нет доступа", "У вас нет доступа на применение скидки");
      setCartDiscounts((prev) => ({
        ...prev,
        [item.id]: formatPrice(item.discountTotal ?? 0),
      }));
      return;
    }
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
          id: saleId,
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

  /** Синхронизация скидки строки с полем ввода (сом или %). */
  const applyDiscountFromRawInput = async (item, v) => {
    const mode = cartDiscountModesRef.current[item.id] || "amount";
    const num = parseFloat(v);
    const current = parseFloat(item.discountTotal ?? 0);
    const lineTotal = (item.price || 0) * (item.quantity || 0);

    if (v === "") {
      if (current !== 0) {
        await patchCartItemDiscount(item, 0, { mode, displayValue: "" });
      } else {
        setCartDiscounts((prev) => ({ ...prev, [item.id]: "" }));
      }
      return;
    }
    if (isNaN(num) || num < 0) return;

    if (mode === "percent") {
      if (lineTotal <= 0) return;
      let discountSom = (lineTotal * Math.max(0, num)) / 100;
      if (discountSom > lineTotal) discountSom = lineTotal;
      if (discountSom !== current) {
        await patchCartItemDiscount(item, discountSom, {
          mode: "percent",
          displayValue: v,
        });
      }
    } else if (num !== current) {
      await patchCartItemDiscount(item, v);
    }
  };

  const flushPendingDiscountLine = async (lineId) => {
    const key = String(lineId);
    const v = pendingDiscountLineRef.current.get(key);
    if (v === undefined) return;
    if (!shouldSyncDecimalFieldWhileTyping(v)) return;
    pendingDiscountLineRef.current.delete(key);
    const line = cartRef.current.find((c) => String(c.id) === key);
    if (!line?.itemId || !getCartLineSaleId(line)) return;
    await applyDiscountFromRawInput(line, v);
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
    } else if (action === "deletions") {
      setShowDeletionsLogModal(true);
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
          isFavorite: getProductFavorite(el),
        };
      })
      .filter((el) => !!el.quantity || el.isCart)
      .map((el, index) => ({ ...el, __orderIndex: index }))
      .sort((a, b) => {
        const favDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favDelta !== 0) return favDelta;
        return a.__orderIndex - b.__orderIndex;
      });
  }, [products, currentSale, getProductFavorite]);

  const hotkeyFilteredProducts = useMemo(() => {
    const items = currentSale?.items || [];
    const enrichedProducts = hotkeyProducts.map((product) => {
      const fallbackProduct = products.find((item) => item.id === product.id);
      return fallbackProduct
        ? {
            ...fallbackProduct,
            ...product,
            images:
              Array.isArray(product?.images) && product.images.length > 0
                ? product.images
                : Array.isArray(fallbackProduct?.images)
                  ? fallbackProduct.images
                  : [],
            packages:
              Array.isArray(product?.packages) && product.packages.length > 0
                ? product.packages
                : Array.isArray(fallbackProduct?.packages)
                  ? fallbackProduct.packages
                  : [],
          }
        : {
            ...product,
            images: Array.isArray(product?.images) ? product.images : [],
            packages: Array.isArray(product?.packages) ? product.packages : [],
          };
    });

    return enrichedProducts
      .map((mergedProduct, index) => {
        const qty = parseFloat(mergedProduct.quantity);
        const cartQty = calcTotalConsumeForProduct(
          items,
          mergedProduct.id,
          enrichedProducts,
        );
        const primaryImg = mergedProduct.images.find((item) => item.is_primary);

        return {
          ...mergedProduct,
          quantity: qty,
          isCart: !!cartQty,
          cartQty,
          img:
            mergedProduct.primary_image_url ??
            primaryImg?.image_url ??
            mergedProduct.images[0]?.image_url ??
            "/images/placeholder.avif",
          isFavorite: getProductFavorite(mergedProduct),
          __orderIndex: index,
        };
      })
      .filter((product) => !!product.quantity || product.isCart)
      .sort((a, b) => {
        const favDelta =
          Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favDelta !== 0) return favDelta;
        return a.__orderIndex - b.__orderIndex;
      });
  }, [currentSale, getProductFavorite, hotkeyProducts, products]);
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
          cartOrderRef.current = [];
          setSelectedCustomer(null);
          setDiscountValue("");
          if (openShiftId) {
            try {
              await multiCart.refreshCartsFromStart();
            } catch (e) {
              console.error("Не удалось обновить список корзин:", e);
            }
            const activeId =
              store.getState().sale?.activeSaleId ??
              store.getState().sale?.start?.id;
            if (activeId) {
              setSearchParams(
                (prev) => {
                  const p = new URLSearchParams(prev);
                  p.set(MARKET_CASHIER_SALE_ID_PARAM, String(activeId));
                  return p;
                },
                { replace: true },
              );
            }
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
                cashierFullName
              ) : (
                "Нет открытой смены"
              )}
            </p>
          </div>
        </div>
        <div className="cashier-page__header-right">
          <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
            <button
              className="cashier-page__close-shift-btn"
              style={{
                padding: "8px 10px",
                backgroundColor: !isWholesaleMode ? "#f7d617" : "#f3f4f6",
                color: !isWholesaleMode ? "#111827" : "#6b7280",
              }}
              onClick={() => handleSwitchSaleMode(false)}
            >
              Розница
            </button>
            <button
              className="cashier-page__close-shift-btn"
              style={{
                padding: "8px 10px",
                backgroundColor: isWholesaleMode ? "#f7d617" : "#f3f4f6",
                color: isWholesaleMode ? "#111827" : "#6b7280",
              }}
              onClick={() => handleSwitchSaleMode(true)}
            >
              Опт
            </button>
          </div>
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

      <div className="cashier-page__content" ref={contentRef}>
        <div
          className={`cashier-page__products ${mobileProductsList ? "active" : ""} `}
          style={
            isDesktopLayout
              ? {
                  flex: "0 0 auto",
                  width: `calc(${desktopProductsWidth}% - 12px)`,
                }
              : undefined
          }
        >
          <div className="mobile-list-btn flex w-full justify-center py-2 md:hidden!">
            <Button
              onClick={() => setMobileProductsList(false)}
              className="mx-auto"
            >
              Скрыть
            </Button>
          </div>

          {openShiftId && (
            <div className="cashier-page__carts-bar-wrap">
              <CashierCartsBar
                layout="toolbar"
                alwaysShow
                carts={multiCart.carts}
                activeSaleId={multiCart.activeSaleId}
                switching={multiCart.switching}
                onSelect={handleSelectCashierCart}
                onNewCart={handleNewCashierCart}
                onDelete={handleDeleteCashierCart}
              />
            </div>
          )}

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
                const piecePackage = getDefaultPiecePackage(product);
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
                    <button
                      type="button"
                      className={`cashier-page__product-favorite ${
                        product.isFavorite
                          ? "cashier-page__product-favorite--active"
                          : ""
                      }`}
                      onClick={(e) => toggleFavorite(product, e)}
                      disabled={Boolean(favoriteLoadingMap[product.id])}
                      title={
                        product.isFavorite
                          ? "Убрать из избранного"
                          : "Добавить в избранное"
                      }
                      aria-label={
                        product.isFavorite
                          ? "Убрать из избранного"
                          : "Добавить в избранное"
                      }
                    >
                      <Star size={16} fill="currentColor" />
                    </button>
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
                      {piecePackage && (
                        <button
                          type="button"
                          className="cashier-page__cart-item-btn cursor-pointer"
                          // style={{ marginTop: 8 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!piecePackage?.id) return;
                            addToCartWithPackage(product, piecePackage.id);
                          }}
                          title={`Добавить 1 шт из упаковки (${piecePackage.quantity_in_package} в упаковке)`}
                        >
                          +1 шт (из {piecePackage.quantity_in_package})
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
        <div
          className="cashier-page__splitter"
          onMouseDown={handleDesktopResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панелей"
        />
        <div
          className={`cashier-page__cart ${isCompactCart ? "cashier-page__cart--compact" : ""}`}
          style={
            isDesktopLayout
              ? {
                  flex: "0 0 auto",
                  width: `calc(${100 - desktopProductsWidth}% - 12px)`,
                  minWidth: 340,
                }
              : undefined
          }
        >
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
            {canMarketDiscount && (
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
            )}
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
                      <div className="cashier-page__cart-item-name-wrap">
                        <span className="cashier-page__cart-item-name">
                          {item.name}
                          {item.salePackage ? " (поштучно)" : ""}
                        </span>
                        {Array.isArray(item.promotionRules) &&
                          item.promotionRules.length > 0 && (
                            <div className="cashier-page__cart-item-promo">
                              {(() => {
                                const tier = getActiveCartPromotionTier(
                                  item.price,
                                  item.quantity,
                                  item.promotionRules,
                                );
                                const lineDisc = parseFloat(
                                  item.discountTotal ?? 0,
                                );
                                const gross =
                                  (item.price || 0) * (item.quantity || 0);
                                if (tier) {
                                  const pctLabel = stripTrailingZerosAfterDecimal(
                                    tier.discount_percent,
                                  );
                                  if (lineDisc > 0) {
                                    return (
                                      <span className="cashier-page__cart-item-promo-active">
                                        По акции: −{pctLabel}% (−
                                        {formatPrice(lineDisc)} сом)
                                      </span>
                                    );
                                  }
                                  const previewSom =
                                    (gross * tier.discount_percent) / 100;
                                  return (
                                    <span className="cashier-page__cart-item-promo-warn">
                                      По акции: −{pctLabel}% (до −
                                      {formatPrice(previewSom)} сом к строке)
                                    </span>
                                  );
                                }
                                return (
                                  <span className="cashier-page__cart-item-promo-hint">
                                    Акция:{" "}
                                    {formatCartPromotionRulesLabel(
                                      item.promotionRules,
                                    )}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                      </div>
                      <div className="cashier-page__cart-item-head-right">
                        {canMarketDiscount && (
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
                              cancelPendingDiscountLineInput(item.id);
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
                              cancelPendingDiscountLineInput(item.id);
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
                                    : stripTrailingZerosAfterDecimal(pct) ||
                                      "0";
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
                                    ? formatDiscountPercentFromLine(
                                        discountSom,
                                        lineTotal,
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
                        )}
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
                        {canMarketEditPrice ? (
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
                                DECIMAL_INPUT_PATTERN.test(v)
                              ) {
                                setCartPrices((prev) => ({
                                  ...prev,
                                  [item.id]: v,
                                }));
                              }
                            }}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              const num = parseDecimalInput(v);
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
                        ) : (
                          <input
                            type="text"
                            className="cashier-page__cart-item-price-input"
                            value={formatPrice(item.price ?? 0)}
                            readOnly
                            disabled
                          />
                        )}
                      </label>
                      {canMarketDiscount && (
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
                            if (
                              v === "" ||
                              v === "-" ||
                              DECIMAL_INPUT_PATTERN.test(v)
                            ) {
                              setCartDiscounts((prev) => ({
                                ...prev,
                                [item.id]: v,
                              }));
                              const lineKey = String(item.id);
                              pendingDiscountLineRef.current.set(lineKey, v);
                              if (shouldSyncDecimalFieldWhileTyping(v)) {
                                debouncedDiscountApiByLine.schedule(
                                  lineKey,
                                  () => {
                                    void flushPendingDiscountLine(item.id);
                                  },
                                );
                              } else {
                                debouncedDiscountApiByLine.cancel(lineKey);
                              }
                            }
                          }}
                          onBlur={async (e) => {
                            const lineKey = String(item.id);
                            debouncedDiscountApiByLine.cancel(lineKey);
                            pendingDiscountLineRef.current.delete(lineKey);
                            const line =
                              cartRef.current.find((c) => String(c.id) === lineKey) ||
                              item;
                            await applyDiscountFromRawInput(
                              line,
                              e.target.value,
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                      </label>
                      )}
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
                          ref={(node) => {
                            const key = String(item.id);
                            if (node) cartQtyInputRefs.current.set(key, node);
                            else cartQtyInputRefs.current.delete(key);
                          }}
                          type="text"
                          className="cashier-page__cart-item-quantity-input"
                          data-cart-item-id={item.id}
                          value={
                            cartQuantities[item.id] ??
                            formatQuantity(item.quantity || 0)
                          }
                          onChange={(e) => {
                            const lineKey = String(item.id);
                            cancelPendingDiscountLineInput(item.id);
                            const rawValue = e.target.value;
                            if (rawValue === "" || rawValue === "-") {
                              debouncedQtyApiByLine.cancel(lineKey);
                              pendingQtyLineInputRef.current.delete(lineKey);
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: rawValue,
                              }));
                              return;
                            }
                            if (item.isWeight) {
                              if (!DECIMAL_INPUT_PATTERN.test(rawValue)) {
                                return;
                              }
                            } else if (!/^\d+$/.test(rawValue)) {
                              return;
                            }

                            if (isIncompleteDecimalInput(rawValue)) {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: rawValue,
                              }));
                              pendingQtyLineInputRef.current.set(
                                lineKey,
                                rawValue,
                              );
                              debouncedQtyApiByLine.cancel(lineKey);
                              return;
                            }

                            const value = String(rawValue).replace(",", ".");
                            const numValue = parseFloat(value);
                            if (isNaN(numValue)) {
                              debouncedQtyApiByLine.cancel(lineKey);
                              pendingQtyLineInputRef.current.delete(lineKey);
                              return;
                            }
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
                                  const capStr = String(availableQuantity);
                                  pendingQtyLineInputRef.current.set(lineKey, capStr);
                                  debouncedQtyApiByLine.schedule(lineKey, () => {
                                    void flushPendingQuantityLine(item.id);
                                  });
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
                                  debouncedQtyApiByLine.cancel(lineKey);
                                  pendingQtyLineInputRef.current.delete(lineKey);
                                  return;
                                }
                              }
                            }
                            if (numValue < 0) {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: "0",
                              }));
                              pendingQtyLineInputRef.current.set(lineKey, "0");
                              debouncedQtyApiByLine.cancel(lineKey);
                              return;
                            }
                            setCartQuantities((prev) => ({
                              ...prev,
                              [item.id]: rawValue,
                            }));
                            pendingQtyLineInputRef.current.set(lineKey, rawValue);
                            if (shouldSyncQuantityToApiWhileTyping(rawValue)) {
                              debouncedQtyApiByLine.schedule(lineKey, () => {
                                void flushPendingQuantityLine(item.id);
                              });
                            } else {
                              debouncedQtyApiByLine.cancel(lineKey);
                            }
                          }}
                          onFocus={(e) => {
                            qtyInputFocusRef.current = {
                              itemId: String(item.id),
                              prevValue:
                                cartQuantities[item.id] ??
                                formatQuantity(item.quantity || 0),
                            };
                            e.target.select();
                          }}
                          onBlur={async (e) => {
                            const lineKey = String(item.id);
                            debouncedQtyApiByLine.cancel(lineKey);
                            pendingQtyLineInputRef.current.delete(lineKey);
                            if (suppressQtyBlurUpdateRef.current[lineKey]) {
                              delete suppressQtyBlurUpdateRef.current[lineKey];
                              qtyInputFocusRef.current = {
                                itemId: null,
                                prevValue: "",
                              };
                              return;
                            }
                            let value = e.target.value.trim();
                            if (value === "" || value === "-") {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: formatQuantity(item.quantity || 0),
                              }));
                              qtyInputFocusRef.current = {
                                itemId: null,
                                prevValue: "",
                              };
                              return;
                            }
                            if (value === "." || value === ",") {
                              setCartQuantities((prev) => ({
                                ...prev,
                                [item.id]: formatQuantity(item.quantity || 0),
                              }));
                              qtyInputFocusRef.current = {
                                itemId: null,
                                prevValue: "",
                              };
                              return;
                            }
                            if (/[.,]$/.test(value)) {
                              value = value.slice(0, -1);
                            }
                            const qtyNum = normalizeQuantity(
                              Math.max(0, parseDecimalInput(value) || 0),
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
                            qtyInputFocusRef.current = {
                              itemId: null,
                              prevValue: "",
                            };
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                          inputMode={item.isWeight ? "decimal" : "numeric"}
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
                      {canMarketDeleteCartItem && (
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
                      )}
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

      {showHotkeyProductsModal && (
        <HotkeyProductsModal
          hotkeyGroup={hotkeyProductsGroup}
          products={hotkeyFilteredProducts}
          loading={hotkeyProductsLoading}
          error={hotkeyProductsError}
          onClose={() => setShowHotkeyProductsModal(false)}
          onSelectGroup={openHotkeyProductsModal}
          onAddProduct={addToCart}
          onAddProductPiece={addToCartWithPackage}
        />
      )}

      {showDeletionsLogModal && (
        <DeletionsLogModal onClose={() => setShowDeletionsLogModal(false)} />
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
