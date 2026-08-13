import { describe, expect, it } from "vitest";
import {
  addDaysToIso,
  addMonthsToIso,
  buildDebtSchedule,
  scheduleCountLabel,
  splitMoneyEvenly,
  toDealInstallments,
} from "./buildDebtSchedule";

describe("buildDebtSchedule", () => {
  it("splits remaining amount evenly and puts remainder on last payment", () => {
    expect(splitMoneyEvenly(100, 3)).toEqual([33.33, 33.33, 33.34]);

    const schedule = buildDebtSchedule({
      remainingAmount: 10000,
      unit: "month",
      count: 3,
      firstDueDate: "2026-01-31",
    });

    expect(schedule?.installments.map((item) => item.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(schedule?.installments.map((item) => item.amountStr)).toEqual([
      "3333.33",
      "3333.33",
      "3333.34",
    ]);
    expect(schedule?.lastDueDate).toBe("2026-03-31");
  });

  it("builds daily installments from the first due date", () => {
    const schedule = buildDebtSchedule({
      remainingAmount: 300,
      unit: "day",
      count: 3,
      firstDueDate: "2026-08-12",
    });

    expect(schedule?.installments.map((item) => item.dueDate)).toEqual([
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
    expect(schedule?.installments.map((item) => item.amount)).toEqual([
      100, 100, 100,
    ]);
  });

  it("spaces daily payments by a custom interval", () => {
    const everyOther = buildDebtSchedule({
      remainingAmount: 300,
      unit: "day",
      count: 3,
      firstDueDate: "2026-08-12",
      intervalDays: 2,
    });
    expect(everyOther?.installments.map((item) => item.dueDate)).toEqual([
      "2026-08-12",
      "2026-08-14",
      "2026-08-16",
    ]);

    const everyThree = buildDebtSchedule({
      remainingAmount: 400,
      unit: "day",
      count: 4,
      firstDueDate: "2026-08-12",
      intervalDays: 3,
    });
    expect(everyThree?.installments.map((item) => item.dueDate)).toEqual([
      "2026-08-12",
      "2026-08-15",
      "2026-08-18",
      "2026-08-21",
    ]);
    expect(everyThree?.intervalDays).toBe(3);
  });

  it("spaces monthly payments by a custom interval", () => {
    const everyTwoMonths = buildDebtSchedule({
      remainingAmount: 300,
      unit: "month",
      count: 3,
      firstDueDate: "2026-01-31",
      intervalMonths: 2,
    });
    expect(everyTwoMonths?.installments.map((item) => item.dueDate)).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
    ]);
    expect(everyTwoMonths?.intervalMonths).toBe(2);
  });

  it("clamps month overflow and formats deal payload", () => {
    expect(addMonthsToIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addDaysToIso("2026-08-31", 1)).toBe("2026-09-01");
    expect(scheduleCountLabel("month", 1)).toBe("месяц");
    expect(scheduleCountLabel("day", 7)).toBe("дней");

    const schedule = buildDebtSchedule({
      remainingAmount: 90,
      unit: "day",
      count: 2,
      firstDueDate: "2026-08-12",
    });
    expect(toDealInstallments(schedule)).toEqual([
      { number: 1, amount: "45.00", due_date: "2026-08-12" },
      { number: 2, amount: "45.00", due_date: "2026-08-13" },
    ]);
  });

  it("returns null for invalid remaining amount or count", () => {
    expect(
      buildDebtSchedule({
        remainingAmount: 0,
        unit: "day",
        count: 3,
        firstDueDate: "2026-08-12",
      }),
    ).toBeNull();
    expect(
      buildDebtSchedule({
        remainingAmount: 100,
        unit: "month",
        count: 0,
        firstDueDate: "2026-08-12",
      }),
    ).toBeNull();
  });
});
