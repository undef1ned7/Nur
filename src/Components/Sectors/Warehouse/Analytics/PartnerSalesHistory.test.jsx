import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PartnerSalesHistory from "./PartnerSalesHistory";

const listPartnerSales = vi.fn();
const getPartnerSale = vi.fn();

vi.mock("../../../../api/warehousePartnership", () => {
  class PartnershipApiError extends Error {
    constructor(status, data) {
      super("api");
      this.status = status;
      this.data = data;
    }
  }
  return {
    PartnershipApiError,
    isEndpointMissing: (err) =>
      err instanceof PartnershipApiError && err.status === 404 && typeof err.data !== "object",
    listPartnerSales: (...a) => listPartnerSales(...a),
    getPartnerSale: (...a) => getPartnerSale(...a),
  };
});

const { PartnershipApiError } = await import("../../../../api/warehousePartnership");

const salesPage = (overrides = {}) => ({
  partner_company: { id: "p1", name: "Сильвер Манас" },
  date_from: "2026-09-05",
  date_to: "2026-10-05",
  summary: { count: 2, amount: "1500.00", discount_amount: "50.00", items_qty: "7.000" },
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      id: "d1",
      doc_type: "SALE",
      number: "S-101",
      date: "2026-10-01T10:00:00+06:00",
      status: "POSTED",
      warehouse_from_name: "Основной",
      counterparty_display_name: "ИП Асан",
      agent_display: "Бекжан",
      items_count: 2,
      total: "1000.00",
    },
    {
      id: "d2",
      doc_type: "SALE",
      number: "S-102",
      date: "2026-10-02T10:00:00+06:00",
      status: "CASH_PENDING",
      warehouse_from_name: "Основной",
      counterparty_display_name: "ОсОО Береке",
      items_count: 1,
      total: "500.00",
    },
  ],
  ...overrides,
});

const renderPage = (url = "/crm/warehouse/partners/p1/sales") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/crm/warehouse/partners/:partnerId/sales" element={<PartnerSalesHistory />} />
      </Routes>
    </MemoryRouter>,
  );

describe("PartnerSalesHistory", () => {
  beforeEach(() => {
    listPartnerSales.mockReset();
    getPartnerSale.mockReset();
    listPartnerSales.mockResolvedValue(salesPage());
  });
  afterEach(cleanup);

  it("показывает сводку и документы, передаёт период, тип и филиал партнёра", async () => {
    renderPage("/crm/warehouse/partners/p1/sales?partner_branch=b1");

    expect(await screen.findByText("S-101")).toBeTruthy();
    expect(screen.getByText("История продаж: Сильвер Манас")).toBeTruthy();
    expect(screen.getByText("ИП Асан")).toBeTruthy();
    expect(screen.getByText("Ожидает кассы")).toBeTruthy();
    expect(screen.getByText("1 500 сом")).toBeTruthy();

    const [partnerId, params] = listPartnerSales.mock.calls[0];
    expect(partnerId).toBe("p1");
    expect(params).toMatchObject({
      period: "month",
      doc_type: "SALE",
      partner_branch: "b1",
      page: 1,
      page_size: 50,
    });
  });

  it("переключение на возвраты запрашивает SALE_RETURN с первой страницы", async () => {
    listPartnerSales.mockResolvedValue(salesPage({ count: 120, next: "?page=2" }));
    renderPage();
    await screen.findByText("S-101");

    fireEvent.click(screen.getByRole("button", { name: "Вперед" }));
    await waitFor(() =>
      expect(listPartnerSales.mock.calls.at(-1)[1]).toMatchObject({ page: 2, doc_type: "SALE" }),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Возвраты" }));
    await waitFor(() =>
      expect(listPartnerSales.mock.calls.at(-1)[1]).toMatchObject({
        page: 1,
        doc_type: "SALE_RETURN",
      }),
    );
  });

  it("фильтр по статусу", async () => {
    renderPage();
    await screen.findByText("S-101");
    fireEvent.click(screen.getByRole("tab", { name: "Ожидают кассы" }));
    await waitFor(() =>
      expect(listPartnerSales.mock.calls.at(-1)[1]).toMatchObject({ status: "CASH_PENDING" }),
    );
  });

  it("по клику открывает состав документа", async () => {
    getPartnerSale.mockResolvedValue({
      ...salesPage().results[0],
      payment_kind: "credit",
      items: [
        {
          id: "i1",
          product_name: "Нори",
          product_article: "N-1",
          unit: "шт",
          qty: "2.000",
          price: "300.00",
          discount_amount: "0",
          net_amount: "600.00",
        },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Документ S-101" }));

    const dialog = screen.getByRole("dialog", { name: "Продажа S-101" });
    expect(await within(dialog).findByText("Нори")).toBeTruthy();
    expect(within(dialog).getByText("600 сом")).toBeTruthy();
    expect(within(dialog).getByText("В долг")).toBeTruthy();
    expect(getPartnerSale).toHaveBeenCalledWith("p1", "d1");
  });

  it("старый бэк: понятное сообщение вместо ошибки", async () => {
    listPartnerSales.mockRejectedValue(new PartnershipApiError(404, "<h1>Not Found</h1>"));
    renderPage();
    expect(
      await screen.findByText(/станет доступна после обновления сервера/),
    ).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Возвраты" })).toBeNull();
  });

  it("партнёр скрыл историю: показываем причину от бэка", async () => {
    listPartnerSales.mockRejectedValue(
      new PartnershipApiError(403, {
        detail: "Партнёр скрыл историю продаж.",
        code: "sales_history_hidden",
      }),
    );
    renderPage();
    expect(await screen.findByText("Партнёр скрыл историю продаж.")).toBeTruthy();
  });
});
