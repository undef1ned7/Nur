import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import OwnerAnalyticsContent from "./OwnerAnalyticsContent";

// Ответ текущего бэкенда (до правок из docs/warehouse/analytics-calculation-fixes.md)
const OLD_RESPONSE = {
  summary: {
    requests_approved: 2,
    items_approved: "15.000",
    sales_count: 3,
    sales_amount: "1000.00",
    gross_sales_amount: "1100.00",
    on_hand_qty: "8.000",
    on_hand_amount: "400.00",
    money_receipt_amount: "500.00",
  },
  charts: { sales_by_date: [], money_by_date: [] },
  top_agents: {
    by_sales: [{ agent_id: "a1", agent_name: "Бакыт", sales_count: 2, sales_amount: "550.00" }],
    by_received: [],
  },
  details: {
    warehouses: [
      { warehouse_id: "w1", warehouse_name: "Главный", sales_count: 3, sales_amount: "1000.00", on_hand_qty: "8.000", on_hand_amount: "400.00" },
    ],
  },
};

// Ответ после правок бэкенда (контракт §4 analytics-calculation-fixes + §5 analytics-coverage)
const NEW_RESPONSE = {
  summary: {
    ...OLD_RESPONSE.summary,
    sales_count: 14,
    sales_amount: "1200.00",
    agent_sales_count: 10,
    agent_sales_amount: "1000.00",
    own_sales_count: 4,
    own_sales_amount: "200.00",
    pending_cash_sales_count: 1,
    pending_cash_sales_amount: "50.00",
    revenue_by_payment_kind: { cash: "900.00", credit: "300.00", external: "0.00" },
    warehouse_on_hand_qty: "321057.000",
    warehouse_on_hand_amount: "9000.00",
    warehouse_on_hand_purchase_amount: "6000.00",
    agent_on_hand_qty: "8.000",
    agent_on_hand_amount: "400.00",
    purchases_count: 12,
    purchases_amount: "7276507.00",
    net_purchases_amount: "7276507.00",
    revenue_amount: "1200.00",
    cogs_amount: "700.00",
    gross_profit_amount: "500.00",
    gross_margin_percent: "41.67",
    salary_accrued_amount: "758240.00",
    salary_paid_amount: "0.00",
    salary_payable_amount: "758240.00",
    written_off_qty: "3.000",
    written_off_cost: "150.00",
    cost_is_estimated: true,
  },
  charts: { sales_by_date: [], money_by_date: [] },
  top_agents: {
    total_sales_amount: "1000.00",
    by_sales: [{ agent_id: "a1", agent_name: "Бакыт", sales_count: 2, sales_amount: "550.00", share_percent: "55.00" }],
    by_received: [],
  },
  details: {
    warehouses: [
      {
        warehouse_id: "w1",
        warehouse_name: "Главный",
        sales_count: 3,
        sales_amount: "1000.00",
        warehouse_on_hand_qty: "321057.000",
        warehouse_on_hand_amount: "9000.00",
        warehouse_on_hand_purchase_amount: "6000.00",
        agent_on_hand_qty: "8.000",
      },
    ],
    purchases_by_supplier: [{ counterparty_id: "c1", name: "Поставщик 1", docs_count: 3, amount: "7276507.00" }],
    salary_by_agent: [{ agent_id: "a1", agent_name: "Бакыт", accrued: "758240.00", paid: "0.00", payable: "758240.00" }],
    profit_by_product: [{ product_id: "p1", product_name: "Нори", qty: "10", revenue: "1200", cogs: "700", profit: "500", margin_percent: "41.67" }],
  },
};

const kpiByLabel = (label) =>
  screen
    .getAllByText(label)
    .find((el) => el.classList.contains("warehouse-analytics__kpiLabel"))
    ?.closest(".warehouse-analytics__kpi");

describe("OwnerAnalyticsContent", () => {
  afterEach(cleanup);

  it("старый ответ: продажи подписаны как агентские, остаток — у агентов, склада нет", () => {
    render(<OwnerAnalyticsContent data={OLD_RESPONSE} />);

    expect(screen.getByText("Сумма продаж агентов")).toBeInTheDocument();
    expect(within(kpiByLabel("У агентов на руках, шт")).getByText("8")).toBeInTheDocument();
    expect(screen.queryByText("На складах, шт")).not.toBeInTheDocument();
    expect(screen.queryByText("Итоги за период")).not.toBeInTheDocument();
    expect(screen.queryByText("Закупки")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Выручка:/)).not.toBeInTheDocument();
  });

  it("старый ответ: доля агента — от всех продаж агентов (gross), а не от топ-10", () => {
    render(<OwnerAnalyticsContent data={OLD_RESPONSE} />);
    // 550 из 1100 = 50%, раньше было бы 100% (единственная строка топа)
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Документов")).toBeInTheDocument();
  });

  it("старый ответ: в таблице «Склады» остаток склада неизвестен — прочерк, а не остаток агентов", () => {
    render(<OwnerAnalyticsContent data={OLD_RESPONSE} />);
    const row = screen.getByText("Главный").closest("tr");
    // Аккордеон «Склады» свёрнут (hidden), поэтому ячейки берём напрямую из DOM
    const cells = Array.from(row.querySelectorAll("td")).map((c) => c.textContent);
    // На складе, Продажная, Закупочная — прочерк; У агентов — 8
    expect(cells.slice(5)).toEqual(["—", "—", "—", "8"]);
  });

  it("новый ответ: все продажи с разбивкой, склад отдельно от агентов, новые блоки", () => {
    render(<OwnerAnalyticsContent data={NEW_RESPONSE} />);

    expect(kpiByLabel("Сумма продаж")).toBeInTheDocument();
    expect(screen.getByText(/Из них агенты:/)).toBeInTheDocument();
    expect(screen.getByText("Ожидают подтверждения кассы")).toBeInTheDocument();
    expect(screen.getByText("Выручка: оплата сразу")).toBeInTheDocument();
    expect(screen.getByText("Выручка: в долг")).toBeInTheDocument();

    expect(within(kpiByLabel("На складах, шт")).getByText("321 057")).toBeInTheDocument();
    expect(screen.getByText("На складах по закупке, сом")).toBeInTheDocument();

    expect(screen.getByText("Итоги за период")).toBeInTheDocument();
    expect(screen.getByText("Валовая прибыль")).toBeInTheDocument();
    expect(screen.getByText("Маржа 41,7%")).toBeInTheDocument();
    expect(screen.getAllByText(/Себестоимость части продаж оценочная/).length).toBeGreaterThan(0);

    expect(screen.getByText("55%")).toBeInTheDocument();

    for (const title of ["Закупки", "Движение товара", "Зарплата агентов", "Прибыль по товарам"]) {
      expect(screen.getByRole("button", { name: new RegExp(title) })).toBeInTheDocument();
    }
  });

  it("агент: закупки, прибыль и зарплата не показываются", () => {
    render(
      <OwnerAnalyticsContent
        data={NEW_RESPONSE}
        showMoneyAnalytics={false}
        showDetailsAccordions={false}
        salesCountLabel="Количество моих продаж"
        salesAmountLabel="Сумма моих продаж"
      />,
    );
    expect(screen.getByText("Сумма моих продаж")).toBeInTheDocument();
    expect(screen.queryByText(/Из них агенты:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Итоги за период")).not.toBeInTheDocument();
    expect(screen.queryByText("На складах по закупке, сом")).not.toBeInTheDocument();
  });
});
