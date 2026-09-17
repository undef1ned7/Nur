import {
  getFunnelOwnerUserId,
  isMainFunnel,
  isProtectedFunnel,
  isRoleFunnel,
} from "./consultingFunnelDefaults";

/** Роль «Руководитель региона» — см. docs/consulting/backend-money-tenant/12-regional-supervisor-rbac.md */
export const CONSULTING_SUPERVISOR_ROLE = "supervisor";

/** Владелец / админ — полный доступ ко всем лидам, воронкам и настройкам. */
export function isConsultingFunnelManager(profile) {
  const role = String(profile?.role || "").toLowerCase();
  return (
    role === "owner" ||
    role === "admin" ||
    role === "rop"
  );
}

/** Руководитель региона: видит только свои регионы, внутри — все лиды. */
export function isConsultingRegionalSupervisor(profile) {
  return (
    String(profile?.role || "").toLowerCase() === CONSULTING_SUPERVISOR_ROLE
  );
}

/** Коды регионов пользователя (нормализованные, lower-case). */
export function getUserRegionCodes(profile) {
  const raw = profile?.consulting_region_codes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => String(c || "").trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Код региона воронки (region_code / region).
 *
 * Бэкенд пока не проставляет `region_code` на самой сущности `Funnel`
 * (проверено на проде 11.09.2026 — см.
 * docs/consulting/backend-money-tenant/15-regional-routing-integration.md §0):
 * у региональных воронок вроде «Бишкек»/«Ош» это поле приходит пустым, хотя у
 * лидов внутри `region_code` заполнен верно. Поэтому принимаем опциональный
 * `fallbackMap` (funnel_id → region_code), собранный на фронте из
 * `GET /consalting/regional-funnel-routing/` (см. `useConsultingRegions`), и
 * используем его, когда прямого поля нет.
 */
export function resolveFunnelRegionCode(funnel, fallbackMap) {
  const raw = funnel?.region_code ?? funnel?.region ?? null;
  if (raw != null && raw !== "") return String(raw).trim().toLowerCase();
  const fromFallback = fallbackMap?.get?.(String(funnel?.id));
  return fromFallback ? String(fromFallback).trim().toLowerCase() : null;
}

/** Регион в зоне ответственности пользователя. Manager — любой регион. */
export function isRegionInUserScope(profile, regionCode) {
  if (isConsultingFunnelManager(profile)) return true;
  const codes = getUserRegionCodes(profile);
  if (!codes.length) return false;
  return codes.includes(String(regionCode || "").trim().toLowerCase());
}

/**
 * Режим «только свои» лиды/сделки (роль «Продавец/Менеджер» без расширенных прав).
 * Явный флаг `can_view_all_funnel_leads` снимает изоляцию без смены role.
 */
export function shouldIsolateConsultingByOwner(profile) {
  if (!profile || !canViewConsultingFunnel(profile)) return false;
  if (isConsultingFunnelManager(profile)) return false;
  // Руководитель региона видит ВСЕ лиды своего региона, не только свои.
  if (isConsultingRegionalSupervisor(profile)) return false;
  const role = String(profile?.role || "").toLowerCase();
  if (role === "salesperson") return true;
  if (isPermissionEnabled(profile.can_view_all_funnel_leads)) return false;
  return true;
}

/** @deprecated alias */
export function isConsultingSalesRep(profile) {
  return shouldIsolateConsultingByOwner(profile);
}

/** Общий inbox «Лиды» (все входящие, распределение, интеграция) — только руководство. */
export function canAccessConsultingLeadInbox(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  // Руководитель региона видит inbox своего региона.
  if (isConsultingRegionalSupervisor(profile)) return true;
  if (isPermissionEnabled(profile.can_view_leads_inbox)) return true;
  return false;
}

/** Настройки распределения / региональные правила / Wazzup — только owner/admin/rop. */
export function canAccessConsultingLeadSettings(profile) {
  return isConsultingFunnelManager(profile);
}

/**
 * Рекламный отчёт по лидам (кнопка «Финансы» на странице «Лиды»): ведение
 * расходов на рекламу — показы, лиды, сумма затрат, стоимость лида.
 * Доступ: owner/admin/rop либо сотрудник с правом `can_manage_lead_ad_spend`.
 * Контракт бэкенда: docs/consulting/backend/08-lead-ad-spend.md
 */
export function canManageConsultingLeadFinance(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  return isPermissionEnabled(profile.can_manage_lead_ad_spend);
}

/** Разовое выравнивание базы лидов по регионам (redistribute) — только руководство. */
export function canRedistributeRegionalLeads(profile) {
  return isConsultingFunnelManager(profile);
}

/** Заведение сотрудников: owner/admin/rop или руководитель региона (в свой регион). */
export function canManageConsultingEmployees(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  if (isConsultingRegionalSupervisor(profile)) return true;
  return isPermissionEnabled(profile.can_view_employees);
}

/** Может ли создавать сотрудников с ролью выше «продавца» / расширенными правами. */
export function canCreateElevatedEmployees(profile) {
  return isConsultingFunnelManager(profile);
}

/** Идентификаторы текущего пользователя (id / user / employee) — строками. */
export function resolveProfileUserIds(profile) {
  return [
    profile?.id,
    profile?.user_id,
    profile?.user,
    profile?.employee_id,
    profile?.employee,
  ]
    .filter((v) => v != null && v !== "")
    .map(String);
}

/**
 * Создание собственных воронок. Owner/admin/rop — всегда; руководитель
 * региона — всегда, в свою региональную воронку (бэкенд сам подставляет
 * `parent_funnel`, см. docs/consulting/backend-money-tenant/17-employee-region-subfunnels.md
 * §17.3/§17.4.3 — это не зависит от чекбокса `can_create_funnel`, тот флаг
 * только для обычных сотрудников); обычный сотрудник — по праву
 * `can_create_funnel`.
 */
export function canCreateConsultingFunnel(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  if (isConsultingRegionalSupervisor(profile)) return true;
  return isPermissionEnabled(profile.can_create_funnel);
}

/** Список всех продаж компании; без права — только свои (`user=` на API). */
export function canViewAllConsultingSales(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  // Руководитель региона видит продажи своего региона (скоуп — на бэке).
  if (isConsultingRegionalSupervisor(profile)) return true;
  if (isPermissionEnabled(profile.can_view_all_sales)) return true;
  return false;
}

/** Ограничить список воронок: только ролевая + явные grants (без auto-main). */
export function shouldRestrictConsultingFunnelVisibility(profile) {
  return shouldIsolateConsultingByOwner(profile);
}

/** Просмотр страницы воронки (с обратной совместимостью по can_view_sale). */
export function canViewConsultingFunnel(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  if (isConsultingRegionalSupervisor(profile)) return true;
  if (profile.can_view_funnel === true) return true;
  return profile.can_view_sale === true;
}

/** Нормализация id кастомной роли (строка / uuid / вложенный объект). */
export function resolveCustomRoleId(entity) {
  if (!entity) return null;
  const raw = entity.custom_role ?? entity.custom_role_id;
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") {
    const id = raw.id ?? raw.uuid ?? raw.pk;
    return id != null ? String(id) : null;
  }
  return String(raw);
}

