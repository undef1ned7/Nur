import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { DECIMAL_CTOR, toDecimal } from "../src/lib/decimal.js";
import { InvoiceType } from "../src/types/invoice.types.js";
import { calculateMonetaryTotal, calculateTaxTotal } from "../src/utils/formatters.js";
import { validateInvoice } from "../src/validators/invoice.validator.js";

const seller = {
  name: "Acme",
  taxId: "T1",
  address: {
    street: "S",
    city: "C",
    postalCode: "P",
    country: "US",
  },
};
const buyer = {
  name: "Buy",
  taxId: "T2",
  address: {
    street: "S2",
    city: "C2",
    postalCode: "P2",
    country: "US",
  },
};

function baseLine() {
  return {
    id: "1",
    description: "X",
    quantity: toDecimal(1),
    unitCode: "C62",
    unitPrice: toDecimal(100),
    taxCategory: { id: "S" as const, percent: toDecimal(0), scheme: "VAT" as const },
  };
}

describe("validateInvoice", () => {
  it("rejects empty invoice id", () => {
    const lines = [baseLine()];
    const taxTotal = calculateTaxTotal(lines);
    const monetaryTotal = calculateMonetaryTotal(lines, taxTotal);
    expect(() =>
      validateInvoice({
        id: "",
        issueDate: new Date(Date.UTC(2024, 0, 1)),
        dueDate: new Date(Date.UTC(2024, 0, 2)),
        type: InvoiceType.INVOICE,
        currency: "USD",
        seller,
        buyer,
        lineItems: lines,
        taxTotal,
        monetaryTotal,
      }),
    ).toThrow(ZodError);
  });

  it("rejects due date before issue date", () => {
    const lines = [baseLine()];
    const taxTotal = calculateTaxTotal(lines);
    const monetaryTotal = calculateMonetaryTotal(lines, taxTotal);
    expect(() =>
      validateInvoice({
        id: "I1",
        issueDate: new Date(Date.UTC(2024, 5, 10)),
        dueDate: new Date(Date.UTC(2024, 5, 1)),
        type: InvoiceType.INVOICE,
        currency: "USD",
        seller,
        buyer,
        lineItems: lines,
        taxTotal,
        monetaryTotal,
      }),
    ).toThrow(ZodError);
  });

  it("rejects negative unit price", () => {
    const lines = [
      {
        ...baseLine(),
        unitPrice: toDecimal(-1),
      },
    ];
    const taxTotal = calculateTaxTotal(lines);
    const monetaryTotal = calculateMonetaryTotal(lines, taxTotal);
    expect(() =>
      validateInvoice({
        id: "I1",
        issueDate: new Date(Date.UTC(2024, 0, 1)),
        dueDate: new Date(Date.UTC(2024, 0, 2)),
        type: InvoiceType.INVOICE,
        currency: "USD",
        seller,
        buyer,
        lineItems: lines,
        taxTotal,
        monetaryTotal,
      }),
    ).toThrow(ZodError);
  });

  it("rejects issue date more than one day in the future", () => {
    const far = new Date();
    far.setUTCDate(far.getUTCDate() + 5);
    const lines = [baseLine()];
    const taxTotal = calculateTaxTotal(lines);
    const monetaryTotal = calculateMonetaryTotal(lines, taxTotal);

    expect(() =>
      validateInvoice({
        id: "I1",
        issueDate: far,
        dueDate: far,
        type: InvoiceType.INVOICE,
        currency: "USD",
        seller,
        buyer,
        lineItems: lines,
        taxTotal,
        monetaryTotal,
      }),
    ).toThrow(ZodError);
  });

  it("rejects Z tax category without exemption fields", () => {
    const lines = [
      {
        ...baseLine(),
        taxCategory: {
          id: "Z" as const,
          percent: toDecimal(0),
          scheme: "VAT" as const,
        },
      },
    ];
    const taxTotal = calculateTaxTotal(lines);
    const monetaryTotal = calculateMonetaryTotal(lines, taxTotal);
    expect(() =>
      validateInvoice({
        id: "I1",
        issueDate: new Date(Date.UTC(2024, 0, 1)),
        dueDate: new Date(Date.UTC(2024, 0, 2)),
        type: InvoiceType.INVOICE,
        currency: "USD",
        seller,
        buyer,
        lineItems: lines,
        taxTotal,
        monetaryTotal,
      }),
    ).toThrow(ZodError);
  });

  it("rejects inconsistent monetary total", () => {
    const lines = [baseLine()];
    const taxTotal = calculateTaxTotal(lines);
    const badMonetary = {
      ...calculateMonetaryTotal(lines, taxTotal),
      payableAmount: new DECIMAL_CTOR(999),
    };
    expect(() =>
      validateInvoice({
        id: "I1",
        issueDate: new Date(Date.UTC(2024, 0, 1)),
        dueDate: new Date(Date.UTC(2024, 0, 2)),
        type: InvoiceType.INVOICE,
        currency: "USD",
        seller,
        buyer,
        lineItems: lines,
        taxTotal,
        monetaryTotal: badMonetary,
      }),
    ).toThrow(ZodError);
  });
});
