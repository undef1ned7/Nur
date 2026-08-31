/**
 * Print Service
 * Модуль для работы с печатью чеков через WebUSB и ESC/POS принтеры
 */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

const DEFAULT_DOTS_PER_LINE = 576; // 80 мм бумага (~203 dpi / 8 dot/mm)
const MARKET_DEFAULT_DOTS_PER_LINE = 576; // 80 мм бумага
const MARKET_DEFAULT_CHARS_PER_LINE = 48;
const DEFAULT_FONT = "B";
const DEFAULT_CODEPAGE = 17; // PC866 (часто 17 или 66)

const safeLsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeLsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return localStorage.getItem(k) === String(v);
  } catch {
    return false;
  }
};
const safeNumber = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const safeByte = (raw, fallback) => {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  if (!s) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  const b = Math.trunc(n);
  return b >= 0 && b <= 255 ? b : fallback;
};

function hasEscposWidthSettings() {
  return safeLsGet("escpos_dpl") != null || safeLsGet("escpos_cpl") != null;
}

// Быстрые тюнеры (пригодятся в консоли):
export function setEscposDotsPerLine(n) {
  return safeLsSet("escpos_dpl", String(n));
}
export function setEscposCharsPerLine(n) {
  return safeLsSet("escpos_cpl", String(n));
}
export function setEscposLineHeight(n) {
  return safeLsSet("escpos_line", String(n));
}
export function setEscposFont(ch) {
  return safeLsSet("escpos_font", String(ch).toUpperCase());
}

const ESC = (...b) => new Uint8Array(b);
const chunkBytes = (u8, size = 12 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * «Прогрев» принтера перед растром. После первого USB claim / холодного старта
 * часть моделей теряет первые байты (ESC @ + заголовок GS v 0) → весь bitmap
 * печатается как «иероглифы»; вторая печать уже нормальная.
 */
async function wakeEscPosPrinter(dev, outEP) {
  const init = ESC(0x1b, 0x40);
  await dev.transferOut(outEP, init);
  await sleepMs(80);
  await dev.transferOut(outEP, init);
  await sleepMs(40);
}

/* ---------- Кодовые страницы и энкодеры ---------- */
// Поддерживаемые кодовые страницы для кириллицы:
// 73 — CP1251 (часто встречается у Xprinter) - по умолчанию
// 66 — PC866 (часто встречается у Xprinter по self-test)
// 17 — PC866 (часто стандартный номер таблицы в ESC/POS)
// 59 — PC866(Russian) - альтернативный вариант для русской кириллицы
// 18 — PC852 (Latin2, также поддерживает PC866)
// 22 — CP1251 (альтернативный код)
// ====== ЖЁСТКАЯ НАСТРОЙКА ДЛЯ XP-N160II: PC866 ======
// Важно: у части Xprinter (в т.ч. XP-N160II) PC866 на ESC/POS бывает как 17 или 66.
// Если будет "корябяза", поменяйте 17 <-> 66.
// printRussianRawUsb("Тест: Привет, мир! Ёё №");
export function setEscposCodepage(n) {
  return safeLsSet("escpos_cp", String(n));
}

const GRAPHIC_LS_KEY = "escpos_graphic";

/** Graphic (canvas → GS v 0) включён в настройках POS. По умолчанию — да. */
export function isEscposGraphicPrintEnabled() {
  const raw = safeLsGet(GRAPHIC_LS_KEY);
  if (raw == null || String(raw).trim() === "") return true;
  const s = String(raw).trim().toLowerCase();
  if (s === "0" || s === "false" || s === "text") return false;
  return true;
}

export function setEscposGraphicPrint(enabled) {
  return safeLsSet(GRAPHIC_LS_KEY, enabled ? "1" : "0");
}

function resolveGraphicPrint(options = {}) {
  if (options.graphic === true) return true;
  if (options.graphic === false) return false;
  return isEscposGraphicPrintEnabled();
}

const PC866_CODES = new Set([66, 17, 18, 59]); // 17 — частый ESC/POS номер PC866, 59 — PC866(Russian)
const CP1251_CODES = new Set([73, 22]);
const PC936_CODES = new Set([255]);

function encodeCP1251(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c === 0x0401) out.push(0xa8);
    else if (c === 0x0451) out.push(0xb8);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0xc0 + (c - 0x0410));
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xe0 + (c - 0x0430));
    else if (c === 0x2116) out.push(0xb9);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
function encodePC866(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0x80 + (c - 0x0410));
    // PC866: строчные а..п идут 0xA0..0xAF, а р..я идут 0xE0..0xEF
    else if (c >= 0x0430 && c <= 0x043f) out.push(0xa0 + (c - 0x0430));
    else if (c >= 0x0440 && c <= 0x044f) out.push(0xe0 + (c - 0x0440));
    else if (c === 0x0401) out.push(0xf0);
    else if (c === 0x0451) out.push(0xf1);
    else if (c === 0x2116) out.push(0xfc);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
const getEncoder = (n) =>
  PC866_CODES.has(n)
    ? encodePC866
    : CP1251_CODES.has(n)
      ? encodeCP1251
      : PC936_CODES.has(n)
        ? encodePC936
        : encodeCP1251;
