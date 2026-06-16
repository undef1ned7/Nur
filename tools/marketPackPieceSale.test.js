import { describe, expect, it } from "vitest";
import {
  cartLinesMatchProductAndPackage,
  formatCartLineNameSuffix,
  isPieceSaleCartLine,
} from "./marketPackPieceSale";

describe("marketPackPieceSale cart lines", () => {
  const productId = "prod-1";
  const pkgId = "pkg-1";

  it("matches pack and piece lines separately", () => {
    const pieceLine = { product: productId, sale_package: pkgId };
    const packLine = { product: productId, sale_package: null };

    expect(cartLinesMatchProductAndPackage(pieceLine, productId, pkgId)).toBe(
      true,
    );
    expect(cartLinesMatchProductAndPackage(pieceLine, productId, null)).toBe(
      false,
    );
    expect(cartLinesMatchProductAndPackage(packLine, productId, null)).toBe(
      true,
    );
    expect(cartLinesMatchProductAndPackage(packLine, productId, pkgId)).toBe(
      false,
    );
  });

  it("labels piece lines as (штуч)", () => {
    expect(
      isPieceSaleCartLine({ salePackage: pkgId }),
    ).toBe(true);
    expect(formatCartLineNameSuffix({ salePackage: pkgId })).toBe(" (штуч)");
    expect(formatCartLineNameSuffix({ sale_package: null })).toBe("");
  });
});
