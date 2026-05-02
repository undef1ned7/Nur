// src/Components/Sectors/Production/ProductionAgents/UniversalModal/SellStart.jsx
import { ArrowLeft, Minus, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  useDebounce,
  useDebouncedAction,
} from "../../../../../hooks/useDebounce";
import {
  doSearchInAgent,
  manualFillingInAgent,
  productCheckoutInAgent,
  startSaleInAgent,
  updateManualFillingInAgent,
} from "../../../../../store/creators/agentCreators";
import {
  startAgentCart,
  scanProductInCart,
  addProductToAgentCart,
  addCustomItemToAgentCart,
  checkoutAgentCart,
  getAgentCart,
  removeItemFromAgentCart,
  updateAgentCartItemQuantity,
} from "../../../../../store/creators/agentCartCreators";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../../store/creators/clientCreators";
import {
  createDeal,
  addCustomItem,
  deleteProductInCart,
  getSale,
  getProductCheckout, // будем получать чек в JSON/PDF
  manualFilling,
  productCheckout,
  startSale,
  updateManualFilling,
  updateProductInCart,
} from "../../../../../store/creators/saleThunk";
import { useAgent } from "../../../../../store/slices/agentSlice";
import { useAgentCart } from "../../../../../store/slices/agentCartSlice";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../../store/slices/cashSlice";
import { useSale } from "../../../../../store/slices/saleSlice";
import { useClient } from "../../../../../store/slices/ClientSlice";
import { useUser } from "../../../../../store/slices/userSlice";
import UniversalModal from "../UniversalModal/UniversalModal";
import { DEAL_STATUS_RU } from "../../../../pages/Sell/Sell";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import axios from "axios";
import api from "../../../../../api";
import { validateResErrors } from "../../../../../../tools/validateResErrors";
import "../../../Market/CashierPage/CashierPage.scss";
import "./SellStartCashier.scss";

const cx = (...args) => args.filter(Boolean).join(" ");
const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatSom = (value) =>
  Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatInputDecimal = (value) => Number(value || 0).toFixed(2);
const trimTrailingZeros = (value) =>
  String(value ?? "").replace(/(\.\d*?[1-9])0+$|\.0+$/u, "$1");

const clampDiscountAmount = (subtotal, discountAmount) =>
  Math.max(0, Math.min(toNum(subtotal), toNum(discountAmount)));

const getDiscountAmountByMode = ({ subtotal, value, mode }) => {
  if (mode === "percent") {
    return clampDiscountAmount(
      subtotal,
      (toNum(subtotal) * Math.max(0, toNum(value))) / 100,
    );
  }
  return clampDiscountAmount(subtotal, value);
};

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const paymentBanks = [
  { id: "mbank", name: "МБанк" },
  { id: "optima", name: "Оптима Банк" },
  { id: "obank", name: "О-Банк" },
  { id: "bakai", name: "Бакай Банк" },
  { id: "demir", name: "Демир Банк" },
  { id: "other", name: "Другой банк" },
];

/* ============================================================
   A) WebUSB + ESC/POS helpers (автоподключение, JSON и PDF)
   ============================================================ */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

// ====== 72 мм (80мм принтер) ======
const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);
const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();
const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;
const LINE_DOT_HEIGHT = Number(
  localStorage.getItem("escpos_line") || (FONT === "B" ? 22 : 24),
);
const CHARS_PER_LINE = Number(
  localStorage.getItem("escpos_cpl") ||
    Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH),
);

// Быстрые тюнеры (на всякий)
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

/* ---------- Кодовые страницы ---------- */
const CODEPAGE = Number(localStorage.getItem("escpos_cp") ?? 73);
export function setEscposCodepage(n) {
  localStorage.setItem("escpos_cp", String(n));
}
const CP866_CODES = new Set([66, 18]);
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
async function pdfBlobToCanvas(pdfBlob, targetWidth = DOTS_PER_LINE) {
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
  const feedAndCut = new Uint8Array([0x1b, 0x64, 0x01, 0x1d, 0x56, 0x00]);

  const total = new Uint8Array(
    init.length +
      alignLeft.length +
      header.length +
      raster.length +
      feedAndCut.length,
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
    0,
  );
  const total = subtotal - discount + tax;

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40)); // init
  chunks.push(ESC(0x1b, 0x52, 0x07)); // International: Russia
  chunks.push(ESC(0x1b, 0x74, CODEPAGE)); // page

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
      enc(lr(`${qty} x ${money(price)}`, money(qty * price), width) + "\n"),
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

  if (paidCash || paidCard || change) {
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
    // fallback — не PDF и не JSON
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
        (!savedPid || d.productId === savedPid),
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
        (e) => e.direction === "out" && e.type === "bulk",
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
    "Не удалось захватить интерфейс с bulk OUT. На Windows установите WinUSB (Zadig) и закройте другие приложения принтера.",
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

  const parts = buildReceiptFromJSON(payload, { width: CHARS_PER_LINE });
  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}

/* ============================================================
   B) Компонент SellStart
   ============================================================ */

const normalizeCatalogProducts = (data) => {
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];

  return list.map((item) => ({
    ...item,
    product: item.product ?? item.id,
    product_name: item.product_name ?? item.name ?? item.title ?? "Без названия",
  }));
};

/** Сегодня (локально) 00:00 → выбранная дата 00:00, разница в календарных днях. */
const countCalendarDaysFromToday = (endIso) => {
  if (!endIso || typeof endIso !== "string") return NaN;
  const parts = endIso.split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return NaN;
  const [y, m, d] = parts;
  const end = new Date(y, m - 1, d);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86400000);
};