function encodePC936(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
/** Рекомендуемое число символов в строке по ширине ленты. */
export function computeEscposCharsPerLine(dotsPerLine, _font = "B") {
  const dpl = Math.max(200, Number(dotsPerLine) || DEFAULT_DOTS_PER_LINE);
  // Эталон 48 мм: 384 × 32 ≈ 12 точек на символ. Пропорция сохраняет физический
  // кегль на 80 мм (576 → 48), а не floor(576/9)=64 с мелким текстом.
  const chars = Math.round(
    (dpl * MARKET_DEFAULT_CHARS_PER_LINE) / MARKET_DEFAULT_DOTS_PER_LINE,
  );
  return Math.max(16, chars);
}

/** Старый расчёт floor(dpl/9) давал 64 символа на 80 мм — мелкий graphic-кегль. */
export function maybeMigrateLegacyCharsPerLine(dotsPerLine, charsPerLine, font = "B") {
  const dpl = Math.max(200, Number(dotsPerLine) || DEFAULT_DOTS_PER_LINE);
  const cpl = Math.max(16, Number(charsPerLine) || 16);
  const f = String(font).toUpperCase() === "A" ? "A" : "B";
  const charDotWidth = f === "B" ? 9 : 12;
  const legacyDense = Math.floor(dpl / charDotWidth);
  const recommended = computeEscposCharsPerLine(dpl, f);
  if (cpl === legacyDense && legacyDense !== recommended) return recommended;
  return cpl;
}

const LEGACY_CPL_MIGRATION_KEY = "escpos_legacy_cpl_migrated";

/**
 * Читает escpos_cpl из localStorage.
 * Одноразовая миграция старых dense-значений (floor(dpl/9)); после неё значение
 * не перезаписывается — иначе сохранённые вручную настройки «сбрасывались».
 */
export function readEscposCharsPerLine(dotsPerLine, font, fallbackChars) {
  const raw = safeLsGet("escpos_cpl");
  if (raw == null || String(raw).trim() === "") {
    return fallbackChars;
  }
  let cpl = safeNumber(raw, fallbackChars);
  if (safeLsGet(LEGACY_CPL_MIGRATION_KEY)) {
    return cpl;
  }
  const migrated = maybeMigrateLegacyCharsPerLine(dotsPerLine, cpl, font);
  if (migrated !== cpl) {
    safeLsSet("escpos_cpl", String(migrated));
    cpl = migrated;
  }
  safeLsSet(LEGACY_CPL_MIGRATION_KEY, "1");
  return cpl;
}

/** Сохраняет escpos_* в localStorage; возвращает false при ошибке записи. */
export function persistEscposSettings({
  dotsPerLine,
  charsPerLine,
  lineHeight,
  font,
  codepage,
  graphicPrint,
}) {
  const dpl = Math.max(200, Number(dotsPerLine || 0));
  const cpl = Math.max(16, Number(charsPerLine || 0));
  const lh = Math.max(10, Number(lineHeight || 0));
  const f = String(font || DEFAULT_FONT).toUpperCase() === "A" ? "A" : "B";
  const cp = Number(codepage ?? DEFAULT_CODEPAGE);

  const ok =
    setEscposDotsPerLine(dpl) &&
    setEscposCharsPerLine(cpl) &&
    setEscposLineHeight(lh) &&
    setEscposFont(f) &&
    setEscposGraphicPrint(Boolean(graphicPrint)) &&
    (Number.isFinite(cp) && cp >= 0 && cp <= 255
      ? setEscposCodepage(cp)
      : true);

  return Boolean(ok);
}

/** ESC/POS: шрифт (ESC M) и межстрочный интервал (ESC 3) из настроек escpos_*. */
export function buildEscPosPrinterSetup(cfg = {}) {
  const font = String(cfg.font || DEFAULT_FONT).toUpperCase() === "A" ? "A" : "B";
  const lineDotHeight = Math.min(
    255,
    Math.max(
      1,
      Math.round(Number(cfg.lineDotHeight) || (font === "B" ? 22 : 24)),
    ),
  );
  return [
    ESC(0x1b, 0x4d, font === "A" ? 0 : 1),
    ESC(0x1b, 0x33, lineDotHeight),
  ];
}

export function getEscposRuntimeConfig(opts = {}) {
  const useMarketDefault =
    Boolean(opts.marketDefault) && !hasEscposWidthSettings();
  const fontRaw = String(
    safeLsGet("escpos_font") || DEFAULT_FONT,
  ).toUpperCase();
  const font = fontRaw === "A" ? "A" : "B";
  const charDotWidth = font === "B" ? 9 : 12;

  const fallbackDots = useMarketDefault
    ? MARKET_DEFAULT_DOTS_PER_LINE
    : DEFAULT_DOTS_PER_LINE;
  const dotsPerLine = safeNumber(safeLsGet("escpos_dpl"), fallbackDots);
  const fallbackChars = useMarketDefault
    ? MARKET_DEFAULT_CHARS_PER_LINE
    : computeEscposCharsPerLine(dotsPerLine, font);
  const charsPerLine = readEscposCharsPerLine(dotsPerLine, font, fallbackChars);
  const lineDotHeight = safeNumber(
    safeLsGet("escpos_line"),
    font === "B" ? 22 : 24,
  );
  const codepage = safeByte(safeLsGet("escpos_cp"), DEFAULT_CODEPAGE);
  const encoder = getEncoder(codepage);

  return {
    font,
    charDotWidth,
    dotsPerLine,
    charsPerLine,
    lineDotHeight,
    codepage,
    encoder,
  };
}

/* ---------- PDF → растер ---------- */
async function ensurePdfJs() {
  if (typeof window === "undefined") throw new Error("No window");
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Не удалось загрузить pdf.js"));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}
async function pdfBlobToCanvas(pdfBlob, targetWidth = 576) {
  const pdfjsLib = await ensurePdfJs();
  const ab = await pdfBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport.width;
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = Math.round(scaled.width);
  canvas.height = Math.round(scaled.height);
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas;
}
function canvasToRasterBytes(canvas, threshold = 180) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h).data;
  const bytesPerLine = Math.ceil(w / 8);
  const raster = new Uint8Array(bytesPerLine * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = img[i],
        g = img[i + 1],
        b = img[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < threshold)
        raster[y * bytesPerLine + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { raster, w, h, bytesPerLine };
}
function concatUint8Arrays(parts) {
  const list = (parts || []).filter(Boolean);
  const totalLen = list.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let o = 0;
  for (const p of list) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function buildEscPosForRaster(raster, bytesPerLine, h, opts = {}) {
  const withCut = opts.withCut !== false;
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = h & 0xff;
  const yH = (h >> 8) & 0xff;

  const init = ESC(0x1b, 0x40);
  const alignLeft = ESC(0x1b, 0x61, 0x00);
  const header = ESC(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  // компактная подача + рез
  const feedAndCut = withCut
    ? new Uint8Array([0x1b, 0x64, 0x01, 0x1d, 0x56, 0x00])
    : null;

  return concatUint8Arrays([init, alignLeft, header, raster, feedAndCut]);
}

/* ---------- JSON → ESC/POS ---------- */
const money = (n) => Number(n || 0).toFixed(2);
function lr(left, right, width = 32) {
  const L = String(left ?? "");
  const R = String(right ?? "");
  const spaces = Math.max(1, width - L.length - R.length);
  return L + " ".repeat(spaces) + R;
}

/** Как lr, но левая часть усекается, чтобы правая (цена) всегда влезла. */
function lrFit(left, right, width = 32) {
  const R = String(right ?? "");
  const maxLeft = Math.max(1, width - R.length - 1);
  let L = String(left ?? "");
  if (L.length > maxLeft) {
    L = maxLeft <= 1 ? "…" : `${L.slice(0, maxLeft - 1)}…`;
  }
  return lr(L, R, width);
}

/** Заголовок колонок товаров: на узкой ленте короче, чтобы влезло «Итого». */
function marketItemsHeaderLeft(width) {
  return width < 36 ? "Цена x Кол" : "Цена x Кол-о - Скидка";
}

/** lr с учётом ESC ! (двойная ширина — в 2 раза меньше символов в строке). */
function lrSized(left, right, width, escSize = 0) {
  const isDoubleWidth = (escSize & 0x20) !== 0;
  const lineWidth = isDoubleWidth ? Math.max(12, Math.floor(width / 2)) : width;
  return lr(left, right, lineWidth);
}

/** Одна ячейка фиксированной ширины для узкого чека (моноширинная логика). */
function fitCell(str, w, align = "L") {
  let t = String(str ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (t.length > w) {
    if (w <= 1) return "…";
    t = `${t.slice(0, Math.max(0, w - 1))}…`;
  }
  if (align === "R") return t.padStart(w, " ");
  return t.padEnd(w, " ");
}

/** Перенос названия товара по словам для ширины чека. */
function wrapReceiptName(text, maxWidth) {
  const t = String(text || "").trim();
  if (!t) return [""];
  if (maxWidth < 1) return [t.slice(0, 1)];
  const words = t.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    if (word.length > maxWidth) {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      for (let i = 0; i < word.length; i += maxWidth) {
        lines.push(word.slice(i, i + maxWidth));
      }
      continue;
    }
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= maxWidth) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Левая часть строки позиции маркета: «Цена x Кол-о» или «Цена x Кол-о - Скидка». */
function buildMarketItemLineLeft(price, qty, lineDiscountAmt) {
  const base = `${money(price)} x ${qty}`;
  const amt = Math.max(0, toNum(lineDiscountAmt));
  if (amt <= 0) return base;
  return `${base} - ${formatMarketLineDiscountCell(lineDiscountAmt)}`;
}

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Колонка «скидка» в строке маркета: «0» или сумма в сомах. */
function formatMarketLineDiscountCell(lineDiscountAmt) {
  const amt = Math.max(0, toNum(lineDiscountAmt));
  if (amt <= 0) return "0";
  return money(amt).replace(/\.00$/, "");
}

/** Акценты ESC/POS для чека маркета (без слишком крупного шрифта). */
function pushReceiptBoldOn(chunks) {
  chunks.push(ESC(0x1b, 0x45, 0x01));
}

function pushReceiptBoldOff(chunks) {
  chunks.push(ESC(0x1b, 0x45, 0x00));
}

function pushReceiptSlightLargeOn(chunks) {
  chunks.push(ESC(0x1b, 0x21, 0x08));
}

function pushReceiptMediumLargeOn(chunks) {
  chunks.push(ESC(0x1b, 0x21, 0x10));
}

/** Пропорционально крупнее (ширина + высота), без «вытянутого» вида. */
function pushReceiptProportionalLargeOn(chunks) {
  chunks.push(ESC(0x1b, 0x21, 0x30));
}

function pushReceiptSizeOff(chunks) {
  chunks.push(ESC(0x1b, 0x21, 0x00));
}

function pushMarketItemHeaderRow(chunks, enc, width) {
  pushReceiptBoldOn(chunks);
  pushReceiptSlightLargeOn(chunks);
  chunks.push(
    enc(lrFit(marketItemsHeaderLeft(width), "Итого", width) + "\n"),
  );
  pushReceiptSizeOff(chunks);
  pushReceiptBoldOff(chunks);
}

function pushMarketItemLineRow(
  chunks,
  enc,
  width,
  price,
  qty,
  lineDiscountAmt,
  lineTotal,
) {
  const left = buildMarketItemLineLeft(price, qty, lineDiscountAmt);
  pushReceiptBoldOn(chunks);
  pushReceiptSlightLargeOn(chunks);
  chunks.push(enc(lrFit(left, money(lineTotal), width) + "\n"));
  pushReceiptSizeOff(chunks);
  pushReceiptBoldOff(chunks);
}

/** Строка чека маркета: скидка как в eKassa (сумма + %), те же поля что при fiscal merge. */
function mapMarketReceiptItem(it) {
  const qty = toNum(it?.qty ?? it?.quantity) || 1;
  const unitPrice = toNum(it?.unit_price ?? it?.price);
  let lineDiscountAmt = toNum(
    it?.line_discount ?? it?.discount_total ?? it?.line_discount_total,
  );
  const lineTotalNum =
    it?.line_total != null && it?.line_total !== ""
      ? toNum(it.line_total)
      : null;
  const grossLine = Math.max(0, qty * unitPrice);
  if (
    lineDiscountAmt <= 0 &&
    lineTotalNum != null &&
    grossLine > lineTotalNum + 1e-9
  ) {
    lineDiscountAmt = grossLine - lineTotalNum;
  }
  const lineDiscountPct =
    it?.line_discount_pct != null && it?.line_discount_pct !== ""
      ? toNum(it.line_discount_pct)
      : lineDiscountAmt > 0 && grossLine > 0
        ? (lineDiscountAmt / grossLine) * 100
        : 0;
  const total =
    lineTotalNum != null && Number.isFinite(lineTotalNum)
      ? lineTotalNum
      : Math.max(0, grossLine - lineDiscountAmt);
  return {
    name: String(it?.name ?? it?.product_name ?? "Товар"),
    qty,
    price: unitPrice,
    total,
    line_discount_pct: lineDiscountPct,
    line_discount_amount: lineDiscountAmt,
  };
}

function resolveMarketOrderDiscount(payload, ekassaFields) {
  if (ekassaFields) return 0;
  return Math.max(
    0,
    toNum(
      payload?.discount ??
        payload?.order_discount_total ??
        payload?.order_discount,
    ),
  );
}

const fromTyiyn = (v) => toNum(v) / 100;
const f = (fields, key) =>
  fields && Object.prototype.hasOwnProperty.call(fields, key)
    ? fields[key]
    : undefined;
function buildEscPosQr(text) {
  const value = String(text || "").trim();
  if (!value) return [];
  const utf8 = new TextEncoder().encode(value);
  const len = utf8.length + 3;
  const pL = len & 0xff;
  const pH = (len >> 8) & 0xff;
  return [
    ESC(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30), // ECC: M
    ESC(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06), // module size
    new Uint8Array([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...utf8]), // store
    ESC(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30), // print
  ];
}

const RECEIPT_CANVAS_FONT =
  '"Courier New", "Menlo", "Consolas", "Liberation Mono", monospace';

/**
 * Layout строк чека маркета для графической печати.
 * @returns {{ lines: Array<{ text: string, align?: string, bold?: boolean, scale?: number }>, qrLink: string }}
 */
export function buildMarketReceiptLayout(payload, opts = {}) {
  const cfg = getEscposRuntimeConfig({ marketDefault: true });
  const width = Math.max(16, opts.width || cfg.charsPerLine);
  const divider = "-".repeat(width);
  const hasText = (v) => {
    const s = String(v ?? "").trim();
    return s !== "" && s !== "—";
  };
  const line = (text, extra = {}) => ({
    text: String(text ?? ""),
    align: "left",
    bold: false,
    scale: 1,
    ...extra,
  });

  const ekassaFields =
    payload?.ekassa_fiscal?.fields ||
    payload?.ekassa?.fields ||
    payload?.ekassa?.ekassa_payload?.data?.fields ||
    null;
  const company = String(payload?.company ?? "").trim();
  const inn = String(payload?.inn ?? "").trim();
  const address = String(payload?.address ?? "").trim();
  const cashier = String(payload?.cashier_name ?? "").trim();

  const docNo = String(
    ekassaFields
      ? (f(ekassaFields, "1042") ?? payload?.doc_no ?? "")
      : (payload?.doc_no ?? ""),
  ).trim();
  const dt = String(
    ekassaFields
      ? (f(ekassaFields, "1012") ?? payload?.created_at ?? "")
      : (payload?.created_at ?? ""),
  ).trim();
  const shift = String(
    ekassaFields ? (f(ekassaFields, "1038") ?? "") : "",
  ).trim();

  const payloadItemsForMerge =
    (Array.isArray(payload?.items) && payload.items) ||
    (Array.isArray(payload?.receipt?.items) && payload.receipt.items) ||
    (Array.isArray(payload?.cart?.items) && payload.cart.items) ||
    null;

  const items =
    ekassaFields && Array.isArray(f(ekassaFields, "1059"))
      ? f(ekassaFields, "1059").map((it, idx) => {
          const qty = toNum(it?.["1023"]) || 1;
          const raw1043 = fromTyiyn(it?.["1043"]);
          const raw1076 = fromTyiyn(it?.["1076"]);
          const price =
            raw1076 > 0 ? raw1076 : qty > 0 ? raw1043 / qty : raw1043;
          const total = raw1043 > 0 ? raw1043 : price * qty;
          const base = {
            name: String(it?.["1030"] || "Товар"),
            qty,
            price,
            total,
          };
          let src = payloadItemsForMerge?.[idx];
          if (!src && payloadItemsForMerge?.length) {
            const nm = base.name.trim();
            src =
              payloadItemsForMerge.find(
                (x) =>
                  String(x?.name ?? "").trim() === nm &&
                  (toNum(x?.qty) || 1) === base.qty,
              ) || null;
          }
          if (!src) return base;
          const mapped = mapMarketReceiptItem({
            ...src,
            qty,
            price,
            unit_price: price,
          });
          return {
            ...base,
            line_discount_pct: mapped.line_discount_pct,
            line_discount_amount: mapped.line_discount_amount,
            total: mapped.total,
          };
        })
      : (
          payloadItemsForMerge ||
          (Array.isArray(payload?.items) ? payload.items : [])
        ).map(mapMarketReceiptItem);

  const subtotal = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1020"))
    : items.reduce(
        (s, it) => s + toNum(it.total) + toNum(it.line_discount_amount),
        0,
      );
  const discount = resolveMarketOrderDiscount(payload, ekassaFields);
  const vat = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1033"))
    : toNum(payload?.tax);
  const nsp = ekassaFields ? fromTyiyn(f(ekassaFields, "1215")) : 0;
  const total = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1031"))
    : Math.max(0, subtotal - discount + vat);
  const paidCard = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1081"))
    : Math.max(0, toNum(payload?.paid_card));
  const paidCash = ekassaFields
    ? Math.max(0, total - paidCard)
    : Math.max(0, toNum(payload?.paid_cash));
  const cashReceived = Math.max(0, toNum(payload?.cash_received));
  const change = Math.max(0, toNum(payload?.change));
  const kkm = String(
    ekassaFields
      ? (f(ekassaFields, "1037") ??
          payload?.ekassa_fiscal?.kkm_reg_number ??
          "")
      : (payload?.ekassa_fiscal?.kkm_reg_number ?? ""),
  ).trim();
  const fn = String(
    ekassaFields
      ? (f(ekassaFields, "1041") ?? payload?.ekassa_fiscal?.fm_number ?? "")
      : (payload?.ekassa_fiscal?.fm_number ?? ""),
  ).trim();
  const fd = String(
    ekassaFields
      ? (f(ekassaFields, "1040") ?? payload?.ekassa_fiscal?.fd_number ?? "")
      : (payload?.ekassa_fiscal?.fd_number ?? ""),
  ).trim();
  const fpd = String(
    ekassaFields
      ? (f(ekassaFields, "1077") ?? payload?.ekassa_fiscal?.fpd ?? "")
      : (payload?.ekassa_fiscal?.fpd ?? ""),
  ).trim();
  const qrLink = String(
    payload?.ekassa_fiscal?.link || payload?.ekassa?.link || "",
  ).trim();

  const lines = [];
  lines.push(line("СПАСИБО ЗА ПОКУПКУ!", { align: "center", bold: true }));
  lines.push(line("", { align: "center" }));
  lines.push(line("Контрольно-кассовый чек - Продажа", { align: "center" }));
  if (hasText(company)) {
    lines.push(
      line(`Магазин: ${company}`, {
        align: "center",
        bold: true,
        scale: 1.15,
      }),
    );
  }
  if (hasText(inn)) lines.push(line(`ИНН ${inn}`, { align: "center" }));
  if (hasText(address)) lines.push(line(address, { align: "center" }));
  lines.push(line(divider));
  if (hasText(docNo) && hasText(dt)) {
    lines.push(line(lr(`Чек № ${docNo}`, dt, width)));
  } else if (hasText(docNo)) {
    lines.push(line(`Чек № ${docNo}`));
  } else if (hasText(dt)) {
    lines.push(line(dt));
  }
  if (hasText(cashier)) lines.push(line(lr("Кассир", cashier, width)));
  const consultant = String(
    payload?.consultant_name ??
      payload?.consultant?.name ??
      payload?.consultant_display ??
      "",
  ).trim();
  if (hasText(consultant)) {
    lines.push(line(lr("Консультант", consultant, width)));
  }
  if (hasText(shift)) lines.push(line(lr("Смена", shift, width)));
  lines.push(line(divider));
  if (ekassaFields) {
    lines.push(line("СНО: Общий налоговый режим"));
    lines.push(line(divider));
  }

  // left/right — отдельная правая колонка на canvas (кириллица не моноширинная)
  lines.push({
    left: marketItemsHeaderLeft(width),
    right: "Итого",
    bold: true,
  });
  lines.push(line(""));
  for (const [index, it] of items.entries()) {
    const name = String(it.name ?? "Товар");
    const qty = Number(it.qty || 1);
    const price = Number(it.price || 0);
    const lineTotal = Number(it.total ?? qty * price);
    const lineDiscountAmt = Math.max(0, toNum(it?.line_discount_amount));
    const prefix = `${index + 1}) `;
    const nameLines = wrapReceiptName(name, Math.max(8, width - prefix.length));
    lines.push(line(prefix + nameLines[0], { bold: true }));
    for (let i = 1; i < nameLines.length; i += 1) {
      lines.push(line(`   ${nameLines[i]}`, { bold: true }));
    }
    lines.push(line(""));
    lines.push({
      left: buildMarketItemLineLeft(price, qty, lineDiscountAmt),
      right: money(lineTotal),
      bold: true,
    });
    if (index < items.length - 1) {
      lines.push(line(divider));
    }
  }

  lines.push(line(divider));
  lines.push(line(lr("Подытог", money(subtotal), width), { bold: true }));
  if (discount > 0) {
    lines.push(
      line(lr("Скидка", `-${money(discount)}`, width), { bold: true }),
    );
  }
  if (!ekassaFields) {
    if (vat > 0) lines.push(line(lr("НДС", money(vat), width), { bold: true }));
    if (nsp > 0) lines.push(line(lr("НсП", money(nsp), width), { bold: true }));
  }
  lines.push(line(divider));
  if (ekassaFields) {
    lines.push(line(lr("Всего", money(total), width), { bold: true }));
    lines.push(line(lr("Наличные", money(paidCash), width), { bold: true }));
    lines.push(line(lr("Безналичные", money(paidCard), width), { bold: true }));
    if (cashReceived > paidCash) {
      lines.push(
        line(lr("Получено", money(cashReceived), width), { bold: true }),
      );
    }
    if (change > 0) {
      lines.push(line(lr("Сдача", money(change), width), { bold: true }));
    }
    lines.push(line(lr("Вид расчета", "Полный расчет", width), { bold: true }));
    lines.push(line(lr("НДС 0%", "0.00", width), { bold: true }));
    lines.push(line(lr("НсП 0%", "0.00", width), { bold: true }));
  } else {
    if (paidCash > 0) {
      lines.push(line(lr("Наличные", money(paidCash), width), { bold: true }));
    }
    if (paidCard > 0) {
      lines.push(
        line(lr("Безналичные", money(paidCard), width), { bold: true }),
      );
    }
    if (cashReceived > paidCash) {
      lines.push(
        line(lr("Получено", money(cashReceived), width), { bold: true }),
      );
    }
    if (change > 0) {
      lines.push(line(lr("Сдача", money(change), width), { bold: true }));
    }
  }

  lines.push(
    line(lrSized("Итог", `${money(total)} СОМ`, width, 0x30), {
      bold: true,
      scale: 2,
    }),
  );
  lines.push(line(divider));
  if (hasText(kkm)) {
    if (ekassaFields) {
      lines.push(line(lr("ККМ версия", "1.0", width)));
      lines.push(line(divider));
    }
    lines.push(line(lr("РН ККМ", kkm, width)));
    lines.push(line(divider));
  }
  if (hasText(fn)) {
    lines.push(line(lr("ФМ", fn, width)));
    lines.push(line(divider));
  }
  if (hasText(fd)) {
    lines.push(line(lr("ФД", fd, width)));
    lines.push(line(divider));
  }
  if (hasText(fpd)) {
    lines.push(line(lr("ФПД", fpd, width)));
  }
  lines.push(line(divider));
  if (qrLink) {
    lines.push(line(""));
    lines.push(line("Проверка чека", { align: "center", bold: true }));
  }

  return { lines, qrLink, width };
}

/** Рисует layout чека на canvas шириной dotsPerLine. */
export function renderReceiptLayoutToCanvas(lines, cfg = {}) {
  if (typeof document === "undefined") {
    throw new Error("Canvas недоступен вне браузера");
  }
  const dotsPerLine = Math.max(
    128,
    Math.round(Number(cfg.dotsPerLine) || MARKET_DEFAULT_DOTS_PER_LINE),
  );
  const charsPerLine = Math.max(
    16,
    Math.round(Number(cfg.charsPerLine) || MARKET_DEFAULT_CHARS_PER_LINE),
  );
  const padX = 2;
  const padY = 6;

  // Временный canvas, чтобы замерить реальную ширину моноширинного символа
  // и подобрать кегль так, чтобы charsPerLine заполнили всю зону печати.
  const canvas = document.createElement("canvas");
  canvas.width = dotsPerLine;
  canvas.height = 32;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const usable = Math.max(64, dotsPerLine - padX * 2);
  const probeSize = 24;
  ctx.font = `400 ${probeSize}px ${RECEIPT_CANVAS_FONT}`;
  const measuredChar = Math.max(1, ctx.measureText("0").width || probeSize * 0.6);
  const baseFontSize = Math.max(
    16,
    Math.floor((usable / charsPerLine) * (probeSize / measuredChar)),
  );
  const baseLineHeight = Math.max(
    baseFontSize + 6,
    Math.round(Number(cfg.lineDotHeight) || baseFontSize + 8),
  );

  const heights = (lines || []).map((row) => {
    const scale = Math.max(0.75, Number(row?.scale) || 1);
    return Math.round(baseLineHeight * scale);
  });
  const contentH = heights.reduce((s, h) => s + h, 0);
  canvas.height = Math.max(padY * 2 + contentH, padY * 2 + baseLineHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  let y = padY;
  for (let i = 0; i < (lines || []).length; i += 1) {
    const row = lines[i] || {};
    const scale = Math.max(0.75, Number(row.scale) || 1);
    const fontSize = Math.max(14, Math.round(baseFontSize * scale));
    const rowH = heights[i];
    const weight = row.bold ? "700" : "400";
    ctx.font = `${weight} ${fontSize}px ${RECEIPT_CANVAS_FONT}`;
    const textY = y + Math.max(0, Math.floor((rowH - fontSize) / 2));

    // Двухколоночная строка: правая цена всегда у правого края ленты
    if (row.left != null || row.right != null) {
      const left = String(row.left ?? "");
      const right = String(row.right ?? "");
      const rightW = right ? ctx.measureText(right).width : 0;
      const gap = 8;
      const maxLeftW = Math.max(8, usable - rightW - gap);
      let leftDraw = left;
      if (leftDraw && ctx.measureText(leftDraw).width > maxLeftW) {
        while (
          leftDraw.length > 1 &&
          ctx.measureText(`${leftDraw}…`).width > maxLeftW
        ) {
          leftDraw = leftDraw.slice(0, -1);
        }
        leftDraw = leftDraw.length ? `${leftDraw}…` : "…";
      }
      if (leftDraw) ctx.fillText(leftDraw, padX, textY);
      if (right) {
        ctx.fillText(right, Math.round(dotsPerLine - padX - rightW), textY);
      }
    } else {
      const text = String(row.text ?? "");
      if (text) {
        const metrics = ctx.measureText(text);
        let x = padX;
        if (row.align === "center") {
          x = Math.max(padX, Math.round((dotsPerLine - metrics.width) / 2));
        } else if (row.align === "right") {
          x = Math.max(padX, Math.round(dotsPerLine - padX - metrics.width));
        }
        ctx.fillText(text, x, textY);
      }
    }
    y += rowH;
  }
  return canvas;
}

function buildReceiptFromJSON(payload, opts = {}) {
  const emphasizeMarketReceipt = opts.receiptStyle === "market";
  const cfg = getEscposRuntimeConfig({ marketDefault: emphasizeMarketReceipt });
  const width = Math.max(16, opts.width || cfg.charsPerLine);
  const divider = "-".repeat(width);
  const codepage = opts.codepage || cfg.codepage;
  const enc = opts.encoder || getEncoder(codepage);
  const hasText = (v) => {
    const s = String(v ?? "").trim();
    return s !== "" && s !== "—";
  };

  const ekassaFields =
    payload?.ekassa_fiscal?.fields ||
    payload?.ekassa?.fields ||
    payload?.ekassa?.ekassa_payload?.data?.fields ||
    null;
  const company = String(payload.company ?? "").trim();
  const inn = String(payload.inn ?? "").trim();
  const address = String(payload.address ?? "").trim();
  const cashier = String(payload.cashier_name ?? "").trim();

  const docNo = String(
    ekassaFields
      ? (f(ekassaFields, "1042") ?? payload.doc_no ?? "")
      : (payload.doc_no ?? ""),
  ).trim();
  const dt = String(
    ekassaFields
      ? (f(ekassaFields, "1012") ?? payload.created_at ?? "")
      : (payload.created_at ?? ""),
  ).trim();
  const shift = String(
    ekassaFields ? (f(ekassaFields, "1038") ?? "") : "",
  ).trim();

  const payloadItemsForMerge =
    (Array.isArray(payload.items) && payload.items) ||
    (Array.isArray(payload.receipt?.items) && payload.receipt.items) ||
    (Array.isArray(payload.cart?.items) && payload.cart.items) ||
    null;

  const items =
    ekassaFields && Array.isArray(f(ekassaFields, "1059"))
      ? f(ekassaFields, "1059").map((it, idx) => {
          const qty = toNum(it?.["1023"]) || 1;
          // В ответах eKassa для Маркета часто:
          // 1043 = сумма позиции, 1076 = цена за единицу.
          const raw1043 = fromTyiyn(it?.["1043"]);
          const raw1076 = fromTyiyn(it?.["1076"]);
          const price =
            raw1076 > 0 ? raw1076 : qty > 0 ? raw1043 / qty : raw1043;
          const total = raw1043 > 0 ? raw1043 : price * qty;
          const base = {
            name: String(it?.["1030"] || "Товар"),
            qty,
            price,
            total,
          };
          let src = payloadItemsForMerge?.[idx];
          if (!src && payloadItemsForMerge?.length) {
            const nm = base.name.trim();
            src =
              payloadItemsForMerge.find(
                (x) =>
                  String(x?.name ?? "").trim() === nm &&
                  (toNum(x?.qty) || 1) === base.qty,
              ) || null;
          }
          if (!src) return base;
          const mapped = mapMarketReceiptItem({
            ...src,
            qty,
            price,
            unit_price: price,
          });
          return {
            ...base,
            line_discount_pct: mapped.line_discount_pct,
            line_discount_amount: mapped.line_discount_amount,
            total: mapped.total,
          };
        })
      : (
          payloadItemsForMerge ||
          (Array.isArray(payload.items) ? payload.items : [])
        ).map(mapMarketReceiptItem);

  // Подытог — это ВАЛОВАЯ сумма до скидок. payload.discount — общая скидка
  // (включая построчные), поэтому подытог считаем как «итог по строке + скидка
  // по строке» (= цена×кол-во). Иначе построчная скидка вычиталась бы дважды:
  // один раз в line_total, второй — в общей скидке. (см. баг: 200 - 150 = 50
  // вместо 250 - 150 = 100).
  const subtotal = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1020"))
    : items.reduce(
        (s, it) => s + toNum(it.total) + toNum(it.line_discount_amount),
        0,
      );
  const discount = resolveMarketOrderDiscount(payload, ekassaFields);
  const vat = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1033"))
    : toNum(payload.tax);
  const nsp = ekassaFields ? fromTyiyn(f(ekassaFields, "1215")) : 0;
  const total = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1031"))
    : Math.max(0, subtotal - discount + vat);
  const paidCard = ekassaFields
    ? fromTyiyn(f(ekassaFields, "1081"))
    : Math.max(0, toNum(payload.paid_card));
  const paidCash = ekassaFields
    ? Math.max(0, total - paidCard)
    : Math.max(0, toNum(payload.paid_cash));
  const cashReceived = Math.max(0, toNum(payload.cash_received));
  const change = Math.max(0, toNum(payload.change));
  const kkm = String(
    ekassaFields
      ? (f(ekassaFields, "1037") ??
          payload?.ekassa_fiscal?.kkm_reg_number ??
          "")
      : (payload?.ekassa_fiscal?.kkm_reg_number ?? ""),
  ).trim();
  const fn = String(
    ekassaFields
      ? (f(ekassaFields, "1041") ?? payload?.ekassa_fiscal?.fm_number ?? "")
      : (payload?.ekassa_fiscal?.fm_number ?? ""),
  ).trim();
  const fd = String(
    ekassaFields
      ? (f(ekassaFields, "1040") ?? payload?.ekassa_fiscal?.fd_number ?? "")
      : (payload?.ekassa_fiscal?.fd_number ?? ""),
  ).trim();
  const fpd = String(
    ekassaFields
      ? (f(ekassaFields, "1077") ?? payload?.ekassa_fiscal?.fpd ?? "")
      : (payload?.ekassa_fiscal?.fpd ?? ""),
  ).trim();
  const qrLink = String(
    payload?.ekassa_fiscal?.link || payload?.ekassa?.link || "",
  ).trim();

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40)); // init
  for (const part of buildEscPosPrinterSetup(cfg)) {
    chunks.push(part);
  }
  // ESC R: по Epson n=7 — это Spain I, не Россия; там часто «ломаются» | \ [ ] и т.п.
  // Кириллица идёт через ESC t + CP866/1251 (байты 0x80+). Для стабильного ASCII — USA (0).
  chunks.push(ESC(0x1b, 0x52, 0x00));
  chunks.push(ESC(0x1b, 0x74, codepage)); // кодовая страница

  chunks.push(ESC(0x1b, 0x61, 0x01)); // center
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
    chunks.push(enc("СПАСИБО ЗА ПОКУПКУ!\n"));
    chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
    chunks.push(enc("\n"));
  }
  chunks.push(enc("Контрольно-кассовый чек - Продажа\n"));
  if (hasText(company)) {
    pushReceiptBoldOn(chunks);
    pushReceiptSlightLargeOn(chunks);
    chunks.push(enc(`Магазин: ${company}\n`));
    pushReceiptSizeOff(chunks);
    pushReceiptBoldOff(chunks);
  }
  if (hasText(inn)) chunks.push(enc(`ИНН ${inn}\n`));
  if (hasText(address)) chunks.push(enc(address + "\n"));
  chunks.push(ESC(0x1b, 0x61, 0x00)); // left
  chunks.push(enc(divider + "\n"));
  if (hasText(docNo) && hasText(dt)) {
    chunks.push(enc(lr(`Чек № ${docNo}`, dt, width) + "\n"));
  } else if (hasText(docNo)) {
    chunks.push(enc(`Чек № ${docNo}\n`));
  } else if (hasText(dt)) {
    chunks.push(enc(`${dt}\n`));
  }
  if (hasText(cashier)) chunks.push(enc(lr("Кассир", cashier, width) + "\n"));
  const consultant = String(
    payload.consultant_name ??
      payload.consultant?.name ??
      payload.consultant_display ??
      "",
  ).trim();
  if (hasText(consultant)) {
    chunks.push(enc(lr("Консультант", consultant, width) + "\n"));
  }
  if (hasText(shift)) chunks.push(enc(lr("Смена", shift, width) + "\n"));
  chunks.push(enc(divider + "\n"));
  if (ekassaFields) {
    chunks.push(enc("СНО: Общий налоговый режим\n"));
    chunks.push(enc(divider + "\n"));
  }
  if (emphasizeMarketReceipt) {
    pushMarketItemHeaderRow(chunks, enc, width);
    chunks.push(enc("\n"));
    for (const [index, it] of items.entries()) {
      const name = String(it.name ?? "Товар");
      const qty = Number(it.qty || 1);
      const price = Number(it.price || 0);
      const lineTotal = Number(it.total ?? qty * price);
      const lineDiscountAmt = Math.max(0, toNum(it?.line_discount_amount));
      const prefix = `${index + 1}) `;
      const nameLines = wrapReceiptName(
        name,
        Math.max(8, width - prefix.length),
      );

      pushReceiptBoldOn(chunks);
      chunks.push(enc(prefix + nameLines[0] + "\n"));
      for (let i = 1; i < nameLines.length; i += 1) {
        chunks.push(enc(`   ${nameLines[i]}\n`));
      }
      pushReceiptBoldOff(chunks);
      chunks.push(enc("\n"));

      pushMarketItemLineRow(
        chunks,
        enc,
        width,
        price,
        qty,
        lineDiscountAmt,
        lineTotal,
      );
      if (index < items.length - 1) {
        chunks.push(enc(divider + "\n"));
      }
    }
  } else {
    for (const [index, it] of items.entries()) {
      const name = String(it.name ?? "Товар");
      const qty = Number(it.qty || 1);
      const price = Number(it.price || 0);
      const lineTotal = Number(it.total ?? qty * price);
      chunks.push(enc(`${index + 1}. ${name}\n`));
      const lineDiscountAmt = Math.max(0, toNum(it?.line_discount_amount));
      chunks.push(
        enc(lr(`${money(price)} x ${qty} ед.`, money(lineTotal), width) + "\n"),
      );
      if (lineDiscountAmt > 0) {
        chunks.push(
          enc(lr("Скидка (товар)", `-${money(lineDiscountAmt)}`, width) + "\n"),
        );
      }
      if (ekassaFields) {
        chunks.push(enc("НДС 0%, НсП 0%\n"));
      }
    }
  }

  chunks.push(enc(divider + "\n"));
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  }
  chunks.push(enc(lr("Подытог", money(subtotal), width) + "\n"));
  if (discount > 0) {
    chunks.push(enc(lr("Скидка", `-${money(discount)}`, width) + "\n"));
  }
  if (!ekassaFields) {
    if (vat > 0) chunks.push(enc(lr("НДС", money(vat), width) + "\n"));
    if (nsp > 0) chunks.push(enc(lr("НсП", money(nsp), width) + "\n"));
  }
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
  }
  chunks.push(enc(divider + "\n"));
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  }
  if (ekassaFields) {
    chunks.push(enc(lr("Всего", money(total), width) + "\n"));
    chunks.push(enc(lr("Наличные", money(paidCash), width) + "\n"));
    chunks.push(enc(lr("Безналичные", money(paidCard), width) + "\n"));
    if (cashReceived > paidCash) {
      chunks.push(enc(lr("Получено", money(cashReceived), width) + "\n"));
    }
    if (change > 0) {
      chunks.push(ESC(0x1b, 0x45, 0x01));
      chunks.push(enc(lr("Сдача", money(change), width) + "\n"));
      chunks.push(ESC(0x1b, 0x45, 0x00));
    }
    chunks.push(enc(lr("Вид расчета", "Полный расчет", width) + "\n"));
    chunks.push(enc(lr("НДС 0%", "0.00", width) + "\n"));
    chunks.push(enc(lr("НсП 0%", "0.00", width) + "\n"));
  } else {
    if (paidCash > 0)
      chunks.push(enc(lr("Наличные", money(paidCash), width) + "\n"));
    if (paidCard > 0)
      chunks.push(enc(lr("Безналичные", money(paidCard), width) + "\n"));
    if (cashReceived > paidCash) {
      chunks.push(enc(lr("Получено", money(cashReceived), width) + "\n"));
    }
    if (change > 0) {
      chunks.push(ESC(0x1b, 0x45, 0x01));
      chunks.push(enc(lr("Сдача", money(change), width) + "\n"));
      chunks.push(ESC(0x1b, 0x45, 0x00));
    }
  }
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
  }

  pushReceiptBoldOn(chunks);
  pushReceiptProportionalLargeOn(chunks);
  chunks.push(enc(lrSized("Итог", `${money(total)} СОМ`, width, 0x30) + "\n"));
  pushReceiptSizeOff(chunks);
  pushReceiptBoldOff(chunks);
  chunks.push(enc(divider + "\n"));
  if (hasText(kkm)) {
    if (ekassaFields) {
      chunks.push(enc(lr("ККМ версия", "1.0", width) + "\n"));
      chunks.push(enc(divider + "\n"));
    }
    chunks.push(enc(lr("РН ККМ", kkm, width) + "\n"));
    chunks.push(enc(divider + "\n"));
  }
  if (hasText(fn)) {
    chunks.push(enc(lr("ФМ", fn, width) + "\n"));
    chunks.push(enc(divider + "\n"));
  }
  if (hasText(fd)) {
    chunks.push(enc(lr("ФД", fd, width) + "\n"));
    chunks.push(enc(divider + "\n"));
  }
  if (hasText(fpd)) {
    chunks.push(enc(lr("ФПД", fpd, width) + "\n"));
  }
  chunks.push(enc(divider + "\n"));
  if (qrLink) {
    chunks.push(ESC(0x1b, 0x61, 0x01)); // center
    chunks.push(enc("Проверка чека\n"));
    for (const part of buildEscPosQr(qrLink)) {
      chunks.push(part);
    }
    chunks.push(enc("\n"));
    chunks.push(ESC(0x1b, 0x61, 0x00)); // left
  }
  // Даем принтеру достаточно протянуть бумагу перед отрезом.
  chunks.push(ESC(0x1b, 0x64, 0x06)); // feed 6 lines
  chunks.push(ESC(0x1d, 0x56, 0x00)); // full cut
  return chunks;
}

