import { describe, it, expect } from "vitest";
import {
  enrichMarketReceiptPayload,
  isOpaquePrintPayload,
  isPrintFormatError,
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
