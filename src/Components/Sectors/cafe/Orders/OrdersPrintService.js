// /**
//  * OrdersPrintService
//  * Локальная копия printService ТОЛЬКО для заказов (JSON → ESC/POS через WebUSB)
//  * Оригинальный printService не трогаем.
//  */

// const usbState = { dev: null, opening: null };

// // ====== Paper / font settings ======
// const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);
// const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();
// const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;

// const CHARS_PER_LINE = Number(
//   localStorage.getItem("escpos_cpl") || Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH)
// );

// // безопасная ширина (чтобы не было переносов и “маленьких линий”)
// const PRINT_WIDTH = Math.min(CHARS_PER_LINE, 42);

// // codepage
// const CODEPAGE = Number(localStorage.getItem("escpos_cp") ?? 73);
// const CP866_CODES = new Set([66, 18]);
// const CP1251_CODES = new Set([73, 22]);

// const ESC = (...b) => new Uint8Array(b);

// const chunkBytes = (u8, size = 12 * 1024) => {
//   const out = [];
//   for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
//   return out;
// };

// /* ---------- storage for multiple printers ---------- */
// const LS_PRINTERS = "escpos_printers"; // [{vidHex,pidHex,name}]
// const LS_ACTIVE = "escpos_printer_active"; // "vvvv:pppp"

// const toHex4 = (n) => Number(n || 0).toString(16).padStart(4, "0");
// const keyOf = (vid, pid) => `${toHex4(vid)}:${toHex4(pid)}`;

// function readJson(key, fallback) {
//   try {
//     const raw = localStorage.getItem(key);
//     return raw ? JSON.parse(raw) : fallback;
//   } catch {
//     return fallback;
//   }
// }
// function writeJson(key, value) {
//   try {
//     localStorage.setItem(key, JSON.stringify(value));
//   } catch {}
// }

// export function getSavedPrinters() {
//   return readJson(LS_PRINTERS, []);
// }

// export function getActivePrinterKey() {
//   try {
//     return localStorage.getItem(LS_ACTIVE) || "";
//   } catch {
//     return "";
//   }
// }

// export function setActivePrinterKey(printerKey) {
//   try {
//     localStorage.setItem(LS_ACTIVE, String(printerKey || ""));
//   } catch {}
// }

// function upsertSavedPrinter(dev) {
//   const vidHex = toHex4(dev.vendorId);
//   const pidHex = toHex4(dev.productId);
//   const name = dev.productName || "USB Printer";
//   const key = `${vidHex}:${pidHex}`;

//   const list = getSavedPrinters();
//   const next = [
//     { key, vidHex, pidHex, name },
//     ...list.filter((p) => p?.key !== key),
//   ].slice(0, 20);

//   writeJson(LS_PRINTERS, next);
//   setActivePrinterKey(key);

//   // для совместимости со старой авто-логикой (если где-то осталось)
//   try {
//     localStorage.setItem("escpos_vid", vidHex);
//     localStorage.setItem("escpos_pid", pidHex);
//   } catch {}
// }

// export async function listAuthorizedPrinters() {
//   if (!("usb" in navigator)) return [];
//   try {
//     const devs = await navigator.usb.getDevices();
//     return devs.map((d) => ({
//       key: keyOf(d.vendorId, d.productId),
//       vendorId: d.vendorId,
//       productId: d.productId,
//       vidHex: toHex4(d.vendorId),
//       pidHex: toHex4(d.productId),
//       name: d.productName || "USB Printer",
//     }));
//   } catch {
//     return [];
//   }
// }

// export async function choosePrinterByDialog() {
//   if (!("usb" in navigator)) throw new Error("Браузер не поддерживает WebUSB");
//   const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
//   const dev = await navigator.usb.requestDevice({ filters });
//   upsertSavedPrinter(dev);
//   // сбросим текущее соединение, чтобы печать пошла в новый принтер
//   if (usbState.dev && usbState.dev !== dev) {
//     try {
//       await usbState.dev.close();
//     } catch {}
//   }
//   usbState.dev = dev;
//   return {
//     key: keyOf(dev.vendorId, dev.productId),
//     vendorId: dev.vendorId,
//     productId: dev.productId,
//     name: dev.productName || "USB Printer",
//   };
// }

