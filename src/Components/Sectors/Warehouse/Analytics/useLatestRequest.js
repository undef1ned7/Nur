import { useCallback, useRef } from "react";

/**
 * Защита от гонки ответов: при быстрой смене периода/филиала медленный
 * устаревший ответ не должен перетирать данные свежего запроса.
 *
 *   const token = begin();
 *   const result = await api(...);
 *   if (!isLatest(token)) return; // пришёл ответ на уже неактуальный запрос
 */
export const useLatestRequest = () => {
  const seqRef = useRef(0);
  const begin = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);
  const isLatest = useCallback((token) => token === seqRef.current, []);
  return { begin, isLatest };
};
