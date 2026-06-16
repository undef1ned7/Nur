import { describe, expect, it, vi } from "vitest";
import { handleThunkError } from "./handleThunkError";

describe("handleThunkError", () => {
  it("extracts detail from axios response", () => {
    const rejectWithValue = vi.fn((v) => v);
    const result = handleThunkError(
      { response: { data: { detail: "Неверный пароль" } } },
      rejectWithValue,
    );
    expect(result).toBe("Неверный пароль");
    expect(rejectWithValue).toHaveBeenCalledWith("Неверный пароль");
  });

  it("falls back to message and default", () => {
    const rejectWithValue = vi.fn((v) => v);
    expect(
      handleThunkError({ message: "Network Error" }, rejectWithValue),
    ).toBe("Network Error");
    expect(handleThunkError({}, rejectWithValue)).toBe("Неизвестная ошибка");
  });

  it("extracts field validation errors such as recipe", () => {
    const rejectWithValue = vi.fn((v) => v);
    const result = handleThunkError(
      {
        response: {
          data: {
            recipe: [
              "Недостаточно сырья «соль»: нужно досписать 10, доступно 5.",
              "Недостаточно сырья «Морковь»: нужно досписать 20, доступно 6.",
            ],
          },
        },
      },
      rejectWithValue,
    );
    expect(result).toBe(
      "Недостаточно сырья «соль»: нужно досписать 10, доступно 5.\nНедостаточно сырья «Морковь»: нужно досписать 20, доступно 6.",
    );
  });
});
