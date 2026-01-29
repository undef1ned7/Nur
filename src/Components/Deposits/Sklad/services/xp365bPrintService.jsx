/**
 * XPrinter XP-350B / XP-365B — TSPL • 203 DPI
 * Кириллица: CP866
 *
 * Этикетка: 30x20 мм, GAP 2 мм
 *
 * ✅ Фикс поворота: ORIENTATION
 * - "normal"  -> печатает как есть (SIZE 30x20)
 * - "rotated" -> компенсирует поворот (SIZE 20x30) — когда у тебя выходит боком
 */

const ORIENTATION = "normal"; // <-- поставь "normal" если печать станет ровно
const DEFAULT_FONT_ID = "1";

/* ====================== USB STATE ====================== */

const usbState = {
  dev: null,
  outEP: null,
  intfNum: null,
};

let usbListenersAttached = false;

/* ====================== UTILS ====================== */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chunkBytes = (u8, size = 4096) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

/* ====================== CP866 ====================== */

function encodeCP866(str = "") {
  const out = [];

  for (const ch of String(str)) {
    const c = ch.codePointAt(0);

    if (c <= 0x7f) out.push(c);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0x80 + (c - 0x0410)); // А-Я
    else if (c >= 0x0430 && c <= 0x043f) out.push(0xa0 + (c - 0x0430)); // а-п
    else if (c >= 0x0440 && c <= 0x044f) out.push(0xe0 + (c - 0x0440)); // р-я
    else if (c === 0x0401) out.push(0xf0); // Ё
    else if (c === 0x0451) out.push(0xf1); // ё
    else if (c === 0x2116) out.push(0xfc); // №
    else out.push(0x3f); // ?
  }

  return new Uint8Array(out);
}

/* ====================== WEBUSB ====================== */

async function requestUsbDevice() {
  return navigator.usb.requestDevice({
    filters: [{ classCode: 0x07 }], // printer
  });
}

async function openUsbDevice(dev) {
  await dev.open();
  if (!dev.configuration) await dev.selectConfiguration(1);

  let outEP = null;
  let intfNum = null;

  for (const intf of dev.configuration.interfaces) {
    for (const alt of intf.alternates) {
      const ep = alt.endpoints.find(
        (e) => e.direction === "out" && e.type === "bulk"
      );
      if (ep) {
        outEP = ep.endpointNumber;
        intfNum = intf.interfaceNumber;
        break;
      }
    }
    if (outEP != null) break;
  }

  if (outEP == null || intfNum == null) {
    throw new Error("Bulk OUT endpoint не найден");
  }

  await dev.claimInterface(intfNum);

  usbState.dev = dev;
  usbState.outEP = outEP;
  usbState.intfNum = intfNum;
}

/* ====================== SEND TSPL ====================== */

async function sendTspl(tspl) {
  if (!usbState.dev || usbState.outEP == null) {
    throw new Error("Принтер не подключен");
  }

  const buf = encodeCP866(tspl);

  for (const part of chunkBytes(buf)) {
    await usbState.dev.transferOut(usbState.outEP, part);
    await sleep(5);
  }
}

/* ====================== INIT (CYRILLIC) ====================== */

async function initPrinter() {
  // ESC t 17 — часто CP866 на XPrinter
  await sendTspl(String.fromCharCode(0x1b) + "t" + String.fromCharCode(0x11));

  const cmds = ["CODEPAGE 866", "SET GAP ON", "SET BLINE OFF", "\r\n"].join(
    "\r\n"
  );

  await sendTspl(cmds);
}

/* ====================== CONNECT ====================== */

export async function connectXprinter() {
  if (usbState.dev && usbState.outEP != null && usbState.dev.opened) return;

  const dev = await requestUsbDevice();
  await openUsbDevice(dev);
  await initPrinter();
}

/* ====================== LISTENERS ====================== */

export function attachXp365bUsbListenersOnce() {
  if (usbListenersAttached) return;
  usbListenersAttached = true;

  if (typeof navigator === "undefined" || !navigator.usb?.addEventListener) return;

  navigator.usb.addEventListener("disconnect", (event) => {
    if (usbState.dev && event?.device === usbState.dev) {
      usbState.dev = null;
      usbState.outEP = null;
      usbState.intfNum = null;
    }
  });
}

export async function checkXp365bConnection() {
  return !!(usbState.dev && usbState.outEP != null && usbState.dev.opened);
}

export const connectXp365bManually = connectXprinter;

/* ====================== CALIBRATION ====================== */

