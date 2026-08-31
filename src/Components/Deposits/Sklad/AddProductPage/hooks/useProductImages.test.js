import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProductImages } from "./useProductImages";

vi.mock("../../../../common/ImageCropperModal", () => ({
  ImageCropperModal: () => null,
}));

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-preview");
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useProductImages", () => {
  it("открывает кроппер при добавлении файла", () => {
    const { result } = renderHook(() => useProductImages());
    const file = new File(["img"], "photo.png", { type: "image/png" });

    act(() => {
      result.current.addImages([file]);
    });

    expect(result.current.cropperOpen).toBe(true);
    expect(result.current.cropperSourceFile).toBe(file);
    expect(result.current.images).toHaveLength(0);
  });

  it("добавляет кадрированный файл в images после подтверждения", () => {
    const { result } = renderHook(() => useProductImages());
    const source = new File(["img"], "photo.png", { type: "image/png" });
    const cropped = new File(["cropped"], "photo.jpg", { type: "image/jpeg" });

    act(() => {
      result.current.addImages([source]);
    });

    act(() => {
      result.current.handleCropComplete(new Blob(["c"], { type: "image/jpeg" }), cropped);
    });

    expect(result.current.cropperOpen).toBe(false);
    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].file).toBe(cropped);
    expect(result.current.images[0].is_primary).toBe(true);
  });

  it("не добавляет файл при отмене кропа", () => {
    const { result } = renderHook(() => useProductImages());
    const file = new File(["img"], "photo.png", { type: "image/png" });

    act(() => {
      result.current.addImages([file]);
    });

    act(() => {
      result.current.handleCropCancel();
    });

    expect(result.current.cropperOpen).toBe(false);
    expect(result.current.images).toHaveLength(0);
  });
});