/* ---------- Определение формата ответа (PDF/JSON/base64) ---------- */
async function looksLikePdf(blob) {
  if (!(blob instanceof Blob)) return false;
  try {
    const head = await blob.slice(0, 8).text();
    return head.startsWith("%PDF-");
  } catch {
    return false;
  }
}
async function tryParseJsonFromBlob(blob) {
  try {
    const text = await blob.text();
    if (text.startsWith("data:application/pdf;base64,")) {
      const b64 = text.split(",")[1];
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return { pdfBlob: new Blob([bin], { type: "application/pdf" }) };
    }
    const json = JSON.parse(text);
    if (json && Array.isArray(json.items)) return { json };
    return null;
  } catch {
    return null;
  }
}

/* ---------- WebUSB ---------- */
function saveVidPidToLS(dev) {
  try {
    localStorage.setItem("escpos_vid", dev.vendorId.toString(16));
    localStorage.setItem("escpos_pid", dev.productId.toString(16));
    if (dev.serialNumber)
      localStorage.setItem("escpos_serial", String(dev.serialNumber));
    if (dev.productName)
      localStorage.setItem("escpos_product", dev.productName);
    if (dev.manufacturerName)
      localStorage.setItem("escpos_manufacturer", dev.manufacturerName);
  } catch {}
}
async function tryUsbAutoConnect() {
  if (!("usb" in navigator)) throw new Error("Браузер не поддерживает WebUSB");
  const savedSerial = localStorage.getItem("escpos_serial") || "";
  const savedVid = parseInt(localStorage.getItem("escpos_vid") || "", 16);
  const savedPid = parseInt(localStorage.getItem("escpos_pid") || "", 16);
  const devs = await navigator.usb.getDevices();
  if (savedSerial) {
    return devs.find((d) => d.serialNumber === savedSerial) || null;
  }
  return (
    devs.find(
      (d) =>
        (!savedVid || d.vendorId === savedVid) &&
        (!savedPid || d.productId === savedPid),
    ) || null
  );
}
async function requestUsbDevice() {
  const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
  return await navigator.usb.requestDevice({ filters });
}
async function openUsbDevice(dev) {
  if (!dev) throw new Error("USB устройство не найдено");
  if (!dev.opened) await dev.open();

  if (dev.configuration == null) {
    await dev.selectConfiguration(1).catch(() => {});
    if (dev.configuration == null && dev.configurations?.length) {
      const cfgNum = dev.configurations[0]?.configurationValue ?? 1;
      await dev.selectConfiguration(cfgNum).catch(() => {});
    }
  }
  const cfg = dev.configuration;
  if (!cfg) throw new Error("Нет активной USB-конфигурации");

  for (const intf of cfg.interfaces) {
    for (const alt of intf.alternates) {
      const out = (alt.endpoints || []).find(
        (e) => e.direction === "out" && e.type === "bulk",
      );
      if (!out) continue;

      try {
        await dev.claimInterface(intf.interfaceNumber);
      } catch {
        continue;
      }
      const needAlt = alt.alternateSetting ?? 0;
      try {
        await dev.selectAlternateInterface(intf.interfaceNumber, needAlt);
      } catch {
        try {
          await dev.releaseInterface(intf.interfaceNumber);
        } catch {}
        continue;
      }
      return {
        iface: intf.interfaceNumber,
        alt: needAlt,
        outEP: out.endpointNumber,
      };
    }
  }
  throw new Error(
    "Не удалось захватить интерфейс с bulk OUT. На Windows установите WinUSB (Zadig) и закройте другие приложения принтера.",
  );
}
async function ensureUsbReadyAuto() {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  if (usbState.dev) return usbState;
  if (!usbState.opening) {
    usbState.opening = (async () => {
      const dev = await tryUsbAutoConnect();
      if (!dev) return null;
      await openUsbDevice(dev);
      usbState.dev = dev;
      return usbState;
    })().finally(() => (usbState.opening = null));
  }
  await usbState.opening;
  return usbState.dev ? usbState : null;
}