// export async function setActivePrinterByKey(printerKey) {
//   if (!printerKey) return;
//   setActivePrinterKey(printerKey);

//   // сбросим активное устройство: при следующей печати подцепится нужное
//   if (usbState.dev) {
//     try {
//       await usbState.dev.close();
//     } catch {}
//     usbState.dev = null;
//   }
// }

// /* ---------- encoders ---------- */
// function encodeCP1251(s = "") {
//   const out = [];
//   for (const ch of s) {
//     const c = ch.codePointAt(0);
//     if (c <= 0x7f) out.push(c);
//     else if (c === 0x0401) out.push(0xa8);
//     else if (c === 0x0451) out.push(0xb8);
//     else if (c >= 0x0410 && c <= 0x042f) out.push(0xc0 + (c - 0x0410));
//     else if (c >= 0x0430 && c <= 0x044f) out.push(0xe0 + (c - 0x0430));
//     else if (c === 0x2116) out.push(0xb9);
//     else out.push(0x3f);
//   }
//   return new Uint8Array(out);
// }
// function encodeCP866(s = "") {
//   const out = [];
//   for (const ch of s) {
//     const c = ch.codePointAt(0);
//     if (c <= 0x7f) out.push(c);
//     else if (c >= 0x0410 && c <= 0x042f) out.push(0x80 + (c - 0x0410));
//     else if (c >= 0x0430 && c <= 0x044f) out.push(0xa0 + (c - 0x0430));
//     else if (c === 0x0401) out.push(0xf0);
//     else if (c === 0x0451) out.push(0xf1);
//     else if (c === 0x2116) out.push(0xfc);
//     else out.push(0x3f);
//   }
//   return new Uint8Array(out);
// }
// const getEncoder = (n) =>
//   CP866_CODES.has(n)
//     ? encodeCP866
//     : CP1251_CODES.has(n)
//     ? encodeCP1251
//     : encodeCP1251;

// /* ---------- helpers ---------- */
// const money = (n) => Number(n || 0).toFixed(2);

// function lrSafe(left, right, width) {
//   const R = String(right ?? "");
//   let L = String(left ?? "");
//   const maxL = Math.max(1, width - R.length - 1);

//   if (L.length > maxL) L = L.slice(0, Math.max(1, maxL - 1)) + "…";

//   const spaces = Math.max(1, width - L.length - R.length);
//   return L + " ".repeat(spaces) + R;
// }

// /* ---------- WebUSB core ---------- */
// async function openUsbDevice(dev) {
//   if (!dev) throw new Error("USB устройство не найдено");

//   try {
//     if (!dev.opened) await dev.open();
//   } catch (e) {
//     const msg = String(e?.message || e);
//     if (msg.toLowerCase().includes("access denied")) {
//       throw new Error(
//         "USB: Access denied. Закройте программы печати и проверьте WinUSB (Zadig)."
//       );
//     }
//     throw e;
//   }

//   if (dev.configuration == null) {
//     await dev.selectConfiguration(1).catch(() => {});
//     if (dev.configuration == null && dev.configurations?.length) {
//       const cfgNum = dev.configurations[0]?.configurationValue ?? 1;
//       await dev.selectConfiguration(cfgNum).catch(() => {});
//     }
//   }

//   const cfg = dev.configuration;
//   if (!cfg) throw new Error("Нет активной USB-конфигурации");

//   for (const intf of cfg.interfaces) {
//     for (const alt of intf.alternates) {
//       const out = (alt.endpoints || []).find(
//         (e) => e.direction === "out" && e.type === "bulk"
//       );
//       if (!out) continue;

//       try {
//         await dev.claimInterface(intf.interfaceNumber);
//       } catch {
//         continue;
//       }

//       const needAlt = alt.alternateSetting ?? 0;
//       try {
//         await dev.selectAlternateInterface(intf.interfaceNumber, needAlt);
//       } catch {
//         try {
//           await dev.releaseInterface(intf.interfaceNumber);
//         } catch {}
//         continue;
//       }

//       return { outEP: out.endpointNumber };
//     }
//   }

//   throw new Error("Не удалось захватить bulk OUT интерфейс. Проверьте WinUSB (Zadig).");
// }

