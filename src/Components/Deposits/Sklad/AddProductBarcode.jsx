import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import {
  getProductByBarcodeAsync,
  addProductToWarehouseAsync,
  createProductWithBarcode,
} from "../../../store/creators/productCreators";
import {
  useProducts,
  clearScannedProduct,
} from "../../../store/slices/productSlice";
import AlertModal from "../../common/AlertModal/AlertModal";

const AddProductBarcode = () => {
  const {
    scannedProduct,
    scanningProduct,
    scanProductError,
    addingToWarehouse,
    addToWarehouseError,
    barcodeError,
  } = useProducts();

  const [barcodeScan, setBarcodeScan] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dispatch = useDispatch();

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
        setErrorMessage("Товар с таким штрих-кодом не найден");
        setShowErrorModal(true);

        setBarcodeScan(""); // Очищаем штрих-код даже при ошибке
      }
    })();
  }, [barcodeScan, dispatch]);

  // Отслеживаем ошибки из Redux состояния
  useEffect(() => {
    if (scanProductError) {
      const errorMsg =
        scanProductError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      setShowErrorModal(true);
    }
  }, [scanProductError]);

  useEffect(() => {
    if (addToWarehouseError) {
      const errorMsg =
        addToWarehouseError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [addToWarehouseError]);

  useEffect(() => {
    if (barcodeError) {
      const errorMsg =
        barcodeError?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  }, [barcodeError]);

  const handleAddToWarehouse = async () => {
    if (!scannedProduct || quantity <= 0) return;

    try {
      const result = await dispatch(
        createProductWithBarcode({
          barcode: scannedProduct.barcode,
        })
      ).unwrap();

      // Показываем модалку успеха
      setShowSuccessModal(true);

      // Сбрасываем количество после успешного добавления
      setQuantity(1);
      // Очищаем отсканированный товар
      dispatch(clearScannedProduct());
    } catch (err) {
      console.error("Ошибка при добавлении товара в склад:", err);

      // Показываем модалку ошибки
      const errorMsg =
        err?.response?.data?.barcode ||
        "Произошла ошибка при добавлении товара в склад";
      console.log(errorMsg);

      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  };

  const handleCancel = () => {
    dispatch(clearScannedProduct());
    setQuantity(1);
  };

  const handleCloseErrorModal = () => {
    setShowErrorModal(false);
    setErrorMessage("");
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
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "100px",
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

      {/* Модалка успеха */}
      <AlertModal
        open={showSuccessModal}
        type="success"
        title="Успешно!"
        message={`Товар "${
          scannedProduct?.name || "Неизвестный товар"
        }" успешно добавлен в склад`}
        okText="ОК"
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Модалка ошибки */}
      <AlertModal
        open={showErrorModal}
        type="error"
        title="Ошибка!"
        message={errorMessage}
        okText="ОК"
        onClose={handleCloseErrorModal}
      />
    </div>
  );
};

export default AddProductBarcode;
