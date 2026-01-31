import React, { useEffect, useState, useMemo, useRef } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import {
  getProductByBarcodeAsync,
  createProductWithBarcode,
  fetchProductsAsync,
} from "../../../store/creators/productCreators";
import {
  useProducts,
  clearScannedProduct,
} from "../../../store/slices/productSlice";
import { addCashFlows } from "../../../store/slices/cashSlice";
import { useUser } from "../../../store/slices/userSlice";
import {
  fetchClientsAsync,
  createClientAsync,
} from "../../../store/creators/clientCreators";
import { useClient } from "../../../store/slices/ClientSlice";
import { createDeal } from "../../../store/creators/saleThunk";
import api from "../../../api";
import "./AddProductBarcode.scss";

// Функция для создания долга
async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const initialSupplierFormState = {
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
};

const AddProductBarcode = ({
  onClose: onAddModalClose,
  onShowSuccessAlert,
  onShowErrorAlert,
  onShowSupplierCreated,
  selectCashBox,
}) => {
  const {
    scannedProduct,
    scanningProduct,
    scanProductError,
    addingToWarehouse,
    addToWarehouseError,
    barcodeError,
  } = useProducts();
  const { company } = useUser();
  const { list: clients = [] } = useClient();

  const [barcodeScan, setBarcodeScan] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState({
    name: "",
    quantity: "1",
    price: "",
    purchase_price: "",
    markup: "0",
    plu: "",
    scale_type: "",
  });
  const [isPriceManuallyChanged, setIsPriceManuallyChanged] = useState(false);
  const [isMarkupManuallyChanged, setIsMarkupManuallyChanged] = useState(false);
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [clientId, setClientId] = useState("");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const showSupplierFormRef = useRef(showSupplierForm);
  showSupplierFormRef.current = showSupplierForm;
  const [supplierFormState, setSupplierFormState] = useState(initialSupplierFormState);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [debtState, setDebtState] = useState({
    phone: "",
    dueDate: "",
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
  const dispatch = useDispatch();

  // Refs для отслеживания последних обработанных ошибок (чтобы избежать бесконечных циклов)
  const lastScanErrorRef = useRef(null);
  const lastAddErrorRef = useRef(null);
  const lastBarcodeErrorRef = useRef(null);

  // Ref для хранения функции onShowErrorAlert, чтобы она не менялась при каждом рендере
  const onShowErrorAlertRef = useRef(onShowErrorAlert);

  // Обновляем ref при изменении функции
  useEffect(() => {
    onShowErrorAlertRef.current = onShowErrorAlert;
  }, [onShowErrorAlert]);

  // Фильтрация клиентов
  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "suppliers"
      ),
    [clients]
  );

  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId]
  );

  // Автоматическое заполнение телефона при выборе клиента в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickClient?.phone) {
      setDebtState((prev) => ({ ...prev, phone: pickClient.phone }));
    }
  }, [clientId, pickClient, company?.subscription_plan?.name]);

  // Загрузка клиентов
  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const onChange = (e) => {
    const { name, value } = e.target;

    // Если меняется наценка, помечаем что она изменена вручную
    if (name === "markup") {
      setIsMarkupManuallyChanged(true);
    }

    setState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Обработчик изменения цены продажи
  const handlePriceChange = (e) => {
    const { value } = e.target;
    setIsPriceManuallyChanged(true);
    onChange(e);

    // Если пользователь сам НЕ трогал наценку, считаем её из цены закупки и цены продажи
    if (!isMarkupManuallyChanged) {
      const purchasePrice = parseFloat(state.purchase_price) || 0;
      const sellingPrice = parseFloat(value) || 0;

      if (purchasePrice > 0 && sellingPrice > 0) {
        const markupPercent = (sellingPrice / purchasePrice - 1) * 100;
        const roundedMarkup = Math.round(markupPercent * 100) / 100;
        setState((prev) => ({
          ...prev,
          markup: roundedMarkup.toString(),
        }));
      }
    }
  };

  // Автоматический расчет цены продажи на основе цены закупки и наценки
  useEffect(() => {
    if (!isPriceManuallyChanged) {
      const purchasePrice = parseFloat(state.purchase_price) || 0;
      const markup = parseFloat(state.markup) || 0;

      if (purchasePrice > 0 && markup >= 0) {
        const sellingPrice = purchasePrice * (1 + markup / 100);
        const calculatedPrice = Math.round(sellingPrice * 100) / 100;

        setState((prev) => ({
          ...prev,
          price: calculatedPrice.toString(),
        }));
      } else if (purchasePrice === 0 && markup === 0) {
        setState((prev) => ({
          ...prev,
          price: "",
        }));
      }
    }
  }, [state.purchase_price, state.markup, isPriceManuallyChanged]);

  // Сброс флага ручного изменения при изменении цены закупки или наценки
  useEffect(() => {
    setIsPriceManuallyChanged(false);
  }, [state.purchase_price, state.markup]);

  const onChangeDebt = (e) => {
    const { name, value } = e.target;
    setDebtState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSupplierFormChange = (e) => {
    const { name, value } = e.target;
    setSupplierFormState((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!supplierFormState.full_name?.trim()) {
      if (onShowErrorAlert) onShowErrorAlert("Введите ФИО поставщика");
      return;
    }
    setCreatingSupplier(true);
    try {
      const client = await dispatch(createClientAsync(supplierFormState)).unwrap();
      await dispatch(fetchClientsAsync());
      setShowSupplierForm(false);
      if (client?.id) {
        setClientId(String(client.id));
      }
      setSupplierFormState(initialSupplierFormState);
      if (onShowSupplierCreated) {
        onShowSupplierCreated("Поставщик успешно создан!");
      }
    } catch (err) {
      const msg = err?.message || err?.detail || JSON.stringify(err);
      if (onShowErrorAlert) onShowErrorAlert(`Ошибка при создании поставщика: ${msg}`);
    } finally {
      setCreatingSupplier(false);
    }
  };

  // Не обрабатывать скан, если пользователь вводит текст в поле (форма поставщика, долга или любое input/textarea/select)
  useScanDetection({
    onComplete: (scanned) => {
      const active = document.activeElement;
      const isInputFocused =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT");
      if (isInputFocused || showSupplierFormRef.current) {
        return;
      }
      if (scanned.length >= 3) {
        setBarcodeScan(scanned);
      }
    },
    minLength: 3,
  });

  useEffect(() => {
    if (!barcodeScan) return;

    // Очищаем предыдущий результат
    dispatch(clearScannedProduct());

    (async () => {
      try {
        await dispatch(getProductByBarcodeAsync(barcodeScan)).unwrap();
        setBarcodeScan(""); // Очищаем штрих-код после успешного сканирования
      } catch (err) {
        console.error("Ошибка при получении товара по штрих-коду:", err);
        const errorMsg = "Товар с таким штрих-кодом не найден";
        setBarcodeScan(""); // Очищаем штрих-код даже при ошибке

        // Показываем AlertModal через колбэк (закрываем AddModal и показываем ошибку)
        if (onShowErrorAlert) {
          onShowErrorAlert(errorMsg);
        }
      }
    })();
  }, [barcodeScan, dispatch]);

  // Отслеживаем ошибки из Redux состояния (с защитой от повторных вызовов)
  useEffect(() => {
    if (!scanProductError) {
      lastScanErrorRef.current = null;
      return;
    }

    const errorId =
      scanProductError?.response?.data?.barcode ||
      scanProductError?.message ||
      String(scanProductError);

    // Проверяем, не обрабатывали ли мы уже эту ошибку
    if (lastScanErrorRef.current !== errorId && onShowErrorAlertRef.current) {
      lastScanErrorRef.current = errorId;
      const errorMsg =
        scanProductError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";

      // Используем setTimeout, чтобы избежать синхронных обновлений состояния
      setTimeout(() => {
        if (onShowErrorAlertRef.current) {
          onShowErrorAlertRef.current(errorMsg);
        }
      }, 0);
    }
  }, [scanProductError]);

  useEffect(() => {
    if (!addToWarehouseError) {
      lastAddErrorRef.current = null;
      return;
    }

    const errorId =
      addToWarehouseError?.response?.data?.barcode ||
      addToWarehouseError?.message ||
      String(addToWarehouseError);

    // Проверяем, не обрабатывали ли мы уже эту ошибку
    if (lastAddErrorRef.current !== errorId && onShowErrorAlertRef.current) {
      lastAddErrorRef.current = errorId;
      const errorMsg =
        addToWarehouseError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";

      // Используем setTimeout, чтобы избежать синхронных обновлений состояния
      setTimeout(() => {
        if (onShowErrorAlertRef.current) {
          onShowErrorAlertRef.current(errorMsg);
        }
      }, 0);
    }
  }, [addToWarehouseError]);

  useEffect(() => {
    if (!barcodeError) {
      lastBarcodeErrorRef.current = null;
      return;
    }

    const errorId =
      barcodeError?.response?.data?.barcode ||
      barcodeError?.message ||
      String(barcodeError);

    // Проверяем, не обрабатывали ли мы уже эту ошибку
    if (
      lastBarcodeErrorRef.current !== errorId &&
      onShowErrorAlertRef.current
    ) {
      lastBarcodeErrorRef.current = errorId;
      const errorMsg =
        barcodeError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";

      // Используем setTimeout, чтобы избежать синхронных обновлений состояния
      setTimeout(() => {
        if (onShowErrorAlertRef.current) {
          onShowErrorAlertRef.current(errorMsg);
        }
      }, 0);
    }
  }, [barcodeError]);

  // Автоматическое заполнение названия товара при обнаружении
  useEffect(() => {
    if (scannedProduct?.name) {
      setState((prev) => ({ ...prev, name: scannedProduct.name }));
    }
  }, [scannedProduct]);

  const handleAddToWarehouse = async () => {
    if (!scannedProduct || quantity <= 0) return;

    try {
      // Валидация для долговых операций
      if (debt && !clientId) {
        if (onShowErrorAlert) {
          onShowErrorAlert("Выберите клиента для долговой операции");
        }
        return;
      }

      if (debt === "Долги") {
        if (!debtMonths || Number(debtMonths) <= 0) {
          if (onShowErrorAlert) {
            onShowErrorAlert("Введите корректный срок долга");
          }
          return;
        }
        if (company?.subscription_plan?.name === "Старт") {
          if (!debtState.dueDate) {
            if (onShowErrorAlert) {
              onShowErrorAlert("Выберите дату");
            }
            return;
          }
          if (!debtState.phone) {
            if (onShowErrorAlert) {
              onShowErrorAlert("Введите номер телефона");
            }
            return;
          }
        }
      }

      if (debt === "Предоплата") {
        if (!amount || Number(amount) <= 0) {
          if (onShowErrorAlert) {
            onShowErrorAlert("Введите корректную сумму предоплаты");
          }
          return;
        }
        const totalAmount =
          Number(state.quantity) * Number(state.purchase_price);
        if (Number(amount) > totalAmount) {
          if (onShowErrorAlert) {
            onShowErrorAlert("Сумма предоплаты не может превышать общую сумму");
          }
          return;
        }
        if (!debtMonths || Number(debtMonths) <= 0) {
          if (onShowErrorAlert) {
            onShowErrorAlert("Введите корректный срок долга");
          }
          return;
        }
      }

      // Нормализуем наценку: если не заполнена, считаем её 0
      const normalizedMarkup =
        state.markup !== undefined &&
        state.markup !== null &&
        String(state.markup).trim() !== ""
          ? String(state.markup)
          : "0";

      const result = await dispatch(
        createProductWithBarcode({
          barcode: scannedProduct.barcode,
          ...state,
          markup_percent: normalizedMarkup,
          plu: state.plu ? Number(state.plu) : null,
          scale_type: state.scale_type || null,
        })
      ).unwrap();

      const totalAmount = Number(state.quantity) * Number(state.purchase_price);

      // Создание долга, если выбран
      if (debt === "Долги" && clientId) {
        if (company?.subscription_plan?.name === "Старт") {
          await createDebt({
            name: pickClient?.full_name,
            phone: debtState.phone,
            due_date: debtState.dueDate,
            amount: totalAmount,
          });
        }

        // Создание сделки
        await dispatch(
          createDeal({
            clientId: clientId,
            title: `Долг ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      if (debt === "Предоплата" && clientId) {
        await dispatch(
          createDeal({
            clientId: clientId,
            title: `Предоплата ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            prepayment: Number(amount),
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      // Добавление денежного потока только если не долг
      if (debt !== "Долги") {
        const amountForCash = debt === "Предоплата" ? amount : totalAmount;
        await dispatch(
          addCashFlows({
            ...cashData,
            name: state.name === "" ? "Товар" : state.name,
            amount: amountForCash,
            source_cashbox_flow_id: result.id,
          })
        ).unwrap();
      }

      // Сохраняем имя товара для модалки успеха перед очисткой
      const productName = state.name || "Неизвестный товар";

      // Очищаем все поля формы после успешного добавления
      setQuantity(1);
      setState({
        name: "",
        quantity: "1",
        price: "",
        purchase_price: "",
        markup: "0",
        plu: "",
        scale_type: "",
      });
      setIsPriceManuallyChanged(false);
      setIsMarkupManuallyChanged(false);
      setBarcodeScan("");
      setCashData((prev) => ({
        ...prev,
        name: "",
        amount: "",
      }));
      // Очищаем данные долга
      setDebt("");
      setAmount("");
      setDebtMonths("");
      setClientId("");
      setShowDebtForm(false);
      setDebtState({
        phone: "",
        dueDate: "",
      });

      dispatch(fetchProductsAsync());
      // Очищаем отсканированный товар
      dispatch(clearScannedProduct());

      // Показываем модалку успеха через колбэк (закрывает AddModal и показывает успех)
      if (onShowSuccessAlert) {
        onShowSuccessAlert(productName);
      }
    } catch (err) {
      console.error("Ошибка при добавлении товара в склад:", err);

      // Показываем модалку ошибки через колбэк (закрывает AddModal и показывает ошибку)
      const errorMsg =
        err?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      console.log(errorMsg);

      if (onShowErrorAlert) {
        onShowErrorAlert(errorMsg);
      }
    }
  };

  useEffect(() => {
    if (selectCashBox) {
      setCashData((prev) => ({
        ...prev,
        cashbox: selectCashBox,
      }));
    }
  }, [selectCashBox]);

  const handleCancel = () => {
    dispatch(clearScannedProduct());
    setQuantity(1);
    setState({
      name: "",
      quantity: "1",
      price: "",
      purchase_price: "",
      markup: "0",
      plu: "",
      scale_type: "",
    });
    setIsPriceManuallyChanged(false);
    setIsMarkupManuallyChanged(false);
    setBarcodeScan("");
    setCashData((prev) => ({
      ...prev,
      name: "",
      amount: "",
    }));
    // Очищаем данные долга
    setDebt("");
    setAmount("");
    setDebtMonths("");
    setClientId("");
    setShowDebtForm(false);
    setDebtState({
      phone: "",
      dueDate: "",
    });
  };

  // Вычисляем общую сумму
  const totalAmount =
    Number(state.quantity || 0) * Number(state.purchase_price || 0);

  return (
    <div className="add-product-barcode">
      {/* Индикатор загрузки сканирования */}
      {scanningProduct && (
        <div className="add-product-barcode__loading">Поиск товара...</div>
      )}

      {/* Информация о найденном товаре */}
      {scannedProduct && (
        <div className="add-product-barcode__product-card">
          <h3 className="add-product-barcode__product-title">
            Найденный товар
          </h3>

          <div className="add-product-barcode__form-group">
            <label>Название *</label>
            <input
              type="text"
              value={state.name}
              onChange={onChange}
              name="name"
              placeholder="Введите название товара"
            />
          </div>

          <div className="add-product-barcode__grid">
            {scannedProduct.brand && (
              <div className="add-product-barcode__info-row">
                <strong>Бренд:</strong>
                <span>{scannedProduct.brand.name}</span>
              </div>
            )}
            {scannedProduct.category && (
              <div className="add-product-barcode__info-row">
                <strong>Категория:</strong>
                <span>{scannedProduct.category.name}</span>
              </div>
            )}
            <div className="add-product-barcode__info-row">
              <strong>Штрих-код:</strong>
              <span>{scannedProduct.barcode}</span>
            </div>
            {scannedProduct.price && (
              <div className="add-product-barcode__info-row">
                <strong>Цена:</strong>
                <span>{scannedProduct.price} сом</span>
              </div>
            )}
          </div>

          <div className="add-product-barcode__grid">
            <div className="add-product-barcode__form-group">
              <label>Количество *</label>
              <input
                type="number"
                min="1"
                value={state.quantity}
                onChange={onChange}
                name="quantity"
                placeholder="1"
              />
            </div>
            <div className="add-product-barcode__form-group">
              <label>Закупочная цена *</label>
              <div className="add-product-page__price-input">
                <input
                  type="text"
                  name="purchase_price"
                  placeholder="0.00"
                  className="add-product-page__input"
                  value={state.purchase_price}
                  onChange={onChange}
                  required
                />
                <span className="add-product-page__currency">P</span>
              </div>
            </div>
            <div className="add-product-barcode__form-group">
              <label>Наценка</label>
              <div className="add-product-page__price-input">
                <input
                  type="text"
                  name="markup"
                  placeholder="0"
                  className="add-product-page__input"
                  value={state.markup}
                  onChange={onChange}
                />
                <span className="add-product-page__currency">%</span>
              </div>
            </div>
            <div className="add-product-barcode__form-group">
              <label>Розничная цена *</label>
              <div className="add-product-page__price-input">
                <input
                  type="text"
                  name="price"
                  placeholder="0.00"
                  className="add-product-page__input"
                  value={state.price}
                  onChange={handlePriceChange}
                  required
                />
                <span className="add-product-page__currency">P</span>
              </div>
            </div>
            <div className="add-product-barcode__form-group">
              <label>ПЛУ</label>
              <input
                type="number"
                min="0"
                max="2147483647"
                name="plu"
                value={state.plu}
                onChange={onChange}
                placeholder="Номер ПЛУ для весов"
              />
            </div>
          </div>

          <div className="add-product-barcode__form-group">
            <label>Тип товара для весов</label>
            <select
              name="scale_type"
              value={state.scale_type}
              onChange={onChange}
            >
              <option value="">-- Выберите тип --</option>
              <option value="piece">Штучный</option>
              <option value="weight">Весовой</option>
            </select>
          </div>

          {/* Переключатель долга */}
          <div className="add-product-barcode__debt-section">
            <label className="add-product-barcode__debt-checkbox">
              <input
                type="checkbox"
                checked={showDebtForm}
                onChange={(e) => setShowDebtForm(e.target.checked)}
              />
              <strong>Добавить долг по этому товару</strong>
            </label>

            {/* Форма долга */}
            {showDebtForm && (
              <div className="add-product-barcode__debt-form">
                {clientId === "" && (
                  <>
                    <p className="add-product-barcode__error-message">
                      Выберите поставщика!
                    </p>
                    <div className="add-product-barcode__form-group add-product-barcode__supplier-row">
                      <label>Поставщик *</label>
                      <div className="add-product-barcode__supplier-select-wrap">
                        <select
                          onChange={(e) => setClientId(e.target.value)}
                          value={clientId}
                          className="add-product-barcode__select"
                        >
                          <option value="">Выберите поставщика</option>
                          {filterClient.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="add-product-barcode__create-supplier-btn"
                          onClick={() => setShowSupplierForm(!showSupplierForm)}
                        >
                          + Создать поставщика
                        </button>
                      </div>
                    </div>
                    {showSupplierForm && (
                      <form
                        className="add-product-barcode__supplier-form"
                        onSubmit={onSubmitSupplier}
                      >
                        <input
                          type="text"
                          name="full_name"
                          placeholder="ФИО *"
                          value={supplierFormState.full_name}
                          onChange={handleSupplierFormChange}
                          className="add-product-barcode__input"
                        />
                        <input
                          type="text"
                          name="phone"
                          placeholder="Телефон"
                          value={supplierFormState.phone}
                          onChange={handleSupplierFormChange}
                          className="add-product-barcode__input"
                        />
                        <input
                          type="email"
                          name="email"
                          placeholder="Почта"
                          value={supplierFormState.email}
                          onChange={handleSupplierFormChange}
                          className="add-product-barcode__input"
                        />
                        <input
                          type="text"
                          name="llc"
                          placeholder="ОсОО"
                          value={supplierFormState.llc}
                          onChange={handleSupplierFormChange}
                          className="add-product-barcode__input"
                        />
                        <input
                          type="text"
                          name="inn"
                          placeholder="ИНН"
                          value={supplierFormState.inn}
                          onChange={handleSupplierFormChange}
                          className="add-product-barcode__input"
                        />
                        <input
                          type="text"
                          name="address"
                          placeholder="Адрес"
                          value={supplierFormState.address}
                          onChange={handleSupplierFormChange}
                          className="add-product-barcode__input"
                        />
                        <div className="add-product-barcode__supplier-form-actions">
                          <button
                            type="button"
                            className="add-product-barcode__btn add-product-barcode__btn--secondary"
                            onClick={() => {
                              setShowSupplierForm(false);
                              setSupplierFormState(initialSupplierFormState);
                            }}
                          >
                            Отмена
                          </button>
                          <button
                            type="submit"
                            className="add-product-barcode__btn add-product-barcode__btn--primary"
                            disabled={creatingSupplier}
                          >
                            {creatingSupplier ? "Создание..." : "Создать"}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
                {company?.subscription_plan?.name === "Старт" && clientId && (
                  <div className="add-product-barcode__grid">
                    <div className="add-product-barcode__form-group">
                      <label>Телефон</label>
                      <input
                        type="text"
                        onChange={onChangeDebt}
                        name="phone"
                        value={debtState.phone}
                        placeholder="Номер телефона"
                      />
                    </div>
                    <div className="add-product-barcode__form-group">
                      <label>Дата оплаты</label>
                      <input
                        type="date"
                        onChange={onChangeDebt}
                        name="dueDate"
                        value={debtState.dueDate}
                      />
                    </div>
                  </div>
                )}
                <div className="add-product-barcode__form-group">
                  <label>Тип оплаты</label>
                  <select
                    value={debt}
                    onChange={(e) => setDebt(e.target.value)}
                  >
                    <option value="">Тип оплаты</option>
                    <option value="Предоплата">Предоплата</option>
                    <option value="Долги">Долг</option>
                  </select>
                </div>
                {debt === "Предоплата" && (
                  <div className="add-product-barcode__grid">
                    <div className="add-product-barcode__form-group">
                      <label>Сумма предоплаты</label>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="add-product-barcode__form-group">
                      <label>Срок долга (мес.)</label>
                      <input
                        type="text"
                        value={debtMonths}
                        onChange={(e) => setDebtMonths(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
                {debt === "Долги" && (
                  <div className="add-product-barcode__form-group">
                    <label>Срок долга (мес.)</label>
                    <input
                      type="text"
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}
                {debt && clientId && (
                  <div className="add-product-barcode__debt-summary">
                    <strong>Сумма долга:</strong> {totalAmount.toFixed(2)} сом
                    <br />
                    <strong>Поставщик:</strong> {pickClient?.full_name}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="add-product-barcode__actions">
            <button
              className="add-product-barcode__btn add-product-barcode__btn--secondary"
              onClick={handleCancel}
            >
              Отмена
            </button>
            <button
              className="add-product-barcode__btn add-product-barcode__btn--primary"
              onClick={handleAddToWarehouse}
              disabled={addingToWarehouse}
            >
              {addingToWarehouse ? "Добавление..." : "Добавить в склад"}
            </button>
          </div>
        </div>
      )}

      {/* Инструкция */}
      {!scannedProduct && !scanningProduct && (
        <div className="add-product-barcode__instruction">
          Отсканируйте штрих-код товара для добавления в склад
        </div>
      )}
    </div>
  );
};

export default AddProductBarcode;