// async function tryAutoDeviceByActiveKey() {
//   if (!("usb" in navigator)) return null;
//   const activeKey = getActivePrinterKey();
//   if (!activeKey) return null;

//   const devs = await navigator.usb.getDevices();
//   return devs.find((d) => keyOf(d.vendorId, d.productId) === activeKey) || null;
// }

// async function tryAutoDeviceBySavedList() {
//   if (!("usb" in navigator)) return null;
//   const saved = getSavedPrinters();
//   if (!saved.length) return null;

//   const devs = await navigator.usb.getDevices();
//   for (const p of saved) {
//     const found = devs.find((d) => keyOf(d.vendorId, d.productId) === p.key);
//     if (found) return found;
//   }
//   return devs[0] || null;
// }

// async function ensureUsbReadyAuto() {
//   if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
//   if (usbState.dev) return usbState;

//   if (!usbState.opening) {
//     usbState.opening = (async () => {
//       // 1) пытаемся активный
//       let dev = await tryAutoDeviceByActiveKey();
//       // 2) иначе — любой из сохранённых/доступных
//       if (!dev) dev = await tryAutoDeviceBySavedList();
//       if (!dev) return null;

//       await openUsbDevice(dev);
//       usbState.dev = dev;
//       return usbState;
//     })().finally(() => (usbState.opening = null));
//   }

//   await usbState.opening;
//   return usbState.dev ? usbState : null;
// }

// export function attachUsbListenersOnce() {
//   if (!("usb" in navigator)) return;
//   if (attachUsbListenersOnce._did) return;
//   attachUsbListenersOnce._did = true;

//   navigator.usb.addEventListener("connect", async (e) => {
//     try {
//       const activeKey = getActivePrinterKey();
//       if (!activeKey) return;
//       if (keyOf(e.device.vendorId, e.device.productId) !== activeKey) return;
//       await openUsbDevice(e.device);
//       usbState.dev = e.device;
//     } catch {}
//   });

//   navigator.usb.addEventListener("disconnect", (e) => {
//     if (usbState.dev && e.device === usbState.dev) usbState.dev = null;
//   });
// }

// export async function checkPrinterConnection() {
//   if (!("usb" in navigator)) return false;
//   try {
//     const state = await ensureUsbReadyAuto();
//     return state !== null && usbState.dev !== null;
//   } catch {
//     return false;
//   }
// }

// /* ---------- Receipt (pretty) ---------- */
// function buildPrettyReceiptFromJSON(payload) {
//   const width = PRINT_WIDTH;
//   const line = "-".repeat(width);
//   const enc = getEncoder(CODEPAGE);

//   const company = payload.company ?? "КАССА";
//   const docNo = payload.doc_no ?? "";
//   const dt = payload.created_at ?? "";
//   const cashier = payload.cashier_name ?? "";

//   const items = Array.isArray(payload.items) ? payload.items : [];
//   const total = items.reduce(
//     (s, it) => s + Number(it.qty || 0) * Number(it.price || 0),
//     0
//   );

//   const chunks = [];
//   chunks.push(ESC(0x1b, 0x40)); // init
//   chunks.push(ESC(0x1b, 0x52, 0x07)); // Russia
//   chunks.push(ESC(0x1b, 0x74, CODEPAGE)); // codepage

//   // Header
//   chunks.push(ESC(0x1b, 0x61, 0x01)); // center
//   chunks.push(enc(company + "\n"));
//   if (docNo) chunks.push(enc(`ЧЕК: ${docNo}\n`));

//   // line always LEFT
//   chunks.push(ESC(0x1b, 0x61, 0x00)); // left
//   chunks.push(enc(line + "\n"));

//   // meta
//   if (dt) chunks.push(enc(`Дата: ${dt}\n`));
//   if (cashier) chunks.push(enc(`Кассир: ${cashier}\n`));
//   chunks.push(enc("\n"));

//   // items (2 строки + пустая строка между порциями)
//   for (const it of items) {
//     const name = String(it.name ?? "").trim() || "Позиция";
//     const qty = Math.max(1, Number(it.qty || 0));
//     const price = Number(it.price || 0);
//     const sum = qty * price;

