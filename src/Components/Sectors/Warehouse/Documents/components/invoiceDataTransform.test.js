import { describe, expect, it } from "vitest";
import { transformSummaryDocumentToInvoiceData } from "./invoiceDataTransform";

// Реальный формат documents[] из GET /warehouse/summaries/{id}/ (июль 2026)
const snapshotDoc = {
  id: "8345be78-f4f5-4fb3-ba7c-35dc5b115ddf",
  number: "SALE-20260622-0003",
  date: "2026-06-22",
  agent: "Асаналиев Урмат",
  client: "тест контрагент",
  address: "",
  quantity: "1.000",
  weight: "0.000",
  amount: "100.00",
  items: [
    {
      name: "TTTTTTTTTTTTTTTTTTT",
      unit: "шт",
      quantity: "1.000",
      price: "100.00",
      discount_percent: "0.00",
      discount_amount: "0.00",
      amount: "100.00",
      weight: "0.000",
    },
  ],
};

const company = { id: "c1", name: "ОсОО Тест", inn: "123", address: "Бишкек" };

describe("transformSummaryDocumentToInvoiceData", () => {
  it("строит данные накладной из снапшота сводки (номер, стороны, позиции, итоги)", () => {
    const data = transformSummaryDocumentToInvoiceData(
      snapshotDoc,
      company,
      "JAY",
    );
    expect(data.doc_type).toBe("SALE");
    expect(data.document.number).toBe("SALE-20260622-0003");
    expect(data.document.date).toBe("2026-06-22");
    expect(data.seller.name).toBe("ОсОО Тест");
    expect(data.buyer.name).toBe("тест контрагент");
    expect(data.warehouse).toBe("JAY");
    // позиции передаются как есть — их читает buildInvoiceItemsFromData
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("TTTTTTTTTTTTTTTTTTT");
    expect(data.totals.subtotal).toBe("100.00");
    expect(data.totals.total).toBe("100.00");
    expect(data.totals.discount_total).toBe("0.00");
  });

  it("считает скидку как разницу подытога и суммы документа", () => {
    const data = transformSummaryDocumentToInvoiceData(
      {
        ...snapshotDoc,
        amount: "90.00",
        items: [
          {
            ...snapshotDoc.items[0],
            discount_percent: "10.00",
            discount_amount: "10.00",
            amount: "90.00",
          },
        ],
      },
      company,
    );
    expect(data.totals.subtotal).toBe("100.00");
    expect(data.totals.total).toBe("90.00");
    expect(data.totals.discount_total).toBe("10.00");
  });

  it("без контрагента buyer = null, без sdoc — null", () => {
    const data = transformSummaryDocumentToInvoiceData(
      { ...snapshotDoc, client: "" },
      company,
    );
    expect(data.buyer).toBeNull();
    expect(transformSummaryDocumentToInvoiceData(null, company)).toBeNull();
  });
});
