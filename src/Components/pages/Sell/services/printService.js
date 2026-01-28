/**
 * Print Service
 * Модуль для работы с печатью чеков через WebUSB и ESC/POS принтеры
 */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

// ====== НАСТРОЙКИ БУМАГИ 72 мм (80мм принтер) ======
const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);
// Шрифт: 'A' или 'B'
const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();
// ширина символа в точках (Font A ~12, Font B ~9)
const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;
// межстрочный интервал
const LINE_DOT_HEIGHT = Number(
  localStorage.getItem("escpos_line") || (FONT === "B" ? 22 : 24)
);
// ширина строки в символах
const CHARS_PER_LINE = Number(
  localStorage.getItem("escpos_cpl") ||
    Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH)
);

// Быстрые тюнеры (пригодятся в консоли):
export function setEscposDotsPerLine(n) {
  localStorage.setItem("escpos_dpl", String(n));
}
export function setEscposCharsPerLine(n) {
  localStorage.setItem("escpos_cpl", String(n));
}
export function setEscposLineHeight(n) {
  localStorage.setItem("escpos_line", String(n));
}
export function setEscposFont(ch) {
  localStorage.setItem("escpos_font", String(ch).toUpperCase());
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
const FORCED_CODEPAGE = 17; // PC866
// printRussianRawUsb("Тест: Привет, мир! Ёё №");
export function setEscposCodepage(n) {
  localStorage.setItem("escpos_cp", String(n));
}
const PC866_CODES = new Set([66, 17, 18, 59]); // 17 — частый ESC/POS номер PC866, 59 — PC866(Russian)
const CP1251_CODES = new Set([73, 22]);

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
    : encodeCP1251;

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
function buildReceiptFromJSON(payload, opts = {}) {
  const width = opts.width || CHARS_PER_LINE;
  const divider = "-".repeat(width);
  // Жёстко используем PC866 (и для ESC t n, и для энкодинга текста)
  const codepage = FORCED_CODEPAGE;
  const enc = encodePC866;

  const company = payload.company ?? "";
  const docNo = payload.doc_no ?? "";
  const dt = payload.created_at ?? "";
  const cashier = payload.cashier_name ?? "";

  const items = Array.isArray(payload.items) ? payload.items : [];
  const discount = Number(payload.discount || 0);
  const tax = Number(payload.tax || 0);
  const paidCash = Number(payload.paid_cash || 0);
  const paidCard = Number(payload.paid_card || 0);
  const change = Number(payload.change || 0);

  const subtotal = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.price || 0),
    0
  );
  const total = subtotal - discount + tax;

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40)); // init
  chunks.push(ESC(0x1b, 0x52, 0x07)); // International: Russia
  chunks.push(ESC(0x1b, 0x74, codepage)); // кодовая страница

  chunks.push(ESC(0x1b, 0x61, 0x01)); // center
  if (company) chunks.push(enc(company + "\n"));
  if (docNo) chunks.push(enc(`ЧЕК № ${docNo}\n`));
  chunks.push(enc(divider + "\n"));

  chunks.push(ESC(0x1b, 0x61, 0x00)); // left
  if (dt) chunks.push(enc(`Дата: ${dt}\n`));
  if (cashier) chunks.push(enc(`Кассир: ${cashier}\n`));
  chunks.push(enc(divider + "\n"));

  for (const it of items) {
    const name = String(it.name ?? "");
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    chunks.push(enc(name + "\n"));
    chunks.push(
      enc(lr(`${qty} x ${money(price)}`, money(qty * price), width) + "\n")
    );
  }

  chunks.push(enc(divider + "\n"));
  chunks.push(enc(lr("Промежуточный итог:", money(subtotal), width) + "\n"));
  if (discount)
    chunks.push(enc(lr("Скидка:", "-" + money(discount), width) + "\n"));
  if (tax) chunks.push(enc(lr("Налог:", money(tax), width) + "\n"));

  chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  chunks.push(enc(lr("ИТОГО:", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off

  const havePayments = paidCash || paidCard || change;
  if (havePayments) {
    chunks.push(enc(divider + "\n"));
    if (paidCash)
      chunks.push(enc(lr("Наличными:", money(paidCash), width) + "\n"));
    if (paidCard)
      chunks.push(enc(lr("Картой:", money(paidCard), width) + "\n"));
    if (change) chunks.push(enc(lr("Сдача:", money(change), width) + "\n"));
  }

  chunks.push(enc(divider + "\n"));
  chunks.push(ESC(0x1b, 0x61, 0x01));
  chunks.push(enc("Спасибо за покупку!\n\n"));
  chunks.push(ESC(0x1d, 0x56, 0x00)); // полный рез
  chunks.push(ESC(0x0a, 0x0a, 0x0a));
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
    if (dev.productName) localStorage.setItem("escpos_product", dev.productName);
    if (dev.manufacturerName)
      localStorage.setItem("escpos_manufacturer", dev.manufacturerName);
  } catch {}
}
async function tryUsbAutoConnect() {
  if (!("usb" in navigator)) throw new Error("Браузер не поддерживает WebUSB");
  const savedVid = parseInt(localStorage.getItem("escpos_vid") || "", 16);
  const savedPid = parseInt(localStorage.getItem("escpos_pid") || "", 16);
  const devs = await navigator.usb.getDevices();
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
export async function ensurePrinterConnectedInteractively() {
  if (!("usb" in navigator)) return false;

  // 1. Пытаемся автоматически подключиться к уже разрешённому устройству
  try {
    const state = await ensureUsbReadyAuto();
    if (state && usbState.dev) {
      return true;
    }
  } catch {
    // игнорируем и пробуем интерактивное подключение ниже
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
async function printReceiptFromPdfUSB(pdfBlob) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);

  // печатаем на ширину принтера
  const canvas = await pdfBlobToCanvas(pdfBlob, DOTS_PER_LINE);
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
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);

  // Жёстко печатаем в PC866 (без fallback/автоподбора)
  const parts = buildReceiptFromJSON(payload, {
    width: CHARS_PER_LINE,
    codepage: FORCED_CODEPAGE,
  });
  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}

/* ---------- Минимальная печать PC866 (XP-N160II) ---------- */
export async function printRussianRawUsb(text = "Привет, мир!") {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);

  // ESC/POS: init, Russia, codepage PC866, text, newline, cut
  const init = ESC(0x1b, 0x40);
  const intl = ESC(0x1b, 0x52, 0x07);
  const cp = ESC(0x1b, 0x74, FORCED_CODEPAGE); // PC866
  const body = encodePC866(String(text) + "\n");
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
export async function handleCheckoutResponseForPrinting(res) {
  if (
    res &&
    typeof res === "object" &&
    !(res instanceof Blob) &&
    Array.isArray(res.items)
  ) {
    await printReceiptJSONViaUSB(res);
    return;
  }
  if (res instanceof Blob) {
    if (await looksLikePdf(res)) {
      await printReceiptFromPdfUSB(res);
      return;
    }
    const parsed = await tryParseJsonFromBlob(res);
    if (parsed?.json) {
      await printReceiptJSONViaUSB(parsed.json);
      return;
    }
    if (parsed?.pdfBlob && (await looksLikePdf(parsed.pdfBlob))) {
      await printReceiptFromPdfUSB(parsed.pdfBlob);
      return;
    }
    // не PDF и не JSON — сохраним как файл (фолбэк)
    const url = URL.createObjectURL(res);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt.pdf";
    a.click();
    URL.revokeObjectURL(url);
    throw new Error("Получен невалидный PDF и не JSON: сохранён как файл.");
  }
  if (res && typeof res === "object" && Array.isArray(res.items)) {
    await printReceiptJSONViaUSB(res);
    return;
  }
  throw new Error("Неизвестный формат ответа для печати");
}
