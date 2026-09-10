// recordaWorkHours.js — график работы для календаря записей
import api from "../../../../../api";
import { pad, minsOf } from "./RecordaUtils";

export const WORK_SCHEDULE_STORAGE_KEY = "barber_appointment_work_schedule";
export const DEFAULT_WORK_START = "09:00";
export const DEFAULT_WORK_END = "00:00";

/** 00:00 в конце графика = полночь (конец рабочего дня), не начало суток */
export const END_OF_DAY_MIN = 24 * 60;

export const DEFAULT_WORK_BOUNDS = {
  work_start: DEFAULT_WORK_START,
  work_end: DEFAULT_WORK_END,
  startMin: 9 * 60,
  endMin: END_OF_DAY_MIN,
};

export const workEndMinFromTimes = (workStart, workEnd) => {
  const startMin = minsOf(normalizeTimeHHMM(workStart, DEFAULT_WORK_START));
  const work_end = normalizeTimeHHMM(workEnd, DEFAULT_WORK_END);
  const endMinRaw = minsOf(work_end);

  // 00:00 = полночь того же календарного дня (конец смены)
  if (endMinRaw === 0 && startMin > 0) {
    return { work_end, endMin: END_OF_DAY_MIN };
  }

  // Конец после полуночи: 09:00 → 02:00 = слоты до 02:00 следующего утра
  if (endMinRaw > 0 && endMinRaw < startMin) {
    return { work_end, endMin: endMinRaw + END_OF_DAY_MIN };
  }

  if (endMinRaw === startMin) {
    return { work_end, endMin: startMin + 60 };
  }

  return { work_end, endMin: endMinRaw };
};

export const isOvernightBounds = (bounds) =>
  (bounds?.endMin ?? 0) > END_OF_DAY_MIN;

/** Минуты на шкале календаря (после полуночи сдвигаются на +24ч) */
export const clockMinFromDate = (date, bounds) => {
  let m = date.getHours() * 60 + date.getMinutes();
  if (isOvernightBounds(bounds) && m < bounds.startMin) {
    m += END_OF_DAY_MIN;
  }
  return m;
};

export const formatWorkSlotTime = (mins) => {
  if (mins === END_OF_DAY_MIN) return "24:00";
  if (mins > END_OF_DAY_MIN) {
    const next = mins - END_OF_DAY_MIN;
    return `${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
  }
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
};

export const minsToWorkEndLabel = (endMin) => {
  if (endMin === END_OF_DAY_MIN) return "00:00";
  if (endMin > END_OF_DAY_MIN) {
    const next = endMin - END_OF_DAY_MIN;
    return `${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
  }
  return `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
};

export const extractCompanyWorkSchedule = (company) => {
  if (!company) return { start: null, end: null };

  const nested =
    company.settings ||
    company.online_settings ||
    company.company_settings ||
    {};

  const pick = (...values) => {
    for (const value of values) {
      if (value != null && String(value).trim() !== "") return value;
    }
    return null;
  };

  return {
    start: pick(
      company.appointment_work_start,
      nested.appointment_work_start,
      company.work_start,
      nested.work_start,
    ),
    end: pick(
      company.appointment_work_end,
      nested.appointment_work_end,
      company.work_end,
      nested.work_end,
    ),
  };
};

export const normalizeTimeHHMM = (raw, fallback = DEFAULT_WORK_START) => {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${pad(h)}:${pad(mm)}`;
};

export const boundsFromTimes = (workStart, workEnd) => {
  const work_start = normalizeTimeHHMM(workStart, DEFAULT_WORK_START);
  const startMin = minsOf(work_start);
  const { work_end, endMin } = workEndMinFromTimes(work_start, workEnd);
  return { work_start, work_end, startMin, endMin };
};

export const readWorkScheduleSettings = (company) => {
  const { start: fromCompanyStart, end: fromCompanyEnd } =
    extractCompanyWorkSchedule(company);

  if (fromCompanyStart || fromCompanyEnd) {
    return boundsFromTimes(
      fromCompanyStart || DEFAULT_WORK_START,
      fromCompanyEnd || DEFAULT_WORK_END,
    );
  }

  try {
    const raw = localStorage.getItem(WORK_SCHEDULE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.work_start && parsed?.work_end) {
        return boundsFromTimes(parsed.work_start, parsed.work_end);
      }
    }
  } catch {
    /* ignore */
  }

  return { ...DEFAULT_WORK_BOUNDS };
};

