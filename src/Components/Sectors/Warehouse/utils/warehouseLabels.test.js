import { describe, expect, it } from "vitest";
import {
  counterpartyTypeLabel,
  documentStatusLabel,
  documentTypeLabel,
  formatDateTime,
  formatSom,
} from "./warehouseLabels";

describe("warehouseLabels (B40)", () => {
  it("переводит системные значения", () => {
    expect(documentStatusLabel("CASH_PENDING")).toBe("Ожидает кассы");
    expect(documentStatusLabel("POSTED")).toBe("Проведён");
    expect(counterpartyTypeLabel("SUPPLIER")).toBe("Поставщик");
    expect(counterpartyTypeLabel("BOTH")).toBe("Клиент и поставщик");
    expect(counterpartyTypeLabel("CLIENT")).toBe("Клиент");
    expect(documentTypeLabel("SALE")).toBe("Продажа");
    expect(documentStatusLabel(null)).toBe("—");
  });
});

describe("форматы (B41)", () => {
  it("дата и время без секунд и двоеточия после года", () => {
    expect(formatDateTime(new Date(2026, 8, 18, 17, 10, 23))).toBe("18.09.2026 17:10");
    expect(formatDateTime("2026-09-18")).toBe("18.09.2026");
    expect(formatDateTime("")).toBe("—");
  });
  it("валюта — «сом»", () => {
    expect(formatSom(1050).replace(/\s/g, " ")).toBe("1 050 сом");
    expect(formatSom(1050, 2).replace(/\s/g, " ")).toBe("1 050,00 сом");
  });
});
