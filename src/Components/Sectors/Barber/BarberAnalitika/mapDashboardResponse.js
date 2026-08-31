import { toNum } from "./BarberAnalitikaUtils";

const emptyWeekChart = () => [0, 0, 0, 0, 0, 0, 0];

const emptyDayLineChart = () => ({
  labels: [],
  income: [],
  expense: [],
});

const mapRankRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id ?? row.master_id ?? row.service_id ?? row.client_id ?? row.name,
    name: row.name ?? row.master_name ?? row.service_name ?? "—",
    count: toNum(row.count),
    sum: toNum(row.sum ?? row.revenue),
  }));

const mapClientsSalesRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id ?? row.client_id ?? row.name,
    name: row.name ?? "—",
    orders: toNum(row.orders ?? row.count),
    revenue: toNum(row.revenue ?? row.sum),
  }));

const mapBookingsStatuses = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    status: row.status ?? "",
    label: row.label ?? row.status ?? "—",
    count: toNum(row.count),
  }));

const mapTopServicesByBookings = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id ?? row.service_id ?? row.name,
    name: row.name ?? row.service_name ?? "—",
    count: toNum(row.count),
  }));

const mapMoneyRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    source: row.source ?? "—",
    title: row.title ?? row.description ?? "—",
    amount: toNum(row.amount),
    date: row.date ?? "—",
  }));

const mapCashRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id ?? row.cashbox_id ?? row.name,
    name: row.name ?? "Касса",
    ops: toNum(row.ops ?? row.operations),
    income: toNum(row.income),
    expense: toNum(row.expense),
  }));

const mapProductRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    name: row.name ?? "—",
    qty: toNum(row.qty ?? row.quantity),
    revenue: toNum(row.revenue),
  }));

const mapSupplierRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id ?? row.supplier_id ?? row.name,
    name: row.name ?? "—",
    items: toNum(row.items ?? row.positions),
    amount: toNum(row.amount ?? row.sum),
  }));

/**
 * Преобразует ответ GET /barbershop/analytics/dashboard/ в формат useBarberAnalitikaData.
 * @param {object|null|undefined} data
 */
export function mapDashboardResponse(data) {
  const totals = data?.totals ?? {};
  const cash = data?.cash ?? {};
  const charts = data?.charts ?? {};
  const rankings = data?.rankings ?? {};
  const bookings = data?.bookings ?? {};
  const products = data?.products ?? {};
  const details = data?.details ?? {};

  const completedSum = toNum(totals.revenue_completed ?? totals.revenue);
  const unifiedIncome = toNum(
    totals.income_unified ?? totals.income ?? completedSum + toNum(cash.totals?.income),
  );
  const saleFund = toNum(totals.sale_fund ?? totals.master_payouts);
  const unifiedExpense = toNum(
    totals.expense_unified ?? totals.expense ?? saleFund + toNum(cash.totals?.expense),
  );

  const productsRowsAgg = mapProductRows(products.sales_rows);
  const clientsSalesRows = mapClientsSalesRows(rankings.clients_sales);

  const goodsSummary = {
    totalQty: toNum(products.summary?.total_qty ?? products.goods_summary?.total_qty),
    totalRevenue: toNum(
      products.summary?.total_revenue ?? products.goods_summary?.total_revenue,
    ),
  };

  const salesClientsSummary = {
    activeClients: toNum(totals.clients_market_active),
    totalRevenue: clientsSalesRows.reduce((acc, row) => acc + row.revenue, 0),
  };

  const dayLineChart = charts.daily_cashflow
    ? {
        labels: Array.isArray(charts.daily_cashflow.labels)
          ? charts.daily_cashflow.labels
          : [],
        income: (charts.daily_cashflow.income ?? []).map(toNum),
        expense: (charts.daily_cashflow.expense ?? []).map(toNum),
      }
    : emptyDayLineChart();

  const weekChart = Array.isArray(charts.weekday_appointments)
    ? charts.weekday_appointments.map(toNum)
    : emptyWeekChart();

  const cashTotals = {
    income: toNum(cash.totals?.income),
    expense: toNum(cash.totals?.expense),
    net: toNum(cash.totals?.net ?? cash.totals?.income - cash.totals?.expense),
  };

  const stock = products.stock ?? {};

  return {
    totalApps: toNum(totals.appointments_total),
    totalServices: toNum(totals.services_total),
    totalClientsBarber: toNum(totals.clients_barber_total),
    totalClientsMarket: toNum(totals.clients_market_total),
    completedCount: toNum(totals.appointments_completed),
    completedSum,
    canceledCount: toNum(totals.appointments_canceled),
    noShowCount: toNum(totals.appointments_no_show),
    rankBarbers: mapRankRows(rankings.masters),
    rankServices: mapRankRows(rankings.services),
    rankClientsVisits: mapRankRows(rankings.clients_visits),
    stockKpis: {
      positions: toNum(stock.positions),
      totalQty: toNum(stock.total_qty),
      stockValueRetail: toNum(stock.stock_value_retail),
    },
    cashRows: mapCashRows(cash.by_cashbox),
    cashTotals,
    productsRowsAgg,
    suppliersRows: mapSupplierRows(products.suppliers_rows),
    clientsSalesRows,
    unifiedIncome,
    unifiedExpense,
    goodsSummary,
    salesClientsSummary,
    saleFund,
    weekChart,
    dayLineChart,
    bookingsStatusesData: mapBookingsStatuses(bookings.statuses),
    topServicesByBookings: mapTopServicesByBookings(bookings.top_services),
    incomeDetailsRows: mapMoneyRows(details.income),
    expenseDetailsRows: mapMoneyRows(details.expense),
    defaultCashboxId:
      data?.navigation?.default_cashbox_id ??
      data?.navigation?.default_cashbox?.id ??
      null,
  };
}

export const emptyDashboardData = () =>
  mapDashboardResponse({
    totals: {},
    cash: { totals: {}, by_cashbox: [] },
    charts: {
      weekday_appointments: emptyWeekChart(),
      daily_cashflow: emptyDayLineChart(),
    },
    rankings: {},
    bookings: {},
    products: {},
    details: {},
    navigation: {},
  });
