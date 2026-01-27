/**
 * XPrinter XP-350B / XP-365B
 * TSPL • 203 DPI • 25x15 mm • GAP 7 mm
 * Кириллица: CP866
 */

/* ====================== USB STATE ====================== */

const usbState = {
  dev: null,
  outEP: null,
};

/* ====================== UTILS ====================== */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chunkBytes = (u8, size = 4096) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) {
    out.push(u8.subarray(i, i + size));
  }
  return out;
};

/* ====================== TEXT WRAP ====================== */

function wrap(text = "", width = 20) {
  const words = String(text).split(/\s+/);
  const out = [];
  let line = "";

  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (next.length <= width) line = next;
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out.slice(0, 2);
}

/* ====================== CP866 ====================== */

function encodeCP866(str = "") {
  const out = [];

  for (const ch of str) {
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

  if (outEP == null) throw new Error("Bulk OUT endpoint не найден");

  await dev.claimInterface(intfNum);

  usbState.dev = dev;
  usbState.outEP = outEP;
}

/* ====================== INIT (CYRILLIC + GAP) ====================== */

async function initPrinter() {
  const cmds = [
    "CODEPAGE 866",
    "SET GAP ON",
    "SET BLINE OFF",
    "\r\n",
  ].join("\r\n");

  await sendTspl(cmds);
}

/* ====================== SEND TSPL ====================== */

async function sendTspl(tspl) {
  const buf = encodeCP866(tspl);
  for (const part of chunkBytes(buf)) {
    await usbState.dev.transferOut(usbState.outEP, part);
    await sleep(5);
  }
}

/* ====================== CONNECT ====================== */

export async function connectXprinter() {
  if (usbState.dev) return;

  const dev = await requestUsbDevice();
  await openUsbDevice(dev);
  await initPrinter();
}

/* ====================== CALIBRATION ====================== */

export async function calibrateXprinter() {
  await connectXprinter();

  const tspl = [
    "SIZE 25 mm,15 mm",
    "GAP 7 mm,0 mm",
    "CLS",
    "PRINT 1",
    "\r\n",
  ].join("\r\n");

  await sendTspl(tspl);
}

/* ====================== LABEL ====================== */

function buildLabel({ title, barcode }) {
  const lines = wrap(title || "ТОВАР");
  const code = barcode || "123456789012";

  return [
    "SIZE 25 mm,15 mm",
    "GAP 7 mm,0 mm",

    "SPEED 4",
    "DENSITY 8",

    "DIRECTION 1",
    "REFERENCE 0,0",
    "OFFSET 0",

    "CLS",
    "CODEPAGE 866",

    `TEXT 8,8,"3",0,1,1,"${lines[0] || ""}"`,
    lines[1] ? `TEXT 8,32,"3",0,1,1,"${lines[1]}"` : "",

    `BARCODE 8,${lines[1] ? 58 : 40},"128",32,1,0,2,2,"${code}"`,

    "PRINT 1",
    "\r\n",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/* ====================== PRINT ====================== */

export async function printLabel({ title, barcode }) {
  await connectXprinter();
  const tspl = buildLabel({ title, barcode });
  await sendTspl(tspl);
}

/* ====================== TEST ====================== */

export async function testPrint() {
  await printLabel({
    title: "ТЕСТ XPRINTER 203DPI",
    barcode: "123456789012",
  });
}

/* ====================== DEVTOOLS ====================== */

if (typeof window !== "undefined") {
  window.printLabel = printLabel;
  window.testPrint = testPrint;
  window.calibrateXprinter = calibrateXprinter;
}


// /**
//  * Xprinter XP-350B / XP-365B Print Service (TSPL)
//  * Печать этикеток 25x15 мм через WebUSB
//  * Кодировка: CP866 (кириллица)
//  */

// /* ====================== Глобальное состояние ====================== */

// const usbState = {
//   dev: null,
//   outEP: null,
//   opening: null,
// };

// /* ====================== Utils ====================== */

// const chunkBytes = (u8, size = 4096) => {
//   const out = [];
//   for (let i = 0; i < u8.length; i += size) {
//     out.push(u8.subarray(i, i + size));
//   }
//   return out;
// };

// /* ====================== Перенос строк ====================== */

// function wrap(text = "", width = 16) {
//   const words = String(text).split(/\s+/);
//   const out = [];
//   let line = "";

//   for (const w of words) {
//     const next = line ? line + " " + w : w;
//     if (next.length <= width) line = next;
//     else {
//       if (line) out.push(line);
//       line = w;
//     }
//   }
//   if (line) out.push(line);
//   return out;
// }

// /* ====================== Кодировки ====================== */

// function encodeCP866(str = "") {
//   const out = [];
//   for (const ch of str) {
//     const c = ch.codePointAt(0);
//     if (c <= 0x7f) out.push(c);
//     else if (c >= 0x0410 && c <= 0x042f) {
//       // А-Я (0x410-0x42F) -> 0x80-0x9F
//       out.push(0x80 + (c - 0x0410));
//     } else if (c >= 0x0430 && c <= 0x043f) {
//       // а-п (0x430-0x43F) -> 0xA0-0xAF
//       out.push(0xa0 + (c - 0x0430));
//     } else if (c >= 0x0440 && c <= 0x044f) {
//       // р-я (0x440-0x44F) -> 0xE0-0xEF
//       out.push(0xe0 + (c - 0x0440));
//     } else if (c === 0x0401) out.push(0xf0); // Ё
//     else if (c === 0x0451) out.push(0xf1); // ё
//     else if (c === 0x2116) out.push(0xfc); // №
//     else out.push(0x3f); // ?
//   }
//   return new Uint8Array(out);
// }

// /* ====================== WebUSB ====================== */

// async function requestUsbDevice() {
//   return await navigator.usb.requestDevice({
//     filters: [{ classCode: 0x07 }],
//   });
// }

// async function openUsbDevice(dev) {
//   await dev.open();
//   if (!dev.configuration) await dev.selectConfiguration(1);

//   let outEP = null;
//   let intfNum = null;

//   for (const intf of dev.configuration.interfaces) {
//     for (const alt of intf.alternates) {
//       const ep = alt.endpoints.find(
//         (e) => e.direction === "out" && e.type === "bulk"
//       );
//       if (ep) {
//         outEP = ep.endpointNumber;
//         intfNum = intf.interfaceNumber;
//         break;
//       }
//     }
//     if (outEP != null) break;
//   }

//   if (outEP == null) throw new Error("Bulk OUT endpoint не найден");

//   await dev.claimInterface(intfNum);

//   usbState.dev = dev;
//   usbState.outEP = outEP;
// }

// /* ====================== Кириллица init ====================== */

// async function sendCyrillicInit(dev, ep) {
//   const cmds = [
//     new Uint8Array([0x1f, 0x1b, 0x1f, 0xfe, 0x01]),
//     new Uint8Array([0x1f, 0x1b, 0x1f, 0xfe, 0x11]),
//     // Дополнительная команда для выбора кодовой страницы 866 на уровне железа
//     new Uint8Array([0x1b, 0x74, 0x11]), // ESC t 17 (обычно CP866 в принтерах)
//     encodeCP866("CODEPAGE 866\r\n"),
//   ];
//   for (const c of cmds) {
//     await dev.transferOut(ep, c);
//     await new Promise((r) => setTimeout(r, 50));
//   }
// }

// /* ====================== TSPL: генерация команды ====================== */

// function buildTsplLabel({
//   title,
//   barcode,
// }) {
//   const lines = wrap(title || "Товар", 20);
//   const nameLine1 = (lines[0] || "").replace(/"/g, "");
//   const nameLine2 = (lines[1] || "").replace(/"/g, "");
//   const code = barcode || "123456789012";

//   const tspl = [
//     // 25×15 мм, 203 dpi, скорость ~152 мм/с (6 ips)
//     "SIZE 25 mm,15 mm",
//     "GAP 7 mm,0 mm",
//     "SPEED 6",
//     "DENSITY 8",
//     "DIRECTION 1",
//     "REFERENCE 0,0",
//     "CLS",
//     "CODEPAGE 866",

//     // Название
//     `TEXT 8,8,"3",0,1,1,"${nameLine1}"`,
//     nameLine2
//       ? `TEXT 8,32,"3",0,1,1,"${nameLine2}"`
//       : "",

//     // Штрихкод (низкий, под 15мм)
//     `BARCODE 8,${nameLine2 ? 58 : 40},"128",32,1,0,2,2,"${code}"`,

//     "PRINT 1",
//     "\r\n",
//   ]
//     .filter(Boolean)
//     .join("\r\n");

//   return encodeCP866(tspl);
// }


// /* ====================== Печать ====================== */

// export async function connectXp365b() {
//   const dev = await requestUsbDevice();
//   await openUsbDevice(dev);
//   await sendCyrillicInit(dev, usbState.outEP);
// }

// // Алиас для XP-350B
// export const connectXp350b = connectXp365b;

// /**
//  * Явное подключение (алиас для совместимости)
//  */
// export const connectXp365bManually = connectXp365b;

// /**
//  * Слушатели connect/disconnect (пустая функция для совместимости)
//  */
// export function attachXp365bUsbListenersOnce() {}

// /**
//  * Проверка статуса (заглушка)
//  */
// export async function checkXp365bConnection() {
//   return !!(usbState.dev && usbState.outEP != null);
// }

// export async function printXp365bBarcodeLabel({
//   title,
//   barcode,
//   widthMm,
//   heightMm,
// }) {
//   if (!usbState.dev || usbState.outEP == null) {
//     await connectXp365b();
//   }

//   const buf = buildTsplLabel({ title, barcode, widthMm, heightMm });

//   for (const part of chunkBytes(buf)) {
//     await usbState.dev.transferOut(usbState.outEP, part);
//     await new Promise((r) => setTimeout(r, 5));
//   }
// }

// // Алиас для XP-350B
// export const printXp350bBarcodeLabel = printXp365bBarcodeLabel;

// /* ====================== Тест ====================== */

// export async function testXp365bSimple() {
//   await printXp365bBarcodeLabel({
//     title: "Тест XP-350B/365B",
//     barcode: "123456789012",
//     widthMm: 25,
//     heightMm: 15,
//   });
// }

// export const testXp350bSimple = testXp365bSimple;

// /* ====================== Для DevTools ====================== */

// if (typeof window !== "undefined") {
//   window.printXp365bBarcodeLabel = printXp365bBarcodeLabel;
//   window.testXp365bSimple = testXp365bSimple;
//   window.printXp350bBarcodeLabel = printXp350bBarcodeLabel;
//   window.testXp350bSimple = testXp350bSimple;
// }