/**
 * Интерактивная проверка и подключение принтера.
 * Сначала пытается авто-подключиться к уже разрешённому устройству.
 * Если не найдено – показывает диалог выбора USB-устройства.
 * Возвращает true, если после этого принтер доступен.
 */
export async function ensurePrinterConnectedInteractively(options = {}) {
  if (!("usb" in navigator)) return false;

  // 1. Пытаемся автоматически подключиться к уже разрешённому устройству
  // (если не требуется принудительно показать окно выбора).
  if (!options?.forceChoose) {
    try {
      const state = await ensureUsbReadyAuto();
      if (state && usbState.dev) {
        return true;
      }
    } catch {
      // игнорируем и пробуем интерактивное подключение ниже
    }
  }

  // 2. Если авто-подключение не сработало – запрашиваем устройство у пользователя
  try {
    const dev = await requestUsbDevice();
    if (!dev) return false;

    // сохраняем VID/PID для будущих авто-подключений
    saveVidPidToLS(dev);

    // открываем устройство и захватываем интерфейс
    const info = await openUsbDevice(dev);

    // сохраняем в глобальном состоянии
    usbState.dev = dev;

    // если удалось получить outEP — считаем, что принтер подключен
    return !!info?.outEP;
  } catch (e) {
    // Пользователь мог нажать Cancel или произошла другая ошибка
    console.warn("Не удалось подключить USB-принтер интерактивно:", e);
    return false;
  }
}

