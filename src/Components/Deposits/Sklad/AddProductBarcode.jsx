import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import {
  getProductByBarcodeAsync,
  addProductToWarehouseAsync,
  createProductWithBarcode,
  fetchProductsAsync,
} from "../../../store/creators/productCreators";
import {
  useProducts,
  clearScannedProduct,
} from "../../../store/slices/productSlice";
import { addCashFlows } from "../../../store/slices/cashSlice";
import { useUser } from "../../../store/slices/userSlice";
import { setCartData } from "../../../store/slices/agentCartSlice";
import { fetchClientsAsync } from "../../../store/creators/clientCreators";

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

  const [barcodeScan, setBarcodeScan] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState({
    quantity: "1",
    price: "",
    purchase_price: "",
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
  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({
      ...prev,
      [name]: value,
    }));
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

  const handleAddToWarehouse = async () => {
    if (!scannedProduct || quantity <= 0) return;

    try {
      const result = await dispatch(
        createProductWithBarcode({
          barcode: scannedProduct.barcode,
          ...state,
        })
      ).unwrap();

      await dispatch(
        addCashFlows({
          ...cashData,
          name: scannedProduct.name === "" ? "Товар" : scannedProduct.name,
          amount: state.quantity * state.purchase_price,
          source_cashbox_flow_id: result.id,
        })
      ).unwrap();

      // Сохраняем имя товара для модалки успеха перед очисткой
      const productName = scannedProduct?.name || "Неизвестный товар";

      // Очищаем все поля формы после успешного добавления
      setQuantity(1);
      setState({
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
  };

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
          <div style={{ marginBottom: "10px" }}>
            <strong>Название:</strong> {scannedProduct.name}
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
