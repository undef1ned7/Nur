import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  enrichMarketReceiptPayload,
  isOpaquePrintPayload,
  isPrintFormatError,
  buildMarketReceiptLayout,
  renderReceiptLayoutToCanvas,
  computeEscposCharsPerLine,
  maybeMigrateLegacyCharsPerLine,
  buildEscPosPrinterSetup,
  getEscposRuntimeConfig,
  isEscposGraphicPrintEnabled,
  setEscposGraphicPrint,
  readEscposCharsPerLine,
  persistEscposSettings,
} from "./printService";

describe("enrichMarketReceiptPayload", () => {
  it("не разрушает PDF-блоб серверного чека", () => {
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const result = enrichMarketReceiptPayload(pdf, {
      paymentMethod: "cash",
      total: 100,
    });
    // Спред блоба дал бы пустой {} и печать падала бы на «неизвестном формате»
    expect(result).toBe(pdf);
  });

  it("обогащает обычный JSON-чек данными об оплате", () => {
    const payload = { items: [{ name: "Товар", qty: 1, unit_price: 100 }] };
    const result = enrichMarketReceiptPayload(payload, {
      paymentMethod: "cash",
      total: 100,
      amountReceived: 150,
      paidCash: 100,
    });
    expect(result).not.toBe(payload);
    expect(result.payment_method).toBe("cash");
    expect(result.cash_received).toBe(150);
    expect(result.paid_cash).toBe(100);
    expect(result.change).toBe(50);
  });
});

describe("isOpaquePrintPayload", () => {
  it("распознаёт бинарные ответы", () => {
    expect(isOpaquePrintPayload(new Blob(["x"]))).toBe(true);
    expect(isOpaquePrintPayload(new ArrayBuffer(8))).toBe(true);
    expect(isOpaquePrintPayload(new Uint8Array([1, 2]))).toBe(true);
  });

  it("не трогает обычные JSON-объекты", () => {
    expect(isOpaquePrintPayload({ items: [] })).toBe(false);
    expect(isOpaquePrintPayload(null)).toBe(false);
  });
});

describe("isPrintFormatError", () => {
  it("отличает ошибку формата от проблем с принтером", () => {
    expect(
      isPrintFormatError(new Error("Неизвестный формат ответа для печати")),
    ).toBe(true);
    expect(isPrintFormatError(new Error("Принтер не подключен"))).toBe(false);
    expect(isPrintFormatError(new Error("WebUSB не поддерживается"))).toBe(
      false,
    );
  });
});

describe("computeEscposCharsPerLine", () => {
  it("масштабирует символы пропорционально 48 мм эталону", () => {
    expect(computeEscposCharsPerLine(384, "B")).toBe(32);
    expect(computeEscposCharsPerLine(576, "B")).toBe(48);
    expect(computeEscposCharsPerLine(576, "A")).toBe(48);
    expect(computeEscposCharsPerLine(320, "B")).toBe(27);
    expect(computeEscposCharsPerLine(288, "B")).toBe(24);
  });
});

describe("maybeMigrateLegacyCharsPerLine", () => {
  it("мигрирует старый dense 64 символа на 80 мм", () => {
    expect(maybeMigrateLegacyCharsPerLine(576, 64, "B")).toBe(48);
    expect(maybeMigrateLegacyCharsPerLine(576, 50, "B")).toBe(50);
  });
});

describe("readEscposCharsPerLine", () => {
  const keys = ["escpos_cpl", "escpos_legacy_cpl_migrated"];
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const k of keys) {
      saved[k] = localStorage.getItem(k);
      localStorage.removeItem(k);
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, saved[k]);
    }
  });

  it("один раз мигрирует legacy 64 → 48 и больше не трогает сохранённое", () => {
    localStorage.setItem("escpos_cpl", "64");
    expect(readEscposCharsPerLine(576, "B", 48)).toBe(48);
    expect(localStorage.getItem("escpos_cpl")).toBe("48");
    expect(localStorage.getItem("escpos_legacy_cpl_migrated")).toBe("1");

    localStorage.setItem("escpos_cpl", "50");
    expect(readEscposCharsPerLine(576, "B", 48)).toBe(50);
  });

  it("после миграции сохраняет пользовательское значение", () => {
    localStorage.setItem("escpos_legacy_cpl_migrated", "1");
    localStorage.setItem("escpos_cpl", "40");
    expect(readEscposCharsPerLine(576, "B", 48)).toBe(40);
  });
});

describe("persistEscposSettings", () => {
  const escposKeys = [
    "escpos_dpl",
    "escpos_cpl",
    "escpos_line",
    "escpos_font",
    "escpos_cp",
    "escpos_graphic",
  ];
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const k of escposKeys) {
      saved[k] = localStorage.getItem(k);
      localStorage.removeItem(k);
    }
  });

  afterEach(() => {
    for (const k of escposKeys) {
      if (saved[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, saved[k]);
    }
  });

  it("записывает размеры в localStorage", () => {
    const ok = persistEscposSettings({
      dotsPerLine: 576,
      charsPerLine: 48,
      lineHeight: 22,
      font: "B",
      codepage: 17,
      graphicPrint: true,
    });
    expect(ok).toBe(true);
    expect(localStorage.getItem("escpos_dpl")).toBe("576");
    expect(localStorage.getItem("escpos_cpl")).toBe("48");
  });
});

