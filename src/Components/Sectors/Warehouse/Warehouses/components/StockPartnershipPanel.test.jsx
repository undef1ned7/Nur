import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StockPartnershipPanel from "./StockPartnershipPanel";

const api = {
  listStockPartnershipRequests: vi.fn(),
  listActiveStockPartners: vi.fn(),
  acceptStockPartnershipRequest: vi.fn(),
  rejectStockPartnershipRequest: vi.fn(),
  cancelStockPartnershipRequest: vi.fn(),
  createStockPartnershipRequest: vi.fn(),
};
const partnershipApi = {
  listPartnerOperations: vi.fn(),
  approvePartnerOperation: vi.fn(),
  rejectPartnerOperation: vi.fn(),
  cancelPartnerOperation: vi.fn(),
  terminateStockPartnership: vi.fn(),
  updateStockPartnershipSettings: vi.fn(),
  searchPartnershipCompanies: vi.fn(),
};

vi.mock("../../../../../api/warehouse", () => ({
  listStockPartnershipRequests: (...a) => api.listStockPartnershipRequests(...a),
  listActiveStockPartners: (...a) => api.listActiveStockPartners(...a),
  acceptStockPartnershipRequest: (...a) => api.acceptStockPartnershipRequest(...a),
  rejectStockPartnershipRequest: (...a) => api.rejectStockPartnershipRequest(...a),
  cancelStockPartnershipRequest: (...a) => api.cancelStockPartnershipRequest(...a),
  createStockPartnershipRequest: (...a) => api.createStockPartnershipRequest(...a),
}));
vi.mock("../../../../../api/warehousePartnership", () => ({
  PartnershipApiError: class PartnershipApiError extends Error {},
  listPartnerOperations: (...a) => partnershipApi.listPartnerOperations(...a),
  approvePartnerOperation: (...a) => partnershipApi.approvePartnerOperation(...a),
  rejectPartnerOperation: (...a) => partnershipApi.rejectPartnerOperation(...a),
  cancelPartnerOperation: (...a) => partnershipApi.cancelPartnerOperation(...a),
  terminateStockPartnership: (...a) => partnershipApi.terminateStockPartnership(...a),
  updateStockPartnershipSettings: (...a) => partnershipApi.updateStockPartnershipSettings(...a),
  searchPartnershipCompanies: (...a) => partnershipApi.searchPartnershipCompanies(...a),
}));

const alertMock = vi.fn();
let confirmAnswer = true;
const confirmMock = vi.fn((message, cb) => cb(confirmAnswer));
vi.mock("../../../../../hooks/useDialog", () => ({
  useAlert: () => alertMock,
  useConfirm: () => confirmMock,
}));

let user = { profile: { role: "owner" }, company: { id: "own" } };
vi.mock("../../../../../store/slices/userSlice", () => ({
  useUser: () => user,
}));

const pendingIn = {
  id: "r1",
  from_company: "c-in",
  from_company_name: "Входящая ООО",
  to_company_name: "Мы",
  status: "PENDING",
};
const acceptedIn = { ...pendingIn, id: "r2", status: "ACCEPTED" };
const pendingOut = {
  id: "r3",
  to_company: "c-out",
  from_company_name: "Мы",
  to_company_name: "Исходящая ООО",
  status: "PENDING",
};

const renderPanel = (url = "/crm/warehouse/warehouses?tab=partnerships") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <StockPartnershipPanel />
    </MemoryRouter>,
  );

