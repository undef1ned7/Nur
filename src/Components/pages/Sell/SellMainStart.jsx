// src/Components/pages/Sell/SellMainStart.jsx
import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useDebounce } from "../../../hooks/useDebounce";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  doSearch,
  manualFilling,
  productCheckout,
  startSale,
  updateManualFilling,
  addCustomItem,
  createDeal,
  getProductCheckout, // будем получать PDF/JSON для печати
  deleteProductInCart,
} from "../../../store/creators/saleThunk";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { useUser } from "../../../store/slices/userSlice";
import AlertModal from "../../common/AlertModal/AlertModal";
import { useProducts } from "../../../store/slices/productSlice";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { useSale } from "../../../store/slices/saleSlice";
import useBarcodeToCart from "./useBarcodeToCart";
import { createDebt } from "./Sell";
// Импорт модулей
import {
  handleCheckoutResponseForPrinting,
  attachUsbListenersOnce,
  checkPrinterConnection,
} from "./services/printService";
import {
  toNum,
  getAvailableQtyForProduct,
  getCartQtyForProduct,
} from "./utils/productUtils";
// Импорт компонентов
import ProductSearch from "./components/ProductSearch";
import CartTable from "./components/CartTable";
import ClientModal from "./components/ClientModal";
import DebtModal from "./components/DebtModal";
import {
  PaymentChoiceModal,
  CashModal,
  ReceiptChoiceModal,
} from "./components/PaymentModals";
import DiscountModal from "./components/DiscountModal";
import CustomServiceModal from "./components/CustomServiceModal";
import { Button } from "@mui/material";

const cx = (...args) => args.filter(Boolean).join(" ");

/* ============================================================
   Компонент SellMainStart
   ============================================================ */

