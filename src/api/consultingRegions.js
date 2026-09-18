/**
 * Консалтинг: регионы и региональное распределение лидов.
 *
 * Контракт: docs/consulting/backend-money-tenant/12-regional-supervisor-rbac.md,
 * docs/consulting/backend-money-tenant/06-regional-funnels-routing.md.
 *
 * Пока эндпоинты отвечают 404/501 — UI прячет региональные элементы
 * (список регионов пустой), остальной интерфейс работает как раньше.
 */
import { BASE, cGet, cPost } from "./consultingHttp";
import { getRegionalFunnelRouting } from "./consultingLeads";

/**
 * Список регионов компании с воронками и счётчиками.
 * GET /consalting/regions/
 * @returns {Promise<Array<{
 *   code: string, label: string, funnel_id: string|null,
 *   is_active: boolean, open_leads?: number, employees_count?: number
 * }>>}
 */
export const listConsultingRegions = (config) =>
  cGet("List Consulting Regions Error", `${BASE}/regions/`, {}, config);

const asArr = (r) => (Array.isArray(r) ? r : r?.results || []);
const isNotReady = (e) => e?.status === 404 || e?.status === 501;

/**
 * Регионы с устойчивым фолбэком: если `GET /consalting/regions/` ещё не готов
 * (404/501) или отдал пусто — собираем список из воронок, у которых задан
 * `region_code` / `region`. Если и там пусто (регион денормализован не на
 * воронку, а только в правилах маршрутизации) — берём регионы из
 * `GET /consalting/regional-funnel-routing/` → `rules[]`. Так региональный
 * UI работает даже до появления отдельного эндпоинта регионов.
 */
export const resolveConsultingRegions = async (config) => {
  try {
    const arr = asArr(await listConsultingRegions(config));
    if (arr.length) return arr;
  } catch (e) {
    if (!isNotReady(e)) throw e;
  }
  try {
    const funnels = asArr(
      await cGet("List Funnels Error", `${BASE}/funnels/`, {}, config),
    );
    const byCode = new Map();
    for (const f of funnels) {
      const code = String(f?.region_code ?? f?.region ?? "")
        .trim()
        .toLowerCase();
      if (!code || byCode.has(code)) continue;
      byCode.set(code, {
        code,
        label: f.region_label || f.region_name || f.region || code,
        funnel_id: f.id != null ? String(f.id) : null,
        is_active: f.is_active !== false,
        open_leads: 0,
        employees_count: 0,
      });
    }
    if (byCode.size) return [...byCode.values()];
  } catch {
    // падаем дальше на фолбэк через правила маршрутизации
  }
  try {
    const routing = await getRegionalFunnelRouting(config);
    const rules = Array.isArray(routing?.rules) ? routing.rules : [];
    const byCode = new Map();
    for (const r of rules) {
      const code = String(r?.region_code || "").trim().toLowerCase();
      if (!code || byCode.has(code)) continue;
      byCode.set(code, {
        code,
        label: r.region_label || r.label || r.funnel_display || code,
        funnel_id: r.funnel_id != null ? String(r.funnel_id) : null,
        is_active: r.is_active !== false,
        open_leads: 0,
        employees_count: 0,
      });
    }
    return [...byCode.values()];
  } catch {
    return [];
  }
};

// Проверено на проде 10.09.2026: рабочий путь —
// `regional-funnel-routing/redistribute/` (dry_run → { planned, total }).
// `funnels/routing/redistribute/` оставлен запасным на случай будущего alias.
const REDISTRIBUTE_PATHS = [
  `${BASE}/regional-funnel-routing/redistribute/`,
  `${BASE}/funnels/routing/redistribute/`,
];

/**
 * Разовое выравнивание базы лидов по регионам.
 * POST <one of REDISTRIBUTE_PATHS>
 * @param {{
 *   scope?: "main_unassigned"|"all_open"|"inbound_new",
 *   regions?: string[],
 *   dry_run?: boolean
 * }} payload
 * @returns {Promise<{ planned: Record<string,number>, total?: number, moved?: number }>}
 */
export const redistributeRegionalLeads = async (payload = {}) => {
  const body = { scope: "main_unassigned", dry_run: false, ...payload };
  let lastErr;
  for (const url of REDISTRIBUTE_PATHS) {
    try {
      return await cPost("Redistribute Regional Leads Error", url, body);
    } catch (e) {
      lastErr = e;
      if (e?.status !== 404) throw e;
    }
  }
  throw lastErr;
};
