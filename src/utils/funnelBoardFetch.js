import api from "../api";

const BOARD_BASE = "/consalting/funnels";

/** Нормализация ответа bulk-эндпоинта в map funnelId → board. */
export function normalizeBoardsMap(data) {
  if (!data || typeof data !== "object") return {};

  if (
    data.boards &&
    typeof data.boards === "object" &&
    !Array.isArray(data.boards)
  ) {
    return Object.fromEntries(
      Object.entries(data.boards).map(([key, board]) => [
        String(board?.funnel?.id ?? key),
        board,
      ]),
    );
  }

  const list = Array.isArray(data)
    ? data
    : data.results || (Array.isArray(data.boards) ? data.boards : []);

  if (!Array.isArray(list)) return {};

  const map = {};
  for (const item of list) {
    const funnelId = String(
      item.funnel_id ?? item.funnel?.id ?? item.id ?? "",
    );
    if (!funnelId) continue;

    const board =
      item.columns != null || item.unassigned != null ? item : item.board;
    if (board) map[funnelId] = board;
  }
  return map;
}

async function fetchBoardsPerFunnel(ids) {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const { data } = await api.get(`${BOARD_BASE}/${id}/board/`);
      return [String(id), data];
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Все канбан-доски доступных воронок одним запросом.
 * Fallback при 404/501: отдельный GET .../funnels/{id}/board/ на каждую воронку.
 *
 * @param {{ funnelIds?: string[] }} options — опционально ограничить набор id (с фронта)
 */
export async function fetchAccessibleFunnelBoards({ funnelIds = [] } = {}) {
  const ids = funnelIds.map(String).filter(Boolean);

  const pickForIds = (map) => {
    if (!ids.length) return map;
    const allowed = new Set(ids);
    const picked = Object.fromEntries(
      Object.entries(map).filter(([id]) => allowed.has(String(id))),
    );
    return picked;
  };

  const fillMissing = async (map) => {
    if (!ids.length) return map;
    const missing = ids.filter((id) => !map[String(id)]);
    if (!missing.length) return map;
    const extra = await fetchBoardsPerFunnel(missing);
    return { ...map, ...extra };
  };

  try {
    const { data } = await api.get(`${BOARD_BASE}/boards/`);
    const map = pickForIds(normalizeBoardsMap(data));
    // bulk ответ пустой или ключи не совпали — догружаем по одной
    if (ids.length && !ids.some((id) => map[String(id)])) {
      return fetchBoardsPerFunnel(ids);
    }
    return fillMissing(map);
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404 && status !== 501) throw e;
  }

  if (!ids.length) return {};
  return fetchBoardsPerFunnel(ids);
}

/** Одна доска воронки (после локальных изменений). */
export async function fetchFunnelBoard(funnelId) {
  const id = String(funnelId);
  const { data } = await api.get(`${BOARD_BASE}/${id}/board/`);
  return data;
}
