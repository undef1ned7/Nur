import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StockAdjustmentModal from "./StockAdjustmentModal";

// vi.fn только записывает вызовы; ответ отдаёт adjustImpl. Если вернуть отклонённый
// промис из самого vi.fn, шпион оставляет свою копию промиса без обработчика и
// vitest засчитывает это как unhandled rejection.
const adjustProductStock = vi.fn();
let adjustImpl = () => Promise.resolve({});

vi.mock("../../../../api/warehouse", () => ({
  adjustProductStock: (...args) => {
    adjustProductStock(...args);
    return adjustImpl(...args);
  },
}));

const renderModal = (props = {}) =>
  render(
    <StockAdjustmentModal
      onClose={vi.fn()}
      productId="p1"
      productName="Нори"
      currentQty="90"
      unit="шт"
      onAdjusted={vi.fn()}
      {...props}
    />,
  );

describe("StockAdjustmentModal", () => {
  beforeEach(() => {
    adjustProductStock.mockReset();
    adjustImpl = () => Promise.resolve({});
  });
  afterEach(cleanup);

  it("подставляет текущий остаток и показывает недостачу", () => {
    renderModal();
    const input = screen.getByLabelText("Фактическое количество");
    expect(input).toHaveValue("90");
    fireEvent.change(input, { target: { value: "50" } });
    expect(screen.getByText(/Недостача: -40/)).toBeInTheDocument();
  });

  it("не даёт провести без изменения количества", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Провести корректировку" })).toBeDisabled();
  });

  it("отправляет fact_qty и комментарий, отдаёт результат наверх", async () => {
    const onAdjusted = vi.fn();
    const result = { document_number: "INVENTORY-20261003-0002", qty_before: "90.000", qty_after: "50.000", delta: "-40.000" };
    adjustImpl = () => Promise.resolve(result);
    renderModal({ onAdjusted });

    fireEvent.change(screen.getByLabelText("Фактическое количество"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Комментарий"), { target: { value: "Пересчёт на полке" } });
    fireEvent.click(screen.getByRole("button", { name: "Провести корректировку" }));

    await waitFor(() => expect(onAdjusted).toHaveBeenCalledWith(result, 50));
    expect(adjustProductStock).toHaveBeenCalledWith("p1", {
      fact_qty: "50",
      comment: "Пересчёт на полке",
    });
  });

  it("отрицательное количество не отправляется", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Фактическое количество"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Провести корректировку" }));
    expect(screen.getByRole("alert")).toHaveTextContent("0 или больше");
    expect(adjustProductStock).not.toHaveBeenCalled();
  });

  it("показывает ошибку бэкенда", async () => {
    adjustImpl = () => Promise.reject({ fact_qty: ["Некорректное число."] });
    renderModal();
    fireEvent.change(screen.getByLabelText("Фактическое количество"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Провести корректировку" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Некорректное число.");
  });
});
