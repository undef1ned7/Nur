import React, { useEffect, useState, useMemo } from "react";
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
import { fetchClientsAsync } from "../../../store/creators/clientCreators";
import { useClient } from "../../../store/slices/ClientSlice";
import { createDeal } from "../../../store/creators/saleThunk";
import api from "../../../api";
import "./AddProductBarcode.scss";

// Функция для создания долга
async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const AddProductBarcode = ({
  onClose: onAddModalClose,
  onShowSuccessAlert,
  onShowErrorAlert,
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
    plu: "",
    scale_type: "",
  });
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [clientId, setClientId] = useState("");
  const [showDebtForm, setShowDebtForm] = useState(false);
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

  // Фильтрация клиентов
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
    setState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const onChangeDebt = (e) => {
    const { name, value } = e.target;
    setDebtState((prev) => ({ ...prev, [name]: value }));
  };

  useScanDetection({
    onComplete: (scanned) => {
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

  // Отслеживаем ошибки из Redux состояния
  useEffect(() => {
    if (scanProductError && onShowErrorAlert) {
      const errorMsg =
        scanProductError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      onShowErrorAlert(errorMsg);
    }
  }, [scanProductError, onShowErrorAlert]);

  useEffect(() => {
    if (addToWarehouseError && onShowErrorAlert) {
      const errorMsg =
        addToWarehouseError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      onShowErrorAlert(errorMsg);
    }
  }, [addToWarehouseError, onShowErrorAlert]);

  useEffect(() => {
    if (barcodeError && onShowErrorAlert) {
      const errorMsg =
        barcodeError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      onShowErrorAlert(errorMsg);
    }
  }, [barcodeError, onShowErrorAlert]);

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

      const result = await dispatch(
        createProductWithBarcode({
          barcode: scannedProduct.barcode,
          ...state,
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
        plu: "",
        scale_type: "",
      });
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
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
    }));
  }, []);

  const handleCancel = () => {
    dispatch(clearScannedProduct());
    setQuantity(1);
    setState({
      name: "",
      quantity: "1",
      price: "",
      purchase_price: "",
      plu: "",
      scale_type: "",
    });
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
              <input
                type="number"
                min="0"
                step="0.01"
                value={state.purchase_price}
                onChange={onChange}
                name="purchase_price"
                placeholder="0.00"
              />
            </div>
            <div className="add-product-barcode__form-group">
              <label>Розничная цена *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="price"
                value={state.price}
                onChange={onChange}
                placeholder="0.00"
              />
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
                      Выберите клиента!
                    </p>
                    <div className="add-product-barcode__form-group">
                      <label>Клиент *</label>
                      <select
                        onChange={(e) => {
                          setClientId(e.target.value);
                        }}
                        value={clientId}
                      >
                        <option value="">Выберите клиента</option>
                        {filterClient.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    <strong>Клиент:</strong> {pickClient?.full_name}
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
