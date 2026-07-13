import { describe, expect, it } from "vitest";
import { getKitchenDeleteErrorMessage } from "./kitchenDeleteError";

describe("getKitchenDeleteErrorMessage", () => {
  it("returns a friendly message for HTTP 500", () => {
    const message = getKitchenDeleteErrorMessage(
      {
        isAxiosError: true,
        response: { status: 500, data: "Internal Server Error" },
        message: "Request failed with status code 500",
      },
      "Горячий цех",
    );

    expect(message).toContain("Горячий цех");
    expect(message).toContain("нельзя удалить");
    expect(message).toContain("привязаны");
    expect(message).not.toContain("500");
  });

  it("returns backend detail when it is specific", () => {
    const message = getKitchenDeleteErrorMessage(
      {
        isAxiosError: true,
        response: {
          status: 400,
          data: { detail: "Сначала удалите все блюда, привязанные к этой кухне." },
        },
      },
      "Бар",
    );

    expect(message).toBe("Сначала удалите все блюда, привязанные к этой кухне.");
  });
});
