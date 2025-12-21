import React, { useState, useEffect } from "react";
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
import SuccessPaymentModal from "./components/SuccessPaymentModal";
import AlertModal from "../../../common/AlertModal/AlertModal";
import {
  handleCheckoutResponseForPrinting,
  checkPrinterConnection,
} from "../../../pages/Sell/services/printService";
import api from "../../../../api";
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
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState(
    total ? total.toFixed(2) : "0.00"
  );
  const [debtMonths, setDebtMonths] = useState(1); // Количество месяцев для рассрочки
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(customer);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectCashBox, setSelectCashBox] = useState("");
  const [receiptData, setReceiptData] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

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
  ];

  const customerDebt =
    selectedCustomer?.debt || selectedCustomer?.total_debt || 0;
  const totalDebt =
    paymentMethod === "deferred" ? total + customerDebt : customerDebt;

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

  const handleAcceptPayment = async () => {
    if (!saleId) {
      showAlert("error", "Ошибка", "Продажа не найдена");
      return;
    }

    // Валидация для отсрочки - требуется клиент
    if (paymentMethod === "deferred") {
      if (!selectedCustomer?.id) {
        showAlert(
          "warning",
          "Требуется клиент",
          "Для оформления отсрочки необходимо выбрать клиента"
        );
        return;
      }
    }

    // Валидация для наличных
    if (paymentMethod === "cash") {
      const received = parseFloat(amountReceived) || 0;
      if (received < total) {
        showAlert(
          "warning",
          "Недостаточно средств",
          "Полученная сумма меньше суммы заказа!"
        );
        return;
      }
    }

    try {
      // Маппинг способов оплаты
      let paymentMethodApi = "cash";
      if (paymentMethod === "cashless") {
        paymentMethodApi = "transfer";
      } else if (paymentMethod === "deferred") {
        paymentMethodApi = "debt"; // Отправляем как долг
      }

      // Проверяем подключение принтера ДО выполнения checkout
      const isPrinterConnected = await checkPrinterConnection();

      // Выполняем checkout
      // Передаем bool: true только если принтер подключен
      const result = await dispatch(
        productCheckout({
          id: saleId,
          bool: isPrinterConnected, // print_receipt - только если принтер подключен
          clientId: selectedCustomer?.id || null,
          payment_method: paymentMethodApi,
          cash_received:
            paymentMethod === "cash" || paymentMethod === "deferred"
              ? parseFloat(amountReceived) || total
              : null,
        })
      );

      if (result.type === "products/productCheckout/fulfilled") {
        // Создаем долг при отсрочке
        if (paymentMethod === "deferred" && selectedCustomer?.id) {
          try {
            // Для тарифа "Старт" создаем запись в /main/debts/
            if (company?.subscription_plan?.name === "Старт") {
              // Вычисляем дату платежа: добавляем debtMonths месяцев к текущей дате
              const currentDate = new Date();
              const dueDate = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() + (typeof debtMonths === "number" ? debtMonths : 1),
                currentDate.getDate()
              );
              const dueDateString = dueDate.toISOString().split("T")[0]; // Формат YYYY-MM-DD

              try {
                await api.post("/main/debts/", {
                  name:
                    selectedCustomer.full_name ||
                    selectedCustomer.name ||
                    "Клиент",
                  phone: selectedCustomer.phone || "",
                  due_date: dueDateString,
                  amount: typeof total === "number" ? total.toFixed(2) : String(total),
                });
              } catch (startDebtError) {
                console.warn("Ошибка при создании долга для тарифа Старт:", startDebtError);
                // Не блокируем успешную оплату, если ошибка с долгом
                showAlert(
                  "warning",
                  "Предупреждение",
                  "Оплата оформлена, но не удалось создать запись о долге для тарифа Старт. " +
                    (startDebtError?.response?.data?.detail ||
                      startDebtError?.message ||
                      "Проверьте данные клиента.")
                );
              }
            }

            // Создаем сделку через createDeal
            await dispatch(
              createDeal({
                clientId: selectedCustomer.id,
                title: `Долг ${
                  selectedCustomer.full_name ||
                  selectedCustomer.name ||
                  "Клиент"
                }`,
                statusRu: "Долги",
                amount: total,
                debtMonths: typeof debtMonths === "number" ? debtMonths : 1, // Количество месяцев для рассрочки
                first_due_date: null, // Можно добавить поле для выбора даты
              })
            ).unwrap();
          } catch (debtError) {
            console.warn("Ошибка при создании долга:", debtError);
            // Не блокируем успешную оплату, если ошибка с долгом
            showAlert(
              "warning",
              "Предупреждение",
              "Оплата оформлена, но не удалось создать запись о долге. " +
                (debtError?.message || "Проверьте данные клиента.")
            );
          }
        }

        // Отправляем запрос на кассу для наличных и переводов (не для отсрочки)
        if (paymentMethod !== "deferred" && selectCashBox && total > 0) {
          try {
            await dispatch(
              addCashFlows({
                cashbox: selectCashBox,
                type: "income",
                name: "Продажа",
                amount: total,
                source_cashbox_flow_id:
                  result.payload?.sale_id || result.payload?.id,
                source_business_operation_id: "Продажа",
                status:
                  company?.subscription_plan?.name === "Старт"
                    ? "approved"
                    : "pending",
              })
            ).unwrap();
          } catch (cashError) {
            console.warn("Ошибка при создании денежного потока:", cashError);
            // Не блокируем успешную оплату, если ошибка с кассой
          }
        }

        // Сохраняем ID продажи для печати чека
        const saleIdForReceipt =
          result.payload?.sale_id || result.payload?.id || saleId;

        // Пытаемся автоматически распечатать чек только если принтер подключен
        if (isPrinterConnected) {
          try {
            const receiptResult = await dispatch(
              getProductCheckout(saleIdForReceipt)
            );

            if (
              receiptResult.type === "products/getProductCheckout/fulfilled"
            ) {
              try {
                await handleCheckoutResponseForPrinting(receiptResult.payload);
              } catch (printError) {
                // Ошибка печати не блокирует продажу
                console.warn("Печать чека не удалась:", printError);
                // Не показываем ошибку пользователю, только логируем
              }
            } else if (result.payload) {
              // Если не удалось получить чек отдельно, пытаемся использовать данные из checkout
              try {
                await handleCheckoutResponseForPrinting(result.payload);
              } catch (printError) {
                // Ошибка печати не блокирует продажу
                console.warn("Печать чека не удалась:", printError);
                // Не показываем ошибку пользователю, только логируем
              }
            }
          } catch (receiptError) {
            // Ошибка получения чека не блокирует продажу
            console.warn("Не удалось получить чек для печати:", receiptError);
            // Не показываем ошибку пользователю, только логируем
          }
        }

        // Показываем модалку успеха с возможностью повторной печати
        setShowSuccessModal(true);

        // Сохраняем данные для печати (на случай, если пользователь захочет распечатать позже)
        setReceiptData({
          saleId: saleIdForReceipt,
          checkoutResponse: result.payload,
        });
      } else {
        showAlert(
          "error",
          "Ошибка",
          "Ошибка при оформлении оплаты: " +
            (result.payload?.message || "Неизвестная ошибка")
        );
      }
    } catch (error) {
      console.error("Ошибка при оформлении оплаты:", error);
      showAlert(
        "error",
        "Ошибка",
        "Ошибка при оформлении оплаты: " +
          (error.message || "Неизвестная ошибка")
      );
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

    // Сначала проверяем, подключен ли принтер
    const isPrinterConnected = await checkPrinterConnection();

    if (!isPrinterConnected) {
      showAlert(
        "warning",
        "Принтер не подключен",
        "Пожалуйста, подключите принтер перед печатью чека"
      );
      return;
    }

    setPrinting(true);
    try {
      // Пытаемся получить чек с сервера
      const receiptResult = await dispatch(
        getProductCheckout(receiptData.saleId)
      );

      if (receiptResult.type === "products/getProductCheckout/fulfilled") {
        // Используем сервис печати для обработки ответа
        await handleCheckoutResponseForPrinting(receiptResult.payload);
      } else if (receiptData.checkoutResponse) {
        // Если не удалось получить чек, пытаемся использовать данные из checkout
        await handleCheckoutResponseForPrinting(receiptData.checkoutResponse);
      } else {
        showAlert(
          "error",
          "Ошибка печати",
          "Не удалось получить данные чека для печати"
        );
      }
    } catch (error) {
      console.error("Ошибка при печати чека:", error);
      showAlert(
        "error",
        "Ошибка печати",
        error.message || "Не удалось распечатать чек"
      );
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
    } else if (paymentMethod === "cashless") {
      return {
        cash: 0,
        cashless: total,
        deferred: 0,
      };
    } else {
      return {
        cash: 0,
        cashless: 0,
        deferred: total,
      };
    }
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
      // При переключении на наличные или безналичные устанавливаем итоговую сумму
      setAmountReceived(total ? total.toFixed(2) : "0.00");
    }
  }, [paymentMethod, total]);

  // Обработка нажатия Enter для закрытия модалки успеха
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (showSuccessModal && e.key === "Enter") {
        setShowSuccessModal(false);
        onComplete();
      }
    };

    if (showSuccessModal) {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
    }
  }, [showSuccessModal, onComplete]);

  // Обработка нажатия Enter для принятия оплаты
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Пропускаем, если открыты модалки
      if (showSuccessModal || showCustomerModal || alertModal.open) {
        return;
      }

      // Пропускаем, если фокус в поле ввода суммы
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA")
      ) {
        // Если это поле ввода суммы, разрешаем Enter для принятия оплаты
        if (
          activeElement.className?.includes("payment-page__amount-input") ||
          activeElement.className?.includes("payment-page__debt-months-input")
        ) {
          // Enter в поле ввода суммы также принимает оплату
          if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleAcceptPayment();
          }
        } else {
          // Для других полей ввода не обрабатываем Enter
          return;
        }
      }

      // Если нажали Enter и нет открытых модалок
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleAcceptPayment();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccessModal, showCustomerModal, alertModal.open]);

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
        </div>

        <div className="payment-page__right">
          {/* Итоговая информация */}
          <div className="payment-page__summary">
            <div className="payment-page__summary-item">
              <span className="payment-page__summary-label">СУБТОТАЛ</span>
              <span className="payment-page__summary-value">
                {(
                  parseFloat(sale?.subtotal || 0) ||
                  cart.reduce(
                    (sum, item) =>
                      sum + (item.price || 0) * (item.quantity || 0),
                    0
                  )
                ).toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                сом
              </span>
            </div>
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
                    }
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

          {paymentMethod === "deferred" ? (
            <div className="payment-page__debt-section">
              <div className="payment-page__debt-amount">
                <div className="payment-page__debt-label">СУММА ДОЛГА</div>
                <div className="payment-page__debt-value">
                  {total.toFixed(2)}
                </div>
              </div>
              <div className="payment-page__debt-months">
                <label className="payment-page__debt-months-label">
                  Срок рассрочки (месяцев):
                </label>
                <input
                  type="text"
                  className="payment-page__debt-months-input"
                  value={debtMonths}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Разрешаем пустое значение во время ввода
                    if (value === "") {
                      setDebtMonths("");
                      return;
                    }
                    const numValue = parseInt(value, 10);
                    // Если это валидное число, устанавливаем его (минимум 1)
                    if (!isNaN(numValue)) {
                      setDebtMonths(Math.max(1, numValue));
                    }
                  }}
                  onBlur={(e) => {
                    // При потере фокуса валидируем значение
                    const value = parseInt(e.target.value, 10);
                    if (isNaN(value) || value < 1) {
                      setDebtMonths(1);
                    }
                  }}
                  min="1"
                  step="1"
                />
              </div>
              <div className="payment-page__total-debt">
                <span>ОБЩИЙ ДОЛГ</span>
                <span className="payment-page__total-debt-amount">
                  {totalDebt.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  сом
                </span>
              </div>
            </div>
          ) : (
            <div className="payment-page__amount-section">
              <h3 className="payment-page__section-title">
                ПОЛУЧЕНО ОТ ПОКУПАТЕЛЯ
              </h3>
              <div className="payment-page__amount-input-wrapper">
                <input
                  type="text"
                  className="payment-page__amount-input"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
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
            <button
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
          cashlessAmount={paymentAmounts.cashless}
          deferredAmount={paymentAmounts.deferred}
          amountReceived={parseFloat(amountReceived) || 0}
          change={change}
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