describe("isEscposGraphicPrintEnabled", () => {
  const key = "escpos_graphic";
  let saved = null;

  beforeEach(() => {
    saved = localStorage.getItem(key);
    localStorage.removeItem(key);
  });

  afterEach(() => {
    if (saved == null) localStorage.removeItem(key);
    else localStorage.setItem(key, saved);
  });

  it("по умолчанию graphic включён", () => {
    expect(isEscposGraphicPrintEnabled()).toBe(true);
    localStorage.setItem(key, "");
    expect(isEscposGraphicPrintEnabled()).toBe(true);
  });

  it("читает escpos_graphic из localStorage", () => {
    setEscposGraphicPrint(false);
    expect(isEscposGraphicPrintEnabled()).toBe(false);
    setEscposGraphicPrint(true);
    expect(isEscposGraphicPrintEnabled()).toBe(true);
  });
});

describe("buildEscPosPrinterSetup", () => {
  it("отправляет ESC M и ESC 3 из настроек", () => {
    const parts = buildEscPosPrinterSetup({
      font: "B",
      lineDotHeight: 22,
    });
    expect(parts).toHaveLength(2);
    expect(Array.from(parts[0])).toEqual([0x1b, 0x4d, 1]);
    expect(Array.from(parts[1])).toEqual([0x1b, 0x33, 22]);
  });

  it("Font A → ESC M 0", () => {
    const parts = buildEscPosPrinterSetup({ font: "A", lineDotHeight: 24 });
    expect(Array.from(parts[0])).toEqual([0x1b, 0x4d, 0]);
  });
});

describe("getEscposRuntimeConfig", () => {
  const escposKeys = [
    "escpos_dpl",
    "escpos_cpl",
    "escpos_line",
    "escpos_font",
    "escpos_cp",
  ];
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const k of escposKeys) {
      saved[k] = localStorage.getItem(k);
      localStorage.removeItem(k);
    }
  });

  afterEach(() => {
    for (const k of escposKeys) {
      if (saved[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, saved[k]);
    }
  });

  it("по умолчанию 80 мм (576 точек, 48 символов)", () => {
    const cfg = getEscposRuntimeConfig({ marketDefault: true });
    expect(cfg.dotsPerLine).toBe(576);
    expect(cfg.charsPerLine).toBe(48);
  });

  it("читает escpos_* из localStorage", () => {
    localStorage.setItem("escpos_dpl", "320");
    localStorage.setItem("escpos_cpl", "28");
    localStorage.setItem("escpos_line", "20");
    localStorage.setItem("escpos_font", "A");
    localStorage.setItem("escpos_cp", "73");

    const cfg = getEscposRuntimeConfig();
    expect(cfg.dotsPerLine).toBe(320);
    expect(cfg.charsPerLine).toBe(28);
    expect(cfg.lineDotHeight).toBe(20);
    expect(cfg.font).toBe("A");
    expect(cfg.codepage).toBe(73);
  });
});

describe("buildMarketReceiptLayout", () => {
  const escposKeys = [
    "escpos_dpl",
    "escpos_cpl",
    "escpos_line",
    "escpos_font",
    "escpos_cp",
  ];
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const k of escposKeys) {
      saved[k] = localStorage.getItem(k);
      localStorage.removeItem(k);
    }
  });

  afterEach(() => {
    for (const k of escposKeys) {
      if (saved[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, saved[k]);
    }
  });

  it("собирает ключевые строки чека маркета", () => {
    const { lines, qrLink } = buildMarketReceiptLayout({
      company: "Nur Market",
      items: [
        {
          name: "Хлеб",
          qty: 2,
          unit_price: 50,
          line_total: 90,
          line_discount: 10,
        },
      ],
      discount: 5,
      paid_cash: 85,
      cash_received: 100,
      change: 15,
    });

    const texts = lines.map(
      (l) => l.text ?? `${l.left ?? ""} ${l.right ?? ""}`.trim(),
    );
    expect(texts.some((t) => t.includes("СПАСИБО ЗА ПОКУПКУ"))).toBe(true);
    expect(texts.some((t) => t.includes("Магазин: Nur Market"))).toBe(true);
    expect(texts.some((t) => t.includes("Хлеб"))).toBe(true);
    expect(texts.some((t) => t.includes("Подытог"))).toBe(true);
    expect(texts.some((t) => t.includes("Скидка") && t.includes("-5.00"))).toBe(
      true,
    );
    expect(texts.some((t) => t.includes("Итог") && t.includes("СОМ"))).toBe(
      true,
    );
    expect(texts.some((t) => t.includes("Итого"))).toBe(true);
    expect(qrLink).toBe("");
  });

  it("добавляет подпись проверки чека при qrLink", () => {
    const { lines, qrLink } = buildMarketReceiptLayout({
      company: "Shop",
      items: [{ name: "Товар", qty: 1, unit_price: 10, line_total: 10 }],
      ekassa_fiscal: { link: "https://example.com/check/1" },
    });
    expect(qrLink).toBe("https://example.com/check/1");
    expect(lines.some((l) => l.text === "Проверка чека")).toBe(true);
  });

  it("layout не пустой для минимального payload", () => {
    const { lines } = buildMarketReceiptLayout({
      items: [{ name: "A", qty: 1, price: 1 }],
    });
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe("renderReceiptLayoutToCanvas", () => {
  it("рисует canvas шириной dotsPerLine", () => {
    const measureText = () => ({ width: 80 });
    const ctx = {
      fillStyle: "",
      font: "",
      textBaseline: "",
      fillRect: () => {},
      fillText: () => {},
      measureText,
    };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => ctx;
    try {
      const canvas = renderReceiptLayoutToCanvas(
        [
          { text: "СПАСИБО ЗА ПОКУПКУ!", align: "center", bold: true },
          { text: "Магазин: Test", align: "center" },
          { text: "Итог          100.00 СОМ", bold: true, scale: 2 },
        ],
        { dotsPerLine: 384, charsPerLine: 42, lineDotHeight: 22 },
      );
      expect(canvas.width).toBe(384);
      expect(canvas.height).toBeGreaterThan(40);
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