export async function calibrateXprinter({
  widthMm = 30,
  heightMm = 20,
  gapMm = 2,
} = {}) {
  await connectXprinter();

  const w = ORIENTATION === "rotated" ? heightMm : widthMm;
  const h = ORIENTATION === "rotated" ? widthMm : heightMm;

  const tspl = [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gapMm} mm,0 mm`,
    "CLS",
    "PRINT 1",
    "\r\n",
  ].join("\r\n");

  await sendTspl(tspl);
}

/* ====================== TEXT UTILS ====================== */

function safeTsplText(s) {
  return String(s || "").replace(/"/g, "").trim();
}

function formatPrice(value) {
  const num = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(num)) return "";
  return Math.round(num).toString();
}

function wrap(text = "", width = 16, maxLines = 2) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";

  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= width) line = next;
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);

  return out.slice(0, maxLines);
}

/* ====================== LABEL BUILDER ====================== */

function buildLabel({
  title,
  barcode,
  price,
  widthMm = 20,
  heightMm = 30,
  gapMm = 2,
  fontId = DEFAULT_FONT_ID,
  textScale = 1,
  lineGap = 14,
  gapAfterTitle = 10,
  gapAfterPrice = 8,
  barcodeRaise = 3,
  barcodeHeight = 44,
  barcodeBarWidth = 2,
}) {
  const t0 = safeTsplText(title || "ТОВАР");
  const code = safeTsplText(barcode || "9785699275397");

  const priceText =
    price !== undefined && price !== null && String(price).trim() !== ""
      ? safeTsplText(`Цена: ${formatPrice(price)} с`)
      : "";

  const font = String(fontId || DEFAULT_FONT_ID);
  const textScaleInt = Math.max(1, Math.round(textScale));
  const lineGapDots = Math.max(1, Math.round(lineGap));
  const gapAfterTitleDots = Math.max(0, Math.round(gapAfterTitle));
  const gapAfterPriceDots = Math.max(0, Math.round(gapAfterPrice));
  const barcodeRaiseDots = Math.max(0, Math.round(barcodeRaise));
  const barcodeHeightDots = Math.max(1, Math.round(barcodeHeight));
  const barcodeBarWidthDots = Math.max(1, Math.round(barcodeBarWidth));
  const fontBaseMap = {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 8,
  };
  const fontBase = fontBaseMap[Number(font)] ?? 6;
  const getBarcodeModuleCount = (value) => {
    const codeValue = String(value || "");
    if (/^\d{13}$/.test(codeValue)) return 95 + 20;
    if (/^\d{8}$/.test(codeValue)) return 67 + 20;
    if (/^\d{12}$/.test(codeValue)) return 95 + 20;
    return 11 * codeValue.length + 35 + 20;
  };

  // ✅ Ориентация (компенсация поворота)
  const w = ORIENTATION === "rotated" ? heightMm : widthMm;
  const h = ORIENTATION === "rotated" ? widthMm : heightMm;

  const mmToDots = (mm) => Math.max(1, Math.round(mm * 8));
  const W = mmToDots(w);
  const H = mmToDots(h);

  // safe zone (непечатные края)
  const borderPadX = 10;
  const borderPadY = 10;
  const borderW = W - borderPadX;
  const borderH = H - borderPadY;

  // ---------- РАМКА (пунктир) ----------
  const margin = 6;
  const thick = 2;
  const dash = 10;
  const space = 6;

  const leftX = margin;
  const rightX = borderW - margin - thick;
  const topY = margin;
  const botY = borderH - margin - thick;

  const border = [];

  for (let x = leftX; x < rightX; x += dash + space) {
    const bw = Math.min(dash, rightX - x);
    border.push(`BAR ${x},${topY},${bw},${thick}`);
    border.push(`BAR ${x},${botY},${bw},${thick}`);
  }

  for (let y = topY; y < botY; y += dash + space) {
    const bh = Math.min(dash, botY - y);
    border.push(`BAR ${leftX},${y},${thick},${bh}`);
    border.push(`BAR ${rightX},${y},${thick},${bh}`);
  }

  // ---------- ТЕКСТ ----------
  const wrapWidth = Math.max(6, Math.round(16 / textScaleInt));
  const lines = wrap(t0, wrapWidth, 2);
  const lineCount = Math.max(1, lines.filter(Boolean).length);
  const titleLineGap = lineGapDots;

  // ---------- ШТРИХКОД ----------
  const isEAN13 = /^\d{13}$/.test(code);
  const isEAN8 = /^\d{8}$/.test(code);
  const isUPCA = /^\d{12}$/.test(code);
  const bcType = isEAN13 ? "EAN13" : isEAN8 ? "EAN8" : isUPCA ? "UPCA" : "128";

  const barcodeModules = getBarcodeModuleCount(code);
  const barcodeWidthDots = Math.round(barcodeModules * barcodeBarWidthDots);
  const bcH = barcodeHeightDots;
  const barcodeBottomGap = 2;
  const textBlockHeight = titleLineGap * lineCount;
  const priceBlockHeight = priceText ? gapAfterTitleDots + titleLineGap : 0;
  const gapToBarcode = priceText ? gapAfterPriceDots : gapAfterTitleDots;
  const barcodeBlockHeight = gapToBarcode + bcH + barcodeBottomGap;
  const contentHeight = textBlockHeight + priceBlockHeight + barcodeBlockHeight;
  const safePad = margin + thick;
  const safeLeft = safePad;
  const safeTop = safePad;
  const safeW = W - safePad * 2;
  const safeH = H - safePad * 2;
  const startY = safeTop + Math.max(0, Math.round((safeH - contentHeight) / 2));
  const titleY = startY;
  const priceY = priceText ? titleY + textBlockHeight + gapAfterTitleDots : null;
  const desiredBarcodeY =
    titleY + textBlockHeight + priceBlockHeight + gapToBarcode - barcodeRaiseDots;
  const maxBarcodeY = safeTop + safeH - bcH - barcodeBottomGap;
  const bcY = Math.min(desiredBarcodeY, maxBarcodeY);
  const maxPriceY = bcY - gapAfterPriceDots - titleLineGap;
  const clampedPriceY = priceText ? Math.min(priceY, maxPriceY) : null;
  const x = safeLeft;
  const priceX = safeLeft;
  const bcX = safeLeft + Math.max(0, Math.round((safeW - barcodeWidthDots) / 2));

  const narrow = barcodeBarWidthDots;
  const wide = barcodeBarWidthDots;

  return [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gapMm} mm,0 mm`,
    "SPEED 4",
    "DENSITY 6",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "OFFSET 0",
    "CLS",
    "CODEPAGE 866",

    ...border,

    `TEXT ${x},${titleY},"${font}",0,${textScaleInt},${textScaleInt},"${lines[0] || ""}"`,
    lines[1]
      ? `TEXT ${x},${titleY + titleLineGap},"${font}",0,${textScaleInt},${textScaleInt},"${lines[1]}"`
      : "",
    priceText
      ? `TEXT ${priceX},${clampedPriceY},"${font}",0,${textScaleInt},${textScaleInt},"${priceText}"`
      : "",

    `BARCODE ${bcX},${bcY},"${bcType}",${bcH},1,0,${narrow},${wide},"${code}"`,

    "PRINT 1",
    "\r\n",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/* ====================== MAIN PRINT API ====================== */

async function printLabel({
  title,
  barcode,
  price,
  widthMm,
  heightMm,
  gapMm,
  fontId,
  textScale,
  lineGap,
  gapAfterTitle,
  gapAfterPrice,
  barcodeRaise,
  barcodeHeight,
  barcodeBarWidth,
}) {
  await connectXprinter();
  const tspl = buildLabel({
    title,
    barcode,
    price,
    widthMm,
    heightMm,
    gapMm,
    fontId,
    textScale,
    lineGap,
    gapAfterTitle,
    gapAfterPrice,
    barcodeRaise,
    barcodeHeight,
    barcodeBarWidth,
  });
  await sendTspl(tspl);
}

/**
 * Main API used by `BarcodePrintTab.jsx`
 */
export async function printXp365bBarcodeLabel({
  title,
  barcode,
  price,
  widthMm = 30,
  heightMm = 20,
  gapMm = 2,
  fontId = DEFAULT_FONT_ID,
  textScale = 1,
  lineGap = 7,
  gapAfterTitle = 10,
  gapAfterPrice = 8,
  barcodeRaise = 3,
  barcodeHeight = 44,
  barcodeBarWidth = 2,
}) {
  await printLabel({
    title,
    barcode,
    price,
    widthMm,
    heightMm,
    gapMm,
    fontId,
    textScale,
    lineGap,
    gapAfterTitle,
    gapAfterPrice,
    barcodeRaise,
    barcodeHeight,
    barcodeBarWidth,
  });
}

/* ====================== TEST ====================== */

export async function testPrint() {
  await printXp365bBarcodeLabel({
    title: "КЛИПЫ 3 СТИЛИ",
    barcode: "2000533006751",
    price: 250,
    widthMm: 30,
    heightMm: 20,
    gapMm: 2,
  });
}

/* ====================== DEVTOOLS ====================== */

if (typeof window !== "undefined") {
  window.printLabel = printXp365bBarcodeLabel;
  window.testPrint = testPrint;
  window.calibrateXprinter = calibrateXprinter;
}