export function attachUsbListenersOnce() {
  if (!("usb" in navigator)) return;
  if (attachUsbListenersOnce._did) return;
  attachUsbListenersOnce._did = true;

  navigator.usb.addEventListener("connect", async (e) => {
    try {
      const savedVid = parseInt(localStorage.getItem("escpos_vid") || "", 16);
      const savedPid = parseInt(localStorage.getItem("escpos_pid") || "", 16);
      if (!savedVid || !savedPid) return;
      if (e.device.vendorId !== savedVid || e.device.productId !== savedPid)
        return;
      await openUsbDevice(e.device);
      usbState.dev = e.device;
    } catch (err) {
      console.warn("USB auto-connect failed:", err);
    }
  });

  navigator.usb.addEventListener("disconnect", (e) => {
    if (usbState.dev && e.device === usbState.dev) {
      usbState.dev = null;
    }
  });
}

export async function checkPrinterConnection() {
  if (!("usb" in navigator)) {
    console.warn("WebUSB не поддерживается в этом браузере");
    return false;
  }
  try {
    const state = await ensureUsbReadyAuto();
    const connected = state !== null && usbState.dev !== null;
    console.log("[PrintService] checkPrinterConnection ->", {
      hasState: !!state,
      hasDevice: !!usbState.dev,
      connected,
    });
    return connected;
  } catch (err) {
    console.error(
      "[PrintService] Ошибка при проверке подключения принтера:",
      err,
    );
    return false;
  }
}

