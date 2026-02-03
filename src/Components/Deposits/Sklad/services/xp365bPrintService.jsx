import JsBarcode from "jsbarcode";

/**
 * XPrinter XP-350B / XP-365B — TSPL • 203 DPI
 *
 * Цель: стабильная печать кириллицы без "карябязи".
 * По умолчанию используем:
 * - TSPL: CODEPAGE WPC1251
 * - Encoding: Windows-1251 (CP1251)
 *
 * При необходимости можно переключить на CP866:
 * - localStorage.setItem("xp365b_codepage", "866")
 *
 * Примечание: названия CODEPAGE в TSPL зависят от прошивки.
 * Тут для 1251 отправляем строго WPC1251 (как вы просили).
 */

const LS_CODEPAGE = "xp365b_codepage"; // "WPC1251" | "1251" | "866"
const LS_ORIENTATION = "xp365b_orientation"; // "normal" | "rotated"
const LS_RENDER_MODE = "xp365b_render_mode"; // "raster" | "tspl"
const RASTER_FONT_FAMILY_LS = "xp365b_raster_font_family";
const RASTER_INVERT_LS = "xp365b_raster_invert";

const DEFAULT_CODEPAGE = 1251;
const DEFAULT_CODEPAGE_TOKEN = "WPC1251";
const DEFAULT_ORIENTATION = "normal";
const DEFAULT_RENDER_MODE = "raster";
const DEFAULT_FONT_ID = "1";

/* ====================== USB STATE ====================== */

const usbState = {
  dev: null,
  outEP: null,
  intfNum: null,
};

let usbListenersAttached = false;
let sendQueue = Promise.resolve(); // serialize writes to avoid interleaving TSPL

/* ====================== UTILS ====================== */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chunkBytes = (u8, size = 4096) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

function normalizeCodepage(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_CODEPAGE;
  if (/^wpc\s*1251$/i.test(raw)) return 1251;
  if (/^cp\s*1251$/i.test(raw)) return 1251;
  if (/^1251$/i.test(raw)) return 1251;
  if (/^866$/i.test(raw)) return 866;
  return DEFAULT_CODEPAGE;
}

export function getXp365bCodepage() {
  try {
    return normalizeCodepage(localStorage.getItem(LS_CODEPAGE));
  } catch {
    return DEFAULT_CODEPAGE;
  }
}

export function setXp365bCodepage(cp) {
  try {
    localStorage.setItem(LS_CODEPAGE, String(cp));
  } catch { }
}

function getTsplCodepageToken() {
  const cp = getXp365bCodepage();
  // Requested: WPC1251
  if (cp === 1251) return DEFAULT_CODEPAGE_TOKEN;
  // For CP866 most firmwares accept numeric "866"
  return "866";
}

function getOrientation() {
  try {
    const v = String(localStorage.getItem(LS_ORIENTATION) || "").trim().toLowerCase();
    return v === "rotated" ? "rotated" : DEFAULT_ORIENTATION;
  } catch {
    return DEFAULT_ORIENTATION;
  }
}

export function setXp365bOrientation(v) {
  try {
    localStorage.setItem(LS_ORIENTATION, v === "rotated" ? "rotated" : "normal");
  } catch { }
}

function getRenderMode(requested) {
  if (requested === "raster" || requested === "tspl") return requested;
  try {
    const raw = String(localStorage.getItem(LS_RENDER_MODE) || "").trim().toLowerCase();
    if (raw === "raster" || raw === "tspl") return raw;
  } catch { }
  return DEFAULT_RENDER_MODE;
}

export function setXp365bRenderMode(mode) {
  try {
    localStorage.setItem(LS_RENDER_MODE, mode === "tspl" ? "tspl" : "raster");
  } catch { }
}

function getRasterFontFamily() {
  try {
    const raw = String(localStorage.getItem(RASTER_FONT_FAMILY_LS) || "").trim();
    return raw || "Arial";
  } catch {
    return "Arial";
  }
}

export function setXp365bRasterFontFamily(name) {
  try {
    localStorage.setItem(RASTER_FONT_FAMILY_LS, String(name || "Arial"));
  } catch { }
}

function getRasterInvert() {
  try {
    const raw = String(localStorage.getItem(RASTER_INVERT_LS) || "").trim().toLowerCase();
    if (raw === "0" || raw === "false" || raw === "no") return false;
  } catch { }
  // Default to true because many TSPL firmwares treat 0 as black.
  return true;
}

