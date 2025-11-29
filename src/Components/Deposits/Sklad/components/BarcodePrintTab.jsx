import { useMemo, useState, useEffect } from "react";
import "./BarcodePrintTab.scss";
import {
  printXp365bBarcodeLabel,
  attachXp365bUsbListenersOnce,
  checkXp365bConnection,
  connectXp365bManually,
} from "../services/xp365bPrintService";

const BarcodePrintTab = ({ products, loading, searchTerm, onSearchChange }) => {
  const [printingIds, setPrintingIds] = useState(new Set());
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    attachXp365bUsbListenersOnce();
  }, []);

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

  const handlePrintBarcode = async (product) => {
    if (!product.barcode) {
      alert("У товара отсутствует штрих-код");
      return;
    }

    setPrintingIds((prev) => new Set(prev).add(product.id));

    try {
      await printXp365bBarcodeLabel({
        barcode: product.barcode,
        title: product.name || "Товар",
        copies: 1,
        widthMm: 40,
        heightMm: 30,
      });

      const connected = await checkXp365bConnection();
      setIsPrinterConnected(connected);
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
      setPrintingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

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
                    onClick={() => handlePrintBarcode(product)}
                    disabled={
                      printingIds.has(product.id) ||
                      !product.barcode ||
                      !isPrinterConnected
                    }
                    title={
                      !product.barcode
                        ? "У товара отсутствует штрих-код"
                        : !isPrinterConnected
                        ? "Принтер не подключен. Подключите принтер XP-365B."
                        : "Распечатать штрих-код"
                    }
                  >
                    {printingIds.has(product.id) ? (
                      <>
                        <span className="barcode-print-tab__spinner"></span>
                        Печать...
                      </>
                    ) : (
                      <>
                        <span className="barcode-print-tab__print-icon">
                          🖨️
                        </span>
                        Распечатать штрих-код
                      </>
                    )}
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
    </div>
  );
};

export default BarcodePrintTab;
