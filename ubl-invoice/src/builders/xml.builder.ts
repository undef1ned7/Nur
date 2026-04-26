import { create } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces.js";
import {
  InvoiceTypeCode,
  UBL_CAC_NS,
  UBL_CBC_NS,
  UBL_CUSTOMIZATION_ID,
  UBL_DEFAULT_TAX_SCHEME_ID,
  UBL_ENDPOINT_SCHEME_GLN,
  UBL_INVOICE_NS,
  UBL_PROFILE_ID,
  UBL_VERSION_ID,
} from "../constants/ubl.constants.js";
import type { Decimal } from "../lib/decimal.js";
import {
  InvoiceType,
  type Address,
  type Invoice,
  type LineItem,
  type Party,
  type TaxCategory,
} from "../types/invoice.types.js";
import {
  formatDateIso,
  formatInvoicedQuantity,
  formatMoneyAmount,
} from "../utils/formatters.js";
import { validateInvoice } from "../validators/invoice.validator.js";

const MAX_ITEM_DESCRIPTION_LEN = 250;

function trimToEmit(value: string | undefined | null): string {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

/**
 * Map domain {@link InvoiceType} to UN/CEFACT invoice type code.
 */
function invoiceTypeToUblCode(type: InvoiceType): string {
  switch (type) {
    case InvoiceType.INVOICE:
      return InvoiceTypeCode.COMMERCIAL_INVOICE;
    case InvoiceType.CREDIT_NOTE:
      return InvoiceTypeCode.CREDIT_NOTE;
    case InvoiceType.DEBIT_NOTE:
      return InvoiceTypeCode.DEBIT_NOTE;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function lineExtension(line: LineItem): Decimal {
  return line.quantity.mul(line.unitPrice);
}

function schemeForParty(party: Party): string {
  const s = trimToEmit(party.endpointSchemeId);
  return s !== "" ? s : UBL_ENDPOINT_SCHEME_GLN;
}

function addPostalAddress(p: XMLBuilder, address: Address): void {
  const street = trimToEmit(address.street);
  const city = trimToEmit(address.city);
  const postal = trimToEmit(address.postalCode);
  const country = trimToEmit(address.country);
  if (!street && !city && !postal && !country) {
    return;
  }
  const addr = p.ele(UBL_CAC_NS, "PostalAddress");
  if (street) {
    addr.ele(UBL_CBC_NS, "StreetName").txt(street).up();
  }
  if (city) {
    addr.ele(UBL_CBC_NS, "CityName").txt(city).up();
  }
  if (postal) {
    addr.ele(UBL_CBC_NS, "PostalZone").txt(postal).up();
  }
  if (country) {
    addr
      .ele(UBL_CAC_NS, "Country")
      .ele(UBL_CBC_NS, "IdentificationCode")
      .txt(country)
      .up()
      .up();
  }
  addr.up();
}

/**
 * cac:TaxCategory (document) or cac:ClassifiedTaxCategory (line item).
 */
function addTaxCategoryElement(
  host: XMLBuilder,
  localName: "TaxCategory" | "ClassifiedTaxCategory",
  cat: TaxCategory,
): void {
  const el = host.ele(UBL_CAC_NS, localName);
  el.ele(UBL_CBC_NS, "ID").txt(cat.id).up();
  el.ele(UBL_CBC_NS, "Percent").txt(formatMoneyAmount(cat.percent)).up();
  if (cat.id === "Z" || cat.id === "E") {
    const code = trimToEmit(cat.exemptionReasonCode);
    const reason = trimToEmit(cat.exemptionReason);
    if (code) {
      el.ele(UBL_CBC_NS, "TaxExemptionReasonCode").txt(code).up();
    }
    if (reason) {
      el.ele(UBL_CBC_NS, "TaxExemptionReason").txt(reason).up();
    }
  }
  el.ele(UBL_CAC_NS, "TaxScheme")
    .ele(UBL_CBC_NS, "ID")
    .txt(cat.scheme)
    .up()
    .up();
  el.up();
}

function addParty(
  parent: XMLBuilder,
  elementLocalName: string,
  party: Party,
): void {
  const ap = parent.ele(UBL_CAC_NS, elementLocalName);
  const p = ap.ele(UBL_CAC_NS, "Party");

  const endpointId = trimToEmit(party.endpointId);
  if (endpointId) {
    p.ele(UBL_CBC_NS, "EndpointID", {
      schemeID: schemeForParty(party),
    })
      .txt(endpointId)
      .up();
  }

  const partyId = trimToEmit(party.partyId);
  if (partyId) {
    p.ele(UBL_CAC_NS, "PartyIdentification")
      .ele(UBL_CBC_NS, "ID", { schemeID: schemeForParty(party) })
      .txt(partyId)
      .up()
      .up();
  }

  p.ele(UBL_CAC_NS, "PartyName")
    .ele(UBL_CBC_NS, "Name")
    .txt(party.name)
    .up()
    .up();

  addPostalAddress(p, party.address);

  const taxId = trimToEmit(party.taxId);
  if (taxId) {
    p.ele(UBL_CAC_NS, "PartyTaxScheme")
      .ele(UBL_CBC_NS, "CompanyID")
      .txt(taxId)
      .up()
      .ele(UBL_CAC_NS, "TaxScheme")
      .ele(UBL_CBC_NS, "ID")
      .txt(UBL_DEFAULT_TAX_SCHEME_ID)
      .up()
      .up()
      .up();
  }

  const ple = p.ele(UBL_CAC_NS, "PartyLegalEntity");
  ple.ele(UBL_CBC_NS, "RegistrationName").txt(party.name).up();
  if (taxId) {
    ple.ele(UBL_CBC_NS, "CompanyID").txt(taxId).up();
  }
  ple.up();

  p.up();
  ap.up();
}

function addTaxSubtotal(
  parent: XMLBuilder,
  taxableAmount: string,
  taxAmount: string,
  cat: TaxCategory,
  currency: string,
): void {
  const ts = parent.ele(UBL_CAC_NS, "TaxSubtotal");
  ts.ele(UBL_CBC_NS, "TaxableAmount", { currencyID: currency })
    .txt(taxableAmount)
    .up();
  ts.ele(UBL_CBC_NS, "TaxAmount", { currencyID: currency })
    .txt(taxAmount)
    .up();
  addTaxCategoryElement(ts, "TaxCategory", cat);
  ts.up();
}

function addDocumentTaxTotal(inv: Invoice, root: XMLBuilder): void {
  const tt = root.ele(UBL_CAC_NS, "TaxTotal");
  tt.ele(UBL_CBC_NS, "TaxAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(inv.taxTotal.taxAmount))
    .up();
  for (const sub of inv.taxTotal.taxSubtotals) {
    addTaxSubtotal(
      tt,
      formatMoneyAmount(sub.taxableAmount),
      formatMoneyAmount(sub.taxAmount),
      sub.taxCategory,
      inv.currency,
    );
  }
  tt.up();
}

function addLegalMonetaryTotal(inv: Invoice, root: XMLBuilder): void {
  const lmt = root.ele(UBL_CAC_NS, "LegalMonetaryTotal");
  lmt
    .ele(UBL_CBC_NS, "LineExtensionAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(inv.monetaryTotal.lineExtensionAmount))
    .up();
  lmt
    .ele(UBL_CBC_NS, "TaxExclusiveAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(inv.monetaryTotal.taxExclusiveAmount))
    .up();
  lmt
    .ele(UBL_CBC_NS, "TaxInclusiveAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(inv.monetaryTotal.taxInclusiveAmount))
    .up();
  lmt
    .ele(UBL_CBC_NS, "PayableAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(inv.monetaryTotal.payableAmount))
    .up();
  lmt.up();
}

function addPaymentMeans(root: XMLBuilder, code: string): void {
  const pm = root.ele(UBL_CAC_NS, "PaymentMeans");
  pm.ele(UBL_CBC_NS, "PaymentMeansCode").txt(code).up();
  pm.up();
}

function addInvoiceLine(
  inv: Invoice,
  root: XMLBuilder,
  line: LineItem,
  lineIndex: number,
): void {
  const descRaw = line.description.slice(0, MAX_ITEM_DESCRIPTION_LEN);
  const il = root.ele(UBL_CAC_NS, "InvoiceLine");
  il.ele(UBL_CBC_NS, "ID").txt(String(lineIndex + 1)).up();
  il.ele(UBL_CBC_NS, "InvoicedQuantity", { unitCode: line.unitCode })
    .txt(formatInvoicedQuantity(line.quantity))
    .up();
  il.ele(UBL_CBC_NS, "LineExtensionAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(lineExtension(line)))
    .up();

  const item = il.ele(UBL_CAC_NS, "Item");
  item.ele(UBL_CBC_NS, "Description").txt(descRaw).up();
  item.ele(UBL_CBC_NS, "Name").txt(descRaw).up();
  addTaxCategoryElement(item, "ClassifiedTaxCategory", line.taxCategory);
  item.up();

  il.ele(UBL_CAC_NS, "Price")
    .ele(UBL_CBC_NS, "PriceAmount", { currencyID: inv.currency })
    .txt(formatMoneyAmount(line.unitPrice))
    .up()
    .up();

  il.up();
}

/**
 * Serialize a validated {@link Invoice} to UBL 2.1 Invoice XML (EN 16931 / PEPPOL BIS Billing 3.0 oriented).
 *
 * @param invoice - Domain invoice (re-validated before serialization)
 * @returns XML document as string (UTF-8 declaration included)
 */
export function generateInvoiceXml(invoice: Invoice): string {
  validateInvoice(invoice);

  const doc = create({ version: "1.0", encoding: "UTF-8" });
  const root = doc.ele(UBL_INVOICE_NS, "Invoice", {
    xmlns: UBL_INVOICE_NS,
    "xmlns:cac": UBL_CAC_NS,
    "xmlns:cbc": UBL_CBC_NS,
  });

  root.ele(UBL_CBC_NS, "UBLVersionID").txt(UBL_VERSION_ID).up();
  root.ele(UBL_CBC_NS, "CustomizationID").txt(UBL_CUSTOMIZATION_ID).up();
  root.ele(UBL_CBC_NS, "ProfileID").txt(UBL_PROFILE_ID).up();
  root.ele(UBL_CBC_NS, "ID").txt(invoice.id).up();
  root.ele(UBL_CBC_NS, "IssueDate").txt(formatDateIso(invoice.issueDate)).up();
  if (invoice.dueDate != null) {
    root.ele(UBL_CBC_NS, "DueDate").txt(formatDateIso(invoice.dueDate)).up();
  }
  root
    .ele(UBL_CBC_NS, "InvoiceTypeCode")
    .txt(invoiceTypeToUblCode(invoice.type))
    .up();

  const note = trimToEmit(invoice.note);
  if (note) {
    root.ele(UBL_CBC_NS, "Note").txt(note).up();
  }

  root
    .ele(UBL_CBC_NS, "DocumentCurrencyCode")
    .txt(invoice.currency)
    .up();

  const buyerRef = trimToEmit(invoice.buyerReference);
  if (buyerRef) {
    root.ele(UBL_CBC_NS, "BuyerReference").txt(buyerRef).up();
  }

  addParty(root, "AccountingSupplierParty", invoice.seller);
  addParty(root, "AccountingCustomerParty", invoice.buyer);

  const paymentCode = invoice.paymentMeansCode ?? "31";
  addPaymentMeans(root, paymentCode);

  addDocumentTaxTotal(invoice, root);
  addLegalMonetaryTotal(invoice, root);

  invoice.lineItems.forEach((line, index) => {
    addInvoiceLine(invoice, root, line, index);
  });

  return doc.end({ prettyPrint: true });
}
