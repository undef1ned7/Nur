import { memo } from "react";
import {
  ArrowLeftRight,
  Check,
  Coins,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
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
import {
  buildBusinessTotals,
  buildOnHand,
  buildRevenueByPaymentKind,
  buildSalesSummary,
  buildStockMovementRows,
  buildTopAgentsBySales,
  listOf,
  numOrNull,
  toNum,
} from "./warehouseAnalyticsModel";
import { AccordionItem, KpiCard, PaginatedTable } from "./warehouseAnalyticsUi";

const money = (v) => `${formatNum(v)} сом`;
const moneyOrDash = (v) => (v == null ? "—" : money(v));
const qtyOrDash = (v) => (v == null ? "—" : formatNum(v));
const percentOrDash = (v) =>
  v == null ? "—" : `${formatNum(Math.round(Number(v) * 10) / 10)}%`;

const OwnerAnalyticsContent = ({
  data,
  showAgentSalesAnalytics = true,
  showMoneyAnalytics = true,
  showDetailsAccordions = true,
  // Переопределение подписей (например, «Моя аналитика» агента).
  // Без них подписи выбираются по ответу бэкенда.
  salesCountLabel,
  salesAmountLabel,
  idPrefix = "wa",
}) => {
  const summary = data?.summary || {};
  const charts = data?.charts || {};
  const topAgents = data?.top_agents || {};
  const details = data?.details || {};

  const sales = buildSalesSummary(summary);
  const onHand = buildOnHand(summary);
  const topAgentsBySales = buildTopAgentsBySales(topAgents, summary);
  const revenueByPaymentKind = buildRevenueByPaymentKind(summary);
  // Закупки, прибыль и зарплата — только владельцу/админу
  const totals = showMoneyAnalytics ? buildBusinessTotals(summary) : null;
  const stockMovementRows = showDetailsAccordions
    ? buildStockMovementRows(summary)
    : null;

  const salesByDate = listOf(charts.sales_by_date);
  const moneyByDate = listOf(charts.money_by_date);
  const purchasesByDate = listOf(charts.purchases_by_date);
  const profitByDate = listOf(charts.profit_by_date);
  const byReceived = listOf(topAgents.by_received);
  const warehouses = listOf(details.warehouses);
  const salesByProduct = listOf(details.sales_by_product);
  const salesByGroup = listOf(details.sales_by_group);
  const cashByRegister = listOf(details.cash_by_register);
  const moneyReceiptsByCategory = listOf(details.money_receipts_by_category);
  const moneyExpensesByCategory = listOf(details.money_expenses_by_category);
  const purchasesBySupplier = listOf(details.purchases_by_supplier);
  const salaryByAgent = listOf(details.salary_by_agent);
  const profitByProduct = listOf(details.profit_by_product);
  const profitByAgent = listOf(details.profit_by_agent);

  const customSalesLabels = salesCountLabel != null || salesAmountLabel != null;
  const showSplitHints = sales.hasSplit && !customSalesLabels;
  // Без agent_sales_* бэкенд не говорит, чьи это продажи (там могут быть и продажи
  // без агента — QA B10), поэтому подпись нейтральная, а не «продажи агентов».
  const salesCountTitle = salesCountLabel ?? "Количество продаж";
  const salesAmountTitle = salesAmountLabel ?? "Сумма продаж";

  const totalReceivedItems = byReceived.reduce(
    (acc, a) =>
      acc +
      Number(a.items_approved ?? a.items_received ?? a.items ?? a.count ?? 0),
    0,
  );

  const bySalesRows = topAgentsBySales.map((a) => [
    a.name,
    money(a.amount),
    formatNum(a.docsCount),
    percentOrDash(a.sharePercent),
  ]);

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

  const purchasesChartData = purchasesByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    amount: toNum(d.amount),
  }));

  const profitChartData = profitByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    revenue: toNum(d.revenue),
    cogs: toNum(d.cogs),
    grossProfit: toNum(d.gross_profit),
  }));

  const requestsApproved = Number(summary.requests_approved ?? 0);
  const itemsApproved = Number(summary.items_approved ?? 0);
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

  // Итого по всем графам (обычная касса + долги + взаиморасчёты)
  const moneyTotalReceiptAmount =
    moneyReceiptAmount + moneyDebtReceiptAmount + moneyCounterpartyReceiptAmount;
  const moneyTotalExpenseAmount =
    moneyExpenseAmount + moneyDebtExpenseAmount + moneyCounterpartyExpenseAmount;

  const areaFillId = `${idPrefix}AreaFill`;
  const purchasesFillId = `${idPrefix}PurchasesFill`;

  const showPurchasesBlock =
    showMoneyAnalytics &&
    (purchasesBySupplier.length > 0 ||
      purchasesChartData.length > 0 ||
      Boolean(totals?.purchasesByPaymentKind));
  const showSalaryBlock =
    showMoneyAnalytics &&
    (salaryByAgent.length > 0 || totals?.salaryAccrued != null);
  const showProfitBlock =
    showMoneyAnalytics &&
    (profitByProduct.length > 0 || profitChartData.length > 0);
  const showProfitByAgentBlock =
    showMoneyAnalytics && showAgentSalesAnalytics && profitByAgent.length > 0;

  const totalsKpis = totals
    ? [
        totals.revenue != null && {
          key: "revenue",
          label: "Выручка",
          value: money(totals.revenue),
          description: "Продажи за вычетом возвратов",
          icon: ShoppingCart,
        },
        totals.cogs != null && {
          key: "cogs",
          label: "Себестоимость",
          value: money(totals.cogs),
          description: totals.costIsEstimated
            ? "Оценочная: часть по текущей закупочной цене"
            : "По закупочной цене на момент продажи",
          icon: Package,
        },
        totals.grossProfit != null && {
          key: "gross",
          label: "Валовая прибыль",
          value: money(totals.grossProfit),
          description:
            totals.grossMarginPercent != null
              ? `Маржа ${percentOrDash(totals.grossMarginPercent)}`
              : "Выручка − себестоимость",
          icon: TrendingUp,
        },
        totals.grossMarginPercent != null && {
          key: "margin",
          label: "Валовая маржа",
          value: percentOrDash(totals.grossMarginPercent),
          description: "Валовая прибыль / выручка",
          icon: TrendingUp,
        },
        totals.netPurchasesAmount != null && {
          key: "purchases",
          label: "Закупки",
          value: money(totals.netPurchasesAmount),
          description:
            totals.purchaseReturnsAmount
              ? `За вычетом возвратов поставщику: ${money(totals.purchaseReturnsAmount)}`
              : totals.purchasesCount != null
                ? `Документов: ${formatNum(totals.purchasesCount)}`
                : "Закупки и приходы товара",
          icon: Truck,
        },
        totals.writeoffLoss != null && {
          key: "writeoff",
          label: "Списания и недостачи",
          value: money(totals.writeoffLoss),
          description: "По закупочной цене",
          icon: Package,
        },
        totals.salaryExpense != null && {
          key: "salary",
          label: "Зарплата агентам",
          value: money(totals.salaryExpense),
          description:
            totals.salaryPayable != null
              ? `Начислено за период; к выплате всего: ${money(totals.salaryPayable)}`
              : "Начислено за период",
          icon: Users,
        },
        totals.operatingProfit != null && {
          key: "operating",
          label: "Операционная прибыль",
          value: money(totals.operatingProfit),
          description: "Валовая прибыль − списания − зарплата агентам",
          icon: Coins,
        },
      ].filter(Boolean)
    : [];

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
          label="Выдано агентам, шт"
          value={formatNum(itemsApproved)}
          description="По одобренным заявкам"
          icon={Package}
        />
        {showAgentSalesAnalytics && (
          <>
            <KpiCard
              label={salesCountTitle}
              value={formatNum(sales.count)}
              description={
                showSplitHints
                  ? `Из них агентами: ${formatNum(sales.agentCount)}`
                  : "За период"
              }
              icon={ShoppingCart}
            />
            <KpiCard
              label={salesAmountTitle}
              value={money(sales.amount)}
              description={
                showSplitHints
                  ? `Из них агенты: ${money(sales.agentAmount)}`
                  : sales.returnsAmount > 0
                    ? "За вычетом возвратов"
                    : undefined
              }
              icon={ShoppingCart}
            />
            {sales.returnsCount > 0 && (
              <KpiCard
                label="Возвраты"
                value={money(sales.returnsAmount)}
                description={
                  sales.grossAmount != null
                    ? `Документов: ${formatNum(sales.returnsCount)}; продажи до возвратов: ${money(sales.grossAmount)}`
                    : `Документов: ${formatNum(sales.returnsCount)}`
                }
                icon={ShoppingCart}
              />
            )}
            {sales.pendingCashCount > 0 && (
              <KpiCard
                label="Ожидают подтверждения кассы"
                value={moneyOrDash(sales.pendingCashAmount)}
                description={`Продаж: ${formatNum(sales.pendingCashCount)}. Товар отгружен, в выручке учтён`}
                icon={Wallet}
              />
            )}
            {revenueByPaymentKind?.map((row) => (
              <KpiCard
                key={`revenue-${row.key}`}
                label={`Выручка: ${row.label.toLowerCase()}`}
                value={money(row.amount)}
                description="По документам продаж"
                icon={Coins}
              />
            ))}
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
              value={money(moneyReceiptAmount)}
              description="Без долгов и взаиморасчётов с контрагентами"
              icon={Wallet}
            />
            <KpiCard
              label="Расход по кассе"
              value={money(moneyExpenseAmount)}
              description="Без долгов и взаиморасчётов с контрагентами"
              icon={Wallet}
            />
            <KpiCard
              label="Сальдо"
              value={money(moneyNetAmount)}
              description="Приход − расход (без долгов и взаиморасчётов)"
              icon={Wallet}
            />
            <KpiCard
              label="Погашение долга"
              value={money(moneyDebtReceiptAmount)}
              description="Поступления в счёт долга"
              icon={Wallet}
            />
            <KpiCard
              label="Выплаты по долгу"
              value={money(moneyDebtExpenseAmount)}
              description="Отдельная графа долга"
              icon={Wallet}
            />
            <KpiCard
              label="Нетто по долгам"
              value={money(moneyDebtNetAmount)}
              description="Погашение − выплаты"
              icon={Wallet}
            />
            <KpiCard
              label="Взаиморасчёты: приход"
              value={money(moneyCounterpartyReceiptAmount)}
              description="Ручные операции с контрагентами"
              icon={Wallet}
            />
            <KpiCard
              label="Взаиморасчёты: расход"
              value={money(moneyCounterpartyExpenseAmount)}
              description="Ручные операции с контрагентами"
              icon={Wallet}
            />
            <KpiCard
              label="Нетто по взаиморасчётам"
              value={money(moneyCounterpartyNetAmount)}
              description="Приход − расход по контрагентам"
              icon={Wallet}
            />
            <KpiCard
              label="Всего пришло в кассу"
              value={money(moneyTotalReceiptAmount)}
              description="Касса + долги + взаиморасчёты"
              icon={Wallet}
            />
            <KpiCard
              label="Всего вышло из кассы"
              value={money(moneyTotalExpenseAmount)}
              description="Касса + долги + взаиморасчёты"
              icon={Wallet}
            />
          </>
        )}
        {onHand.hasWarehouse && (
          <>
            {onHand.warehouseQty != null && (
              <KpiCard
                label="На складах, шт"
                value={formatNum(onHand.warehouseQty)}
                description="Текущий остаток"
                icon={Warehouse}
              />
            )}
            {onHand.warehouseAmount != null && (
              <KpiCard
                label="На складах, сом"
                value={money(onHand.warehouseAmount)}
                description="По продажной цене"
                icon={Warehouse}
              />
            )}
            {showMoneyAnalytics && onHand.warehousePurchaseAmount != null && (
              <KpiCard
                label="На складах по закупке, сом"
                value={money(onHand.warehousePurchaseAmount)}
                description="По закупочной цене"
                icon={Warehouse}
              />
            )}
          </>
        )}
        <KpiCard
          label="У агентов на руках, шт"
          value={formatNum(onHand.agentQty)}
          description="Личный остаток агентов"
          icon={Package}
        />
        <KpiCard
          label="У агентов на руках, сом"
          value={money(onHand.agentAmount)}
          description="По продажной цене"
          icon={Package}
        />
      </div>

      {totalsKpis.length > 0 && (
        <section className="warehouse-analytics__section">
          <h3 className="warehouse-analytics__sectionTitle">Итоги за период</h3>
          <div className="warehouse-analytics__kpis">
            {totalsKpis.map(({ key, ...kpi }) => (
              <KpiCard key={key} {...kpi} />
            ))}
          </div>
          {totals.costIsEstimated && (
            <p className="warehouse-analytics__note">
              Себестоимость части продаж оценочная: для документов, проведённых
              до фиксации закупочной цены в строке, взята текущая закупочная
              цена товара.
            </p>
          )}
        </section>
      )}

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
            Движение денег по кассе
          </div>
          <p className="warehouse-analytics__note">
            {revenueByPaymentKind
              ? "Наличные продажи агентов в кассу компании не проводятся — их выручка показана в карточках «Выручка» выше."
              : "Наличные продажи агентов в кассу компании не проводятся и на этом графике не видны."}
          </p>
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
                    name="Нетто по взаиморасчётам"
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
                    head={["Агент", "Продажи", "Документов", "Доля"]}
                    rows={bySalesRows}
                    colTemplate="1fr 120px 110px 80px"
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
                    head={["Агент", "Выдано, шт", "Доля"]}
                    rows={byReceivedRows}
                    colTemplate="1fr 110px 70px"
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
                  "Выдано агентам, шт",
                  "Продаж",
                  "Сумма продаж",
                  "На складе, шт",
                  "Продажная цена, сом",
                  "Закупочная цена, сом",
                  "У агентов, шт",
                ]}
                rows={warehouses.map((w) => {
                  const stock = buildOnHand(w);
                  return [
                    w.warehouse_name ?? w.name ?? "—",
                    formatNum(w.carts_approved ?? w.requests_approved ?? 0),
                    formatNum(w.items_approved ?? 0),
                    formatNum(w.sales_count ?? 0),
                    money(w.sales_amount ?? 0),
                    qtyOrDash(stock.warehouseQty),
                    moneyOrDash(stock.warehouseAmount),
                    moneyOrDash(stock.warehousePurchaseAmount),
                    formatNum(stock.agentQty),
                  ];
                })}
                colTemplate="1.2fr 120px 140px 80px 130px 110px 140px 150px 110px"
                numeric={[1, 2, 3, 4, 5, 6, 7, 8]}
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
                  "Взаим. +, сом",
                  "Взаим. −, сом",
                  "Нетто взаим., сом",
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

        {showPurchasesBlock && (
          <AccordionItem
            id={`${idPrefix}-purchases`}
            title="Закупки"
            icon={Truck}
            badge={
              purchasesBySupplier.length ? `${purchasesBySupplier.length}` : "0"
            }
            defaultOpen={false}
          >
            <div className="warehouse-analytics__card warehouse-analytics__accCard">
              {totals?.purchasesByPaymentKind && (
                <PaginatedTable
                  head={["Способ оплаты", "Сумма, сом"]}
                  rows={totals.purchasesByPaymentKind.map((r) => [
                    r.label,
                    formatNum(r.amount),
                  ])}
                  colTemplate="1fr 140px"
                  numeric={[1]}
                />
              )}
              {purchasesChartData.length > 0 && (
                <div className="warehouse-analytics__chartWrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={purchasesChartData}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id={purchasesFillId}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--wa-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNum(v)} />
                      <Tooltip
                        formatter={(value) => [money(value), "Закупки"]}
                        labelFormatter={(l) => `Дата: ${l}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill={`url(#${purchasesFillId})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {purchasesBySupplier.length > 0 ? (
                <PaginatedTable
                  head={["Поставщик", "Документов", "Сумма, сом"]}
                  rows={purchasesBySupplier.map((s) => [
                    s.name || "Без поставщика",
                    formatNum(s.docs_count ?? 0),
                    formatNum(s.amount ?? 0),
                  ])}
                  colTemplate="1fr 110px 140px"
                  numeric={[1, 2]}
                />
              ) : (
                <div className="warehouse-analytics-table__empty">
                  Нет закупок по поставщикам за период.
                </div>
              )}
            </div>
          </AccordionItem>
        )}

        {stockMovementRows && (
          <AccordionItem
            id={`${idPrefix}-stock-movement`}
            title="Движение товара"
            icon={ArrowLeftRight}
            badge={`${stockMovementRows.length}`}
            defaultOpen={false}
          >
            <div className="warehouse-analytics__card warehouse-analytics__accCard">
              <PaginatedTable
                head={["Операция", "Кол-во", "По закупочной цене, сом"]}
                rows={stockMovementRows.map((r) => [
                  r.label,
                  formatNum(r.qty),
                  r.cost == null ? "—" : formatNum(r.cost),
                ])}
                colTemplate="1fr 120px 180px"
                numeric={[1, 2]}
              />
            </div>
          </AccordionItem>
        )}

        {showSalaryBlock && (
          <AccordionItem
            id={`${idPrefix}-salary`}
            title="Зарплата агентов"
            icon={Users}
            badge={salaryByAgent.length ? `${salaryByAgent.length}` : "0"}
            defaultOpen={false}
          >
            <div className="warehouse-analytics__card warehouse-analytics__accCard">
              {totals && (
                <PaginatedTable
                  head={["Показатель", "Сумма, сом"]}
                  rows={[
                    ["Начислено за период", moneyOrDash(totals.salaryAccrued)],
                    ["Выплачено за период", moneyOrDash(totals.salaryPaid)],
                    ["К выплате (всего)", moneyOrDash(totals.salaryPayable)],
                  ]}
                  colTemplate="1fr 160px"
                  numeric={[1]}
                />
              )}
              {salaryByAgent.length > 0 ? (
                <PaginatedTable
                  head={["Агент", "Начислено", "Выплачено", "К выплате"]}
                  rows={salaryByAgent.map((a) => [
                    a.agent_name || a.agent_id || "—",
                    formatNum(a.accrued ?? 0),
                    formatNum(a.paid ?? 0),
                    formatNum(a.payable ?? 0),
                  ])}
                  colTemplate="1fr 120px 120px 120px"
                  numeric={[1, 2, 3]}
                />
              ) : (
                <div className="warehouse-analytics-table__empty">
                  Нет начислений за период.
                </div>
              )}
            </div>
          </AccordionItem>
        )}

        {showProfitBlock && (
          <AccordionItem
            id={`${idPrefix}-profit-by-product`}
            title="Прибыль по товарам"
            icon={TrendingUp}
            badge={profitByProduct.length ? `${profitByProduct.length}` : "0"}
            defaultOpen={false}
          >
            <div className="warehouse-analytics__card warehouse-analytics__accCard">
              {totals?.costIsEstimated && (
                <p className="warehouse-analytics__note">
                  Себестоимость частично оценочная (по текущей закупочной цене).
                </p>
              )}
              {profitChartData.length > 0 && (
                <div className="warehouse-analytics__chartWrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={profitChartData}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--wa-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNum(v)} />
                      <Tooltip
                        formatter={(value, name) => [money(value), name]}
                        labelFormatter={(l) => `Дата: ${l}`}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="cogs" name="Себестоимость" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="grossProfit" name="Валовая прибыль" stroke="var(--wa-primary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {profitByProduct.length > 0 ? (
                <PaginatedTable
                  head={["Товар", "Кол-во", "Выручка", "Себестоимость", "Прибыль", "Маржа"]}
                  rows={profitByProduct.map((p) => [
                    p.product_name ?? p.name ?? "—",
                    formatNum(p.qty ?? 0),
                    formatNum(p.revenue ?? 0),
                    formatNum(p.cogs ?? 0),
                    formatNum(p.profit ?? 0),
                    percentOrDash(numOrNull(p, "margin_percent")),
                  ])}
                  colTemplate="1fr 90px 120px 130px 120px 80px"
                  numeric={[1, 2, 3, 4, 5]}
                />
              ) : (
                <div className="warehouse-analytics-table__empty">
                  Нет данных о прибыли по товарам за период.
                </div>
              )}
            </div>
          </AccordionItem>
        )}

        {showProfitByAgentBlock && (
          <AccordionItem
            id={`${idPrefix}-profit-by-agent`}
            title="Прибыль по агентам"
            icon={TrendingUp}
            badge={`${profitByAgent.length}`}
            defaultOpen={false}
          >
            <div className="warehouse-analytics__card warehouse-analytics__accCard">
              <PaginatedTable
                head={["Агент", "Выручка", "Себестоимость", "Прибыль"]}
                rows={profitByAgent.map((a) => [
                  a.agent_name || a.agent_id || "—",
                  formatNum(a.revenue ?? 0),
                  formatNum(a.cogs ?? 0),
                  formatNum(a.profit ?? 0),
                ])}
                colTemplate="1fr 130px 130px 130px"
                numeric={[1, 2, 3]}
              />
            </div>
          </AccordionItem>
        )}
      </div>
      )}
    </>
  );
};

// memo: смена периода/филиала перерисовывает страницу, но пока данные те же,
// тяжёлые графики и таблицы пересчитывать не нужно (CPU ×6: фриз ~2 с).
export default memo(OwnerAnalyticsContent);
