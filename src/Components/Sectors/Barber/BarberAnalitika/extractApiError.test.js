import { describe, expect, it } from "vitest";
import { extractApiError } from "./extractApiError";

describe("extractApiError", () => {
  it("reads field errors from DRF body", () => {
    expect(
      extractApiError({
        response: {
          data: { date_to: ["date_to должен быть >= date_from."] },
        },
      }),
    ).toBe("date_to должен быть >= date_from.");
  });

  it("reads detail string", () => {
    expect(
      extractApiError({
        response: { data: { detail: "Период слишком длинный." } },
      }),
    ).toBe("Период слишком длинный.");
  });
});
