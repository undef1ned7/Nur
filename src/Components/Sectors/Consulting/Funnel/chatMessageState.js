import { normalizeMessageStatus } from "../../../../api/consultingWazzup";

function byTime(a, b) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

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

/** Серверные сообщения с неизвестным id намеренно не добавляются. */
export function upsertChatMessage(list, message) {
  if (!message?.id) return list;
  const index = list.findIndex((item) => sameChatMessage(item, message));
  if (index === -1) return [...list, message].sort(byTime);

  const next = list.slice();
  const previous = next[index];
  next[index] = {
    ...previous,
    ...message,
    id: message.id ? String(message.id) : previous.id,
    message_id: message.message_id || previous.message_id,
    direction:
      previous.direction === "out" || message.direction === "out"
        ? "out"
        : message.direction,
    status: pickNewerMessageStatus(previous.status, message.status),
  };
  return next.sort(byTime);
}

/** message_status обновляет существующий пузырь и не создаёт новый. */
export function applyChatMessageStatus(list, data) {
  const id = data?.id != null ? String(data.id) : "";
  const messageId = data?.message_id || data?.messageId;
  if (!id || data?.status == null || data.status === "") return list;
  const status = normalizeMessageStatus(data.status, { isOut: true });
  if (!status) return list;

  let matched = false;
  const next = list.map((message) => {
    const isMatch = String(message.id) === id;
    if (!isMatch) return message;
    matched = true;
    return {
      ...message,
      status: pickNewerMessageStatus(message.status, status),
      message_id: messageId ? String(messageId) : message.message_id,
    };
  });
  return matched ? next : list;
}

/**
 * Сливает свежую REST-историю и помечает конкретный pending, если сервер
 * по-прежнему не дал финального статуса.
 */
export function reconcilePendingMessage(list, history, messageId) {
  const key = messageId ? String(messageId) : "";
  const merged = (history || []).reduce(
    (messages, message) => upsertChatMessage(messages, message),
    list,
  );
  if (!key) return merged;
  return merged.map((message) =>
    String(message.id) === key && message.status === "pending"
      ? { ...message, status: "unconfirmed" }
      : message,
  );
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