export const writeWorkScheduleSettingsLocal = (schedule) => {
  try {
    localStorage.setItem(WORK_SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  } catch {
    /* ignore */
  }
  notifyWorkScheduleChanged();
};

export const notifyWorkScheduleChanged = () => {
  window.dispatchEvent(new CustomEvent("barber:work-schedule-changed"));
};

export const resolveWorkBoundsFromAvailability = (availability, barberId) => {
  if (!availability?.masters?.length) return null;

  if (barberId) {
    const master = availability.masters.find(
      (m) => String(m.master_id) === String(barberId),
    );
    if (master?.work_start && master?.work_end) {
      return boundsFromTimes(master.work_start, master.work_end);
    }
    return null;
  }

  let minStart = 24 * 60;
  let maxEnd = 0;
  let found = false;

  availability.masters.forEach((m) => {
    if (!m.work_start || !m.work_end) return;
    found = true;
    const bounds = boundsFromTimes(m.work_start, m.work_end);
    if (bounds.startMin < minStart) minStart = bounds.startMin;
    if (bounds.endMin > maxEnd) maxEnd = bounds.endMin;
  });

  if (!found) return null;

  return boundsFromTimes(
    `${pad(Math.floor(minStart / 60))}:${pad(minStart % 60)}`,
    minsToWorkEndLabel(maxEnd),
  );
};

export const resolveRecordaWorkBounds = ({
  availability,
  barberId,
  settingsBounds,
}) => {
  const base = settingsBounds || { ...DEFAULT_WORK_BOUNDS };
  const fromApi = resolveWorkBoundsFromAvailability(
    availability,
    barberId || null,
  );

  if (!fromApi) return base;

  // Настройки компании задают рамку календаря; API мастера может только расширить её
  const startMin = Math.min(base.startMin, fromApi.startMin);
  const endMin = Math.max(base.endMin, fromApi.endMin);

  if (startMin === base.startMin && endMin === base.endMin) {
    return base;
  }

  return boundsFromTimes(
    `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`,
    minsToWorkEndLabel(endMin),
  );
};

/** Расширить шкалу, если записи выходят за настроенный график */
export const expandBoundsToFitRecords = (bounds, records = []) => {
  if (!bounds || !records.length) return bounds;

  let startMin = bounds.startMin;
  let endMin = bounds.endMin;

  records.forEach((record) => {
    if (!record?.start_at) return;
    const start = new Date(record.start_at);
    const end = record.end_at ? new Date(record.end_at) : start;
    if (Number.isNaN(start.getTime())) return;

    const rs = clockMinFromDate(start, bounds);
    const re = Number.isNaN(end.getTime())
      ? rs + 30
      : clockMinFromDate(end, bounds);

    if (rs < startMin) startMin = rs;
    if (re > endMin) endMin = re;
  });

  if (startMin === bounds.startMin && endMin === bounds.endMin) {
    return bounds;
  }

  return boundsFromTimes(
    `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`,
    minsToWorkEndLabel(endMin),
  );
};

export const buildTimeSlotLabels = (startMin, endMin, slotMin = 30) => {
  const arr = [];
  for (let m = startMin; m <= endMin; m += slotMin) {
    arr.push(formatWorkSlotTime(m));
  }
  return arr;
};

const HALF_HOUR_MIN = 30;
const SUBDIVIDE_MIN = 10;

export const isHalfHourAligned = (min) => min % HALF_HOUR_MIN === 0;

/** Запись не укладывается в сетку 30 мин (:00 / :30 и кратная длительность) */
export const recordNeedsFineGrid = (startMin, endMin) => {
  let s = startMin;
  let e = endMin;
  if (e < s) e += END_OF_DAY_MIN;
  if (!isHalfHourAligned(s) || !isHalfHourAligned(e)) return true;
  return (e - s) % HALF_HOUR_MIN !== 0;
};

export const calendarMinMinute = (m) => {
  const dayMin =
    ((m % END_OF_DAY_MIN) + END_OF_DAY_MIN) % END_OF_DAY_MIN;
  return dayMin % 60;
};

const blockingStatuses = new Set([
  "booked",
  "confirmed",
  "completed",
  "no_show",
]);

const extractRecordRanges = (records, bounds) =>
  (records || [])
    .filter((r) => blockingStatuses.has(r.status))
    .map((r) => {
      const startMin = clockMinFromDate(new Date(r.start_at), bounds);
      let endMin = clockMinFromDate(new Date(r.end_at), bounds);
      if (endMin < startMin) endMin += END_OF_DAY_MIN;
      return { startMin, endMin };
    });

const blockNeedsSubdivision = (blockStart, blockEnd, ranges) =>
  ranges.some(({ startMin, endMin }) => {
    if (startMin >= blockEnd || endMin <= blockStart) return false;
    return recordNeedsFineGrid(startMin, endMin);
  });

const collectSubLabels = (blockStart, blockEnd, ranges) => {
  const labels = new Set([blockStart]);
  for (const { startMin, endMin } of ranges) {
    if (startMin >= blockEnd || endMin <= blockStart) continue;
    if (!recordNeedsFineGrid(startMin, endMin)) continue;

    for (const t of [startMin, endMin]) {
      if (t <= blockStart || t >= blockEnd) continue;
      if (isHalfHourAligned(t)) continue;
      if (t % SUBDIVIDE_MIN === 0) labels.add(t);
    }
  }
  return labels;
};

/** Перевод минут в px по построенным слотам (учитывает расширенные sub-блоки). */
export const buildMinuteToPxMapper = (slots, workBounds = {}) => {
  const origin = workBounds.startMin ?? 0;

  const minuteToPx = (min) => {
    if (!slots?.length) return 0;

    if (min <= slots[0].startMin) return slots[0].topPx;

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      const slotEnd = slot.startMin + slot.gridMin;
      if (min < slot.startMin) break;
      if (min >= slotEnd) continue;
      const frac = (min - slot.startMin) / slot.gridMin;
      return slot.topPx + frac * slot.heightPx;
    }

    const last = slots[slots.length - 1];
    return last.topPx + last.heightPx;
  };

  return {
    minuteToPx,
    rangePx: (fromMin, toMin) =>
      Math.max(1, minuteToPx(toMin) - minuteToPx(fromMin)),
    originPx: minuteToPx(origin),
  };
};

