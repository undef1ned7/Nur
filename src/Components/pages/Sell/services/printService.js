/**
 * Print Service
 * Модуль для работы с печатью чеков через WebUSB и ESC/POS принтеры
 */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

const DEFAULT_DOTS_PER_LINE = 576; // 80мм принтер обычно 576 точек
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
  } catch { }
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

// Быстрые тюнеры (пригодятся в консоли):
export function setEscposDotsPerLine(n) {
  safeLsSet("escpos_dpl", String(n));
}
export function setEscposCharsPerLine(n) {
  safeLsSet("escpos_cpl", String(n));
}
export function setEscposLineHeight(n) {
  safeLsSet("escpos_line", String(n));
}
export function setEscposFont(ch) {
  safeLsSet("escpos_font", String(ch).toUpperCase());
}

const ESC = (...b) => new Uint8Array(b);
const chunkBytes = (u8, size = 12 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

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
  safeLsSet("escpos_cp", String(n));
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
export function getEscposRuntimeConfig() {
  const fontRaw = String(safeLsGet("escpos_font") || DEFAULT_FONT).toUpperCase();
  const font = fontRaw === "A" ? "A" : "B";
  const charDotWidth = font === "B" ? 9 : 12;

  const dotsPerLine = safeNumber(safeLsGet("escpos_dpl"), DEFAULT_DOTS_PER_LINE);
  const charsPerLine = safeNumber(
    safeLsGet("escpos_cpl"),
    Math.floor(dotsPerLine / charDotWidth)
  );
  const lineDotHeight = safeNumber(
    safeLsGet("escpos_line"),
    font === "B" ? 22 : 24
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
async function pdfBlobToCanvas(pdfBlob, targetWidth = 384) {
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
function buildEscPosForRaster(raster, bytesPerLine, h) {
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = h & 0xff;
  const yH = (h >> 8) & 0xff;

  const init = ESC(0x1b, 0x40);
  const alignLeft = ESC(0x1b, 0x61, 0x00);
  const header = ESC(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  // компактная подача + рез
  const feedAndCut = new Uint8Array([0x1b, 0x64, 0x01, 0x1d, 0x56, 0x00]);

  
  const total = new Uint8Array(
    init.length +
    alignLeft.length +
    header.length +
    raster.length +
    feedAndCut.length
  );
  let o = 0;
  total.set(init, o);
  o += init.length;
  total.set(alignLeft, o);
  o += alignLeft.length;
  total.set(header, o);
  o += header.length;
  total.set(raster, o);
  o += raster.length;
  total.set(feedAndCut, o);
  return total;
}

/* ---------- JSON → ESC/POS ---------- */
const money = (n) => Number(n || 0).toFixed(2);
function lr(left, right, width = 32) {
  const L = String(left ?? "");
  const R = String(right ?? "");
  const spaces = Math.max(1, width - L.length - R.length);
  return L + " ".repeat(spaces) + R;
}
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fromTyiyn = (v) => toNum(v) / 100;
const f = (fields, key) => (fields && Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined);
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
function buildReceiptFromJSON(payload, opts = {}) {
  const cfg = getEscposRuntimeConfig();
  const width = Math.max(42, opts.width || cfg.charsPerLine);
  const divider = "-".repeat(width);
  const codepage = opts.codepage || cfg.codepage;
  const enc = opts.encoder || getEncoder(codepage);
  const emphasizeMarketReceipt = opts.receiptStyle === "market";
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
    ekassaFields ? (f(ekassaFields, "1042") ?? payload.doc_no ?? "") : (payload.doc_no ?? ""),
  ).trim();
  const dt = String(
    ekassaFields ? (f(ekassaFields, "1012") ?? payload.created_at ?? "") : (payload.created_at ?? ""),
  ).trim();
  const shift = String(ekassaFields ? (f(ekassaFields, "1038") ?? "") : "").trim();

  const items = ekassaFields && Array.isArray(f(ekassaFields, "1059"))
    ? f(ekassaFields, "1059").map((it) => {
      const qty = toNum(it?.["1023"]) || 1;
      // В ответах eKassa для Маркета часто:
      // 1043 = сумма позиции, 1076 = цена за единицу.
      const raw1043 = fromTyiyn(it?.["1043"]);
      const raw1076 = fromTyiyn(it?.["1076"]);
      const price = raw1076 > 0 ? raw1076 : (qty > 0 ? raw1043 / qty : raw1043);
      const total = raw1043 > 0 ? raw1043 : price * qty;
      return {
        name: String(it?.["1030"] || "Товар"),
        qty,
        price,
        total,
      };
    })
    : (Array.isArray(payload.items) ? payload.items : []).map((it) => {
      const qty = toNum(it.qty) || 1;
      const price = toNum(it.price);
      return { name: String(it.name || "Товар"), qty, price, total: qty * price };
    });

  const subtotal = ekassaFields ? fromTyiyn(f(ekassaFields, "1020")) : items.reduce((s, it) => s + toNum(it.total), 0);
  const total = ekassaFields ? fromTyiyn(f(ekassaFields, "1031")) : subtotal;
  const vat = ekassaFields ? fromTyiyn(f(ekassaFields, "1033")) : 0;
  const nsp = ekassaFields ? fromTyiyn(f(ekassaFields, "1215")) : 0;
  const paidCard = ekassaFields ? fromTyiyn(f(ekassaFields, "1081")) : toNum(payload.paid_card);
  const paidCash = Math.max(0, total - paidCard);
  const kkm = String(
    ekassaFields
      ? (f(ekassaFields, "1037") ?? payload?.ekassa_fiscal?.kkm_reg_number ?? "")
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
  const qrLink = String(payload?.ekassa_fiscal?.link || payload?.ekassa?.link || "").trim();

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40)); // init
  chunks.push(ESC(0x1b, 0x52, 0x07)); // International: Russia
  chunks.push(ESC(0x1b, 0x74, codepage)); // кодовая страница

  chunks.push(ESC(0x1b, 0x61, 0x01)); // center
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
    chunks.push(enc("СПАСИБО ЗА ПОКУПКУ!\n"));
    chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
  }
  chunks.push(enc("Контрольно-кассовый чек - Продажа\n"));
  if (hasText(company)) chunks.push(enc(company + "\n"));
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
  if (hasText(shift)) chunks.push(enc(lr("Смена", shift, width) + "\n"));
  chunks.push(enc(divider + "\n"));
  chunks.push(enc("СНО: Общий налоговый режим\n"));
  chunks.push(enc(divider + "\n"));
  for (const [index, it] of items.entries()) {
    const name = String(it.name ?? "Товар");
    const qty = Number(it.qty || 1);
    const price = Number(it.price || 0);
    const lineTotal = Number(it.total ?? qty * price);
    chunks.push(enc(`${index + 1}. ${name}\n`));
    if (emphasizeMarketReceipt) {
      chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
      chunks.push(
        enc(
          lr(
            `${money(price)} x ${qty} ед.`,
            money(lineTotal),
            width,
          ) + "\n",
        ),
      );
      chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
    } else {
      chunks.push(enc(lr(`${money(price)} x ${qty} ед.`, money(lineTotal), width) + "\n"));
    }
  }

  chunks.push(enc(divider + "\n"));
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  }
  chunks.push(enc(lr("Подытог", money(subtotal), width) + "\n"));
  if (vat > 0) chunks.push(enc(lr("НДС", money(vat), width) + "\n"));
  if (nsp > 0) chunks.push(enc(lr("НсП", money(nsp), width) + "\n"));
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
  }
  chunks.push(enc(divider + "\n"));
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  }
  if (paidCash > 0) chunks.push(enc(lr("Наличные", money(paidCash), width) + "\n"));
  if (paidCard > 0) chunks.push(enc(lr("Безналичные", money(paidCard), width) + "\n"));
  if (emphasizeMarketReceipt) {
    chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
  }

  chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  chunks.push(enc(lr("ИТОГО", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off
  chunks.push(enc(divider + "\n"));
  let hasFiscalRows = false;
  if (hasText(kkm)) {
    chunks.push(enc(lr("ККМ №", kkm, width) + "\n"));
    hasFiscalRows = true;
  }
  if (hasText(fn)) {
    chunks.push(enc(lr("ФН №", fn, width) + "\n"));
    hasFiscalRows = true;
  }
  if (hasText(fd)) {
    chunks.push(enc(lr("ФД №", fd, width) + "\n"));
    hasFiscalRows = true;
  }
  if (hasText(fpd)) {
    chunks.push(enc(lr("ФПД", fpd, width) + "\n"));
    hasFiscalRows = true;
  }
  if (hasFiscalRows) chunks.push(enc(divider + "\n"));
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
    if (dev.productName) localStorage.setItem("escpos_product", dev.productName);
    if (dev.manufacturerName)
      localStorage.setItem("escpos_manufacturer", dev.manufacturerName);
  } catch { }
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
        (!savedPid || d.productId === savedPid)
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
    await dev.selectConfiguration(1).catch(() => { });
    if (dev.configuration == null && dev.configurations?.length) {
      const cfgNum = dev.configurations[0]?.configurationValue ?? 1;
      await dev.selectConfiguration(cfgNum).catch(() => { });
    }
  }
  const cfg = dev.configuration;
  if (!cfg) throw new Error("Нет активной USB-конфигурации");

  for (const intf of cfg.interfaces) {
    for (const alt of intf.alternates) {
      const out = (alt.endpoints || []).find(
        (e) => e.direction === "out" && e.type === "bulk"
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
        } catch { }
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
    "Не удалось захватить интерфейс с bulk OUT. На Windows установите WinUSB (Zadig) и закройте другие приложения принтера."
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
      err
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

  // печатаем на ширину принтера
  const cfg = getEscposRuntimeConfig();
  const canvas = await pdfBlobToCanvas(pdfBlob, cfg.dotsPerLine);
  const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
  const escpos = buildEscPosForRaster(raster, bytesPerLine, h);

  for (const part of chunkBytes(escpos)) {
    await dev.transferOut(outEP, part);
  }
}

async function printReceiptJSONViaUSB(payload, options = {}) {
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
  // ESC/POS: init, Russia, codepage, text, newline, cut
  const init = ESC(0x1b, 0x40);
  const intl = ESC(0x1b, 0x52, 0x07);
  const cp = ESC(0x1b, 0x74, cfg.codepage);
  const body = cfg.encoder(String(text) + "\n");
  const cut = ESC(0x1d, 0x56, 0x00);

  const data = new Uint8Array(
    init.length + intl.length + cp.length + body.length + cut.length
  );
  let o = 0;
  data.set(init, o);
  o += init.length;
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
export async function handleCheckoutResponseForPrinting(res, options = {}) {
  const printable = unwrapPrintablePayload(res);

  if (typeof printable === "string") {
    const text = printable.trim();
    if (text.startsWith("data:application/pdf;base64,")) {
      const b64 = text.split(",")[1] || "";
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await printReceiptFromPdfUSB(new Blob([bin], { type: "application/pdf" }), options);
      return;
    }
    try {
      const json = JSON.parse(text);
      if (json && Array.isArray(json.items)) {
        await printReceiptJSONViaUSB(json, options);
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
    await printReceiptJSONViaUSB(printable, options);
    return;
  }
  if (printable instanceof Blob) {
    if (await looksLikePdf(printable)) {
      await printReceiptFromPdfUSB(printable, options);
      return;
    }
    const parsed = await tryParseJsonFromBlob(printable);
    if (parsed?.json) {
      await printReceiptJSONViaUSB(parsed.json, options);
      return;
    }
    if (parsed?.pdfBlob && (await looksLikePdf(parsed.pdfBlob))) {
      await printReceiptFromPdfUSB(parsed.pdfBlob, options);
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
  if (printable && typeof printable === "object" && Array.isArray(printable.items)) {
    await printReceiptJSONViaUSB(printable, options);
    return;
  }
  throw new Error("Неизвестный формат ответа для печати");
}
