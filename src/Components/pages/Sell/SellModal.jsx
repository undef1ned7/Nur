// src/pages/.../SellModal.jsx
import { Check, ListOrdered, Minus, Plus, Tags, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";

import { useDebounce } from "../../../hooks/useDebounce";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  addCustomItem,
  createDeal,
  deleteProductInCart,
  doSearch,
  getProductCheckout,
  getProductInvoice,
  historySellProduct,
  manualFilling,
  productCheckout,
  startSale,
  updateProductInCart,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { getProfile, useUser } from "../../../store/slices/userSlice";
import BarcodeScanner from "./BarcodeScanner";
import { createDebt, DEAL_STATUS_RU } from "./Sell";
import { fetchTransfersAsync } from "../../../store/creators/transferCreators";
import { useProducts } from "../../../store/slices/productSlice";
import { fetchAgentProductsAsync } from "../../../store/creators/productCreators";

/* =========================
   0) Фильтрация (остатки у агента)
   ========================= */
export function filterProducts(products = [], transfers = []) {
  const onAgent = new Map();
  for (const t of transfers || []) {
    const pid = String(t.product);
    const qty = Number(t.qty_on_agent) || 0;
    onAgent.set(pid, (onAgent.get(pid) || 0) + qty);
  }

  if (transfers.length === 0) {
    return (products || []).map((p) => ({
      ...p,
      on_agent: p.qty_on_hand || p.qty_on_agent || 0,
    }));
  }

  return (products || [])
    .filter((p) => (onAgent.get(String(p.id)) || 0) > 0)
    .map((p) => ({ ...p, on_agent: onAgent.get(String(p.id)) || 0 }));
}

/* =========================
   0.1) Хелперы валидации склада
   ========================= */
const STOCK_DETAIL_RE =
  /Недостаточно на складе:\s*«(.+?)»\.\s*Нужно\s*([\d\s.,]+),\s*доступно\s*([\d\s.,]+)/i;

function numberify(s) {
  if (s == null) return 0;
  const n = Number(String(s).replaceAll(" ", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseStockError(err) {
  const raw =
    err?.detail ||
    err?.data?.detail ||
    err?.response?.data?.detail ||
    err?.message ||
    "";
  const m = String(raw).match(STOCK_DETAIL_RE);
  if (!m) return null;
  return {
    name: m[1],
    need: numberify(m[2]),
    available: numberify(m[3]),
    raw,
  };
}

function getAvailableFromObject(p) {
  return (
    Number(p?.qty_on_agent ?? p?.qty_on_hand ?? p?.quantity ?? p?.stock ?? 0) ||
    0
  );
}

/* ============================================================
   A) WebUSB + ESC/POS helpers (с правильной кириллицей)
   ============================================================ */

// --- глобальное USB-состояние
const usbState = { dev: null, opening: null };

// ====== 0) НАСТРОЙКИ БУМАГИ 72 мм ======
// ====== 72 мм (80мм принтер) ======
const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);

// Шрифт: 'A' (крупнее) или 'B' (мельче). По умолчанию B — ниже строка.
const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();

// ширина символа в точках (Font A ~12, Font B ~9)
const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;

// межстрочный интервал в точках (уменьшаем высоту строк)
const LINE_DOT_HEIGHT = Number(
  localStorage.getItem("escpos_line") || (FONT === "B" ? 22 : 24)
);

// ширина строки в символах исходя из выбранного шрифта
const CHARS_PER_LINE = Number(
  localStorage.getItem("escpos_cpl") ||
    Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH)
);

// Быстрые тюнеры из консоли:
function setEscposDotsPerLine(n) {
  localStorage.setItem("escpos_dpl", String(n));
}
function setEscposCharsPerLine(n) {
  localStorage.setItem("escpos_cpl", String(n));
}
function setEscposLineHeight(n) {
  localStorage.setItem("escpos_line", String(n));
}
function setEscposFont(ch) {
  localStorage.setItem("escpos_font", String(ch).toUpperCase());
}

const ESC = (...b) => new Uint8Array(b);
const chunkBytes = (u8, size = 12 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

/* ---------- Кодовые страницы и энкодеры ---------- */
// По вашей самотест-ленте: 66 — PC866 (Cyrillic#2), 73 — WCP1251 (Cyrillic)
const CODEPAGE = Number(localStorage.getItem("escpos_cp") ?? 73);
function setEscposCodepage(n) {
  localStorage.setItem("escpos_cp", String(n));
}

// поддерживаем оба номера и их «альтернативы» некоторых прошивок
const CP866_CODES = new Set([66, 18]); // 18 встречается у части Xprinter
const CP1251_CODES = new Set([73, 22]); // 22 иногда тоже = 1251

function encodeCP1251(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) {
      out.push(c);
    } else if (c === 0x0401) {
      out.push(0xa8); // Ё
    } else if (c === 0x0451) {
      out.push(0xb8); // ё
    } else if (c >= 0x0410 && c <= 0x042f) {
      out.push(0xc0 + (c - 0x0410)); // А..Я
    } else if (c >= 0x0430 && c <= 0x044f) {
      out.push(0xe0 + (c - 0x0430)); // а..я
    } else if (c === 0x2116) {
      out.push(0xb9); // №
    } else {
      out.push(0x3f);
    }
  }
  return new Uint8Array(out);
}

function encodeCP866(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) {
      out.push(c);
    } else if (c >= 0x0410 && c <= 0x042f) {
      out.push(0x80 + (c - 0x0410)); // А..Я
    } else if (c >= 0x0430 && c <= 0x043f) {
      out.push(0xa0 + (c - 0x0430)); // а..п
    } else if (c >= 0x0440 && c <= 0x044f) {
      out.push(0xe0 + (c - 0x0440)); // р..я
    } else if (c === 0x0401) {
      out.push(0xf0); // Ё
    } else if (c === 0x0451) {
      out.push(0xf1); // ё
    } else if (c === 0x2116) {
      out.push(0xfc); // №
    } else {
      out.push(0x3f);
    }
  }
  return new Uint8Array(out);
}