/** Булево поле с API (true / "true" / 1). */
export function isPermissionEnabled(value) {
  return value === true || value === "true" || value === 1;
}

/** Нормализация grants с API сотрудника. */
export function normalizeFunnelGrants(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => ({
      funnel_id: String(g.funnel_id || g.funnel || ""),
      can_manage_leads: isPermissionEnabled(g.can_manage_leads),
      can_manage_stages: isPermissionEnabled(g.can_manage_stages),
    }))
    .filter((g) => g.funnel_id);
}

export function getFunnelGrantMaps(profile) {
  const viewIds = new Set();
  const manageIds = new Set();
  const stageIds = new Set();
  normalizeFunnelGrants(profile?.funnel_grants).forEach((g) => {
    viewIds.add(g.funnel_id);
    if (g.can_manage_leads) manageIds.add(g.funnel_id);
    if (g.can_manage_stages) stageIds.add(g.funnel_id);
  });
  return { viewIds, manageIds, stageIds };
}

/** Воронка роли сотрудника (если есть custom_role). */
export function getEmployeeRoleFunnelId(profile, funnels) {
  const roleId = resolveCustomRoleId(profile);
  if (!roleId) return null;
  const match = (funnels || []).find(
    (f) => resolveCustomRoleId(f) === roleId || String(f.custom_role) === roleId,
  );
  return match?.id || null;
}