const SellMainStart = ({ show, setShow }) => {
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const { start, foundProduct } = useSale();
  const { list: products } = useProducts();
  const { list: clients = [] } = useClient();

  // Флаг для отслеживания недавнего сканирования (чтобы не открывать модалку при Enter от сканера)
  const lastScanTimeRef = useRef(0);
  console.log('START', start);

  // Автодобавление товара по сканеру штрих-кода
  const { error: barcodeScanError } = useBarcodeToCart(start?.id, {
    onError: (msg) =>
      setAlert({
        open: true,
        type: "error",
        message: msg || "Нет такого товара",
      }),
    onScanned: () => {
      // Запоминаем время сканирования
      lastScanTimeRef.current = Date.now();
    },
  });

  const [clientId, setClientId] = useState("");
  const [debtMonths, setDebtMonths] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });
  const [submitTried, setSubmitTried] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");

  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [showPaymentChoiceModal, setShowPaymentChoiceModal] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState("cash"); // 'cash' или 'card'
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null); // "cash" или "card"
  const [cashPaymentConfirmed, setCashPaymentConfirmed] = useState(false); // флаг подтверждения оплаты в модалке
  const [showReceiptChoiceModal, setShowReceiptChoiceModal] = useState(false);
  const [receiptWithCheck, setReceiptWithCheck] = useState(true); // true = с чеком, false = без
  const [pendingCheckout, setPendingCheckout] = useState(null); // { withReceipt, paymentType }
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [alert, setAlert] = useState({
    open: false,
    type: "success",
    message: "",
  });
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Продажа",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });

  const dispatch = useDispatch();
  const run = (thunk) => dispatch(thunk).unwrap();

  const [selectClient, setSelectClient] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(
    () => (start?.items || []).find((i) => i.id === selectedId) || null,
    [start?.items, selectedId]
  );

  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "client"
      ),
    [clients]
  );
  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId]
  );

  const [state, setState] = useState({
    phone: "",
    dueDate: "",
  });

  const [qty, setQty] = useState("");
  const [itemQuantities, setItemQuantities] = useState({});

  // Автоматическое заполнение телефона при выборе клиента в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickClient?.phone) {
      setState((prev) => ({ ...prev, phone: pickClient.phone }));
    }
  }, [clientId, pickClient, company?.subscription_plan?.name]);

  useEffect(() => {
    if (selectedItem) setQty(String(selectedItem.quantity ?? ""));
    else setQty("");
  }, [selectedItem]);

  const debouncedDiscount = useDebounce((v) => {
    if (!start || !selectedItem) return;
    dispatch(
      manualFilling({
        id: start.id,
        productId: selectedItem.id,
        discount_total: v,
        quantity: 2,
      })
    );
  }, 600);

  const onProductDiscountChange = (e) => debouncedDiscount(e.target.value);

  const onChange2 = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const debouncedDiscount1 = useDebounce((v) => {
    console.log('ASDKJNASKDKASDK', v);

    dispatch(startSale({ discount_total: v }));
  }, 600);
  const onDiscountChange = (e) => debouncedDiscount1(e.target.value);

  const debouncedQtyUpdate = useDebounce(
    async (newQty, currentSelectedItem, currentStartId) => {
      if (!currentSelectedItem || !currentStartId) return;
      let qtyNum = Math.max(0, toNum(newQty));
      const productId = currentSelectedItem.product || currentSelectedItem.id;
      const available = getAvailableQtyForProduct(productId, products);
      if (available && qtyNum > available) {
        qtyNum = available;
        setAlert({
          open: true,
          type: "error",
          message: "Введено больше доступного количества. Значение ограничено",
        });
        setQty(String(qtyNum));
      }

      try {
        await dispatch(
          updateManualFilling({
            id: currentStartId,
            productId: currentSelectedItem.id,
            quantity: qtyNum,
          })
        ).unwrap();
        onRefresh();
      } catch (error) {
        console.error("Ошибка при обновлении количества:", error);
      }
    },
    600
  );

  const currentItems = useMemo(() => start?.items || [], [start]);
  const currentSubtotal = start?.subtotal;
  const currentDiscount = start?.order_discount_total;
  const currentTotal = start?.total;
  const isEmpty = useMemo(() => !!start?.items?.length, [start?.items])

  const onRefresh = useCallback(() => {
    dispatch(startSale({ discount_total: currentDiscount }));
  }, [currentDiscount]);

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    dispatch(doSearch());
    dispatch(fetchProductsAsync());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
        setCashData((prev) => ({ ...prev, cashbox: firstCashBoxId }));
      }
    }
  }, [cashBoxes, selectCashBox]);

  // Проверка подключения принтера
  useEffect(() => {
    const checkPrinterConnectionAsync = async () => {
      const connected = await checkPrinterConnection();
      setIsPrinterConnected(connected);
    };

    // Автоподключение USB при монтировании
    attachUsbListenersOnce();

    // Проверяем при монтировании
    checkPrinterConnectionAsync();

    // Проверяем периодически (каждые 2 секунды)
    const interval = setInterval(checkPrinterConnectionAsync, 2000);

    // Слушаем события подключения/отключения USB
    const handleConnect = async () => {
      // Небольшая задержка, чтобы устройство успело подключиться
      setTimeout(checkPrinterConnectionAsync, 500);
    };
    const handleDisconnect = () => {
      setIsPrinterConnected(false);
    };

    if ("usb" in navigator) {
      navigator.usb.addEventListener("connect", handleConnect);
      navigator.usb.addEventListener("disconnect", handleDisconnect);
    }

    return () => {
      clearInterval(interval);
      if ("usb" in navigator) {
        navigator.usb.removeEventListener("connect", handleConnect);
        navigator.usb.removeEventListener("disconnect", handleDisconnect);
      }
    };
  }, []);

  // Глобальные горячие клавиши:
  // Enter — открыть модалку выбора оплаты, в модалке Enter подтверждает,
  // стрелка влево — наличные, стрелка вправо — перевод
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      const isInputLike =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        e.target.isContentEditable;

      // Не перехватываем ввод в полях и когда открыты другие модалки
      if (
        isInputLike ||
        showNewClientModal ||
        showDebtModal ||
        showCustomServiceModal ||
        showDiscountModal ||
        showCashModal
      ) {
        return;
      }

      // Обработка модалки выбора чека (с чеком / без чека)
      if (showReceiptChoiceModal) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setReceiptWithCheck(true);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setReceiptWithCheck(false);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          setPendingCheckout({
            withReceipt: receiptWithCheck,
            paymentType: paymentMethod || "card",
          });
          setShowReceiptChoiceModal(false);
          setCashPaymentConfirmed(false);
          return;
        }
      }

      // Обработка модалки выбора способа оплаты
      if (showPaymentChoiceModal) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setPaymentChoice("cash");
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setPaymentChoice("card");
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const total = Number(start?.total || 0);
          if (paymentChoice === "cash") {
            setPaymentMethod("cash");
            setCashReceived("");
            setShowPaymentChoiceModal(false);
            setShowCashModal(true);
          } else {
            setPaymentMethod("card");
            setShowPaymentChoiceModal(false);
            setReceiptWithCheck(true);
            setShowReceiptChoiceModal(true);
          }
          return;
        }
      }

      // Enter на главном экране: открываем модалку выбора способа оплаты
      // НО игнорируем Enter, если недавно было сканирование (в течение 500мс)
      if (e.key === "Enter") {
        const timeSinceLastScan = Date.now() - lastScanTimeRef.current;
        if (timeSinceLastScan < 500) {
          return;
        }
        e.preventDefault();
        if (!start?.id || !(start?.items || []).length) return;
        setPaymentChoice("cash");
        setShowPaymentChoiceModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    start?.id,
    start?.items,
    start?.total,
    showNewClientModal,
    showDebtModal,
    showCustomServiceModal,
    showDiscountModal,
    showCashModal,
    showPaymentChoiceModal,
    showReceiptChoiceModal,
    receiptWithCheck,
    paymentMethod,
    paymentChoice,
  ]);

  // Управление видимостью дропдауна на основе результатов поиска
  useEffect(() => {
    if (foundProduct && Array.isArray(foundProduct)) {
      if (foundProduct.length > 0 && searchQuery.length > 0) {
        setShowDropdown(true);
      } else if (foundProduct.length === 0 && searchQuery.length === 0) {
        setShowDropdown(false);
      }
    }
  }, [foundProduct, searchQuery]);

  const handleRowClick = (item) => {
    setSelectedId(item.id);
  };

  const incQty = async () => {
    if (!selectedItem) return;
    const productId = selectedItem.product || selectedItem.id;
    const available = getAvailableQtyForProduct(productId, products);
    const currentQty = Number(selectedItem.quantity) || 0;
    if (available && currentQty >= available) {
      setAlert({
        open: true,
        type: "error",
        message: "Нельзя добавить больше, чем есть на складе",
      });
      return;
    }
    const newQty = (toNum(qty) || 0) + 1;
    setQty(String(newQty));

    await dispatch(
      manualFilling({ id: start.id, productId: selectedItem.product })
    ).unwrap();
    onRefresh();
  };

  const decQty = async () => {
    if (!selectedItem) return;
    const next = Math.max(0, (toNum(qty) || 0) - 1);
    setQty(String(next));

    await dispatch(
      updateManualFilling({
        id: start.id,
        productId: selectedItem.id,
        quantity: next,
      })
    ).unwrap();
    onRefresh();
  };

  // Функции для работы с товарами в таблице
  const handleIncreaseQty = async (item) => {
    if (!start?.id) return;
    const productId = item.product || item.id;
    const available = getAvailableQtyForProduct(productId, products);
    const currentQty = Number(item.quantity) || 0;

    if (available && currentQty >= available) {
      setAlert({
        open: true,
        type: "error",
        message: "Нельзя добавить больше, чем есть на складе",
      });
      return;
    }

    try {
      await dispatch(
        manualFilling({ id: start.id, productId: item.product || item.id })
      ).unwrap();
      onRefresh();
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(currentQty + 1),
      }));
    } catch (error) {
      console.error("Ошибка при увеличении количества:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при увеличении количества",
      });
    }
  };

  const handleDecreaseQty = async (item) => {
    if (!start?.id) return;
    const currentQty = Number(item.quantity) || 0;
    const next = Math.max(0, currentQty - 1);

    if (next === 0) {
      await handleRemoveItem(item);
      return;
    }

    try {
      await dispatch(
        updateManualFilling({
          id: start.id,
          productId: item.id,
          quantity: next,
        })
      ).unwrap();
      onRefresh();
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(next),
      }));
    } catch (error) {
      console.error("Ошибка при уменьшении количества:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при уменьшении количества",
      });
    }
  };

  const handleRemoveItem = async (item) => {
    if (!start?.id) return;
    try {
      await dispatch(
        deleteProductInCart({
          id: start.id,
          productId: item.id,
        })
      ).unwrap();
      if (selectedId === item.id) {
        setSelectedId(null);
      }
    } catch (error) {
      console.error("Ошибка при удалении товара:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при удалении товара",
      });
    }
  };

  // Обработчик изменения количества через инпут
  const handleItemQtyChange = (item, value) => {
    setItemQuantities((prev) => ({
      ...prev,
      [item.id]: value,
    }));
  };

  // Обработчик потери фокуса инпута количества
  const handleItemQtyBlur = async (item) => {
    if (!start?.id) return;
    const inputValue = itemQuantities[item.id] || "";
    let qtyNum;

    if (inputValue === "" || inputValue === "0") {
      qtyNum = item.quantity || 0;
    } else {
      qtyNum = Math.max(0, toNum(inputValue));
    }

    const productId = item.product || item.id;
    const available = getAvailableQtyForProduct(productId, products);
    if (available && qtyNum > available) {
      qtyNum = available;
      setAlert({
        open: true,
        type: "error",
        message: "Нельзя установить количество больше остатка",
      });
    }

    setItemQuantities((prev) => ({
      ...prev,
      [item.id]: String(qtyNum),
    }));

    if (qtyNum === 0) {
      await handleRemoveItem(item);
      return;
    }

    try {
      await dispatch(
        updateManualFilling({
          id: start.id,
          productId: item.id,
          quantity: qtyNum,
        })
      ).unwrap();
      onRefresh();
    } catch (error) {
      console.error("Ошибка при обновлении количества:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при обновлении количества",
      });
    }
  };



  // Инициализация локальных значений количества для элементов таблицы
  useEffect(() => {
    const items = start?.items || [];
    const quantities = {};
    items.forEach((item) => {
      quantities[item.id] = String(item.quantity ?? "");
    });
    setItemQuantities(quantities);
  }, [start?.items]);

  const handleAddCustomService = async () => {
    try {
      if (!customService.name.trim()) {
        setAlert({
          open: true,
          type: "error",
          message: "Введите название услуги",
        });
        return;
      }
      if (!customService.price.trim() || Number(customService.price) <= 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Введите корректную цену услуги",
        });
        return;
      }
      if (!start?.id) {
        setAlert({
          open: true,
          type: "error",
          message: "Корзина не инициализирована. Пожалуйста, подождите...",
        });
        return;
      }
      await dispatch(
        addCustomItem({
          id: start.id,
          name: customService.name.trim(),
          price: customService.price.trim(),
          quantity: Number(customService.quantity) || 1,
        })
      ).unwrap();
      onRefresh();
      setCustomService({ name: "", price: "", quantity: "1" });
      setShowCustomServiceModal(false);
      setAlert({
        open: true,
        type: "success",
        message: "Дополнительная услуга успешно добавлена!",
      });
    } catch (error) {
      console.error("Ошибка при добавлении дополнительной услуги:", error);
      setAlert({
        open: true,
        type: "error",
        message:
          error?.data?.detail ||
          error?.message ||
          "Ошибка при добавлении дополнительной услуги",
      });
    }
  };

  // === Helper: валидация срока долга (месяцы + дата) ===
  const validateDebtTerm = () => {
    if (debt === "Долги" || debt === "Предоплата") {
      if (!debtMonths || Number(debtMonths) <= 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Введите корректный срок долга (в месяцах)",
        });
        return false;
      }
      if (!state.dueDate) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите дату первого платежа",
        });
        return false;
      }
    }
    return true;
  };

  // Обработка оплаты наличными
  const handleCashPayment = async () => {
    // Нормализуем значение: заменяем запятую на точку
    const normalizedReceived = String(cashReceived).replace(/,/g, ".");
    const normalizedTotal = String(currentTotal).replace(/,/g, ".");
    const received = parseFloat(normalizedReceived) || 0;
    const total = parseFloat(normalizedTotal) || 0;

    if (!received || received <= 0) {
      setAlert({
        open: true,
        type: "error",
        message: "Введите сумму, полученную от покупателя",
      });
      return;
    }

    if (received < total) {
      setAlert({
        open: true,
        type: "error",
        message: `Недостаточно средств. К оплате: ${total.toFixed(2)} сом`,
      });
      return;
    }

    setPaymentMethod("cash");
    setCashPaymentConfirmed(true);
    setShowCashModal(false);
    setReceiptWithCheck(true);
    setShowReceiptChoiceModal(true);
  };

  // Ключевая функция: checkout + ПЕЧАТЬ
  const performCheckout = async (withReceipt, paymentType = null) => {
    const finalPaymentType = paymentType || paymentMethod || "card";
    try {
      if (!cashData.cashbox) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите кассу для проведения операции",
        });
        return;
      }

      if (debt === "Долги") {
        if (!clientId) {
          setAlert({
            open: true,
            type: "error",
            message: "Выберите клиента",
          });
          return;
        }

        if (company.subscription_plan.name === "Старт") {
          if (!state.phone) {
            setAlert({
              open: true,
              type: "error",
              message: "Введите номер телефона",
            });
            return;
          }
        }
      }

      const itemsToCheck = start?.items;
      if (itemsToCheck?.length === 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Добавьте товар для проведения операции",
        });
        return;
      }
      if (debt && !clientId) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите клиента для долговой операции",
        });
        return;
      }
      if (debt === "Предоплата") {
        if (!amount || Number(amount) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректную сумму предоплаты",
          });
          return;
        }
        const totalToCheck = start?.total;
        if (Number(amount) > Number(totalToCheck)) {
          setAlert({
            open: true,
            type: "error",
            message: "Сумма предоплаты не может превышать общую сумму",
          });
          return;
        }
        if (!validateDebtTerm()) return;
      }
      if (debt === "Долги") {
        if (!validateDebtTerm()) return;
      }

      // Стартовый тариф: создаём запись в /main/debts/
      if (debt === "Долги" && company.subscription_plan.name === "Старт") {
        await createDebt({
          name: pickClient?.full_name,
          phone: state.phone,
          due_date: state.dueDate,
          amount: start?.total,
        });
      }

      if (clientId) {
        const totalForDeal = start?.total;
        const dealPayload = {
          clientId: clientId,
          title: `${debt || "Продажа"} ${pickClient?.full_name}`,
          statusRu: debt,
          amount: totalForDeal,
        };

        if (debt === "Предоплата") {
          dealPayload.prepayment = Number(amount);
        }

        if (debt === "Долги" || debt === "Предоплата") {
          dealPayload.debtMonths = Number(debtMonths || 0);
          dealPayload.first_due_date = state.dueDate; // <-- Дата платежа
        }

        await dispatch(createDeal(dealPayload)).unwrap();
      }

      if (finalPaymentType === "cash") {
        // Нормализуем значение: заменяем запятую на точку
        const normalizedReceived = String(cashReceived).replace(/,/g, ".");
        const normalizedTotal = String(currentTotal).replace(/,/g, ".");
        const received = parseFloat(normalizedReceived) || 0;
        const total = parseFloat(normalizedTotal) || 0;

        if (!cashReceived || received <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите сумму, полученную от покупателя",
          });
          return;
        }
        if (received < total) {
          setAlert({
            open: true,
            type: "error",
            message: `Недостаточно средств. К оплате: ${total.toFixed(2)} сом`,
          });
          return;
        }
      }

      const checkoutParams = {
        id: start?.id,
        bool: withReceipt,
        clientId: clientId,
      };

      if (finalPaymentType === "cash") {
        checkoutParams.payment_method = "cash";
        // Нормализуем значение: заменяем запятую на точку
        const normalizedReceived = String(cashReceived).replace(/,/g, ".");
        checkoutParams.cash_received = parseFloat(
          normalizedReceived || 0
        ).toFixed(2);
      } else if (finalPaymentType === "card") {
        checkoutParams.payment_method = "transfer";
      }

      const result = await run(productCheckout(checkoutParams));

      const amountForCash = debt === "Предоплата" ? amount : start.total;
      if (debt !== "Долги") {
        await run(
          addCashFlows({
            ...cashData,
            name: cashData.name === "" ? "Продажа" : cashData.name,
            amount: amountForCash,
            source_cashbox_flow_id: result?.sale_id,
            type: finalPaymentType === "cash" ? "income" : "income",
          })
        );
      }

      if (withReceipt && result?.sale_id) {
        try {
          const resp = await run(getProductCheckout(result.sale_id));
          await handleCheckoutResponseForPrinting(resp);
        } catch (e) {
          console.error("Печать чека не удалась:", e);
          setAlert({
            open: true,
            type: "error",
            message:
              "Не удалось распечатать чек. Проверьте WinUSB и формат ответа (JSON/PDF).",
          });
        }
      }

      setAlert({
        open: true,
        type: "success",
        message: "Операция успешно выполнена!",
      });
      console.log('JKASHDKJAHSKDHASJDHKSA', 123123);

      setPaymentMethod(null);
      setCashReceived("");
      setCashPaymentConfirmed(false);
      onRefresh()
    } catch (e) {
      setAlert({
        open: true,
        type: "error",
        message: `Что то пошло не так.\n\n${e?.data?.detail
          ?.replace("у агента:", "товара")
          ?.replace("Нужно 2, доступно 0.", "") ||
          e?.message ||
          ""
          }`,
      });
    }
  };

  // Подтверждение выбора способа оплаты из модалки (клавиатура/Enter)
  const handleConfirmPaymentChoice = async () => {
    if (!start?.id || !(start?.items || []).length) return;
    const total = Number(currentTotal || 0);

    try {
      if (paymentChoice === "cash") {
        setPaymentMethod("cash");
        setCashReceived("");
        setShowPaymentChoiceModal(false);
        setShowCashModal(true);
      } else {
        setPaymentMethod("card");
        setShowPaymentChoiceModal(false);
        setReceiptWithCheck(true);
        setShowReceiptChoiceModal(true);
      }
    } catch (error) {
      console.error("Ошибка при подтверждении оплаты:", error);
    }
  };

  // Обработка отложенного вызова performCheckout
  useEffect(() => {
    if (pendingCheckout) {
      performCheckout(pendingCheckout.withReceipt, pendingCheckout.paymentType);
      setPendingCheckout(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCheckout]);

  // Обработка сохранения долга из модалки (кнопка "Сохранить" в DebtModal)
  const handleSaveDebt = async () => {
    try {
      if (!clientId) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите клиента",
        });
        return;
      }

      if (!debt) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите тип оплаты",
        });
        return;
      }

      if (!validateDebtTerm()) return;

      if (debt === "Долги") {
        if (company?.subscription_plan?.name === "Старт") {
          if (!state.phone) {
            setAlert({
              open: true,
              type: "error",
              message: "Введите номер телефона",
            });
            return;
          }

          // Создаём отдельный "долг" в /main/debts/
          await createDebt({
            name: pickClient?.full_name,
            phone: state.phone,
            due_date: state.dueDate,
            amount: start?.total,
          });
        }

        if (clientId) {
          const totalForDeal = start?.total;
          const dealPayload = {
            clientId: clientId,
            title: `Долг ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalForDeal,
            debtMonths: Number(debtMonths || 0),
            first_due_date: state.dueDate,
          };

          await dispatch(createDeal(dealPayload)).unwrap();
        }
      } else if (debt === "Предоплата") {
        if (!amount || Number(amount) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректную сумму предоплаты",
          });
          return;
        }

        const totalToCheck = start?.total;
        if (Number(amount) > Number(totalToCheck)) {
          setAlert({
            open: true,
            type: "error",
            message: "Сумма предоплаты не может превышать общую сумму",
          });
          return;
        }

        if (clientId) {
          const totalForDeal = start?.total;
          const dealPayload = {
            clientId: clientId,
            title: `Предоплата ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalForDeal,
            prepayment: Number(amount),
            debtMonths: Number(debtMonths || 0),
            first_due_date: state.dueDate,
          };

          await dispatch(createDeal(dealPayload)).unwrap();
        }
      }

      setAlert({
        open: true,
        type: "success",
        message:
          debt === "Долги"
            ? "Долг успешно создан!"
            : "Предоплата успешно сохранена!",
      });

      setShowDebtModal(false);
      onRefresh()
    } catch (error) {
      console.error("Ошибка при сохранении долга:", error);
      setAlert({
        open: true,
        type: "error",
        message:
          error?.data?.prepayment ||
          error?.message ||
          error?.data?.detail ||
          "Ошибка при сохранении долга",
      });
    }
  };

  return (
    <section className="sell start">
      <div className="sell__header">
        <div className="sell__header-left">
          <Button color="warning" variant="contained" className="mr-auto flex gap-4" onClick={() => setShow(false)}>
            <ArrowBackIcon />
            <p>Назад</p>
          </Button>
          <ProductSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showDropdown={showDropdown}
            setShowDropdown={setShowDropdown}
            foundProduct={foundProduct}
            start={start}
            products={products}
            setAlert={setAlert}
            dispatch={dispatch}
          />

          <select
            onChange={(e) => {
              setClientId(e.target.value);
              setSelectClient(e.target.value);
            }}
            value={clientId}
            className="sell__header-input"
          >
            <option value="">Выберите клиента</option>
            {filterClient.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>

          <button
            className="sell__header-plus"
            onClick={() => setShowNewClientModal(true)}
          >
            <span>
              {/* плюс */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 11H13V5C13 4.73478 12.8946 4.48043 12.7071 4.29289C12.5196 4.10536 12.2652 4 12 4C11.7348 4 11.4804 4.10536 11.2929 4.29289C11.1054 4.48043 11 4.73478 11 5V11H5C4.73478 11 4.4804 11.1054 4.29289 11.2929C4.10536 11.4804 4 11.7348 4 12C4 12.2652 4.10536 12.5196 4.29289 12.7071C4.4804 12.8946 4.73478 13 5 13H11V19C11 19.2652 11.1054 19.5196 11.2929 19.7071C11.4804 19.8946 11.7348 20 12 20C12.2652 20 12.5196 19.8946 12.7071 19.7071C12.8946 19.5196 13 19.2652 13 19V13H19C19.2652 13 19.5196 12.8946 19.7071 12.7071C19.8946 12.5196 20 12.2652 20 12C20 11.7348 19.8946 11.4804 19.7071 11.2929C19.5196 11.1054 19.2652 11 19 11Z"
                  fill="#CCCCCC"
                />
              </svg>
            </span>
          </button>
        </div>

        <div className="sell__header-left"></div>
      </div>

      <div className="block gap-4 xl:flex justify-between ">
        <div className="w-full xl:w-[66%] start__body-column">
          <div className="start__body-column">
            {/* <div className="sell__body-header">
              <h2 className="start__body-title">
                {selectedItem?.product_name}
              </h2>

              <div className="start__actions">
                <div className="start__actions-left">
                  <input
                    type="text"
                    className="start__actions-input"
                    value={
                      selectedItem?.unit_price * selectedItem?.quantity || ""
                    }
                    readOnly
                  />

                  <div className="start__actions-row">
                    <button
                      className="start__actions-btn"
                      onClick={incQty}
                      disabled={!selectedItem}
                      title="Увеличить количество"
                    >
                      <Plus />
                    </button>

                    <input
                      style={{ width: 100 }}
                      type="text"
                      min={0}
                      className="start__actions-input"
                      value={qty}
                      placeholder="Кол-во"
                      onChange={(e) => {
                        const newQty = e.target.value;
                        setQty(newQty);
                        if (selectedItem && newQty !== "" && start?.id) {
                          debouncedQtyUpdate(newQty, selectedItem, start.id);
                        }
                      }}
                      onBlur={(e) => {
                        if (selectedItem && start?.id) {
                          const inputValue = e.target.value;
                          let qtyNum;

                          if (inputValue === "" || inputValue === "0") {
                            qtyNum = selectedItem.quantity || 0;
                          } else {
                            qtyNum = Math.max(0, toNum(inputValue));
                          }

                          const productId =
                            selectedItem.product || selectedItem.id;
                          const available = getAvailableQtyForProduct(
                            productId,
                            products
                          );
                          if (available && qtyNum > available) {
                            qtyNum = available;
                            setAlert({
                              open: true,
                              type: "error",
                              message:
                                "Нельзя установить количество больше остатка",
                            });
                          }

                          setQty(String(qtyNum));

                          dispatch(
                            updateManualFilling({
                              id: start.id,
                              productId: selectedItem.id,
                              quantity: qtyNum,
                            })
                          )
                            .unwrap()
                            .then(() => onRefresh());
                        }
                      }}
                      disabled={!selectedItem}
                    />

                    <button
                      className="start__actions-btn"
                      onClick={decQty}
                      disabled={!selectedItem}
                      title="Уменьшить количество"
                    >
                      <Minus />
                    </button>
                  </div>

                  <input
                    type="text"
                    className="start__actions-input"
                    placeholder="Скидка на позицию"
                    onChange={onProductDiscountChange}
                    disabled={!selectedItem}
                  />
                </div>

                <input
                  type="text"
                  className="start__actions-input"
                  placeholder="Общ скидка"
                  onChange={onDiscountChange}
                />
              </div>
            </div> */}
            <CartTable
              items={currentItems}
              selectedId={selectedId}
              onRowClick={handleRowClick}
              itemQuantities={itemQuantities}
              onQtyChange={handleItemQtyChange}
              onQtyBlur={handleItemQtyBlur}
              onIncreaseQty={handleIncreaseQty}
              onDecreaseQty={handleDecreaseQty}
              onRemoveItem={handleRemoveItem}
            />
          </div>

          <div className="start__products">
            <button
              className="start__products-add orange"
              onClick={() => setShowCustomServiceModal(true)}
              title="Добавить дополнительную услугу"
            >
              Доп. услуги
            </button>

            {products?.map((product) => (
              <button
                key={product.id || product.name}
                className={cx(
                  "start__products-add",
                  selectedItem?.product_name == product.name && "active"
                )}
                onClick={async () => {
                  const available = getAvailableQtyForProduct(
                    product,
                    products
                  );
                  const pid = product.id || product.product;
                  const inCart = getCartQtyForProduct(pid, start?.items);
                  if (available <= 0 || inCart >= available) {
                    setAlert({
                      open: true,
                      type: "error",
                      message:
                        available > 0
                          ? `Нельзя добавить больше, чем есть на складе (доступно: ${available})`
                          : "Товара нет в наличии",
                    });
                    return;
                  }
                  await dispatch(
                    manualFilling({
                      id: start.id,
                      productId: product.id,
                    })
                  ).unwrap();
                  dispatch(startSale());
                }}
                title="Добавить 1 шт"
              >
                {product.name}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full! xl:w-[33%]!">
          <div className="start__total">
            <div className="start__total-top">
              <div className="start__total-row">
                <b>Без скидок</b>
                <p>{currentSubtotal}</p>
              </div>
              <div
                className="start__total-row"
                style={{ position: "relative" }}
              >
                <b>Скидка</b>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <p>{currentDiscount || 0}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountValue(currentDiscount || "");
                      setShowDiscountModal(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#007bff",
                      fontSize: "14px",
                    }}
                    title="Изменить скидку"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
              <div className="start__total-row">
                <b>ИТОГО</b>
                <h4>{currentTotal}</h4>
              </div>
            </div>

            <div className="start__total-bottom">
              <button
                disabled={!start?.id || !isEmpty}
                className="start__total-debt text-white disabled:bg-gray-300!"
                onClick={() => setShowDebtModal(true)}
              >
                Долг
              </button>

              <div className="start__total-row1">
                <button
                  className={`start__total-pay disabled:bg-gray-300! ${paymentMethod === "cash" ? "active" : ""
                    }`}
                  onClick={() => {
                    if (paymentMethod === "cash") {
                      setPaymentMethod(null);
                      setCashReceived("");
                      setCashPaymentConfirmed(false);
                    } else {
                      setShowCashModal(true);
                    }
                  }}
                  disabled={!start?.id || !isEmpty}
                  style={{
                    backgroundColor:
                      paymentMethod === "cash" ? "#f7d617" : undefined,
                    border:
                      paymentMethod === "cash" ? "2px solid #000" : undefined,
                  }}
                  title={
                    paymentMethod === "cash"
                      ? "Нажмите, чтобы отменить выбор"
                      : "Оплата наличными"
                  }
                >
                  Наличными
                </button>
                <button

                  className={`start__total-pay disabled:bg-gray-300! ${paymentMethod === "card" ? "active" : ""
                    }`}
                  onClick={() => {
                    if (paymentMethod === "card") {
                      setPaymentMethod(null);
                    } else {
                      setPaymentMethod("card");
                    }
                  }}
                  disabled={!start?.id || !isEmpty}
                  style={{
                    backgroundColor:
                      paymentMethod === "card" ? "#f7d617" : undefined,
                    border:
                      paymentMethod === "card" ? "2px solid #000" : undefined,
                  }}
                  title={
                    paymentMethod === "card"
                      ? "Нажмите, чтобы отменить выбор"
                      : "Оплата переводом"
                  }
                >
                  Переводом
                </button>
              </div>

              {paymentMethod && (
                <div
                  className="start__total-row1"
                  style={{ marginTop: "10px" }}
                >
                  <button
                    className="start__total-pay"
                    onClick={() => performCheckout(true)}
                    disabled={!start?.id || !isPrinterConnected}
                    title={
                      !isPrinterConnected
                        ? "Принтер не подключен. Подключите принтер для печати чека."
                        : "Оформить и напечатать чек"
                    }
                  >
                    Печать чека
                  </button>
                  <button
                    className="start__total-pay"
                    onClick={() => performCheckout(false)}
                    disabled={!start?.id}
                  >
                    Без чека
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ClientModal
        show={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        form={form}
        setForm={setForm}
        touched={touched}
        setTouched={setTouched}
        errors={errors}
        setErrors={setErrors}
        submitTried={submitTried}
        setSubmitTried={setSubmitTried}
        setAlert={setAlert}
      />

      <DebtModal
        show={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        currentTotal={currentTotal}
        clientId={clientId}
        setClientId={setClientId}
        setSelectClient={setSelectClient}
        filterClient={filterClient}
        company={company}
        state={state}
        onChange2={onChange2}
        debt={debt}
        setDebt={setDebt}
        amount={amount}
        setAmount={setAmount}
        debtMonths={debtMonths}
        setDebtMonths={setDebtMonths}
        onSave={handleSaveDebt}
      />

      <CustomServiceModal
        show={showCustomServiceModal}
        onClose={() => setShowCustomServiceModal(false)}
        customService={customService}
        setCustomService={setCustomService}
        onAdd={handleAddCustomService}
      />

      <DiscountModal
        show={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        currentSubtotal={currentSubtotal}
        onApply={(discount) =>
          onDiscountChange({ target: { value: discount } })
        }
      />

      <CashModal
        show={showCashModal}
        onClose={() => setShowCashModal(false)}
        currentTotal={currentTotal}
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        cashPaymentConfirmed={cashPaymentConfirmed}
        setCashPaymentConfirmed={setCashPaymentConfirmed}
        setPaymentMethod={setPaymentMethod}
        onPay={handleCashPayment}
        setAlert={setAlert}
      />

      <PaymentChoiceModal
        show={showPaymentChoiceModal}
        onClose={() => setShowPaymentChoiceModal(false)}
        paymentChoice={paymentChoice}
        setPaymentChoice={setPaymentChoice}
        onConfirm={handleConfirmPaymentChoice}
      />

      <ReceiptChoiceModal
        show={showReceiptChoiceModal}
        onClose={() => {
          setShowReceiptChoiceModal(false);
          setCashPaymentConfirmed(false);
        }}
        receiptWithCheck={receiptWithCheck}
        setReceiptWithCheck={setReceiptWithCheck}
        paymentMethod={paymentMethod}
        onConfirm={() => {
          setPendingCheckout({
            withReceipt: receiptWithCheck,
            paymentType: paymentMethod || "card",
          });
          setShowReceiptChoiceModal(false);
          setCashPaymentConfirmed(false);
        }}
      />

      <AlertModal
        open={alert.open}
        type={alert.type}
        message={alert.message}
        okText="Ok"
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
      />
    </section>
  );
};

export default SellMainStart;