//     chunks.push(enc(name + "\n"));
//     chunks.push(enc(`${qty} x ${money(price)} = ${money(sum)}\n`));
//     chunks.push(enc("\n"));
//   }

//   // before total
//   chunks.push(enc(line + "\n"));
//   chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
//   chunks.push(enc(lrSafe("ИТОГО:", money(total), width) + "\n"));
//   chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off

//   // чтобы итог не “переезжал” на следующий чек
//   chunks.push(ESC(0x1b, 0x64, 0x06)); // feed 6 lines
//   chunks.push(ESC(0x1d, 0x56, 0x00)); // cut

//   return chunks;
// }

// export async function printOrderReceiptJSONViaUSB(payload) {
//   if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");

//   const state = await ensureUsbReadyAuto();

//   // если нет ни одного разрешённого устройства — заставим выбрать в диалоге
//   if (!state || !usbState.dev) {
//     await choosePrinterByDialog();
//     await ensureUsbReadyAuto();
//   }

//   const { outEP } = await openUsbDevice(usbState.dev);

//   const parts = buildPrettyReceiptFromJSON(payload);
//   for (const data of parts) {
//     for (const chunk of chunkBytes(data)) {
//       await usbState.dev.transferOut(outEP, chunk);
//     }
//   }
// }

// export async function printOrderReceiptJSONViaUSBWithDialog(payload) {
//   if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");

//   // ВСЕГДА показать окно выбора
//   const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
//   const dev = await navigator.usb.requestDevice({ filters });

//   // сохранить как активный + сбросить старое соединение
//   try {
//     // если у тебя есть upsertSavedPrinter(dev) — используй его
//     // иначе просто сохраняем active key:
//     const vidHex = dev.vendorId.toString(16).padStart(4, "0");
//     const pidHex = dev.productId.toString(16).padStart(4, "0");
//     localStorage.setItem("escpos_printer_active", `${vidHex}:${pidHex}`);
//   } catch {}

//   usbState.dev = dev;

//   const { outEP } = await openUsbDevice(dev);

//   const parts = buildPrettyReceiptFromJSON(payload);
//   for (const data of parts) {
//     for (const chunk of chunkBytes(data)) {
//       await dev.transferOut(outEP, chunk);
//     }
//   }
// }




const usbState = { dev: null, opening: null };

const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);
const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();
const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;

const CHARS_PER_LINE = Number(
  localStorage.getItem("escpos_cpl") || Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH)
);

const PRINT_WIDTH = Math.min(CHARS_PER_LINE, 42);

const CODEPAGE = Number(localStorage.getItem("escpos_cp") ?? 73);
const CP866_CODES = new Set([66, 18]);
const CP1251_CODES = new Set([73, 22]);

const ESC = (...b) => new Uint8Array(b);