/**
 * Воронки, видимые текущему пользователю.
 * @param {Array} funnels
 * @param {Object} profile
 * @param {Map<string,string>} [funnelRegionFallback] — funnel_id → region_code,
 *   см. `resolveFunnelRegionCode`. Нужен, пока бэкенд не отдаёт `region_code`
 *   на самой воронке (только у лидов внутри неё).
 */
export function filterFunnelsForUser(funnels, profile, funnelRegionFallback) {
  const list = Array.isArray(funnels) ? funnels : [];
  if (!canViewConsultingFunnel(profile)) return [];
  if (isConsultingFunnelManager(profile)) return list;

  // Руководитель региона: воронки своих регионов + явные grants.
  if (isConsultingRegionalSupervisor(profile)) {
    const codes = new Set(getUserRegionCodes(profile));
    const grantIds = getFunnelGrantMaps(profile).viewIds;
    return list.filter((f) => {
      const rc = resolveFunnelRegionCode(f, funnelRegionFallback);
      if (rc && codes.has(rc)) return true;
      return grantIds.has(String(f.id));
    });
  }

  const allowed = new Set();
  const customRole = resolveCustomRoleId(profile);
  const restrictFunnels = shouldRestrictConsultingFunnelVisibility(profile);
  const selfIds = new Set(resolveProfileUserIds(profile));

  list.forEach((f) => {
    if (customRole && resolveCustomRoleId(f) === customRole) allowed.add(f.id);
    // Главная воронка для inbound — только если нет режима изоляции продавца
    // (региональные менеджеры видят только свою воронку из grants / роли).
    if (!restrictFunnels && !customRole && isMainFunnel(f)) allowed.add(f.id);
    if (!restrictFunnels && customRole && isMainFunnel(f)) allowed.add(f.id);
    // Подворонка, созданная самим сотрудником, — всегда видна её автору.
    const ownerUserId = getFunnelOwnerUserId(f);
    if (ownerUserId && selfIds.has(ownerUserId)) allowed.add(f.id);
  });

  getFunnelGrantMaps(profile).viewIds.forEach((id) => allowed.add(String(id)));

  return list.filter((f) => allowed.has(String(f.id)));
}

/**
 * Управление лидами в конкретной воронке.
 * @param {Map<string,string>} [funnelRegionFallback] см. `filterFunnelsForUser`.
 */
export function canManageLeadsInFunnel(profile, funnel, funnelRegionFallback) {
  if (!profile || !funnel) return false;
  if (isConsultingFunnelManager(profile)) return true;

  // Руководитель региона управляет лидами воронок своего региона.
  if (isConsultingRegionalSupervisor(profile)) {
    const rc = resolveFunnelRegionCode(funnel, funnelRegionFallback);
    if (rc && getUserRegionCodes(profile).includes(rc)) return true;
  }

  const funnelId = String(funnel.id);
  const { manageIds } = getFunnelGrantMaps(profile);
  if (manageIds.has(funnelId)) return true;

  if (!isPermissionEnabled(profile.can_manage_funnel_leads)) return false;

  const userRoleId = resolveCustomRoleId(profile);
  const funnelRoleId = resolveCustomRoleId(funnel);
  if (userRoleId && funnelRoleId && userRoleId === funnelRoleId) return true;

  return false;
}

/** @deprecated используйте canManageLeadsInFunnel(profile, funnel) */
export function canManageConsultingFunnelLeads(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
  return isPermissionEnabled(profile.can_manage_funnel_leads);
}

/** Создание, изменение и удаление несистемных стадий в конкретной воронке. */
export function canManageStagesInFunnel(profile, funnel) {
  if (!profile || !funnel) return false;
  if (isConsultingFunnelManager(profile)) return true;

  const funnelId = String(funnel.id);
  const { stageIds } = getFunnelGrantMaps(profile);
  if (stageIds.has(funnelId)) return true;

  if (!isPermissionEnabled(profile.can_manage_funnel_stages)) return false;

  const userRoleId = resolveCustomRoleId(profile);
  const funnelRoleId = resolveCustomRoleId(funnel);
  if (userRoleId && funnelRoleId && userRoleId === funnelRoleId) return true;

  return false;
}

/** Владелец/админ может менять метаданные только пользовательских воронок. */
export function canEditFunnelMeta(profile, funnel) {
  if (!isConsultingFunnelManager(profile)) return false;
  return !isProtectedFunnel(funnel);
}

