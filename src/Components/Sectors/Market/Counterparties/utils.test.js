import { describe, expect, it } from "vitest";
import {
  counterpartyHasDebt,
  findDebtPaymentCategory,
  getCreditDocumentsSummary,
  getDebtOverpayment,
} from "./utils";
import {
  parseCounterpartyApiError,
  validateCounterpartyForm,
} from "./counterpartyFormValidation";

describe("findDebtPaymentCategory (B14)", () => {
  it("предпочитает system_key=debt, а не первую по алфавиту", () => {
    const cats = [
      { id: "1", title: "Аренда" },
      { id: "2", title: "Прочее", system_key: "debt" },
      { id: "3", title: "Погашение долга" },
    ];
    expect(findDebtPaymentCategory(cats)?.id).toBe("2");
  });

  it("ищет по названию без учёта регистра", () => {
    expect(
      findDebtPaymentCategory([
        { id: "1", title: "Аренда" },
        { id: "2", title: "ДОЛГИ" },
        { id: "3", title: "погашение долга" },
      ])?.id,
    ).toBe("3");
    expect(
      findDebtPaymentCategory([
        { id: "1", title: "Аренда" },
        { id: "2", name: "Долги" },
      ])?.id,
    ).toBe("2");
  });

  it("не найдено — null, ничего не подставляем", () => {
    expect(findDebtPaymentCategory([{ id: "1", title: "Аренда" }])).toBeNull();
    expect(findDebtPaymentCategory(undefined)).toBeNull();
  });
});

describe("counterpartyHasDebt (B18)", () => {
  const withDebts = (debts) => ({ analytics: { debts } });
  it("сальдо на конец ≠ 0 — с долгом", () => {
    expect(
      counterpartyHasDebt(withDebts({ opening_debit: "0", turnover_debit: "300", turnover_credit: "100" })),
    ).toBe(true);
    expect(counterpartyHasDebt(withDebts({ opening_credit: "50" }))).toBe(true);
  });
  it("закрытые расчёты — без долга", () => {
    expect(
      counterpartyHasDebt(withDebts({ turnover_debit: "300", turnover_credit: "300" })),
    ).toBe(false);
  });
  it("без analytics — по debt_remaining", () => {
    expect(counterpartyHasDebt({ debt_remaining: "10.00" })).toBe(true);
    expect(counterpartyHasDebt({ debt_remaining: "0.00" })).toBe(false);
    expect(counterpartyHasDebt({})).toBe(false);
  });
});

describe("getCreditDocumentsSummary (B19)", () => {
  it("продажа 300 с предоплатой 100 → 1 документ, ожидается 200", () => {
    const ops = [
      { source: "document", number: "SALE-0001", debt_delta: "300.00" },
      { source: "money", doc_type: "MONEY_RECEIPT", debt_delta: "-100.00" },
    ];
    expect(getCreditDocumentsSummary(ops, 200)).toEqual({ count: 1, expected: 200 });
  });
  it("возвраты и нулевые изменения не считаются", () => {
    const ops = [
      { source: "document", number: "SALE_RETURN-1", debt_delta: "-50" },
      { source: "document", number: "SALE-2", debt_delta: "0" },
    ];
    expect(getCreditDocumentsSummary(ops, -10)).toEqual({ count: 0, expected: 10 });
  });
});

describe("getDebtOverpayment (B15)", () => {
  it("считает переплату", () => {
    expect(getDebtOverpayment(500, 200)).toBe(300);
    expect(getDebtOverpayment(200, 200)).toBe(0);
    expect(getDebtOverpayment(150, -200)).toBe(0);
    expect(getDebtOverpayment(100, 0)).toBe(0);
  });
});

describe("validateCounterpartyForm (B25)", () => {
  it("возвращает поле с ошибкой телефона", () => {
    expect(
      validateCounterpartyForm({ name: "ООО", type: "CLIENT", phone: "abc" }, []),
    ).toMatchObject({ field: "phone" });
    expect(
      validateCounterpartyForm({ name: "ООО", type: "CLIENT", phone: "+996 555 123 456" }, []),
    ).toBeNull();
  });
  it("ошибки DRF по телефону — к полю, прочие — в общий текст", () => {
    expect(parseCounterpartyApiError({ phone: ["Неверный номер"] }, "x")).toEqual({
      message: "",
      fieldErrors: { phone: "Неверный номер" },
    });
    expect(parseCounterpartyApiError({ inn: ["Плохой ИНН"] }, "x")).toEqual({
      message: "ИНН: Плохой ИНН",
      fieldErrors: {},
    });
  });
});
