/**
 * Xprinter XP-365B Print Service (TSPL)
 * Печать штрих-кодовых этикеток через WebUSB + команды для кириллицы
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

// Энкодер TSPL (ASCII → bytes)
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

  // как в html-примере — по классу принтера
  const filters = [{ classCode: 0x07 }];
  return await navigator.usb.requestDevice({ filters });
}

/* ====================== спец. команды для кириллицы ====================== */

/**
 * Отправка сервисных команд:
 *  1F 1B 1F FE 01
 *  1F 1B 1F FE 11
 * которые в конфигураторе рекомендуют для включения кириллицы.
 */
async function sendXp365bKyrillicInit(dev, outEP) {
  try {
    // первый пакет: 1F 1B 1F FE 01
    const cmd1 = new Uint8Array([0x1f, 0x1b, 0x1f, 0xfe, 0x01]);
    // второй пакет: 1F 1B 1F FE 11
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
 * Открытие устройства и поиск bulk OUT endpoint (интерфейс 0 alt 0),
 * + отправка init-команд для кириллицы.
 */
async function openUsbDevice(dev) {
  if (!dev) throw new Error("USB устройство не найдено");

  if (!dev.opened) {
    await dev.open();
  }

  if (dev.configuration === null) {
    await dev.selectConfiguration(1);
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

  // === тут отправляем специальные команды для кириллицы ===
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

/* ====================== TSPL: этикетка ====================== */

function buildTsplLabel({ title, barcode, widthMm = 58, heightMm = 40 }) {
  const name = (title || "Тестовый товар").trim();
  const code = (barcode || "123456789012").trim();

  const nameLines = wrap(name, 24);

  let y = 30;
  const cmds = [];

  cmds.push(`SIZE ${widthMm} mm,${heightMm} mm\r\n`);
  cmds.push(`GAP 2 mm,0 mm\r\n`);
  cmds.push("DIRECTION 1\r\n");
  cmds.push("REFERENCE 0,0\r\n");
  cmds.push("CLS\r\n");

  // кодовая страница под кириллицу (после init-команд)
  cmds.push("CODEPAGE 866\r\n");

  // первая строка — крупный шрифт
  cmds.push(
    `TEXT 30,${y},"TSS24.BF2",0,1,1,"${(nameLines[0] || "")
      .replace(/"/g, "")
      .slice(0, 24)}"\r\n`
  );

  // вторая строка (если есть) — поменьше
  if (nameLines[1]) {
    y += 30;
    cmds.push(
      `TEXT 30,${y},"TSS16.BF2",0,1,1,"${nameLines[1]
        .replace(/"/g, "")
        .slice(0, 24)}"\r\n`
    );
  }

  // ниже — штрихкод
  y += 70;
  cmds.push(`BARCODE 30,${y},"128",60,1,0,2,4,"${code.replace(/"/g, "")}"\r\n`);

  cmds.push("PRINT 1\r\n");

  const tsplStr = cmds.join("");
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

  // если уже подключены — не лезем в диалог
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

  console.log("Печатаем этикетку XP-365B (TSPL + кириллический init):", {
    barcode: params.barcode,
    title: params.title,
  });

  for (const part of chunkBytes(buf)) {
    await dev.transferOut(outEP, part);
    await new Promise((r) => setTimeout(r, 5));
  }

  console.log("Команда на печать отправлена");
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

  // на всякий случай ещё раз отправим init-команды перед тестом
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
    "BAR 20,130,420,6",
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

/* ====================== Повесим тест на window для DevTools ====================== */

if (typeof window !== "undefined") {
  window.testXp365bEncodingPrint = testXp365bEncodingPrint;
}
