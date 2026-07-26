/**
 * Какой лид сейчас открыт в мессенджере — чтобы не дублировать
 * звук/колокольчик, когда пользователь уже смотрит этот чат.
 */
let activeLeadId = null;

export function setConsultingActiveChatLead(leadId) {
  activeLeadId =
    leadId == null || leadId === "" ? null : String(leadId);
}

export function getConsultingActiveChatLead() {
  return activeLeadId;
}

export function isConsultingActiveChatLead(leadId) {
  if (activeLeadId == null || leadId == null) return false;
  return String(activeLeadId) === String(leadId);
}
