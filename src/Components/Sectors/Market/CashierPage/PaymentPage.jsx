import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { ArrowLeft, User, X, CheckCircle } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  productCheckout,
  getProductCheckout,
  createDeal,
} from "../../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import CustomerModal from "./components/CustomerModal";
import ConsultantCommissionBlock from "./components/ConsultantCommissionBlock";
import SuccessPaymentModal from "./components/SuccessPaymentModal";
import AlertModal from "../../../common/AlertModal/AlertModal";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { validateSplitAmounts } from "../../../../../tools/marketCashierSplitPayment";
import {
  buildConsultantCheckoutFields,
  isValidCommissionPercent,
  parseCommissionPercent,
} from "../../../../../tools/marketSaleConsultant";
import {
  handleCheckoutResponseForPrinting,
  checkPrinterConnection,
  ensurePrinterConnectedInteractively,
  enrichMarketReceiptPayload,
  isOpaquePrintPayload,
  isPrintFormatError,
} from "../../../pages/Sell/services/printService";
import api from "../../../../api";
import { useMarketCashierSettings } from "../../../../hooks/useMarketCashierSettings";
import { isDebtScheduleV2 } from "../../../../tools/debtScheduleVersion";
import {
  addCalendarDaysToIso,
  calcDaysUntilIsoDate,
} from "../../../../tools/deferredPaymentDates";
import {
  DEFAULT_DAY_INTERVAL,
  DEFAULT_MONTH_INTERVAL,
  MAX_DAY_INTERVAL,
  MAX_MONTH_INTERVAL,
  buildDebtSchedule,
  defaultFirstDueDate,
  defaultIntervalForUnit,
  defaultScheduleCount,
  maxInstallmentsForUnit,
  maxIntervalForUnit,
  normalizeScheduleInterval,
  toDealInstallments,
  todayIsoDate,
} from "../../../../tools/buildDebtSchedule";
import PaymentPageDebtSection from "./components/PaymentPageDebtSection";
import "./PaymentPage.scss";

