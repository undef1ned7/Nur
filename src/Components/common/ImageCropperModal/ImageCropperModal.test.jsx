import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImageCropperModal from "./ImageCropperModal";
import { getCroppedImg } from "./cropImage";

const cropCompleteMock = vi.fn();

vi.mock("../Portal/ReactPortal", () => ({
  default: ({ children }) => <div data-testid="portal">{children}</div>,
}));

vi.mock("react-easy-crop", () => ({
  default: ({ onCropComplete }) => {
    React.useEffect(() => {
      onCropComplete({}, { x: 0, y: 0, width: 120, height: 120 });
    }, [onCropComplete]);
    return <div data-testid="mock-cropper">cropper</div>;
  },
}));

vi.mock("./cropImage", () => ({
  getCroppedImg: vi.fn(async () => ({
    blob: new Blob(["ok"], { type: "image/jpeg" }),
    file: new File(["ok"], "photo.jpg", { type: "image/jpeg" }),
    mimeType: "image/jpeg",
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ImageCropperModal", () => {
  it("не рендерится, когда закрыта", () => {
    render(
      <ImageCropperModal
        open={false}
        imageSrc="blob:test"
        onCropComplete={cropCompleteMock}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText("Обрезка изображения")).toBeNull();
  });

  it("рендерится и закрывается по кнопке Отмена", () => {
    const onClose = vi.fn();
    render(
      <ImageCropperModal
        open
        imageSrc="blob:test"
        onCropComplete={cropCompleteMock}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Обрезка изображения")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("вызывает onCropComplete при применении обрезки", async () => {
    const onCropComplete = vi.fn();
    render(
      <ImageCropperModal
        open
        imageSrc="blob:test"
        sourceFile={new File(["x"], "source.png", { type: "image/png" })}
        onCropComplete={onCropComplete}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-cropper")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Применить" }));

    await waitFor(() => {
      expect(onCropComplete).toHaveBeenCalledTimes(1);
    });
    expect(onCropComplete.mock.calls[0][1]).toBeInstanceOf(File);
  });

  it("кнопка поворота на 90° по часовой обновляет слайдер поворота", () => {
    render(
      <ImageCropperModal
        open
        imageSrc="blob:test"
        onCropComplete={cropCompleteMock}
        onClose={vi.fn()}
      />,
    );

    const rotationSlider = screen.getByLabelText("Поворот");
    expect(rotationSlider.value).toBe("0");

    fireEvent.click(
      screen.getByRole("button", { name: "Повернуть по часовой стрелке на 90°" }),
    );
    expect(rotationSlider.value).toBe("90");

    fireEvent.click(
      screen.getByRole("button", { name: "Повернуть по часовой стрелке на 90°" }),
    );
    expect(rotationSlider.value).toBe("180");
  });

  it("слайдер поворота обновляет значение при изменении", () => {
    render(
      <ImageCropperModal
        open
        imageSrc="blob:test"
        onCropComplete={cropCompleteMock}
        onClose={vi.fn()}
      />,
    );

    const rotationSlider = screen.getByLabelText("Поворот");
    fireEvent.change(rotationSlider, { target: { value: "45" } });
    expect(rotationSlider.value).toBe("45");
  });

  it("передаёт rotation в getCroppedImg при применении", async () => {
    render(
      <ImageCropperModal
        open
        imageSrc="blob:test"
        sourceFile={new File(["x"], "source.png", { type: "image/png" })}
        onCropComplete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-cropper")).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Повернуть по часовой стрелке на 90°" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));

    await waitFor(() => {
      expect(getCroppedImg).toHaveBeenCalled();
    });

    expect(getCroppedImg).toHaveBeenCalledWith(
      "blob:test",
      { x: 0, y: 0, width: 120, height: 120 },
      expect.objectContaining({ rotation: 90 }),
    );
  });
});
