/**
 * Xprinter XP-365B Print Service (TSPL)
 * Печать штрих-кодовых этикеток через WebUSB + кириллица через транслитерацию
 */

// ===== Глобальное состояние USB =====
const usbState = {
  dev: null,
  outEP: null,
  opening: null,
};

// Разбиение буфера на куски
const chunkBytes = (u8, size = 4096) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

// Энкодер TSPL (ASCII → bytes; фактически UTF-8, но мы шлём только ASCII)
const tsplEncoder = new TextEncoder();
const encodeTspl = (s) => tsplEncoder.encode(s);

/* ====================== util: перенос строки ====================== */
function wrap(text = "", width = 24) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  const out = [];
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (next.length <= width) {
      line = next;
    } else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

/* ====================== простая транслитерация RU/KG → LAT ====================== */

const TRANSLIT_MAP = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ъ: "",
  ь: "",
  // кыргызские
  ө: "o",
  ү: "u",
  ң: "ng",
};

function translitToAscii(str = "") {
  let res = "";
  for (const ch of String(str)) {
    const lower = ch.toLowerCase();
    if (TRANSLIT_MAP[lower]) {
      const tr = TRANSLIT_MAP[lower];
      if (lower !== ch) {
        res += tr.charAt(0).toUpperCase() + tr.slice(1);
      } else {
        res += tr;
      }
    } else {
      res += ch;
    }
  }
  return res;
}

/* ====================== WebUSB helpers ====================== */

function saveVidPidToLS(dev) {
  try {
    localStorage.setItem("xp365b_vid", dev.vendorId.toString(16));
    localStorage.setItem("xp365b_pid", dev.productId.toString(16));
  } catch {}
}

async function tryUsbAutoConnect() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  const savedVid = parseInt(localStorage.getItem("xp365b_vid") || "", 16);
  const savedPid = parseInt(localStorage.getItem("xp365b_pid") || "", 16);

  const devs = await navigator.usb.getDevices();
  const dev =
    devs.find(
      (d) =>
        (!savedVid || d.vendorId === savedVid) &&
        (!savedPid || d.productId === savedPid)
    ) || null;

  return dev;
}

// запрос устройства через диалог
async function requestUsbDevice() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  // по классу принтера
  const filters = [{ classCode: 0x07 }];
  return await navigator.usb.requestDevice({ filters });
}

/* ====================== спец. команды для кириллицы ====================== */
/**
 * Отправка сервисных команд:
 *  1F 1B 1F FE 01
 *  1F 1B 1F FE 11
 * которые в конфигураторе рекомендуют для включения кириллицы.
 * (мы сейчас шлём только ASCII, но команды не мешают)
 */
async function sendXp365bKyrillicInit(dev, outEP) {
  try {
    const cmd1 = new Uint8Array([0x1f, 0x1b, 0x1f, 0xfe, 0x01]);
    const cmd2 = new Uint8Array([0x1f, 0x1b, 0x1f, 0xfe, 0x11]);

    await dev.transferOut(outEP, cmd1);
    await new Promise((r) => setTimeout(r, 5));
    await dev.transferOut(outEP, cmd2);
    await new Promise((r) => setTimeout(r, 5));

    console.log(
      "XP-365B: кириллические init-команды отправлены (1F 1B 1F FE 01/11)"
    );
  } catch (e) {
    console.warn("XP-365B: не удалось отправить кириллический init:", e);
  }
}

/* ====================== openUsbDevice ====================== */

/**
 * Открытие устройства и поиск bulk OUT endpoint,
 * + отправка init-команд для кириллицы.
 */