export function setXp365bRasterInvert(v) {
  try {
    localStorage.setItem(RASTER_INVERT_LS, v ? "true" : "false");
  } catch { }
}

/* ====================== ENCODING: CP866 / CP1251 ====================== */

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
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}

function encodeCP1251(str = "") {
  const out = [];
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c === 0x0401) out.push(0xa8); // Ё
    else if (c === 0x0451) out.push(0xb8); // ё
    else if (c >= 0x0410 && c <= 0x042f) out.push(0xc0 + (c - 0x0410)); // А-Я
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xe0 + (c - 0x0430)); // а-я
    else if (c === 0x2116) out.push(0xb9); // №
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}

function encodeForPrinter(str = "") {
  const cp = getXp365bCodepage();
  return cp === 866 ? encodeCP866(str) : encodeCP1251(str);
}

/* ====================== WEBUSB CONNECT ====================== */

async function requestUsbDevice() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("WebUSB не поддерживается (нужен Chrome/Edge)");
  }
  return navigator.usb.requestDevice({
    // Some XPrinters use vendor-specific class; keep broad enough
    filters: [{ classCode: 0x07 }, { classCode: 0xff }],
  });
}

async function openUsbDevice(dev) {
  await dev.open();
  if (!dev.configuration) await dev.selectConfiguration(1).catch(() => { });

  const cfg = dev.configuration;
  if (!cfg) throw new Error("Нет активной USB-конфигурации");

  let outEP = null;
  let intfNum = null;

  for (const intf of cfg.interfaces) {
    for (const alt of intf.alternates) {
      const ep = (alt.endpoints || []).find(
        (e) => e.direction === "out" && e.type === "bulk"
      );
      if (!ep) continue;

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
        } catch { }
        continue;
      }

      outEP = ep.endpointNumber;
      intfNum = intf.interfaceNumber;
      break;
    }
    if (outEP != null) break;
  }

  if (outEP == null || intfNum == null) {
    throw new Error("Bulk OUT endpoint не найден (проверь WinUSB/Zadig и что принтер не занят)");
  }

  usbState.dev = dev;
  usbState.outEP = outEP;
  usbState.intfNum = intfNum;
}

/* ====================== SEND TSPL (QUEUED) ====================== */

function ensureCrLf(s) {
  const v = String(s ?? "");
  return v.endsWith("\r\n") ? v : v + "\r\n";
}

async function sendTsplQueued(tspl) {
  sendQueue = sendQueue.then(async () => {
    if (!usbState.dev || usbState.outEP == null || !usbState.dev.opened) {
      throw new Error("Принтер не подключен");
    }

    const payload = ensureCrLf(tspl);
    const buf = encodeForPrinter(payload);

    for (const part of chunkBytes(buf)) {
      await usbState.dev.transferOut(usbState.outEP, part);
      await sleep(5);
    }
  });
  return sendQueue;
}

async function sendBytesQueued(bytes) {
  sendQueue = sendQueue.then(async () => {
    if (!usbState.dev || usbState.outEP == null || !usbState.dev.opened) {
      throw new Error("Принтер не подключен");
    }
    for (const part of chunkBytes(bytes)) {
      await usbState.dev.transferOut(usbState.outEP, part);
      await sleep(5);
    }
  });
  return sendQueue;
}

/* ====================== INIT ====================== */

async function initPrinter() {
  const cmds = [
    `CODEPAGE ${getTsplCodepageToken()}`,
    "SET GAP ON",
    "SET BLINE OFF",
    "\r\n",
  ].join("\r\n");
  await sendTsplQueued(cmds);
}

export async function connectXprinter() {
  if (usbState.dev && usbState.outEP != null && usbState.dev.opened) {
    // Re-apply settings to avoid "random" codepage after power cycle
    await initPrinter().catch(() => { });
    return;
  }

  const dev = await requestUsbDevice();
  await openUsbDevice(dev);
  await initPrinter();
}

export const connectXp365bManually = connectXprinter;

/* ====================== LISTENERS / HEALTH ====================== */

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

/* ====================== CALIBRATION ====================== */

