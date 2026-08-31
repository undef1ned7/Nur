// BarberAnalitikaData.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBarberAnalyticsDashboard } from "../../../../api/barberAnalytics";
import { formatDateForAPI } from "./BarberAnalitikaUtils";
import {
  emptyDashboardData,
  mapDashboardResponse,
} from "./mapDashboardResponse";
import { extractApiError } from "./extractApiError";

export const useBarberAnalitikaData = ({ year, monthIdx }) => {
  const dateFrom = useMemo(() => {
    const start = new Date(year, monthIdx, 1);
    return formatDateForAPI(start);
  }, [year, monthIdx]);

  const dateTo = useMemo(() => {
    const end = new Date(year, monthIdx + 1, 0);
    return formatDateForAPI(end);
  }, [year, monthIdx]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [dashboard, setDashboard] = useState(() => emptyDashboardData());

  const refetch = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setErrorMsg("");
      setAccessDenied(false);

      try {
        const data = await fetchBarberAnalyticsDashboard({
          dateFrom,
          dateTo,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setDashboard(mapDashboardResponse(data));
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Ошибка загрузки аналитики:", error);
        setDashboard(emptyDashboardData());

        const status = error?.response?.status;
        if (status === 403) {
          setAccessDenied(true);
          setErrorMsg("Нет доступа к аналитике");
        } else if (status === 404 || status === 501) {
          setErrorMsg(
            "Серверная аналитика ещё не подключена. Нужен эндпоинт GET /barbershop/analytics/dashboard/.",
          );
        } else if (status === 400) {
          setErrorMsg(extractApiError(error) || "Некорректный период.");
        } else {
          setErrorMsg("Не удалось загрузить аналитику.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [dateFrom, dateTo, refreshToken]);

  return {
    loading,
    errorMsg,
    accessDenied,
    refetch,
    ...dashboard,
    loadingCash: loading,
    loadingProducts: loading,
  };
};
