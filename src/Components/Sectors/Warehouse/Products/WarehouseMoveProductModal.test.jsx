import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WarehouseMoveProductModal from "./WarehouseMoveProductModal";

const transferWarehouse = vi.fn(() => Promise.resolve({ id: "doc" }));
const transferStockPartnership = vi.fn(() => Promise.resolve({ id: "doc" }));
const listActiveStockPartners = vi.fn(() =>
  Promise.resolve({ partners: [{ id: "c-partner", name: "Партнёр ООО" }] }),
);
const getPartnerWarehouses = vi.fn(() =>
  Promise.resolve({ source: "light", warehouses: [{ id: "wh-partner", name: "Склад партнёра" }] }),
);

vi.mock("../../../../api/warehouse", () => ({
  transferWarehouse: (...a) => transferWarehouse(...a),
  transferStockPartnership: (...a) => transferStockPartnership(...a),
  listActiveStockPartners: (...a) => listActiveStockPartners(...a),
}));
vi.mock("../../../../api/warehousePartnership", () => ({
  PartnershipApiError: class PartnershipApiError extends Error {},
  getPartnerWarehouses: (...a) => getPartnerWarehouses(...a),
}));
vi.mock("../../../../store/creators/warehouseCreators", () => ({
  fetchWarehousesAsync: () => ({ type: "noop" }),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) =>
    selector({
      warehouse: {
        list: [
          { id: "wh-1", name: "Основной" },
          { id: "wh-2", name: "Второй" },
        ],
        loading: false,
      },
    }),
}));

const alertMock = vi.fn();
vi.mock("../../../../hooks/useDialog", () => ({ useAlert: () => alertMock }));

let user = { profile: { role: "owner" } };
vi.mock("../../../../store/slices/userSlice", () => ({ useUser: () => user }));

const product = {
  id: "p1",
  name: "Нори",
  unit: "шт",
  warehouse: "wh-1",
  quantity: "40",
  purchase_price: "15",
};

const renderModal = () => {
  const onClose = vi.fn();
  const onMoved = vi.fn();
  render(
    <WarehouseMoveProductModal open onClose={onClose} product={product} onMoved={onMoved} />,
  );
  return { onClose, onMoved };
};

describe("WarehouseMoveProductModal", () => {
  beforeEach(() => {
    transferWarehouse.mockClear();
    transferStockPartnership.mockClear();
    alertMock.mockReset();
    user = { profile: { role: "owner" } };
  });
  afterEach(cleanup);

  it("внутреннее перемещение передаёт введённое количество, а не весь остаток", async () => {
    const { onMoved } = renderModal();
    expect(screen.queryByRole("option", { name: "Основной" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Склад-получатель"), { target: { value: "wh-2" } });
    fireEvent.change(screen.getByLabelText("Количество"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Переместить" }));

    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(transferWarehouse).toHaveBeenCalledWith({
      warehouse_from: "wh-1",
      warehouse_to: "wh-2",
      comment: "Перемещение",
      items: [{ product: "p1", qty: "5.000", price: "15.00" }],
    });
  });

  it("не перемещает больше остатка", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Склад-получатель"), { target: { value: "wh-2" } });
    fireEvent.change(screen.getByLabelText("Количество"), { target: { value: "41" } });
    fireEvent.click(screen.getByRole("button", { name: "Переместить" }));
    expect(transferWarehouse).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(
      "Количество не может превышать остаток (40.000)",
      true,
    );
  });

  it("вкладки «Партнёру» нет у сотрудника", () => {
    user = { profile: { role: "manager" } };
    renderModal();
    expect(screen.queryByRole("button", { name: "Партнёру" })).toBeNull();
  });

  it("владелец передаёт партнёру с закупочной ценой", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Партнёру" }));
    fireEvent.change(await screen.findByLabelText("Компания-партнёр"), {
      target: { value: "c-partner" },
    });
    await screen.findByRole("option", { name: "Склад партнёра" });
    fireEvent.change(screen.getByLabelText("Склад партнёра-получатель"), {
      target: { value: "wh-partner" },
    });
    fireEvent.change(screen.getByLabelText("Количество"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Передать партнёру" }));

    await waitFor(() => expect(transferStockPartnership).toHaveBeenCalled());
    expect(getPartnerWarehouses).toHaveBeenCalledWith("c-partner");
    expect(transferStockPartnership.mock.calls[0][0]).toMatchObject({
      warehouse_from: "wh-1",
      warehouse_to: "wh-partner",
      items: [{ product: "p1", qty: "2.000", price: "15.00" }],
    });
  });
});