const chunkBytes = (u8, size = 12 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

const LS_PRINTERS = "escpos_printers";
const LS_ACTIVE = "escpos_printer_active";

const toHex4 = (n) => Number(n || 0).toString(16).padStart(4, "0");
const safeSerial = (s) => {
  const v = String(s || "").trim();
  if (!v) return "noserial";
  return v.replace(/\s+/g, "").slice(0, 64);
};
const keyOf = (vid, pid, serial) => `${toHex4(vid)}:${toHex4(pid)}:${safeSerial(serial)}`;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getSavedPrinters() {
  const list = readJson(LS_PRINTERS, []);
  const normalized = (Array.isArray(list) ? list : []).map((p) => {
    const k = String(p?.key || "");
    if (/^[0-9a-f]{4}:[0-9a-f]{4}$/i.test(k)) {
      return { ...p, key: `${k}:noserial`, serial: "noserial" };
    }
    return p;
  });
  if (JSON.stringify(normalized) !== JSON.stringify(list)) writeJson(LS_PRINTERS, normalized);
  return normalized;
}

export function getActivePrinterKey() {
  try {
    const v = localStorage.getItem(LS_ACTIVE) || "";
    if (/^[0-9a-f]{4}:[0-9a-f]{4}$/i.test(v)) return `${v}:noserial`;
    return v;
  } catch {
    return "";
  }
}

export function setActivePrinterKey(printerKey) {
  try {
    localStorage.setItem(LS_ACTIVE, String(printerKey || ""));
  } catch {}
}

function upsertSavedPrinter(dev) {
  const vidHex = toHex4(dev.vendorId);
  const pidHex = toHex4(dev.productId);
  const serial = safeSerial(dev.serialNumber);
  const name = dev.productName || "USB Printer";
  const key = `${vidHex}:${pidHex}:${serial}`;

  const list = getSavedPrinters();
  const next = [
    { key, vidHex, pidHex, serial, name },
    ...list.filter((p) => p?.key !== key),
  ].slice(0, 50);

  writeJson(LS_PRINTERS, next);
  setActivePrinterKey(key);

  try {
    localStorage.setItem("escpos_vid", vidHex);
    localStorage.setItem("escpos_pid", pidHex);
  } catch {}
}

export async function listAuthorizedPrinters() {
  if (!("usb" in navigator)) return [];
  try {
    const devs = await navigator.usb.getDevices();
    return devs.map((d) => ({
      key: keyOf(d.vendorId, d.productId, d.serialNumber),
      vendorId: d.vendorId,
      productId: d.productId,
      vidHex: toHex4(d.vendorId),
      pidHex: toHex4(d.productId),
      serial: safeSerial(d.serialNumber),
      name: d.productName || "USB Printer",
    }));
  } catch {
    return [];
  }
}

export async function choosePrinterByDialog() {
  if (!("usb" in navigator)) throw new Error("Браузер не поддерживает WebUSB");
  const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
  const dev = await navigator.usb.requestDevice({ filters });

  upsertSavedPrinter(dev);

  if (usbState.dev && usbState.dev !== dev) {
    try {
      await usbState.dev.close();
    } catch {}
  }
  usbState.dev = dev;

  return {
    key: keyOf(dev.vendorId, dev.productId, dev.serialNumber),
    vendorId: dev.vendorId,
    productId: dev.productId,
    serial: safeSerial(dev.serialNumber),
    name: dev.productName || "USB Printer",
  };
}

export async function setActivePrinterByKey(printerKey) {
  if (!printerKey) return;
  setActivePrinterKey(printerKey);

  if (usbState.dev) {
    try {
      await usbState.dev.close();
    } catch {}
    usbState.dev = null;
  }
}

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
function encodeCP866(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0x80 + (c - 0x0410));
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xa0 + (c - 0x0430));
    else if (c === 0x0401) out.push(0xf0);
    else if (c === 0x0451) out.push(0xf1);
    else if (c === 0x2116) out.push(0xfc);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
const getEncoder = (n) =>
  CP866_CODES.has(n)
    ? encodeCP866
    : CP1251_CODES.has(n)
    ? encodeCP1251
    : encodeCP1251;

const money = (n) => Number(n || 0).toFixed(2);

function lrSafe(left, right, width) {
  const R = String(right ?? "");
  let L = String(left ?? "");
  const maxL = Math.max(1, width - R.length - 1);
  if (L.length > maxL) L = L.slice(0, Math.max(1, maxL - 1)) + "…";
  const spaces = Math.max(1, width - L.length - R.length);
  return L + " ".repeat(spaces) + R;
}

async function openUsbDevice(dev) {
  if (!dev) throw new Error("USB устройство не найдено");

  try {
    if (!dev.opened) await dev.open();
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes("access denied")) {
      throw new Error(
        "USB: Access denied. Закройте программы печати и проверьте WinUSB (Zadig)."
      );
    }
    throw e;
  }

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

      return { outEP: out.endpointNumber };
    }
  }

  throw new Error("Не удалось захватить bulk OUT интерфейс. Проверьте WinUSB (Zadig).");
}

async function tryAutoDeviceByActiveKey() {
  if (!("usb" in navigator)) return null;
  const activeKey = getActivePrinterKey();
  if (!activeKey) return null;

  const devs = await navigator.usb.getDevices();
  return devs.find((d) => keyOf(d.vendorId, d.productId, d.serialNumber) === activeKey) || null;
}

async function tryAutoDeviceBySavedList() {
  if (!("usb" in navigator)) return null;
  const saved = getSavedPrinters();
  if (!saved.length) return null;

  const devs = await navigator.usb.getDevices();
  for (const p of saved) {
    const found = devs.find((d) => keyOf(d.vendorId, d.productId, d.serialNumber) === p.key);
    if (found) return found;
  }
  return devs[0] || null;
}