const getEncoder = (n) =>
  CP866_CODES.has(n)
    ? encodeCP866
    : CP1251_CODES.has(n)
    ? encodeCP1251
    : encodeCP1251;

/* ---------- Рендер PDF в растр (резерв) ---------- */
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

  // было: \n\n\n + full cut — это даёт много пустоты
  // стало: одна строка и рез
  const feedAndCut = new Uint8Array([
    0x1b,
    0x64,
    0x01, // ESC d n  -> подача на 1 строку
    0x1d,
    0x56,
    0x00, // GS V 0  -> полный отрез
  ]);

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

/* ---------- JSON → ESC/POS (кириллица) ---------- */
const money = (n) => Number(n || 0).toFixed(2);
function lr(left, right, width = 32) {
  const L = String(left ?? "");
  const R = String(right ?? "");
  const spaces = Math.max(1, width - L.length - R.length);
  return L + " ".repeat(spaces) + R;
}

function buildReceiptFromJSON(payload, opts = {}) {
  const width = opts.width || CHARS_PER_LINE; // <-- так
  const divider = "-".repeat(width);
  const enc = getEncoder(CODEPAGE);

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
  chunks.push(ESC(0x1b, 0x74, CODEPAGE)); // Codepage: 66 (PC866) или 73 (WCP1251)

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

  chunks.push(ESC(0x1b, 0x45, 0x01));
  chunks.push(enc(lr("ИТОГО:", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00));

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
  chunks.push(ESC(0x1d, 0x56, 0x00));
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

async function handleCheckoutResponseForPrinting(res) {
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

/* ---------- WebUSB ---------- */
function saveVidPidToLS(dev) {
  try {
    localStorage.setItem("escpos_vid", dev.vendorId.toString(16));
    localStorage.setItem("escpos_pid", dev.productId.toString(16));
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

function attachUsbListenersOnce() {
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

  // ВАЖНО: для 72 мм печатаем на всю ширину принтера
  const canvas = await pdfBlobToCanvas(pdfBlob, DOTS_PER_LINE);
  const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
  const escpos = buildEscPosForRaster(raster, bytesPerLine, h);

  for (const part of chunkBytes(escpos)) {
    await dev.transferOut(outEP, part);
  }
}

async function printReceiptJSONViaUSB(payload) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);

  // ВАЖНО: width = CHARS_PER_LINE (обычно 48 для 576 dots)
  const parts = buildReceiptFromJSON(payload, { width: CHARS_PER_LINE });

  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}

// Диагностическая печать страниц 66/73
async function printCyrPagesTest() {
  if (!("usb" in navigator)) return;
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);
  for (const n of [66, 73]) {
    const enc = getEncoder(n);
    const data = [
      ESC(0x1b, 0x40),
      ESC(0x1b, 0x52, 0x07),
      ESC(0x1b, 0x74, n),
      enc(`Кодовая страница ${n}: ТЕСТ Ёжик Яя №\n`),
      enc("-".repeat(32) + "\n\n"),
    ];
    for (const d of data) await dev.transferOut(outEP, d);
  }
}

/* =========================
   1) SellModal
   ========================= */
const SellModal = ({ onClose, id, selectCashBox }) => {
  const dispatch = useDispatch();
  const location = useLocation();

  const { list: cashBoxes } = useCash();
  const { list: clients } = useClient();
  const { company, profile } = useUser();
  const { cart, loading, barcode, error, start, foundProduct } = useSale();
  const { agentProducts: transfers } = useProducts();

  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "client"
      ),
    [clients]
  );

  const [activeTab, setActiveTab] = useState(
    company?.sector?.name !== "Магазин" ? 1 : 0
  );
  const [isTabSelected, setIsTabSelected] = useState(true);
  const [clientId, setClientId] = useState("");
  const [debt, setDebt] = useState("");
  const [phone, setPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [inline, setInline] = useState({ id: null, field: null });
  const [quantity, setQuantity] = useState("");
  const [discount, setDiscount] = useState("");
  const [editingQuantity, setEditingQuantity] = useState({
    id: null,
    value: "",
  });
  const [showServices, setShowServices] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: 1,
  });
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Продажа",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });

  const run = (thunk) => dispatch(thunk).unwrap();

  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId]
  );

  const debouncedSearch = useDebounce((value) => {
    dispatch(doSearch({ search: value }));
  }, 600);

  const onSearch = useCallback(
    (e) => debouncedSearch(e.target.value),
    [debouncedSearch]
  );

  const onNewClientChange = useCallback(
    (e) => setNewClient((p) => ({ ...p, [e.target.name]: e.target.value })),
    []
  );

  const onCustomServiceChange = useCallback(
    (e) => setCustomService((p) => ({ ...p, [e.target.name]: e.target.value })),
    []
  );

  const sellData =
    location.pathname === "/crm/production/agents"
      ? Array.isArray(transfers)
        ? transfers
        : []
      : Array.isArray(foundProduct?.results)
      ? foundProduct.results
      : [];

  const filteredItems = useMemo(() => {
    const base = Array.isArray(foundProduct?.results)
      ? foundProduct.results
      : [];
    const trs = Array.isArray(transfers) ? transfers : [];
    return filterProducts(base, trs);
  }, [foundProduct?.results, transfers]);

  const isShop = company?.sector?.name === "Магазин";
  const allCatalogItems = useMemo(
    () => (isShop ? filteredItems : sellData),
    [isShop, filteredItems, sellData]
  );

  const xName = (p) =>
    p?.name ?? p?.product_name ?? p?.display_name ?? String(p?.id ?? "");

  const getItemAvailableById = useCallback(
    (productId) => {
      if (!allCatalogItems || allCatalogItems.length === 0) return null;
      const pid = String(productId);
      const p =
        allCatalogItems.find((x) => {
          const id1 = x?.id != null ? String(x.id) : "";
          const id2 = x?.product != null ? String(x.product) : "";
          const id3 = x?.product_id != null ? String(x.product_id) : "";
          return id1 === pid || id2 === pid || id3 === pid;
        }) || null;

      return p
        ? { available: getAvailableFromObject(p), name: xName(p) }
        : { available: 0, name: "" };
    },
    [allCatalogItems]
  );

  const getCartQtyById = useCallback(
    (productId) => {
      const line =
        (start?.items || []).find((x) => String(x.id) === String(productId)) ||
        null;
      return Number(line?.quantity ?? 0);
    },
    [start?.items]
  );

  const guardQty = useCallback(
    (productId, wantQty) => {
      const info = getItemAvailableById(productId);
      if (info == null) return true;
      const { available, name } = info;
      if (wantQty > available) {
        alert(
          `Недостаточно на складе: «${
            name || productId
          }».\nНужно ${wantQty}, доступно ${available}.`
        );
        return false;
      }
      return true;
    },
    [getItemAvailableById]
  );

  const saveInline = useCallback(
    async (productId) => {
      const wantQty = quantity ? Number(quantity) : 1;
      if (!guardQty(productId, wantQty)) return;
      try {
        const payload = {
          id,
          productId,
          quantity: wantQty,
          discount_total: discount || 0,
        };
        await run(manualFilling(payload));
        await run(startSale());
        setInline({ id: null, field: null });
        setQuantity("");
        setDiscount("");
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось применить изменения");
      }
    },
    [id, quantity, discount, run, guardQty]
  );

  const addOne = useCallback(
    async (productId) => {
      const current = getCartQtyById(productId);
      if (!guardQty(productId, current + 1)) return;
      try {
        await run(manualFilling({ id, productId }));
        await run(startSale());
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось добавить товар");
      }
    },
    [id, run, guardQty, getCartQtyById]
  );

  const changeQtyOrRemove = useCallback(
    async (item) => {
      const qty = Number(item?.quantity ?? 0);
      try {
        if (qty > 1) {
          await run(
            updateProductInCart({
              id,
              productId: item.id,
              data: { quantity: qty - 1 },
            })
          );
        } else {
          await run(deleteProductInCart({ id, productId: item.id }));
        }
        await run(startSale());
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось обновить корзину");
      }
    },
    [id, run]
  );

  const updateItemQuantity = useCallback(
    async (item, newQuantity) => {
      const qty = Number(newQuantity);
      if (qty <= 0) {
        try {
          await run(deleteProductInCart({ id, productId: item.id }));
          await run(startSale());
          setEditingQuantity({ id: null, value: "" });
        } catch (err) {
          const parsed = parseStockError(err);
          if (parsed) {
            alert(
              `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
            );
            return;
          }
          console.error(err);
          alert("Не удалось удалить позицию");
        }
        return;
      }
      try {
        await run(
          updateProductInCart({
            id,
            productId: item.id,
            data: { quantity: qty },
          })
        );
        await run(startSale());
        setEditingQuantity({ id: null, value: "" });
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось обновить количество");
      }
    },
    [id, run]
  );

  const createClient = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const created = await run(createClientAsync(newClient));
        await dispatch(fetchClientsAsync());
        if (created?.id != null) setClientId(String(created.id));
        setPhone(created?.phone || newClient.phone || "");
        setShowCreateClient(false);
      } catch (err) {
        console.error(err);
        alert("Не удалось создать клиента");
      }
    },
    [newClient, run, dispatch]
  );

  const addCustomService = useCallback(
    async (e) => {
      e.preventDefault();
      if (!customService.name.trim() || !customService.price) {
        alert("Заполните название и цену услуги");
        return;
      }
      try {
        await run(
          addCustomItem({
            id,
            name: customService.name,
            price: customService.price,
            quantity: customService.quantity,
          })
        );
        await run(startSale());
        setCustomService({ name: "", price: "", quantity: 1 });
        setShowServices(false);
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось добавить услугу");
      }
    },
    [customService, id, run]
  );

  const performCheckout = useCallback(
    async (withReceipt) => {
      try {
        if (debt === "Долги") {
          if (!clientId) return alert("Выберите клиента");
          if (!dueDate && company.subscription_plan.name === "Старт")
            return alert("Выберите дату");
          if (!phone && company.subscription_plan.name === "Старт")
            return alert("Введите номер телефона");
          if (company.subscription_plan.name === "Старт") {
            await createDebt({
              name: pickClient?.full_name,
              phone,
              due_date: dueDate,
              amount: start?.total,
            });
          }
        }

        if (clientId) {
          await dispatch(
            createDeal({
              clientId: clientId,
              title: `${debt || "Продажа"} ${pickClient?.full_name}`,
              statusRu: debt,
              amount: start?.total,
              prepayment: debt === "Предоплата" ? Number(amount) : undefined,
              debtMonths:
                debt === "Долги" || debt === "Предоплата"
                  ? Number(debtMonths)
                  : undefined,
            })
          ).unwrap();
        }

        const result = await run(
          productCheckout({ id: start?.id, bool: withReceipt, clientId })
        );

        if (debt !== "Долги") {
          await run(
            addCashFlows({
              ...cashData,
              name: cashData.name === "" ? "Продажа" : cashData.name,
              amount: debt === "Предоплата" ? amount : start.total,
              source_cashbox_flow_id: start.id,
            })
          );
        }

        if (withReceipt && result?.sale_id) {
          const checkoutRes = await run(getProductCheckout(result.sale_id));
          try {
            await handleCheckoutResponseForPrinting(checkoutRes);
          } catch (e) {
            console.error("Печать чека не удалась:", e);
            alert(
              "Не удалось распечатать чек. Проверьте WinUSB и формат ответа (JSON/PDF)."
            );
          }

          const invoiceRes = await run(getProductInvoice(result.sale_id));
          if (invoiceRes instanceof Blob) {
            const url2 = URL.createObjectURL(invoiceRes);
            const a2 = document.createElement("a");
            a2.href = url2;
            a2.download = "invoice.pdf";
            a2.click();
            URL.revokeObjectURL(url2);
          }
        }

        dispatch(historySellProduct());
        onClose();
      } catch (err) {
        const parsed = parseStockError(err);
        if (parsed) {
          alert(
            `Недостаточно на складе: «${parsed.name}».\nНужно ${parsed.need}, доступно ${parsed.available}.`
          );
          return;
        }
        console.error(err);
        alert("Не удалось оформить продажу");
      }
    },
    [
      debt,
      clientId,
      phone,
      pickClient?.full_name,
      start?.total,
      start?.id,
      cashData,
      run,
      dispatch,
      onClose,
      amount,
      debtMonths,
      dueDate,
      company?.subscription_plan?.name,
    ]
  );

  const debouncedSearch1 = useDebounce((v) => {
    dispatch(startSale(v.length === 0 ? 0 : v));
  }, 800);
  const onChange = (e) => debouncedSearch1(e.target.value);

  useEffect(() => {
    dispatch(doSearch({ search: "" }));
  }, [activeTab, dispatch]);

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    dispatch(fetchAgentProductsAsync());
  }, [dispatch]);

  useEffect(() => {
    setCashData((prev) => ({ ...prev, cashbox: selectCashBox }));
  }, [selectCashBox]);

  useEffect(() => {
    if (!profile) return;
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
  }, [dispatch, profile]);

  // авто-подключение USB на монтировании
  useEffect(() => {
    attachUsbListenersOnce();
    ensureUsbReadyAuto().catch(() => {});
  }, []);

  const isOutOfStock = useCallback(
    (p) =>
      Number(
        p?.qty_on_hand ?? p?.qty_on_agent ?? p?.quantity ?? p?.stock ?? 0
      ) <= 0,
    []
  );

  const handleTabClick = useCallback((index) => {
    setActiveTab(index);
    setIsTabSelected(true);
  }, []);

  const tabs = useMemo(
    () => [
      {
        label: "Сканировать",
        content: <BarcodeScanner id={id} />,
        option: "scan",
      },
      {
        label: "Вручную",
        content: (
          <ManualList
            items={filteredItems}
            inline={inline}
            quantity={quantity}
            discount={discount}
            onSearch={onSearch}
            setQuantity={setQuantity}
            setDiscount={setDiscount}
            saveInline={saveInline}
            setInline={setInline}
            addOne={addOne}
            isOutOfStock={isOutOfStock}
          />
        ),
        option: "manually",
      },
    ],
    [
      id,
      filteredItems,
      inline,
      quantity,
      discount,
      onSearch,
      saveInline,
      addOne,
      isOutOfStock,
    ]
  );

  return (
    <div className="add-modal sell">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {company?.sector?.name !== "Магазин" ? (
          <ManualList
            items={sellData}
            inline={inline}
            quantity={quantity}
            discount={discount}
            onSearch={onSearch}
            setQuantity={setQuantity}
            setDiscount={setDiscount}
            saveInline={saveInline}
            setInline={setInline}
            addOne={addOne}
            isOutOfStock={isOutOfStock}
          />
        ) : (
          <>
            {tabs.map((tab, index) => (
              <button
                className={`add-modal__button  ${
                  activeTab === index && isTabSelected
                    ? "add-modal__button-active"
                    : ""
                }`}
                key={index}
                onClick={() => handleTabClick(index)}
              >
                {tab.label}
              </button>
            ))}
            {isTabSelected && activeTab !== null && (
              <div className="add-modal__container">
                {tabs[activeTab].content}
              </div>
            )}
          </>
        )}

        {!!start?.items?.length && (
          <div className="receipt">
            {location.pathname !== "/crm/production/agents" && (
              <>
                <button
                  className="create-client receipt__add"
                  onClick={() => setShowServices(true)}
                  type="button"
                >
                  Доп. Услуги <Plus />
                </button>
                {showServices && (
                  <form
                    className="receipt__services"
                    onSubmit={addCustomService}
                  >
                    <input
                      type="text"
                      className="add-modal__input one"
                      placeholder="Название услуги"
                      name="name"
                      value={customService.name}
                      onChange={onCustomServiceChange}
                      required
                    />
                    <input
                      type="number"
                      className="add-modal__input two"
                      placeholder="Цена"
                      name="price"
                      value={customService.price}
                      onChange={onCustomServiceChange}
                      min="0"
                      step="0.01"
                      required
                    />
                    <input
                      type="number"
                      className="add-modal__input"
                      placeholder="Количество"
                      name="quantity"
                      value={customService.quantity}
                      onChange={onCustomServiceChange}
                      min="1"
                      style={{ width: "100px" }}
                    />
                    <button type="submit" className="add-modal__button reBtn">
                      <Plus />
                    </button>
                  </form>
                )}
              </>
            )}
            <h2 className="receipt__title">Приход</h2>

            <ClientBlock
              company={company}
              filterClient={filterClient}
              clientId={clientId}
              setClientId={setClientId}
              showCreateClient={showCreateClient}
              setShowCreateClient={setShowCreateClient}
              newClient={newClient}
              onNewClientChange={onNewClientChange}
              createClient={createClient}
            />
            {paymentBlockMemo(
              company?.sector?.name,
              debt,
              phone,
              setDebt,
              setPhone,
              amount,
              setAmount,
              debtMonths,
              setDebtMonths,
              dueDate,
              setDueDate
            )}

            {start.items.map((p, idx) => (
              <div className="receipt__item" key={p.id ?? idx}>
                <p className="receipt__item-name">
                  {idx + 1}. {p.product_name ?? p.display_name}
                </p>
                <div>
                  <p>{p.tax_total}</p>
                  <p className="receipt__item-price">
                    {editingQuantity.id === p.id ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <input
                          type="number"
                          value={editingQuantity.value}
                          onChange={(e) =>
                            setEditingQuantity({
                              id: p.id,
                              value: e.target.value,
                            })
                          }
                          min="0"
                          style={{
                            width: "60px",
                            padding: "4px 8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateItemQuantity(p, editingQuantity.value)
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuantity({ id: null, value: "" })
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>
                          {p.quantity} x {p.unit_price} ≡{" "}
                          {p.quantity * p.unit_price}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuantity({
                              id: p.id,
                              value: p.quantity.toString(),
                            })
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#ffd600",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => changeQtyOrRemove(p)}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                    )}
                  </p>
                </div>
              </div>
            ))}

            <button
              className="create-client"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={() => setShowDiscount(!showDiscount)}
            >
              {showDiscount ? "Отменить" : "Добавить общую скидку"}
            </button>
            {showDiscount && (
              <div className="receipt__discount">
                <input
                  type="text"
                  onChange={onChange}
                  className="add-modal__input"
                  placeholder="Сумма скидки"
                />
              </div>
            )}

            <div className="receipt__total">
              <b>ИТОГО</b>
              <div style={{ gap: 10, display: "flex", alignItems: "center" }}>
                <p>Общая скидка {start?.discount_total}</p>
                <p>Налог {start?.tax_total}</p>
                <b>≡ {start?.total}</b>
              </div>
            </div>

            <div className="receipt__row">
              <button
                className="receipt__row-btn"
                onClick={() => performCheckout(true)}
                type="button"
              >
                Печать чека
              </button>
              <button
                className="receipt__row-btn"
                onClick={() => performCheckout(false)}
                type="button"
              >
                Без чека
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellModal;
export { printCyrPagesTest };

/* =========================
   2) PaymentBlock
   ========================= */
function PaymentBlock({
  sectorName,
  debt,
  setDebt,
  phone,
  setPhone,
  amount,
  setAmount,
  debtMonths,
  setDebtMonths,
  dueDate,
  setDueDate,
}) {
  const { company } = useUser();
  return (
    <>
      <div className="add-modal__section">
        <label>Тип оплаты</label>
        <select
          className="add-modal__input"
          value={debt}
          onChange={(e) => setDebt(e.target.value)}
        >
          <option value="">-- Выберите тип оплаты --</option>
          {DEAL_STATUS_RU.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {debt === "Предоплата" && (
        <>
          <div className="add-modal__section">
            <label>Сумма предоплаты *</label>
            <input
              className="add-modal__input"
              placeholder="Введите сумму предоплаты"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="add-modal__section">
            <label>Срок долга *</label>
            <input
              className="add-modal__input"
              placeholder="Например, 6"
              min={1}
              step={1}
              value={debtMonths}
              onChange={(e) => setDebtMonths(e.target.value)}
            />
          </div>
          {company.subscription_plan.name === "Старт" && (
            <>
              <div className="add-modal__section">
                <label>Телефон *</label>
                <input
                  className="add-modal__input"
                  placeholder="Например, +996555555555"
                  min={1}
                  step={1}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="add-modal__section">
                <label>Дата возврата *</label>
                <input
                  className="add-modal__input"
                  min={1}
                  step={1}
                  value={dueDate}
                  type="date"
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </>
          )}
        </>
      )}

      {debt === "Долги" && (
        <>
          <div className="add-modal__section">
            <label>Срок долга *</label>
            <input
              className="add-modal__input"
              placeholder="Например, 6"
              min={1}
              step={1}
              value={debtMonths}
              onChange={(e) => setDebtMonths(e.target.value)}
            />
          </div>
          {company.subscription_plan.name === "Старт" && (
            <>
              <div className="add-modal__section">
                <label>Телефон *</label>
                <input
                  className="add-modal__input"
                  placeholder="Например, +996555555555"
                  min={1}
                  step={1}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="add-modal__section">
                <label>Дата возврата *</label>
                <input
                  className="add-modal__input"
                  min={1}
                  step={1}
                  value={dueDate}
                  type="date"
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

const paymentBlockMemo = (
  sectorName,
  debt,
  phone,
  setDebt,
  setPhone,
  amount,
  setAmount,
  debtMonths,
  setDebtMonths,
  dueDate,
  setDueDate
) => {
  if (sectorName !== "Магазин" && !window.location.href.includes("agents"))
    return "";
  return (
    <PaymentBlock
      sectorName={sectorName}
      debt={debt}
      setDebt={setDebt}
      phone={phone}
      setPhone={setPhone}
      amount={amount}
      setAmount={setAmount}
      debtMonths={debtMonths}
      setDebtMonths={setDebtMonths}
      dueDate={dueDate}
      setDueDate={setDueDate}
    />
  );
};

/* =========================
   3) ManualList
   ========================= */
const ManualList = React.memo(function ManualList({
  items = [],
  inline,
  quantity,
  discount,
  onSearch,
  setQuantity,
  setDiscount,
  saveInline,
  setInline,
  addOne,
  isOutOfStock,
}) {
  const list = Array.isArray(items)
    ? items
    : Array.isArray(items?.results)
    ? items.results
    : [];

  const getItemId = (p) => p?.id ?? p?.product;
  const getItemName = (p) => p?.name ?? p?.product_name ?? "";
  const getItemQty = (p) =>
    p?.qty_on_agent ?? p?.qty_on_hand ?? p?.quantity ?? p?.stock ?? 0;

  return (
    <div className="sell__manual">
      <input
        type="text"
        placeholder="Введите название товара"
        className="add-modal__input"
        name="search"
        onChange={onSearch}
      />
      <ul className="sell__list">
        {list.map((p) => {
          const pid = getItemId(p);
          return (
            <li key={pid}>
              <div style={{ display: "flex", columnGap: "10px" }}>
                <p>{getItemName(p)}</p>
                <p>{getItemQty(p)}</p>
              </div>
              <div className="sell__list-row">
                {isOutOfStock(p) ? (
                  <div className="sell__empty">
                    <span className="sell__badge--danger">Нет в наличии</span>
                  </div>
                ) : inline.id === pid && inline.field === "quantity" ? (
                  <>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Количество"
                    />
                    <button type="button" onClick={() => saveInline(pid)}>
                      <Check />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInline({ id: null, field: null })}
                    >
                      <X />
                    </button>
                  </>
                ) : inline.id === pid && inline.field === "discount" ? (
                  <>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="Скидка (сом)"
                    />
                    <button type="button" onClick={() => saveInline(pid)}>
                      <Check />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInline({ id: null, field: null })}
                    >
                      <X />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setInline({ id: pid, field: "discount" })}
                    >
                      <Tags />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInline({ id: pid, field: "quantity" })}
                    >
                      <ListOrdered />
                    </button>
                    <button type="button" onClick={() => addOne(pid)}>
                      <Plus size={16} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* =========================
   4) ClientBlock
   ========================= */
const ClientBlock = React.memo(function ClientBlock({
  company,
  filterClient,
  clientId,
  setClientId,
  showCreateClient,
  setShowCreateClient,
  newClient,
  onNewClientChange,
  createClient,
}) {
  return (
    <div className="add-modal__section">
      <label>Клиенты *</label>
      <select
        className="add-modal__input"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        required
      >
        <option value="">-- Выберите клиента --</option>
        {filterClient.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.full_name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="create-client"
        onClick={() => setShowCreateClient((s) => !s)}
      >
        {showCreateClient ? "Отменить" : "Создать клиента"}
      </button>

      {showCreateClient && (
        <form
          style={{ display: "flex", flexDirection: "column", rowGap: "10px" }}
          onSubmit={createClient}
        >
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            placeholder="ФИО"
            name="full_name"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="llc"
            placeholder="ОсОО"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="inn"
            placeholder="ИНН"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="okpo"
            placeholder="ОКПО"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="score"
            placeholder="Р/СЧЁТ"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="bik"
            placeholder="БИК"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="address"
            placeholder="Адрес"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="text"
            name="phone"
            placeholder="Телефон"
          />
          <input
            className="add-modal__input"
            onChange={onNewClientChange}
            type="email"
            name="email"
            placeholder="Почта"
          />
          <div style={{ display: "flex", columnGap: "10px" }}>
            <button
              className="create-client"
              type="button"
              onClick={() => setShowCreateClient(false)}
            >
              Отмена
            </button>
            <button className="create-client">Создать</button>
          </div>
        </form>
      )}

      {company?.sector?.name === "Строительная компания" && (
        <select className="add-modal__input" defaultValue="">
          <option value="" disabled>
            -- Выберите тип платежа --
          </option>
          <option>Аванс</option>
          <option>Кредит</option>
          <option>Полная оплата</option>
        </select>
      )}
    </div>
  );
});
