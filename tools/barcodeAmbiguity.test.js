import { describe, expect, it } from "vitest";
import {
  getBarcodeAmbiguity,
  serializeApiError,
} from "./barcodeAmbiguity";

describe("barcodeAmbiguity", () => {
  const response = {
    status: 409,
    data: {
      ambiguous: true,
      message: "Выберите товар",
      matches: [
        { id: "one", name: "Легенда 0.5" },
        { id: "two", name: "Легенда 1.0" },
      ],
    },
  };

  it("extracts matches from an axios response", () => {
    expect(getBarcodeAmbiguity({ response })).toEqual({
      ambiguous: true,
      message: "Выберите товар",
      matches: [
        { id: "one", name: "Легенда 0.5" },
        { id: "two", name: "Легенда 1.0" },
      ],
    });
  });

  it("extracts matches from a serialized thunk error", () => {
    expect(getBarcodeAmbiguity(serializeApiError({ response }))).toEqual({
      ambiguous: true,
      message: "Выберите товар",
      matches: [
        { id: "one", name: "Легенда 0.5" },
        { id: "two", name: "Легенда 1.0" },
      ],
    });
  });

  it("does not classify ordinary errors as ambiguity", () => {
    expect(
      getBarcodeAmbiguity({ status: 404, data: { message: "Не найдено" } }),
    ).toBeNull();
  });
});
