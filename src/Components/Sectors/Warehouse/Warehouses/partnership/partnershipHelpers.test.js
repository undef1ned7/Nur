import { describe, expect, it } from "vitest";
import { PartnershipApiError } from "../../../../../api/warehousePartnership";
import {
  extractPartnershipError,
  isPendingOperationResponse,
  partnerPullMode,
  pluralRu,
  resolveInviteStatus,
  transferItemPrice,
  validateTransferQty,
} from "./partnershipHelpers";

describe("extractPartnershipError", () => {
  it("берёт detail и не показывает ключи полей", () => {
    expect(extractPartnershipError({ detail: "Нет партнёрства" })).toBe("Нет партнёрства");
    expect(
      extractPartnershipError({
        warehouse: ["Один из складов должен принадлежать вашей компании."],
        items: [{ qty: ["Некорректное число."] }],
      }),
    ).toBe("Один из складов должен принадлежать вашей компании.; Некорректное число.");
  });

  it("разворачивает PartnershipApiError и не выводит HTML страницы ошибки", () => {
    expect(
      extractPartnershipError(new PartnershipApiError(400, { detail: "Сумма должна быть больше 0." })),
    ).toBe("Сумма должна быть больше 0.");
    expect(extractPartnershipError(new PartnershipApiError(403, "<html>"))).toBe(
      "Недостаточно прав для этого действия.",
    );
    expect(extractPartnershipError("<!doctype html><h1>Server Error</h1>")).toBe("Ошибка сервера.");
  });
});

describe("pluralRu", () => {
  const forms = ["товар", "товара", "товаров"];
  it.each([
    [1, "товар"],
    [2, "товара"],
    [5, "товаров"],
    [11, "товаров"],
    [14, "товаров"],
    [21, "товар"],
    [22, "товара"],
    [111, "товаров"],
  ])("%i → %s", (n, expected) => {
    expect(pluralRu(n, forms)).toBe(expected);
  });
});

describe("isPendingOperationResponse", () => {
  it("распознаёт ответ «ушло на подтверждение»", () => {
    expect(isPendingOperationResponse({ result: "pending", operation: { id: "1" } })).toBe(true);
    expect(isPendingOperationResponse({ operation: { status: "PENDING" } })).toBe(true);
  });

  it("проведённый документ — не pending", () => {
    expect(isPendingOperationResponse({ id: "doc", status: "POSTED" })).toBe(false);
    expect(isPendingOperationResponse(undefined)).toBe(false);
  });
});

describe("partnerPullMode", () => {
  it("старый бэк без флага — legacy", () => {
    expect(partnerPullMode(undefined)).toBe("legacy");
    expect(partnerPullMode({})).toBe("legacy");
  });

  it("новый бэк: подтверждение или прямое списание", () => {
    expect(partnerPullMode({ partner_allows_direct_pull: false })).toBe("confirm");
    expect(partnerPullMode({ partner_allows_direct_pull: true })).toBe("direct");
  });
});

describe("resolveInviteStatus", () => {
  const ctx = {
    ownCompanyId: "own",
    partnerIds: new Set(["p1"]),
    outgoingPendingIds: new Set(["out"]),
    incomingPendingIds: new Set(["in"]),
  };

  it("свою компанию, партнёров и открытые заявки пригласить нельзя", () => {
    expect(resolveInviteStatus({ id: "own" }, ctx)).toBe("SELF");
    expect(resolveInviteStatus({ id: "p1" }, ctx)).toBe("ACTIVE");
    expect(resolveInviteStatus({ id: "out" }, ctx)).toBe("PENDING_OUT");
    expect(resolveInviteStatus({ id: "in" }, ctx)).toBe("PENDING_IN");
    expect(resolveInviteStatus({ id: "new" }, ctx)).toBeNull();
  });

  it("статус от нового бэка важнее вычисленного", () => {
    expect(resolveInviteStatus({ id: "new", partnership_status: "PENDING_IN" }, ctx)).toBe(
      "PENDING_IN",
    );
  });
});

describe("transferItemPrice", () => {
  it("передаёт закупочную цену, если она известна", () => {
    expect(transferItemPrice({ purchase_price: "125.5" })).toBe("125.50");
    expect(transferItemPrice({})).toBe("0.00");
    expect(transferItemPrice({ purchase_price: "-3" })).toBe("0.00");
  });
});

describe("validateTransferQty", () => {
  it("количество > 0 и не больше остатка", () => {
    expect(validateTransferQty("0", 10)).toBe("Укажите корректное количество");
    expect(validateTransferQty("abc", 10)).toBe("Укажите корректное количество");
    expect(validateTransferQty("11", 10)).toBe("Количество не может превышать остаток (10.000)");
    expect(validateTransferQty("2,5", 10)).toBeNull();
    expect(validateTransferQty("50", 0)).toBeNull();
  });
});
