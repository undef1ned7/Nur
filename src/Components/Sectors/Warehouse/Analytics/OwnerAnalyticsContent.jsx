import {
  Check,
  Package,
  ShoppingCart,
  Warehouse,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cashRegisterAmounts,
  cashRegisterRowLabel,
  formatNum,
  formatShortDate,
  moneyCategoryLabel,
} from "./warehouseAnalyticsShared";
import { AccordionItem, KpiCard, PaginatedTable } from "./warehouseAnalyticsUi";

const OwnerAnalyticsContent = ({
  data,
  showAgentSalesAnalytics = true,
  showMoneyAnalytics = true,
  showDetailsAccordions = true,
  salesCountLabel = "Количество продаж агентов",
  salesAmountLabel = "Сумма продаж агентов",
  idPrefix = "wa",
}) => {
  const summary = data?.summary || {};
  const charts = data?.charts || {};
  const topAgents = data?.top_agents || {};
  const details = data?.details || {};

  const salesByDate = Array.isArray(charts?.sales_by_date)
    ? charts.sales_by_date
    : [];
  const bySales = Array.isArray(topAgents?.by_sales) ? topAgents.by_sales : [];
  const byReceived = Array.isArray(topAgents?.by_received)
    ? topAgents.by_received
    : [];
  const warehouses = Array.isArray(details?.warehouses)
    ? details.warehouses
    : [];
  const salesByProduct = Array.isArray(details?.sales_by_product)
    ? details.sales_by_product
    : [];
  const salesByGroup = Array.isArray(details?.sales_by_group)
    ? details.sales_by_group
    : [];
  const moneyByDate = Array.isArray(charts?.money_by_date)
    ? charts.money_by_date
    : [];
  const cashByRegister = Array.isArray(details?.cash_by_register)
    ? details.cash_by_register
    : [];
  const moneyReceiptsByCategory = Array.isArray(
    details?.money_receipts_by_category,
  )
    ? details.money_receipts_by_category
    : [];
  const moneyExpensesByCategory = Array.isArray(
    details?.money_expenses_by_category,
  )
    ? details.money_expenses_by_category
    : [];

  const totalSalesAmount = bySales.reduce(
    (acc, a) => acc + Number(a.sales_amount ?? a.amount ?? 0),
    0,
  );
  const totalReceivedItems = byReceived.reduce(
    (acc, a) =>
      acc +
      Number(a.items_approved ?? a.items_received ?? a.items ?? a.count ?? 0),
    0,
  );

  const bySalesRows = bySales.map((a) => {
    const amount = Number(a.sales_amount ?? a.amount ?? 0);
    const count = formatNum(a.sales_count ?? a.count);
    const share =
      totalSalesAmount > 0
        ? `${Math.round((amount / totalSalesAmount) * 100)}%`
        : "—";
    return [
      a.agent_name || a.name || a.agent_display || a.id || "—",
      `${formatNum(amount)} сом`,
      `${count} шт`,
      share,
    ];
  });

  const byReceivedRows = byReceived.map((a) => {
    const items = Number(
      a.items_approved ?? a.items_received ?? a.items ?? a.count ?? 0,
    );
    const share =
      totalReceivedItems > 0
        ? `${Math.round((items / totalReceivedItems) * 100)}%`
        : "—";
    return [
      a.agent_name || a.name || a.agent_display || a.id || "—",
      `${formatNum(items)} шт`,
      share,
    ];
  });

  const salesChartData = salesByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    sum: Number(d.sum ?? d.amount ?? d.sales_amount ?? 0),
    count: Number(d.count ?? d.sales_count ?? 0),
  }));

  const moneyChartData = moneyByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    receipt: Number(
      d.receipt_amount ?? d.money_receipt_amount ?? d.receipt ?? 0,
    ),
    expense: Number(
      d.expense_amount ?? d.money_expense_amount ?? d.expense ?? 0,
    ),
    net: Number(
      d.net_amount ?? d.money_net_amount ?? d.balance ?? d.saldo ?? 0,
    ),
    debtReceipt: Number(d.money_debt_receipt_amount ?? 0),
    debtExpense: Number(d.money_debt_expense_amount ?? 0),
    debtNet: Number(d.money_debt_net_amount ?? 0),
    counterpartyReceipt: Number(d.money_counterparty_receipt_amount ?? 0),
    counterpartyExpense: Number(d.money_counterparty_expense_amount ?? 0),
    counterpartyNet: Number(d.money_counterparty_net_amount ?? 0),
  }));

  const requestsApproved = Number(summary.requests_approved ?? 0);
  const itemsApproved = Number(summary.items_approved ?? 0);
  const salesCount = Number(summary.sales_count ?? 0);
  const salesAmount = Number(summary.sales_amount ?? 0);
  const onHandQty = Number(summary.on_hand_qty ?? 0);
  const onHandAmount = Number(summary.on_hand_amount ?? 0);
  const moneyDocsCount = Number(summary.money_docs_count ?? 0);
  const moneyReceiptAmount = Number(summary.money_receipt_amount ?? 0);
  const moneyExpenseAmount = Number(summary.money_expense_amount ?? 0);
  const moneyNetRaw = summary.money_net_amount;
  const moneyNetAmount =
    moneyNetRaw != null && moneyNetRaw !== ""
      ? Number(moneyNetRaw)
      : moneyReceiptAmount - moneyExpenseAmount;
  const moneyDebtReceiptAmount = Number(summary.money_debt_receipt_amount ?? 0);
  const moneyDebtExpenseAmount = Number(summary.money_debt_expense_amount ?? 0);
  const moneyDebtNetRaw = summary.money_debt_net_amount;
  const moneyDebtNetAmount =
    moneyDebtNetRaw != null && moneyDebtNetRaw !== ""
      ? Number(moneyDebtNetRaw)
      : moneyDebtReceiptAmount - moneyDebtExpenseAmount;
  const moneyCounterpartyReceiptAmount = Number(
    summary.money_counterparty_receipt_amount ?? 0,
  );
  const moneyCounterpartyExpenseAmount = Number(
    summary.money_counterparty_expense_amount ?? 0,
  );
  const moneyCounterpartyNetRaw = summary.money_counterparty_net_amount;
  const moneyCounterpartyNetAmount =
    moneyCounterpartyNetRaw != null && moneyCounterpartyNetRaw !== ""
      ? Number(moneyCounterpartyNetRaw)
      : moneyCounterpartyReceiptAmount - moneyCounterpartyExpenseAmount;

  // Итого по всем графам (обычная касса + долги + контрагенты)
  const moneyTotalReceiptAmount =
    moneyReceiptAmount + moneyDebtReceiptAmount + moneyCounterpartyReceiptAmount;
  const moneyTotalExpenseAmount =
    moneyExpenseAmount + moneyDebtExpenseAmount + moneyCounterpartyExpenseAmount;

  const areaFillId = `${idPrefix}AreaFill`;

  return (
    <>
      <div className="warehouse-analytics__kpis">
        <KpiCard
          label="Одобрено заявок"
          value={formatNum(requestsApproved)}
          description="За период"
          icon={Check}
        />
        <KpiCard
          label="Одобрено позиций"
          value={formatNum(itemsApproved)}
          description="Товаров выдано"
          icon={Package}
        />
        {showAgentSalesAnalytics && (
          <>
            <KpiCard
              label={salesCountLabel}
              value={formatNum(salesCount)}
              description="За период"
              icon={ShoppingCart}
            />
            <KpiCard
              label={salesAmountLabel}
              value={`${formatNum(salesAmount)} сом`}
              icon={ShoppingCart}
            />
          </>
        )}
        {showMoneyAnalytics && (
          <>
            <KpiCard
              label="Документов по кассе"
              value={formatNum(moneyDocsCount)}
              description="Проведённые за период"
              icon={Wallet}
            />
            <KpiCard
              label="Приход по кассе"
              value={`${formatNum(moneyReceiptAmount)} сом`}
              description="Без долгов и контрагентов"
              icon={Wallet}
            />
            <KpiCard
              label="Расход по кассе"
              value={`${formatNum(moneyExpenseAmount)} сом`}
              description="Без долгов и контрагентов"
              icon={Wallet}
            />
            <KpiCard
              label="Сальдо"
              value={`${formatNum(moneyNetAmount)} сом`}
              description="Приход − расход (без долгов и контрагентов)"
              icon={Wallet}
            />
            <KpiCard
              label="Погашение долга"
              value={`${formatNum(moneyDebtReceiptAmount)} сом`}
              description="Поступления в счёт долга"
              icon={Wallet}
            />
            <KpiCard
              label="Выплаты по долгу"
              value={`${formatNum(moneyDebtExpenseAmount)} сом`}
              description="Отдельная графа долга"
              icon={Wallet}
            />
            <KpiCard
              label="Нетто по долгам"
              value={`${formatNum(moneyDebtNetAmount)} сом`}
              description="Погашение − выплаты"
              icon={Wallet}
            />
            <KpiCard
              label="Приход от контрагентов"
              value={`${formatNum(moneyCounterpartyReceiptAmount)} сом`}
              description="Операции с контрагентами"
              icon={Wallet}
            />
            <KpiCard
              label="Расход контрагентам"
              value={`${formatNum(moneyCounterpartyExpenseAmount)} сом`}
              description="Операции с контрагентами"
              icon={Wallet}
            />
            <KpiCard
              label="Нетто по контрагентам"
              value={`${formatNum(moneyCounterpartyNetAmount)} сом`}
              description="Приход − расход по контрагентам"
              icon={Wallet}
            />
            <KpiCard
              label="Всего пришло в кассу"
              value={`${formatNum(moneyTotalReceiptAmount)} сом`}
              description="Касса + долги + контрагенты"
              icon={Wallet}
            />
            <KpiCard
              label="Всего вышло из кассы"
              value={`${formatNum(moneyTotalExpenseAmount)} сом`}
              description="Касса + долги + контрагенты"
              icon={Wallet}
            />
          </>
        )}
        <KpiCard
          label="Остаток на руках, шт"
          value={formatNum(onHandQty)}
          icon={Package}
        />
        <KpiCard
          label="Остаток на руках, сом"
          value={`${formatNum(onHandAmount)} сом`}
          icon={Package}
        />
      </div>

      {(showAgentSalesAnalytics || showMoneyAnalytics) && (
      <div className="warehouse-analytics__chartsRow">
        {showAgentSalesAnalytics && (
          <div className="warehouse-analytics__card warehouse-analytics__card--chart">
            <div className="warehouse-analytics__cardTitle">Динамика продаж</div>
            <div className="warehouse-analytics__chartWrap">
              {salesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={salesChartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id={areaFillId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--wa-primary)"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--wa-primary)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--wa-border)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        v && v.length > 6 ? v.slice(0, 6) : v
                      }
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatNum(v)}
                    />
                    <Tooltip
                      formatter={(value) => [formatNum(value), "Продажи (сом)"]}
                      labelFormatter={(l) => `Дата: ${l}`}
                    />
                    <Legend
                      formatter={() => "Продажи (сом)"}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sum"
                      stroke="var(--wa-primary)"
                      strokeWidth={2}
                      fill={`url(#${areaFillId})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="warehouse-analytics__chartWrap--empty">
                  Нет данных за период.
                </div>
              )}
            </div>
          </div>
        )}

        {showMoneyAnalytics && (
        <div className="warehouse-analytics__card warehouse-analytics__card--chart">
          <div className="warehouse-analytics__cardTitle">
            Движение денег по датам (касса)
          </div>
          <div className="warehouse-analytics__chartWrap">
            {moneyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={moneyChartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--wa-border)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v && v.length > 6 ? v.slice(0, 6) : v
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatNum(v)}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${formatNum(value)} сом`,
                      name,
                    ]}
                    labelFormatter={(l) => `Дата: ${l}`}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="receipt"
                    name="Приход"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Расход"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Сальдо"
                    stroke="var(--wa-primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="debtNet"
                    name="Нетто по долгам"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="counterpartyNet"
                    name="Нетто по контрагентам"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="warehouse-analytics__chartWrap--empty">
                Нет данных по кассе за период.
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {showDetailsAccordions && (
      <div className="warehouse-analytics__accordion">
        {showAgentSalesAnalytics && (
          <>
            <AccordionItem
              id={`${idPrefix}-top-sales`}
              title="Топ агентов по продажам"
              icon={ShoppingCart}
              badge={bySalesRows.length ? `${bySalesRows.length}` : "0"}
              defaultOpen
            >
              <div className="warehouse-analytics__card warehouse-analytics__accCard">
                {bySalesRows.length > 0 ? (
                  <PaginatedTable
                    head={["Агент", "Продажи", "Кол-во", "Доля"]}
                    rows={bySalesRows}
                    colTemplate="1fr 120px 90px 70px"
                    numeric={[1, 2, 3]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">
                    Нет данных за период.
                  </div>
                )}
              </div>
            </AccordionItem>

            <AccordionItem
              id={`${idPrefix}-top-received`}
              title="Топ агентов по полученным товарам"
              icon={Package}
              badge={byReceivedRows.length ? `${byReceivedRows.length}` : "0"}
              defaultOpen={false}
            >
              <div className="warehouse-analytics__card warehouse-analytics__accCard">
                {byReceivedRows.length > 0 ? (
                  <PaginatedTable
                    head={["Агент", "Позиций", "Доля"]}
                    rows={byReceivedRows}
                    colTemplate="1fr 100px 70px"
                    numeric={[1, 2]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">
                    Нет данных за период.
                  </div>
                )}
              </div>
            </AccordionItem>
          </>
        )}

        <AccordionItem
          id={`${idPrefix}-warehouses`}
          title="Склады"
          icon={Warehouse}
          badge={warehouses.length ? `${warehouses.length}` : "0"}
          defaultOpen={false}
        >
          <div className="warehouse-analytics__card warehouse-analytics__accCard">
            {warehouses.length > 0 ? (
              <PaginatedTable
                head={[
                  "Склад",
                  "Заявок одобрено",
                  "Позиций одобрено",
                  "Продаж",
                  "Сумма продаж",
                  "Остаток, шт",
                  "Остаток, сом",
                ]}
                rows={warehouses.map((w) => [
                  w.warehouse_name ?? w.name ?? "—",
                  formatNum(w.carts_approved ?? w.requests_approved ?? 0),
                  formatNum(w.items_approved ?? 0),
                  formatNum(w.sales_count ?? 0),
                  `${formatNum(w.sales_amount ?? 0)} сом`,
                  formatNum(w.on_hand_qty ?? 0),
                  `${formatNum(w.on_hand_amount ?? 0)} сом`,
                ])}
                colTemplate="1.2fr 130px 150px 90px 130px 110px 130px"
                numeric={[1, 2, 3, 4, 5, 6]}
              />
            ) : (
              <div className="warehouse-analytics-table__empty">
                Нет данных по складам за период.
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem
          id={`${idPrefix}-cash-by-register`}
          title="Кассы и счета"
          icon={Wallet}
          badge={cashByRegister.length ? `${cashByRegister.length}` : "0"}
          defaultOpen={false}
        >
          <div className="warehouse-analytics__card warehouse-analytics__accCard">
            {cashByRegister.length > 0 ? (
              <PaginatedTable
                head={[
                  "Касса / счёт",
                  "Приход, сом",
                  "Расход, сом",
                  "Сальдо, сом",
                  "Долг +, сом",
                  "Долг −, сом",
                  "Нетто долг, сом",
                  "Контр. +, сом",
                  "Контр. −, сом",
                  "Нетто контр., сом",
                  "Документов",
                ]}
                rows={cashByRegister.map((r) => {
                  const amounts = cashRegisterAmounts(r);
                  return [
                    cashRegisterRowLabel(r),
                    formatNum(amounts.receipt),
                    formatNum(amounts.expense),
                    formatNum(amounts.net),
                    formatNum(amounts.debtReceipt),
                    formatNum(amounts.debtExpense),
                    formatNum(amounts.debtNet),
                    formatNum(amounts.counterpartyReceipt),
                    formatNum(amounts.counterpartyExpense),
                    formatNum(amounts.counterpartyNet),
                    formatNum(r.docs_count ?? 0),
                  ];
                })}
                colTemplate="1.2fr 90px 90px 90px 90px 90px 90px 90px 90px 90px 80px"
                numeric={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              />
            ) : (
              <div className="warehouse-analytics-table__empty">
                Нет данных по кассам за период.
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem
          id={`${idPrefix}-money-receipts-categories`}
          title="Приходы по категориям"
          icon={Wallet}
          badge={
            moneyReceiptsByCategory.length
              ? `${moneyReceiptsByCategory.length}`
              : "0"
          }
          defaultOpen={false}
        >
          <div className="warehouse-analytics__card warehouse-analytics__accCard">
            {moneyReceiptsByCategory.length > 0 ? (
              <PaginatedTable
                head={["Категория", "Сумма, сом", "Документов"]}
                rows={moneyReceiptsByCategory.map((r) => [
                  moneyCategoryLabel(r),
                  formatNum(r.amount ?? 0),
                  formatNum(r.docs_count ?? 0),
                ])}
                colTemplate="1fr 120px 100px"
                numeric={[1, 2]}
              />
            ) : (
              <div className="warehouse-analytics-table__empty">
                Нет приходов по категориям за период.
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem
          id={`${idPrefix}-money-expenses-categories`}
          title="Расходы по категориям"
          icon={Wallet}
          badge={
            moneyExpensesByCategory.length
              ? `${moneyExpensesByCategory.length}`
              : "0"
          }
          defaultOpen={false}
        >
          <div className="warehouse-analytics__card warehouse-analytics__accCard">
            {moneyExpensesByCategory.length > 0 ? (
              <PaginatedTable
                head={["Категория", "Сумма, сом", "Документов"]}
                rows={moneyExpensesByCategory.map((r) => [
                  moneyCategoryLabel(r),
                  formatNum(r.amount ?? 0),
                  formatNum(r.docs_count ?? 0),
                ])}
                colTemplate="1fr 120px 100px"
                numeric={[1, 2]}
              />
            ) : (
              <div className="warehouse-analytics-table__empty">
                Нет расходов по категориям за период.
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem
          id={`${idPrefix}-sales-by-product`}
          title="Продажи по товарам"
          icon={ShoppingCart}
          badge={salesByProduct.length ? `${salesByProduct.length}` : "0"}
          defaultOpen={false}
        >
          <div className="warehouse-analytics__card warehouse-analytics__accCard">
            {salesByProduct.length > 0 ? (
              <PaginatedTable
                head={["Товар", "Кол-во", "Сумма, сом"]}
                rows={salesByProduct.map((p) => [
                  p.product_name ?? p.name ?? "—",
                  formatNum(p.qty ?? p.quantity ?? 0),
                  formatNum(p.amount ?? 0),
                ])}
                colTemplate="1fr 100px 120px"
                numeric={[1, 2]}
              />
            ) : (
              <div className="warehouse-analytics-table__empty">
                Нет продаж по товарам за период.
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem
          id={`${idPrefix}-sales-by-group`}
          title="Продажи по группам"
          icon={ShoppingCart}
          badge={salesByGroup.length ? `${salesByGroup.length}` : "0"}
          defaultOpen={false}
        >
          <div className="warehouse-analytics__card warehouse-analytics__accCard">
            {salesByGroup.length > 0 ? (
              <PaginatedTable
                head={["Группа", "Документов", "Кол-во", "Сумма, сом"]}
                rows={salesByGroup.map((g) => [
                  g.group_name ?? "Без группы",
                  formatNum(g.docs_count ?? 0),
                  formatNum(g.qty ?? 0),
                  formatNum(g.amount ?? 0),
                ])}
                colTemplate="1fr 120px 120px 120px"
                numeric={[1, 2, 3]}
              />
            ) : (
              <div className="warehouse-analytics-table__empty">
                Нет продаж по группам за период.
              </div>
            )}
          </div>
        </AccordionItem>
      </div>
      )}
    </>
  );
};

export default OwnerAnalyticsContent;
