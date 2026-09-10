import { describe, expect, it } from "vitest";
import {
  boundsFromTimes,
  buildTimeSlotLabels,
  buildAdaptiveCalendarGridSlots,
  buildMinuteToPxMapper,
  recordNeedsFineGrid,
  DEFAULT_WORK_BOUNDS,
  END_OF_DAY_MIN,
  resolveRecordaWorkBounds,
} from "../src/Components/Sectors/Barber/Recorda/components/recordaWorkHours.js";

describe("recordaWorkHours", () => {
  it("treats 00:00 as end of day when start is earlier", () => {
    const bounds = boundsFromTimes("09:00", "00:00");
    expect(bounds.startMin).toBe(9 * 60);
    expect(bounds.endMin).toBe(END_OF_DAY_MIN);
    expect(bounds.work_end).toBe("00:00");

    const slots = buildTimeSlotLabels(bounds.startMin, bounds.endMin, 30);
    expect(slots[0]).toBe("09:00");
    expect(slots[slots.length - 1]).toBe("24:00");
    expect(slots.length).toBe((END_OF_DAY_MIN - 9 * 60) / 30 + 1);
  });

  it("uses 30-min grid by default without short records", () => {
    const bounds = boundsFromTimes("10:00", "12:00");
    const { slots, gutterBlocks, totalHeightPx } = buildAdaptiveCalendarGridSlots(
      bounds.startMin,
      bounds.endMin,
      [],
      bounds,
    );
    const labels = gutterBlocks.map((b) => b.label);
    expect(labels).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    expect(slots.every((s) => s.gridMin === 30)).toBe(true);
    expect(gutterBlocks.every((b) => b.heightPx === 32)).toBe(true);
    expect(totalHeightPx).toBe(4 * 32);
  });

  it("subdivides only the block with a 10:00–10:20 record", () => {
    const bounds = boundsFromTimes("10:00", "11:00");
    const records = [
      {
        status: "completed",
        start_at: "2026-09-02T10:00:00",
        end_at: "2026-09-02T10:20:00",
      },
    ];
    const { slots, gutterBlocks, totalHeightPx } = buildAdaptiveCalendarGridSlots(
      bounds.startMin,
      bounds.endMin,
      records,
      bounds,
    );
    expect(gutterBlocks).toHaveLength(4);
    expect(gutterBlocks.slice(0, 3).every((b) => b.heightPx === 32)).toBe(true);
    expect(gutterBlocks[0].label).toBe("10:00");
    expect(gutterBlocks[2].label).toBe("10:20");
    expect(gutterBlocks[3].label).toBe("10:30");
    expect(slots.filter((s) => s.isSubdivided)).toHaveLength(3);
    expect(totalHeightPx).toBe(3 * 32 + 32);
  });

  it("maps minutes to px with expanded sub-slots", () => {
    const bounds = boundsFromTimes("10:00", "11:00");
    const records = [
      {
        status: "completed",
        start_at: "2026-09-02T10:10:00",
        end_at: "2026-09-02T10:20:00",
      },
    ];
    const { slots } = buildAdaptiveCalendarGridSlots(
      bounds.startMin,
      bounds.endMin,
      records,
      bounds,
    );
    const map = buildMinuteToPxMapper(slots, bounds);
    expect(map.minuteToPx(10 * 60)).toBe(0);
    expect(map.minuteToPx(10 * 60 + 10)).toBe(32);
    expect(map.minuteToPx(10 * 60 + 20)).toBe(64);
    expect(map.rangePx(10 * 60 + 10, 10 * 60 + 20)).toBe(32);
  });

  it("detects non-half-hour records", () => {
    expect(recordNeedsFineGrid(10 * 60, 10 * 60 + 20)).toBe(true);
    expect(recordNeedsFineGrid(10 * 60, 10 * 60 + 30)).toBe(false);
    expect(recordNeedsFineGrid(10 * 60, 11 * 60)).toBe(false);
    expect(recordNeedsFineGrid(10 * 60 + 15, 10 * 60 + 45)).toBe(true);
  });

  it("defaults to full day until midnight", () => {
    expect(DEFAULT_WORK_BOUNDS.endMin).toBe(END_OF_DAY_MIN);
    expect(DEFAULT_WORK_BOUNDS.work_end).toBe("00:00");
  });

  it("keeps normal same-day range", () => {
    const bounds = boundsFromTimes("09:00", "21:00");
    expect(bounds.endMin).toBe(21 * 60);
  });

  it("treats end before start as next morning (09:00 → 02:00)", () => {
    const bounds = boundsFromTimes("09:00", "02:00");
    expect(bounds.startMin).toBe(9 * 60);
    expect(bounds.endMin).toBe(2 * 60 + END_OF_DAY_MIN);
    expect(bounds.work_end).toBe("02:00");

    const slots = buildTimeSlotLabels(bounds.startMin, bounds.endMin, 30);
    expect(slots[0]).toBe("09:00");
    expect(slots).toContain("24:00");
    expect(slots).toContain("00:30");
    expect(slots[slots.length - 1]).toBe("02:00");
  });

  it("does not shrink calendar when master API has shorter day", () => {
    const settings = boundsFromTimes("09:00", "00:00");
    const resolved = resolveRecordaWorkBounds({
      settingsBounds: settings,
      barberId: "1",
      availability: {
        masters: [{ master_id: "1", work_start: "09:00", work_end: "00:00" }],
      },
    });
    expect(resolved.endMin).toBe(END_OF_DAY_MIN);
  });
});
