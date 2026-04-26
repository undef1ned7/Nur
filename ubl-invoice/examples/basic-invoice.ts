import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  InvoiceBuilder,
  InvoiceType,
  generateInvoiceXml,
  validateInvoice,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "output");
const outFile = path.join(outDir, "invoice.xml");

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

const issue = utcDate(2024, 1, 15);
const due = utcDate(2024, 2, 15);

const invoice = new InvoiceBuilder()
  .setId("INV-2024-001")
  .setIssueDate(issue)
  .setDueDate(due)
  .setType(InvoiceType.INVOICE)
  .setCurrency("KGS")
  .setPaymentMeansCode("31")
  .setNote("Net 30 days")
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
    contact: { email: "billing@example.kg", phone: "+996555000000" },
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
    id: "line-uuid-ignored-in-xml",
    description: "Товар А",
    quantity: 10,
    unitCode: "C62",
    unitPrice: 150,
    taxCategory: {
      id: "Z",
      percent: 0,
      scheme: "VAT",
      exemptionReasonCode: "VATEX-EU-O",
      exemptionReason: "Not subject to VAT",
    },
  })
  .build();

const validated = validateInvoice(invoice);
const xml = generateInvoiceXml(validated);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, xml, "utf8");

process.stdout.write(xml);
process.stdout.write(`\n\nWritten to ${outFile}\n`);
