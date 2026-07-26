/**
 * Консалтинг: интеграция Wazzup API v3 (WhatsApp / Instagram / Telegram).
 *
 * Два параллельных бэкенд-модуля:
 *  - Консалтинг (эта страница): /api/consalting/wazzup-accounts/
 *  - Общий CRM:                 /api/crm/wazzup-accounts/
 *
 * Подключение — 2 шага:
 *  1) POST …/wazzup-accounts/           { api_key, channel_id, integration_type }
 *  2) POST …/wazzup-accounts/{id}/setup-webhook/  { webhook_url? }
 *     → бэкенд регистрирует webhook в Wazzup и ставит is_connected = true
 *
 * Channel ID = поле channelId из GET https://api.wazzup24.com/v3/channels
 * (UUID, не plainId/телефон).
 *
 * Контракт: docs/consulting/wazzup-integration.md
 */
import api from ".";

const BASE = "/consalting";

const reject = (label) => (error) => {
  if (error.response) {
    console.error(`${label}:`, error.response.data);
    const data = error.response.data;
    const payload =
      data && typeof data === "object" ? { ...data } : { detail: data };
    payload.status = error.response.status;
    return Promise.reject(payload);
  }
  return Promise.reject(error);
};

/** Webhook URL модуля Консалтинг (не /crm/wazzup/webhook/). */
export function getDefaultWazzupWebhookUrl() {
  const base = (
    import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api"
  ).replace(/\/$/, "");
  return `${base}/consalting/wazzup/webhook/`;
}

/**
 * GET /consalting/wazzup-accounts/
 * Список аккаунтов Wazzup текущей компании.
 *
 * Ответ — массив (или { results }):
 * {
 *   id, company, branch,
 *   api_key,           // часто маскированный
 *   api_url,           // напр. https://api.wazzup24.com
 *   channel_id,
 *   integration_type,  // whatsapp | instagram | telegram
 *   integration_type_display,
 *   is_active, is_connected,
 *   created_at, updated_at
 * }
 *
 * @param {Object} [params]
 * @returns {Promise<Array|Object>}
 */
