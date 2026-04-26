import type { Decimal } from "../lib/decimal.js";

/**
 * Commercial invoice, credit note, or debit note classification.
 */
export enum InvoiceType {
  INVOICE = "INVOICE",
  CREDIT_NOTE = "CREDIT_NOTE",
  DEBIT_NOTE = "DEBIT_NOTE",
}

/**
 * VAT/GST scheme discriminator for tax reporting.
 */
export type TaxSchemeType = "VAT" | "GST";

/**
 * UN/ECE 5305 / PEPPOL subset: standard (S), zero (Z), exempt (E), reverse charge (AE), outside scope (O).
 */
export type TaxCategoryId = "S" | "Z" | "E" | "AE" | "O";

/**
 * Tax breakdown for a line or document subtotal.
 * For categories Z and E, {@link exemptionReasonCode} and {@link exemptionReason} are required (validated in Zod).
 */
export interface TaxCategory {
  readonly id: TaxCategoryId;
  readonly percent: Decimal;
  readonly scheme: TaxSchemeType;
  readonly exemptionReasonCode?: string;
  readonly exemptionReason?: string;
}

/**
 * Postal address with ISO 3166-1 alpha-2 country.
 */
export interface Address {
  readonly street: string;
  readonly city: string;
  readonly postalCode: string;
  readonly country: string;
}

/**
 * Optional contact details for a {@link Party}.
 */
export interface Contact {
  readonly email?: string;
  readonly phone?: string;
}

/**
 * Seller or buyer (accounting party).
 */
export interface Party {
  readonly name: string;
  readonly taxId: string;
  readonly address: Address;
  readonly contact?: Contact;
  /** GLN or other identifier for cbc:EndpointID (only emitted when non-empty). */
  readonly endpointId?: string;
  /** schemeID for EndpointID / PartyIdentification; default `0088` (GLN). */
  readonly endpointSchemeId?: string;
  /** Value for cac:PartyIdentification / cbc:ID (only emitted when non-empty). */
  readonly partyId?: string;
}

/**
 * Single invoice line (goods or service).
 */
export interface LineItem {
  readonly id: string;
  readonly description: string;
  readonly quantity: Decimal;
  readonly unitCode: string;
  readonly unitPrice: Decimal;
  readonly taxCategory: TaxCategory;
}

/**
 * Tax subtotal grouped by category.
 */
export interface TaxSubtotal {
  readonly taxableAmount: Decimal;
  readonly taxAmount: Decimal;
  readonly taxCategory: TaxCategory;
}

/**
 * Document-level tax aggregate.
 */
export interface TaxTotal {
  readonly taxAmount: Decimal;
  readonly taxSubtotals: readonly TaxSubtotal[];
}

/**
 * Document-level monetary summary (UBL LegalMonetaryTotal).
 */
export interface MonetaryTotal {
  readonly lineExtensionAmount: Decimal;
  readonly taxExclusiveAmount: Decimal;
  readonly taxInclusiveAmount: Decimal;
  /** Amount due after document-level allowances and prepayments. */
  readonly payableAmount: Decimal;
  /** Optional total document allowance (subtracted from line extension). */
  readonly allowanceTotal?: Decimal;
  /** Optional prepaid amount (subtracted from tax inclusive to get payable). */
  readonly prepaidAmount?: Decimal;
}

/** UN/CEFACT 4461 payment means codes used in UBL. */
export type PaymentMeansCode = "10" | "31" | "48";

/**
 * Validated invoice ready for UBL serialization.
 */
export interface Invoice {
  readonly id: string;
  readonly issueDate: Date;
  /** When omitted, cbc:DueDate is not serialized. */
  readonly dueDate?: Date;
  readonly type: InvoiceType;
  /** ISO 4217 alphabetic code. */
  readonly currency: string;
  readonly note?: string;
  /** PEPPOL cbc:BuyerReference when set and non-empty. */
  readonly buyerReference?: string;
  /** Default `31` (credit transfer) in XML when omitted. */
  readonly paymentMeansCode?: PaymentMeansCode;
  readonly seller: Party;
  readonly buyer: Party;
  readonly lineItems: readonly LineItem[];
  readonly taxTotal: TaxTotal;
  readonly monetaryTotal: MonetaryTotal;
}
