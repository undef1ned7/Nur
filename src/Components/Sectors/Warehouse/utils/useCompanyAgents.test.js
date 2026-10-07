import { describe, expect, it } from "vitest";
import { companyAgentOptions } from "./useCompanyAgents";

describe("companyAgentOptions", () => {
  it("берёт активных и отстранённых, без заявок pending/rejected", () => {
    const options = companyAgentOptions([
      { user: "1", user_display: "Бакыт", status: "active" },
      { user: "2", user_display: "Айбек", status: "removed" },
      { user: "3", user_display: "Нурлан", status: "pending" },
      { user: "4", user_display: "Эрлан", status: "rejected" },
    ]);
    expect(options).toEqual([
      { id: "2", name: "Айбек (отстранён)" },
      { id: "1", name: "Бакыт" },
    ]);
  });

  it("не ограничивает список десятью агентами", () => {
    const list = Array.from({ length: 11 }, (_, i) => ({
      user: `u${i}`,
      user_display: `Агент ${String(i).padStart(2, "0")}`,
      status: "active",
    }));
    expect(companyAgentOptions(list)).toHaveLength(11);
  });

  it("активное членство важнее отстранённого для того же пользователя", () => {
    const options = companyAgentOptions([
      { user: "1", user_display: "Бакыт", status: "active" },
      { user: "1", user_display: "Бакыт", status: "removed" },
    ]);
    expect(options).toEqual([{ id: "1", name: "Бакыт" }]);
  });

  it("принимает пагинированный ответ", () => {
    expect(
      companyAgentOptions({ results: [{ user: "1", user_display: "А", status: "active" }] }),
    ).toEqual([{ id: "1", name: "А" }]);
  });
});
