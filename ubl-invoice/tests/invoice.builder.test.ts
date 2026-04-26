import { describe, expect, it } from "vitest";
import { InvoiceBuilder, InvoiceBuilderError } from "../src/builders/invoice.builder.js";
import { InvoiceType } from "../src/types/invoice.types.js";

describe("InvoiceBuilder", () => {
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

  it("builds a valid invoice with expected id and line totals", () => {
    const inv = new InvoiceBuilder()
      .setId("INV-1")
      .setIssueDate(new Date(Date.UTC(2024, 0, 10)))
      .setDueDate(new Date(Date.UTC(2024, 1, 10)))
      .setType(InvoiceType.INVOICE)
      .setCurrency("USD")
      .setSeller(seller)
      .setBuyer(buyer)
      .addLineItem({
        id: "1",
        description: "Item A",
        quantity: 2,
        unitCode: "C62",
        unitPrice: 50,
        taxCategory: { id: "S", percent: 10, scheme: "VAT" },
      })
      .build();

    expect(inv.id).toBe("INV-1");
    expect(inv.lineItems).toHaveLength(1);
    expect(inv.taxTotal.taxAmount.toFixed(2)).toBe("10.00");
    expect(inv.monetaryTotal.payableAmount.toFixed(2)).toBe("110.00");
  });

  it("throws InvoiceBuilderError when build is incomplete", () => {
    expect(() =>
      new InvoiceBuilder()
        .setId("X")
        .setIssueDate(new Date())
        .setDueDate(new Date())
        .setType(InvoiceType.INVOICE)
        .setCurrency("USD")
        .setSeller(seller)
        .setBuyer(buyer)
        .build(),
    ).toThrow(InvoiceBuilderError);
  });
});
