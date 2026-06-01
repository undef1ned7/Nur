import api from "../src/api";

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const isoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

/** Дней в интервале date_from…date_to включительно. */
export const clampCafeAnalyticsRangeDays = (fromStr, toStr, maxDays = 62) => {
  if (!fromStr || !toStr) return { ok: true, days: 0 };
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  const diff = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  return { ok: diff <= maxDays, days: diff };
};

export const buildCafeSalesBuckets = (fromStr, toStr) => {
  if (!fromStr || !toStr) return [];
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);

  const { ok } = clampCafeAnalyticsRangeDays(fromStr, toStr, 62);
  const step = ok ? 1 : 7;

  const buckets = [];
  let cur = new Date(from);

  while (cur.getTime() <= to.getTime()) {
    const start = new Date(cur);
    const end = addDays(cur, step - 1);
    const endClamped = end.getTime() > to.getTime() ? new Date(to) : end;

    buckets.push({
      key: step === 1 ? isoDate(start) : `${isoDate(start)}—${isoDate(endClamped)}`,
      date_from: isoDate(start),
      date_to: isoDate(endClamped),
    });

    cur = addDays(cur, step);
  }

  return buckets;
};

/** period для GET /cafe/analytics/sales/dynamics/ */
export const resolveCafeSalesDynamicsPeriod = (dateFrom, dateTo) => {
  const { days } = clampCafeAnalyticsRangeDays(dateFrom, dateTo, 62);
  if (days > 366) return "month";
  const { ok } = clampCafeAnalyticsRangeDays(dateFrom, dateTo, 62);
  return ok ? "day" : "week";
};

export const normalizeCafeSalesDynamicsSeries = (payload) => {
  const series = Array.isArray(payload?.series) ? payload.series : [];
  return series.map((point) => ({
    label: String(point?.label ?? point?.date_from ?? ""),
    value: toNum(point?.revenue),
  }));
};

async function fetchLegacySalesSummarySeries({ dateFrom, dateTo, branch }) {
  const buckets = buildCafeSalesBuckets(dateFrom, dateTo);
  if (!buckets.length) return [];

  const chunkSize = 8;
  const out = [];

  for (let i = 0; i < buckets.length; i += chunkSize) {
    const part = buckets.slice(i, i + chunkSize);
    // eslint-disable-next-line no-await-in-loop
    const resArr = await Promise.all(
      part.map((b) => {
        const params = { date_from: b.date_from, date_to: b.date_to };
        if (branch) params.branch = branch;
        return api
          .get("/cafe/analytics/sales/summary/", { params })
          .catch(() => ({ data: null }));
      }),
    );

    for (let j = 0; j < part.length; j += 1) {
      const b = part[j];
      out.push({
        label: b.key,
        value: toNum(resArr[j]?.data?.revenue),
      });
    }
  }

  return out;
}

/**
 * Один запрос для графика «Динамика продаж»; при 404 — legacy N× summary.
 */
export async function fetchCafeSalesDynamicsSeries({
  dateFrom,
  dateTo,
  branch,
  extraParams = {},
} = {}) {
  if (!dateFrom || !dateTo) return [];

  const period = resolveCafeSalesDynamicsPeriod(dateFrom, dateTo);
  const params = {
    date_from: dateFrom,
    date_to: dateTo,
    period,
    ...extraParams,
  };
  if (branch) params.branch = branch;

  try {
    const { data } = await api.get("/cafe/analytics/sales/dynamics/", { params });
    return normalizeCafeSalesDynamicsSeries(data);
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404 || status === 501) {
      return fetchLegacySalesSummarySeries({ dateFrom, dateTo, branch });
    }
    throw e;
  }
}