async function openUsbDevice(dev) {
  if (!dev) throw new Error("USB устройство не найдено");

  if (!dev.opened) {
    await dev.open();
  }

  if (dev.configuration === null) {
    // пробуем первую конфигурацию
    await dev.selectConfiguration(1).catch(() => {});
  }

  const cfg = dev.configuration;
  if (!cfg) throw new Error("Нет конфигурации у принтера");

  console.log("XP-365B config:", cfg);

  let outEP = null;
  let chosenInterface = null;
  let chosenAlt = null;

  for (const intf of cfg.interfaces) {
    for (const alt of intf.alternates) {
      const endpoints = alt.endpoints || [];
      console.log(
        "Interface",
        intf.interfaceNumber,
        "alt",
        alt.alternateSetting,
        "endpoints:",
        endpoints
      );

      const out = endpoints.find(
        (e) => e.direction === "out" && e.type === "bulk"
      );
      if (out) {
        chosenInterface = intf.interfaceNumber;
        chosenAlt = alt.alternateSetting || 0;
        outEP = out.endpointNumber;
        break;
      }
    }
    if (outEP != null) break;
  }

  if (outEP == null) {
    throw new Error("Bulk OUT endpoint не найден");
  }

  await dev.claimInterface(chosenInterface);
  if (dev.selectAlternateInterface) {
    await dev.selectAlternateInterface(chosenInterface, chosenAlt);
  }

  console.log(
    "Используем интерфейс",
    chosenInterface,
    "alt",
    chosenAlt,
    "OUT EP",
    outEP
  );

  await sendXp365bKyrillicInit(dev, outEP);

  return { outEP };
}

/**
 * ensureUsbReadyAuto:
 *  - пробует автоконнект по сохранённым VID/PID
 *  - не показывает диалог пользователю (для статуса)
 */
async function ensureUsbReadyAuto() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("WebUSB не поддерживается");
  }

  if (usbState.dev && usbState.outEP != null) {
    return usbState;
  }

  if (!usbState.opening) {
    usbState.opening = (async () => {
      const dev = await tryUsbAutoConnect();
      if (!dev) return null;
      const { outEP } = await openUsbDevice(dev);
      usbState.dev = dev;
      usbState.outEP = outEP;
      return usbState;
    })().finally(() => {
      usbState.opening = null;
    });
  }

  const res = await usbState.opening;
  return res;
}

/**
 * Явное подключение с диалогом (для кнопки "Подключить принтер")
 */
export async function connectXp365bManually() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  let dev = usbState.dev;

  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }

  const { outEP } = await openUsbDevice(dev);
  usbState.dev = dev;
  usbState.outEP = outEP;
}

/**
 * Слушатели connect/disconnect
 */
export function attachXp365bUsbListenersOnce() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) return;
  if (attachXp365bUsbListenersOnce._did) return;
  attachXp365bUsbListenersOnce._did = true;

  navigator.usb.addEventListener("connect", async (e) => {
    try {
      const savedVid = parseInt(localStorage.getItem("xp365b_vid") || "", 16);
      const savedPid = parseInt(localStorage.getItem("xp365b_pid") || "", 16);
      if (!savedVid || !savedPid) return;
      if (e.device.vendorId !== savedVid || e.device.productId !== savedPid)
        return;

      const { outEP } = await openUsbDevice(e.device);
      usbState.dev = e.device;
      usbState.outEP = outEP;
    } catch (err) {
      console.warn("XP-365B auto-connect failed:", err);
      usbState.dev = null;
      usbState.outEP = null;
    }
  });

  navigator.usb.addEventListener("disconnect", (e) => {
    if (usbState.dev && e.device === usbState.dev) {
      usbState.dev = null;
      usbState.outEP = null;
    }
  });
}

/**
 * Проверка статуса подключения (без показа диалога)
 */
export async function checkXp365bConnection() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) return false;
  try {
    const st = await ensureUsbReadyAuto();
    return !!(st && st.dev && st.outEP != null);
  } catch {
    return false;
  }
}

/* ====================== TSPL: этикетка (ASCII + транслит) ====================== */

