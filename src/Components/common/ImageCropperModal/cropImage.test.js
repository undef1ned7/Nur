import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCroppedFileName,
  blobToFile,
  getCroppedImg,
  getRadianAngle,
  normalizeRotation,
  resolveOutputMimeType,
  rotateSize,
} from "./cropImage";

describe("cropImage helpers", () => {
  it("resolveOutputMimeType возвращает webp или jpeg", () => {
    expect(resolveOutputMimeType("image/webp")).toBe("image/webp");
    expect(resolveOutputMimeType("image/png")).toBe("image/jpeg");
    expect(resolveOutputMimeType(undefined)).toBe("image/jpeg");
  });

  it("buildCroppedFileName сохраняет базовое имя и расширение", () => {
    expect(buildCroppedFileName("photo.png", "image/jpeg")).toBe("photo.jpg");
    expect(buildCroppedFileName("item.webp", "image/webp")).toBe("item.webp");
  });

  it("blobToFile создаёт File с нужным типом", () => {
    const blob = new Blob(["x"], { type: "image/jpeg" });
    const file = blobToFile(blob, "test.jpg", "image/jpeg");
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("test.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("normalizeRotation нормализует угол в диапазон 0–360", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-450)).toBe(270);
  });

  it("rotateSize меняет ширину и высоту bounding box при повороте на 90°", () => {
    expect(rotateSize(800, 600, 0)).toEqual({ width: 800, height: 600 });
    expect(rotateSize(800, 600, 90)).toEqual({ width: 600, height: 800 });
  });

  it("getRadianAngle использует нормализованный угол", () => {
    expect(getRadianAngle(-90)).toBeCloseTo((270 * Math.PI) / 180);
  });
});

describe("getCroppedImg", () => {
  const drawImage = vi.fn();
  let createdCanvases = [];

  beforeEach(() => {
    drawImage.mockReset();
    createdCanvases = [];

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, ...args) => {
      const element = originalCreateElement(tagName, ...args);
      if (tagName === "canvas") {
        createdCanvases.push(element);
      }
      return element;
    });

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      translate: vi.fn(),
      rotate: vi.fn(),
    });

    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function mockToBlob(callback, type) {
        callback(new Blob(["cropped"], { type: type || "image/jpeg" }));
      },
    );

    vi.spyOn(global, "Image").mockImplementation(() => {
      const img = document.createElement("img");
      Object.defineProperty(img, "width", { value: 800, writable: true });
      Object.defineProperty(img, "height", { value: 600, writable: true });
      img.addEventListener = (event, handler) => {
        if (event === "load") {
          handler();
        }
      };
      img.setAttribute = vi.fn();
      return img;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("возвращает Blob и File нужного mime-типа", async () => {
    const result = await getCroppedImg(
      "blob:mock-image",
      { x: 0, y: 0, width: 100, height: 100 },
      { fileName: "product.png", mimeType: "image/jpeg", quality: 0.85 },
    );

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.file).toBeInstanceOf(File);
    expect(result.file.name).toBe("product.jpg");
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(createdCanvases[0].width).toBe(800);
    expect(createdCanvases[0].height).toBe(600);
    expect(createdCanvases[1].width).toBe(100);
    expect(createdCanvases[1].height).toBe(100);
  });

  it("при rotation=0 ведёт себя как раньше (без поворота bounding box)", async () => {
    await getCroppedImg(
      "blob:mock-image",
      { x: 10, y: 20, width: 120, height: 120 },
      { rotation: 0 },
    );

    expect(createdCanvases[0].width).toBe(800);
    expect(createdCanvases[0].height).toBe(600);
    expect(createdCanvases[1].width).toBe(120);
    expect(createdCanvases[1].height).toBe(120);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it("при rotation=90 меняет размеры промежуточного canvas (800×600 → 600×800)", async () => {
    await getCroppedImg(
      "blob:mock-image",
      { x: 0, y: 0, width: 100, height: 150 },
      { rotation: 90 },
    );

    expect(createdCanvases[0].width).toBe(600);
    expect(createdCanvases[0].height).toBe(800);
    expect(createdCanvases[1].width).toBe(100);
    expect(createdCanvases[1].height).toBe(150);
  });

  it("нормализует отрицательный и >360 rotation", async () => {
    await getCroppedImg(
      "blob:mock-image",
      { x: 0, y: 0, width: 100, height: 100 },
      { rotation: -90 },
    );
    expect(createdCanvases[0].width).toBe(600);
    expect(createdCanvases[0].height).toBe(800);

    createdCanvases = [];
    await getCroppedImg(
      "blob:mock-image",
      { x: 0, y: 0, width: 100, height: 100 },
      { rotation: 450 },
    );
    expect(createdCanvases[0].width).toBe(600);
    expect(createdCanvases[0].height).toBe(800);
  });

  it("бросает ошибку при некорректной области обрезки", async () => {
    await expect(getCroppedImg("blob:mock", { width: 0, height: 0 })).rejects.toThrow(
      "Invalid crop area",
    );
  });
});
