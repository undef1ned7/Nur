import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";
import { getBarcodePrintEncoding } from "../../../../../tools/productBarcode";
import NumberInput from "./NumberInput";
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
        <NumberInput
          className="barcode-a4-fs__size"
          min={6}
          max={60}
          fallback={12}
          value={style.size}
          onCommit={(size) => onStyle({ size })}
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

/** Одна этикетка на листе A4. */
const A4Label = ({
  p,
  showName,
  showBarcode,
  showPrice,
  showDiscount,
  showPlu,
  showDescription,
  fieldStyles,
  barcodeHeight,
}) => {
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
    <div className="barcode-a4__label">
      {showName && (
        <div className="barcode-a4__name" style={styleToCss(fieldStyles.name)}>
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
            {dp > 0 && <span className="barcode-a4__badge">−{dp}%</span>}
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
        <div className="barcode-a4__plu" style={styleToCss(fieldStyles.plu)}>
          ПЛУ: {p.plu}
        </div>
      )}
      {showDescription && String(p.description || p.desc || "").trim() && (
        <div
          className="barcode-a4__desc"
          style={styleToCss(fieldStyles.description)}
        >
          {p.description || p.desc}
        </div>
      )}
    </div>
  );
};

const clampCopies = (value, fallback = 1) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(50, n));
};

/**
 * Печать штрих-кодов на листе A4.
 * Динамически: кол-во товаров в ряд, копии (общие и для каждой позиции),
 * какие данные показывать (штрих-код, цена, название, описание) + заголовок листа.
 * Этикетки разбиваются на отдельные листы A4 (cols × rows на лист).
 */
const BarcodeA4PrintModal = ({ products = [], onClose }) => {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(8);
  const [copies, setCopies] = useState(1);
  // Копии для каждой позиции отдельно: { [productId]: number }
  const [copiesById, setCopiesById] = useState({});
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

  const printable = useMemo(
    () => (products || []).filter((p) => String(p.barcode || "").trim()),
    [products],
  );

  // Копии позиции: своё значение, иначе значение из карточки товара, иначе общее
  const getCopies = useCallback(
    (p) => clampCopies(copiesById[p.id] ?? p.__copies ?? copiesValue, copiesValue),
    [copiesById, copiesValue],
  );

  // Разворачиваем список: каждый товар × его копии
  const labels = useMemo(() => {
    const out = [];
    printable.forEach((p) => {
      const n = getCopies(p);
      for (let i = 0; i < n; i += 1) out.push(p);
    });
    return out;
  }, [printable, getCopies]);

  // Разбиение на листы: cols × rows этикеток на один лист A4
  const perPage = Math.max(1, colsValue * rowsValue);
  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < labels.length; i += perPage) {
      out.push(labels.slice(i, i + perPage));
    }
    return out;
  }, [labels, perPage]);

  /* Рендерим в body: иначе при печати листы остаются внутри слоёв CRM
     (overflow/transform у Layout), браузер обрезает всё после первой страницы. */
  return createPortal(
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
              <NumberInput
                min={1}
                max={6}
                fallback={3}
                value={colsValue}
                onCommit={setCols}
              />
            </label>
            <label className="barcode-a4-modal__field">
              <span>Строк на лист</span>
              <NumberInput
                min={1}
                max={20}
                fallback={8}
                value={rowsValue}
                onCommit={setRows}
                title="Меньше строк — крупнее этикетки (напр. 2 строки на весь лист)"
              />
            </label>
            <label className="barcode-a4-modal__field">
              <span>Копий каждого</span>
              <NumberInput
                min={1}
                max={50}
                fallback={1}
                value={copiesValue}
                onCommit={setCopies}
                title="Значение по умолчанию для всех позиций"
              />
            </label>
          </div>

          {/* Копии для каждой позиции отдельно */}
          <div className="barcode-a4-modal__field">
            <span>Копии по позициям</span>
            <div className="barcode-a4-copies">
              <div className="barcode-a4-copies__head">
                <button
                  type="button"
                  className="barcode-a4-copies__reset"
                  onClick={() => setCopiesById({})}
                  disabled={Object.keys(copiesById).length === 0}
                  title="Вернуть всем позициям общее значение"
                >
                  Сбросить к общему ({copiesValue})
                </button>
              </div>
              <div className="barcode-a4-copies__list">
                {printable.length === 0 ? (
                  <div className="barcode-a4-copies__empty">
                    Нет товаров с штрих-кодом
                  </div>
                ) : (
                  printable.map((p) => (
                    <div className="barcode-a4-copies__row" key={p.id}>
                      <span
                        className="barcode-a4-copies__name"
                        title={`${p.name || "Товар"} · ${p.barcode}`}
                      >
                        {p.name || "Товар"}
                      </span>
                      <NumberInput
                        className="barcode-a4-copies__input"
                        min={1}
                        max={50}
                        step={1}
                        fallback={copiesValue}
                        value={getCopies(p)}
                        onCommit={(next) =>
                          setCopiesById((prev) => ({ ...prev, [p.id]: next }))
                        }
                        title="Сколько копий этой позиции печатать"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
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
            Товаров с штрих-кодом: {printable.length}
            {" · "}Этикеток: {labels.length}
            {" · "}Листов: {pages.length} (по {perPage} на лист)
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

        {/* Область печати — листы A4 (по одному на каждые cols × rows этикеток) */}
        <div className="barcode-a4-modal__previewWrap">
          <div className="barcode-a4-print-area">
            {pages.length === 0 ? (
              <div
                className={`barcode-a4-sheet${isLandscape ? " barcode-a4-sheet--landscape" : ""}`}
              >
                <div className="barcode-a4-sheet__empty barcode-a4-no-print">
                  Нет товаров с штрих-кодом для печати.
                </div>
              </div>
            ) : (
              pages.map((pageLabels, pageIdx) => (
                <div className="barcode-a4-page" key={`page-${pageIdx}`}>
                  <div
                    className={`barcode-a4-sheet${isLandscape ? " barcode-a4-sheet--landscape" : ""}${
                      headerText.trim() ? " barcode-a4-sheet--with-header" : ""
                    }`}
                  >
                    {headerText.trim() && (
                      <div className="barcode-a4-sheet__header">{headerText}</div>
                    )}
                    <div
                      className="barcode-a4-sheet__grid"
                      style={{ "--a4-cols": colsValue, "--a4-rows": rowsValue }}
                    >
                      {pageLabels.map((p, idx) => (
                        <A4Label
                          key={`${p.id}-${pageIdx}-${idx}`}
                          p={p}
                          showName={showName}
                          showBarcode={showBarcode}
                          showPrice={showPrice}
                          showDiscount={showDiscount}
                          showPlu={showPlu}
                          showDescription={showDescription}
                          fieldStyles={fieldStyles}
                          barcodeHeight={barcodeHeight}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="barcode-a4-page__caption barcode-a4-no-print">
                    Лист {pageIdx + 1} из {pages.length}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default BarcodeA4PrintModal;