// ВАЖНО: сделан на основе testXp365bSimple (который печатает HELLO)
function buildTsplLabel({ title, barcode, widthMm = 58, heightMm = 40 }) {
  // транслитеруем кириллицу → латиница, чтобы были чистые ASCII-байты
  const latinName = translitToAscii(title || "Test product").trim();
  const code = (barcode || "123456789012").trim();

  // делим название на 1–2 строки
  const nameLines = wrap(latinName, 18);

  let y = 20;
  const cmds = [];

  // те же базовые команды, что и в testXp365bSimple
  cmds.push(`SIZE ${widthMm} mm,${heightMm} mm`);
  cmds.push("GAP 3 mm,0 mm");
  cmds.push("DIRECTION 1");
  cmds.push("REFERENCE 0,0");
  cmds.push("CLS");

  // БЕЗ CODEPAGE — только ASCII, как в HELLO
  // cmds.push("CODEPAGE 866");

  // первая строка — крупный шрифт
  cmds.push(
    `TEXT 20,${y},"TSS24.BF2",0,1,1,"${(nameLines[0] || "")
      .replace(/"/g, "")
      .slice(0, 18)}"`
  );

  // вторая строка (если есть) — ниже, меньшим шрифтом
  if (nameLines[1]) {
    y += 28;
    cmds.push(
      `TEXT 20,${y},"TSS16.BF2",0,1,1,"${nameLines[1]
        .replace(/"/g, "")
        .slice(0, 18)}"`
    );
  }

  // чуть ниже — штрихкод
  y += 50;
  cmds.push(`BARCODE 20,${y},"128",60,1,0,2,4,"${code.replace(/"/g, "")}"`);

  cmds.push("PRINT 1");
  cmds.push(""); // финальный \r\n

  const tsplStr = cmds.join("\r\n");
  console.log("TSPL label string:\n", tsplStr);

  return encodeTspl(tsplStr);
}

/* ====================== Печать этикетки со штрих-кодом ====================== */

export async function printXp365bBarcodeLabel(params) {
  if (!params || !params.barcode) {
    throw new Error("Не передан штрих-код для печати");
  }

  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  if (!usbState.dev || usbState.outEP == null) {
    const st = await ensureUsbReadyAuto();
    if (!st || !st.dev) {
      await connectXp365bManually();
    }
  }

  const dev = usbState.dev;
  const outEP = usbState.outEP;

  if (!dev || outEP == null) {
    throw new Error("Принтер XP-365B не подключён");
  }

  const buf = buildTsplLabel({
    title: params.title || "Товар",
    barcode: params.barcode,
    widthMm: params.widthMm ?? 58,
    heightMm: params.heightMm ?? 40,
  });

  console.log("Печатаем этикетку XP-365B (TSPL + translit):", {
    barcode: params.barcode,
    title: params.title,
    latin: translitToAscii(params.title || "Товар"),
  });

  for (const part of chunkBytes(buf)) {
    await dev.transferOut(outEP, part);
    await new Promise((r) => setTimeout(r, 5));
  }

  console.log("Команда на печать отправлена");
}

/* ====================== Кодировки CP866 / CP1251 (для тестов) ====================== */

function encodeCP1251(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c === 0x0401) out.push(0xa8); // Ё
    else if (c === 0x0451) out.push(0xb8); // ё
    else if (c >= 0x0410 && c <= 0x042f) out.push(0xc0 + (c - 0x0410)); // А-Я
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xe0 + (c - 0x0430)); // а-я
    else if (c === 0x2116) out.push(0xb9); // №
    else out.push(0x3f); // ?
  }
  return new Uint8Array(out);
}

function encodeCP866(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0x80 + (c - 0x0410)); // А-Я
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xa0 + (c - 0x0430)); // а-я
    else if (c === 0x0401) out.push(0xf0); // Ё
    else if (c === 0x0451) out.push(0xf1); // ё
    else if (c === 0x2116) out.push(0xfc); // №
    else out.push(0x3f); // ?
  }
  return new Uint8Array(out);
}

/* ====================== Тест кодировки (графика + кириллица) ====================== */

export async function testXp365bEncodingPrint() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  if (!usbState.dev || usbState.outEP == null) {
    const st = await ensureUsbReadyAuto();
    if (!st || !st.dev) {
      await connectXp365bManually();
    }
  }

  const dev = usbState.dev;
  const outEP = usbState.outEP;
  if (!dev || outEP == null) {
    throw new Error("Принтер XP-365B не подключён");
  }

  await sendXp365bKyrillicInit(dev, outEP);

  const tspl = [
    "SIZE 58 mm,40 mm",
    "GAP 2 mm,0 mm",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
    "SET DENSITY 10",
    "SET DARKNESS 10",
    "BOX 10,10,440,260,4",
    "CODEPAGE 866",
    'TEXT 30,30,"TSS24.BF2",0,1,1,"HELLO 123"',
    'TEXT 30,70,"TSS16.BF2",0,1,1,"CP866: Привет 123"',
    "CODEPAGE 1251",
    'TEXT 30,110,"TSS16.BF2",0,1,1,"CP1251: Привет 123"',
    "PRINT 1",
    "",
  ].join("\r\n");

  console.log("TSPL encoding + graphics test:\n", tspl);

  const buf = encodeTspl(tspl);

  for (const part of chunkBytes(buf)) {
    await dev.transferOut(outEP, part);
    await new Promise((r) => setTimeout(r, 5));
  }

  console.log("Тест кодировки + графики отправлен");
}

