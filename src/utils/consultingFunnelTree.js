/**
 * Дерево воронок консалтинга: региональные (и прочие корневые) воронки верхнего
 * уровня + подворонки сотрудников, привязанные к ним через `parent_funnel`.
 *
 * Верхний ряд вкладок на `/crm/consulting/funnel` строится из `roots`, а при
 * выборе региональной воронки под ним показывается ряд подворонок из
 * `childrenByParent`.
 *
 * ТЗ и контракт бэкенда:
 * docs/consulting/backend-money-tenant/17-employee-region-subfunnels.md
 */
import { getFunnelParentId } from "./consultingFunnelDefaults";

function compareChildFunnels(a, b) {
  const ca = a?.created_at || a?.created || "";
  const cb = b?.created_at || b?.created || "";
  if (ca && cb && ca !== cb) return ca < cb ? -1 : 1;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "ru");
}

/**
 * @param {Array} funnels — плоский список видимых воронок
 * @returns {{ byId: Map, roots: Array, childrenByParent: Map<string, Array> }}
 */
export function buildFunnelTree(funnels = []) {
  const list = Array.isArray(funnels) ? funnels : [];
  const byId = new Map(list.map((f) => [String(f.id), f]));
  const childrenByParent = new Map();
  const roots = [];

  list.forEach((f) => {
    const pid = getFunnelParentId(f);
    if (pid && byId.has(pid)) {
      const key = String(pid);
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(f);
    } else {
      // Родитель не виден (нет доступа / удалён) — показываем воронку как корневую.
      roots.push(f);
    }
  });

  childrenByParent.forEach((arr) => arr.sort(compareChildFunnels));

  return { byId, roots, childrenByParent };
}

/** Поднимается по `parent_funnel` до корневой (региональной) воронки. */
export function resolveTopFunnel(funnel, byId) {
  let cur = funnel;
  let guard = 0;
  while (cur && guard < 12) {
    const pid = getFunnelParentId(cur);
    if (pid && byId && byId.has(pid)) {
      cur = byId.get(pid);
      guard += 1;
    } else {
      break;
    }
  }
  return cur || funnel || null;
}

/** Подворонки конкретной родительской воронки (пустой массив, если их нет). */
export function getFunnelChildren(childrenByParent, parentId) {
  if (!childrenByParent) return [];
  return childrenByParent.get(String(parentId)) || [];
}

/** Суммарное число лидов по подворонкам (для бейджа на вкладке региона). */
export function sumChildLeadCounts(children, boardsMap) {
  return (children || []).reduce((sum, f) => {
    const c = boardsMap?.[f.id]?.funnel?.leads_count;
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}
