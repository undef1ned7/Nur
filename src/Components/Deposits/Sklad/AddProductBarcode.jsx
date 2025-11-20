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
            onShowErrorAlert("Введите корректный срок долга (в месяцах)");
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
            onShowErrorAlert("Введите корректный срок долга (в месяцах)");
          }
          return;
        }
      }

      const result = await dispatch(
        createProductWithBarcode({
          barcode: scannedProduct.barcode,
          ...state,
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
    <div style={{ padding: "20px" }}>
      <h3>Сканирование товара</h3>

      {/* Индикатор загрузки сканирования */}
      {scanningProduct && (
        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "#f5f5f5",
          }}
        >
          Поиск товара...
        </div>
      )}

      {/* Информация о найденном товаре */}
      {scannedProduct && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
          }}
        >
          <h4>Найденный товар:</h4>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Название:</strong>
            </label>
            <input
              type="text"
              value={state.name}
              onChange={onChange}
              name="name"
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "100%",
              }}
            />
          </div>
          {scannedProduct.brand && (
            <div style={{ marginBottom: "10px" }}>
              <strong>Бренд:</strong> {scannedProduct.brand.name}
            </div>
          )}
          {scannedProduct.category && (
            <div style={{ marginBottom: "10px" }}>
              <strong>Категория:</strong> {scannedProduct.category.name}
            </div>
          )}
          <div style={{ marginBottom: "10px" }}>
            <strong>Штрих-код:</strong> {scannedProduct.barcode}
          </div>
          {scannedProduct.price && (
            <div style={{ marginBottom: "15px" }}>
              <strong>Цена:</strong> {scannedProduct.price} сом
            </div>
          )}

          {/* Поле для ввода количества */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Количество:</strong>
            </label>
            <input
              type="number"
              min="1"
              value={state.quantity}
              onChange={onChange}
              name="quantity"
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "100%",
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Закупочная цена:</strong>
            </label>
            <input
              type="number"
              min="1"
              value={state.purchase_price}
              onChange={onChange}
              name="purchase_price"
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "100%",
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Розничная цена:</strong>
            </label>
            <input
              type="number"
              min="1"
              name="price"
              value={state.price}
              onChange={onChange}
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "100%",
              }}
            />
          </div>

          {/* Переключатель долга */}
          <div
            style={{
              marginBottom: "15px",
              padding: "15px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                marginBottom: showDebtForm ? "15px" : "0",
              }}
            >
              <input
                type="checkbox"
                checked={showDebtForm}
                onChange={(e) => setShowDebtForm(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <strong style={{ fontSize: "14px" }}>Добавить долг</strong>
            </label>

            {/* Форма долга */}
            {showDebtForm && (
              <div style={{ marginTop: "15px" }}>
                {clientId === "" && (
                  <>
                    <p
                      style={{
                        margin: "5px 0",
                        color: "#ff0000",
                        fontSize: "13px",
                      }}
                    >
                      Выберите клиента!
                    </p>
                    <select
                      onChange={(e) => {
                        setClientId(e.target.value);
                      }}
                      value={clientId}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    >
                      <option value="">Выберите клиента</option>
                      {filterClient.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.full_name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {company?.subscription_plan?.name === "Старт" && clientId && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Телефон
                    </label>
                    <input
                      type="text"
                      onChange={onChangeDebt}
                      name="phone"
                      value={debtState.phone}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Дата оплаты
                    </label>
                    <input
                      type="date"
                      onChange={onChangeDebt}
                      name="dueDate"
                      value={debtState.dueDate}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                  </>
                )}
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  Тип оплаты
                </label>
                <select
                  value={debt}
                  onChange={(e) => setDebt(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    marginBottom: "10px",
                  }}
                >
                  <option value="">Тип оплаты</option>
                  <option value="Предоплата">Предоплата</option>
                  <option value="Долги">Долг</option>
                </select>
                {debt === "Предоплата" && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Сумма предоплаты
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Срок долга (мес.)
                    </label>
                    <input
                      type="text"
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                  </>
                )}
                {debt === "Долги" && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Срок долга (мес.)
                    </label>
                    <input
                      type="text"
                      value={debtMonths}
                      onChange={(e) => setDebtMonths(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "10px",
                      }}
                    />
                  </>
                )}
                {debt && clientId && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#e8f5e9",
                      borderRadius: "4px",
                      fontSize: "13px",
                    }}
                  >
                    <strong>Сумма долга:</strong> {totalAmount.toFixed(2)} сом
                    <br />
                    <strong>Клиент:</strong> {pickClient?.full_name}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleAddToWarehouse}
              disabled={addingToWarehouse}
              style={{
                padding: "10px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: addingToWarehouse ? "not-allowed" : "pointer",
                opacity: addingToWarehouse ? 0.6 : 1,
              }}
            >
              {addingToWarehouse ? "Добавление..." : "Добавить в склад"}
            </button>

            <button
              onClick={handleCancel}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Инструкция */}
      {!scannedProduct && !scanningProduct && (
        <div
          style={{
            color: "#666",
            fontStyle: "italic",
            marginTop: "20px",
          }}
        >
          Отсканируйте штрих-код товара для добавления в склад
        </div>
      )}
    </div>
  );
};

export default AddProductBarcode;
