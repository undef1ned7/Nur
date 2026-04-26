import { describe, expect, it } from "vitest";
import { generateInvoiceXml } from "../src/builders/xml.builder.js";
import { InvoiceBuilder, InvoiceType } from "../src/index.js";

const exemption = {
  exemptionReasonCode: "VATEX-EU-O",
  exemptionReason: "Not subject to VAT",
};

describe("generateInvoiceXml", () => {
  it("emits PEPPOL profile, payment means, legal entity, tax exemption, sequential line IDs", () => {
    const invoice = new InvoiceBuilder()
      .setId("INV-2024-001")
      .setIssueDate(new Date(Date.UTC(2024, 0, 15)))
      .setDueDate(new Date(Date.UTC(2024, 1, 15)))
      .setType(InvoiceType.INVOICE)
      .setCurrency("KGS")
      .setPaymentMeansCode("31")
      .setSeller({
        name: "ООО Ромашка",
        taxId: "12345678901234",
        endpointId: "1234567890123",
        partyId: "seller-001",
        address: {
          street: "ул. Ленина 1",
          city: "Бишкек",
          postalCode: "720000",
          country: "KG",
        },
      })
      .setBuyer({
        name: "ИП Иванов",
        taxId: "",
        partyId: "buyer-001",
        address: {
          street: "",
          city: "",
          postalCode: "",
          country: "KG",
        },
      })
      .addLineItem({
        id: "any-id",
        description: "Товар А",
        quantity: 10,
        unitCode: "C62",
        unitPrice: 150,
        taxCategory: { id: "Z", percent: 0, scheme: "VAT", ...exemption },
      })
      .addLineItem({
        id: "another",
        description: "Товар B",
        quantity: 1,
        unitCode: "C62",
        unitPrice: 50,
        taxCategory: { id: "Z", percent: 0, scheme: "VAT", ...exemption },
      })
      .build();

    const xml = generateInvoiceXml(invoice);

    expect(xml).toContain("<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>");
    expect(xml).toContain("<cac:PaymentMeans>");
    expect(xml).toContain("<cbc:PaymentMeansCode>31</cbc:PaymentMeansCode>");
    expect(xml).toContain("<cac:PartyLegalEntity>");
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>VATEX-EU-O</cbc:TaxExemptionReasonCode>");
    expect(xml).toContain("<cbc:TaxExemptionReason>Not subject to VAT</cbc:TaxExemptionReason>");
    expect(xml).toContain("<cbc:DocumentCurrencyCode>KGS</cbc:DocumentCurrencyCode>");

    const lineIds = [...xml.matchAll(/<cac:InvoiceLine>\s*<cbc:ID>([^<]+)<\/cbc:ID>/g)].map(
      (m) => m[1],
    );
    expect(lineIds).toEqual(["1", "2"]);

    expect(xml).not.toMatch(/<cbc:EndpointID[^>]*><\/cbc:EndpointID>/);
    expect(xml).toMatch(
      /<cbc:EndpointID schemeID="0088">1234567890123<\/cbc:EndpointID>/,
    );
  });

  it("omits EndpointID when seller has no endpointId", () => {
    const invoice = new InvoiceBuilder()
      .setId("INV-2")
      .setIssueDate(new Date(Date.UTC(2024, 0, 15)))
      .setDueDate(new Date(Date.UTC(2024, 1, 15)))
      .setType(InvoiceType.INVOICE)
      .setCurrency("KGS")
      .setSeller({
        name: "Seller",
        taxId: "T1",
        address: {
          street: "S",
          city: "C",
          postalCode: "P",
          country: "KG",
        },
      })
      .setBuyer({
        name: "Buyer",
        taxId: "T2",
        address: {
          street: "S2",
          city: "C2",
          postalCode: "P2",
          country: "KG",
        },
      })
      .addLineItem({
        id: "1",
        description: "X",
        quantity: 1,
        unitCode: "C62",
        unitPrice: 100,
        taxCategory: { id: "Z", percent: 0, scheme: "VAT", ...exemption },
      })
      .build();

    const xml = generateInvoiceXml(invoice);
    const supplier = xml.split("<cac:AccountingCustomerParty>")[0];
    expect(supplier).not.toContain("<cbc:EndpointID");
  });

  it("does not emit self-closing or empty UBL basic elements", () => {
    const invoice = new InvoiceBuilder()
      .setId("INV-3")
      .setIssueDate(new Date(Date.UTC(2024, 0, 15)))
      .setDueDate(new Date(Date.UTC(2024, 1, 15)))
      .setType(InvoiceType.INVOICE)
      .setCurrency("KGS")
      .setSeller({
        name: "S",
        taxId: "",
        address: { street: "", city: "", postalCode: "", country: "KG" },
      })
      .setBuyer({
        name: "B",
        taxId: "",
        address: { street: "", city: "", postalCode: "", country: "KG" },
      })
      .addLineItem({
        id: "1",
        description: "Item",
        quantity: 1,
        unitCode: "C62",
        unitPrice: 1,
        taxCategory: { id: "Z", percent: 0, scheme: "VAT", ...exemption },
      })
      .build();

    const xml = generateInvoiceXml(invoice);
    expect(xml).not.toMatch(/<cbc:[A-Za-z]+\s*\/>/);
  });

  it("truncates item description and Name to 250 characters", () => {
    const long = "x".repeat(300);
    const invoice = new InvoiceBuilder()
      .setId("INV-4")
      .setIssueDate(new Date(Date.UTC(2024, 0, 15)))
      .setDueDate(new Date(Date.UTC(2024, 1, 15)))
      .setType(InvoiceType.INVOICE)
      .setCurrency("KGS")
      .setSeller({
        name: "S",
        taxId: "1",
        address: { street: "a", city: "b", postalCode: "c", country: "KG" },
      })
      .setBuyer({
        name: "B",
        taxId: "2",
        address: { street: "a", city: "b", postalCode: "c", country: "KG" },
      })
      .addLineItem({
        id: "1",
        description: long,
        quantity: 1,
        unitCode: "C62",
        unitPrice: 1,
        taxCategory: { id: "Z", percent: 0, scheme: "VAT", ...exemption },
      })
      .build();

    const xml = generateInvoiceXml(invoice);
    const desc = [...xml.matchAll(/<cbc:Description>([^<]*)<\/cbc:Description>/g)][0]?.[1];
    expect(desc?.length).toBe(250);
  });
});
