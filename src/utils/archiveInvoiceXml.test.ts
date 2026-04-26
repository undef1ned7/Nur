import { describe, expect, it } from "vitest";
import { buildArchiveInvoiceXml, type ArchiveInvoiceInput } from "./archiveInvoiceXml";

const baseDate = new Date(Date.UTC(2024, 0, 15));

function minimalInput(
  overrides: Partial<ArchiveInvoiceInput> = {},
): ArchiveInvoiceInput {
  return {
    number: "INV-001",
    date: baseDate,
    paymentType: "cash",
    seller: { name: "ООО Ромашка" },
    items: [
      {
        name: "Товар А",
        unit: "шт",
        quantity: 10,
        unitPrice: 150,
      },
    ],
    ...overrides,
  };
}

describe("buildArchiveInvoiceXml", () => {
  it("omits buyer block when buyer is undefined", () => {
    const xml = buildArchiveInvoiceXml(minimalInput({ buyer: undefined }));
    expect(xml).not.toContain("<buyer>");
    expect(xml).toContain("<seller>");
    expect(xml).toContain("<items>");
  });

  it("omits discount in totals when discount is zero or omitted", () => {
    const without = buildArchiveInvoiceXml(minimalInput());
    expect(without).not.toContain("<discount>");

    const explicitZero = buildArchiveInvoiceXml(
      minimalInput({ discountTotal: 0 }),
    );
    expect(explicitZero).not.toContain("<discount>");
  });

  it("includes discount only when discountTotal > 0", () => {
    const xml = buildArchiveInvoiceXml(
      minimalInput({
        discountTotal: 25.5,
        items: [
          { name: "A", unit: "шт", quantity: 1, unitPrice: 100 },
        ],
      }),
    );
    expect(xml).toContain("<discount>25.50</discount>");
    expect(xml).toContain("<total>74.50</total>");
  });

  it("escapes special characters in item name", () => {
    const xml = buildArchiveInvoiceXml(
      minimalInput({
        items: [
          {
            name: 'Соус "Острый" & <пикантный>',
            unit: "шт",
            quantity: 1,
            unitPrice: 10,
          },
        ],
      }),
    );
    expect(xml).toContain(
      "&quot;Острый&quot; &amp; &lt;пикантный&gt;",
    );
    expect(xml).not.toContain('<name>Соус "Острый" & <');
  });

  it("is pure: identical logical input yields identical output", () => {
    const a = minimalInput();
    const b = minimalInput();
    expect(buildArchiveInvoiceXml(a)).toBe(buildArchiveInvoiceXml(b));
  });

  it("omits empty optional seller fields and note", () => {
    const xml = buildArchiveInvoiceXml(
      minimalInput({
        note: "   ",
        seller: {
          name: "S",
          inn: "",
          bankAccount: undefined,
          address: "   ",
        },
      }),
    );
    expect(xml).not.toContain("<note>");
    expect(xml).not.toContain("<inn>");
    expect(xml).not.toContain("<bankAccount>");
    expect(xml).not.toContain("<address>");
  });
});
