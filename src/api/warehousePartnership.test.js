import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
const getStockPartnerCatalog = vi.fn();
const searchAgentCompanies = vi.fn();

vi.mock("./index", () => ({ default: { request: (...args) => request(...args) } }));
vi.mock("./warehouse", () => ({
  getStockPartnerCatalog: (...args) => getStockPartnerCatalog(...args),
  searchAgentCompanies: (...args) => searchAgentCompanies(...args),
}));

const {
  PartnershipApiError,
  __resetPartnershipEndpointCache,
  getPartnerWarehouses,
  isEndpointMissing,
  listPartnerOperations,
  searchPartnershipCompanies,
} = await import("./warehousePartnership");

const httpError = (status, data) => {
  const err = new Error("Request failed");
  err.response = { status, data };
  return err;
};

describe("warehousePartnership API", () => {
  beforeEach(() => {
    request.mockReset();
    getStockPartnerCatalog.mockReset();
    searchAgentCompanies.mockReset();
    __resetPartnershipEndpointCache();
  });

  it("isEndpointMissing: HTML 404 — эндпоинта нет, JSON 404 — объект не найден", () => {
    expect(isEndpointMissing(new PartnershipApiError(404, "<h1>Not Found</h1>"))).toBe(true);
    expect(isEndpointMissing(new PartnershipApiError(405, undefined))).toBe(true);
    expect(isEndpointMissing(new PartnershipApiError(404, { detail: "Не найдено." }))).toBe(false);
    expect(isEndpointMissing(new PartnershipApiError(500, "<html>"))).toBe(false);
  });

  it("лёгкий список складов партнёра", async () => {
    request.mockResolvedValueOnce({ data: { warehouses: [{ id: "w1" }], cash_registers: [] } });
    const res = await getPartnerWarehouses("p1");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: "warehouse/stock-partnerships/companies/p1/warehouses/",
      }),
    );
    expect(res).toMatchObject({ source: "light", warehouses: [{ id: "w1" }] });
  });

  it("старый бэк: откат на полный каталог и больше не стучимся в 404", async () => {
    request.mockRejectedValue(httpError(404, "<h1>Not Found</h1>"));
    getStockPartnerCatalog.mockResolvedValue({ warehouses: [{ id: "w1", products: [] }] });

    const first = await getPartnerWarehouses("p1");
    const second = await getPartnerWarehouses("p2");

    expect(first.source).toBe("catalog");
    expect(second.source).toBe("catalog");
    expect(request).toHaveBeenCalledTimes(1);
    expect(getStockPartnerCatalog).toHaveBeenCalledTimes(2);
  });

  it("ошибка прав на новом бэке не маскируется откатом", async () => {
    request.mockRejectedValueOnce(httpError(403, { detail: "Только владелец/админ." }));
    await expect(getPartnerWarehouses("p1")).rejects.toMatchObject({
      status: 403,
      data: { detail: "Только владелец/админ." },
    });
    expect(getStockPartnerCatalog).not.toHaveBeenCalled();
  });

  it("поиск компаний: откат на поиск для агентов", async () => {
    request.mockRejectedValueOnce(httpError(404, "<html>"));
    searchAgentCompanies.mockResolvedValueOnce([{ id: "c1", name: "Альфа" }]);
    await expect(searchPartnershipCompanies("Аль")).resolves.toEqual([{ id: "c1", name: "Альфа" }]);
    expect(searchAgentCompanies).toHaveBeenCalledWith({ search: "Аль" });
  });

  it("операции: null, если бэк их ещё не поддерживает", async () => {
    request.mockRejectedValueOnce(httpError(404, "<html>"));
    await expect(listPartnerOperations()).resolves.toBeNull();
    await expect(listPartnerOperations()).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
