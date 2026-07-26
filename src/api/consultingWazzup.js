/**
 * Консалтинг: интеграция Wazzup API v3 (WhatsApp / Instagram / Telegram).
 *
 * Каналы настраивает админ в Django Admin
 * (`/admin/consalting/wazzupaccountconsalting/`).
 * Фронт только читает готовые аккаунты:
 *   GET /consalting/wazzup/credentials/  (алиас wazzup-credentials/)
 *   fallback: GET /consalting/wazzup-accounts/
 *
 * Пользователь CRM ключи/webhook не вводит — всё фоном на бэке.
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

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

/** Webhook URL модуля Консалтинг (не /crm/wazzup/webhook/). */
export function getDefaultWazzupWebhookUrl() {
  const base = (
    import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api"
  ).replace(/\/$/, "");
  return `${base}/consalting/wazzup/webhook/`;
}

/**
 * Нормализация аккаунта для UI (без api_key в стейте).
 */
export function normalizeWazzupAccount(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const type = String(r.integration_type || "whatsapp").toLowerCase();
  const active = r.is_active !== false;
  return {
    id: r.id,
    channel_id: r.channel_id || "",
    integration_type: type,
    integration_type_display: r.integration_type_display || "",
    api_url: r.api_url || "",
    is_active: active,
    // credentials без is_connected → считаем connected, если active
    is_connected:
      r.is_connected === true ||
      r.webhook_configured === true ||
      r.is_webhook_set === true ||
      (r.is_connected == null && active),
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
  };
}

/**
 * GET /consalting/wazzup/credentials/ | /wazzup-credentials/
 * Массив каналов компании (настройка только в Django Admin).
 */
export const listWazzupCredentials = async () => {
  const paths = [
    `${BASE}/wazzup/credentials/`,
    `${BASE}/wazzup-credentials/`,
  ];
  let lastErr = null;
  for (const path of paths) {
    try {
      const { data } = await api.get(path);
      return asArray(data).map(normalizeWazzupAccount);
    } catch (error) {
      const status = error?.response?.status;
      lastErr = error;
      if (status === 404 || status === 501) continue;
      return reject("List Wazzup Credentials Error")(error);
    }
  }
  if (lastErr) return reject("List Wazzup Credentials Error")(lastErr);
  return [];
};

/**
 * Список каналов Wazzup для отправки / статуса.
 * Сначала credentials (фоновая админ-настройка), затем wazzup-accounts.
 *
 * @param {Object} [params]
 * @returns {Promise<Array>}
 */
export const listWazzupAccounts = async (params = {}) => {
  try {
    const rows = await listWazzupCredentials();
    if (rows.length) return rows;
  } catch (error) {
    const status = error?.status || error?.response?.status;
    if (status && status !== 404 && status !== 501) {
      return reject("List Wazzup Accounts Error")(error);
    }
  }

  try {
    const { data } = await api.get(`${BASE}/wazzup-accounts/`, { params });
    return asArray(data).map(normalizeWazzupAccount);
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
    return normalizeWazzupAccount(data);
  } catch (error) {
    return reject("Get Wazzup Account Error")(error);
  }
};

/**
 * @deprecated Каналы создаёт админ в Django Admin, не пользователь CRM.
 * POST /consalting/wazzup-accounts/
 */
export const createWazzupAccount = async (payload) => {
  try {
    const { data } = await api.post(`${BASE}/wazzup-accounts/`, payload);
    return normalizeWazzupAccount(data);
  } catch (error) {
    return reject("Create Wazzup Account Error")(error);
  }
};