/* ---------- Печать ---------- */
async function printReceiptFromPdfUSB(pdfBlob, options = {}) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    if (options?.interactive === false) {
      throw new Error("Принтер не подключен");
    }
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);
  saveVidPidToLS(dev);
  usbState.dev = dev;
  await wakeEscPosPrinter(dev, outEP);

  // печатаем на ширину принтера
  const isMarket = options?.receiptStyle === "market";
  const cfg = getEscposRuntimeConfig({ marketDefault: isMarket });
  const canvas = await pdfBlobToCanvas(pdfBlob, cfg.dotsPerLine);
  const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
  const escpos = buildEscPosForRaster(raster, bytesPerLine, h);

  for (const part of chunkBytes(escpos)) {
    await dev.transferOut(outEP, part);
  }
}

async function printReceiptJSONGraphicViaUSB(payload, options = {}) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    if (options?.interactive === false) {
      throw new Error("Принтер не подключен");
    }
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);
  saveVidPidToLS(dev);
  usbState.dev = dev;
  await wakeEscPosPrinter(dev, outEP);

  const cfg = getEscposRuntimeConfig({ marketDefault: true });
  const { lines, qrLink } = buildMarketReceiptLayout(payload, {
    width: cfg.charsPerLine,
  });
  const canvas = renderReceiptLayoutToCanvas(lines, cfg);
  const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
  const rasterEscpos = buildEscPosForRaster(raster, bytesPerLine, h, {
    withCut: false,
  });

  const tailParts = [];
  if (qrLink) {
    tailParts.push(ESC(0x1b, 0x61, 0x01)); // center QR
    for (const part of buildEscPosQr(qrLink)) {
      tailParts.push(part);
    }
    tailParts.push(ESC(0x1b, 0x61, 0x00));
  }
  // feed + cut (как у текстового чека — запас бумаги перед отрезом)
  tailParts.push(ESC(0x1b, 0x64, 0x06));
  tailParts.push(ESC(0x1d, 0x56, 0x00));

  const payloadBytes = concatUint8Arrays([rasterEscpos, ...tailParts]);
  for (const part of chunkBytes(payloadBytes)) {
    await dev.transferOut(outEP, part);
  }
}

