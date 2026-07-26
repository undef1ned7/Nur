/**
 * Источники входящих лидов консалтинга (Wazzup + ручные).
 * См. docs/consulting/wazzup-integration.md и leads-whatsapp.md.
 */

export const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp", color: "#25d366" },
  { value: "instagram", label: "Instagram", color: "#e1306c" },
  { value: "telegram", label: "Telegram", color: "#2aabee" },
  { value: "manual", label: "Вручную", color: "#64748b" },
];

export const WAZZUP_INTEGRATION_TYPES = LEAD_SOURCES.filter(
  (s) => s.value !== "manual",
);

/** Каналы мессенджера в CRM-чатах. */
export const CRM_CHAT_CHANNELS = ["whatsapp", "telegram", "instagram"];

const BY_VALUE = Object.fromEntries(LEAD_SOURCES.map((s) => [s.value, s]));

export function leadSourceMeta(source) {
  const key = String(source || "")
    .trim()
    .toLowerCase();
  if (BY_VALUE[key]) return BY_VALUE[key];
  if (!key) return { value: "", label: "—", color: "#64748b" };
  return {
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    color: "#64748b",
  };
}

export function leadSourceLabel(source) {
  return leadSourceMeta(source).label;
}

function notifType(n) {
  return String(
    n?.type || n?.category || n?.event || n?.data?.type || "",
  ).toLowerCase();
}

/** События назначения лида (уведомления + Wazzup WS). */
export function isConsultingLeadAssignEvent(n) {
  const t = notifType(n);
  if (!t) return false;
  return (
    t === "lead.assigned" ||
    t.includes("lead.assigned") ||
    t.includes("funnel.lead.assigned") ||
    t.includes("lead.task.assigned") ||
    (t.includes("lead") && t.includes("assign") && !t.includes("message"))
  );
}

/** Лид написал сообщение. */
export function isConsultingLeadMessageEvent(n) {
  const t = notifType(n);
  if (!t) return false;
  return (
    t === "lead_message" ||
    t === "lead.message" ||
    t === "lead.new_message" ||
    t.includes("lead_message") ||
    t.includes("lead.message") ||
    t.includes("lead.new_message") ||
    t.includes("consulting.lead.message") ||
    (t.includes("lead") && t.includes("message") && !t.includes("assign"))
  );
}

/** Лид передан другому сотруднику. */
export function isConsultingLeadTransferEvent(n) {
  const t = notifType(n);
  const hay = `${t} ${n?.title || ""} ${n?.message || ""}`.toLowerCase();
  return (
    t === "lead_transferred" ||
    t === "lead.transferred" ||
    t.includes("lead_transferred") ||
    t.includes("lead.transferred") ||
    t.includes("transfer") ||
    hay.includes("передан лид") ||
    hay.includes("вам передан")
  );
}

/** Долго не отвечали / SLA / просрочка (бэкенд tasks.py / signals.py). */
export function isConsultingLeadNoReplyEvent(n) {
  const t = notifType(n);
  if (
    t === "lead.no_reply" ||
    t === "lead.unanswered" ||
    t === "lead.reply_overdue" ||
    t === "no_activity" ||
    t === "sla_breach" ||
    t === "task_overdue" ||
    t.includes("lead.no_reply") ||
    t.includes("lead.unanswered") ||
    t.includes("lead.reply_overdue") ||
    t.includes("no_reply") ||
    t.includes("unanswered") ||
    t.includes("reply_overdue") ||
    t.includes("no_activity") ||
    t.includes("sla_breach") ||
    t.includes("task_overdue") ||
    (t.includes("sla") && !t.includes("message"))
  ) {
    return true;
  }

  // create_and_publish без спец. type: «⏰ Внимание: Лид без ответа > 15 мин!»
  const hay = `${t} ${n?.title || ""} ${n?.message || ""}`.toLowerCase();
  return (
    hay.includes("без ответа") ||
    hay.includes("ожидает вашего ответа") ||
    hay.includes("превышено время ответа") ||
    hay.includes("нет активности") ||
    (hay.includes("лид") && hay.includes("более") && hay.includes("минут"))
  );
}

