import { z } from "zod";
import { ISO_3166_ALPHA2_LENGTH, ISO_4217_LENGTH } from "../constants/ubl.constants.js";
import { DECIMAL_CTOR, toDecimal, type Decimal } from "../lib/decimal.js";
import {
  InvoiceType,
  type Invoice,
  type PaymentMeansCode,
  type TaxSchemeType,
} from "../types/invoice.types.js";
import {
  calculateMonetaryTotal,
  calculateTaxTotal,
} from "../utils/formatters.js";

const taxSchemeZod: z.ZodType<TaxSchemeType> = z.enum(["VAT", "GST"]);

const taxCategoryIdZod = z.enum(["S", "Z", "E", "AE", "O"]);

const paymentMeansCodeZod: z.ZodType<PaymentMeansCode> = z.enum([
  "10",
  "31",
  "48",
]);

/**
 * Coerce unknown input to {@link Decimal} for Zod pipelines.
 */
const asDecimal: z.ZodType<Decimal, z.ZodTypeDef, unknown> = z.preprocess(
  (v) => {
    if (v instanceof DECIMAL_CTOR) {
      return v;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      return new DECIMAL_CTOR(v);
    }
    if (typeof v === "string" && v.trim() !== "") {
      return new DECIMAL_CTOR(v);
    }
    return v;
  },
  z.custom<Decimal>((v): v is Decimal => v instanceof DECIMAL_CTOR),
);

const positiveMoney: z.ZodType<Decimal, z.ZodTypeDef, unknown> =
  asDecimal.refine((d) => d.gt(0), { message: "Amount must be greater than zero" });

const taxPercentDecimal: z.ZodType<Decimal, z.ZodTypeDef, unknown> =
  asDecimal.refine((d) => d.gte(0) && d.lte(100), {
    message: "Tax percent must be between 0 and 100",
  });

const optionalNonNegativeMoney: z.ZodType<
  Decimal | undefined,
  z.ZodTypeDef,
  unknown
> = z.preprocess(
  (v) => {
    if (v === undefined || v === null) {
      return undefined;
    }
    return toDecimal(v as Decimal | string | number);
  },
  z
    .custom<Decimal>((v): v is Decimal => v instanceof DECIMAL_CTOR)
    .refine((d) => d.gte(0), { message: "Must be non-negative" })
    .optional(),
);

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z
    .string()
    .length(ISO_3166_ALPHA2_LENGTH)
    .regex(/^[A-Z]{2}$/, "Country must be ISO 3166-1 alpha-2 (uppercase)"),
});

const contactSchema = z
  .object({
    email: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
  })
  .strict()
  .optional();

const partySchema = z
  .object({
    name: z.string().min(1),
    taxId: z.string(),
    address: addressSchema,
    contact: contactSchema,
    endpointId: z.string().optional(),
    endpointSchemeId: z.string().optional(),
    partyId: z.string().optional(),
  })
  .strict();

const taxCategorySchema = z
  .object({
    id: taxCategoryIdZod,
    percent: taxPercentDecimal,
    scheme: taxSchemeZod,
    exemptionReasonCode: z.string().optional(),
    exemptionReason: z.string().optional(),
  })
  .strict()
  .superRefine((cat, ctx) => {
    if (cat.id === "Z" || cat.id === "E") {
      const code = cat.exemptionReasonCode?.trim();
      const reason = cat.exemptionReason?.trim();
      if (!code || !reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "exemptionReasonCode and exemptionReason are required for Z and E tax categories",
          path: ["exemptionReasonCode"],
        });
      }
    }
  });

const lineItemSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    quantity: positiveMoney,
    unitCode: z.string().min(1),
    unitPrice: positiveMoney,
    taxCategory: taxCategorySchema,
  })
  .strict();

const taxSubtotalSchema = z
  .object({
    taxableAmount: asDecimal,
    taxAmount: asDecimal.refine((d) => d.gte(0), {
      message: "Tax amount must be non-negative",
    }),
    taxCategory: taxCategorySchema,
  })
  .strict();

const taxTotalSchema = z
  .object({
    taxAmount: asDecimal.refine((d) => d.gte(0), {
      message: "Tax total must be non-negative",
    }),
    taxSubtotals: z.array(taxSubtotalSchema).min(1),
  })
  .strict();

const monetaryTotalSchema = z
  .object({
    lineExtensionAmount: asDecimal,
    taxExclusiveAmount: asDecimal,
    taxInclusiveAmount: asDecimal,
    payableAmount: asDecimal,
    allowanceTotal: optionalNonNegativeMoney,
    prepaidAmount: optionalNonNegativeMoney,
  })
  .strict();

