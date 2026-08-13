export const EMPTY_CLIENT_KPIS = {
  debt: { amount: 0, count: 0 },
  prepayment: { amount: 0, count: 0 },
  sale: { amount: 0, count: 0 },
};

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

export function parseKpiMoney(raw) {
  if (raw == null || raw === "") return 0;
  const num = Number(String(raw).replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

export function parseKpiCount(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function readBucket(raw, amountKeys, countKeys) {
  const rec = asRecord(raw);
  if (rec) {
    const amountSource = amountKeys
      .map((key) => rec[key])
      .find((value) => value != null && value !== "");
    const countSource = countKeys
      .map((key) => rec[key])
      .find((value) => value != null && value !== "");
    return {
      amount: parseKpiMoney(amountSource),
      count: parseKpiCount(countSource),
    };
  }
  return { amount: 0, count: 0 };
}

function dealKind(deal) {
  const kind = String(deal?.kind || "sale").toLowerCase();
  if (kind === "debt") return "debt";
  if (kind === "prepayment") return "prepayment";
  return "sale";
}

/** Фолбэк, пока бэк не отдаёт KPI. Формула совпадает с контрактом. */
export function aggregateClientKpisFromDeals(deals) {
  const next = {
    debt: { amount: 0, count: 0 },
    prepayment: { amount: 0, count: 0 },
    sale: { amount: 0, count: 0 },
  };

  for (const deal of Array.isArray(deals) ? deals : []) {
    const kind = dealKind(deal);
    if (kind === "debt") {
      next.debt.amount += parseKpiMoney(deal.remaining_debt);
      next.debt.count += 1;
      const prepaid = parseKpiMoney(deal.prepayment);
      if (prepaid > 0) {
        next.prepayment.amount += prepaid;
        next.prepayment.count += 1;
      }
      continue;
    }
    if (kind === "prepayment") {
      next.prepayment.amount += parseKpiMoney(deal.amount);
      next.prepayment.count += 1;
      continue;
    }
    next.sale.amount += parseKpiMoney(deal.amount);
    next.sale.count += 1;
  }

  next.debt.amount = Number(next.debt.amount.toFixed(2));
  next.prepayment.amount = Number(next.prepayment.amount.toFixed(2));
  next.sale.amount = Number(next.sale.amount.toFixed(2));
  return next;
}

export function mapClientKpis(raw) {
  const root = asRecord(raw);
  const payload = asRecord(root?.kpis) || root;
  if (!payload) return { ...EMPTY_CLIENT_KPIS };

  const nestedDebt = asRecord(payload.debt);
  const nestedPrepayment =
    asRecord(payload.prepayment) || asRecord(payload.advance);
  const nestedSale = asRecord(payload.sale) || asRecord(payload.sales);

  if (nestedDebt || nestedPrepayment || nestedSale) {
    return {
      debt: readBucket(
        nestedDebt,
        ["amount", "total", "remaining_debt", "debt_amount", "value"],
        ["count", "deals_count", "debt_count"],
      ),
      prepayment: readBucket(
        nestedPrepayment,
        ["amount", "total", "prepayment_amount", "advance_amount", "value"],
        ["count", "deals_count", "prepayment_count", "advance_count"],
      ),
      sale: readBucket(
        nestedSale,
        ["amount", "total", "sale_amount", "sales_amount", "value"],
        ["count", "deals_count", "sale_count", "sales_count"],
      ),
    };
  }

  return {
    debt: {
      amount: parseKpiMoney(
        payload.debt_amount ?? payload.remaining_debt ?? payload.total_debt,
      ),
      count: parseKpiCount(payload.debt_count ?? payload.deals_debt_count),
    },
    prepayment: {
      amount: parseKpiMoney(
        payload.prepayment_amount ?? payload.advance_amount,
      ),
      count: parseKpiCount(payload.prepayment_count ?? payload.advance_count),
    },
    sale: {
      amount: parseKpiMoney(
        payload.sale_amount ?? payload.sales_amount ?? payload.sales_total,
      ),
      count: parseKpiCount(payload.sale_count ?? payload.sales_count),
    },
  };
}