async function printReceiptJSONViaUSB(payload, options = {}) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");

  const isMarket = options?.receiptStyle === "market";
  if (isMarket && resolveGraphicPrint(options)) {
    await printReceiptJSONGraphicViaUSB(payload, options);
    return;
  }

  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    if (options?.interactive === false) {
      throw new Error("Принтер не подключен");
    }
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);
  saveVidPidToLS(dev);

  const cfg = getEscposRuntimeConfig({ marketDefault: isMarket });
  const parts = buildReceiptFromJSON(payload, {
    width: cfg.charsPerLine,
    codepage: cfg.codepage,
    encoder: cfg.encoder,
    receiptStyle: options?.receiptStyle,
  });
  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}

function unwrapPrintablePayload(source, depth = 0) {
  if (depth > 3 || source == null) return source;
  if (source instanceof Blob) return source;
  if (Array.isArray(source?.items)) return source;
  if (typeof source === "string") return source;
  if (typeof source !== "object") return source;

  const candidates = [
    source.receipt,
    source.checkoutResponse,
    source.payload,
    source.data,
    source.result,
    source.response,
    source.body,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const unwrapped = unwrapPrintablePayload(candidate, depth + 1);
    if (
      unwrapped instanceof Blob ||
      typeof unwrapped === "string" ||
      Array.isArray(unwrapped?.items)
    ) {
      return unwrapped;
    }
  }

  return source;
}