const PaymentPage = ({
  cart,
  total,
  customer,
  onBack,
  onSelectCustomer,
  onComplete,
  customers = [],
  saleId,
  sale,
}) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const { debtScheduleVersion } = useMarketCashierSettings();
  const debtIsV2 = isDebtScheduleV2(debtScheduleVersion);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState(
    total ? total.toFixed(2) : "0.00",
  );
  const [withoutCheck, setWithoutCheck] = useState(() => {
    try {
      return localStorage.getItem("market_withoutCheck") === "true";
    } catch {
      return false;
    }
  });
  const [scheduleUnit, setScheduleUnit] = useState("month");
  const [scheduleCount, setScheduleCount] = useState(
    defaultScheduleCount("month"),
  );
  const [dayInterval, setDayInterval] = useState(DEFAULT_MONTH_INTERVAL);
  const [debtDays, setDebtDays] = useState(30);
  const [deferredDueDate, setDeferredDueDate] = useState(() =>
    defaultFirstDueDate("month"),
  );
  const [deferredPrepaymentEnabled, setDeferredPrepaymentEnabled] =
    useState(false);
  const [deferredPrepaymentAmount, setDeferredPrepaymentAmount] = useState("");
  const [deferredPrepaymentMethod, setDeferredPrepaymentMethod] =
    useState("cash");
  const [deferredPrepaymentBank, setDeferredPrepaymentBank] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(customer);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [splitOnlineBank, setSplitOnlineBank] = useState("");
  const [splitOnlineAmount, setSplitOnlineAmount] = useState("");
  const [splitTransferAmount, setSplitTransferAmount] = useState("");
  const [receiptData, setReceiptData] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [successEnterBlockedUntil, setSuccessEnterBlockedUntil] = useState(0);
  const amountReceivedInputRef = useRef(null);
  const deferredDueDateInputRef = useRef(null);
  const payingInFlightRef = useRef(false);
  const acceptPaymentRef = useRef(async () => {});
  const showSuccessModalRef = useRef(false);
  const showCustomerModalRef = useRef(false);
  const alertModalOpenRef = useRef(false);
  const successEnterBlockedUntilRef = useRef(0);
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  // Консультант на продаже (опционально)
  const [consultantEnabled, setConsultantEnabled] = useState(false);
  const [consultantId, setConsultantId] = useState("");
  const [consultantCommissionEnabled, setConsultantCommissionEnabled] =
    useState(false);
  const [consultantCommissionPercent, setConsultantCommissionPercent] =
    useState("");
  const [consultantName, setConsultantName] = useState("");

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

  const paymentMethods = [
    {
      id: "cash",
      label: "Наличные",
      description: "Оплата наличными",
    },
    {
      id: "cashless",
      label: "Безналичные",
      description: "Карта / перевод",
    },
    {
      id: "deferred",
      label: "Отсрочка",
      description: "Оплата в долг",
    },
    {
      id: "split",
      label: "Смешанная",
      description: "Часть онлайн, часть наличными",
    },
  ];

  // Список банков Кыргызстана
  // Для добавления логотипа укажите путь к изображению в поле logo
  // id должен соответствовать значению, которое отправляется в checkout (mbank, optima, obank, bakai)
  const banks = [
    {
      id: "mbank",
      name: "МБанк",
      logo: "https://mbank.kg/_next/static/media/logo.6cee92d7.svg",
    },
    {
      id: "optima",
      name: "Оптима Банк",
      logo: "https://economist.kg/content/images/size/w2400/format/webp/wp-content/uploads/2020/06/banki-optima-bank-1.jpg",
    },
    {
      id: "obank",
      name: "О-Банк",
      logo: (
        <svg
          width="240"
          height="90"
          viewBox="0 0 121 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          data-v-af68376c=""
        >
          <g clip-path="url(#clip0_18_165)">
            <path
              d="M62.6301 26.3393C63.5794 26.8346 64.3222 27.5156 64.8519 28.3754C65.3884 29.2421 65.6567 30.2395 65.6567 31.3745C65.6567 33.1492 65.0308 34.6212 63.772 35.7906C62.5132 36.9669 60.9792 37.5515 59.1701 37.5515H49.8977V15.925H58.4891C60.2638 15.925 61.7565 16.496 62.9878 17.6378C64.2122 18.7797 64.8244 20.2105 64.8244 21.9164C64.8244 23.7942 64.0953 25.2663 62.6301 26.3325V26.3393ZM58.4891 19.2612H53.454V24.9498H58.4891C59.2733 24.9498 59.9337 24.6747 60.4633 24.1313C60.9999 23.5879 61.2681 22.9138 61.2681 22.109C61.2681 21.3042 60.9999 20.63 60.4633 20.0866C59.9268 19.5432 59.2664 19.2681 58.4891 19.2681V19.2612ZM59.1701 34.2154C59.9956 34.2154 60.6903 33.9196 61.2544 33.3349C61.8184 32.7502 62.1073 32.0349 62.1073 31.1888C62.1073 30.3427 61.8253 29.6273 61.2544 29.0426C60.6903 28.458 59.9956 28.1622 59.1701 28.1622H53.454V34.2154H59.1701Z"
              fill="white"
            ></path>
            <path
              d="M81.2506 22.1021H84.5867V37.5516H81.2506V35.3297C79.9918 37.0838 78.1896 37.9574 75.8439 37.9574C73.7253 37.9574 71.9094 37.1663 70.4029 35.5911C68.8965 34.0159 68.1467 32.0968 68.1467 29.8268C68.1467 27.5569 68.8965 25.6171 70.4029 24.0487C71.9094 22.4804 73.7184 21.7031 75.8439 21.7031C78.1896 21.7031 79.9918 22.5698 81.2506 24.2964V22.1021ZM72.8792 33.3624C73.8079 34.2979 74.9704 34.7657 76.3736 34.7657C77.7768 34.7657 78.9393 34.2979 79.868 33.3624C80.7966 32.427 81.2574 31.2438 81.2574 29.8268C81.2574 28.4098 80.7966 27.2267 79.868 26.2912C78.9393 25.3557 77.7768 24.8879 76.3736 24.8879C74.9704 24.8879 73.8079 25.3557 72.8792 26.2912C71.9506 27.2267 71.4898 28.4098 71.4898 29.8268C71.4898 31.2438 71.9506 32.427 72.8792 33.3624Z"
              fill="white"
            ></path>
            <path
              d="M96.8171 21.7031C98.5917 21.7031 100.023 22.2672 101.109 23.4022C102.203 24.5371 102.746 26.0917 102.746 28.0659V37.5516H99.4103V28.4029C99.4103 27.2473 99.1008 26.3669 98.4817 25.7478C97.8626 25.1287 97.0165 24.8192 95.9503 24.8192C94.7741 24.8192 93.8317 25.1837 93.1095 25.9197C92.3872 26.6558 92.0295 27.7701 92.0295 29.2696V37.5516H88.6934V22.1021H92.0295V24.0831C93.0407 22.4942 94.6365 21.7031 96.8171 21.7031Z"
              fill="white"
            ></path>
            <path
              d="M120.328 37.5515H116.339L110.004 30.4115V37.5515H106.667V15.925H110.004V28.9326L116.002 22.1021H120.081L113.285 29.6755L120.328 37.5584V37.5515Z"
              fill="white"
            ></path>
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M40.928 45.689H15.7452L17.9464 41.8713L6.72045 53.0973V45.689H0V7.7876H40.928V45.689ZM34.6409 15.9182H30.6169L31.0365 31.5809H34.2144L34.6272 15.9182H34.6409ZM30.782 37.5515H34.524V33.8096H30.782V37.5515ZM17.121 15.6568C9.90527 15.6568 6.24582 21.201 6.24582 26.7452C6.24582 32.2894 9.90527 37.8336 17.121 37.8336C24.3367 37.8336 27.9136 32.2894 27.9136 26.7452C27.9136 21.201 24.3367 15.6568 17.121 15.6568ZM17.121 19.667C12.7255 19.667 10.4693 23.2095 10.4693 26.7452C10.4693 30.2808 12.7255 33.8233 17.121 33.8233C21.5164 33.8233 23.6832 30.2808 23.6832 26.7452C23.6832 23.2095 21.5164 19.667 17.121 19.667Z"
              fill="#F0047F"
            ></path>
          </g>
          <defs>
            <clipPath id="clip0_18_165">
              <rect
                width="120.328"
                height="45.3097"
                fill="white"
                transform="translate(0 7.7876)"
              ></rect>
            </clipPath>
          </defs>
        </svg>
      ),
    },
    {
      id: "bakai",
      name: "Бакай Банк",
      logo: null,
    },
    {
      id: "demir",
      name: "Демир Банк",
      logo: "https://www.demirbank.kg/assets/logo-without-slogan-f5a092c7.svg",
    },
    { id: "other", name: "Другой банк", logo: null },
  ];

  const deferredPrepaymentValue = useMemo(() => {
    if (!deferredPrepaymentEnabled) return 0;
    const n = parseFloat(
      String(deferredPrepaymentAmount || "").replace(",", "."),
    );
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [deferredPrepaymentEnabled, deferredPrepaymentAmount]);

  const deferredSaleDebtRemaining = useMemo(
    () => Math.max(0, total - deferredPrepaymentValue),
    [total, deferredPrepaymentValue],
  );

  const customerDebt =
    selectedCustomer?.debt || selectedCustomer?.total_debt || 0;
  const totalDebt =
    paymentMethod === "deferred"
      ? deferredSaleDebtRemaining + customerDebt
      : customerDebt;

  const debtSchedule = useMemo(
    () =>
      buildDebtSchedule({
        remainingAmount: deferredSaleDebtRemaining,
        unit: scheduleUnit,
        count: typeof scheduleCount === "number" ? scheduleCount : 0,
        firstDueDate: deferredDueDate,
        intervalDays:
          typeof dayInterval === "number" ? dayInterval : DEFAULT_DAY_INTERVAL,
        intervalMonths:
          typeof dayInterval === "number"
            ? dayInterval
            : DEFAULT_MONTH_INTERVAL,
      }),
    [
      dayInterval,
      deferredDueDate,
      deferredSaleDebtRemaining,
      scheduleCount,
      scheduleUnit,
    ],
  );

  const handleScheduleUnitChange = useCallback((unit) => {
    setScheduleUnit(unit);
    setScheduleCount(defaultScheduleCount(unit));
    setDayInterval(defaultIntervalForUnit(unit));
    setDeferredDueDate(defaultFirstDueDate(unit));
  }, []);

  const handleScheduleCountChange = useCallback(
    (value) => {
      if (value === "") {
        setScheduleCount("");
        return;
      }
      const numValue = parseInt(value, 10);
      if (Number.isNaN(numValue)) return;
      const max = maxInstallmentsForUnit(scheduleUnit);
      setScheduleCount(Math.min(max, Math.max(1, numValue)));
    },
    [scheduleUnit],
  );

  const handleScheduleCountBlur = useCallback(
    (value) => {
      const numValue = parseInt(value, 10);
      const max = maxInstallmentsForUnit(scheduleUnit);
      if (Number.isNaN(numValue) || numValue < 1) {
        setScheduleCount(defaultScheduleCount(scheduleUnit));
        return;
      }
      setScheduleCount(Math.min(max, numValue));
    },
    [scheduleUnit],
  );

  const handleDayIntervalChange = useCallback(
    (value) => {
      if (value === "") {
        setDayInterval("");
        return;
      }
      const numValue = parseInt(value, 10);
      if (Number.isNaN(numValue)) return;
      setDayInterval(normalizeScheduleInterval(scheduleUnit, numValue));
    },
    [scheduleUnit],
  );

  const handleDayIntervalBlur = useCallback(
    (value) => {
      const numValue = parseInt(value, 10);
      if (Number.isNaN(numValue) || numValue < 1) {
        setDayInterval(defaultIntervalForUnit(scheduleUnit));
        return;
      }
      setDayInterval(normalizeScheduleInterval(scheduleUnit, numValue));
    },
    [scheduleUnit],
  );

  const setDebtDaysFromDate = useCallback((isoDate) => {
    if (!isoDate) return;
    setDeferredDueDate(isoDate);
    setDebtDays(calcDaysUntilIsoDate(isoDate));
  }, []);

  const setDebtDaysAndSyncDate = useCallback((days) => {
    const safeDays = Math.max(1, Number(days) || 1);
    setDebtDays(safeDays);
    setDeferredDueDate(addCalendarDaysToIso(safeDays));
  }, []);

  const openDeferredDueDatePicker = () => {
    const input = deferredDueDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  };

  const handleSelectCustomer = () => {
    setShowCustomerModal(true);
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
  };

  const handleQuickSelect = (amount) => {
    setAmountReceived(amount.toString());
  };

  // Купюры Кыргызстана: 20, 50, 100, 200, 500, 1000, 2000, 5000 сом
  const kyrgyzstanBills = [20, 50, 100, 200, 500, 1000, 2000, 5000];

  // Выбираем купюры, которые больше или равны сумме заказа, но не более 3 штук
  const quickSelectAmounts = kyrgyzstanBills
    .filter((bill) => bill >= total)
    .slice(0, 3);

  const formatSplitAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0.00";
    return Math.max(0, amount).toFixed(2);
  };

  const normalizeSplitAmountInput = (value) => {
    if (value === "") return { raw: "", amount: 0 };
    const amount = Number(value);
    if (!Number.isFinite(amount)) return { raw: "", amount: 0 };
    const maxTotal = Math.max(0, Number(total) || 0);
    const clampedAmount = Math.min(Math.max(0, amount), maxTotal);
    return {
      raw: clampedAmount === amount ? value : formatSplitAmount(clampedAmount),
      amount: clampedAmount,
    };
  };

  const handleSplitOnlineAmountChange = (value) => {
    const { raw, amount } = normalizeSplitAmountInput(value);
    const maxTotal = Math.max(0, Number(total) || 0);
    setSplitOnlineAmount(raw);
    setSplitTransferAmount(formatSplitAmount(maxTotal - amount));
  };

  const handleSplitTransferAmountChange = (value) => {
    const { raw, amount } = normalizeSplitAmountInput(value);
    const maxTotal = Math.max(0, Number(total) || 0);
    setSplitTransferAmount(raw);
    setSplitOnlineAmount(formatSplitAmount(maxTotal - amount));
  };

  const printReceiptSmart = async (payload, opts = {}) => {
    const interactiveFirst = opts.interactive === true;
    try {
      await handleCheckoutResponseForPrinting(payload, {
        interactive: interactiveFirst,
        receiptStyle: "market",
      });
      return true;
    } catch (err) {
      // Формат чека не подошёл — принтер тут ни при чём, окно выбора USB
      // не поможет: пусть вызывающий код возьмёт другой источник чека.
      if (isPrintFormatError(err)) {
        console.warn("[PaymentPage] Чек в неподходящем формате:", err);
        return false;
      }
      console.warn(
        "[PaymentPage] Печать не удалась, запрашиваем выбор USB-принтера:",
        err,
      );
      const connected = await ensurePrinterConnectedInteractively();
      if (!connected) return false;

      try {
        await handleCheckoutResponseForPrinting(payload, {
          interactive: false,
          receiptStyle: "market",
        });
        return true;
      } catch (err2) {
        console.warn("[PaymentPage] Повторная печать не удалась:", err2);
        return false;
      }
    }
  };

  const readAmountReceived = () => {
    const raw =
      amountReceivedInputRef.current?.value ??
      amountReceived ??
      String(total ?? 0);
    const n = parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const buildReceiptPrintPayload = (apiPayload, splitParts = null) => {
    // Серверный чек приходит PDF-блобом — его печатаем как есть, без обогащения.
    if (isOpaquePrintPayload(apiPayload)) return apiPayload;

    const received = readAmountReceived();
    let paidCash = 0;
    let paidCard = 0;

    if (paymentMethod === "cash") {
      paidCash = total;
    } else if (paymentMethod === "split" && splitParts) {
      paidCash = splitParts.transfer;
      paidCard = splitParts.online;
    } else if (paymentMethod === "cashless") {
      paidCard = total;
    } else if (paymentMethod === "deferred" && deferredPrepaymentValue > 0) {
      paidCash = deferredPrepaymentValue;
    }

    try {
      const enriched = enrichMarketReceiptPayload(apiPayload, {
        paymentMethod,
        total,
        amountReceived: paymentMethod === "cash" ? received : undefined,
        paidCash,
        paidCard,
        change: paymentMethod === "cash" ? Math.max(0, received - total) : 0,
      });
      if (enriched && typeof enriched === "object") {
        const nameFromApi =
          enriched.consultant?.name ||
          enriched.consultant_display ||
          enriched.consultant_name ||
          "";
        const name =
          nameFromApi ||
          (consultantEnabled && consultantName ? consultantName : "");
        if (name) {
          enriched.consultant_name = name;
          enriched.consultant = {
            ...(enriched.consultant && typeof enriched.consultant === "object"
              ? enriched.consultant
              : {}),
            id: enriched.consultant?.id || consultantId || null,
            name,
          };
        }
        if (Array.isArray(enriched.items)) return enriched;
        return enriched;
      }
    } catch (err) {
      console.warn("[PaymentPage] enrich receipt payload failed:", err);
    }
    return apiPayload;
  };

  const handleAcceptPayment = async () => {
    if (payingInFlightRef.current) return;
    payingInFlightRef.current = true;

    try {
      if (!saleId) {
        showAlert("error", "Ошибка", "Продажа не найдена");
        return;
      }

      if (consultantEnabled) {
        if (!consultantId) {
          showAlert(
            "warning",
            "Консультант",
            "Выберите консультанта или снимите галочку «Указать консультанта»",
          );
          return;
        }
        if (consultantCommissionEnabled) {
          const pct = parseCommissionPercent(consultantCommissionPercent);
          if (pct == null || !isValidCommissionPercent(pct)) {
            showAlert(
              "warning",
              "Процент консультанта",
              "Укажите процент от 0 до 100",
            );
            return;
          }
        }
      }

      // Валидация для отсрочки - требуется клиент
      if (paymentMethod === "deferred") {
        if (!selectedCustomer?.id) {
          showAlert(
            "warning",
            "Требуется клиент",
            "Для оформления отсрочки необходимо выбрать клиента",
          );
          return;
        }
        if (deferredPrepaymentEnabled) {
          if (deferredPrepaymentValue <= 0) {
            showAlert("warning", "Предоплата", "Укажите сумму предоплаты");
            return;
          }
          if (
            debtIsV2
              ? deferredPrepaymentValue >= total
              : deferredPrepaymentValue > total
          ) {
            showAlert(
              "warning",
              "Предоплата",
              debtIsV2
                ? "Предоплата должна быть меньше суммы заказа — остаток уходит в долг"
                : "Сумма предоплаты не может быть больше суммы заказа",
            );
            return;
          }
          if (
            deferredPrepaymentMethod === "cashless" &&
            !deferredPrepaymentBank
          ) {
            showAlert(
              "warning",
              "Требуется банк",
              "Выберите банк для безналичной предоплаты",
            );
            return;
          }
        }
        if (debtIsV2) {
          if (deferredSaleDebtRemaining <= 0) {
            showAlert(
              "warning",
              "Сумма долга",
              "После предоплаты должен остаться долг больше нуля",
            );
            return;
          }
          const countNum =
            typeof scheduleCount === "number"
              ? scheduleCount
              : parseInt(String(scheduleCount), 10);
          if (!Number.isFinite(countNum) || countNum < 1) {
            showAlert(
              "warning",
              "График погашения",
              scheduleUnit === "month"
                ? "Укажите число месяцев не менее 1"
                : "Укажите число платежей не менее 1",
            );
            return;
          }
          if (countNum > maxInstallmentsForUnit(scheduleUnit)) {
            showAlert(
              "warning",
              "График погашения",
              scheduleUnit === "month"
                ? `Максимум ${maxInstallmentsForUnit("month")} месяцев`
                : `Максимум ${maxInstallmentsForUnit("day")} платежей`,
            );
            return;
          }
          const intervalNum =
            typeof dayInterval === "number"
              ? dayInterval
              : parseInt(String(dayInterval), 10);
          if (!Number.isFinite(intervalNum) || intervalNum < 1) {
            showAlert(
              "warning",
              "Интервал",
              scheduleUnit === "month"
                ? "Укажите интервал не менее 1 месяца"
                : "Укажите интервал не менее 1 дня",
            );
            return;
          }
          if (intervalNum > maxIntervalForUnit(scheduleUnit)) {
            showAlert(
              "warning",
              "Интервал",
              scheduleUnit === "month"
                ? `Максимум ${MAX_MONTH_INTERVAL} месяцев между платежами`
                : `Максимум ${MAX_DAY_INTERVAL} дней между платежами`,
            );
            return;
          }
          if (!deferredDueDate || deferredDueDate < todayIsoDate()) {
            showAlert(
              "warning",
              "Дата первого платежа",
              "Дата первого платежа не может быть раньше сегодня",
            );
            return;
          }
          if (!debtSchedule) {
            showAlert(
              "warning",
              "График погашения",
              "Не удалось построить график. Проверьте срок и дату первого платежа",
            );
            return;
          }
        } else {
          const daysNum =
            typeof debtDays === "number"
              ? debtDays
              : parseInt(String(debtDays), 10);
          if (!Number.isFinite(daysNum) || daysNum < 1) {
            showAlert(
              "warning",
              "Срок рассрочки",
              "Укажите срок рассрочки не менее 1 дня",
            );
            return;
          }
        }
      }

      // Валидация для безналичных - требуется выбор банка
      if (paymentMethod === "cashless") {
        if (!selectedBank) {
          showAlert(
            "warning",
            "Требуется банк",
            "Для безналичной оплаты необходимо выбрать банк",
          );
          return;
        }
      }

      let splitParts = null;
      if (paymentMethod === "split") {
        if (!splitOnlineBank) {
          showAlert(
            "warning",
            "Требуется банк",
            "Выберите банк для онлайн-оплаты",
          );
          return;
        }
        const check = validateSplitAmounts(
          total,
          splitOnlineAmount,
          splitTransferAmount,
        );
        if (!check.ok) {
          showAlert("warning", "Смешанная оплата", check.message);
          return;
        }
        splitParts = check;
      }

      // Валидация для наличных
      if (paymentMethod === "cash") {
        const received = readAmountReceived();
        if (received < total) {
          showAlert(
            "warning",
            "Недостаточно средств",
            "Полученная сумма меньше суммы заказа!",
          );
          return;
        }
      }

      // Маппинг способов оплаты
      // payment_method может быть: cash, transfer, debt, mbank, optima, obank, bakai
      let paymentMethodApi = "cash";
      let checkoutPayments = null;
      let checkoutCashReceived = null;
      if (paymentMethod === "cashless") {
        const supportedBanks = ["mbank", "optima", "obank", "bakai"];
        if (selectedBank && supportedBanks.includes(selectedBank)) {
          paymentMethodApi = selectedBank;
        } else {
          paymentMethodApi = "transfer";
        }
      } else if (paymentMethod === "deferred") {
        paymentMethodApi = "debt";
        if (deferredPrepaymentValue > 0) {
          checkoutCashReceived = deferredPrepaymentValue.toFixed(2);
        } else {
          checkoutCashReceived = null;
        }
      } else if (paymentMethod === "split" && splitParts) {
        const supportedBanks = ["mbank", "optima", "obank", "bakai"];
        const onlineMethod =
          splitOnlineBank && supportedBanks.includes(splitOnlineBank)
            ? splitOnlineBank
            : "transfer";
        checkoutPayments = [
          ...(splitParts.online > 0
            ? [{ method: onlineMethod, amount: splitParts.online.toFixed(2) }]
            : []),
          ...(splitParts.transfer > 0
            ? [{ method: "cash", amount: splitParts.transfer.toFixed(2) }]
            : []),
        ];
        checkoutCashReceived = splitParts.transfer.toFixed(2);
      }

      // ВАЖНО: перед оплатой НЕ показываем окно выбора USB-принтера.
      // Пытаемся подключиться автоматически к ранее выбранному принтеру (если разрешение уже есть).
      // Окно выбора будет показано только если печать реально не удалась.
      // Если включено "Без чека" — не проверяем принтер, не печатаем и не показываем запросы печати.
      const shouldPrintReceipt = !withoutCheck;
      let isPrinterConnected = false;
      if (shouldPrintReceipt) {
        isPrinterConnected = await checkPrinterConnection();
        if (!isPrinterConnected) {
          isPrinterConnected = await ensurePrinterConnectedInteractively();
        }
      }

      // Выполняем checkout
      // Передаем bool: true только если принтер подключен
      const consultantFields = buildConsultantCheckoutFields({
        enabled: consultantEnabled,
        consultantId,
        commissionEnabled: consultantCommissionEnabled,
        commissionPercent: consultantCommissionPercent,
      });
      const result = await dispatch(
        productCheckout({
          id: saleId,
          bool: isPrinterConnected, // print_receipt - только если принтер подключен (или false при "Без чека")
          clientId: selectedCustomer?.id || null,
          payment_method: checkoutPayments ? null : paymentMethodApi,
          payments: checkoutPayments,
          cash_received:
            paymentMethod === "split" || paymentMethod === "deferred"
              ? checkoutCashReceived
              : paymentMethod === "cash"
                ? readAmountReceived() || total
                : null,
          ...(consultantFields || {}),
          ...(debtIsV2 && paymentMethod === "deferred" && debtSchedule
            ? {
                schedule_version: "v2",
                debt_schedule: {
                  unit: debtSchedule.unit,
                  count: debtSchedule.count,
                  interval_days:
                    debtSchedule.unit === "day"
                      ? debtSchedule.intervalDays
                      : undefined,
                  interval_months:
                    debtSchedule.unit === "month"
                      ? debtSchedule.intervalMonths
                      : undefined,
                  first_due_date: debtSchedule.firstDueDate,
                  installments: toDealInstallments(debtSchedule),
                },
              }
            : {}),
        }),
      );

      if (result.type === "products/productCheckout/fulfilled") {
        // Создаем долг при отсрочке
        if (paymentMethod === "deferred" && selectedCustomer?.id) {
          try {
            const daysAdd =
              typeof debtDays === "number" && debtDays >= 1
                ? debtDays
                : calcDaysUntilIsoDate(deferredDueDate);
            const dueDateString = debtIsV2
              ? debtSchedule?.lastDueDate || deferredDueDate || todayIsoDate()
              : deferredDueDate || addCalendarDaysToIso(daysAdd);
            const hasPrepayment =
              deferredPrepaymentValue > 0 && deferredPrepaymentValue < total;
            const debtRecordAmount = hasPrepayment
              ? deferredSaleDebtRemaining
              : total;

            // Для тарифа "Старт" создаем запись в /main/debts/
            if (company?.subscription_plan?.name === "Старт") {
              try {
                await api.post("/main/debts/", {
                  name:
                    selectedCustomer.full_name ||
                    selectedCustomer.name ||
                    "Клиент",
                  phone: selectedCustomer.phone || "",
                  due_date: dueDateString,
                  amount:
                    typeof debtRecordAmount === "number"
                      ? debtRecordAmount.toFixed(2)
                      : String(debtRecordAmount),
                });
              } catch (startDebtError) {
                console.warn(
                  "Ошибка при создании долга для тарифа Старт:",
                  startDebtError,
                );
                const errorMessage = validateResErrors(
                  startDebtError,
                  "Оплата оформлена, но не удалось создать запись о долге для тарифа Старт. ",
                );
                // Не блокируем успешную оплату, если ошибка с долгом
                showAlert("warning", "Предупреждение", errorMessage);
                return;
              }
            }

            // Создаем сделку через createDeal
            await dispatch(
              createDeal(
                debtIsV2
                  ? {
                      clientId: selectedCustomer.id,
                      title: `${hasPrepayment ? "Предоплата" : "Долг"} ${
                        selectedCustomer.full_name ||
                        selectedCustomer.name ||
                        "Клиент"
                      }`,
                      statusRu: "Долги",
                      amount: total,
                      prepayment: hasPrepayment
                        ? deferredPrepaymentValue
                        : undefined,
                      debtDays:
                        debtSchedule?.unit === "day"
                          ? debtSchedule.count
                          : undefined,
                      debtMonths:
                        debtSchedule?.unit === "month"
                          ? debtSchedule.count
                          : undefined,
                      first_due_date:
                        debtSchedule?.firstDueDate || deferredDueDate,
                      intervalDays:
                        debtSchedule?.unit === "day"
                          ? debtSchedule.intervalDays
                          : undefined,
                      intervalMonths:
                        debtSchedule?.unit === "month"
                          ? debtSchedule.intervalMonths
                          : undefined,
                      installments: toDealInstallments(debtSchedule),
                      scheduleVersion: "v2",
                    }
                  : {
                      clientId: selectedCustomer.id,
                      title: `${hasPrepayment ? "Предоплата" : "Долг"} ${
                        selectedCustomer.full_name ||
                        selectedCustomer.name ||
                        "Клиент"
                      }`,
                      statusRu: hasPrepayment ? "Предоплата" : "Долги",
                      amount: total,
                      prepayment: hasPrepayment
                        ? deferredPrepaymentValue
                        : undefined,
                      debtDays: daysAdd,
                      first_due_date: dueDateString,
                      scheduleVersion: "v1",
                    },
              ),
            ).unwrap();
          } catch (debtError) {
            console.warn("Ошибка при создании долга:", debtError);
            const errorMessage = validateResErrors(
              debtError,
              "Оплата оформлена, но не удалось создать запись о долге. ",
            );
            // Не блокируем успешную оплату, если ошибка с долгом
            showAlert("warning", "Предупреждение", errorMessage);
          }
        }

        if (
          paymentMethod === "deferred" &&
          deferredPrepaymentValue > 0 &&
          selectCashBox
        ) {
          const prepayMethodLabel =
            deferredPrepaymentMethod === "cashless"
              ? banks.find((b) => b.id === deferredPrepaymentBank)?.name ||
                "Безналичные"
              : "Наличные";
          try {
            await dispatch(
              addCashFlows({
                cashbox: selectCashBox,
                type: "income",
                name: `Предоплата (${prepayMethodLabel})`,
                amount: deferredPrepaymentValue.toFixed(2),
                source_cashbox_flow_id:
                  result.payload?.sale_id || result.payload?.id,
                source_business_operation_id: "Продажа",
                status:
                  company?.subscription_plan?.name === "Старт"
                    ? "approved"
                    : "pending",
              }),
            ).unwrap();
          } catch (cashError) {
            console.warn(
              "Ошибка при создании денежного потока предоплаты:",
              cashError,
            );
          }
        }

        // Денежные потоки (не для отсрочки без предоплаты)
        if (paymentMethod !== "deferred" && selectCashBox && total > 0) {
          const flowBase = {
            cashbox: selectCashBox,
            type: "income",
            source_cashbox_flow_id:
              result.payload?.sale_id || result.payload?.id,
            source_business_operation_id: "Продажа",
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          };
          try {
            if (paymentMethod === "split" && splitParts) {
              if (splitParts.online > 0) {
                await dispatch(
                  addCashFlows({
                    ...flowBase,
                    name: `Продажа (онлайн)`,
                    amount: splitParts.online,
                  }),
                ).unwrap();
              }
              if (splitParts.transfer > 0) {
                await dispatch(
                  addCashFlows({
                    ...flowBase,
                    name: `Продажа (наличные)`,
                    amount: splitParts.transfer,
                  }),
                ).unwrap();
              }
            } else {
              await dispatch(
                addCashFlows({
                  ...flowBase,
                  name: "Продажа",
                  amount: total,
                }),
              ).unwrap();
            }
          } catch (cashError) {
            console.warn("Ошибка при создании денежного потока:", cashError);
          }
        }

        // Сохраняем ID продажи для печати чека
        const saleIdForReceipt =
          result.payload?.sale_id || result.payload?.id || saleId;

        if (!withoutCheck) {
          // Пытаемся автоматически распечатать чек:
          // - сначала "тихо" на сохранённый/разрешённый принтер
          // - если печать не удалась — показываем окно выбора USB‑принтера и повторяем попытку
          try {
            // Важно: сначала печатаем из checkout JSON (в нем есть ekassa/ekassa_fiscal),
            // чтобы применился наш новый формат ККМ.
            if (result.payload) {
              const printPayload = buildReceiptPrintPayload(
                result.payload,
                splitParts,
              );
              let ok = await printReceiptSmart(printPayload);
              if (!ok) {
                const receiptResult = await dispatch(
                  getProductCheckout(saleIdForReceipt),
                );
                if (
                  receiptResult.type === "products/getProductCheckout/fulfilled"
                ) {
                  ok = await printReceiptSmart(
                    buildReceiptPrintPayload(receiptResult.payload, splitParts),
                  );
                }
              }
              if (!ok) {
                showAlert(
                  "warning",
                  "Печать",
                  "Не удалось распечатать чек. Оплата проведена — чек можно распечатать повторно из раздела «Чеки».",
                );
              }
            } else {
              const receiptResult = await dispatch(
                getProductCheckout(saleIdForReceipt),
              );
              if (
                receiptResult.type === "products/getProductCheckout/fulfilled"
              ) {
                const ok = await printReceiptSmart(receiptResult.payload);
                if (!ok) {
                  showAlert(
                    "warning",
                    "Печать",
                    "Не удалось распечатать чек. Оплата проведена — чек можно распечатать повторно из раздела «Чеки».",
                  );
                }
              }
            }
          } catch (receiptError) {
            // Ошибка получения чека не блокирует продажу
            console.warn("Не удалось получить чек для печати:", receiptError);
            // Не показываем ошибку пользователю, только логируем
          }
        }

        // Показываем модалку успеха с возможностью повторной печати
        successEnterBlockedUntilRef.current = Date.now() + 800;
        setSuccessEnterBlockedUntil(successEnterBlockedUntilRef.current);
        setShowSuccessModal(true);

        // Сохраняем данные для печати (на случай, если пользователь захочет распечатать позже)
        setReceiptData({
          saleId: saleIdForReceipt,
          checkoutResponse: buildReceiptPrintPayload(
            result.payload,
            splitParts,
          ),
        });

        // Сброс блока консультанта для следующей продажи
        setConsultantEnabled(false);
        setConsultantId("");
        setConsultantName("");
        setConsultantCommissionEnabled(false);
        setConsultantCommissionPercent("");
      } else {
        const errorMessage = validateResErrors(
          result.payload,
          "Ошибка при оформлении оплаты. ",
        );
        showAlert("error", "Ошибка", errorMessage);
      }
    } catch (error) {
      console.error("Ошибка при оформлении оплаты:", error);
      const errorMessage = validateResErrors(
        error,
        "Ошибка при оформлении оплаты. ",
      );
      showAlert("error", "Ошибка", errorMessage);
    } finally {
      payingInFlightRef.current = false;
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessModal(false);
    setReceiptData(null);
    onComplete();
  };

  const handlePrintReceipt = async () => {
    if (!receiptData?.saleId) {
      showAlert("error", "Ошибка", "Данные чека не найдены");
      return;
    }

    setPrinting(true);
    try {
      // Как в SellDetail: сначала checkout JSON (eKassa), иначе blob с /receipt/
      let ok = false;
      if (receiptData.checkoutResponse) {
        ok = await printReceiptSmart(receiptData.checkoutResponse, {
          interactive: true,
        });
      }
      if (!ok) {
        const receiptResult = await dispatch(
          getProductCheckout(receiptData.saleId),
        );
        if (receiptResult.type === "products/getProductCheckout/fulfilled") {
          ok = await printReceiptSmart(
            buildReceiptPrintPayload(receiptResult.payload),
            { interactive: true },
          );
        }
      }
      if (!ok) {
        showAlert(
          "error",
          "Ошибка печати",
          "Не удалось распечатать чек. Проверьте принтер и повторите.",
        );
      }
    } catch (error) {
      console.error("Ошибка при печати чека:", error);
      const errorMessage = validateResErrors(
        error,
        "Ошибка при печати чека. ",
      );
      showAlert("error", "Ошибка печати", errorMessage);
    } finally {
      setPrinting(false);
    }
  };

  // Расчет сумм по способам оплаты
  const getPaymentAmounts = () => {
    if (paymentMethod === "cash") {
      return {
        cash: total,
        cashless: 0,
        deferred: 0,
      };
    }
    if (paymentMethod === "cashless") {
      return {
        cash: 0,
        cashless: total,
        deferred: 0,
      };
    }
    if (paymentMethod === "split") {
      const online = parseFloat(splitOnlineAmount) || 0;
      const cash = parseFloat(splitTransferAmount) || 0;
      return {
        cash,
        cashless: online,
        deferred: 0,
      };
    }
    return {
      cash: deferredPrepaymentValue,
      cashless: 0,
      deferred: deferredSaleDebtRemaining,
    };
  };

  const paymentAmounts = getPaymentAmounts();

  // Загружаем кассы при монтировании
  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

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

  // Автозаполнение суммы при выборе способа оплаты и при изменении итоговой суммы
  useEffect(() => {
    if (paymentMethod === "cashless" || paymentMethod === "cash") {
      setAmountReceived(total ? total.toFixed(2) : "0.00");
    }
    if (paymentMethod === "split" && total > 0) {
      const half = (total / 2).toFixed(2);
      setSplitOnlineAmount(half);
      setSplitTransferAmount((total - parseFloat(half)).toFixed(2));
    }
    if (paymentMethod !== "cashless") {
      setSelectedBank("");
    }
  }, [paymentMethod, total]);

  useEffect(() => {
    if (!Array.isArray(cart) || cart.length === 0) return;
    if (paymentMethod === "deferred") return;
    if (showSuccessModal || showCustomerModal || alertModal.open) return;

    const input = amountReceivedInputRef.current;
    if (!input) return;

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }, [
    cart,
    paymentMethod,
    showSuccessModal,
    showCustomerModal,
    alertModal.open,
  ]);

  showSuccessModalRef.current = showSuccessModal;
  showCustomerModalRef.current = showCustomerModal;
  alertModalOpenRef.current = alertModal.open;
  acceptPaymentRef.current = handleAcceptPayment;

  // Enter: принять оплату (capture — раньше других обработчиков)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (showSuccessModalRef.current) return;
      if (showCustomerModalRef.current || alertModalOpenRef.current) return;
      if (payingInFlightRef.current) {
        e.preventDefault();
        return;
      }

      const activeElement = document.activeElement;
      const tag = activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        const cls = String(activeElement?.className || "");
        const isAmount = cls.includes("payment-page__amount-input");
        const isDebtDays = cls.includes("payment-page__debt-days-input");
        if (!isAmount && !isDebtDays) return;
      }

      e.preventDefault();
      e.stopPropagation();
      void acceptPaymentRef.current();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Расчет сдачи (только для наличных)
  const change =
    paymentMethod === "cash" && amountReceived
      ? Math.max(0, (parseFloat(amountReceived) || 0) - total)
      : 0;

  return (
    <div className="payment-page">
      <div className="payment-page__header">
        <button className="payment-page__back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="payment-page__title">Оформление оплаты</h1>
          <p className="payment-page__total">Итого: {total.toFixed(2)} сом</p>
        </div>
      </div>

      <div className="payment-page__content">
        <div className="payment-page__left">
          <div className="payment-page__section">
            <h3 className="payment-page__section-title">СПОСОБ ОПЛАТЫ</h3>
            <div className="payment-page__methods">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  className={`payment-page__method ${
                    paymentMethod === method.id
                      ? "payment-page__method--active"
                      : ""
                  }`}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <div className="payment-page__method-content">
                    <div className="payment-page__method-label">
                      {method.label}
                    </div>
                    <div className="payment-page__method-description">
                      {method.description}
                    </div>
                  </div>
                  {paymentMethod === method.id && (
                    <div className="payment-page__method-check">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="payment-page__section">
            <h3 className="payment-page__section-title">ПОКУПАТЕЛЬ</h3>
            {selectedCustomer ? (
              <div className="payment-page__customer">
                <div className="payment-page__customer-avatar">
                  <User size={24} />
                </div>
                <div className="payment-page__customer-info">
                  <div className="payment-page__customer-name">
                    {selectedCustomer.full_name || selectedCustomer.name}
                    <button
                      className="payment-page__customer-change"
                      onClick={handleSelectCustomer}
                    >
                      изменить
                    </button>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="payment-page__customer-phone">
                      {selectedCustomer.phone}
                    </div>
                  )}
                  {customerDebt > 0 && (
                    <div className="payment-page__customer-debt">
                      Текущий долг:{" "}
                      {customerDebt.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      сом
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="payment-page__select-customer-btn"
                onClick={handleSelectCustomer}
              >
                Выбрать покупателя
              </button>
            )}
          </div>

          <ConsultantCommissionBlock
            saleTotal={total}
            enabled={consultantEnabled}
            onEnabledChange={setConsultantEnabled}
            consultantId={consultantId}
            onConsultantChange={({ id, name }) => {
              setConsultantId(id || "");
              setConsultantName(name || "");
            }}
            commissionEnabled={consultantCommissionEnabled}
            onCommissionEnabledChange={setConsultantCommissionEnabled}
            commissionPercent={consultantCommissionPercent}
            onCommissionPercentChange={setConsultantCommissionPercent}
          />
        </div>

        <div className="payment-page__right">
          {/* Итоговая информация */}
          <div className="payment-page__summary">
            {(parseFloat(sale?.order_discount_total || 0) || 0) > 0 && (
              <div className="payment-page__summary-item">
                <span className="payment-page__summary-label">СКИДКА</span>
                <span className="payment-page__summary-value payment-page__summary-value--discount">
                  -{" "}
                  {parseFloat(sale?.order_discount_total || 0).toLocaleString(
                    "ru-RU",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}{" "}
                  сом
                </span>
              </div>
            )}
            {(parseFloat(sale?.tax_total || 0) || 0) > 0 && (
              <div className="payment-page__summary-item">
                <span className="payment-page__summary-label">НАЛОГ</span>
                <span className="payment-page__summary-value">
                  {parseFloat(sale?.tax_total || 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  сом
                </span>
              </div>
            )}
            <div className="payment-page__summary-item payment-page__summary-item--total">
              <span className="payment-page__summary-label">ИТОГО</span>
              <span className="payment-page__summary-value payment-page__summary-value--total">
                {total.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                сом
              </span>
            </div>
          </div>

          {paymentMethod === "cashless" && (
            <div className="payment-page__section">
              <h3 className="payment-page__section-title">ВЫБОР БАНКА</h3>
              <div className="payment-page__banks">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    className={`payment-page__bank ${
                      selectedBank === bank.id
                        ? "payment-page__bank--active"
                        : ""
                    }`}
                    onClick={() => setSelectedBank(bank.id)}
                    title={bank.name}
                  >
                    <div className="payment-page__bank-content">
                      {bank.logo ? (
                        typeof bank.logo === "string" ? (
                          <img
                            src={bank.logo}
                            alt={bank.name}
                            className="payment-page__bank-logo"
                          />
                        ) : (
                          <div className="payment-page__bank-svg">
                            {bank.logo}
                          </div>
                        )
                      ) : (
                        <div className="payment-page__bank-name">
                          {bank.name}
                        </div>
                      )}
                    </div>
                    {selectedBank === bank.id && (
                      <div className="payment-page__bank-check">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {paymentMethod === "split" && (
            <div className="payment-page__section payment-page__split">
              <h3 className="payment-page__section-title">ОНЛАЙН-ОПЛАТА</h3>
              <div className="payment-page__banks">
                {banks.map((bank) => (
                  <button
                    key={`online-${bank.id}`}
                    type="button"
                    className={`payment-page__bank ${
                      splitOnlineBank === bank.id
                        ? "payment-page__bank--active"
                        : ""
                    }`}
                    onClick={() => setSplitOnlineBank(bank.id)}
                    title={bank.name}
                  >
                    <div className="payment-page__bank-content">
                      {typeof bank.logo === "string" ? (
                        <img
                          src={bank.logo}
                          alt={bank.name}
                          className="payment-page__bank-logo"
                        />
                      ) : (
                        <div className="payment-page__bank-name">
                          {bank.name}
                        </div>
                      )}
                    </div>
                    {splitOnlineBank === bank.id && (
                      <div className="payment-page__bank-check">✓</div>
                    )}
                  </button>
                ))}
              </div>
              <label className="payment-page__split-field">
                <span>Сумма онлайн (сом)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="payment-page__amount-input"
                  value={splitOnlineAmount}
                  onChange={(e) =>
                    handleSplitOnlineAmountChange(e.target.value)
                  }
                />
              </label>
              <h3 className="payment-page__section-title">НАЛИЧНЫЕ</h3>
              <label className="payment-page__split-field">
                <span>Сумма наличными (сом)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="payment-page__amount-input"
                  value={splitTransferAmount}
                  onChange={(e) =>
                    handleSplitTransferAmountChange(e.target.value)
                  }
                />
              </label>
              <p className="payment-page__split-total">
                Итого частей:{" "}
                {(
                  (parseFloat(splitOnlineAmount) || 0) +
                  (parseFloat(splitTransferAmount) || 0)
                ).toFixed(2)}{" "}
                / {total.toFixed(2)} сом
              </p>
            </div>
          )}

          {paymentMethod === "deferred" ? (
            <PaymentPageDebtSection
              total={total}
              totalDebt={totalDebt}
              deferredPrepaymentValue={deferredPrepaymentValue}
              deferredSaleDebtRemaining={deferredSaleDebtRemaining}
              deferredPrepaymentEnabled={deferredPrepaymentEnabled}
              onDeferredPrepaymentEnabledChange={(checked) => {
                setDeferredPrepaymentEnabled(checked);
                if (!checked) {
                  setDeferredPrepaymentAmount("");
                  setDeferredPrepaymentBank("");
                }
              }}
              deferredPrepaymentAmount={deferredPrepaymentAmount}
              onDeferredPrepaymentAmountChange={setDeferredPrepaymentAmount}
              deferredPrepaymentMethod={deferredPrepaymentMethod}
              onDeferredPrepaymentMethodChange={(method) => {
                setDeferredPrepaymentMethod(method);
                if (method === "cash") setDeferredPrepaymentBank("");
              }}
              deferredPrepaymentBank={deferredPrepaymentBank}
              onSelectDeferredPrepaymentBank={setDeferredPrepaymentBank}
              banks={banks}
              version={debtIsV2 ? "v2" : "v1"}
              debtDays={debtDays}
              onDebtDaysChange={(value) => {
                if (value === "") {
                  setDebtDays("");
                  return;
                }
                const numValue = parseInt(value, 10);
                if (!Number.isNaN(numValue)) {
                  setDebtDaysAndSyncDate(numValue);
                }
              }}
              onDebtDaysBlur={(value) => {
                const parsed = parseInt(value, 10);
                if (Number.isNaN(parsed) || parsed < 1) {
                  setDebtDaysAndSyncDate(30);
                }
              }}
              onDebtDaysDateChange={setDebtDaysFromDate}
              scheduleUnit={scheduleUnit}
              onScheduleUnitChange={handleScheduleUnitChange}
              scheduleCount={scheduleCount}
              onScheduleCountChange={handleScheduleCountChange}
              onScheduleCountBlur={handleScheduleCountBlur}
              onSchedulePreset={setScheduleCount}
              dayInterval={dayInterval}
              onDayIntervalChange={handleDayIntervalChange}
              onDayIntervalBlur={handleDayIntervalBlur}
              onDayIntervalPreset={(interval) =>
                setDayInterval(
                  normalizeScheduleInterval(scheduleUnit, interval),
                )
              }
              debtSchedule={debtSchedule}
              deferredDueDate={deferredDueDate}
              deferredDueDateInputRef={deferredDueDateInputRef}
              onOpenDeferredDueDatePicker={openDeferredDueDatePicker}
              onFirstDueDateChange={setDeferredDueDate}
            />
          ) : paymentMethod === "split" ? null : (
            <div className="payment-page__amount-section">
              <h3 className="payment-page__section-title">
                ПОЛУЧЕНО ОТ ПОКУПАТЕЛЯ
              </h3>
              <div className="payment-page__amount-input-wrapper">
                <input
                  ref={amountReceivedInputRef}
                  type="text"
                  className="payment-page__amount-input"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="payment-page__quick-select">
                <div className="payment-page__quick-select-label">
                  БЫСТРЫЙ ВЫБОР
                </div>
                <div className="payment-page__quick-select-buttons">
                  {quickSelectAmounts.length > 0
                    ? quickSelectAmounts.map((amount) => (
                        <button
                          key={amount}
                          className="payment-page__quick-select-btn"
                          onClick={() => handleQuickSelect(amount)}
                        >
                          {amount.toFixed(0)}
                        </button>
                      ))
                    : // Если сумма очень большая, показываем ближайшие купюры
                      kyrgyzstanBills.slice(-3).map((amount) => (
                        <button
                          key={amount}
                          className="payment-page__quick-select-btn"
                          onClick={() => handleQuickSelect(amount)}
                        >
                          {amount.toFixed(0)}
                        </button>
                      ))}
                </div>
              </div>

              {/* Сдача */}
              {change > 0 && (
                <div className="payment-page__change">
                  <span className="payment-page__change-label">СДАЧА</span>
                  <span className="payment-page__change-value">
                    {change.toFixed(2)} сом
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="payment-page__actions">
            <label className="flex items-center gap-2" htmlFor="withoutCheck">
              Без чека
              <input
                id="withoutCheck"
                type="checkbox"
                checked={withoutCheck}
                onChange={(e) => {
                  setWithoutCheck(e.target.checked);
                  localStorage.setItem(
                    "market_withoutCheck",
                    String(e.target.checked),
                  );
                }}
              />
            </label>
            <button
              type="button"
              className="payment-page__accept-btn"
              onClick={handleAcceptPayment}
            >
              ПРИНЯТЬ ОПЛАТУ [ENTER]
            </button>
            <button className="payment-page__cancel-btn" onClick={onBack}>
              Отмена [ESC]
            </button>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelect={handleCustomerSelect}
          customers={customers}
          title="Покупатели"
          defaultTab="client"
        />
      )}

      {showSuccessModal && (
        <SuccessPaymentModal
          open={showSuccessModal}
          onClose={handleCloseSuccess}
          onPrint={handlePrintReceipt}
          printing={printing}
          total={total}
          cashAmount={paymentAmounts.cash}
          blockEnterCloseUntil={successEnterBlockedUntil}
          cashlessAmount={paymentAmounts.cashless}
          deferredAmount={paymentAmounts.deferred}
          amountReceived={parseFloat(amountReceived) || 0}
          change={change}
          saleId={receiptData?.saleId}
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

export default PaymentPage;
