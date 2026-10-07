import { describe, expect, it } from "vitest";
import {
  buildPartnerSalesParams,
  normalizePartnerSalesResponse,
  paymentKindLabel,
  saleLineAmount,
  saleStatusMeta,
} from "./partnerSalesModel";

describe("buildPartnerSalesParams", () => {
  it("период, тип, страница; пустые фильтры не передаются", () => {
    expect(
      buildPartnerSalesParams({
        periodParams: { period: "month", date: "2026-10-05" },
        search: "  ",
      }),
    ).toEqual({
      period: "month",
      date: "2026-10-05",
      doc_type: "SALE",
      page: 1,
      page_size: 50,
    });
  });

  it("возвраты, статус, поиск, филиал партнёра", () => {
    expect(
      buildPartnerSalesParams({
        periodParams: { period: "custom", date_from: "2026-09-01", date_to: "2026-09-30" },
        docType: "SALE_RETURN",
        status: "CASH_PENDING",
        search: " ИП Асан ",
        partnerBranch: "b1",
        page: 3,
      }),
    ).toEqual({
      period: "custom",
      date_from: "2026-09-01",
      date_to: "2026-09-30",
      doc_type: "SALE_RETURN",
      status: "CASH_PENDING",
      search: "ИП Асан",
      partner_branch: "b1",
      page: 3,
      page_size: 50,
    });
  });
});

describe("normalizePartnerSalesResponse", () => {
  it("разбирает страницу и сводку", () => {
    const res = normalizePartnerSalesResponse({
      partner_company: { id: "p", name: "Сильвер Манас" },
      date_from: "2026-09-05",
      date_to: "2026-10-05",
      summary: { count: 120, amount: "45000.50", discount_amount: "300", items_qty: "512.000" },
      count: 120,
      next: "?page=2",
      previous: null,
      results: [{ id: "d1" }],
    });
    expect(res).toMatchObject({
      rows: [{ id: "d1" }],
      count: 120,
      next: "?page=2",
      previous: null,
      partnerName: "Сильвер Манас",
      summary: { count: 120, amount: 45000.5, discountAmount: 300, itemsQty: 512 },
    });
  });

  it("пустой ответ не падает", () => {
    expect(normalizePartnerSalesResponse(null)).toMatchObject({
      rows: [],
      count: 0,
      summary: { count: null, amount: null },
    });
  });
});

describe("saleLineAmount", () => {
  it("берёт net_amount от бэка", () => {
    expect(saleLineAmount({ net_amount: "90.00", qty: "1", price: "100" })).toBe(90);
  });

  it("без net_amount: qty × price − скидка", () => {
    expect(saleLineAmount({ qty: "3", price: "100", discount_amount: "30" })).toBe(270);
    expect(saleLineAmount({ qty: "1", price: "10", discount_amount: "50" })).toBe(0);
  });
});

describe("подписи", () => {
  it("статус и оплата", () => {
    expect(saleStatusMeta("POSTED").label).toBe("Проведён");
    expect(saleStatusMeta("CASH_PENDING").label).toBe("Ожидает кассы");
    expect(saleStatusMeta("WEIRD").label).toBe("WEIRD");
    expect(paymentKindLabel("credit")).toBe("В долг");
    expect(paymentKindLabel(null)).toBe("—");
  });
});
