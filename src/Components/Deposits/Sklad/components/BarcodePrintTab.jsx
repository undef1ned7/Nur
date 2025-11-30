import { useMemo, useState, useEffect, useRef } from "react";
import "./BarcodePrintTab.scss";
import {
  printXp365bBarcodeLabel,
  attachXp365bUsbListenersOnce,
  checkXp365bConnection,
  connectXp365bManually,
} from "../services/xp365bPrintService";
import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";
import JsBarcode from "jsbarcode";

/**
 * Компонент таба для печати штрих-кодов
 */
const BarcodePrintTab = ({ products, loading, searchTerm, onSearchChange }) => {
  const [printingIds, setPrintingIds] = useState(new Set());
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const barcodeCanvasRef = useRef(null);

  // слушатели USB — один раз
  useEffect(() => {
    attachXp365bUsbListenersOnce();
  }, []);

  // периодическая проверка подключения
  useEffect(() => {
    let cancelled = false;

    const checkConnection = async () => {
      try {
        const connected = await checkXp365bConnection();
        if (!cancelled) setIsPrinterConnected(connected);
      } catch {
        if (!cancelled) setIsPrinterConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // фильтрация товаров
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const search = searchTerm?.trim().toLowerCase() || "";
    if (!search) return products;
    return products.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      return name.includes(search) || barcode.includes(search);
    });
  }, [products, searchTerm]);

  const handleConnectPrinter = async () => {
    try {
      setIsConnecting(true);
      await connectXp365bManually();
      const connected = await checkXp365bConnection();
      setIsPrinterConnected(connected);
      if (!connected) {
        alert("Принтер не обнаружен. Убедитесь, что он подключен по USB.");
      }
    } catch (e) {
      console.error("Ошибка подключения принтера:", e);
      alert(e.message || "Не удалось подключиться к принтеру");
    } finally {
      setIsConnecting(false);
    }
  };

  // Открытие модалки предпросмотра
  const handleOpenPreview = (product) => {
    if (!product.barcode) {
      alert("У товара отсутствует штрих-код");
      return;
    }
    setPreviewProduct(product);
  };

  // Закрытие модалки предпросмотра
  const handleClosePreview = () => {
    setPreviewProduct(null);
    setIsPrinting(false);
  };

  // Печать штрих-кода из модалки
  const handlePrintFromPreview = async () => {
    if (!previewProduct || !previewProduct.barcode) return;

    setIsPrinting(true);
    setPrintingIds((prev) => new Set(prev).add(previewProduct.id));

    try {
      await printXp365bBarcodeLabel({
        barcode: previewProduct.barcode,
        title: previewProduct.name || "Товар",
        widthMm: 58,
        heightMm: 40,
      });

      const connected = await checkXp365bConnection();
      setIsPrinterConnected(connected);

      // Закрываем модалку после успешной печати
      handleClosePreview();
    } catch (error) {
      console.error("Ошибка при печати на XP-365B:", error);

      const connected = await checkXp365bConnection();
      setIsPrinterConnected(connected);

      let errorMessage = "Не удалось отправить данные на принтер";

      if (error.message) {
        if (error.message.includes("WebUSB")) {
          errorMessage =
            "Браузер не поддерживает WebUSB. Используйте Chrome или Edge.";
        } else if (
          error.message.includes("не найден") ||
          error.message.includes("не найдено")
        ) {
          errorMessage =
            "Принтер не подключен. Подключите принтер XP-365B и попробуйте снова.";
        } else {
          errorMessage = error.message;
        }
      }

      alert(errorMessage);
    } finally {
      setIsPrinting(false);
      setPrintingIds((prev) => {
        const next = new Set(prev);
        next.delete(previewProduct.id);
        return next;
      });
    }
  };

  // Генерация визуализации штрих-кода для предпросмотра
  useEffect(() => {
    if (!previewProduct || !barcodeCanvasRef.current) return;

    const canvas = barcodeCanvasRef.current;
    const barcode = String(previewProduct.barcode || "");

    if (!barcode) return;

    try {
      // Очистка canvas
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Определяем формат штрих-кода
      let format = "CODE128";
      if (barcode.length === 13) {
        format = "EAN13";
      } else if (barcode.length === 8) {
        format = "EAN8";
      } else if (barcode.length === 12) {
        format = "UPC";
      }

      // Генерируем штрих-код с помощью JsBarcode
      JsBarcode(canvas, barcode, {
        format: format,
        width: 2,
        height: 60,
        displayValue: false, // Не показываем текст под штрих-кодом (покажем отдельно)
        margin: 0,
        background: "transparent",
        lineColor: "#000000",
      });
    } catch (error) {
      console.error("Ошибка генерации штрих-кода:", error);
      // Fallback: простая визуализация
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(barcode, canvas.width / 2, canvas.height / 2);
    }
  }, [previewProduct]);

  if (loading) {
    return (
      <div className="barcode-print-tab">
        <div className="barcode-print-tab__loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="barcode-print-tab">
      <div className="barcode-print-tab__header">
        <div className="barcode-print-tab__search-wrapper">
          <input
            type="text"
            placeholder="Поиск по названию или штрих-коду"
            value={searchTerm || ""}
            onChange={onSearchChange}
            className="barcode-print-tab__search"
          />
        </div>

        <div className="barcode-print-tab__printer-controls">
          <div className="barcode-print-tab__printer-status">
            <span
              className={`barcode-print-tab__status-indicator ${
                isPrinterConnected
                  ? "barcode-print-tab__status-indicator--connected"
                  : "barcode-print-tab__status-indicator--disconnected"
              }`}
            />
            <span className="barcode-print-tab__status-text">
              {isPrinterConnected
                ? "Принтер подключен"
                : "Принтер не подключен"}
            </span>
          </div>

          <button
            type="button"
            className="barcode-print-tab__connect-btn"
            onClick={handleConnectPrinter}
            disabled={isConnecting}
          >
            {isConnecting ? "Подключение..." : "Подключить принтер"}
          </button>
        </div>
      </div>

      <div className="barcode-print-tab__content">
        {filteredProducts.length === 0 ? (
          <div className="barcode-print-tab__empty">
            <div className="barcode-print-tab__empty-icon">📦</div>
            <div className="barcode-print-tab__empty-text">
              Товары не найдены
            </div>
          </div>
        ) : (
          <div className="barcode-print-tab__grid">
            {filteredProducts.map((product) => (
              <div key={product.id} className="barcode-print-tab__card">
                <div className="barcode-print-tab__card-header">
                  <div className="barcode-print-tab__barcode-label">
                    Штрих-код:
                  </div>
                  <div className="barcode-print-tab__barcode-value">
                    {product.barcode || "—"}
                  </div>
                </div>
                <div className="barcode-print-tab__card-body">
                  <button
                    className="barcode-print-tab__print-btn"
                    onClick={() => handleOpenPreview(product)}
                    disabled={!product.barcode}
                    title={
                      !product.barcode
                        ? "У товара отсутствует штрих-код"
                        : "Предпросмотр и печать штрих-кода"
                    }
                  >
                    <span className="barcode-print-tab__print-icon">🖨️</span>
                    Распечатать штрих-код
                  </button>
                  <div className="barcode-print-tab__product-name">
                    {product.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка предпросмотра этикетки */}
      {previewProduct && (
        <UniversalModal
          title="Предпросмотр этикетки"
          onClose={handleClosePreview}
        >
          <div className="barcode-print-tab__preview">
            <div className="barcode-print-tab__preview-label">
              <div className="barcode-print-tab__preview-label-content">
                <div className="barcode-print-tab__preview-title">
                  {previewProduct.name || "Товар"}
                </div>
                <div className="barcode-print-tab__preview-barcode-container">
                  <div className="barcode-print-tab__preview-barcode-wrapper">
                    <canvas
                      ref={barcodeCanvasRef}
                      width={400}
                      height={80}
                      className="barcode-print-tab__preview-barcode-canvas"
                    />
                  </div>
                  <div className="barcode-print-tab__preview-barcode-text">
                    {previewProduct.barcode}
                  </div>
                </div>
              </div>
            </div>
            <div className="barcode-print-tab__preview-actions">
              <button
                type="button"
                className="barcode-print-tab__preview-cancel-btn"
                onClick={handleClosePreview}
                disabled={isPrinting}
              >
                Отмена
              </button>
              <button
                type="button"
                className="barcode-print-tab__preview-print-btn"
                onClick={handlePrintFromPreview}
                disabled={isPrinting || !isPrinterConnected}
                title={
                  !isPrinterConnected
                    ? "Принтер не подключен. Подключите принтер XP-365B."
                    : "Распечатать этикетку"
                }
              >
                {isPrinting ? (
                  <>
                    <span className="barcode-print-tab__spinner"></span>
                    Печать...
                  </>
                ) : (
                  <>
                    <span className="barcode-print-tab__print-icon">🖨️</span>
                    Распечатать
                  </>
                )}
              </button>
            </div>
          </div>
        </UniversalModal>
      )}
    </div>
  );
};

export default BarcodePrintTab;
