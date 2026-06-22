import {
  isMainFunnel,
  isProtectedFunnel,
  isRoleFunnel,
} from "./consultingFunnelDefaults";

/** Владелец / админ. */
export function isConsultingFunnelManager(profile) {
  const role = String(profile?.role || "").toLowerCase();
  return role === "owner" || role === "admin";
}

/** Просмотр страницы воронки (с обратной совместимостью по can_view_sale). */
export function canViewConsultingFunnel(profile) {
  if (!profile) return false;
  if (isConsultingFunnelManager(profile)) return true;
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

/** Воронки, видимые текущему пользователю. */
export function filterFunnelsForUser(funnels, profile) {
  const list = Array.isArray(funnels) ? funnels : [];
  if (!canViewConsultingFunnel(profile)) return [];
  if (isConsultingFunnelManager(profile)) return list;

  const allowed = new Set();
  const customRole = resolveCustomRoleId(profile);

  list.forEach((f) => {
    if (customRole && resolveCustomRoleId(f) === customRole) allowed.add(f.id);
    if (!customRole && isMainFunnel(f)) allowed.add(f.id);
  });

  getFunnelGrantMaps(profile).viewIds.forEach((id) => allowed.add(String(id)));

  return list.filter((f) => allowed.has(String(f.id)));
}

/** Управление лидами в конкретной воронке. */
export function canManageLeadsInFunnel(profile, funnel) {
  if (!profile || !funnel) return false;
  if (isConsultingFunnelManager(profile)) return true;

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