async function ensureUsbReadyAuto() {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  if (usbState.dev) return usbState;

  if (!usbState.opening) {
    usbState.opening = (async () => {
      let dev = await tryAutoDeviceByActiveKey();
      if (!dev) dev = await tryAutoDeviceBySavedList();
      if (!dev) return null;

      await openUsbDevice(dev);
      usbState.dev = dev;
      return usbState;
    })().finally(() => (usbState.opening = null));
  }

  await usbState.opening;
  return usbState.dev ? usbState : null;
}

export function attachUsbListenersOnce() {
  if (!("usb" in navigator)) return;
  if (attachUsbListenersOnce._did) return;
  attachUsbListenersOnce._did = true;

  navigator.usb.addEventListener("connect", async (e) => {
    try {
      const activeKey = getActivePrinterKey();
      if (!activeKey) return;
      if (keyOf(e.device.vendorId, e.device.productId, e.device.serialNumber) !== activeKey) return;
      await openUsbDevice(e.device);
      usbState.dev = e.device;
    } catch {}
  });

  navigator.usb.addEventListener("disconnect", (e) => {
    if (usbState.dev && e.device === usbState.dev) usbState.dev = null;
  });
}

export async function checkPrinterConnection() {
  if (!("usb" in navigator)) return false;
  try {
    const state = await ensureUsbReadyAuto();
    return state !== null && usbState.dev !== null;
  } catch {
    return false;
  }
}

function buildPrettyReceiptFromJSON(payload) {
  const width = PRINT_WIDTH;
  const line = "-".repeat(width);
  const enc = getEncoder(CODEPAGE);

  const company = payload.company ?? "КАССА";
  const docNo = payload.doc_no ?? "";
  const dt = payload.created_at ?? "";
  const cashier = payload.cashier_name ?? "";

  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.price || 0),
    0
  );

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40));
  chunks.push(ESC(0x1b, 0x52, 0x07));
  chunks.push(ESC(0x1b, 0x74, CODEPAGE));

  chunks.push(ESC(0x1b, 0x61, 0x01));
  chunks.push(enc(company + "\n"));
  if (docNo) chunks.push(enc(`ЧЕК: ${docNo}\n`));

  chunks.push(ESC(0x1b, 0x61, 0x00));
  chunks.push(enc(line + "\n"));

  if (dt) chunks.push(enc(`Дата: ${dt}\n`));
  if (cashier) chunks.push(enc(`Кассир: ${cashier}\n`));
  chunks.push(enc("\n"));

  for (const it of items) {
    const name = String(it.name ?? "").trim() || "Позиция";
    const qty = Math.max(1, Number(it.qty || 0));
    const price = Number(it.price || 0);
    const sum = qty * price;

    chunks.push(enc(name + "\n"));
    chunks.push(enc(`${qty} x ${money(price)} = ${money(sum)}\n`));
    chunks.push(enc("\n"));
  }

  chunks.push(enc(line + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x01));
  chunks.push(enc(lrSafe("ИТОГО:", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00));

  chunks.push(ESC(0x1b, 0x64, 0x06));
  chunks.push(ESC(0x1d, 0x56, 0x00));

  return chunks;
}

export async function printOrderReceiptJSONViaUSB(payload) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");

  const state = await ensureUsbReadyAuto();

  if (!state || !usbState.dev) {
    await choosePrinterByDialog();
    await ensureUsbReadyAuto();
  }

  const { outEP } = await openUsbDevice(usbState.dev);

  const parts = buildPrettyReceiptFromJSON(payload);
  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await usbState.dev.transferOut(outEP, chunk);
    }
  }
}

export async function printOrderReceiptJSONViaUSBWithDialog(payload) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");

  const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
  const dev = await navigator.usb.requestDevice({ filters });

  try {
    const key = keyOf(dev.vendorId, dev.productId, dev.serialNumber);
    localStorage.setItem(LS_ACTIVE, key);
  } catch {}

  usbState.dev = dev;

  const { outEP } = await openUsbDevice(dev);

  const parts = buildPrettyReceiptFromJSON(payload);
  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}
