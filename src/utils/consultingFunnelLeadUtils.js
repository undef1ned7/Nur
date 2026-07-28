import { isCompletedStage } from "./consultingFunnelDefaults";
import { isConsultingFunnelManager } from "./consultingFunnelAccess";

export function findStageInBoard(board, stageId) {
  if (!board || stageId == null || stageId === "") return null;
  const sid = String(stageId);
  return (
    (board.columns || []).find((c) => String(c.stage?.id) === sid)?.stage || null
  );
}

export function isLeadOnCompletedStage(lead, board) {
  if (!lead) return false;
  const stage = findStageInBoard(board, lead.stage);
  return isCompletedStage(stage);
}

export function isLeadArchived(lead) {
  return lead?.is_archived === true || !!lead?.archived_at;
}

/** Id из строки / числа / вложенного `{ id }` (owner с API часто объект). */
export function resolveEntityId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    const nested =
      value.id ??
      value.uuid ??
      value.pk ??
      value.user_id ??
      value.user ??
      null;
    if (nested != null && typeof nested === "object") {
      return resolveEntityId(nested);
    }
    return nested != null && nested !== "" ? String(nested) : null;
  }
  return String(value);
}

/**
 * Все возможные id текущего пользователя (profile / user slice / localStorage).
 * Нужны, потому что lead.owner и profile.id иногда расходятся по типу сущности.
 */
export function resolveCurrentUserIds(profile, wsUserId) {
  const ids = [];
  const seen = new Set();
  const add = (raw) => {
    const id = resolveEntityId(raw);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  add(wsUserId);
  add(profile?.user_id);
  add(profile?.user);
  add(profile?.id);
  add(profile?.employee_id);
  add(profile?.employee?.id);
  try {
    add(localStorage.getItem("userId"));
  } catch {
    /* ignore */
  }
  return ids;
}

export function resolveCurrentUserId(profile, wsUserId) {
  return resolveCurrentUserIds(profile, wsUserId)[0] || "";
}

export function isLeadOwner(lead, userIdOrIds) {
  const ownerId = resolveEntityId(lead?.owner);
  if (!ownerId) return false;
  const ids = Array.isArray(userIdOrIds)
    ? userIdOrIds
    : resolveCurrentUserIds(null, userIdOrIds);
  return ids.some((id) => id && String(id) === ownerId);
}

/**
 * С лидом можно взаимодействовать (edit / move / chat / notes / delete):
 * — руководитель компании (owner/admin);
 * — назначенный сотрудник (lead.owner);
 * — лид без владельца (пул) — только claim/просмотр; редактирование — нет
 *   (canEditLead ниже).
 */
export function canInteractWithLead(lead, profile, userId) {
  if (!lead || isLeadArchived(lead)) return false;
  if (isConsultingFunnelManager(profile)) return true;
  const ownerId = resolveEntityId(lead.owner);
  if (!ownerId) return false; // пул: сначала claim
  const ids = resolveCurrentUserIds(profile, userId);
  return ids.includes(ownerId);
}

/** Редактирование / перемещение / чат / удаление. */
export function canEditLead(lead, board, profile, userId) {
  if (!canInteractWithLead(lead, profile, userId)) return false;
  if (isLeadOnCompletedStage(lead, board) && !isConsultingFunnelManager(profile)) {
    return false;
  }
  return true;
}

/** Лид на «Завершено» — редактирование/перемещение только owner/admin. */
export function isLeadLockedForEmployee(lead, board, profile) {
  if (!lead || isLeadArchived(lead)) return true;
  if (!isLeadOnCompletedStage(lead, board)) return false;
  return !isConsultingFunnelManager(profile);
}

export function canDragLead(lead, board, profile, canManageLeads, userId) {
  if (!canManageLeads || !lead || isLeadArchived(lead)) return false;
  if (!canEditLead(lead, board, profile, userId)) return false;
  return true;
}

export function filterActiveBoardLeads(leads) {
  return (leads || []).filter((l) => !isLeadArchived(l));
}

export function employeeDisplayName(e = {}) {
  return (
    e.full_name ||
    e.name ||
    [e.first_name, e.last_name].filter(Boolean).join(" ") ||
    e.email ||
    "Сотрудник"
  );
}