/** Любое событие чата/лида для CRM inbox. */
export function isConsultingChatRealtimeEvent(n) {
  if (
    isConsultingLeadAssignEvent(n) ||
    isConsultingLeadMessageEvent(n) ||
    isConsultingLeadNoReplyEvent(n) ||
    isConsultingLeadTransferEvent(n)
  ) {
    return true;
  }
  // create_and_publish_notification без спец. type — эвристика по тексту/lead_id
  const leadId = consultingNotificationLeadId(n);
  if (!leadId) return false;
  const hay = `${notifType(n)} ${n?.title || ""} ${n?.message || ""}`.toLowerCase();
  return (
    hay.includes("лид") ||
    hay.includes("lead") ||
    hay.includes("сообщен") ||
    hay.includes("ответ") ||
    hay.includes("wazzup") ||
    hay.includes("whatsapp") ||
    hay.includes("клиент")
  );
}

export function isConsultingFunnelRealtimeEvent(n) {
  const t = notifType(n);
  if (!t) return false;
  return (
    isConsultingChatRealtimeEvent(n) ||
    t.includes("lead") ||
    t.includes("лид") ||
    t.includes("funnel") ||
    t.includes("assign")
  );
}

/**
 * Deep-link в CRM-чат из уведомления.
 * meta.lead_id + meta.source|channel (whatsapp|telegram|instagram)
 * либо id из backend-url `/consalting/leads/{id}`.
 */
export function consultingNotificationChatPath(n) {
  const leadId = consultingNotificationLeadId(n);
  if (!leadId) return null;

  const meta = n?.meta || n?.data?.meta || {};
  const data = n?.data && typeof n.data === "object" ? n.data : {};
  const raw = String(
    meta.source ||
      meta.channel ||
      meta.transport ||
      data.source ||
      data.channel ||
      n?.source ||
      "whatsapp",
  ).toLowerCase();
  const channel = CRM_CHAT_CHANNELS.includes(raw) ? raw : "whatsapp";
  return `/crm/consulting/chats/${channel}/${leadId}`;
}

/** Id лида из API-пути бэка: /consalting/leads/{uuid} */
export function extractLeadIdFromConsaltingUrl(url) {
  if (!url) return null;
  const path = String(url)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/api(?=\/)/, "");
  const m = path.match(/\/consalting\/leads\/([0-9a-fA-F-]{36}|\d+)\b/);
  return m ? m[1] : null;
}

/**
 * URL клика по уведомлению → рабочий фронтовый маршрут.
 * Бэк шлёт `/consalting/leads/{id}` — на SPA это не маршрут.
 */
export function resolveConsultingNotificationUrl(n) {
  const rawUrl = n?.url ?? n?.link ?? n?.data?.url ?? "";
  const leadId = consultingNotificationLeadId(n);

  if (
    leadId &&
    (isConsultingLeadMessageEvent(n) ||
      isConsultingLeadNoReplyEvent(n) ||
      /\/consalting\/leads\//i.test(String(rawUrl)))
  ) {
    return (
      consultingNotificationChatPath(n) ||
      `/crm/consulting/chats/whatsapp/${leadId}`
    );
  }

  if (rawUrl) {
    const path = String(rawUrl)
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/api(?=\/)/, "");

    const fromPath = extractLeadIdFromConsaltingUrl(path);
    if (fromPath) {
      return `/crm/consulting/chats/whatsapp/${fromPath}`;
    }
    if (/\/consalting\/leads\/?$/i.test(path)) return "/crm/consulting/leads";
    if (/\/consalting\/funnel/i.test(path)) return "/crm/consulting/funnel";
    if (path.startsWith("/crm/")) return path;
    if (path.startsWith("/consalting/")) {
      return path.replace(/^\/consalting\//, "/crm/consulting/");
    }
  }

  return consultingNotificationChatPath(n);
}

/** Достать lead_id из произвольного уведомления (для mute звука в открытом чате). */
export function consultingNotificationLeadId(n) {
  const meta = n?.meta || n?.data?.meta || {};
  const data = n?.data && typeof n.data === "object" ? n.data : {};
  const direct =
    meta.lead_id ??
    meta.leadId ??
    meta.lead ??
    data.lead_id ??
    data.lead ??
    n?.lead_id ??
    n?.leadId ??
    n?.object_id ??
    meta.object_id ??
    null;
  if (direct) return String(direct);

  const rawUrl = n?.url ?? n?.link ?? data?.url ?? "";
  return extractLeadIdFromConsaltingUrl(rawUrl);
}
