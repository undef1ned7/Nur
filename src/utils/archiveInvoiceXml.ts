/** Default document currency when {@link ArchiveInvoiceInput#currency} is omitted. */
const DEFAULT_CURRENCY = "KGS";

/**
 * XML-escape text content (elements and attributes).
 */
function esc(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Money: exactly two fraction digits. */
function formatMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2);
}

/** Line quantity: five fraction digits (matches archive layout). */
function formatQuantity(n: number): string {
  const rounded = Math.round(n * 100000) / 100000;
  return rounded.toFixed(5);
}

export interface ArchiveInvoiceSeller {
  name: string;
  inn?: string;
  bankAccount?: string;
  address?: string;
}

export interface ArchiveInvoiceBuyer {
  name: string;
  inn?: string;
  bankAccount?: string;
}

export interface ArchiveInvoiceItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface ArchiveInvoiceInput {
  number: string;
  date: Date;
  /** ISO 4217 code; defaults to {@link DEFAULT_CURRENCY}. */
  currency?: string;
  paymentType: "cash" | "credit";
  note?: string;
  seller: ArchiveInvoiceSeller;
  buyer?: ArchiveInvoiceBuyer;
  items: ArchiveInvoiceItem[];
  discountTotal?: number;
}

/**
 * Build a human-readable archive invoice XML document (custom schema, not UBL).
 * Computes line totals, subtotal, and final total from {@link ArchiveInvoiceInput#items}
 * and optional {@link ArchiveInvoiceInput#discountTotal}.
 *
 * @param input - Invoice data; omitted optional fields do not produce XML nodes.
 * @returns UTF-8 XML string with declaration; pure for identical input values.
 */
export const buildArchiveInvoiceXml = (
  input: ArchiveInvoiceInput,
): string => {
  const currency = (input.currency ?? DEFAULT_CURRENCY).trim() || DEFAULT_CURRENCY;
  const discountRaw =
    input.discountTotal != null && !Number.isNaN(input.discountTotal)
      ? Math.max(0, input.discountTotal)
      : 0;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<invoice>");

  lines.push("  <meta>");
  lines.push(`    <number>${esc(String(input.number).trim() || "—")}</number>`);
  lines.push(`    <date>${esc(formatDateYmd(input.date))}</date>`);
  lines.push(`    <currency>${esc(currency)}</currency>`);
  lines.push(`    <paymentType>${esc(input.paymentType)}</paymentType>`);
  if (input.note != null && String(input.note).trim() !== "") {
    lines.push(`    <note>${esc(String(input.note).trim())}</note>`);
  }
  lines.push("  </meta>");

  const sellerName = String(input.seller.name ?? "").trim();
  const sellerInn =
    input.seller.inn != null ? String(input.seller.inn).trim() : "";
  const sellerBank =
    input.seller.bankAccount != null
      ? String(input.seller.bankAccount).trim()
      : "";
  const sellerAddr =
    input.seller.address != null ? String(input.seller.address).trim() : "";

  if (
    sellerName !== "" ||
    sellerInn !== "" ||
    sellerBank !== "" ||
    sellerAddr !== ""
  ) {
    lines.push("  <seller>");
    if (sellerName !== "") {
      lines.push(`    <name>${esc(sellerName)}</name>`);
    }
    if (sellerInn !== "") {
      lines.push(`    <inn>${esc(sellerInn)}</inn>`);
    }
    if (sellerBank !== "") {
      lines.push(`    <bankAccount>${esc(sellerBank)}</bankAccount>`);
    }
    if (sellerAddr !== "") {
      lines.push(`    <address>${esc(sellerAddr)}</address>`);
    }
    lines.push("  </seller>");
  }

  if (input.buyer) {
    const bName = String(input.buyer.name ?? "").trim();
    const bInn = input.buyer.inn != null ? String(input.buyer.inn).trim() : "";
    const bBank =
      input.buyer.bankAccount != null
        ? String(input.buyer.bankAccount).trim()
        : "";
    if (bName !== "" || bInn !== "" || bBank !== "") {
      lines.push("  <buyer>");
      if (bName !== "") {
        lines.push(`    <name>${esc(bName)}</name>`);
      }
      if (bInn !== "") {
        lines.push(`    <inn>${esc(bInn)}</inn>`);
      }
      if (bBank !== "") {
        lines.push(`    <bankAccount>${esc(bBank)}</bankAccount>`);
      }
      lines.push("  </buyer>");
    }
  }

  lines.push("  <items>");
  let subtotal = 0;
  input.items.forEach((item, idx) => {
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    const lineRaw = qty * price;
    const lineTotal = Math.round(lineRaw * 100) / 100;
    subtotal += lineTotal;

    const unit = String(item.unit ?? "шт").trim() || "шт";
    const name = String(item.name ?? "").trim() || "—";

    lines.push("    <item>");
    lines.push(`      <num>${idx + 1}</num>`);
    lines.push(`      <name>${esc(name)}</name>`);
    lines.push(`      <unit>${esc(unit)}</unit>`);
    lines.push(`      <quantity>${formatQuantity(qty)}</quantity>`);
    lines.push(`      <unitPrice>${formatMoney(price)}</unitPrice>`);
    lines.push(`      <total>${formatMoney(lineTotal)}</total>`);
    lines.push("    </item>");
  });
  lines.push("  </items>");

  subtotal = Math.round(subtotal * 100) / 100;
  const total = Math.round((subtotal - discountRaw) * 100) / 100;

  lines.push("  <totals>");
  lines.push(`    <subtotal>${formatMoney(subtotal)}</subtotal>`);
  if (discountRaw > 0) {
    lines.push(`    <discount>${formatMoney(discountRaw)}</discount>`);
  }
  lines.push(`    <total>${formatMoney(total)}</total>`);
  lines.push("  </totals>");

  lines.push("</invoice>");
  return lines.join("\n");
};
