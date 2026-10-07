import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StockPartnershipTransferModal from "./StockPartnershipTransferModal";

const transferStockPartnership = vi.fn();
let transferImpl = () => Promise.resolve({ id: "doc", status: "POSTED" });
const alertMock = vi.fn();

vi.mock("../../../../../api/warehouse", () => ({
  transferStockPartnership: (...args) => {
    transferStockPartnership(...args);
    return transferImpl(...args);
  },
}));
vi.mock("../../../../../hooks/useDialog", () => ({
  useAlert: () => alertMock,
}));

const product = {
  id: "p1",
  name: "Нори",
  article: "N-1",
  unit: "шт",
  qty: "10",
  purchase_price: "120",
};

const renderModal = (props = {}) => {
  const onClose = vi.fn();
  const onTransferred = vi.fn();
  render(
    <StockPartnershipTransferModal
      mode="send"
      onClose={onClose}
      product={product}
      warehouseFromId="wh-own"
      partnerCompanyName="Сильвер Манас"
      targetWarehouses={[{ id: "wh-partner", name: "Основной" }]}
      onTransferred={onTransferred}
      {...props}
    />,
  );
  return { onClose, onTransferred };
};

const fillTarget = () =>
  fireEvent.change(screen.getByLabelText("Склад партнёра-получатель"), {
    target: { value: "wh-partner" },
  });

describe("StockPartnershipTransferModal", () => {
  beforeEach(() => {
    transferStockPartnership.mockReset();
    alertMock.mockReset();
    transferImpl = () => Promise.resolve({ id: "doc", status: "POSTED" });
  });
  afterEach(cleanup);

  it("отправляет закупочную цену вместо нуля", async () => {
    const { onClose, onTransferred } = renderModal();
    fillTarget();
    fireEvent.change(screen.getByLabelText("Количество"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(transferStockPartnership).toHaveBeenCalledWith({
      warehouse_from: "wh-own",
      warehouse_to: "wh-partner",
      comment: "Межкомпанейское перемещение",
      items: [
        {
          product: "p1",
          qty: "3.000",
          price: "120.00",
          discount_percent: "0.00",
          discount_amount: "0.00",
        },
      ],
    });
    expect(onTransferred).toHaveBeenCalledWith("send", "wh-own", { pending: false });
    expect(alertMock).toHaveBeenCalledWith("Перемещение проведено");
  });

  it("не даёт отправить больше остатка", () => {
    renderModal();
    fillTarget();
    fireEvent.change(screen.getByLabelText("Количество"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(transferStockPartnership).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(
      "«Нори»: количество не может превышать остаток (10.000)",
      true,
    );
  });

  it("запрос с подтверждением партнёра: сообщает, что товар придёт позже", async () => {
    transferImpl = () =>
      Promise.resolve({ result: "pending", operation: { id: "op1", status: "PENDING" } });
    const { onTransferred } = renderModal({
      mode: "receive",
      pullMode: "confirm",
      targetWarehouses: [{ id: "wh-own-2", name: "Мой склад" }],
      warehouseFromId: "wh-partner",
    });

    expect(screen.getByText(/должен его подтвердить/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ваш склад-получатель"), {
      target: { value: "wh-own-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Запросить" }));

    await waitFor(() =>
      expect(onTransferred).toHaveBeenCalledWith("receive", "wh-partner", { pending: true }),
    );
    expect(alertMock.mock.calls[0][0]).toMatch(/Запрос отправлен «Сильвер Манас»/);
  });

  it("старый бэк: предупреждает, что списание у партнёра произойдёт сразу", () => {
    renderModal({ mode: "receive", pullMode: "legacy" });
    expect(screen.getByText(/без его подтверждения/)).toBeTruthy();
  });

  it("во время отправки окно не закрывается кликом по фону", async () => {
    let resolve;
    transferImpl = () =>
      new Promise((r) => {
        resolve = r;
      });
    const { onClose } = renderModal();
    fillTarget();
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Отправляем..." })).toBeTruthy());
    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).not.toHaveBeenCalled();

    resolve({ id: "doc" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("массовая отправка: правильное склонение в кнопке", () => {
    renderModal({
      product: null,
      products: [
        product,
        { ...product, id: "p2", name: "Рис" },
        { ...product, id: "p3", name: "Соус" },
        { ...product, id: "p4", name: "Имбирь" },
        { ...product, id: "p5", name: "Васаби" },
      ],
    });
    expect(screen.getByRole("button", { name: "Отправить 5 позиций" })).toBeTruthy();
  });
});
