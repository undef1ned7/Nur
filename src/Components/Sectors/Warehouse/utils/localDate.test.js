import { describe, expect, it } from "vitest";
import {
  dateInputToLocalDateTime,
  monthAgoLocalISODate,
  toLocalISODate,
} from "./localDate";

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

describe("dateInputToLocalDateTime (B32)", () => {
  it("сохраняет выбранный день и подставляет текущее время с часовым поясом", () => {
    const now = new Date(2026, 9, 8, 14, 23, 5);
    const value = dateInputToLocalDateTime("2026-10-08", now);
    expect(value).toMatch(/^2026-10-08T14:23:05[+-]\d{2}:\d{2}$/);
    expect(new Date(value).getTime()).toBe(now.getTime());
    expect(dateInputToLocalDateTime("2026-10-01", now)).toMatch(
      /^2026-10-01T14:23:05[+-]\d{2}:\d{2}$/,
    );
  });
  it("без даты — текущий момент", () => {
    const now = new Date(2026, 9, 8, 9, 0, 0);
    expect(new Date(dateInputToLocalDateTime("", now)).getTime()).toBe(now.getTime());
  });
});