/**
 * Сетка календаря: шаг 30 мин, но блок делится на 10 мин,
 * если в нём есть запись не по получасовой сетке (напр. 10:00–10:20).
 * Возвращает fine-слоты для колонок и крупные блоки для gutter.
 */
export const buildAdaptiveCalendarGridSlots = (
  startMin,
  endMin,
  records = [],
  bounds = {},
  { slotMin = HALF_HOUR_MIN, subdivideMin = SUBDIVIDE_MIN, slotPx = 32 } = {},
) => {
  const pxPerMin = slotPx / slotMin;
  const ranges = extractRecordRanges(records, bounds);
  const slots = [];
  const gutterBlocks = [];
  let topPx = 0;

  for (let block = startMin; block < endMin; block += slotMin) {
    const blockEnd = Math.min(block + slotMin, endMin);
    const blockLen = blockEnd - block;
    const subdivide =
      blockLen === slotMin &&
      blockNeedsSubdivision(block, blockEnd, ranges);

    if (subdivide) {
      const labelMins = collectSubLabels(block, blockEnd, ranges);

      for (let m = block; m < blockEnd; m += subdivideMin) {
        const label = labelMins.has(m) ? formatWorkSlotTime(m) : null;
        gutterBlocks.push({
          startMin: m,
          blockMin: subdivideMin,
          heightPx: slotPx,
          isSubdivided: true,
          label,
          isMidHour:
            calendarMinMinute(m) === 20 || calendarMinMinute(m) === 50,
        });
        slots.push({
          startMin: m,
          gridMin: subdivideMin,
          heightPx: slotPx,
          topPx,
          label,
          isSubdivided: true,
          isMidHour:
            calendarMinMinute(m) === 20 || calendarMinMinute(m) === 50,
          gutterBlockStart: block,
        });
        topPx += slotPx;
      }
    } else {
      const heightPx = blockLen * pxPerMin;
      const label = formatWorkSlotTime(block);
      gutterBlocks.push({
        startMin: block,
        blockMin: blockLen,
        heightPx,
        isSubdivided: false,
        label,
      });
      slots.push({
        startMin: block,
        gridMin: blockLen,
        heightPx,
        topPx,
        label,
        isSubdivided: false,
        isMidHour: false,
        gutterBlockStart: block,
      });
      topPx += heightPx;
    }
  }

  return { slots, gutterBlocks, totalHeightPx: topPx };
};

/** @deprecated используйте buildAdaptiveCalendarGridSlots */
export const buildCalendarGridSlots = (startMin, endMin, gridMin = 10) => {
  const slots = [];
  for (let m = startMin; m < endMin; m += gridMin) {
    const mm = calendarMinMinute(m);
    slots.push({
      startMin: m,
      gridMin,
      heightPx: (32 / 30) * gridMin,
      topPx: 0,
      label: [0, 20, 30, 50].includes(mm) ? formatWorkSlotTime(m) : null,
      isMidHour: mm === 20 || mm === 50,
    });
  }
  return slots;
};

export async function fetchMastersAvailability(slug, date, barberId = null) {
  if (!slug || !date) return null;

  try {
    if (barberId) {
      const { data } = await api.get(
        `/barbershop/public/${slug}/masters/${barberId}/schedule/`,
        { params: { date, days: 1 } },
      );
      if (!data) return null;
      return {
        masters: [
          {
            master_id: data.master_id || barberId,
            work_start: data.work_start,
            work_end: data.work_end,
          },
        ],
      };
    }

    const { data } = await api.get(
      `/barbershop/public/${slug}/masters/availability/`,
      { params: { date } },
    );

    if (data?.masters && Array.isArray(data.masters)) return data;
    if (data) return { masters: [data] };
    return null;
  } catch {
    return null;
  }
}

export async function saveWorkScheduleSettings({ work_start, work_end }) {
  const schedule = {
    work_start: normalizeTimeHHMM(work_start, DEFAULT_WORK_START),
    work_end: normalizeTimeHHMM(work_end, DEFAULT_WORK_END),
  };

  writeWorkScheduleSettingsLocal(schedule);

  try {
    await api.patch("/users/settings/company/", {
      appointment_work_start: schedule.work_start,
      appointment_work_end: schedule.work_end,
    });
    notifyWorkScheduleChanged();
    return { savedToApi: true, schedule };
  } catch {
    return { savedToApi: false, schedule };
  }
}
