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
 * @param {{ lead_id: string, message?: string, media_url?: string, content_uri?: string }} payload
 */
export const sendWazzupMessage = async (accountId, payload) => {
  try {
    const media =
      payload?.media_url || payload?.content_uri || payload?.contentUri || "";
    const body = {
      lead_id: payload.lead_id,
      message: payload.message ?? payload.text ?? "",
    };
    if (media) {
      body.media_url = media;
      body.content_uri = media;
    }
    const { data } = await api.post(
      `${BASE}/wazzup-accounts/${accountId}/send-message/`,
      body,
    );
    return data;
  } catch (error) {
    return reject("Send Wazzup Message Error")(error);
  }
};

/** Лимит вложения в чате (клиентская проверка; WhatsApp обычно ≤16–64 МБ). */
export const CHAT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export const CHAT_MEDIA_ACCEPT =
  "image/*,video/*,audio/*,.ogg,.opus,.oga,.mp3,.m4a,.aac,.wav,.amr,.mp4,.mov,.webm,.m4v,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv";

/** media_type по File (MIME + имя). */
export function resolveMediaTypeFromFile(file) {
  if (!file) return "";
  const mime = String(file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  if (
    mime.includes("pdf") ||
    mime.includes("msword") ||
    mime.includes("officedocument") ||
    mime.includes("spreadsheet") ||
    mime.includes("zip")
  ) {
    return "document";
  }
  return resolveMediaType({ type: "" }, file.name || "");
}

function extractUploadedMediaUrl(data) {
  if (!data) return "";
  if (typeof data === "string" && /^https?:\/\//i.test(data)) return data;
  if (typeof data !== "object") return "";
  return (
    data.url ||
    data.content_uri ||
    data.contentUri ||
    data.media_url ||
    data.file_url ||
    data.file ||
    data.path ||
    (typeof data.media === "string" ? data.media : "") ||
    ""
  );
}

/**
 * Загрузка файла → публичный URL для Wazzup contentUri.
 * Маршруты бэка (apps/consalting/urls.py):
 *   POST /consalting/wazzup-accounts/{id}/upload/  → upload_media_detail
 *   POST /consalting/wazzup/upload/                → upload_media_list
 *   POST /consalting/wazzup-accounts/upload/       → upload_media_list
 * Поле: file (+ алиас media).
 * Ответ: { url | content_uri | media_url | file }
 *
 * @param {File} file
 * @param {{ accountId?: string }} [opts]
 * @returns {Promise<{ url: string, media_type: string, notReady?: boolean }>}
 */
export const uploadConsultingChatMedia = async (file, opts = {}) => {
  if (!file) {
    return Promise.reject({ detail: "Файл не выбран." });
  }
  if (file.size > CHAT_MEDIA_MAX_BYTES) {
    return Promise.reject({
      detail: `Файл слишком большой (макс. ${Math.round(CHAT_MEDIA_MAX_BYTES / (1024 * 1024))} МБ).`,
    });
  }

  const accountId = opts.accountId;
  const paths = [
    // detail — предпочтительно (привязка к каналу)
    accountId ? `${BASE}/wazzup-accounts/${accountId}/upload/` : null,
    // list-алиасы из urls.py
    `${BASE}/wazzup/upload/`,
    `${BASE}/wazzup-accounts/upload/`,
  ].filter(Boolean);

  let sawNotReady = false;
  let lastErr = null;

  for (const path of paths) {
    const fd = new FormData();
    // Бэк ждёт именно поле `file` (см. upload_media_*)
    fd.append("file", file, file.name || "upload.bin");
    try {
      const { data } = await api.post(path, fd, { timeout: 120000 });
      const url = extractUploadedMediaUrl(data);
      if (!url) {
        lastErr = { detail: "Сервер не вернул URL файла.", data };
        continue;
      }
      return {
        url,
        media_type: resolveMediaTypeFromFile(file) || resolveMediaType({}, url),
        raw: data,
        path,
      };
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 501) {
        sawNotReady = true;
        continue;
      }
      return reject("Upload Consulting Chat Media Error")(error);
    }
  }

  if (sawNotReady && !lastErr) {
    return Promise.reject({
      notReady: true,
      status: 404,
      detail:
        "Загрузка файлов ещё не подключена на сервере (нужен POST …/wazzup/upload/).",
    });
  }
  return reject("Upload Consulting Chat Media Error")(
    lastErr || { detail: "Не удалось загрузить файл." },
  );
};

/**
 * Запасной путь: multipart send-message (file + lead_id) без отдельного upload.
 * @param {string} accountId
 * @param {{ lead_id: string, message?: string, file: File }} payload
 */
export const sendWazzupMessageWithFile = async (accountId, payload) => {
  if (!accountId || !payload?.lead_id || !payload?.file) {
    return Promise.reject({ detail: "Нужны account, lead_id и file." });
  }
  if (payload.file.size > CHAT_MEDIA_MAX_BYTES) {
    return Promise.reject({
      detail: `Файл слишком большой (макс. ${Math.round(CHAT_MEDIA_MAX_BYTES / (1024 * 1024))} МБ).`,
    });
  }
  const fd = new FormData();
  fd.append("lead_id", payload.lead_id);
  const msg = payload.message ?? payload.text ?? "";
  if (msg) {
    fd.append("message", msg);
    fd.append("text", msg);
  }
  fd.append("file", payload.file, payload.file.name || "upload.bin");
  try {
    const { data } = await api.post(
      `${BASE}/wazzup-accounts/${accountId}/send-message/`,
      fd,
      {
        timeout: 120000,
      },
    );
    return data;
  } catch (error) {
    return reject("Send Wazzup Message With File Error")(error);
  }
};

/** Канонические media_type UI: image | video | voice | document | file */
const MEDIA_TYPE_ALIASES = {
  image: "image",
  photo: "image",
  picture: "image",
  img: "image",
  video: "video",
  audio: "voice",
  voice: "voice",
  ptt: "voice",
  document: "document",
  doc: "document",
  file: "file",
  attachment: "file",
};

const MEDIA_LABELS = {
  image: "📷 [Фотография]",
  video: "🎥 [Видеозапись]",
  voice: "🎙 [Голосовое сообщение]",
  document: "📄 [Документ]",
  file: "📎 [Вложение]",
};

/**
 * Статусы доставки UI: pending | sent | delivered | read | error
 * (бэкенд FAILED / failed → error).
 */
export function normalizeMessageStatus(raw, { isOut = false } = {}) {
  const statusRaw = String(raw || "").toLowerCase().trim();
  if (["pending", "queued", "sending"].includes(statusRaw)) return "pending";
  if (["sent", "send"].includes(statusRaw)) return "sent";
  if (["delivered", "delivery", "received"].includes(statusRaw))
    return "delivered";
  if (["read", "seen", "viewed"].includes(statusRaw)) return "read";
  if (["error", "failed", "fail"].includes(statusRaw)) return "error";
  if (isOut && !statusRaw) return "sent";
  return statusRaw;
}

/** Плейсхолдер для списков / preview, если нет подписи к медиа. */
export function mediaTypeLabel(mediaType) {
  const key = String(mediaType || "").toLowerCase();
  return MEDIA_LABELS[key] || (key ? MEDIA_LABELS.file : "");
}

/**
 * Определяет media_type по полю API или расширению URL.
 * @param {object} [raw]
 * @param {string} [mediaUrl]
 * @returns {string} image|video|voice|document|file|""
 */
export function resolveMediaType(raw = {}, mediaUrl = "") {
  const m = raw && typeof raw === "object" ? raw : {};
  const explicit = String(
    m.media_type || m.mediaType || m.type || m.content_type || "",
  )
    .toLowerCase()
    .trim();

  if (explicit) {
    // "image/jpeg" → image; "audio/ogg" → voice
    const mimeMain = explicit.split("/")[0];
    if (MEDIA_TYPE_ALIASES[explicit]) return MEDIA_TYPE_ALIASES[explicit];
    if (MEDIA_TYPE_ALIASES[mimeMain]) return MEDIA_TYPE_ALIASES[mimeMain];
    // type: text / chat / location — не медиа
    if (
      ["text", "chat", "message", "location", "contact", "sticker"].includes(
        explicit,
      )
    ) {
      /* fall through to URL */
    }
  }

  const url = String(
    mediaUrl ||
      m.media_url ||
      m.content_uri ||
      m.contentUri ||
      m.file_url ||
      "",
  ).toLowerCase();
  if (!url) return "";

  const path = url.split("?")[0].split("#")[0];
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(path)) return "image";
  if (/\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(path)) return "video";
  if (/\.(ogg|oga|opus|mp3|m4a|aac|wav|amr)$/i.test(path)) return "voice";
  if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i.test(path))
    return "document";
  if (/^https?:\/\//i.test(url)) return "file";
  return "";
}

