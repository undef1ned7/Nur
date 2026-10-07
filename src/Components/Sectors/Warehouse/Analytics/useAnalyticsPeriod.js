import { useCallback, useState } from "react";
import {
  buildAnalyticsPeriodParams,
  monthAgoLocalISODate,
  toLocalISODate,
} from "./warehouseAnalyticsShared";

export const useAnalyticsPeriod = (initialPeriod = "month") => {
  const [period, setPeriod] = useState(initialPeriod);
  const [date, setDate] = useState(() => toLocalISODate());
  const [dateFrom, setDateFrom] = useState(() => monthAgoLocalISODate());
  const [dateTo, setDateTo] = useState(() => toLocalISODate());

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