/**
 * @deprecated Отключение — через админку.
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
 * @deprecated Webhook настраивается на бэке / в админке.
 * POST /consalting/wazzup-accounts/{id}/setup-webhook/
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

/** Собрать все страницы paginated DRF-ответа (до maxPages). */
async function fetchAllPages(path, params, { maxPages = 20 } = {}) {
  const pageSize = params?.page_size || 100;
  let page = 1;
  let rows = [];
  let guard = 0;

  while (guard < maxPages) {
    guard += 1;
    const { data } = await api.get(path, {
      params: { ...params, page, page_size: pageSize },
    });
    const chunk = asList(data);
    rows = rows.concat(chunk);

    const count = typeof data?.count === "number" ? data.count : null;
    const hasNext = Boolean(data?.next);
    if (!chunk.length) break;
    if (count != null && rows.length >= count) break;
    if (!hasNext && count == null) break;
    if (!hasNext) break;
    page += 1;
  }

  return rows;
}

/**
 * Нормализация элемента списка чатов.
 * Контракт GET /consalting/chats/ | /wazzup-chats/:
 * { id, lead_id, chat_id, name, phone, owner, last_message,
 *   last_message_text, last_message_time, unread_count, has_unread }
 */
export function normalizeChatThread(raw, channel) {
  const r = raw && typeof raw === "object" ? raw : {};
  const leadId = r.lead_id || r.lead || r.id || null;
  const id = String(leadId || r.id || "");

  const lastObj =
    r.last_message && typeof r.last_message === "object" ? r.last_message : null;
  const lastText = String(
    r.last_message_text ||
      (typeof r.last_message === "string" ? r.last_message : "") ||
      lastObj?.text ||
      lastObj?.message ||
      r.message ||
      r.text ||
      "",
  );
  const lastAt =
    r.last_message_time ||
    r.last_message_at ||
    lastObj?.created_at ||
    r.updated_at ||
    r.created_at ||
    null;

  const unread = Number(r.unread_count ?? r.unread ?? (r.has_unread ? 1 : 0));

  return {
    id,
    lead_id: leadId ? String(leadId) : id,
    chat_id: r.chat_id || r.phone || "",
    full_name:
      r.name ||
      r.full_name ||
      r.title ||
      r.contact_name ||
      r.client_display ||
      "Без имени",
    phone: r.phone || r.chat_id || r.plain_id || "",
    source: String(
      r.source || r.integration_type || channel || "whatsapp",
    ).toLowerCase(),
    owner: r.owner || null,
    last_message: lastText,
    last_message_at: lastAt,
    unread_count: Number.isFinite(unread) ? unread : 0,
    has_unread: r.has_unread === true || unread > 0,
    raw: r,
  };
}

/**
 * Список диалогов по каналу (whatsapp | telegram | instagram).
 * Основной путь: GET /consalting/chats/ и /wazzup-chats/
 * Тянем все страницы — иначе DRF отдаёт только первую (часто 4–10 шт.).
 *
 * @param {"whatsapp"|"telegram"|"instagram"} channel
 * @returns {Promise<{ threads: Array, notReady: boolean, path?: string }>}
 */
export const listWazzupChats = async (channel) => {
  const ch = String(channel || "whatsapp").toLowerCase();
  const attempts = [
    {
      path: `${BASE}/chats/`,
      params: { integration_type: ch, source: ch, page_size: 100 },
    },
    {
      path: `${BASE}/wazzup-chats/`,
      params: { integration_type: ch, source: ch, page_size: 100 },
    },
    { path: `${BASE}/leads/`, params: { source: ch, page_size: 100 } },
    { path: `${BASE}/inbound-leads/`, params: { source: ch, page_size: 100 } },
  ];

  let sawNotReady = false;
  let lastErr = null;

  for (const { path, params } of attempts) {
    try {
      const rows = await fetchAllPages(path, params);
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

/**
 * POST /consalting/leads/{id}/mark-read/ — сброс непрочитанных в inbox.
 */
export const markLeadChatRead = async (id) => {
  try {
    const { data } = await api.post(`${BASE}/leads/${id}/mark-read/`);
    return data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404 || status === 501) return { notReady: true };
    return reject("Mark Lead Chat Read Error")(error);
  }
};