const invoiceTypeZod: z.ZodType<InvoiceType> = z.nativeEnum(InvoiceType);

/**
 * Max issue date: end of tomorrow UTC (allows one calendar day ahead).
 */
function endOfTomorrowUtc(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

const invoiceObjectSchema = z
  .object({
    id: z.string().min(1, "Invoice ID is required"),
    issueDate: z.date(),
    dueDate: z.date().optional(),
    type: invoiceTypeZod,
    currency: z
      .string()
      .length(ISO_4217_LENGTH)
      .regex(/^[A-Z]{3}$/, "Currency must be ISO 4217 (uppercase)"),
    note: z.string().optional(),
    buyerReference: z.string().optional(),
    paymentMeansCode: paymentMeansCodeZod.optional(),
    seller: partySchema,
    buyer: partySchema,
    lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
    taxTotal: taxTotalSchema,
    monetaryTotal: monetaryTotalSchema,
  })
  .strict();

/**
 * Zod schema for {@link Invoice} including arithmetic consistency checks.
 */
export const invoiceSchema = invoiceObjectSchema.superRefine((raw, ctx) => {
  const inv = raw as Invoice;

  if (
    inv.dueDate != null &&
    inv.dueDate.getTime() < inv.issueDate.getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Due date must be on or after issue date",
      path: ["dueDate"],
    });
  }

  if (inv.issueDate.getTime() > endOfTomorrowUtc().getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Issue date cannot be more than one day in the future",
      path: ["issueDate"],
    });
  }

  const recomputedTax = calculateTaxTotal(inv.lineItems);
  if (!recomputedTax.taxAmount.equals(inv.taxTotal.taxAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "taxTotal.taxAmount does not match line items",
      path: ["taxTotal", "taxAmount"],
    });
  }

  let subSum = new DECIMAL_CTOR(0);
  for (const s of inv.taxTotal.taxSubtotals) {
    subSum = subSum.plus(s.taxAmount);
  }
  if (!subSum.equals(inv.taxTotal.taxAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sum of tax subtotals must equal taxTotal.taxAmount",
      path: ["taxTotal", "taxSubtotals"],
    });
  }

  let lineSum = new DECIMAL_CTOR(0);
  for (const line of inv.lineItems) {
    lineSum = lineSum.plus(line.quantity.mul(line.unitPrice));
  }
  if (!lineSum.equals(inv.monetaryTotal.lineExtensionAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "lineExtensionAmount must equal sum of line extensions",
      path: ["monetaryTotal", "lineExtensionAmount"],
    });
  }

  const allowance = inv.monetaryTotal.allowanceTotal ?? new DECIMAL_CTOR(0);
  const prepaid = inv.monetaryTotal.prepaidAmount ?? new DECIMAL_CTOR(0);

  const expectedExclusive = inv.monetaryTotal.lineExtensionAmount.minus(
    allowance,
  );
  if (!expectedExclusive.equals(inv.monetaryTotal.taxExclusiveAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "taxExclusiveAmount must equal lineExtensionAmount - allowanceTotal",
      path: ["monetaryTotal", "taxExclusiveAmount"],
    });
  }

  const expectedInclusive = inv.monetaryTotal.taxExclusiveAmount.plus(
    inv.taxTotal.taxAmount,
  );
  if (!expectedInclusive.equals(inv.monetaryTotal.taxInclusiveAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "taxInclusiveAmount must equal taxExclusiveAmount + taxTotal.taxAmount",
      path: ["monetaryTotal", "taxInclusiveAmount"],
    });
  }

  const expectedPayable = inv.monetaryTotal.taxInclusiveAmount.minus(prepaid);
  if (!expectedPayable.equals(inv.monetaryTotal.payableAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "payableAmount must equal taxInclusiveAmount - prepaidAmount (allowances already in tax exclusive)",
      path: ["monetaryTotal", "payableAmount"],
    });
  }

  const expectedFromLines = calculateMonetaryTotal(inv.lineItems, inv.taxTotal, {
    allowanceTotal: inv.monetaryTotal.allowanceTotal,
    prepaidAmount: inv.monetaryTotal.prepaidAmount,
  });
  if (
    !expectedFromLines.payableAmount.equals(inv.monetaryTotal.payableAmount)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "monetaryTotal is inconsistent with calculateMonetaryTotal",
      path: ["monetaryTotal"],
    });
  }
});

/**
 * Parse and validate an invoice value; throws {@link z.ZodError} on failure.
 */
export function validateInvoice(data: unknown): Invoice {
  return invoiceSchema.parse(data) as Invoice;
}
