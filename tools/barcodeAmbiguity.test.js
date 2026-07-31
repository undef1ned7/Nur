import { describe, expect, it } from "vitest";
import {
  getBarcodeAmbiguity,
  isBarcodeNotFoundError,
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

describe("isBarcodeNotFoundError", () => {
  it("detects 404 responses", () => {
    expect(isBarcodeNotFoundError({ response: { status: 404, data: {} } })).toBe(
      true,
    );
    expect(isBarcodeNotFoundError({ status: 404 })).toBe(true);
  });

  it("detects «не найден» in the error text", () => {
    expect(
      isBarcodeNotFoundError({
        status: 400,
        data: { detail: "Товар с таким штрих-кодом не найден" },
      }),
    ).toBe(true);
    expect(isBarcodeNotFoundError({ message: "Product not found" })).toBe(true);
  });

  it("ignores other scan errors", () => {
    expect(
      isBarcodeNotFoundError({
        status: 400,
        data: { detail: "Недостаточно товара на складе" },
      }),
    ).toBe(false);
    expect(isBarcodeNotFoundError({ status: 409, data: { ambiguous: true } })).toBe(
      false,
    );
  });
});
