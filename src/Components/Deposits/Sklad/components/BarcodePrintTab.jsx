import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
 *
 * Улучшения/ошибки:
 * - printingIds раньше был “мертвым” (не использовался) — теперь реально блокирует кнопку печати конкретного товара.
 * - Canvas был 400x80, а JsBarcode рисовал height=90 → обрезало. Теперь размер canvas подстраивается под выбранный размер этикетки.
 * - Превью стало ближе к реальным пропорциям 203 DPI (dots), без магии “на глаз”.
 */
const BarcodePrintTab = ({ products, loading, searchTerm, onSearchChange }) => {
  const [printingIds, setPrintingIds] = useState(() => new Set());
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [labelSize, setLabelSize] = useState("30x20"); // размер этикетки по умолчанию
  const barcodeCanvasRef = useRef(null);

  // ====== Настройки/утилиты ======
  const DOTS_PER_MM = 8; // 203 DPI ≈ 8 dots/mm
  const PREVIEW_SCALE = 2; // масштаб для предпросмотра
  const defaultSettings = useMemo(
    () => ({
      fontId: "3",
      textScale: 0.5,
      lineGap: 22,
      gapAfterTitle: 7,
      gapAfterPrice: 4,
      barcodeRaise: 3,
      barcodeHeight: 44,
      barcodeBarWidth: 2,
    }),
    []
  );
  const [printSettings] = useState(defaultSettings);
  const {
    fontId,
    textScale,
    lineGap,
    gapAfterTitle,
    gapAfterPrice,
    barcodeRaise,
    barcodeHeight,
    barcodeBarWidth,
  } = printSettings;
  const textScaleValue = Math.max(0.5, Number(textScale) || 1);
  const fontBaseMap = useMemo(
    () => ({
      1: 4,
      2: 5,
      3: 6,
      4: 7,
      5: 8,
    }),
    []
  );

  const getBarcodeModuleCount = useCallback((codeValue) => {
    const code = String(codeValue || "");
    if (/^\d{13}$/.test(code)) return 95 + 20;
    if (/^\d{8}$/.test(code)) return 67 + 20;
    if (/^\d{12}$/.test(code)) return 95 + 20;
    return 11 * code.length + 35 + 20;
  }, []);
  const sizeMap = useMemo(
    () => ({
      "30x20": { widthMm: 30, heightMm: 20 },
      "58x40": { widthMm: 58, heightMm: 40 },
      "58x30": { widthMm: 58, heightMm: 30 },
    }),
    []
  );

  const currentLabel = sizeMap[labelSize] || sizeMap["30x20"];

  const previewLayout = useMemo(() => {
    const fontBase = fontBaseMap[Number(fontId)] ?? 6;
    const lineGapDots = Math.max(1, Math.round(lineGap));
    const textSizeDots = Math.max(3, fontBase * textScaleValue);
    const widthDots = Math.max(1, Math.round(currentLabel.widthMm * DOTS_PER_MM));
    const heightDots = Math.max(1, Math.round(currentLabel.heightMm * DOTS_PER_MM));

    return {
      widthDots,
      heightDots,
      widthPx: Math.round(widthDots * PREVIEW_SCALE),
      heightPx: Math.round(heightDots * PREVIEW_SCALE),
      scale: PREVIEW_SCALE,
      text: {
        x: 8,
        y: 10,
        lineGap: lineGapDots,
        size: textSizeDots,
      },
      barcode: {
        x: 12,
        height: Math.max(1, Math.round(barcodeHeight)),
      },
      border: {
        margin: 6,
        thick: 2,
      },
    };
  }, [
    currentLabel.widthMm,
    currentLabel.heightMm,
    lineGap,
    textScaleValue,
    barcodeHeight,
    fontId,
  ]);

  const wrapPreviewText = (text = "", width = 16, maxLines = 2) => {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    const out = [];
    let line = "";

    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length <= width) {
        line = next;
      } else {
        if (line) out.push(line);
        line = w;
      }
    }

    if (line) out.push(line);

    return out.slice(0, maxLines);
  };

  const previewWrapWidth = Math.max(6, Math.round(16 / textScaleValue));
  const previewLines = useMemo(
    () => wrapPreviewText(previewProduct?.name || "Товар", previewWrapWidth, 2),
    [previewProduct, previewWrapWidth]
  );

  const formatPrice = (value) => {
    const num = Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(num)) return "";
    return Math.round(num).toString();
  };

  const previewPriceText =
    previewProduct?.price !== undefined &&
    previewProduct?.price !== null &&
    String(previewProduct?.price).trim() !== ""
      ? `Цена: ${formatPrice(previewProduct.price)} с`
      : "";

  const previewPositions = useMemo(() => {
    const fontBase = fontBaseMap[Number(fontId)] ?? 6;
    const lineCount = Math.max(1, previewLines.length);
    const gapTitle = Math.max(0, Math.round(gapAfterTitle));
    const gapPrice = Math.max(0, Math.round(gapAfterPrice));
    const barcodeRaiseDots = Math.max(0, Math.round(barcodeRaise));
    const barcodeBottomGap = 2;
    const safePad = previewLayout.border.margin + previewLayout.border.thick;
    const safeLeft = safePad;
    const safeTop = safePad;
    const safeW = previewLayout.widthDots - safePad * 2;
    const safeH = previewLayout.heightDots - safePad * 2;
    const textBlockHeight = previewLayout.text.lineGap * lineCount;
    const priceBlockHeight = previewPriceText ? gapTitle + previewLayout.text.lineGap : 0;
    const gapToBarcode = previewPriceText ? gapPrice : gapTitle;
    const barcodeBlockHeight =
      gapToBarcode + previewLayout.barcode.height + barcodeBottomGap;
    const contentHeight = textBlockHeight + priceBlockHeight + barcodeBlockHeight;
    const startY = safeTop + Math.max(0, Math.round((safeH - contentHeight) / 2));
    const textY = startY;
    const desiredPriceY = previewPriceText
      ? textY + textBlockHeight + gapTitle
      : null;
    const barcodeY =
      textY + textBlockHeight + priceBlockHeight + gapToBarcode - barcodeRaiseDots;
    const maxBarcodeY =
      safeTop + safeH - previewLayout.barcode.height - barcodeBottomGap;
    const clampedBarcodeY = Math.min(barcodeY, maxBarcodeY);
    const maxPriceY = clampedBarcodeY - gapPrice - previewLayout.text.lineGap;
    const priceY = previewPriceText ? Math.min(desiredPriceY, maxPriceY) : null;
    const textX = safeLeft;
    const priceX = safeLeft;
    const barcodeModules = getBarcodeModuleCount(previewProduct?.barcode);
    const barcodeWidthDots = Math.round(barcodeModules * Math.max(1, barcodeBarWidth));
    const barcodeX =
      safeLeft + Math.max(0, Math.round((safeW - barcodeWidthDots) / 2));

    return { priceY, barcodeY: clampedBarcodeY, textX, priceX, barcodeX, textY };
  }, [
    previewLines.length,
    previewPriceText,
    previewLayout.text.lineGap,
    previewLayout.heightDots,
    previewLayout.border.margin,
    previewLayout.border.thick,
    previewLayout.barcode.height,
    gapAfterTitle,
    gapAfterPrice,
    barcodeRaise,
    previewLayout.widthDots,
    previewProduct,
    fontId,
    textScaleValue,
    barcodeBarWidth,
    fontBaseMap,
    getBarcodeModuleCount,
  ]);



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
      const barcode = String(p.barcode || "").toLowerCase();
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
      alert(e?.message || "Не удалось подключиться к принтеру");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenPreview = (product) => {
    const bc = String(product?.barcode || "").trim();
    if (!bc) {
      alert("У товара отсутствует штрих-код");
      return;
    }
    setPreviewProduct(product);
  };

  const handleClosePreview = () => {
    setPreviewProduct(null);
    setIsPrinting(false);
  };

  const handlePrintFromPreview = async () => {
    if (!previewProduct?.barcode) return;

    const { widthMm, heightMm } = currentLabel;
    const gapTitle = Math.max(0, Math.round(gapAfterTitle));
    const gapPrice = Math.max(0, Math.round(gapAfterPrice));
    const barcodeRaiseDots = Math.max(0, Math.round(barcodeRaise));
    const lineGapDots = Math.max(1, Math.round(lineGap));
    const textScaleForPrint = Math.max(1, Math.round(textScaleValue));
    const barcodeHeightDots = Math.max(1, Math.round(barcodeHeight));
    const barcodeBarWidthDots = Math.max(1, Math.round(barcodeBarWidth));

    setIsPrinting(true);
    setPrintingIds((prev) => {
      const next = new Set(prev);
      next.add(previewProduct.id);
      return next;
    });

    try {
      await printXp365bBarcodeLabel({
        barcode: String(previewProduct.barcode),
        title: previewProduct.name || "Товар",
        price: previewProduct.price,
        widthMm,
        heightMm,
        gapAfterTitle: gapTitle,
        gapAfterPrice: gapPrice,
        barcodeRaise: barcodeRaiseDots,
        lineGap: lineGapDots,
        textScale: textScaleForPrint,
        fontId,
        barcodeHeight: barcodeHeightDots,
        barcodeBarWidth: barcodeBarWidthDots,
      });

      const connected = await checkXp365bConnection();
      setIsPrinterConnected(connected);

      handleClosePreview();
    } catch (error) {
      console.error("Ошибка при печати на XP-365B:", error);

      const connected = await checkXp365bConnection();
      setIsPrinterConnected(connected);

      let errorMessage = "Не удалось отправить данные на принтер";

      const msg = String(error?.message || "");
      if (msg.includes("WebUSB")) {
        errorMessage = "Браузер не поддерживает WebUSB. Используйте Chrome или Edge.";
      } else if (msg.includes("не найден") || msg.includes("не найдено")) {
        errorMessage = "Принтер не подключен. Подключите принтер XP-365B и попробуйте снова.";
      } else if (msg) {
        errorMessage = msg;
      }

      alert(errorMessage);
    } finally {
      setIsPrinting(false);
      setPrintingIds((prev) => {
        const next = new Set(prev);
        next.delete(previewProduct?.id);
        return next;
      });
    }
  };

  // Генерация визуализации штрих-кода для предпросмотра
  useEffect(() => {
    if (!previewProduct || !barcodeCanvasRef.current) return;

    const canvas = barcodeCanvasRef.current;
    const barcode = String(previewProduct.barcode || "").trim();
    if (!barcode) return;

    const { scale, barcode: barcodeLayout } = previewLayout;
    const barcodeCanvasWidth = Math.round(previewLayout.widthDots * scale);
    const barcodeCanvasHeight = Math.round((barcodeLayout.height + 18) * scale);

    canvas.width = barcodeCanvasWidth;
    canvas.height = barcodeCanvasHeight;

    try {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let format = "CODE128";
      if (barcode.length === 13) format = "EAN13";
      else if (barcode.length === 8) format = "EAN8";
      else if (barcode.length === 12) format = "UPC";

      const barWidth = Math.max(1, Math.round(barcodeBarWidth * scale));
      const barHeight = Math.round(barcodeLayout.height * scale);

      JsBarcode(canvas, barcode, {
        format,
        width: barWidth,
        height: barHeight,
        displayValue: true,
        fontSize: Math.round(10 * scale * textScaleValue),
        textMargin: Math.round(2 * scale),
        margin: 0,
        background: "transparent",
        lineColor: "#000000",
      });
    } catch (error) {
      console.error("Ошибка генерации штрих-кода:", error);

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(barcode, canvas.width / 2, canvas.height / 2);
    }
  }, [
    previewProduct,
    previewLayout.widthDots,
    previewLayout.heightDots,
    previewLayout.scale,
    previewLayout.barcode.height,
    barcodeBarWidth,
    textScaleValue,
  ]);

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
          <div className="barcode-print-tab__size-select-wrapper">
            <label className="barcode-print-tab__size-label">
              Размер этикетки:
              <select
                className="barcode-print-tab__size-select"
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
              >
                <option value="30x20">30×20 мм</option>
                <option value="58x40">58×40 мм</option>
                <option value="58x30">58×30 мм</option>
              </select>
            </label>
          </div>

          <div className="barcode-print-tab__printer-status">
            <span
              className={`barcode-print-tab__status-indicator ${
                isPrinterConnected
                  ? "barcode-print-tab__status-indicator--connected"
                  : "barcode-print-tab__status-indicator--disconnected"
              }`}
            />
            <span className="barcode-print-tab__status-text">
              {isPrinterConnected ? "Принтер подключен" : "Принтер не подключен"}
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
            <div className="barcode-print-tab__empty-text">Товары не найдены</div>
          </div>
        ) : (
          <div className="barcode-print-tab__grid">
            {filteredProducts.map((product) => {
              const isItemPrinting = printingIds.has(product.id);

              return (
                <div key={product.id} className="barcode-print-tab__card">
                  <div className="barcode-print-tab__card-header">
                    <div className="barcode-print-tab__barcode-label">Штрих-код:</div>
                    <div className="barcode-print-tab__barcode-value">
                      {product.barcode || "—"}
                    </div>
                  </div>

                  <div className="barcode-print-tab__card-body">
                    <button
                      className="barcode-print-tab__print-btn"
                      onClick={() => handleOpenPreview(product)}
                      disabled={!product.barcode || isItemPrinting}
                      title={
                        !product.barcode
                          ? "У товара отсутствует штрих-код"
                          : isItemPrinting
                          ? "Идёт печать..."
                          : "Предпросмотр и печать штрих-кода"
                      }
                    >
                      <span className="barcode-print-tab__print-icon">🖨️</span>
                      {isItemPrinting ? "Печать..." : "Распечатать штрих-код"}
                    </button>

                    <div className="barcode-print-tab__product-name">{product.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewProduct && (
        <UniversalModal title="Предпросмотр этикетки" onClose={handleClosePreview}>
          <div className="barcode-print-tab__preview">
            <div className="barcode-print-tab__preview-label">
              <div
                className="barcode-print-tab__preview-label-sheet"
                style={{
                  width: `${previewLayout.widthPx}px`,
                  height: `${previewLayout.heightPx}px`,
                  "--preview-scale": previewLayout.scale,
                }}
              >
                <div
                  className="barcode-print-tab__preview-border"
                  style={{
                    inset: `${previewLayout.border.margin * previewLayout.scale}px`,
                    borderWidth: `${previewLayout.border.thick * previewLayout.scale}px`,
                  }}
                />

                {previewLines.map((line, i) => (
                  <div
                    key={`${line}-${i}`}
                    className="barcode-print-tab__preview-title-line"
                    style={{
                      left: `${previewPositions.textX * previewLayout.scale}px`,
                      top: `${
                        (previewPositions.textY +
                          previewLayout.text.lineGap * i) *
                        previewLayout.scale
                      }px`,
                      fontSize: `${previewLayout.text.size * previewLayout.scale}px`,
                    }}
                  >
                    {line}
                  </div>
                ))}

                <canvas
                  ref={barcodeCanvasRef}
                  className="barcode-print-tab__preview-barcode-canvas"
                  style={{
                    left: `${previewPositions.barcodeX * previewLayout.scale}px`,
                    top: `${previewPositions.barcodeY * previewLayout.scale}px`,
                  }}
                />

                {previewPriceText && (
                    <div
                      className="barcode-print-tab__preview-price"
                      style={{
                        left: `${previewPositions.priceX * previewLayout.scale}px`,
                        top: `${previewPositions.priceY * previewLayout.scale}px`,
                        fontSize: `${previewLayout.text.size * previewLayout.scale}px`,
                      }}
                    >
                      {previewPriceText}
                    </div>
                  )}
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
