import React from "react";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";

// В тестовой среде public/ не раздаётся по «/fonts/...», поэтому регистрируем
// Roboto напрямую из файлов репозитория.
vi.mock("@/pdf/registerFonts", () => {
  let done = false;
  return {
    registerPdfFonts: async () => {
      if (done) return;
      const { Font } = await import("@react-pdf/renderer");
      const dir = path.resolve(process.cwd(), "public/fonts/roboto");
      Font.register({
        family: "Roboto",
        fonts: [
          { src: path.join(dir, "Roboto-Regular.ttf"), fontWeight: "normal" },
          { src: path.join(dir, "Roboto-Bold.ttf"), fontWeight: "bold" },
        ],
      });
      done = true;
    },
  };
});

const makeInvoice = (itemsCount, number) => ({
  doc_type: "SALE",
  document: { number, datetime: "2026-07-16T10:00:00", comment: "" },
  seller: { name: "ОсОО Тест", address: "г. Бишкек", phone: "+996 555 123456" },
  buyer: { name: "Клиент", address: "Адрес клиента", phone: "" },
  warehouse: "Основной склад",
  items: Array.from({ length: itemsCount }, (_, i) => ({
    id: `it-${number}-${i}`,
    name: `Товар номер ${i + 1}`,
    qty: 2,
    price: 100,
    unit: "шт",
  })),
  totals: { subtotal: itemsCount * 200, total: itemsCount * 200 },
});

const summary = {
  name: "Сводка",
  number: "SV-1",
  date: "2026-07-16",
  created_at: "2026-07-16T09:00:00",
  warehouse: { name: "Основной склад" },
  type: "general",
  products: [],
  documents: [],
  totals: {},
};

const countPages = (buf) => {
  const m = buf.toString("latin1").match(/\/Count (\d+)/);
  return m ? Number(m[1]) : -1;
};

describe("SummaryPdfDocument — экземпляры накладных", () => {
  it("оценка высоты: короткая накладная меньше полстраницы, длинная — больше", async () => {
    const { estimateInvoiceContentHeight, INVOICE_HALF_PAGE_HEIGHT } =
      await import("../invoicePdfDocumentUtils");
    expect(
      estimateInvoiceContentHeight(makeInvoice(3, "S-1")),
    ).toBeLessThanOrEqual(INVOICE_HALF_PAGE_HEIGHT);
    expect(estimateInvoiceContentHeight(makeInvoice(40, "L-1"))).toBeGreaterThan(
      INVOICE_HALF_PAGE_HEIGHT,
    );
  });

  it("короткая накладная — два экземпляра на одном листе, длинная — на отдельных", async () => {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { default: SummaryPdfDocument } = await import("./SummaryPdfDocument");

    const [summaryOnly, withShort, withLong] = await Promise.all([
      renderToBuffer(<SummaryPdfDocument summary={summary} invoices={[]} />),
      renderToBuffer(
        <SummaryPdfDocument summary={summary} invoices={[makeInvoice(3, "S-1")]} />,
      ),
      renderToBuffer(
        <SummaryPdfDocument summary={summary} invoices={[makeInvoice(40, "L-1")]} />,
      ),
    ]);

    const base = countPages(summaryOnly);
    expect(base).toBeGreaterThanOrEqual(1);

    // Короткая накладная добавляет ровно один лист (оба экземпляра на нём)
    expect(countPages(withShort) - base).toBe(1);

    // Длинная печатается двумя отдельными экземплярами — чётное число листов, минимум 2
    const longPages = countPages(withLong) - base;
    expect(longPages).toBeGreaterThanOrEqual(2);
    expect(longPages % 2).toBe(0);
  }, 60000);
});
