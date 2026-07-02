import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { getBarcodePrintEncoding } from "../../../../../tools/productBarcode";
import "./BarcodeA4PrintModal.scss";

/** Один штрих-код на canvas (динамический предпросмотр + печать). */
const A4Barcode = ({ value, height = 48, barWidth = 1.6 }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let code = String(value || "").trim();
    let format = "CODE128";
    try {
      const enc = getBarcodePrintEncoding(code);
      code = enc.code;
      format = enc.format;
    } catch {
      code = code.replace(/\D/g, "") || code;
    }
    const jsFormat =
      format === "EAN8" ? "EAN8" : format === "EAN13" ? "EAN13" : "CODE128";
    try {
      JsBarcode(canvas, code, {
        format: jsFormat,
        width: barWidth,
        height,
        displayValue: true,
        fontSize: 13,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      const ctx = canvas.getContext("2d");
      canvas.width = 180;
      canvas.height = height + 16;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(code, canvas.width / 2, canvas.height / 2);
    }
  }, [value, height, barWidth]);
  return <canvas ref={ref} className="barcode-a4__canvas" />;
};

const fmtPrice = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n).toString() : "";
};

const numPrice = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Инлайн-стиль поля из настроек (размер/жирный/курсив/подчёркнутый). */
const styleToCss = (st = {}) => ({
  fontSize: `${Math.max(6, Number(st.size) || 12)}px`,
  fontWeight: st.bold ? 800 : 500,
  fontStyle: st.italic ? "italic" : "normal",
  textDecoration: st.underline ? "underline" : "none",
  lineHeight: 1.2,
});

/** Строка настройки поля: вкл/выкл + размер шрифта + Ж/К/П. */
const FieldStyleRow = ({ label, enabled, onToggle, style, onStyle, noFont }) => (
  <div className="barcode-a4-fs">
    <label className="barcode-a4-fs__head">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span>{label}</span>
    </label>
    {enabled && !noFont && (
      <div className="barcode-a4-fs__ctrls">
        <input
          className="barcode-a4-fs__size"
          type="number"
          min={6}
          max={60}
          value={style.size}
          onChange={(e) => onStyle({ size: Number(e.target.value) })}
          title="Размер шрифта, px"
        />
        <button
          type="button"
          className={`barcode-a4-fs__btn${style.bold ? " is-on" : ""}`}
          onClick={() => onStyle({ bold: !style.bold })}
          title="Жирный"
        >
          <b>Ж</b>
        </button>
        <button
          type="button"
          className={`barcode-a4-fs__btn${style.italic ? " is-on" : ""}`}
          onClick={() => onStyle({ italic: !style.italic })}
          title="Курсив"
        >
          <i>К</i>
        </button>
        <button
          type="button"
          className={`barcode-a4-fs__btn${style.underline ? " is-on" : ""}`}
          onClick={() => onStyle({ underline: !style.underline })}
          title="Подчёркнутый"
        >
          <u>П</u>
        </button>
      </div>
    )}
  </div>
);

/**
 * Печать штрих-кодов на листе A4.
 * Динамически: кол-во товаров в ряд, копии, какие данные показывать
 * (штрих-код, цена, название, описание) + заголовок листа.
 */