/**
 * Нормализация сообщения чата (REST / WS new_message / send-message).
 * Контракт: inbound|outbound, is_incoming, status sent|delivered|read|failed.
 * Статусы UI: pending | sent | delivered | read | error
 * Медиа: media_url (+ content_uri), media_type: image|video|voice|document|file
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
    m.is_echo === true ||
    m.from_me === true ||
    m.fromMe === true ||
    m.is_from_me === true ||
    String(m.author_type || m.sender_type || "").toLowerCase() === "manager" ||
    String(m.author_type || m.sender_type || "").toLowerCase() === "operator"
  ) {
    isOut = true;
  }
  if (
    dir === "inbound" ||
    dir === "in" ||
    dir === "incoming" ||
    m.is_incoming === true ||
    m.from_me === false ||
    m.fromMe === false
  ) {
    // Явный inbound важнее эвристик, кроме is_echo / from_me true выше
    if (!(m.isEcho === true || m.is_echo === true || m.from_me === true || m.fromMe === true)) {
      isOut = false;
    }
  }
  if (!dir && m.is_incoming == null && fallback.direction === "out") {
    isOut = true;
  }

  const status = normalizeMessageStatus(
    m.status || m.delivery_status || fallback.status || "",
    { isOut },
  );

  const messageId = m.message_id || m.messageId || null;
  const media_url =
    m.media_url ||
    m.content_uri ||
    m.contentUri ||
    m.file_url ||
    fallback.media_url ||
    "";
  const media_type =
    resolveMediaType(m, media_url) ||
    resolveMediaType(fallback, fallback.media_url || "") ||
    "";

  let text = String(m.text ?? m.message ?? m.body ?? fallback.text ?? "");
  // Фоллбэк для списков: пустой текст + медиа → плейсхолдер
  if (!text.trim() && media_type) {
    text = mediaTypeLabel(media_type);
  }
  const stableId = m.id ?? fallback.id ?? "";

  return {
    // Серверный контракт требует стабильный data.id. Не синтезируем id здесь:
    // иначе повтор одного события получит новый ключ и не схлопнется upsert-ом.
    id: stableId === "" || stableId == null ? "" : String(stableId),
    message_id: messageId ? String(messageId) : null,
    text,
    media_url,
    media_type,
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
      return reject("List Lead Messages Error")(error);
    }
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
    // Строже, чем endsWith: сравниваем последние 10 цифр.
    // Это уменьшает ложные совпадения при близких номерах/хвостах.
    if (chatPhone.length >= 10 && leadPhone.length >= 10) {
      return chatPhone.slice(-10) === leadPhone.slice(-10);
    }
    return chatPhone === leadPhone;
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
  let lastText = String(
    r.last_message_text ||
      (typeof r.last_message === "string" ? r.last_message : "") ||
      lastObj?.text ||
      lastObj?.message ||
      r.message ||
      r.text ||
      "",
  ).trim();
  // Пустой preview + медиа → плейсхолдер (голос/фото/…), как в нормализации сообщений
  if (!lastText) {
    const mediaSrc = lastObj || r;
    const mt = resolveMediaType(
      mediaSrc,
      mediaSrc?.content_uri ||
        mediaSrc?.media_url ||
        r.last_content_uri ||
        r.content_uri ||
        "",
    );
    if (mt) lastText = mediaTypeLabel(mt);
  }
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
 * Приоритет по контракту: GET /chats/, затем /wazzup-chats/ и legacy-алиасы.
 * Тянем все страницы — иначе DRF отдаёт только первую.
 *
 * @param {"whatsapp"|"telegram"|"instagram"} channel
 * @returns {Promise<{ threads: Array, notReady: boolean, path?: string }>}
 */
export const listWazzupChats = async (channel) => {
  const ch = String(channel || "whatsapp").toLowerCase();
  const attempts = [
    // Основной маршрут контракта, затем его оптимизированный алиас.
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
      return reject("List Wazzup Chats Error")(error);
    }
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
 * На бэке Wazzup PATCH уходит в фон → ответ < 1 с; UI вызывает fire-and-forget.
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