/* ---------- Минимальная печать PC866 (XP-N160II) ---------- */
export async function printRussianRawUsb(text = "Привет, мир!", options = {}) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    if (options?.interactive === false) {
      throw new Error("Принтер не подключен");
    }
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);
  saveVidPidToLS(dev);

  const cfg = getEscposRuntimeConfig();
  // ESC/POS: init, font/line, international USA, codepage, text, cut
  const init = ESC(0x1b, 0x40);
  const setup = buildEscPosPrinterSetup(cfg);
  const intl = ESC(0x1b, 0x52, 0x00);
  const cp = ESC(0x1b, 0x74, cfg.codepage);
  const body = cfg.encoder(String(text) + "\n");
  const cut = ESC(0x1d, 0x56, 0x00);

  const setupLen = setup.reduce((n, p) => n + p.length, 0);
  const data = new Uint8Array(
    init.length + setupLen + intl.length + cp.length + body.length + cut.length,
  );
  let o = 0;
  data.set(init, o);
  o += init.length;
  for (const part of setup) {
    data.set(part, o);
    o += part.length;
  }
  data.set(intl, o);
  o += intl.length;
  data.set(cp, o);
  o += cp.length;
  data.set(body, o);
  o += body.length;
  data.set(cut, o);

  for (const chunk of chunkBytes(data)) {
    await dev.transferOut(outEP, chunk);
  }
}

/* ---------- Главная функция обработки ответа для печати ---------- */
const PRINT_FORMAT_ERROR = "Неизвестный формат ответа для печати";

/** Ответ, который нельзя «обогащать» копированием полей: PDF/бинарь/поток. */
export function isOpaquePrintPayload(payload) {
  return (
    (typeof Blob !== "undefined" && payload instanceof Blob) ||
    (typeof ArrayBuffer !== "undefined" && payload instanceof ArrayBuffer) ||
    ArrayBuffer.isView(payload) ||
    (typeof ReadableStream !== "undefined" && payload instanceof ReadableStream)
  );
}

export function enrichMarketReceiptPayload(payload, meta = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  // Серверный чек приходит PDF-блобом: спред превратил бы его в пустой {}
  // и печать падала бы с «Неизвестный формат ответа для печати».
  if (isOpaquePrintPayload(payload)) return payload;
  const next = { ...payload };
  const orderTotal = toNum(
    meta.total ?? next.total_amount ?? next.paid_cash ?? next.paid_card,
  );
  const method = String(
    meta.paymentMethod ?? next.payment_method ?? "",
  ).toLowerCase();
  const received = toNum(
    meta.amountReceived ?? meta.cash_received ?? next.cash_received,
  );
  const paidCash = toNum(meta.paidCash ?? next.paid_cash);
  const paidCard = toNum(meta.paidCard ?? next.paid_card);
  const cashPaid = paidCash > 0 ? paidCash : orderTotal;

  if (method === "cash" || paidCash > 0 || received > 0) {
    const cashReceived =
      received > 0 ? received : cashPaid > 0 ? cashPaid : orderTotal;
    const change = toNum(
      meta.change ?? next.change ?? Math.max(0, cashReceived - cashPaid),
    );

    next.payment_method = next.payment_method || method || "cash";
    next.cash_received = cashReceived;
    next.paid_cash = cashPaid;
    next.change = change;
  }

  if (paidCard > 0) next.paid_card = paidCard;

  return next;
}

function resolveMarketPrintOptions(options = {}) {
  if (options.receiptStyle) return options;
  const sectorSlug = String(safeLsGet("selectedSector") || "").toLowerCase();
  if (sectorSlug === "market") {
    return { ...options, receiptStyle: "market" };
  }
  return options;
}

export async function handleCheckoutResponseForPrinting(res, options = {}) {
  const printOptions = resolveMarketPrintOptions(options);
  const printable = unwrapPrintablePayload(res);

  if (typeof printable === "string") {
    const text = printable.trim();
    if (text.startsWith("data:application/pdf;base64,")) {
      const b64 = text.split(",")[1] || "";
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await printReceiptFromPdfUSB(
        new Blob([bin], { type: "application/pdf" }),
        printOptions,
      );
      return;
    }
    try {
      const json = JSON.parse(text);
      if (json && Array.isArray(json.items)) {
        await printReceiptJSONViaUSB(json, printOptions);
        return;
      }
    } catch {
      // not json
    }
  }

  if (
    printable &&
    typeof printable === "object" &&
    !(printable instanceof Blob) &&
    Array.isArray(printable.items)
  ) {
    await printReceiptJSONViaUSB(printable, printOptions);
    return;
  }
  if (printable instanceof Blob) {
    if (await looksLikePdf(printable)) {
      await printReceiptFromPdfUSB(printable, printOptions);
      return;
    }
    const parsed = await tryParseJsonFromBlob(printable);
    if (parsed?.json) {
      await printReceiptJSONViaUSB(parsed.json, printOptions);
      return;
    }
    if (parsed?.pdfBlob && (await looksLikePdf(parsed.pdfBlob))) {
      await printReceiptFromPdfUSB(parsed.pdfBlob, printOptions);
      return;
    }
    // не PDF и не JSON — сохраним как файл (фолбэк)
    const url = URL.createObjectURL(printable);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt.pdf";
    a.click();
    URL.revokeObjectURL(url);
    throw new Error("Получен невалидный PDF и не JSON: сохранён как файл.");
  }
  if (
    printable &&
    typeof printable === "object" &&
    Array.isArray(printable.items)
  ) {
    await printReceiptJSONViaUSB(printable, printOptions);
    return;
  }
  throw new Error(PRINT_FORMAT_ERROR);
}

/**
 * Ошибка формата ответа (а не принтера): переподключение USB тут не поможет,
 * нужно брать другой источник чека.
 */
export function isPrintFormatError(err) {
  const message = String(err?.message ?? err ?? "");
  return (
    message.includes(PRINT_FORMAT_ERROR) ||
    message.includes("Получен невалидный PDF и не JSON")
  );
}
