import { normalizeMessageStatus } from "../../../../api/consultingWazzup";

export function sameChatMessage(a, b) {
  return !!(a?.id && b?.id && String(a.id) === String(b.id));
}

const STATUS_RANK = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  error: 4,
};

export function pickNewerMessageStatus(prev, next) {
  if (!next) return prev || "pending";
  if (!prev) return next;
  if (next === "error") return "error";
  if (prev === "error" && next !== "error") return next;
  if (prev === "unconfirmed" && next === "pending") return prev;
  if (next === "unconfirmed" && prev === "pending") return next;
  const previousRank = STATUS_RANK[prev] ?? -1;
  const nextRank = STATUS_RANK[next] ?? -1;
  return nextRank >= previousRank ? next : prev;
}

function mergeMessage(previous, message) {
  if (!previous) return { ...message, id: String(message.id) };
  const nextCreated =
    message.created_at ||
    message.timestamp ||
    previous.created_at ||
    previous.timestamp ||
    "";
  return {
    ...previous,
    ...message,
    id: String(message.id),
    message_id: message.message_id || previous.message_id,
    created_at: nextCreated,
    timestamp: message.timestamp || previous.timestamp || nextCreated,
    direction:
      previous.direction === "out" || message.direction === "out"
        ? "out"
        : message.direction,
    status: pickNewerMessageStatus(previous.status, message.status),
  };
}

/** Единственный путь записи одного сообщения: Map upsert строго по data.id. */
export function upsertChatMessage(byId, message) {
  if (!message?.id) return byId;
  const key = String(message.id);
  const next = new Map(byId);
  next.set(key, mergeMessage(next.get(key), message));
  return next;
}

/** Массовый upsert истории: одна копия Map, без сортировки после каждой записи. */
export function mergeChatMessages(byId, messages) {
  const next = new Map(byId);
  for (const message of messages || []) {
    if (!message?.id) continue;
    const key = String(message.id);
    next.set(key, mergeMessage(next.get(key), message));
  }
  return next;
}

/** Числовое время для сортировки (не localeCompare — ломается на +00:00 vs +06:00). */
export function messageSortTime(message) {
  const raw =
    message?.timestamp ||
    message?.created_at ||
    message?.createdAt ||
    message?.dateTime ||
    "";
  if (!raw) {
    // Без времени — в конец ленты (новые optimistic / status-stub).
    return Number.POSITIVE_INFINITY;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** Сортировка выполняется только для render-представления, state остаётся Map. */
export function sortChatMessages(byId) {
  return Array.from(byId.values()).sort((a, b) => {
    const byTime = messageSortTime(a) - messageSortTime(b);
    if (byTime) return byTime;
    const bySeq = (Number(a._seq) || 0) - (Number(b._seq) || 0);
    if (bySeq) return bySeq;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Optimistic local-* → серверный id: удаляем temp, upsert по data.id.
 * Сохраняем локальный текст/медиа, если ack пришёл урезанным.
 */
export function confirmOptimisticMessage(byId, tempId, serverMessage) {
  if (!serverMessage?.id) return byId;
  const serverKey = String(serverMessage.id);
  const tempKey = tempId ? String(tempId) : "";
  const next = new Map(byId);
  const optimistic = tempKey ? next.get(tempKey) : null;
  if (tempKey) next.delete(tempKey);

  const existing = next.get(serverKey);
  const fromOptimistic = optimistic
    ? { ...optimistic, id: serverKey, optimistic: false }
    : null;
  const base = fromOptimistic
    ? mergeMessage(existing, fromOptimistic)
    : existing;

  const serverMedia =
    serverMessage.media_url || serverMessage.content_uri || "";
  const baseMedia = base?.media_url || "";
  const mediaUrl =
    serverMedia ||
    (baseMedia && !String(baseMedia).startsWith("blob:") ? baseMedia : "") ||
    baseMedia;

  next.set(
    serverKey,
    mergeMessage(base, {
      ...serverMessage,
      id: serverKey,
      text: serverMessage.text || base?.text || "",
      media_url: mediaUrl,
      media_type: serverMessage.media_type || base?.media_type || "",
      created_at:
        serverMessage.created_at ||
        serverMessage.timestamp ||
        base?.created_at ||
        "",
      direction: "out",
      optimistic: false,
    }),
  );
  return next;
}

export function markMessageError(byId, messageId) {
  const key = messageId ? String(messageId) : "";
  if (!key || !byId.has(key)) return byId;
  const next = new Map(byId);
  const prev = next.get(key);
  next.set(key, { ...prev, status: "error" });
  return next;
}

/**
 * message_status тоже идёт через Map upsert. Запись создаётся даже если статус
 * обогнал ack: последующий ack дополнит её текстом, не откатив статус в pending.
 */
export function applyChatMessageStatus(byId, data) {
  const id = data?.id != null ? String(data.id) : "";
  const messageId = data?.message_id || data?.messageId;
  if (!id || data?.status == null || data.status === "") return byId;
  const status = normalizeMessageStatus(data.status, { isOut: true });
  const previous = byId.get(id);
  if (!status) return byId;

  return upsertChatMessage(byId, {
    ...data,
    id,
    direction: previous?.direction || "out",
    created_at:
      previous?.created_at || data.timestamp || data.created_at || "",
    status,
    message_id: messageId ? String(messageId) : previous?.message_id,
  });
}

/**
 * Сливает свежую REST-историю и помечает конкретный pending, если сервер
 * по-прежнему не дал финального статуса.
 */
export function reconcilePendingMessage(byId, history, messageId) {
  const key = messageId ? String(messageId) : "";
  const merged = mergeChatMessages(byId, history);
  if (!key) return merged;
  const message = merged.get(key);
  if (!message || message.status !== "pending") return merged;
  merged.set(key, { ...message, status: "unconfirmed" });
  return merged;
}

/**
 * Возвращает pending только из активного лида. Это не даёт позднему ack
 * предыдущего диалога попасть в текущий.
 */
export function takePendingForAck(queue, ackData, activeLeadId) {
  const rows = [...(queue || [])];
  const activeId = activeLeadId ? String(activeLeadId) : "";
  const ackLeadId = ackData?.lead_id || ackData?.lead;
  if (ackLeadId && activeId && String(ackLeadId) !== activeId) {
    return { pending: null, queue: rows };
  }

  const text = String(ackData?.text || ackData?.message || "").trim();
  let index = rows.findIndex(
    (item) =>
      item.leadId === activeId &&
      (!text || !item.text || item.text === text),
  );
  if (index < 0) {
    index = rows.findIndex((item) => item.leadId === activeId);
  }
  if (index < 0) return { pending: null, queue: rows };

  const [pending] = rows.splice(index, 1);
  return { pending, queue: rows };
}