const tomorrowYmd = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const y = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, "0");
  const da = String(t.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

/** Дата через один календарный месяц от сегодня (локально), формат YYYY-MM-DD. */
const oneMonthFromTodayYmd = () => {
  const t = new Date();
  t.setMonth(t.getMonth() + 1);
  const y = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, "0");
  const da = String(t.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

const SellStart = ({ show, setShow, useMainProductsList = false }) => {
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const { start: agentStart, products } = useAgent();
  const { start: marketStart } = useSale();
  const agentCart = useAgentCart();
  const { 0: agentListProducts, 1: setAgentListProducts } = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const { list: clients = [] } = useClient();

  // Определяем, какую корзину использовать
  const isPilorama = company.sector.name === "Пилорама";
  const isMarketPosMode = useMainProductsList && !isPilorama;
  const start = isMarketPosMode ? marketStart : agentStart;
  const [clientId, setClientId] = useState("");
  const [debtDueDate, setDebtDueDate] = useState(() => oneMonthFromTodayYmd());
  const [form, setForm] = useState({
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
  const [submitTried, setSubmitTried] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [alert, setAlert] = useState({
    open: false,
    type: "success",
    message: "",
  });
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Продажа производство",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });
  const dispatch = useDispatch();
  const run = (thunk) => dispatch(thunk).unwrap();
  const [selectClient, setSelectClient] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [tempSelectedAgent, setTempSelectedAgent] = useState("");
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [agents, setAgents] = useState([]);
  const [customItem, setCustomItem] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [orderDiscountValue, setOrderDiscountValue] = useState("");
  const [orderDiscountMode, setOrderDiscountMode] = useState("amount");
  const [receiptWithCheck, setReceiptWithCheck] = useState(true);
  const [selectedBank, setSelectedBank] = useState("");
  const [debtInitialPayment, setDebtInitialPayment] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState(getTodayIsoDate());

  // Количество товаров для таблицы
  const [itemQuantities, setItemQuantities] = useState({});
  const [cartPrices, setCartPrices] = useState({});
  const [cartDiscounts, setCartDiscounts] = useState({});
  const [cartDiscountModes, setCartDiscountModes] = useState({});

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(() => {
    if (isPilorama) {
      return (agentCart.items || []).find((i) => i.id === selectedId) || null;
    } else {
      return (start?.items || []).find((i) => i.id === selectedId) || null;
    }
  }, [isPilorama, agentCart.items, start?.items, selectedId]);

  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "client",
      ),
    [clients],
  );
  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId],
  );

  const [qty, setQty] = useState("");

  useEffect(() => {
    if (selectedItem) setQty(String(selectedItem.quantity ?? ""));
    else setQty("");
  }, [selectedItem]);

  const debouncedDiscount = useDebounce((v) => {
    if (isPilorama && selectedItem) {
      dispatch(
        updateAgentCartItemQuantity({
          cartId: agentCart.currentCart?.id,
          itemId: selectedItem.id,
          discount_total: v,
        }),
      );
    } else if (isMarketPosMode && selectedItem && start?.id) {
      dispatch(
        updateProductInCart({
          id: start.id,
          productId: selectedItem.product ?? selectedItem.product_id ?? selectedItem.id,
          data: { discount_total: v },
        }),
      ).then(() => {
        dispatch(getSale({ id: start.id }));
      });
    } else {
      dispatch(
        manualFillingInAgent({
          id: start.id,
          productId: selectedItem.id,
          discount_total: v,
          quantity: 2,
        }),
      );
    }
  }, 600);

  const onProductDiscountChange = (e) => debouncedDiscount(e.target.value);

  const loadMainProducts = async (params = {}) => {
    try {
      const { data } = await api.get("/main/products/list/", { params });
      setCatalogProducts(normalizeCatalogProducts(data));
    } catch (e) {
      const errorMessage = validateResErrors(
        e,
        "Ошибка при загрузке списка товаров",
      );
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const debouncedSearch = useDebounce((v) => {
    if (useMainProductsList && !isPilorama) {
      loadMainProducts(v ? { search: v } : {});
      return;
    }
    dispatch(doSearchInAgent({ search: v }));
  }, 600);

  const onChange = (e) => debouncedSearch(e.target.value);
  const debouncedDiscount1 = useDebounce(({ value, mode, subtotal }) => {
    const discountTotal = getDiscountAmountByMode({
      subtotal,
      value,
      mode,
    }).toFixed(2);
    if (isMarketPosMode) {
      if (mode === "percent") {
        dispatch(startSale({ order_discount_percent: Math.max(0, toNum(value)) }));
      } else {
        dispatch(startSale({ order_discount_total: discountTotal }));
      }
      return;
    }
    if (isPilorama) {
      dispatch(
        getAgentCart({
          order_discount_total: discountTotal,
          ...(selectedAgent ? { agent: selectedAgent } : {}),
        }),
      );
      return;
    }
    dispatch(startSaleInAgent(discountTotal));
    dispatch(getAgentCart({ order_discount_total: discountTotal }));
  }, 600);

  const onDiscountChange = (e) => {
    const nextValue = e.target.value;
    setOrderDiscountValue(nextValue);
    debouncedDiscount1({
      value: nextValue,
      mode: orderDiscountMode,
      subtotal: currentSubtotal,
    });
  };

  const onRefresh = () => {
    if (isPilorama) {
      if (selectedAgent) {
        dispatch(
          getAgentCart({ agent: selectedAgent, order_discount_total: "0.00" }),
        );
      }
    } else if (isMarketPosMode) {
      if (start?.id) {
        dispatch(getSale({ id: start.id }));
      } else {
        dispatch(startSale());
      }
    } else {
      dispatch(startSaleInAgent());
    }
  };

  const initializeAgentCart = async () => {
    if (!tempSelectedAgent) {
      setAlert({
        open: true,
        type: "error",
        message: "Выберите агента для начала работы",
      });
      return;
    }
    try {
      await dispatch(
        startAgentCart({
          agent: tempSelectedAgent,
          order_discount_total: "0.00",
        }),
      ).unwrap();
      setSelectedAgent(tempSelectedAgent);
      setShowAgentModal(false);
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при создании корзины агента",
      );
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) {
      setAlert({
        open: true,
        type: "error",
        message: "Введите штрих-код товара",
      });
      return;
    }
    if (!isPilorama || !agentCart.currentCart?.id) {
      setAlert({
        open: true,
        type: "error",
        message: "Корзина агента не инициализирована",
      });
      return;
    }
    try {
      await dispatch(
        scanProductInCart({
          cartId: agentCart.currentCart.id,
          barcode: barcodeInput.trim(),
          quantity: 1,
          agent: selectedAgent,
        }),
      ).unwrap();
      setBarcodeInput("");
      onRefresh();
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при сканировании товара",
      );
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  const handleAddCustomItem = async () => {
    if (!customItem.name.trim() || !customItem.price.trim()) {
      setAlert({
        open: true,
        type: "error",
        message: "Заполните все обязательные поля",
      });
      return;
    }
    if (isMarketPosMode && start?.id) {
      try {
        await dispatch(
          addCustomItem({
            id: start.id,
            name: customItem.name.trim(),
            price: customItem.price.trim(),
            quantity: Number(customItem.quantity) || 1,
          }),
        ).unwrap();
        setCustomItem({ name: "", price: "", quantity: "1" });
        setShowCustomItemModal(false);
        onRefresh();
        setAlert({
          open: true,
          type: "success",
          message: "Кастомная позиция добавлена в корзину",
        });
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при добавлении кастомной позиции",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
      return;
    }
    if (!isPilorama || !agentCart.currentCart?.id) {
      setAlert({
        open: true,
        type: "error",
        message: "Корзина агента не инициализирована",
      });
      return;
    }
    try {
      await dispatch(
        addCustomItemToAgentCart({
          cartId: agentCart.currentCart.id,
          name: customItem.name.trim(),
          price: customItem.price.trim(),
          quantity: Number(customItem.quantity) || 1,
        }),
      ).unwrap();
      setCustomItem({ name: "", price: "", quantity: "1" });
      setShowCustomItemModal(false);
      onRefresh();
      setAlert({
        open: true,
        type: "success",
        message: "Кастомная позиция добавлена в корзину",
      });
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Ошибка при добавлении кастомной позиции",
      );
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    if (isPilorama) {
      setShowAgentModal(true);
    } else if (useMainProductsList) {
      loadMainProducts();
    } else {
      dispatch(doSearchInAgent());
    }
  }, [dispatch, isPilorama, useMainProductsList]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
        setCashData((prev) => ({ ...prev, cashbox: firstCashBoxId }));
      }
    }
  }, [cashBoxes, selectCashBox]);

  useEffect(() => {
    api
      .get("/main/owners/agents/products/")
      .then(({ data }) => setAgentListProducts(data))
      .catch((e) => {
        const errorMessage = validateResErrors(
          e,
          "Ошибка при загрузке товаров агента",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      });
  }, [show]);

  useEffect(() => {
    if (isPilorama) {
      api
        .get("/main/owners/agents/products/")
        .then(({ data }) => setAgents(data))
        .catch((e) => {
          const errorMessage = validateResErrors(
            e,
            "Ошибка при загрузке товаров агента",
          );
          setAlert({
            open: true,
            type: "error",
            message: errorMessage,
          });
        });
    }
  }, [isPilorama]);

  // Автоподключение USB при монтировании (как в SellDetail)
  useEffect(() => {
    attachUsbListenersOnce();
    ensureUsbReadyAuto().catch(() => {});
  }, []);

  const handleRowClick = (item) => {
    setSelectedId(item.id);
  };

  // Функции для работы с товарами в таблице
  const handleIncreaseQty = async (item) => {
    if (isPilorama) {
      if (!agentCart.currentCart?.id) return;
      try {
        await dispatch(
          updateAgentCartItemQuantity({
            cartId: agentCart.currentCart.id,
            itemId: item.id,
            quantity: (Number(item.quantity) || 0) + 1,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при увеличении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else if (isMarketPosMode) {
      if (!start?.id) return;
      try {
        await dispatch(
          updateManualFilling({
            id: start.id,
            productId: item.product ?? item.product_id ?? item.id,
            quantity: (Number(item.quantity) || 0) + 1,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при увеличении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else {
      if (!start?.id) return;
      try {
        await dispatch(
          manualFillingInAgent({
            id: start.id,
            productId: item.product || item.id,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при уменьшении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    }
  };

  const handleDecreaseQty = async (item) => {
    if (isPilorama) {
      if (!agentCart.currentCart?.id) return;
      const currentQty = Number(item.quantity) || 0;
      const next = Math.max(0, currentQty - 1);
      if (next === 0) {
        await handleRemoveItem(item);
        return;
      }
      try {
        await dispatch(
          updateAgentCartItemQuantity({
            cartId: agentCart.currentCart.id,
            itemId: item.id,
            quantity: next,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при уменьшении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else if (isMarketPosMode) {
      if (!start?.id) return;
      const currentQty = Number(item.quantity) || 0;
      const next = Math.max(0, currentQty - 1);
      try {
        if (next === 0) {
          await dispatch(
            deleteProductInCart({
              id: start.id,
              productId: item.product ?? item.product_id ?? item.id,
            }),
          ).unwrap();
        } else {
          await dispatch(
            updateManualFilling({
              id: start.id,
              productId: item.product ?? item.product_id ?? item.id,
              quantity: next,
            }),
          ).unwrap();
        }
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при уменьшении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else {
      if (!start?.id) return;
      const currentQty = Number(item.quantity) || 0;
      const next = Math.max(0, currentQty - 1);
      try {
        await dispatch(
          updateManualFillingInAgent({
            id: start.id,
            productId: item.id,
            quantity: next,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при уменьшении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    }
  };

  const handleRemoveItem = async (item) => {
    if (isPilorama) {
      if (!agentCart.currentCart?.id) return;
      try {
        await dispatch(
          removeItemFromAgentCart({
            cartId: agentCart.currentCart.id,
            itemId: item.id,
          }),
        ).unwrap();
        onRefresh();
        if (selectedId === item.id) {
          setSelectedId(null);
        }
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при удалении товара",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else if (isMarketPosMode) {
      if (!start?.id) return;
      try {
        await dispatch(
          deleteProductInCart({
            id: start.id,
            productId: item.product ?? item.product_id ?? item.id,
          }),
        ).unwrap();
        onRefresh();
        if (selectedId === item.id) {
          setSelectedId(null);
        }
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при удалении товара",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else {
      // Для не-Pilorama нет функции удаления, только обнуление количества
      if (!start?.id) return;
      try {
        await dispatch(
          updateManualFillingInAgent({
            id: start.id,
            productId: item.id,
            quantity: 0,
          }),
        ).unwrap();
        onRefresh();
        if (selectedId === item.id) {
          setSelectedId(null);
        }
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при удалении товара",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    }
  };

  // Обработчик изменения количества через инпут
  const handleItemQtyChange = (item, value) => {
    setItemQuantities((prev) => ({
      ...prev,
      [item.id]: value,
    }));
  };

  // Обработчик потери фокуса инпута количества
  const handleItemQtyBlur = async (item) => {
    if (isPilorama) {
      if (!agentCart.currentCart?.id) return;
      const inputValue = itemQuantities[item.id] || "";
      let qtyNum;
      if (inputValue === "" || inputValue === "0") {
        qtyNum = item.quantity || 0;
      } else {
        qtyNum = Math.max(0, toNum(inputValue));
      }
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(qtyNum),
      }));
      if (qtyNum === 0) {
        await handleRemoveItem(item);
        return;
      }
      try {
        await dispatch(
          updateAgentCartItemQuantity({
            cartId: agentCart.currentCart.id,
            itemId: item.id,
            quantity: qtyNum,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при обновлении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else if (isMarketPosMode) {
      if (!start?.id) return;
      const inputValue = itemQuantities[item.id] || "";
      let qtyNum;
      if (inputValue === "" || inputValue === "0") {
        qtyNum = item.quantity || 0;
      } else {
        qtyNum = Math.max(0, toNum(inputValue));
      }
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(qtyNum),
      }));
      if (qtyNum === 0) {
        await handleRemoveItem(item);
        return;
      }
      try {
        await dispatch(
          updateManualFilling({
            id: start.id,
            productId: item.product ?? item.product_id ?? item.id,
            quantity: qtyNum,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при обновлении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    } else {
      if (!start?.id) return;
      const inputValue = itemQuantities[item.id] || "";
      let qtyNum;
      if (inputValue === "" || inputValue === "0") {
        qtyNum = item.quantity || 0;
      } else {
        qtyNum = Math.max(0, toNum(inputValue));
      }
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(qtyNum),
      }));
      if (qtyNum === 0) {
        await handleRemoveItem(item);
        return;
      }
      try {
        await dispatch(
          updateManualFillingInAgent({
            id: start.id,
            productId: item.id,
            quantity: qtyNum,
          }),
        ).unwrap();
        onRefresh();
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка при обновлении количества",
        );
        setAlert({
          open: true,
          type: "error",
          message: errorMessage,
        });
      }
    }
  };

  const patchCartItemPrice = async (item, value) => {
    if (!isMarketPosMode || !start?.id) return;
    const productId = item.product ?? item.product_id ?? item.id;
    const num = Math.max(0, toNum(value));
    try {
      await dispatch(
        updateProductInCart({
          id: start.id,
          productId,
          data: { unit_price: num.toFixed(2) },
        }),
      ).unwrap();
      setCartPrices((prev) => ({
        ...prev,
        [item.id]: formatInputDecimal(num),
      }));
      onRefresh();
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Не удалось изменить цену",
      );
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
      setCartPrices((prev) => ({
        ...prev,
        [item.id]: formatInputDecimal(item.unit_price ?? item.price ?? 0),
      }));
    }
  };

  const patchCartItemDiscount = async (item, value, options = {}) => {
    const { mode = "amount", displayValue } = options;
    if (!isMarketPosMode || !start?.id) return;
    const productId = item.product ?? item.product_id ?? item.id;
    const lineTotal = previewCartMetrics.byId[item.id]?.lineTotal ??
      toNum(item.unit_price ?? item.price) * toNum(item.quantity);
    const discountAmount =
      mode === "percent"
        ? clampDiscountAmount(lineTotal, (lineTotal * Math.max(0, toNum(value))) / 100)
        : clampDiscountAmount(lineTotal, value);
    try {
      await dispatch(
        updateProductInCart({
          id: start.id,
          productId,
          data: { discount_total: discountAmount.toFixed(2) },
        }),
      ).unwrap();
      setCartDiscounts((prev) => ({
        ...prev,
        [item.id]:
          mode === "percent"
            ? displayValue ?? trimTrailingZeros(String(value))
            : discountAmount > 0
              ? formatInputDecimal(discountAmount)
              : "",
      }));
      onRefresh();
    } catch (error) {
      const errorMessage = validateResErrors(
        error,
        "Не удалось изменить скидку",
      );
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
      setCartDiscounts((prev) => ({
        ...prev,
        [item.id]: toNum(item.discount_total ?? item.discountTotal) > 0
          ? formatInputDecimal(item.discount_total ?? item.discountTotal)
          : "",
      }));
      setCartDiscountModes((prev) => ({
        ...prev,
        [item.id]: "amount",
      }));
    }
  };

  // Старые функции для обратной совместимости (если используются где-то еще)
  const incQty = () => {
    if (!selectedItem) return;
    const newQty = (toNum(qty) || 0) + 1;
    setQty(String(newQty));

    if (isPilorama) {
      dispatch(
        updateAgentCartItemQuantity({
          cartId: agentCart.currentCart?.id,
          itemId: selectedItem.id,
          quantity: newQty,
        }),
      );
    } else {
      dispatch(
        manualFillingInAgent({ id: start.id, productId: selectedItem.product }),
      );
    }
    onRefresh();
  };

  const decQty = () => {
    if (!selectedItem) return;
    const next = Math.max(0, (toNum(qty) || 0) - 1);
    setQty(String(next));

    if (isPilorama) {
      if (next === 0) {
        dispatch(
          removeItemFromAgentCart({
            cartId: agentCart.currentCart?.id,
            itemId: selectedItem.id,
          }),
        );
      } else {
        dispatch(
          updateAgentCartItemQuantity({
            cartId: agentCart.currentCart?.id,
            itemId: selectedItem.id,
            quantity: next,
          }),
        );
      }
    } else {
      dispatch(
        updateManualFillingInAgent({
          id: start.id,
          productId: selectedItem.id,
          quantity: next,
        }),
      );
    }
    onRefresh();
  };

  const validate = (f) => {
    const e = {};
    if (!f.full_name.trim()) e.full_name = "Это поле не может быть пустым.";
    const ph = f.phone.trim();
    if (!ph) e.phone = "Это поле не может быть пустым.";
    else if (!/^\+?\d[\d\s\-()]{5,}$/.test(ph))
      e.phone = "Неверный формат телефона.";
    return e;
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name] || submitTried) {
      const ve = validate(next);
      setErrors(ve);
    }
  };
  const handleBlur = (e) => {
    const { name } = e.target;
    const nextTouched = { ...touched, [name]: true };
    setTouched(nextTouched);
    setErrors(validate(form));
  };

  const filterData = isPilorama
    ? agentListProducts?.products
    : useMainProductsList
      ? catalogProducts
      : products;
  const currentCart = isPilorama ? agentCart.currentCart : start;
  const currentItems = isPilorama ? agentCart.items : start?.items || [];
  const currentSubtotal = isPilorama ? agentCart.subtotal : start?.subtotal;
  const currentDiscount = isPilorama
    ? agentCart.order_discount_total
    : start?.order_discount_total;
  const currentTotal = isPilorama ? agentCart.total : start?.total;
  const currentDiscountNumber = toNum(currentDiscount);
  const currentDiscountPercent = isMarketPosMode
    ? Math.max(0, toNum(start?.order_discount_percent))
    : 0;

  const previewCartMetrics = useMemo(() => {
    const byId = {};
    let baseSubtotal = 0;
    let lineDiscountTotal = 0;

    currentItems.forEach((item) => {
      const itemId = item.id;
      const rawQty = itemQuantities[itemId];
      const rawPrice = cartPrices[itemId];
      const rawDiscount = cartDiscounts[itemId];
      const discountMode = cartDiscountModes[itemId] || "amount";

      const quantity =
        rawQty === undefined || rawQty === "" || rawQty === "-"
          ? toNum(item.quantity)
          : Math.max(0, toNum(rawQty));
      const price =
        rawPrice === undefined || rawPrice === "" || rawPrice === "-"
          ? toNum(item.unit_price ?? item.price)
          : Math.max(0, toNum(rawPrice));
      const lineTotal = price * quantity;

      let discountAmount = 0;
      if (rawDiscount === undefined) {
        discountAmount = clampDiscountAmount(
          lineTotal,
          item.discount_total ?? item.discountTotal ?? 0,
        );
      } else if (rawDiscount === "" || rawDiscount === "-") {
        discountAmount = 0;
      } else if (discountMode === "percent") {
        discountAmount = clampDiscountAmount(
          lineTotal,
          (lineTotal * Math.max(0, toNum(rawDiscount))) / 100,
        );
      } else {
        discountAmount = clampDiscountAmount(lineTotal, rawDiscount);
      }

      const lineNet = Math.max(0, lineTotal - discountAmount);
      baseSubtotal += lineTotal;
      lineDiscountTotal += discountAmount;
      byId[itemId] = {
        quantity,
        price,
        lineTotal,
        discountAmount,
        lineNet,
      };
    });

    const subtotalAfterLineDiscounts = Math.max(0, baseSubtotal - lineDiscountTotal);
    const orderDiscountAmount =
      orderDiscountValue === ""
        ? isMarketPosMode && currentDiscountPercent > 0
          ? getDiscountAmountByMode({
              subtotal: subtotalAfterLineDiscounts,
              value: currentDiscountPercent,
              mode: "percent",
            })
          : clampDiscountAmount(subtotalAfterLineDiscounts, currentDiscountNumber)
        : getDiscountAmountByMode({
            subtotal: subtotalAfterLineDiscounts,
            value: orderDiscountValue,
            mode: orderDiscountMode,
          });

    return {
      byId,
      baseSubtotal,
      lineDiscountTotal,
      orderDiscountAmount,
      totalDiscount: lineDiscountTotal + orderDiscountAmount,
      total: Math.max(0, subtotalAfterLineDiscounts - orderDiscountAmount),
    };
  }, [
    cartDiscountModes,
    cartDiscounts,
    cartPrices,
    currentDiscountNumber,
    currentDiscountPercent,
    currentItems,
    isMarketPosMode,
    itemQuantities,
    orderDiscountMode,
    orderDiscountValue,
  ]);

  const subtotalNumber = previewCartMetrics.baseSubtotal;
  const displayDiscount = previewCartMetrics.totalDiscount;
  const displayTotal = previewCartMetrics.total;
  const previewDiscountAmount = previewCartMetrics.orderDiscountAmount;

  useEffect(() => {
    if (isMarketPosMode && currentDiscountPercent > 0) {
      setOrderDiscountMode("percent");
      setOrderDiscountValue(String(start?.order_discount_percent ?? ""));
      return;
    }
    setOrderDiscountMode("amount");
    setOrderDiscountValue(
      currentDiscountNumber > 0 ? String(currentDiscountNumber) : "",
    );
  }, [
    currentDiscountNumber,
    currentDiscountPercent,
    isMarketPosMode,
    start?.order_discount_percent,
  ]);

  const handleOrderDiscountModeChange = (nextMode) => {
    if (nextMode === orderDiscountMode) return;
    const nextValue =
      orderDiscountValue === ""
        ? ""
        : nextMode === "percent"
          ? subtotalNumber > 0
            ? ((previewDiscountAmount / subtotalNumber) * 100).toFixed(2)
            : ""
          : previewDiscountAmount > 0
            ? previewDiscountAmount.toFixed(2)
            : "";
    setOrderDiscountMode(nextMode);
    setOrderDiscountValue(nextValue);
    debouncedDiscount1({
      value: nextValue,
      mode: nextMode,
      subtotal: currentSubtotal,
    });
  };

  // Инициализация локальных значений количества для элементов таблицы
  useEffect(() => {
    const items = currentItems || [];
    const quantities = {};
    items.forEach((item) => {
      quantities[item.id] = String(item.quantity ?? "");
    });
    setItemQuantities(quantities);
  }, [currentItems]);

  useEffect(() => {
    const items = currentItems || [];
    setCartPrices((prev) => {
      const next = {};
      items.forEach((item) => {
        next[item.id] =
          prev[item.id] ?? formatInputDecimal(item.unit_price ?? item.price ?? 0);
      });
      return next;
    });
    setCartDiscountModes((prev) => {
      const next = {};
      items.forEach((item) => {
        next[item.id] = prev[item.id] || "amount";
      });
      return next;
    });
    setCartDiscounts((prev) => {
      const next = {};
      items.forEach((item) => {
        if (prev[item.id] !== undefined) {
          next[item.id] = prev[item.id];
        } else {
          const discount = toNum(item.discount_total ?? item.discountTotal);
          next[item.id] = discount > 0 ? formatInputDecimal(discount) : "";
        }
      });
      return next;
    });
  }, [currentItems]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitTried(true);
    const ve = validate(form);
    setErrors(ve);
    if (Object.keys(ve).length) return;
    try {
      await dispatch(createClientAsync(form)).unwrap();
      setAlert({
        open: true,
        type: "success",
        message: "Клиент успешно добавлен!",
      });
      dispatch(fetchClientsAsync());
      setShowNewClientModal(false);
      setForm({
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
      setTouched({});
      setSubmitTried(false);
      setErrors({});
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка при создании клиента");
      setAlert({
        open: true,
        type: "error",
        message: errorMessage,
      });
    }
  };

  // === Checkout + МГНОВЕННАЯ ПЕЧАТЬ В ПРИНТЕР ===
  const performCheckout = async (withReceipt) => {
    try {
      // Дополнительная проверка кассы перед выполнением операции
      if (!cashData.cashbox) {
        setAlert({
          open: true,
          type: "error",
          message: "Касса не выбрана. Создайте кассу в разделе «Кассы».",
        });
        return;
      }

      const itemsToCheck = isPilorama ? currentItems : start?.items;
      if (itemsToCheck?.length === 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Добавьте товар для проведения операции",
        });
        return;
      }

      if (debt && !clientId) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите клиента для долговой операции",
        });
        return;
      }

      if (debt === "Предоплата") {
        if (!amount || Number(amount) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректную сумму предоплаты",
          });
          return;
        }
        const totalToCheck = isPilorama ? currentTotal : start?.total;
        if (Number(amount) > Number(totalToCheck)) {
          setAlert({
            open: true,
            type: "error",
            message: "Сумма предоплаты не может превышать общую сумму",
          });
          return;
        }
        const termDays = countCalendarDaysFromToday(debtDueDate);
        if (!debtDueDate || !Number.isFinite(termDays) || termDays < 1) {
          setAlert({
            open: true,
            type: "error",
            message:
              "Укажите дату окончания срока долга (не раньше завтра, минимум 1 день)",
          });
          return;
        }
      }

      if (debt === "Долги") {
        const termDays = countCalendarDaysFromToday(debtDueDate);
        if (!debtDueDate || !Number.isFinite(termDays) || termDays < 1) {
          setAlert({
            open: true,
            type: "error",
            message:
              "Укажите дату окончания срока долга (не раньше завтра, минимум 1 день)",
          });
          return;
        }
      }

      if (clientId) {
        const totalForDeal = isPilorama ? currentTotal : start?.total;
        const termDaysForDeal =
          debt === "Долги" || debt === "Предоплата"
            ? countCalendarDaysFromToday(debtDueDate)
            : NaN;
        await dispatch(
          createDeal({
            clientId: clientId,
            title: `${debt || "Продажа"} ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalForDeal,
            prepayment: debt === "Предоплата" ? Number(amount) : undefined,
            debtDays:
              debt === "Долги" || debt === "Предоплата"
                ? termDaysForDeal
                : undefined,
          }),
        ).unwrap();
      }

      let result;
      if (isPilorama) {
        result = await run(
          checkoutAgentCart({
            cartId: agentCart.currentCart?.id,
            print_receipt: withReceipt,
            client_id: clientId,
            agent: selectedAgent,
          }),
        );
      } else if (isMarketPosMode) {
        result = await run(
          productCheckout({
            id: start?.id,
            bool: withReceipt,
            clientId: clientId,
          }),
        );
      } else {
        result = await run(
          productCheckoutInAgent({
            id: start?.id,
            bool: withReceipt,
            clientId: clientId,
          }),
        );
      }

      const amountForCash =
        debt === "Предоплата"
          ? amount
          : isPilorama
            ? currentTotal
            : start.total;

      if (debt !== "Долги") {
        await run(
          addCashFlows({
            ...cashData,
            name: cashData.name === "" ? "Продажа" : cashData.name,
            amount: amountForCash,
            source_cashbox_flow_id: result?.id,
          }),
        );
      }

      setShow(false);

      // Если надо печатать — получаем чек и шлём в принтер через WebUSB
      if (withReceipt && (result?.sale_id || start?.id)) {
        try {
          const resp = await run(getProductCheckout(result?.sale_id || start?.id));
          await handleCheckoutResponseForPrinting(resp);
        } catch (e) {
          console.error("Печать чека не удалась:", e);
          alert(
            "Не удалось распечатать чек. Проверьте WinUSB и формат ответа (JSON/PDF).",
          );
        }
      }

      setAlert({
        open: true,
        type: "success",
        message: "Операция успешно выполнена!",
      });
    } catch (e) {
      setAlert({
        open: true,
        type: "error",
        message: `Что то пошло не так.\n\n${
          e?.data?.detail
            ?.replace("у агента:", "товара")
            ?.replace("Нужно 2, доступно 0.", "") ||
          e?.message ||
          ""
        }`,
      });
    }
  };

  const handleMarketPosPayment = async () => {
    if (isPilorama) {
      if (!agentCart.currentCart?.id) return;
    } else if (!start?.id) {
      return;
    }
    if (!cashData.cashbox) {
      setAlert({
        open: true,
        type: "error",
        message: "Касса не выбрана. Создайте кассу в разделе «Кассы».",
      });
      return;
    }
    if (!currentItems?.length) {
      setAlert({
        open: true,
        type: "error",
        message: "Добавьте товар для проведения операции",
      });
      return;
    }

    const totalNumber = Number(currentTotal || 0);
    const initialPaymentNumber = Number(
      String(debtInitialPayment || "0")
        .replace(/\s/g, "")
        .replace(/,/g, "."),
    );

    if (paymentMethod === "debt") {
      if (!clientId) {
        setAlert({
          open: true,
          type: "error",
          message: "Для оформления долга выберите клиента",
        });
        return;
      }
      const termDays = countCalendarDaysFromToday(debtDueDate);
      if (!debtDueDate || !Number.isFinite(termDays) || termDays < 1) {
        setAlert({
          open: true,
          type: "error",
          message:
            "Укажите дату окончания срока долга (не раньше завтра, минимум 1 день)",
        });
        return;
      }
      if (!firstPaymentDate) {
        setAlert({
          open: true,
          type: "error",
          message: "Укажите дату первой оплаты",
        });
        return;
      }
      if (initialPaymentNumber < 0 || initialPaymentNumber > totalNumber) {
        setAlert({
          open: true,
          type: "error",
          message: "Первоначальная оплата указана неверно",
        });
        return;
      }
    }

    if (paymentMethod === "cashless" && !selectedBank) {
      setAlert({
        open: true,
        type: "error",
        message: "Выберите банк для безналичной оплаты",
      });
      return;
    }

    try {
      const supportedBanks = ["mbank", "optima", "obank", "bakai"];
      const paymentMethodApi =
        paymentMethod === "cash"
          ? "cash"
          : paymentMethod === "cashless"
            ? supportedBanks.includes(selectedBank)
              ? selectedBank
              : "transfer"
            : "debt";

      const cashReceivedValue =
        paymentMethod === "cash"
          ? totalNumber
          : paymentMethod === "debt"
            ? totalNumber
            : null;

      let result;
      if (isPilorama) {
        result = await run(
          checkoutAgentCart({
            cartId: agentCart.currentCart.id,
            print_receipt: receiptWithCheck,
            client_id: clientId || null,
            agent: selectedAgent || undefined,
            payment_method: paymentMethodApi,
            ...(cashReceivedValue != null
              ? { cash_received: cashReceivedValue }
              : {}),
          }),
        );
      } else {
        result = await run(
          productCheckout({
            id: start.id,
            bool: receiptWithCheck,
            clientId: clientId || null,
            payment_method: paymentMethodApi,
            cash_received: cashReceivedValue,
          }),
        );
      }

      if (paymentMethod === "debt" && clientId) {
        const initialPaid = Math.max(0, initialPaymentNumber || 0);
        const remainingDebt = Math.max(0, totalNumber - initialPaid);
        const debtTermDays = countCalendarDaysFromToday(debtDueDate);

        try {
          if (
            company?.subscription_plan?.name === "Старт" &&
            remainingDebt > 0
          ) {
            await api.post("/main/debts/", {
              name: pickClient?.full_name || pickClient?.name || "Клиент",
              phone: pickClient?.phone || "",
              due_date: firstPaymentDate,
              amount: remainingDebt.toFixed(2),
            });
          }

          await dispatch(
            createDeal({
              clientId,
              title: `${initialPaid > 0 ? "Предоплата" : "Долги"} ${pickClient?.full_name || "Клиент"}`,
              statusRu: initialPaid > 0 ? "Предоплата" : "Долги",
              amount: totalNumber,
              prepayment: initialPaid > 0 ? initialPaid : undefined,
              debtDays: debtTermDays,
              first_due_date: firstPaymentDate,
            }),
          ).unwrap();
        } catch (debtError) {
          const errorMessage = validateResErrors(
            debtError,
            "Оплата оформлена, но долг зарегистрировать не удалось",
          );
          setAlert({
            open: true,
            type: "error",
            message: errorMessage,
          });
        }
      }

      const cashFlowAmount =
        paymentMethod === "debt"
          ? Math.max(0, initialPaymentNumber || 0)
          : totalNumber;

      if (cashFlowAmount > 0) {
        await run(
          addCashFlows({
            ...cashData,
            cashbox: selectCashBox || cashData.cashbox,
            type: "income",
            name: cashData.name === "" ? "Продажа" : cashData.name,
            amount: cashFlowAmount,
            source_cashbox_flow_id: result?.sale_id || result?.id,
            source_business_operation_id:
              cashData.source_business_operation_id || "Продажа производство",
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          }),
        );
      }

      setShowPaymentModal(false);
      setShow(false);

      const saleIdForReceipt =
        result?.sale_id || result?.id || (!isPilorama ? start?.id : null);
      if (receiptWithCheck && saleIdForReceipt) {
        try {
          const resp = await run(getProductCheckout(saleIdForReceipt));
          await handleCheckoutResponseForPrinting(resp);
        } catch (e) {
          console.error("Печать чека не удалась:", e);
        }
      }

      setAlert({
        open: true,
        type: "success",
        message: "Оплата успешно проведена",
      });
    } catch (e) {
      setAlert({
        open: true,
        type: "error",
        message:
          e?.data?.detail || e?.message || "Не удалось провести оплату",
      });
    }
  };

  const openPaymentModal = () => {
    setPaymentMethod("cash");
    setReceiptWithCheck(true);
    setSelectedBank("");
    setDebtInitialPayment("");
    setFirstPaymentDate(getTodayIsoDate());
    setShowMobileCart(false);
    setShowPaymentModal(true);
  };

  useEffect(() => {
    if (currentItems.length === 0) {
      setShowMobileCart(false);
    }
  }, [currentItems.length]);

  useEffect(() => {
    if (!showMobileCart) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showMobileCart]);

  const handleCatalogProductAdd = async (product) => {
    if (isPilorama) {
      await dispatch(
        addProductToAgentCart({
          cartId: agentCart.currentCart?.id,
          product_id: product.product,
          quantity: 1,
          agent: selectedAgent,
        }),
      ).unwrap();
      onRefresh();
      return;
    }

    if (isMarketPosMode) {
      if (!start?.id) return;
      const productId = product.product ?? product.id;
      const existingItem = currentItems.find(
        (item) =>
          String(item.product ?? item.product_id ?? item.id) ===
          String(productId),
      );

      if (existingItem) {
        await dispatch(
          updateManualFilling({
            id: start.id,
            productId,
            quantity: (Number(existingItem.quantity) || 0) + 1,
          }),
        ).unwrap();
      } else {
        await dispatch(
          manualFilling({
            id: start.id,
            productId,
            quantity: 1,
          }),
        ).unwrap();
      }
      onRefresh();
      return;
    }

    await dispatch(
      manualFillingInAgent({
        id: start.id,
        productId: product.product,
      }),
    ).unwrap();
    dispatch(startSaleInAgent());
  };

  const getCartQuantityByProduct = (productId) => {
    const cartItem = currentItems.find(
      (item) => String(item.product ?? item.id) === String(productId),
    );
    return Number(cartItem?.quantity || 0);
  };

  const selectedClientName =
    filterClient.find((client) => String(client.id) === String(clientId))
      ?.full_name || "Клиент не выбран";

  if (useMainProductsList) {
    return (
      <div
        className={`cashier-page sellstart-cashier${
          showMobileCart ? " sellstart-cashier--cart-open" : ""
        }`}
      >
        <div className="cashier-page__header">
          <div className="cashier-page__header-left">
            <button
              type="button"
              className="cashier-page__back-btn"
              onClick={() => setShow(false)}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="cashier-page__title">Продажа</h1>
              <p className="cashier-page__subtitle">
                {selectedClientName} • Позиций: {currentItems.length}
              </p>
            </div>
          </div>
          <div className="cashier-page__header-right" />
        </div>

        <div className="cashier-page__content">
          <div className="cashier-page__products">
            <div className="cashier-page__search">
              <Search size={20} />
              <input
                type="text"
                placeholder="Поиск товаров..."
                onChange={onChange}
                className="cashier-page__search-input"
              />
            </div>

            <div className="cashier-page__products-grid">
              {filterData?.length ? (
                filterData.map((product) => {
                  const cartQty = getCartQuantityByProduct(product.product);
                  return (
                    <div
                      key={product.product}
                      className={`cashier-page__product-card ${
                        cartQty > 0
                          ? "cashier-page__product-card--selected"
                          : ""
                      }`}
                      onClick={() => handleCatalogProductAdd(product)}
                    >
                      {cartQty > 0 && (
                        <div className="cashier-page__product-badge">{cartQty}</div>
                      )}
                      <div className="cashier-page__product-name">
                        {product.product_name || "—"}
                      </div>
                      <div className="cashier-page__product-price">
                        {formatSom(product.price || product.unit_price)} сом
                      </div>
                      <div className="cashier-page__product-stock">
                        Остаток:{" "}
                        {product.quantity ??
                          product.qty_on_hand ??
                          product.stock ??
                          0}{" "}
                        {product.unit || "шт"}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="cashier-page__products-empty">
                  Товары не найдены
                </div>
              )}
            </div>
          </div>

          <div className="cashier-page__cart sellstart-cashier__cart-panel">
            <div className="cashier-page__cart-header">
              <h2 className="cashier-page__cart-title">Корзина</h2>
              <button
                type="button"
                className="sellstart-cashier__mobile-cart-close"
                onClick={() => setShowMobileCart(false)}
                aria-label="Закрыть корзину"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cashier-page__cart-actions sellstart-cashier__cart-actions">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >
                <button
                  type="button"
                  className="cashier-page__cart-action-btn"
                  style={{
                    padding: "6px 10px",
                    minHeight: "auto",
                    background:
                      orderDiscountMode === "amount" ? "#f7d74f" : "#fff",
                  }}
                  onClick={() => handleOrderDiscountModeChange("amount")}
                >
                  сом
                </button>
                <button
                  type="button"
                  className="cashier-page__cart-action-btn"
                  style={{
                    padding: "6px 10px",
                    minHeight: "auto",
                    background:
                      orderDiscountMode === "percent" ? "#f7d74f" : "#fff",
                  }}
                  onClick={() => handleOrderDiscountModeChange("percent")}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                className="sellstart-cashier__discount-input"
                placeholder={
                  orderDiscountMode === "percent"
                    ? "Общая скидка, %"
                    : "Общая скидка, сом"
                }
                value={orderDiscountValue}
                onChange={onDiscountChange}
              />
              {isPilorama && (
                <button
                  type="button"
                  className="cashier-page__cart-action-btn"
                  onClick={() => setShowCustomItemModal(true)}
                >
                  Кастомная позиция
                </button>
              )}
            </div>

            <div className="cashier-page__cart-items">
              {currentItems.length === 0 ? (
                <div className="cashier-page__cart-empty">
                  Корзина пока пустая
                </div>
              ) : (
                currentItems.map((item) => {
                  const previewItem = previewCartMetrics.byId[item.id] || {
                    quantity: toNum(item.quantity),
                    price: toNum(item.unit_price ?? item.price),
                    lineTotal:
                      toNum(item.unit_price ?? item.price) * toNum(item.quantity),
                    discountAmount: clampDiscountAmount(
                      toNum(item.unit_price ?? item.price) * toNum(item.quantity),
                      item.discount_total ?? item.discountTotal ?? 0,
                    ),
                    lineNet:
                      toNum(item.unit_price ?? item.price) * toNum(item.quantity),
                  };
                  const discountMode = cartDiscountModes[item.id] || "amount";
                  return (
                    <div
                      key={item.id}
                      className={`cashier-page__cart-item ${
                        selectedId === item.id
                          ? "sellstart-cashier__cart-item--selected"
                          : ""
                      }`}
                      onClick={() => handleRowClick(item)}
                    >
                      <div className="cashier-page__cart-item-main">
                        <div className="cashier-page__cart-item-head">
                          <div className="cashier-page__cart-item-name">
                            {item.product_name ?? item.display_name}
                          </div>
                          <div className="cashier-page__cart-item-head-right">
                            <div className="cashier-page__cart-item-discount-modes">
                              <button
                                type="button"
                                className={`cashier-page__cart-item-discount-mode-btn ${
                                  discountMode === "amount" ? "active" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCartDiscountModes((prev) => ({
                                    ...prev,
                                    [item.id]: "amount",
                                  }));
                                  setCartDiscounts((prev) => ({
                                    ...prev,
                                    [item.id]:
                                      previewItem.discountAmount > 0
                                        ? formatInputDecimal(
                                            previewItem.discountAmount,
                                          )
                                        : "",
                                  }));
                                }}
                              >
                                сом
                              </button>
                              <button
                                type="button"
                                className={`cashier-page__cart-item-discount-mode-btn ${
                                  discountMode === "percent" ? "active" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const percentValue =
                                    previewItem.lineTotal > 0 &&
                                    previewItem.discountAmount > 0
                                      ? trimTrailingZeros(
                                          (
                                            (previewItem.discountAmount /
                                              previewItem.lineTotal) *
                                            100
                                          ).toFixed(2),
                                        )
                                      : "";
                                  setCartDiscountModes((prev) => ({
                                    ...prev,
                                    [item.id]: "percent",
                                  }));
                                  setCartDiscounts((prev) => ({
                                    ...prev,
                                    [item.id]: percentValue,
                                  }));
                                }}
                              >
                                %
                              </button>
                            </div>
                            <div className="cashier-page__cart-item-total">
                              {previewItem.discountAmount > 0 ? (
                                <>
                                  <span
                                    style={{
                                      textDecoration: "line-through",
                                      opacity: 0.7,
                                      marginRight: 6,
                                    }}
                                  >
                                    {formatSom(previewItem.lineTotal)} сом
                                  </span>
                                  <span>{formatSom(previewItem.lineNet)} сом</span>
                                </>
                              ) : (
                                <span>{formatSom(previewItem.lineNet)} сом</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="cashier-page__cart-item-row">
                          <div className="cashier-page__cart-item-field">
                            <span className="cashier-page__cart-item-field-label">
                              Цена
                            </span>
                            <input
                              type="text"
                              className="cashier-page__cart-item-price-input"
                              value={cartPrices[item.id] ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={() => setSelectedId(item.id)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (
                                  value === "" ||
                                  value === "-" ||
                                  /^\d*\.?\d*$/.test(value)
                                ) {
                                  setSelectedId(item.id);
                                  setCartPrices((prev) => ({
                                    ...prev,
                                    [item.id]: value,
                                  }));
                                }
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                const value = e.target.value;
                                const numericValue = toNum(value);
                                if (
                                  value !== "" &&
                                  value !== "-" &&
                                  numericValue !==
                                    toNum(item.unit_price ?? item.price)
                                ) {
                                  patchCartItemPrice(item, value);
                                } else {
                                  setCartPrices((prev) => ({
                                    ...prev,
                                    [item.id]: formatInputDecimal(
                                      item.unit_price ?? item.price ?? 0,
                                    ),
                                  }));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                            />
                          </div>

                          <div className="cashier-page__cart-item-field">
                            <span className="cashier-page__cart-item-field-label">
                              Количество
                            </span>
                            <div className="cashier-page__cart-item-controls">
                              <button
                                type="button"
                                className="cashier-page__cart-item-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecreaseQty(item);
                                }}
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={itemQuantities[item.id] ?? item.quantity ?? ""}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleItemQtyChange(item, e.target.value);
                                }}
                                onBlur={(e) => {
                                  e.stopPropagation();
                                  handleItemQtyBlur(item);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="cashier-page__cart-item-quantity-input"
                              />
                              <button
                                type="button"
                                className="cashier-page__cart-item-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIncreaseQty(item);
                                }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="cashier-page__cart-item-field sellstart-cashier__line-discount">
                            <span className="cashier-page__cart-item-field-label">
                              Скидка
                            </span>
                            <input
                              type="text"
                              className="cashier-page__cart-item-price-input"
                              placeholder={discountMode === "percent" ? "%" : "0"}
                              value={cartDiscounts[item.id] ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={() => setSelectedId(item.id)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (
                                  value === "" ||
                                  value === "-" ||
                                  /^\d*\.?\d*$/.test(value)
                                ) {
                                  setSelectedId(item.id);
                                  setCartDiscounts((prev) => ({
                                    ...prev,
                                    [item.id]: value,
                                  }));
                                }
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                const value = e.target.value;
                                if (value === "") {
                                  if (previewItem.discountAmount !== 0) {
                                    patchCartItemDiscount(item, 0, {
                                      mode: discountMode,
                                      displayValue: "",
                                    });
                                  }
                                  return;
                                }
                                if (value === "-" || Number.isNaN(toNum(value))) return;
                                if (discountMode === "percent") {
                                  patchCartItemDiscount(item, value, {
                                    mode: "percent",
                                    displayValue: trimTrailingZeros(value),
                                  });
                                } else {
                                  patchCartItemDiscount(item, value, {
                                    mode: "amount",
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            className="cashier-page__cart-item-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item);
                            }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="cashier-page__cart-footer">
              <div className="sellstart-cashier__summary-row">
                <span>Без скидок</span>
                <span>{formatSom(subtotalNumber)} сом</span>
              </div>
              <div className="cashier-page__cart-discount">
                <span>Скидка</span>
                <span>{formatSom(displayDiscount)} сом</span>
              </div>
              <div className="cashier-page__cart-total">
                <span>ИТОГО</span>
                <span>{formatSom(displayTotal)} сом</span>
              </div>
              <div className="sellstart-cashier__checkout-actions">
                <button
                  type="button"
                  className="cashier-page__checkout-btn"
                  onClick={openPaymentModal}
                  disabled={isPilorama ? !agentCart.currentCart?.id : !start?.id}
                >
                  Оплатить
                </button>
              </div>
            </div>
          </div>
        </div>

        {showMobileCart && (
          <button
            type="button"
            className="sellstart-cashier__mobile-cart-backdrop"
            onClick={() => setShowMobileCart(false)}
            aria-label="Закрыть корзину"
          />
        )}

        {currentItems.length > 0 && !showPaymentModal && (
          <button
            type="button"
            className="sellstart-cashier__mobile-cart-toggle"
            onClick={() => setShowMobileCart(true)}
          >
            <span className="sellstart-cashier__mobile-cart-label">
              Корзина · {currentItems.length}
            </span>
            <span className="sellstart-cashier__mobile-cart-total">
              {formatSom(displayTotal)} сом
            </span>
          </button>
        )}

        {showPaymentModal && (
          <UniversalModal
            onClose={() => setShowPaymentModal(false)}
            title="Способ оплаты"
            className="sellstart-cashier__payment-modal"
          >
            <div className="sellstart-cashier__payment-body">
              <div className="sellstart-cashier__payment-methods">
                <button
                  type="button"
                  className={`sellstart-cashier__payment-method ${paymentMethod === "cash" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  Наличные
                </button>
                <button
                  type="button"
                  className={`sellstart-cashier__payment-method ${paymentMethod === "cashless" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("cashless")}
                >
                  Безналичный расчет
                </button>
                <button
                  type="button"
                  className={`sellstart-cashier__payment-method ${paymentMethod === "debt" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("debt")}
                >
                  В долг
                </button>
              </div>

              <div className="sellstart-cashier__payment-grid">
                <div className="sellstart-cashier__payment-field sellstart-cashier__payment-field--full">
                  <label>Клиент</label>
                  <div className="sellstart-cashier__client-row">
                    <select
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        setSelectClient(e.target.value);
                      }}
                      className="sellstart-cashier__select"
                    >
                      <option value="">Выберите клиента</option>
                      {filterClient.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.full_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="sellstart-cashier__client-add-btn"
                      onClick={() => setShowNewClientModal(true)}
                      title="Добавить клиента"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="sellstart-cashier__payment-field">
                  <label>Печать чека</label>
                  <select
                    value={receiptWithCheck ? "yes" : "no"}
                    onChange={(e) => setReceiptWithCheck(e.target.value === "yes")}
                    className="sellstart-cashier__select"
                  >
                    <option value="yes">С чеком</option>
                    <option value="no">Без чека</option>
                  </select>
                </div>

                {paymentMethod === "cashless" && (
                  <div className="sellstart-cashier__payment-field">
                    <label>Банк / способ перевода</label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="sellstart-cashier__select"
                    >
                      <option value="">Выберите банк</option>
                      {paymentBanks.map((bank) => (
                        <option key={bank.id} value={bank.id}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {paymentMethod === "debt" && (
                  <>
                    <div className="sellstart-cashier__payment-field">
                      <label>Первоначальная оплата</label>
                      <input
                        type="text"
                        value={debtInitialPayment}
                        onChange={(e) => setDebtInitialPayment(e.target.value)}
                        className="sellstart-cashier__discount-input"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="sellstart-cashier__payment-field">
                      <label>Дата первой оплаты</label>
                      <input
                        type="date"
                        value={firstPaymentDate}
                        onChange={(e) => setFirstPaymentDate(e.target.value)}
                        className="sellstart-cashier__discount-input"
                      />
                    </div>
                    <div className="sellstart-cashier__payment-field">
                      <label>Дата окончания срока долга</label>
                      <input
                        type="date"
                        min={tomorrowYmd()}
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="sellstart-cashier__discount-input"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="sellstart-cashier__payment-summary">
                <div>
                  <span>К оплате</span>
                  <strong>{formatSom(currentTotal)} сом</strong>
                </div>
                {paymentMethod === "cash" && (
                  <div>
                    <span>Наличными</span>
                    <strong>{formatSom(currentTotal)} сом</strong>
                  </div>
                )}
                {paymentMethod === "cashless" && selectedBank && (
                  <div>
                    <span>Безналичный расчет</span>
                    <strong>
                      {paymentBanks.find((bank) => bank.id === selectedBank)?.name ||
                        "Перевод"}
                    </strong>
                  </div>
                )}
                {paymentMethod === "debt" && (
                  <div>
                    <span>Остаток долга</span>
                    <strong>
                      {formatSom(
                        Math.max(
                          0,
                          Number(currentTotal || 0) -
                            Number(
                              String(debtInitialPayment || "0").replace(/,/g, "."),
                            ),
                        ),
                      )}{" "}
                      сом
                    </strong>
                  </div>
                )}
              </div>

              <div className="sellstart-cashier__payment-actions">
                <button
                  type="button"
                  className="sell__reset"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cashier-page__checkout-btn sellstart-cashier__modal-pay-btn"
                  onClick={handleMarketPosPayment}
                  disabled={paymentMethod === "debt" && !clientId}
                >
                  Подтвердить оплату
                </button>
              </div>
            </div>
          </UniversalModal>
        )}

        {showNewClientModal && (
          <UniversalModal
            onClose={() => setShowNewClientModal(false)}
            title={"Добавить клиента"}
          >
            <form className="start__clientForm" onSubmit={onSubmit}>
              <div>
                <label>ФИО</label>
                <input
                  className={cx(
                    "sell__header-input",
                    (touched.full_name || submitTried) &&
                      errors.full_name &&
                      "error",
                  )}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={form.full_name}
                  type="text"
                  placeholder="ФИО"
                  name="full_name"
                />
                {(touched.full_name || submitTried) && errors.full_name ? (
                  <p className="sell__header-necessarily">{errors.full_name}</p>
                ) : (
                  <p className="sell__header-necessarily">*</p>
                )}
              </div>
              <div>
                <label>Телефон</label>
                <input
                  className={cx(
                    "sell__header-input",
                    (touched.phone || submitTried) && errors.phone && "error",
                  )}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={form.phone}
                  type="text"
                  name="phone"
                  placeholder="Телефон"
                />
                {(touched.phone || submitTried) && errors.phone ? (
                  <p className="sell__header-necessarily">{errors.phone}</p>
                ) : (
                  <p className="sell__header-necessarily">*</p>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  columnGap: "10px",
                  justifyContent: "end",
                }}
              >
                <button
                  className="sell__reset"
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                >
                  Отмена
                </button>
                <button className="start__total-pay" style={{ width: "auto" }}>
                  Создать
                </button>
              </div>
            </form>
          </UniversalModal>
        )}

        <AlertModal
          open={alert.open}
          type={alert.type}
          message={alert.message}
          okText="Ok"
          onClose={() => setAlert((a) => ({ ...a, open: false }))}
        />
      </div>
    );
  }

  return (
    <section className="sell start">
      <div className="sell__header">
        <div className="sell__header-left">
          <div className="sell__header-input">
            <input
              onChange={onChange}
              type="text"
              placeholder="Введите название товара"
            />
            <span>
              <Search size={15} color="#91929E" />
            </span>
          </div>

          <select
            onChange={(e) => {
              setClientId(e.target.value);
              setSelectClient(e.target.value);
            }}
            value={clientId}
            className="sell__header-input"
          >
            <option value="">Выберите клиента</option>
            {filterClient.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>

          <button
            className="sell__header-plus"
            onClick={() => setShowNewClientModal(true)}
          >
            <span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 11H13V5C13 4.73478 12.8946 4.48043 12.7071 4.29289C12.5196 4.10536 12.2652 4 12 4C11.7348 4 11.4804 4.10536 11.2929 4.29289C11.1054 4.48043 11 4.73478 11 5V11H5C4.73478 11 4.48043 11.1054 4.29289 11.2929C4.10536 11.4804 4 11.7348 4 12C4 12.2652 4.10536 12.5196 4.29289 12.7071C4.4804 12.8946 4.73478 13 5 13H11V19C11 19.2652 11.1054 19.5196 11.2929 19.7071C11.4804 19.8946 11.7348 20 12 20C12.2652 20 12.5196 19.8946 12.7071 19.7071C12.8946 19.5196 13 19.2652 13 19V13H19C19.2652 13 19.5196 12.8946 19.7071 12.7071C19.8946 12.5196 20 12.2652 20 12C20 11.7348 19.8946 11.4804 19.7071 11.2929C19.5196 11.1054 19.2652 11 19 11Z"
                  fill="#CCCCCC"
                />
              </svg>
            </span>
          </button>
        </div>

        <div className="sell__header-left">
          {isPilorama && selectedAgent && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", color: "#666" }}>
                Выбранный агент:
              </span>
              <span style={{ fontWeight: "bold" }}>
                {
                  agents.find(
                    (agentData) => agentData.agent.id === selectedAgent,
                  )?.agent.first_name
                }{" "}
                {
                  agents.find(
                    (agentData) => agentData.agent.id === selectedAgent,
                  )?.agent.last_name
                }
              </span>
              <button
                type="button"
                onClick={() => setShowAgentModal(true)}
                style={{
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Сменить агента
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="start__body">
        <div className="col-8">
          <div className="start__body-column">
            {/* <div className="sell__body-header">
              <h2 className="start__body-title">
                {selectedItem?.product_name}
              </h2>

              <div className="start__actions">
                <div className="start__actions-left">
                  <input
                    type="text"
                    className="start__actions-input"
                    value={
                      selectedItem?.unit_price * selectedItem?.quantity || ""
                    }
                    readOnly
                  />

                  <div className="start__actions-row">
                    <button
                      className="start__actions-btn"
                      onClick={incQty}
                      disabled={!selectedItem}
                      title="Увеличить количество"
                    >
                      <Plus />
                    </button>

                    <input
                      style={{ width: 100 }}
                      type="number"
                      min={0}
                      className="start__actions-input"
                      value={qty}
                      placeholder="Кол-во"
                      onChange={(e) => {
                        const newQty = e.target.value;
                        setQty(newQty);

                        if (isPilorama && selectedItem && newQty !== "") {
                          const qtyNum = Number(newQty);
                          if (qtyNum === 0) {
                            dispatch(
                              removeItemFromAgentCart({
                                cartId: agentCart.currentCart?.id,
                                itemId: selectedItem.id,
                              })
                            );
                          } else {
                            dispatch(
                              updateAgentCartItemQuantity({
                                cartId: agentCart.currentCart?.id,
                                itemId: selectedItem.id,
                                quantity: qtyNum,
                              })
                            );
                          }
                          onRefresh();
                        }
                      }}
                      disabled={!selectedItem}
                    />

                    <button
                      className="start__actions-btn"
                      onClick={decQty}
                      disabled={!selectedItem}
                      title="Уменьшить количество"
                    >
                      <Minus />
                    </button>
                  </div>

                  <input
                    type="text"
                    className="start__actions-input"
                    placeholder="Скидка на позицию"
                    onChange={onProductDiscountChange}
                    disabled={!selectedItem}
                  />
                </div>

                <input
                  type="text"
                  className="start__actions-input"
                  placeholder="Общ скидка"
                  onChange={onDiscountChange}
                />
              </div>
            </div> */}
            <div className="start__body-wrapper">
              <div className="start__body-wrapper">
                <table className="start__body-table">
                  <tbody>
                    {currentItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={cx(selectedId === item.id && "active")}
                        onClick={() => handleRowClick(item)}
                        style={{ cursor: "pointer" }}
                        title="Выбрать позицию"
                      >
                        <td>{idx + 1}.</td>
                        <td>{item.product_name ?? item.display_name}</td>
                        <td>{item.unit_price}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              className="start__table-btn start__table-btn--minus"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDecreaseQty(item);
                              }}
                              title="Уменьшить количество"
                            >
                              <Minus size={16} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={
                                itemQuantities[item.id] ?? item.quantity ?? ""
                              }
                              onChange={(e) => {
                                e.stopPropagation();
                                handleItemQtyChange(item, e.target.value);
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                handleItemQtyBlur(item);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: "60px",
                                textAlign: "center",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "14px",
                              }}
                              title="Редактировать количество"
                            />
                            <span style={{ fontSize: "14px", color: "#666" }}>
                              шт
                            </span>
                            <button
                              className="start__table-btn start__table-btn--plus"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIncreaseQty(item);
                              }}
                              title="Увеличить количество"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {Number(item.unit_price) * Number(item.quantity)}
                        </td>
                        <td>
                          <button
                            className="start__table-btn start__table-btn--delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item);
                            }}
                            title="Удалить товар"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="start__products">
            {company.sector.name === "Пилорама"
              ? agents
                  .find((agentData) => agentData.agent.id === selectedAgent)
                  ?.products?.map((product) => (
                    <button
                      key={product.product}
                      className={cx(
                        "start__products-add",
                        selectedItem?.product === product.product && "active",
                      )}
                      onClick={async () => {
                        await dispatch(
                          addProductToAgentCart({
                            cartId: agentCart.currentCart?.id,
                            product_id: product.product,
                            quantity: 1,
                            agent: selectedAgent,
                          }),
                        ).unwrap();
                        onRefresh();
                      }}
                      title="Добавить 1 шт"
                    >
                      {product.product_name} (остаток: {product.qty_on_hand})
                    </button>
                  ))
              : filterData?.map((product) => (
                  <button
                    key={product.product}
                    className={cx(
                      "start__products-add",
                      selectedItem?.product === product.product && "active",
                    )}
                    onClick={async () => {
                      if (isPilorama) {
                        await dispatch(
                          addProductToAgentCart({
                            cartId: agentCart.currentCart?.id,
                            product_id: product.product,
                            quantity: 1,
                            agent: selectedAgent,
                          }),
                        ).unwrap();
                        onRefresh();
                      } else {
                        await dispatch(
                          manualFillingInAgent({
                            id: start.id,
                            productId: product.product,
                          }),
                        ).unwrap();
                        dispatch(startSaleInAgent());
                      }
                    }}
                    title="Добавить 1 шт"
                  >
                    {product.product_name}
                  </button>
                ))}
          </div>
        </div>

        <div className="col-4">
          <div className="start__total">
            <div className="start__total-top">
              <div className="start__total-row">
                <b>Без скидок</b>
                <p>{currentSubtotal}</p>
              </div>
              <div className="start__total-row">
                <b>Скидка</b>
                <p>{currentDiscount}</p>
              </div>
              <div className="start__total-row">
                <b>ИТОГО</b>
                <h4>{currentTotal}</h4>
              </div>
            </div>

            <div className="start__total-bottom">
              <button
                className="start__total-debt"
                onClick={() => setShowDebtModal(true)}
              >
                Долг
              </button>

              {isPilorama && (
                <button
                  className="start__total-debt"
                  onClick={() => setShowCustomItemModal(true)}
                  style={{ marginLeft: "10px" }}
                >
                  Кастомная позиция
                </button>
              )}

              <div className="start__total-row1">
                <button
                  className="start__total-pay"
                  onClick={() => performCheckout(true)}
                  disabled={
                    isPilorama ? !agentCart.currentCart?.id : !start?.id
                  }
                >
                  Печать чека
                </button>
                <button
                  className="start__total-pay"
                  onClick={() => performCheckout(false)}
                  disabled={
                    isPilorama ? !agentCart.currentCart?.id : !start?.id
                  }
                >
                  Без чека
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNewClientModal && (
        <UniversalModal
          onClose={() => setShowNewClientModal(false)}
          title={"Добавить клиента"}
        >
          <form className="start__clientForm" onSubmit={onSubmit}>
            <div>
              <label>ФИО</label>
              <input
                className={cx(
                  "sell__header-input",
                  (touched.full_name || submitTried) &&
                    errors.full_name &&
                    "error",
                )}
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.full_name}
                type="text"
                placeholder="ФИО"
                name="full_name"
              />
              {(touched.full_name || submitTried) && errors.full_name ? (
                <p className="sell__header-necessarily">{errors.full_name}</p>
              ) : (
                <p className="sell__header-necessarily">*</p>
              )}
            </div>
            <div>
              <label>ОсОО</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.llc}
                type="text"
                name="llc"
                placeholder="ОсОО"
              />
            </div>
            <div>
              <label>ИНН</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.inn}
                type="text"
                name="inn"
                placeholder="ИНН"
              />
            </div>
            <div>
              <label>ОКПО</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.okpo}
                type="text"
                name="okpo"
                placeholder="ОКПО"
              />
            </div>
            <div>
              <label>З/СЧЕТ</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.score}
                type="text"
                name="score"
                placeholder="Р/СЧЁТ"
              />
            </div>
            <div>
              <label>БИК</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.bik}
                type="text"
                name="bik"
                placeholder="БИК"
              />
            </div>
            <div>
              <label>Адрес</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.address}
                type="text"
                name="address"
                placeholder="Адрес"
              />
            </div>
            <div>
              <label>Телефон</label>
              <input
                className={cx(
                  "sell__header-input",
                  (touched.phone || submitTried) && errors.phone && "error",
                )}
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.phone}
                type="text"
                name="phone"
                placeholder="Телефон"
              />
              {(touched.phone || submitTried) && errors.phone ? (
                <p className="sell__header-necessarily">{errors.phone}</p>
              ) : (
                <p className="sell__header-necessarily">*</p>
              )}
            </div>
            <div>
              <label>Email</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.email}
                type="email"
                name="email"
                placeholder="Почта"
              />
            </div>
            <div
              style={{
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowNewClientModal(false)}
              >
                Отмена
              </button>
              <button className="start__total-pay" style={{ width: "auto" }}>
                Создать
              </button>
            </div>
          </form>
        </UniversalModal>
      )}

      {showDebtModal && (
        <UniversalModal onClose={() => setShowDebtModal(false)} title={"Долг"}>
          <div className="start__debt">
            <p className="start__debt-amount">
              Cумма долга: <b>{currentTotal}</b>
            </p>
            {clientId === "" && (
              <>
                <p
                  style={{ margin: "5px 0" }}
                  className="sell__header-necessarily"
                >
                  Выберите клиента!
                </p>
                <select
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setSelectClient(e.target.value);
                  }}
                  value={clientId}
                  className="sell__header-input"
                >
                  <option value="">Выберите клиента</option>
                  {filterClient.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label>Тип оплаты</label>
            <select
              value={debt}
              onChange={(e) => setDebt(e.target.value)}
              className="sell__header-input"
              name=""
            >
              <option value="">Тип оплаты</option>
              <option value="Предоплата">Предоплата</option>
              <option value="Долги">Долг</option>
            </select>
            {debt === "Предоплата" && (
              <>
                <label htmlFor="">Сумма предоплаты</label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <label>Дата окончания срока долга</label>
                <input
                  type="date"
                  min={tomorrowYmd()}
                  className="sell__header-input"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                />
              </>
            )}
            {debt === "Долги" && (
              <>
                <label>Дата окончания срока долга</label>
                <input
                  type="date"
                  min={tomorrowYmd()}
                  className="sell__header-input"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                />
              </>
            )}
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowDebtModal(false)}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={() => setShowDebtModal(false)}
              >
                Сохранить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showAgentModal && (
        <UniversalModal
          onClose={() => {
            setShowAgentModal(false);
            tempSelectedAgent === "" && setShow(false);
            setTempSelectedAgent("");
          }}
          title={"Выберите агента"}
        >
          <div className="start__agent">
            <p className="start__agent-text">
              Для работы с пилорамой необходимо выбрать агента
            </p>
            <select
              value={tempSelectedAgent}
              onChange={(e) => setTempSelectedAgent(e.target.value)}
              className="sell__header-input"
            >
              <option value="">Выберите агента</option>
              {agents.map((agentData) => (
                <option key={agentData.agent.id} value={agentData.agent.id}>
                  {agentData.agent.first_name} {agentData.agent.last_name} (
                  {agentData.agent.track_number})
                </option>
              ))}
            </select>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => {
                  setShowAgentModal(false);
                  tempSelectedAgent === "" && setShow(false);
                  setTempSelectedAgent("");
                }}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={initializeAgentCart}
                disabled={!tempSelectedAgent}
              >
                Начать работу
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showCustomItemModal && (
        <UniversalModal
          onClose={() => setShowCustomItemModal(false)}
          title={"Добавить кастомную позицию"}
        >
          <div className="start__custom-item">
            <div>
              <label>Название позиции</label>
              <input
                className="sell__header-input"
                value={customItem.name}
                onChange={(e) =>
                  setCustomItem((prev) => ({ ...prev, name: e.target.value }))
                }
                type="text"
                placeholder="Например: Услуга распила"
              />
            </div>
            <div>
              <label>Цена</label>
              <input
                className="sell__header-input"
                value={customItem.price}
                onChange={(e) =>
                  setCustomItem((prev) => ({ ...prev, price: e.target.value }))
                }
                type="number"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label>Количество</label>
              <input
                className="sell__header-input"
                value={customItem.quantity}
                onChange={(e) =>
                  setCustomItem((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
                type="number"
                placeholder="1"
                min="1"
              />
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowCustomItemModal(false)}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={handleAddCustomItem}
              >
                Добавить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      <AlertModal
        open={alert.open}
        type={alert.type}
        message={alert.message}
        okText="Ok"
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
      />
    </section>
  );
};

export default SellStart;