export async function calibrateXprinter({
  widthMm = 30,
  heightMm = 20,
  gapMm = 2,
} = {}) {
  await connectXprinter();
  const orientation = getOrientation();
  const w = orientation === "rotated" ? heightMm : widthMm;
  const h = orientation === "rotated" ? widthMm : heightMm;

  const tspl = [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gapMm} mm,0 mm`,
    "CLS",
    "PRINT 1",
    "\r\n",
  ].join("\r\n");

  await sendTsplQueued(tspl);
}

/* ====================== LABEL BUILD ====================== */

function safeTsplText(s) {
  // TSPL TEXT uses "...", so remove quotes and control chars
  return String(s ?? "")
    .replace(/"/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function wrapByPixelWidth(ctx, text, maxPx, maxLines = 2) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    const width = ctx.measureText(next).width;
    if (width <= maxPx || !line) {
      line = next;
    } else {
      out.push(line);
      line = w;
      if (out.length >= maxLines) break;
    }
  }
  if (line && out.length < maxLines) out.push(line);
  return out.slice(0, maxLines);
}

function drawFullWidthText(
  ctx,
  text,
  x,
  y,
  width,
  fontSize,
  fontFamily,
  fontWeight = "normal",
  boldOffset = 0
) {
  const str = String(text || "");
  if (!str) return;
  let size = Math.max(6, Math.round(fontSize));
  let widths = [];
  let totalWidth = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    widths = Array.from(str).map((ch) => ctx.measureText(ch).width);
    totalWidth = widths.reduce((s, w) => s + w, 0);
    if (totalWidth <= width || size <= 6) break;
    size = Math.max(6, Math.floor(size * 0.9));
  }

  const gap = str.length > 1 ? Math.max(0, (width - totalWidth) / (str.length - 1)) : 0;
  let cursor = x;
  for (let i = 0; i < str.length; i += 1) {
    ctx.fillText(str[i], cursor, y);
    if (boldOffset) ctx.fillText(str[i], cursor + boldOffset, y);
    cursor += widths[i] + gap;
  }
}

function normalizeEan13(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 13) return digits;
  if (digits.length !== 12) return "";
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const d = Number(digits[i] || 0);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return digits + String(check);
}

function buildLabel({
  title,
  barcode,
  price,
  widthMm = 30,
  heightMm = 20,
  gapMm = 2,
  fontId = DEFAULT_FONT_ID,
  textScale = 1,
  lineGap = 7,
  gapAfterTitle = 7,
  gapAfterPrice = 4,
  barcodeRaise = 3,
  barcodeHeight = 44,
  barcodeBarWidth = 2,
}) {
  const t0 = safeTsplText(title || "ТОВАР");
  const rawCode = safeTsplText(barcode || "");
  if (!rawCode) throw new Error("Пустой штрих-код");
  const code = normalizeEan13(rawCode);
  if (!code) throw new Error("EAN‑13 требует 12 или 13 цифр");

  const priceText =
    price !== undefined && price !== null && String(price).trim() !== ""
      ? safeTsplText(`Цена: ${formatPrice(price)} с`)
      : "";

  const font = String(fontId || DEFAULT_FONT_ID);
  const textScaleInt = Math.max(1, Math.round(Number(textScale) || 1));
  const lineGapDots = Math.max(1, Math.round(Number(lineGap) || 7));
  const gapAfterTitleDots = Math.max(0, Math.round(Number(gapAfterTitle) || 0));
  const gapAfterPriceDots = Math.max(0, Math.round(Number(gapAfterPrice) || 0));
  const barcodeRaiseDots = Math.max(0, Math.round(Number(barcodeRaise) || 0));
  const barcodeHeightFactor = 0.8; // slightly taller
  const barcodeHeightDots = Math.max(
    1,
    Math.round((Number(barcodeHeight) || 44) * barcodeHeightFactor)
  );
  const barcodeDensityFactor = 1.1; // slightly thicker
  const barcodeBarWidthDots = Math.max(
    1,
    Math.round((Number(barcodeBarWidth) || 2) * barcodeDensityFactor)
  );
  const fontBaseMap = {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 8,
  };
  const fontBase = fontBaseMap[Number(font)] ?? 6;
  const charWidth = fontBase * textScaleInt;

  const orientation = getOrientation();
  const w = orientation === "rotated" ? heightMm : widthMm;
  const h = orientation === "rotated" ? widthMm : heightMm;

  const mmToDots = (mm) => Math.max(1, Math.round(Number(mm) * 8)); // 203dpi ~ 8 dots/mm
  const W = mmToDots(w);
  const H = mmToDots(h);
  const shiftX = Math.round(W * 0.05);
  const shiftContentX = -shiftX;
  const sx = (v) => Math.max(0, Math.round(v));

  // safe zone
  const margin = 6;
  const thick = 2;
  const safePad = margin + thick;
  const safeLeft = safePad + shiftContentX;
  const safeTop = safePad;
  const safeW = W - safePad * 2;
  const safeH = H - safePad * 2;

  // dashed border
  const dash = 10;
  const space = 6;
  const leftX = sx(margin + shiftContentX);
  const rightX = sx(W - margin - thick + shiftContentX);
  const topY = margin;
  const botY = H - margin - thick;
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

  const wrapWidth = Math.max(6, Math.round(16 / textScaleInt));
  const lines = wrap(t0, wrapWidth, 2);
  const lineCount = Math.max(1, lines.filter(Boolean).length);
  const lineWidth = (line) => (line ? line.length * charWidth : 0);

  // barcode type: force EAN-13
  const bcType = "EAN13";

  // estimate barcode width to center it
  const getBarcodeModuleCount = (value) => {
    const codeValue = String(value || "");
    if (/^\d{13}$/.test(codeValue)) return 95 + 20;
    if (/^\d{8}$/.test(codeValue)) return 67 + 20;
    if (/^\d{12}$/.test(codeValue)) return 95 + 20;
    return 11 * codeValue.length + 35 + 20;
  };
  const barcodeModules = getBarcodeModuleCount(code);
  const barcodeWidthDots = Math.round(barcodeModules * barcodeBarWidthDots);

  const textBlockHeight = lineGapDots * lineCount;
  const priceBlockHeight = priceText ? gapAfterTitleDots + lineGapDots : 0;
  const gapToBarcode = priceText ? gapAfterPriceDots : gapAfterTitleDots;
  const barcodeBottomGap = 2;
  const barcodeBlockHeight = gapToBarcode + barcodeHeightDots + barcodeBottomGap;
  const contentHeight = textBlockHeight + priceBlockHeight + barcodeBlockHeight;
  const startY = safeTop + Math.max(0, Math.round((safeH - contentHeight) / 2));

  const titleY = startY;
  const desiredPriceY = priceText ? titleY + textBlockHeight + gapAfterTitleDots : null;
  const desiredBarcodeY =
    titleY + textBlockHeight + priceBlockHeight + gapToBarcode - barcodeRaiseDots;

  const maxBarcodeY = safeTop + safeH - barcodeHeightDots - barcodeBottomGap;
  const bcY = Math.min(desiredBarcodeY, maxBarcodeY);

  const maxPriceY = bcY - gapAfterPriceDots - lineGapDots;
  const priceY = priceText ? Math.min(desiredPriceY, maxPriceY) : null;

  const titleX1 = sx(
    safeLeft + Math.max(0, Math.round((safeW - lineWidth(lines[0])) / 2))
  );
  const titleX2 = sx(
    safeLeft + Math.max(0, Math.round((safeW - lineWidth(lines[1])) / 2))
  );
  const priceX = sx(
    safeLeft + Math.max(0, Math.round((safeW - lineWidth(priceText)) / 2))
  );
  const barcodeShiftX = Math.round(W * 0.03);
  // Barcode centered, then shifted a bit left
  const bcX = sx(Math.max(0, Math.round((W - barcodeWidthDots) / 2) - barcodeShiftX));

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
    `CODEPAGE ${getTsplCodepageToken()}`,
    ...border,
    `TEXT ${titleX1},${titleY},"${font}",0,${textScaleInt},${textScaleInt},"${lines[0] || ""}"`,
    lines[1]
      ? `TEXT ${titleX2},${titleY + lineGapDots},"${font}",0,${textScaleInt},${textScaleInt},"${lines[1]}"`
      : "",
    priceText && priceY != null
      ? `TEXT ${priceX},${priceY},"${font}",0,${textScaleInt},${textScaleInt},"${priceText}"`
      : "",
    priceText && priceY != null
      ? `TEXT ${priceX + 1},${priceY},"${font}",0,${textScaleInt},${textScaleInt},"${priceText}"`
      : "",
    `BARCODE ${bcX},${bcY},"${bcType}",${barcodeHeightDots},1,0,${narrow},${wide},"${code}"`,
    "PRINT 1",
    "\r\n",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function bytesFromAscii(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function canvasToMonoRaster(canvas, threshold = 180, invert = false) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h).data;
  const bytesPerLine = Math.ceil(w / 8);
  const raster = new Uint8Array(bytesPerLine * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = img[i];
      const g = img[i + 1];
      const b = img[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < threshold) {
        raster[y * bytesPerLine + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  if (invert) {
    for (let i = 0; i < raster.length; i += 1) {
      raster[i] = (~raster[i]) & 0xff;
    }
  }
  return { raster, bytesPerLine, width: w, height: h };
}

async function buildRasterLabelBytes({
  title,
  barcode,
  price,
  widthMm = 30,
  heightMm = 20,
  gapMm = 2,
  textScale = 1,
  lineGap = 7,
  gapAfterTitle = 7,
  gapAfterPrice = 4,
  barcodeRaise = 3,
  barcodeHeight = 44,
  barcodeBarWidth = 2,
}) {
  const t0 = safeTsplText(title || "ТОВАР");
  const rawCode = safeTsplText(barcode || "");
  if (!rawCode) throw new Error("Пустой штрих-код");
  const code = normalizeEan13(rawCode);
  if (!code) throw new Error("EAN‑13 требует 12 или 13 цифр");

  const priceText =
    price !== undefined && price !== null && String(price).trim() !== ""
      ? safeTsplText(`Цена: ${formatPrice(price)} с`)
      : "";

  const textScaleInt = Math.max(1, Math.round(Number(textScale) || 1));
  const lineGapDots = Math.max(1, Math.round(Number(lineGap) || 7));
  const gapAfterTitleDots = Math.max(0, Math.round(Number(gapAfterTitle) || 0));
  const gapAfterPriceDots = Math.max(0, Math.round(Number(gapAfterPrice) || 0));
  const barcodeRaiseDots = Math.max(0, Math.round(Number(barcodeRaise) || 0));
  const barcodeHeightFactor = 0.8; // slightly taller
  const barcodeHeightDots = Math.max(
    1,
    Math.round((Number(barcodeHeight) || 44) * barcodeHeightFactor)
  );
  const barcodeDensityFactor = 1.1; // slightly thicker
  const barcodeBarWidthDots = Math.max(
    1,
    Math.round((Number(barcodeBarWidth) || 2) * barcodeDensityFactor)
  );
  const drawBarcodeText = true;
  const barcodeTextSize = Math.max(8, Math.round(lineGapDots * 0.72));
  const barcodeTextMargin = 12;
  const barcodeTextHeight = drawBarcodeText
    ? barcodeTextSize + barcodeTextMargin + 2
    : 0;

  const orientation = getOrientation();
  const w = orientation === "rotated" ? heightMm : widthMm;
  const h = orientation === "rotated" ? widthMm : heightMm;

  const mmToDots = (mm) => Math.max(1, Math.round(Number(mm) * 8));
  const W = mmToDots(w);
  const H = mmToDots(h);
  const shiftX = Math.round(W * 0.05);
  const shiftContentX = -shiftX;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  const fontFamily = getRasterFontFamily();
  const fontSize = Math.max(8, Math.round(lineGapDots * 0.85 * textScaleInt));
  const normalFont = `${fontSize}px ${fontFamily}`;
  const boldFont = `bold ${fontSize}px ${fontFamily}`;
  ctx.font = normalFont;

  const margin = 6;
  const thick = 2;
  const safePad = margin + thick;
  const safeLeft = Math.max(0, safePad + shiftContentX);
  const safeTop = safePad;
  const safeW = W - safePad * 2;
  const safeH = H - safePad * 2;

  // dashed border
  const dash = 10;
  const space = 6;
  const leftX = Math.max(0, margin + shiftContentX);
  const rightX = Math.max(
    leftX + 1,
    Math.min(W - thick, W - margin - thick + shiftContentX)
  );
  const topY = margin;
  const botY = H - margin - thick;
  for (let x = leftX; x < rightX; x += dash + space) {
    const bw = Math.min(dash, rightX - x);
    ctx.fillRect(x, topY, bw, thick);
    ctx.fillRect(x, botY, bw, thick);
  }
  for (let y = topY; y < botY; y += dash + space) {
    const bh = Math.min(dash, botY - y);
    ctx.fillRect(leftX, y, thick, bh);
    ctx.fillRect(rightX, y, thick, bh);
  }

  const lines = wrapByPixelWidth(ctx, t0, safeW, 2);
  const lineCount = Math.max(1, lines.length);
  const textBlockHeight = lineGapDots * lineCount;
  const priceBlockHeight = priceText ? gapAfterTitleDots + lineGapDots : 0;
  const gapToBarcode = priceText ? gapAfterPriceDots : gapAfterTitleDots;
  const barcodeBottomGap = 2;
  const barcodeBlockHeight =
    gapToBarcode + barcodeHeightDots + barcodeTextHeight + barcodeBottomGap;
  const contentHeight = textBlockHeight + priceBlockHeight + barcodeBlockHeight;
  const startY = safeTop + Math.max(0, Math.round((safeH - contentHeight) / 2));

  const titleY = startY;
  lines.forEach((line, i) => {
    const w = ctx.measureText(line).width;
    const textX = Math.max(0, safeLeft + Math.round((safeW - w) / 2));
    ctx.fillText(line, textX, titleY + i * lineGapDots);
  });

  const desiredPriceY = priceText ? titleY + textBlockHeight + gapAfterTitleDots : null;
  const desiredBarcodeY =
    titleY + textBlockHeight + priceBlockHeight + gapToBarcode - barcodeRaiseDots;

  const maxBarcodeY =
    safeTop + safeH - (barcodeHeightDots + barcodeTextHeight) - barcodeBottomGap;
  const bcY = Math.min(desiredBarcodeY, maxBarcodeY);

  const maxPriceY = bcY - gapAfterPriceDots - lineGapDots;
  const priceY = priceText ? Math.min(desiredPriceY, maxPriceY) : null;
  if (priceText && priceY != null) {
    ctx.font = boldFont;
    const priceW = ctx.measureText(priceText).width;
    const priceX = Math.max(0, safeLeft + Math.round((safeW - priceW) / 2));
    ctx.fillText(priceText, priceX, priceY);
    ctx.font = normalFont;
  }

  // barcode: draw on temp canvas
  const barcodeCanvas = document.createElement("canvas");
  const format = "EAN13";

  JsBarcode(barcodeCanvas, code, {
    format,
    width: Math.max(1, barcodeBarWidthDots),
    height: Math.max(1, barcodeHeightDots),
    displayValue: false,
    margin: 0,
    background: "#ffffff",
    lineColor: "#000000",
  });

  const barcodeShiftX = Math.round(W * 0.03);
  const bcX = Math.max(0, Math.round((W - barcodeCanvas.width) / 2) - barcodeShiftX);
  ctx.drawImage(barcodeCanvas, bcX, bcY);
  // make bars a bit bolder
  ctx.drawImage(barcodeCanvas, bcX + 1, bcY);
  if (drawBarcodeText) {
    const textY = bcY + barcodeHeightDots + barcodeTextMargin;
    drawFullWidthText(
      ctx,
      code,
      bcX,
      textY,
      barcodeCanvas.width,
      barcodeTextSize,
      fontFamily,
      "600",
      0
    );
  }

  const { raster, bytesPerLine, height } = canvasToMonoRaster(
    canvas,
    180,
    getRasterInvert()
  );
  const header = [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gapMm} mm,0 mm`,
    "SPEED 4",
    "DENSITY 6",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "OFFSET 0",
    "CLS",
    `BITMAP 0,0,${bytesPerLine},${height},0,`,
  ].join("\r\n");
  const footer = "\r\nPRINT 1\r\n";

  const headerBytes = bytesFromAscii(header);
  const footerBytes = bytesFromAscii(footer);
  const total = new Uint8Array(headerBytes.length + raster.length + footerBytes.length);
  total.set(headerBytes, 0);
  total.set(raster, headerBytes.length);
  total.set(footerBytes, headerBytes.length + raster.length);
  return total;
}

/* ====================== MAIN API ====================== */

export async function printXp365bBarcodeLabel(opts) {
  const options = opts || {};
  await connectXprinter();

  const mode = getRenderMode(options?.renderMode);
  const fontId = String(options?.fontId || "");
  const preferRaster = mode === "raster" || fontId === "__RASTER__";

  if (preferRaster) {
    const bytes = await buildRasterLabelBytes(options);
    await sendBytesQueued(bytes);
    return;
  }

  const tspl = buildLabel(options);
  await sendTsplQueued(tspl);
}

export async function testPrint() {
  await printXp365bBarcodeLabel({
    title: "ТЕСТ: Кириллица Ёё №",
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
  window.setXp365bCodepage = setXp365bCodepage;
  window.setXp365bOrientation = setXp365bOrientation;
  window.setXp365bRenderMode = setXp365bRenderMode;
  window.setXp365bRasterFontFamily = setXp365bRasterFontFamily;
}
