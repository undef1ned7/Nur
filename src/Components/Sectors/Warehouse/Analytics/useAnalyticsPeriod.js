import { useCallback, useState } from "react";
import { buildAnalyticsPeriodParams } from "./warehouseAnalyticsShared";

export const useAnalyticsPeriod = (initialPeriod = "month") => {
  const [period, setPeriod] = useState(initialPeriod);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const periodParams = useCallback(
    (extra = {}) =>
      buildAnalyticsPeriodParams({
        period,
        date,
        dateFrom,
        dateTo,
        extra,
      }),
    [period, date, dateFrom, dateTo],
  );

  return {
    period,
    setPeriod,
    date,
    setDate,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    periodParams,
  };
};
