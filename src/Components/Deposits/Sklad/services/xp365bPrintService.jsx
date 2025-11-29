/**
 * Xprinter XP-365B Print Service (TSPL)
 * Печать штрих-кодовых этикеток через WebUSB
 */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

// Разбиение больших буферов на куски
const chunkBytes = (u8, size = 8 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

// Простейший ASCII-энкодер (TSPL команды — ASCII)
function asciiEncode(str = "") {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i] = code >= 32 && code <= 126 ? code : 0x3f; // печатаемые ASCII, иначе '?'
  }
  return bytes;
}

/* ---------- WebUSB helpers ---------- */

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
  return (
    devs.find(
      (d) =>
        (!savedVid || d.vendorId === savedVid) &&
        (!savedPid || d.productId === savedPid)
    ) || null
  );
}

async function requestUsbDevice() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  // Классы "printer" и vendor-specific
  const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
  return await navigator.usb.requestDevice({ filters });
}

/**
 * Более «терпимый» openUsbDevice:
 *  - выбираем любой интерфейс с OUT endpoint
 *  - claim/selectAlt пробуем, но не считаем ошибку фатальной (особенно на macOS)
 */
async function openUsbDevice(dev) {
  if (!dev) throw new Error("USB устройство не найдено");

  if (!dev.opened) {
    await dev.open();
  }

  if (dev.configuration == null) {
    // пробуем конфигурацию 2 (как у тебя на скрине), иначе первую
    let cfgNum = 1;
    if (dev.configurations?.length) {
      const cfg2 = dev.configurations.find((c) => c.configurationValue === 2);
      cfgNum = cfg2 ? 2 : dev.configurations[0].configurationValue;
    }
    await dev.selectConfiguration(cfgNum).catch(() => {});
  }

  const cfg = dev.configuration;
  if (!cfg) throw new Error("Нет активной USB-конфигурации");

  console.log("XP-365B config:", cfg);

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
      if (!out) continue;

      // Пытаемся захватить интерфейс
      try {
        await dev.claimInterface(intf.interfaceNumber);
      } catch (e) {
        console.warn("claimInterface failed:", e);
        continue;
      }

      const needAlt =
        typeof alt.alternateSetting === "number" ? alt.alternateSetting : 0;
      try {
        if (dev.selectAlternateInterface) {
          await dev.selectAlternateInterface(intf.interfaceNumber, needAlt);
        }
      } catch (e) {
        console.warn("selectAlternateInterface failed:", e);
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
    "Принтер найден, но не удалось захватить интерфейс с bulk OUT.\n" +
      "На macOS это почти всегда значит, что этот интерфейс уже занят системным драйвером принтера.\n" +
      "Браузер через WebUSB не может им управлять. Либо уберите системный драйвер/принтер, " +
      "либо печатайте через системную печать (window.print / PDF) или с другой ОС (Windows + WinUSB)."
  );
}

async function ensureUsbReadyAuto() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("WebUSB не поддерживается");
  }

  if (usbState.dev) return usbState;

  if (!usbState.opening) {
    usbState.opening = (async () => {
      const dev = await tryUsbAutoConnect();
      if (!dev) return null;
      await openUsbDevice(dev);
      usbState.dev = dev;
      return usbState;
    })().finally(() => {
      usbState.opening = null;
    });
  }

  await usbState.opening;
  return usbState.dev ? usbState : null;
}

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
      await openUsbDevice(e.device);
      usbState.dev = e.device;
    } catch (err) {
      console.warn("XP-365B auto-connect failed:", err);
    }
  });

  navigator.usb.addEventListener("disconnect", (e) => {
    if (usbState.dev && e.device === usbState.dev) {
      usbState.dev = null;
    }
  });
}

export async function checkXp365bConnection() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) return false;
  try {
    const state = await ensureUsbReadyAuto();
    return state !== null && usbState.dev !== null;
  } catch {
    return false;
  }
}

/**
 * Ручное подключение (для кнопки "Подключить принтер")
 */
export async function connectXp365bManually() {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  if (usbState.dev) {
    await openUsbDevice(usbState.dev);
    return;
  }

  const dev = await requestUsbDevice(); // диалог выбора устройства
  saveVidPidToLS(dev);
  await openUsbDevice(dev);
  usbState.dev = dev;
}

/* ---------- Построение TSPL-команд для этикетки ---------- */

function buildTsplForBarcodeLabel({
  barcode,
  title = "",
  copies = 1,
  widthMm = 40,
  heightMm = 30,
}) {
  const safeBarcode = String(barcode || "").replace(/"/g, "");
  const safeTitle = String(title || "")
    .replace(/"/g, "")
    .slice(0, 30);

  let cmd = "";

  cmd += `SIZE ${widthMm} mm,${heightMm} mm\r\n`;
  cmd += "GAP 2 mm,0\r\n";
  cmd += "DIRECTION 1\r\n";
  cmd += "REFERENCE 0,0\r\n";
  cmd += "CLS\r\n";

  if (safeTitle) {
    cmd += `TEXT 40,20,"0",0,1,1,"${safeTitle}"\r\n`;
  }

  cmd += `BARCODE 40,80,"128",80,1,0,2,4,"${safeBarcode}"\r\n`;
  cmd += `PRINT ${copies},1\r\n`;

  return asciiEncode(cmd);
}

/* ---------- Печать этикетки со штрих-кодом через USB ---------- */

export async function printXp365bBarcodeLabel(params) {
  if (!params || !params.barcode) {
    throw new Error("Не передан штрих-код для печати");
  }

  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("Браузер не поддерживает WebUSB");
  }

  await ensureUsbReadyAuto();

  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
    usbState.dev = dev;
  }

  const { outEP } = await openUsbDevice(dev);

  const tsplBytes = buildTsplForBarcodeLabel({
    barcode: params.barcode,
    title: params.title,
    copies: params.copies ?? 1,
    widthMm: params.widthMm ?? 40,
    heightMm: params.heightMm ?? 30,
  });

  for (const part of chunkBytes(tsplBytes)) {
    await dev.transferOut(outEP, part);
  }
}
