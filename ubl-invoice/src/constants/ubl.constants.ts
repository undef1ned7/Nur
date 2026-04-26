/** UBL 2.1 Invoice root namespace. */
export const UBL_INVOICE_NS =
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" as const;

/** UBL Common Aggregate Components 2. */
export const UBL_CAC_NS =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" as const;

/** UBL Common Basic Components 2. */
export const UBL_CBC_NS =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" as const;

/** UBL version emitted in documents. */
export const UBL_VERSION_ID = "2.1" as const;

/** PEPPOL BIS Billing 3.0 customization (common for interoperable invoices). */
export const UBL_CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0" as const;

/** PEPPOL BIS Billing 3.0 process profile (EN 16931 CIUS). */
export const UBL_PROFILE_ID =
  "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0" as const;

/** UN/CEFACT CCL 1001 — Invoice type codes used in UBL. */
export const InvoiceTypeCode = {
  COMMERCIAL_INVOICE: "380",
  CREDIT_NOTE: "381",
  DEBIT_NOTE: "383",
} as const;

export type InvoiceTypeCodeValue =
  (typeof InvoiceTypeCode)[keyof typeof InvoiceTypeCode];

/** ISO 4217 length for currency codes. */
export const ISO_4217_LENGTH = 3 as const;

/** ISO 3166-1 alpha-2 length. */
export const ISO_3166_ALPHA2_LENGTH = 2 as const;

/** Default tax scheme identifier on UBL PartyTaxScheme / TaxCategory (VAT). */
export const UBL_DEFAULT_TAX_SCHEME_ID = "VAT" as const;

/** GLN / generic identifier scheme used on cbc:EndpointID in examples. */
export const UBL_ENDPOINT_SCHEME_GLN = "0088" as const;
