import { describe, expect, it } from "vitest";
import {
  validateResErrors,
  getApiErrorPayload,
} from "./validateResErrors";

describe("validateResErrors", () => {
  it("returns fallback for null/undefined error", () => {
    expect(validateResErrors(null)).toBe("Произошла ошибка");
    expect(validateResErrors(undefined, "Custom")).toBe("Custom");
  });

  it("returns plain string errors when not generic", () => {
    expect(validateResErrors("Сервер недоступен")).toBe("Сервер недоступен");
  });

  it("extracts detail from axios response", () => {
    const error = {
      isAxiosError: true,
      response: { data: { detail: "Неверный пароль" } },
    };
    expect(validateResErrors(error)).toBe("Неверный пароль");
  });

  it("joins field validation errors", () => {
    const error = {
      response: {
        data: {
          email: ["Обязательное поле"],
          phone: ["Неверный формат"],
        },
      },
    };
    expect(validateResErrors(error)).toBe(
      "Обязательное поле; Неверный формат",
    );
  });

  it("returns fallback when axios error has no useful payload", () => {
    const error = {
      isAxiosError: true,
      response: { data: {} },
      message: "Request failed with status code 500",
    };
    expect(validateResErrors(error, "Fallback")).toBe("Fallback");
  });

  it("handles rejected payload objects", () => {
    expect(getApiErrorPayload({ detail: "Ошибка доступа" })).toEqual({
      detail: "Ошибка доступа",
    });
    expect(validateResErrors({ detail: "Ошибка доступа" })).toBe(
      "Ошибка доступа",
    );
  });
});
