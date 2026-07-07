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

/** Лид на «Завершено» — редактирование/перемещение только owner/admin. */
export function isLeadLockedForEmployee(lead, board, profile) {
  if (!lead || isLeadArchived(lead)) return true;
  if (!isLeadOnCompletedStage(lead, board)) return false;
  return !isConsultingFunnelManager(profile);
}

export function canDragLead(lead, board, profile, canManageLeads) {
  if (!canManageLeads || !lead || isLeadArchived(lead)) return false;
  if (isLeadOnCompletedStage(lead, board) && !isConsultingFunnelManager(profile)) {
    return false;
  }
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
