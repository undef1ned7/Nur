import type { Decimal } from "../lib/decimal.js";
import { DECIMAL_CTOR, toDecimal } from "../lib/decimal.js";
import type { LineItem, MonetaryTotal, TaxSubtotal, TaxTotal } from "../types/invoice.types.js";

DECIMAL_CTOR.set({
  precision: 40,
  rounding: DECIMAL_CTOR.ROUND_HALF_UP,
});

/**
 * Format a monetary {@link Decimal} for UBL amounts (exactly two fraction digits).
 */
export function formatMoneyAmount(value: Decimal): string {
  return value.toDecimalPlaces(2, DECIMAL_CTOR.ROUND_HALF_UP).toFixed(2);
}

/**
 * Format a quantity for UBL (integer or decimal string as produced by Decimal.js).
 */
export function formatQuantity(value: Decimal): string {
  return value.toFixed();
}

/**
 * InvoicedQuantity for PEPPOL BIS / EN 16931 (exactly two fraction digits).
 */
export function formatInvoicedQuantity(value: Decimal): string {
  return value.toDecimalPlaces(2, DECIMAL_CTOR.ROUND_HALF_UP).toFixed(2);
}

/**
 * Format calendar date as `YYYY-MM-DD` (UTC).
 */
export function formatDateIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function lineExtension(line: LineItem): Decimal {
  return line.quantity.mul(line.unitPrice);
}

function taxOnLine(line: LineItem): Decimal {
  const ext = lineExtension(line);
  if (line.taxCategory.percent.isZero()) {
    return new DECIMAL_CTOR(0);
  }
  return ext.mul(line.taxCategory.percent).div(100);
}

/**
 * Aggregate {@link LineItem} lines into {@link TaxSubtotal} groups by tax category key.
 */
function groupTaxSubtotals(lines: readonly LineItem[]): TaxSubtotal[] {
  const map = new Map<
    string,
    { taxable: Decimal; tax: Decimal; category: LineItem["taxCategory"] }
  >();

  for (const line of lines) {
    const ext = lineExtension(line);
    const tax = taxOnLine(line);
    const key = `${line.taxCategory.id}:${line.taxCategory.percent.toString()}:${line.taxCategory.scheme}`;
    const cur = map.get(key);
    if (cur) {
      cur.taxable = cur.taxable.plus(ext);
      cur.tax = cur.tax.plus(tax);
    } else {
      map.set(key, {
        taxable: ext,
        tax,
        category: line.taxCategory,
      });
    }
  }

  return [...map.values()].map((v) => ({
    taxableAmount: v.taxable,
    taxAmount: v.tax,
    taxCategory: v.category,
  }));
}

/**
 * Compute document {@link TaxTotal} from line items.
 */
export function calculateTaxTotal(lineItems: readonly LineItem[]): TaxTotal {
  const taxSubtotals = groupTaxSubtotals(lineItems);
  const taxAmount = taxSubtotals.reduce(
    (acc, s) => acc.plus(s.taxAmount),
    new DECIMAL_CTOR(0),
  );
  return { taxAmount, taxSubtotals };
}

/**
 * Deterministic monetary totals from lines, tax total, and optional allowances/prepayments.
 */
export function calculateMonetaryTotal(
  lineItems: readonly LineItem[],
  taxTotal: TaxTotal,
  options?: { allowanceTotal?: Decimal; prepaidAmount?: Decimal },
): MonetaryTotal {
  const lineExtensionAmount = lineItems.reduce(
    (acc, line) => acc.plus(lineExtension(line)),
    new DECIMAL_CTOR(0),
  );

  const allowanceTotal = options?.allowanceTotal ?? new DECIMAL_CTOR(0);
  const prepaidAmount = options?.prepaidAmount ?? new DECIMAL_CTOR(0);

  const taxExclusiveAmount = lineExtensionAmount.minus(allowanceTotal);
  const taxInclusiveAmount = taxExclusiveAmount.plus(taxTotal.taxAmount);
  const payableAmount = taxInclusiveAmount.minus(prepaidAmount);

  return {
    lineExtensionAmount,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    allowanceTotal: allowanceTotal.isZero() ? undefined : allowanceTotal,
    prepaidAmount: prepaidAmount.isZero() ? undefined : prepaidAmount,
  };
}

/**
 * Convenience: {@link calculateTaxTotal} + {@link calculateMonetaryTotal} with no allowance/prepaid.
 */
export function calculateTotals(lineItems: readonly LineItem[]): MonetaryTotal {
  const taxTotal = calculateTaxTotal(lineItems);
  return calculateMonetaryTotal(lineItems, taxTotal);
}

export { toDecimal };
