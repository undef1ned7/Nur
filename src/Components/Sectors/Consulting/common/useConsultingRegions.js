/**
 * Консалтинг: справочник регионов + разрешение регионального скоупа
 * пользователя (owner/admin/rop — все регионы, supervisor — только свои).
 *
 * Список тянется один раз и кешируется на уровне модуля: он маленький и
 * почти не меняется, а нужен сразу на нескольких экранах (Лиды, Воронка,
 * Аналитика, Сотрудники). Если эндпоинт ещё не готов (404/501) — регионы
 * остаются пустыми, региональные элементы UI просто не показываются.
 */
import { useEffect, useMemo, useState } from "react";
import { resolveConsultingRegions } from "../../../../api/consultingRegions";
import {
  getUserRegionCodes,
  isConsultingFunnelManager,
  isConsultingRegionalSupervisor,
} from "../../../../utils/consultingFunnelAccess";
import { isNotReadyError } from "./useConsultingList";

let cache = null; // Array | null
let inflight = null; // Promise | null
const subscribers = new Set();

function normalize(list) {
  return (Array.isArray(list) ? list : list?.results || [])
    .map((r) => ({
      code: String(r.code || r.region_code || "").trim().toLowerCase(),
      label: r.label || r.region_label || r.name || r.code || "—",
      funnel_id: r.funnel_id != null ? String(r.funnel_id) : null,
      is_active: r.is_active !== false,
      open_leads: Number(r.open_leads) || 0,
      employees_count: Number(r.employees_count) || 0,
    }))
    .filter((r) => r.code);
}

function loadRegions(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = resolveConsultingRegions()
    .then((res) => {
      cache = normalize(res);
      subscribers.forEach((fn) => fn(cache));
      return cache;
    })
    .catch((e) => {
      if (!isNotReadyError(e)) console.warn("Regions load error:", e);
      cache = [];
      subscribers.forEach((fn) => fn(cache));
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Сбросить кеш регионов (после redistribute / смены настроек). */
export function invalidateConsultingRegions() {
  cache = null;
  loadRegions(true);
}

export default function useConsultingRegions(profile) {
  const [regions, setRegions] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    const onUpdate = (list) => {
      if (alive) {
        setRegions(list);
        setLoading(false);
      }
    };
    subscribers.add(onUpdate);
    if (cache) {
      onUpdate(cache);
    } else {
      loadRegions();
    }
    return () => {
      alive = false;
      subscribers.delete(onUpdate);
    };
  }, []);

  const isManager = isConsultingFunnelManager(profile);
  const isSupervisor = isConsultingRegionalSupervisor(profile);
  const myCodes = useMemo(() => getUserRegionCodes(profile), [profile]);

  // Регионы, доступные пользователю для выбора.
  const scopedRegions = useMemo(() => {
    if (isManager) return regions;
    if (isSupervisor) {
      const set = new Set(myCodes);
      return regions.filter((r) => set.has(r.code));
    }
    return [];
  }, [regions, isManager, isSupervisor, myCodes]);

  return {
    regions,
    scopedRegions,
    loading,
    isManager,
    isSupervisor,
    // supervisor c одним регионом — фильтр фиксирован (UI можно скрыть)
    fixedRegionCode:
      isSupervisor && scopedRegions.length === 1 ? scopedRegions[0].code : null,
    // manager может смотреть «все»; supervisor — нет
    allowAllRegions: isManager,
    regionLabel: (code) =>
      regions.find((r) => r.code === String(code || "").toLowerCase())?.label ||
      code ||
      "—",
    reload: () => loadRegions(true),
  };
}