/**
 * Основную/системную воронку не может удалить никто — на неё завязана вся
 * маршрутизация входящих (см. docs/consulting/backend-money-tenant/06-regional-funnels-routing.md).
 * Ролевые воронки раньше входили сюда же (`isProtectedFunnel`), но теперь
 * удаляемы владельцем/админом — см. `canDeleteFunnel` и
 * docs/consulting/backend-money-tenant/21-funnel-delete.md §7.
 */
function isUndeletableFunnel(funnel) {
  if (!funnel) return false;
  if (funnel.is_static === true) return true;
  return isMainFunnel(funnel);
}

/**
 * Удаление воронки:
 * - owner/admin/rop — любую, кроме основной/системной (включая ролевые —
 *   см. docs/consulting/backend-money-tenant/21-funnel-delete.md §7. У этой
 *   воронки на ней держится доступ сотрудников с этой ролью — фронт
 *   показывает предупреждение перед удалением, см. Funnel.jsx `onDeleteFunnel`);
 * - сотрудник — только СВОЮ подворонку (owner_user === он сам), не ролевую
 *   и не основную.
 * Открытых лидов внутри фронт не проверяет — это делает бэкенд (`409`),
 * см. docs/consulting/backend-money-tenant/17-employee-region-subfunnels.md §17.7.
 */
export function canDeleteFunnel(profile, funnel) {
  if (!profile || !funnel || isUndeletableFunnel(funnel)) return false;
  if (isConsultingFunnelManager(profile)) return true;
  if (isRoleFunnel(funnel)) return false;
  const ownerUserId = getFunnelOwnerUserId(funnel);
  if (!ownerUserId) return false;
  return resolveProfileUserIds(profile).includes(String(ownerUserId));
}

/**
 * Настройки поведения воронки — цепочка «что дальше», признак финальной, SLA —
 * доступны владельцу/админу у ЛЮБОЙ воронки, включая основную и ролевые.
 * Защита статичных воронок закрывает переименование и удаление, а не
 * маршрутизацию лидов: иначе цепочку обработки негде настроить, ведь в
 * консалтинге почти все воронки либо основная, либо ролевые.
 */
export function canEditFunnelSettings(profile) {
  return isConsultingFunnelManager(profile);
}

/** Список воронок для выдачи доп. доступа (исключая воронку роли сотрудника). */
export function funnelsForGrantPicker(funnels, employee) {
  const roleId = resolveCustomRoleId(employee);
  return (funnels || []).filter(
    (f) => !roleId || resolveCustomRoleId(f) !== roleId,
  );
}

export function isGrantChecked(grants, funnelId) {
  const id = String(funnelId);
  return normalizeFunnelGrants(grants).some((g) => g.funnel_id === id);
}

export function isGrantManageChecked(grants, funnelId) {
  const id = String(funnelId);
  return normalizeFunnelGrants(grants).some(
    (g) => g.funnel_id === id && g.can_manage_leads,
  );
}

export function isGrantStagesChecked(grants, funnelId) {
  const id = String(funnelId);
  return normalizeFunnelGrants(grants).some(
    (g) => g.funnel_id === id && g.can_manage_stages,
  );
}

const emptyGrant = (funnelId) => ({
  funnel_id: String(funnelId),
  can_manage_leads: false,
  can_manage_stages: false,
});

export function toggleFunnelGrant(grants, funnelId, field, value) {
  const id = String(funnelId);
  const list = normalizeFunnelGrants(grants);
  const idx = list.findIndex((g) => g.funnel_id === id);

  if (field === "view") {
    if (!value) {
      return list.filter((g) => g.funnel_id !== id);
    }
    if (idx === -1) return [...list, emptyGrant(id)];
    return list;
  }

  if (field === "manage") {
    if (!value) {
      if (idx === -1) return list;
      const next = [...list];
      next[idx] = { ...next[idx], can_manage_leads: false };
      return next;
    }
    if (idx === -1) {
      return [...list, { ...emptyGrant(id), can_manage_leads: true }];
    }
    const next = [...list];
    next[idx] = { ...next[idx], can_manage_leads: true };
    return next;
  }

  if (field === "manage_stages") {
    if (!value) {
      if (idx === -1) return list;
      const next = [...list];
      next[idx] = { ...next[idx], can_manage_stages: false };
      return next;
    }
    if (idx === -1) {
      return [...list, { ...emptyGrant(id), can_manage_stages: true }];
    }
    const next = [...list];
    next[idx] = { ...next[idx], can_manage_stages: true };
    return next;
  }

  return list;
}
