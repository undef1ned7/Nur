import { describe, expect, it } from "vitest";
import { monthAgoLocalISODate, toLocalISODate } from "./localDate";

describe("toLocalISODate", () => {
  it("берёт локальную дату, а не UTC", () => {
    // 03.10.2026 00:30 по локальному времени — в UTC+6 это ещё 02.10 в UTC
    const d = new Date(2026, 9, 3, 0, 30);
    expect(toLocalISODate(d)).toBe("2026-10-03");
  });

  it("дополняет месяц и день нулями", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("monthAgoLocalISODate", () => {
  it("отнимает месяц от локальной даты", () => {
    expect(monthAgoLocalISODate(new Date(2026, 9, 3, 1, 0))).toBe("2026-09-03");
  });
});
