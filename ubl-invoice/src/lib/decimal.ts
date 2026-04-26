import DecimalPkg from "decimal.js";

/** Instance type from decimal.js public API. */
export type Decimal = import("decimal.js").Decimal.Instance;

/** Constructor + static helpers. */
type DecimalConstructor = import("decimal.js").Decimal.Constructor;

/**
 * Default export works in Node (tests) and in the browser when bundled (Vite).
 */
export const DECIMAL_CTOR = DecimalPkg as unknown as DecimalConstructor;

/**
 * Coerce a value to {@link Decimal}.
 */
export function toDecimal(
  value: import("decimal.js").Decimal.Value | Decimal,
): Decimal {
  if (value instanceof DECIMAL_CTOR) {
    return value;
  }
  return new DECIMAL_CTOR(value);
}
