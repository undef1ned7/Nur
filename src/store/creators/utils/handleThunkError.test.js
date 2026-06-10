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
});