export const listWazzupAccounts = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/wazzup-accounts/`, { params });
    return data;
  } catch (error) {
    return reject("List Wazzup Accounts Error")(error);
  }
};

/**
 * GET /consalting/wazzup-accounts/{id}/
 * Один аккаунт по UUID.
 * @param {string} id
 */
export const getWazzupAccount = async (id) => {
  try {
    const { data } = await api.get(`${BASE}/wazzup-accounts/${id}/`);
    return data;
  } catch (error) {
    return reject("Get Wazzup Account Error")(error);
  }
};

/**
 * POST /consalting/wazzup-accounts/
 * @param {{ api_key: string, channel_id: string, integration_type: "whatsapp"|"instagram"|"telegram" }} payload
 */
export const createWazzupAccount = async (payload) => {
  try {
    const { data } = await api.post(`${BASE}/wazzup-accounts/`, payload);
    return data;
  } catch (error) {
    return reject("Create Wazzup Account Error")(error);
  }
};

/**
 * DELETE /consalting/wazzup-accounts/{id}/
 */
export const deleteWazzupAccount = async (id) => {
  try {
    const { data } = await api.delete(`${BASE}/wazzup-accounts/${id}/`);
    return data;
  } catch (error) {
    return reject("Delete Wazzup Account Error")(error);
  }
};

/**
 * POST /consalting/wazzup-accounts/{id}/setup-webhook/
 * NurCRM регистрирует URL в Wazzup API v3 через PATCH /v3/webhooks
 * (не POST — у Wazzup на /v3/webhooks POST нет → 404).
 *
 * Body (наш API): { webhook_url?: string }
 * Бэкенд → Wazzup:
 *   PATCH https://api.wazzup24.com/v3/webhooks
 *   { webhooksUri, subscriptions: { messagesAndStatuses: true } }
 *
 * Успех → is_connected = true.
 *
 * @param {string} id
 * @param {{ webhook_url?: string }} [payload]
 */
export const setupWazzupWebhook = async (id, payload = {}) => {
  try {
    const body = {
      webhook_url: payload.webhook_url || getDefaultWazzupWebhookUrl(),
    };
    const { data } = await api.post(
      `${BASE}/wazzup-accounts/${id}/setup-webhook/`,
      body,
    );
    return data;
  } catch (error) {
    return reject("Setup Wazzup Webhook Error")(error);
  }
};

/**
 * POST /consalting/wazzup-accounts/{id}/send-message/
 * Отправка ответа клиенту из карточки лида воронки.
 * @param {string} accountId
 * @param {{ lead_id: string, message: string, media_url?: string }} payload
 */
export const sendWazzupMessage = async (accountId, payload) => {
  try {
    const { data } = await api.post(
      `${BASE}/wazzup-accounts/${accountId}/send-message/`,
      payload,
    );
    return data;
  } catch (error) {
    return reject("Send Wazzup Message Error")(error);
  }
};

/**
 * Нормализация сообщения чата (REST / WS new_message / send-message).
 * Контракт: inbound|outbound, is_incoming, status sent|delivered|read.
 * Статусы UI: pending | sent | delivered | read | error
 */
export function normalizeChatMessage(raw, fallback = {}) {
  const m = raw && typeof raw === "object" ? raw : {};
  const dir = String(m.direction || "").toLowerCase();

  let isOut = false;
  if (
    dir === "outbound" ||
    dir === "out" ||
    dir === "outgoing" ||
    m.is_incoming === false ||
    m.is_outgoing === true ||
    m.isEcho === true ||
    m.is_echo === true
  ) {
    isOut = true;
  }
  if (
    dir === "inbound" ||
    dir === "in" ||
    dir === "incoming" ||
    m.is_incoming === true
  ) {
    isOut = false;
  }
  if (!dir && m.is_incoming == null && fallback.direction === "out") {
    isOut = true;
  }

  const statusRaw = String(
    m.status || m.delivery_status || fallback.status || (isOut ? "sent" : ""),
  ).toLowerCase();

  let status = statusRaw;
  if (["pending", "queued", "sending"].includes(statusRaw)) status = "pending";
  else if (["sent", "send"].includes(statusRaw)) status = "sent";
  else if (["delivered", "delivery", "received"].includes(statusRaw))
    status = "delivered";
  else if (["read", "seen", "viewed"].includes(statusRaw)) status = "read";
  else if (["error", "failed", "fail"].includes(statusRaw)) status = "error";
  else if (isOut && !status) status = "sent";

  const messageId = m.message_id || m.messageId || null;

  return {
    id: String(
      m.id ?? messageId ?? m.external_id ?? m.uuid ?? fallback.id ?? `tmp-${Date.now()}`,
    ),
    message_id: messageId ? String(messageId) : null,
    text: String(m.text ?? m.message ?? m.body ?? fallback.text ?? ""),
    media_url:
      m.media_url ||
      m.content_uri ||
      m.contentUri ||
      m.file_url ||
      fallback.media_url ||
      "",
    direction: isOut ? "out" : "in",
    status,
    created_at:
      m.created_at ||
      m.timestamp ||
      m.dateTime ||
      m.datetime ||
      m.sent_at ||
      fallback.created_at ||
      new Date().toISOString(),
    author_name:
      m.author_name ||
      m.authorName ||
      m.contact_name ||
      m.sender_name ||
      "",
    chat_id: m.chat_id || m.chatId || null,
    lead_id: m.lead_id || m.lead || fallback.lead_id || null,
    raw: m,
  };
}

/** Основной путь истории + алиасы из WAZZUP_FRONTEND_DOCUMENTATION. */
const MESSAGE_LIST_PATHS = (leadId) => [
  // Основной (документация §3 / §4.1)
  { path: `${BASE}/wazzup-messages/`, params: { lead: leadId } },
  // Алиасы
  { path: `${BASE}/whatsapp-messages/`, params: { lead: leadId } },
  { path: `${BASE}/messages/`, params: { lead: leadId } },
  // Альтернатива
  { path: `${BASE}/leads/${leadId}/whatsapp/history/`, params: undefined },
  { path: `${BASE}/leads/${leadId}/messages/`, params: undefined },
];

/**
 * История чата по лиду.
 * GET /consalting/wazzup-messages/?lead={LEAD_UUID}
 * @param {string} leadId
 * @returns {Promise<{ messages: Array, path: string|null, notReady: boolean }>}
 */
export const listLeadMessages = async (leadId) => {
  if (!leadId) return { messages: [], path: null, notReady: false };

  let sawNotReady = false;
  let lastErr = null;

  for (const { path, params } of MESSAGE_LIST_PATHS(leadId)) {
    try {
      const { data } = await api.get(path, { params });
      const rows = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data)
            ? data
            : [];
      return {
        messages: rows.map((r) => normalizeChatMessage(r, { lead_id: leadId })),
        path,
        notReady: false,
      };
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 501) {
        sawNotReady = true;
        continue;
      }
      lastErr = error;
      if (status && status < 500) continue;
      break;
    }
  }

  if (lastErr && !sawNotReady) {
    return reject("List Lead Messages Error")(lastErr);
  }
  return { messages: [], path: null, notReady: sawNotReady };
};

/** Нормализация телефона для сравнения chat_id ↔ lead.phone */
export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Сообщение относится к открытому лиду?
 * WS new_message часто даёт chat_id (телефон), REST — lead.
 */
export function messageBelongsToLead(msg, lead) {
  if (!lead?.id) return false;
  const leadId = msg?.lead_id || msg?.lead;
  if (leadId && String(leadId) === String(lead.id)) return true;

  const chatPhone = normalizePhone(msg?.chat_id);
  const leadPhone = normalizePhone(lead.phone);
  if (chatPhone && leadPhone) {
    // Сравниваем хвост (с/без кода страны)
    return (
      chatPhone === leadPhone ||
      chatPhone.endsWith(leadPhone) ||
      leadPhone.endsWith(chatPhone)
    );
  }
  // Нет якоря — не подмешиваем чужие диалоги
  return false;
}

const asList = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

/**
 * Нормализация элемента списка чатов (лид / inbound / wazzup-chat).
 */
export function normalizeChatThread(raw, channel) {
  const r = raw && typeof raw === "object" ? raw : {};
  const leadId = r.lead_id || r.lead || (r.id && !r.inbound ? r.id : null);
  const id = String(leadId || r.id || "");
  return {
    id,
    lead_id: leadId ? String(leadId) : id,
    full_name:
      r.full_name ||
      r.name ||
      r.title ||
      r.contact_name ||
      r.client_display ||
      "Без имени",
    phone: r.phone || r.chat_id || r.plain_id || "",
    source: String(r.source || r.integration_type || channel || "whatsapp").toLowerCase(),
    last_message:
      r.last_message ||
      r.last_message_text ||
      r.message ||
      r.text ||
      "",
    last_message_at:
      r.last_message_at ||
      r.updated_at ||
      r.created_at ||
      null,
    unread_count: Number(r.unread_count || r.unread || 0) || 0,
    status: r.status || "",
    raw: r,
  };
}

/**
 * Список диалогов по каналу (whatsapp | telegram | instagram).
 * Пробует dedicated chats API, затем leads/?source=, затем inbound-leads.
 *
 * @param {"whatsapp"|"telegram"|"instagram"} channel
 * @returns {Promise<{ threads: Array, notReady: boolean }>}
 */
export const listWazzupChats = async (channel) => {
  const ch = String(channel || "whatsapp").toLowerCase();
  const attempts = [
    { path: `${BASE}/wazzup-chats/`, params: { integration_type: ch, source: ch } },
    { path: `${BASE}/chats/`, params: { integration_type: ch, source: ch } },
    { path: `${BASE}/leads/`, params: { source: ch, page_size: 100 } },
    { path: `${BASE}/inbound-leads/`, params: { source: ch, page_size: 100 } },
  ];

  let sawNotReady = false;
  let lastErr = null;

  for (const { path, params } of attempts) {
    try {
      const { data } = await api.get(path, { params });
      const rows = asList(data);
      // Фильтр по каналу на случай, если бэк не отфильтровал
      const filtered = rows.filter((r) => {
        const src = String(r.source || r.integration_type || ch).toLowerCase();
        return !r.source && !r.integration_type
          ? true
          : src === ch || src.includes(ch);
      });
      const threads = filtered
        .map((r) => normalizeChatThread(r, ch))
        .filter((t) => t.id)
        .sort((a, b) => {
          const ta = new Date(a.last_message_at || 0).getTime();
          const tb = new Date(b.last_message_at || 0).getTime();
          return tb - ta;
        });
      return { threads, notReady: false, path };
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 501) {
        sawNotReady = true;
        continue;
      }
      lastErr = error;
      if (status && status < 500) continue;
      break;
    }
  }

  if (lastErr && !sawNotReady) {
    return reject("List Wazzup Chats Error")(lastErr);
  }
  return { threads: [], notReady: sawNotReady, path: null };
};

/**
 * GET /consalting/leads/{id}/ — карточка лида для чата.
 */
export const getConsultingLead = async (id) => {
  try {
    const { data } = await api.get(`${BASE}/leads/${id}/`);
    return data;
  } catch (error) {
    return reject("Get Consulting Lead Error")(error);
  }
};