// Тест кодовых страниц принтера (866 и 1251)
export async function printXp365bCodepageTest() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  const ascii = (s) =>
    new Uint8Array(
      [...s].map((ch) => {
        const c = ch.charCodeAt(0);
        return c >= 0x20 && c <= 0x7e ? c : 0x3f;
      })
    );

  const enc866 = (s) => encodeCP866(s);
  const enc1251 = (s) => encodeCP1251(s);

  if (!usbState.dev || usbState.outEP == null) {
    const st = await ensureUsbReadyAuto();
    if (!st || !st.dev) {
      await connectXp365bManually();
    }
  }

  const dev = usbState.dev;
  const outEP = usbState.outEP;
  if (!dev || outEP == null) {
    throw new Error("Принтер XP-365B не подключён");
  }

  const chunks = [];

  chunks.push(ascii("SIZE 58 mm,40 mm\r\n"));
  chunks.push(ascii("GAP 2 mm,0 mm\r\n"));
  chunks.push(ascii("DIRECTION 1\r\n"));
  chunks.push(ascii("REFERENCE 0,0\r\n"));
  chunks.push(ascii("CLS\r\n"));
  chunks.push(ascii("SET DENSITY 10\r\n"));
  chunks.push(ascii("SET DARKNESS 10\r\n"));
  chunks.push(ascii("BOX 10,10,440,260,4\r\n"));

  chunks.push(ascii("CODEPAGE 866\r\n"));
  chunks.push(ascii('TEXT 30,20,"TSS24.BF2",0,1,1,"HELLO 123"\r\n'));

  chunks.push(ascii('TEXT 30,60,"TSS16.BF2",0,1,1,"'));
  chunks.push(enc866("CP866: Привет 123"));
  chunks.push(ascii('"\r\n'));

  chunks.push(ascii("CODEPAGE 1251\r\n"));
  chunks.push(ascii('TEXT 30,100,"TSS16.BF2",0,1,1,"'));
  chunks.push(enc1251("CP1251: Привет 123"));
  chunks.push(ascii('"\r\n'));

  chunks.push(ascii("PRINT 1\r\n"));

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const buf = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }

  console.log("Отправляем тест кодовых страниц XP-365B...");
  const SLICE = 4096;
  for (let i = 0; i < buf.length; i += SLICE) {
    const part = buf.subarray(i, Math.min(i + SLICE, buf.length));
    await dev.transferOut(outEP, part);
    await new Promise((r) => setTimeout(r, 5));
  }
  console.log("Тест кодовых страниц отправлен");
}

/* ====================== Простой тест (HELLO) ====================== */

export async function testXp365bSimple() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  if (!usbState.dev || usbState.outEP == null) {
    const st = await ensureUsbReadyAuto();
    if (!st || !st.dev) {
      await connectXp365bManually();
    }
  }

  const dev = usbState.dev;
  const outEP = usbState.outEP;
  if (!dev || outEP == null) {
    throw new Error("Принтер XP-365B не подключён");
  }

  const tspl = [
    "SIZE 58 mm,40 mm",
    "GAP 3 mm,0 mm",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
    'TEXT 20,20,"TSS24.BF2",0,1,1,"HELLO"',
    "PRINT 1",
    "",
  ].join("\r\n");

  const buf = encodeTspl(tspl);

  console.log("Отправляем простой TSPL тест...");
  for (const part of chunkBytes(buf)) {
    await dev.transferOut(outEP, part);
    await new Promise((r) => setTimeout(r, 5));
  }
  console.log("Простой TSPL тест отправлен");
}

/* ====================== Повесим тесты на window для DevTools ====================== */

if (typeof window !== "undefined") {
  window.testXp365bEncodingPrint = testXp365bEncodingPrint;
  window.printXp365bCodepageTest = printXp365bCodepageTest;
  window.testXp365bSimple = testXp365bSimple;
  window.printXp365bBarcodeLabel = printXp365bBarcodeLabel;
}
