import type { Decimal } from "../lib/decimal.js";
import { toDecimal } from "../lib/decimal.js";
import {
  InvoiceType,
  type Address,
  type Invoice,
  type LineItem,
  type Party,
  type PaymentMeansCode,
  type TaxCategoryId,
  type TaxSchemeType,
} from "../types/invoice.types.js";
import { calculateMonetaryTotal, calculateTaxTotal } from "../utils/formatters.js";
import { validateInvoice } from "../validators/invoice.validator.js";

/**
 * Thrown when {@link InvoiceBuilder#build} is called with incomplete data.
 */
export class InvoiceBuilderError extends Error {
  readonly name = "InvoiceBuilderError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Fluent builder for {@link Invoice}; {@link InvoiceBuilder#build} runs Zod validation.
 */
export class InvoiceBuilder {
  private idValue?: string;

  private issue?: Date;

  private due?: Date;

  private invoiceType?: InvoiceType;

  private currencyCode?: string;

  private noteValue?: string;

  private buyerReferenceValue?: string;

  private paymentMeans?: PaymentMeansCode;

  private sellerParty?: Party;

  private buyerParty?: Party;

  private readonly lines: LineItem[] = [];

  private allowance?: Decimal;

  private prepaid?: Decimal;

  /**
   * Set document identifier (UBL cbc:ID).
   */
  setId(id: string): this {
    this.idValue = id;
    return this;
  }

  /**
   * Set issue date (calendar, interpreted as UTC in formatters).
   */
  setIssueDate(issueDate: Date): this {
    this.issue = issueDate;
    return this;
  }

  /**
   * Set due date (optional in UBL cbc:DueDate).
   */
  setDueDate(dueDate: Date | undefined): this {
    this.due = dueDate;
    return this;
  }

  /**
   * Set commercial document type.
   */
  setType(type: InvoiceType): this {
    this.invoiceType = type;
    return this;
  }

  /**
   * Set ISO 4217 currency code (e.g. USD).
   */
  setCurrency(currency: string): this {
    this.currencyCode = currency;
    return this;
  }

  /**
   * Optional note (cbc:Note).
   */
  setNote(note: string): this {
    this.noteValue = note;
    return this;
  }

  /**
   * Optional buyer reference (cbc:BuyerReference).
   */
  setBuyerReference(ref: string): this {
    this.buyerReferenceValue = ref;
    return this;
  }

  /**
   * Payment means code (cbc:PaymentMeansCode); defaults to `31` in XML if omitted.
   */
  setPaymentMeansCode(code: PaymentMeansCode): this {
    this.paymentMeans = code;
    return this;
  }

  /**
   * Set accounting supplier party.
   */
  setSeller(seller: Party): this {
    this.sellerParty = cloneParty(seller);
    return this;
  }

  /**
   * Set accounting customer party.
   */
  setBuyer(buyer: Party): this {
    this.buyerParty = cloneParty(buyer);
    return this;
  }

  /**
   * Document-level allowance subtracted before tax (maps to line extension vs tax exclusive).
   */
  setAllowanceTotal(amount: Decimal | string | number): this {
    this.allowance = toDecimal(amount);
    return this;
  }

  /**
   * Prepaid amount subtracted from tax inclusive to yield payable.
   */
  setPrepaidAmount(amount: Decimal | string | number): this {
    this.prepaid = toDecimal(amount);
    return this;
  }

  /**
   * Append a line item; quantities and prices coerced to {@link Decimal}.
   */
  addLineItem(input: {
    id: string;
    description: string;
    quantity: Decimal | string | number;
    unitCode: string;
    unitPrice: Decimal | string | number;
    taxCategory: {
      id: TaxCategoryId;
      percent: Decimal | string | number;
      scheme: TaxSchemeType;
      exemptionReasonCode?: string;
      exemptionReason?: string;
    };
  }): this {
    const line: LineItem = {
      id: input.id,
      description: input.description,
      quantity: toDecimal(input.quantity),
      unitCode: input.unitCode,
      unitPrice: toDecimal(input.unitPrice),
      taxCategory: {
        id: input.taxCategory.id,
        percent: toDecimal(input.taxCategory.percent),
        scheme: input.taxCategory.scheme,
        exemptionReasonCode: input.taxCategory.exemptionReasonCode,
        exemptionReason: input.taxCategory.exemptionReason,
      },
    };
    this.lines.push(line);
    return this;
  }

  /**
   * Compute totals, validate with Zod, and return an {@link Invoice}.
   *
   * @throws {InvoiceBuilderError} when required builder fields are missing
   * @throws {import("zod").ZodError} when validation fails
   */
  build(): Invoice {
    if (!this.idValue) {
      throw new InvoiceBuilderError("Invoice ID is required (setId).");
    }
    if (!this.issue) {
      throw new InvoiceBuilderError("Issue date is required (setIssueDate).");
    }
    if (!this.invoiceType) {
      throw new InvoiceBuilderError("Invoice type is required (setType).");
    }
    if (!this.currencyCode) {
      throw new InvoiceBuilderError("Currency is required (setCurrency).");
    }
    if (!this.sellerParty) {
      throw new InvoiceBuilderError("Seller is required (setSeller).");
    }
    if (!this.buyerParty) {
      throw new InvoiceBuilderError("Buyer is required (setBuyer).");
    }
    if (this.lines.length === 0) {
      throw new InvoiceBuilderError(
        "At least one line item is required (addLineItem).",
      );
    }

    const taxTotal = calculateTaxTotal(this.lines);
    const monetaryTotal = calculateMonetaryTotal(this.lines, taxTotal, {
      allowanceTotal: this.allowance,
      prepaidAmount: this.prepaid,
    });

    const draft = {
      id: this.idValue,
      issueDate: this.issue,
      dueDate: this.due,
      type: this.invoiceType,
      currency: this.currencyCode,
      note: this.noteValue,
      buyerReference: this.buyerReferenceValue,
      paymentMeansCode: this.paymentMeans,
      seller: this.sellerParty,
      buyer: this.buyerParty,
      lineItems: [...this.lines],
      taxTotal,
      monetaryTotal,
    };

    return validateInvoice(draft);
  }
}

function cloneParty(party: Party): Party {
  return {
    name: party.name,
    taxId: party.taxId,
    address: cloneAddress(party.address),
    contact: party.contact ? { ...party.contact } : undefined,
    endpointId: party.endpointId,
    endpointSchemeId: party.endpointSchemeId,
    partyId: party.partyId,
  };
}

function cloneAddress(address: Address): Address {
  return {
    street: address.street,
    city: address.city,
    postalCode: address.postalCode,
    country: address.country,
  };
}