const BarcodeA4PrintModal = ({ products = [], onClose }) => {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(8);
  const [copies, setCopies] = useState(1);
  const [showName, setShowName] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showPlu, setShowPlu] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [fieldStyles, setFieldStyles] = useState({
    name: { size: 12, bold: true, italic: false, underline: false },
    price: { size: 16, bold: true, italic: false, underline: false },
    oldPrice: { size: 12, bold: false, italic: false, underline: false },
    plu: { size: 12, bold: true, italic: false, underline: false },
    description: { size: 10, bold: false, italic: false, underline: false },
  });
  const setFS = (key, patch) =>
    setFieldStyles((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  const [headerText, setHeaderText] = useState("");
  const [barcodeHeight, setBarcodeHeight] = useState(48);
  const [orientation, setOrientation] = useState("portrait"); // portrait | landscape
  const isLandscape = orientation === "landscape";

  const colsValue = Math.max(1, Math.min(6, Math.round(Number(cols) || 1)));
  const rowsValue = Math.max(1, Math.min(20, Math.round(Number(rows) || 1)));
  const copiesValue = Math.max(1, Math.min(50, Math.round(Number(copies) || 1)));

  // Разворачиваем список: каждый товар × копии
  const labels = useMemo(() => {
    const withBc = (products || []).filter((p) =>
      String(p.barcode || "").trim(),
    );
    const out = [];
    withBc.forEach((p) => {
      for (let i = 0; i < copiesValue; i += 1) out.push(p);
    });
    return out;
  }, [products, copiesValue]);

  return (
    <div className="barcode-a4-overlay" role="presentation" onClick={onClose}>
      <div
        className="barcode-a4-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Печать на A4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Панель настроек — не печатается */}
        <div className="barcode-a4-modal__panel barcode-a4-no-print">
          <div className="barcode-a4-modal__panel-head">
            <h2 className="barcode-a4-modal__title">Печать на A4</h2>
            <button
              type="button"
              className="barcode-a4-modal__close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <label className="barcode-a4-modal__field">
            <span>Заголовок листа (адрес и т.п.)</span>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Напр.: ИП «Ромашка», г. Бишкек…"
            />
          </label>

          <label className="barcode-a4-modal__field">
            <span>Ориентация листа</span>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
            >
              <option value="portrait">Книжная (вертикальная)</option>
              <option value="landscape">Альбомная (горизонтальная)</option>
            </select>
          </label>

          <div className="barcode-a4-modal__row">
            <label className="barcode-a4-modal__field">
              <span>Товаров в ряд</span>
              <input
                type="number"
                min={1}
                max={6}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
              />
            </label>
            <label className="barcode-a4-modal__field">
              <span>Строк на лист</span>
              <input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                title="Меньше строк — крупнее этикетки (напр. 2 строки на весь лист)"
              />
            </label>
            <label className="barcode-a4-modal__field">
              <span>Копий каждого</span>
              <input
                type="number"
                min={1}
                max={50}
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              />
            </label>
          </div>

          <label className="barcode-a4-modal__field">
            <span>Высота штрих-кода: {barcodeHeight}px</span>
            <input
              type="range"
              min={28}
              max={80}
              value={barcodeHeight}
              onChange={(e) => setBarcodeHeight(Number(e.target.value))}
            />
          </label>

          <div className="barcode-a4-modal__fields">
            <FieldStyleRow
              label="Штрих-код"
              enabled={showBarcode}
              onToggle={setShowBarcode}
              noFont
            />
            <FieldStyleRow
              label="Название"
              enabled={showName}
              onToggle={setShowName}
              style={fieldStyles.name}
              onStyle={(p) => setFS("name", p)}
            />
            <FieldStyleRow
              label="Цена"
              enabled={showPrice}
              onToggle={setShowPrice}
              style={fieldStyles.price}
              onStyle={(p) => setFS("price", p)}
            />
            <FieldStyleRow
              label="Скидка (зачеркнуть старую цену)"
              enabled={showDiscount}
              onToggle={setShowDiscount}
              style={fieldStyles.oldPrice}
              onStyle={(p) => setFS("oldPrice", p)}
            />
            <FieldStyleRow
              label="ПЛУ"
              enabled={showPlu}
              onToggle={setShowPlu}
              style={fieldStyles.plu}
              onStyle={(p) => setFS("plu", p)}
            />
            <FieldStyleRow
              label="Описание"
              enabled={showDescription}
              onToggle={setShowDescription}
              style={fieldStyles.description}
              onStyle={(p) => setFS("description", p)}
            />
          </div>

          <div className="barcode-a4-modal__summary">
            Товаров с штрих-кодом:{" "}
            {(products || []).filter((p) => String(p.barcode || "").trim()).length}
            {" · "}Этикеток на листах: {labels.length}
          </div>

          <div className="barcode-a4-modal__actions">
            <button
              type="button"
              className="barcode-a4-modal__btn barcode-a4-modal__btn--ghost"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="button"
              className="barcode-a4-modal__btn barcode-a4-modal__btn--primary"
              onClick={() => window.print()}
              disabled={!labels.length}
            >
              🖨️ Печать A4
            </button>
          </div>
        </div>

        {/* Ориентация листа при печати (динамически) */}
        <style>{`@media print { @page { size: A4 ${orientation}; margin: 10mm; } }`}</style>

        {/* Область печати — лист A4 */}
        <div className="barcode-a4-modal__previewWrap">
          <div className="barcode-a4-print-area">
            <div
              className={`barcode-a4-sheet${isLandscape ? " barcode-a4-sheet--landscape" : ""}`}
            >
              {headerText.trim() && (
                <div className="barcode-a4-sheet__header">{headerText}</div>
              )}
              {labels.length === 0 ? (
                <div className="barcode-a4-sheet__empty barcode-a4-no-print">
                  Нет товаров с штрих-кодом для печати.
                </div>
              ) : (
                <div
                  className="barcode-a4-sheet__grid"
                  style={{ "--a4-cols": colsValue, "--a4-rows": rowsValue }}
                >
                  {labels.map((p, idx) => {
                    const priceNow = fmtPrice(p.price);
                    const dp = Number(p.discount_percent ?? p.discount ?? 0) || 0;
                    let oldPrice = "";
                    let newPrice = priceNow;
                    if (showDiscount) {
                      const explicitOld = fmtPrice(
                        p.old_price ?? p.price_old ?? p.compare_at_price ?? "",
                      );
                      if (explicitOld && numPrice(explicitOld) > numPrice(priceNow)) {
                        oldPrice = explicitOld;
                        newPrice = priceNow;
                      } else if (dp > 0) {
                        oldPrice = priceNow;
                        newPrice = fmtPrice(numPrice(p.price) * (1 - dp / 100));
                      }
                    }
                    const hasDiscount = Boolean(oldPrice && oldPrice !== newPrice);
                    return (
                      <div className="barcode-a4__label" key={`${p.id}-${idx}`}>
                        {showName && (
                          <div
                            className="barcode-a4__name"
                            style={styleToCss(fieldStyles.name)}
                          >
                            {p.name}
                          </div>
                        )}
                        {showBarcode && (
                          <div className="barcode-a4__bc">
                            <A4Barcode value={p.barcode} height={barcodeHeight} />
                          </div>
                        )}
                        {showPrice &&
                          priceNow &&
                          (hasDiscount ? (
                            <div className="barcode-a4__price-wrap">
                              <span
                                className="barcode-a4__old"
                                style={{
                                  ...styleToCss(fieldStyles.oldPrice),
                                  textDecoration: fieldStyles.oldPrice.underline
                                    ? "line-through underline"
                                    : "line-through",
                                }}
                              >
                                {oldPrice} с
                              </span>
                              <span
                                className="barcode-a4__price"
                                style={styleToCss(fieldStyles.price)}
                              >
                                {newPrice} с
                              </span>
                              {dp > 0 && (
                                <span className="barcode-a4__badge">−{dp}%</span>
                              )}
                            </div>
                          ) : (
                            <div
                              className="barcode-a4__price"
                              style={styleToCss(fieldStyles.price)}
                            >
                              {priceNow} с
                            </div>
                          ))}
                        {showPlu && String(p.plu ?? "").trim() && (
                          <div
                            className="barcode-a4__plu"
                            style={styleToCss(fieldStyles.plu)}
                          >
                            ПЛУ: {p.plu}
                          </div>
                        )}
                        {showDescription &&
                          String(p.description || p.desc || "").trim() && (
                            <div
                              className="barcode-a4__desc"
                              style={styleToCss(fieldStyles.description)}
                            >
                              {p.description || p.desc}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeA4PrintModal;