describe("StockPartnershipPanel", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    Object.values(partnershipApi).forEach((fn) => fn.mockReset());
    alertMock.mockReset();
    confirmMock.mockClear();
    confirmAnswer = true;
    user = { profile: { role: "owner" }, company: { id: "own" } };

    api.listStockPartnershipRequests.mockResolvedValue({
      incoming: [pendingIn, acceptedIn],
      outgoing: [pendingOut],
    });
    api.listActiveStockPartners.mockResolvedValue({
      partners: [{ id: "c-partner", name: "Партнёр ООО" }],
    });
    partnershipApi.listPartnerOperations.mockResolvedValue(null);
    api.acceptStockPartnershipRequest.mockResolvedValue({});
  });
  afterEach(cleanup);

  it("кнопки решения только у заявок в статусе «Ожидает», счётчик — по ожидающим", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /Входящие заявки/ }));
    await screen.findByRole("button", { name: "Принять" });
    const rows = screen.getAllByRole("row");
    const pendingRow = rows.find((r) => within(r).queryByText("Ожидает"));
    const acceptedRow = rows.find((r) => within(r).queryByText("Принята"));

    expect(within(pendingRow).getByRole("button", { name: "Принять" })).toBeTruthy();
    expect(within(acceptedRow).queryByRole("button", { name: "Принять" })).toBeNull();
    expect(
      within(screen.getByRole("tab", { name: /Входящие заявки/ })).getByText("1"),
    ).toBeTruthy();
  });

  it("по умолчанию открыты «Активные»; ?sub=incoming открывает входящие заявки", async () => {
    renderPanel();
    expect(await screen.findByRole("tab", { name: /Активные/, selected: true })).toBeTruthy();
    cleanup();

    renderPanel("/crm/warehouse/warehouses?tab=partnerships&sub=incoming");
    expect(await screen.findByRole("tab", { name: /Входящие заявки/, selected: true })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Принять" })).toBeTruthy();
  });

  it("принятие заявки — только после подтверждения", async () => {
    confirmAnswer = false;
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /Входящие заявки/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Принять" }));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(api.acceptStockPartnershipRequest).not.toHaveBeenCalled();

    confirmAnswer = true;
    fireEvent.click(screen.getByRole("button", { name: "Принять" }));
    await waitFor(() => expect(api.acceptStockPartnershipRequest).toHaveBeenCalledWith("r1"));
  });

  it("старый бэк: нет вкладки запросов и кнопки «Разорвать»", async () => {
    renderPanel();
    expect(await screen.findByText("Партнёр ООО")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Запросы на товар и деньги/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Разорвать" })).toBeNull();
  });

  it("новый бэк: входящий запрос на товар можно подтвердить", async () => {
    partnershipApi.listPartnerOperations.mockResolvedValue({
      incoming: [
        {
          id: "op1",
          kind: "TRANSFER",
          status: "PENDING",
          initiator_company_name: "Партнёр ООО",
          warehouse_from_name: "Наш склад",
          warehouse_to_name: "Их склад",
          items: [{ product: "p1" }, { product: "p2" }],
        },
      ],
      outgoing: [],
    });
    partnershipApi.approvePartnerOperation.mockResolvedValue({});
    renderPanel();

    const tab = await screen.findByRole("tab", { name: /Запросы на товар и деньги/ });
    expect(within(tab).getByText("1")).toBeTruthy();
    fireEvent.click(tab);
    expect(screen.getByText("2 позиции: Наш склад → Их склад")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
    await waitFor(() => expect(partnershipApi.approvePartnerOperation).toHaveBeenCalledWith("op1"));
  });

  it("новый бэк: разрыв партнёрства и настройка «без подтверждения»", async () => {
    api.listActiveStockPartners.mockResolvedValue({
      partners: [
        {
          id: "c-partner",
          name: "Партнёр ООО",
          partnership_id: "ps1",
          since: "2026-05-30T10:00:00Z",
          allow_direct_pull: false,
        },
      ],
    });
    partnershipApi.terminateStockPartnership.mockResolvedValue({});
    partnershipApi.updateStockPartnershipSettings.mockResolvedValue({});
    renderPanel();

    expect(await screen.findByRole("tab", { name: /Активные/, selected: true })).toBeTruthy();
    fireEvent.click(await screen.findByRole("switch"));
    await waitFor(() =>
      expect(partnershipApi.updateStockPartnershipSettings).toHaveBeenCalledWith("c-partner", {
        allow_direct_pull: true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Разорвать" }));
    await waitFor(() =>
      expect(partnershipApi.terminateStockPartnership).toHaveBeenCalledWith("c-partner"),
    );
  });

  it("история продаж: кнопка выключена, если партнёр скрыл продажи; свои продажи можно скрыть", async () => {
    api.listActiveStockPartners.mockResolvedValue({
      partners: [
        {
          id: "c-open",
          name: "Открытый ООО",
          partnership_id: "ps1",
          allow_direct_pull: false,
          share_sales_history: true,
          partner_shares_sales_history: true,
        },
        {
          id: "c-closed",
          name: "Закрытый ООО",
          partnership_id: "ps2",
          allow_direct_pull: false,
          share_sales_history: true,
          partner_shares_sales_history: false,
        },
      ],
    });
    partnershipApi.updateStockPartnershipSettings.mockResolvedValue({});
    renderPanel();

    // «Активные» открыты по умолчанию
    const openRow = (await screen.findByText("Открытый ООО")).closest("tr");
    const closedRow = screen.getByText("Закрытый ООО").closest("tr");
    expect(within(openRow).getByRole("button", { name: "Продажи" }).disabled).toBe(false);
    expect(within(closedRow).getByRole("button", { name: "Продажи" }).disabled).toBe(true);

    // Скрыть свои продажи — без подтверждения (доступ сужается)
    fireEvent.click(within(openRow).getByRole("switch", { name: "Видны партнёру" }));
    await waitFor(() =>
      expect(partnershipApi.updateStockPartnershipSettings).toHaveBeenCalledWith("c-open", {
        share_sales_history: false,
      }),
    );
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("приглашение: своя компания, партнёры и открытые заявки — без кнопки «Отправить»", async () => {
    partnershipApi.searchPartnershipCompanies.mockResolvedValue([
      { id: "own", name: "Мы" },
      { id: "c-partner", name: "Партнёр ООО" },
      { id: "c-out", name: "Исходящая ООО" },
      { id: "c-in", name: "Входящая ООО" },
      { id: "c-new", name: "Новая ООО" },
    ]);
    renderPanel();
    await screen.findByText("Партнёр ООО");

    fireEvent.click(screen.getByRole("button", { name: /Пригласить/ }));
    const dialog = screen.getByRole("dialog", { name: "Заявка на партнёрство" });
    fireEvent.change(within(dialog).getByLabelText("Поиск компании"), {
      target: { value: "ООО" },
    });

    expect(await within(dialog).findByText("Новая ООО")).toBeTruthy();
    expect(within(dialog).getByText("Ваша компания")).toBeTruthy();
    expect(within(dialog).getByText("Уже партнёр")).toBeTruthy();
    expect(within(dialog).getByText("Заявка отправлена")).toBeTruthy();
    expect(within(dialog).getByText("Есть входящая заявка")).toBeTruthy();
    expect(within(dialog).getAllByRole("button", { name: /Отправить/ })).toHaveLength(1);
  });

  it("приглашение: короткий запрос не ищет", async () => {
    renderPanel();
    await screen.findByText("Партнёр ООО");
    fireEvent.click(screen.getByRole("button", { name: /Пригласить/ }));
    fireEvent.change(screen.getByLabelText("Поиск компании"), { target: { value: "ОО" } });
    expect(screen.getByText("Введите минимум 3 символа")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 350));
    expect(partnershipApi.searchPartnershipCompanies).not.toHaveBeenCalled();
  });
});
