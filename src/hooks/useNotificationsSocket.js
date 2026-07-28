/**
 * Real-time уведомления через WebSocket, интегрированные с колокольчиком в шапке.
 *
 * Подключается к `/ws/notifications/?token=<accessToken>` (см.
 * docs/production/08-websocket-notifications.md), авторизуясь текущим
 * JWT/Access Token. Каналы/группы и фильтрацию по бизнес-логике (компания,
 * роль, склад, агент …) определяет бэкенд — клиент просто получает то, что ему
 * положено.
 *
 * Консалтинг / Wazzup (персонально владельцу лида):
 *  - lead.assigned / consulting.lead.assigned
 *  - lead.message / consulting.lead.message — лид написал
 *  - lead.no_reply / consulting.lead.no_reply — долго не отвечали
 *
 * См. docs/consulting/realtime-notifications.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../api";
import {
  notificationReceived,
  unreadCountSet,
} from "../store/slices/notificationSlice";
import { playNotificationSound } from "../config/notificationSound";
import {
  consultingNotificationLeadId,
  extractLeadIdFromConsaltingUrl,
  isConsultingLeadNoReplyEvent,
  resolveConsultingNotificationUrl,
} from "../utils/consultingLeadSources";
import { isConsultingActiveChatLead } from "../utils/consultingActiveChat";

const PING_INTERVAL_MS = 25000;
const MAX_RECONNECT_DELAY_MS = 30000;

/** Типы консалтинг-событий → заголовок по умолчанию и уровень. */
const CONSULTING_EVENT_META = {
  "lead.assigned": {
    title: "Вам назначен лид",
    level: "info",
  },
  "consulting.lead.assigned": {
    title: "Вам назначен лид",
    level: "info",
  },
  "consulting.funnel.lead.assigned": {
    title: "Вам назначен лид",
    level: "info",
  },
  "consulting.lead.task.assigned": {
    title: "Вам поручена задача по лиду",
    level: "info",
  },
  lead_transferred: {
    title: "Вам передан лид",
    level: "info",
  },
  "lead.transferred": {
    title: "Вам передан лид",
    level: "info",
  },
  "consulting.lead.transferred": {
    title: "Вам передан лид",
    level: "info",
  },
  "lead.message": {
    title: "Новое сообщение от лида",
    level: "info",
  },
  lead_message: {
    title: "Новое сообщение от лида",
    level: "info",
  },
  "lead.new_message": {
    title: "Новое сообщение от лида",
    level: "info",
  },
  "consulting.lead.message": {
    title: "Новое сообщение от лида",
    level: "info",
  },
  "consulting.lead.new_message": {
    title: "Новое сообщение от лида",
    level: "info",
  },
  "lead.no_reply": {
    title: "Долго не отвечали лиду",
    level: "warning",
  },
  "lead.unanswered": {
    title: "Долго не отвечали лиду",
    level: "warning",
  },
  "lead.reply_overdue": {
    title: "Долго не отвечали лиду",
    level: "warning",
  },
  "consulting.lead.no_reply": {
    title: "Долго не отвечали лиду",
    level: "warning",
  },
  "consulting.lead.unanswered": {
    title: "Долго не отвечали лиду",
    level: "warning",
  },
  "consulting.lead.reply_overdue": {
    title: "Долго не отвечали лиду",
    level: "warning",
  },
  // Бэкенд signals.py (create_and_publish_notification)
  no_activity: {
    title: "Нет активности по лиду",
    level: "warning",
  },
  sla_breach: {
    title: "Превышено время ответа по лиду",
    level: "warning",
  },
  task_overdue: {
    title: "Просрочена задача по лиду",
    level: "warning",
  },
  "consulting.no_activity": {
    title: "Нет активности по лиду",
    level: "warning",
  },
  "consulting.sla_breach": {
    title: "Превышено время ответа по лиду",
    level: "warning",
  },
  "consulting.task_overdue": {
    title: "Просрочена задача по лиду",
    level: "warning",
  },
};

function resolveConsultingMeta(type) {
  if (CONSULTING_EVENT_META[type]) return CONSULTING_EVENT_META[type];
  if (
    type.includes("no_reply") ||
    type.includes("unanswered") ||
    type.includes("reply_overdue") ||
    type.includes("no_activity") ||
    type.includes("sla_breach") ||
    type.includes("task_overdue") ||
    type === "sla" ||
    type.endsWith(".sla")
  ) {
    return CONSULTING_EVENT_META.sla_breach;
  }
  if (type.includes("message") || type.includes("wazzup")) {
    return CONSULTING_EVENT_META["lead.message"];
  }
  if (type.includes("transfer")) {
    return CONSULTING_EVENT_META.lead_transferred;
  }
  if (type.includes("task") && type.includes("assign")) {
    return CONSULTING_EVENT_META["consulting.lead.task.assigned"];
  }
  if (type.includes("assign")) {
    return CONSULTING_EVENT_META["lead.assigned"];
  }
  return null;
}

function isConsultingLeadEventType(type) {
  return !!resolveConsultingMeta(type) || type.startsWith("consulting.lead.");
}

function normalizeConsultingNotification(type, payload, raw) {
  const data = payload && typeof payload === "object" ? payload : {};
  const metaHint = resolveConsultingMeta(type) || {
    title: "Уведомление по лиду",
    level: "info",
  };
  const id =
    data.id ??
    data.uuid ??
    data.pk ??
    data.notification_id ??
    data.message_id ??
    (data.lead_id ? `${type}-${data.lead_id}-${data.created_at || Date.now()}` : null) ??
    `${type}-${Date.now()}`;

  const message =
    data.message ||
    data.body ||
    data.text ||
    data.title ||
    [data.full_name, data.phone].filter(Boolean).join(", ") ||
    raw?.message ||
    "";

  const normalized = {
    ...data,
    id,
    title: data.title || metaHint.title,
    message,
    type: data.type || type,
    level: data.level || data.importance || metaHint.level,
    is_read: data.is_read ?? data.read ?? false,
    created_at: data.created_at || new Date().toISOString(),
    meta: {
      ...(typeof data.meta === "object" && data.meta ? data.meta : {}),
      lead_id:
        data.meta?.lead_id ??
        data.lead_id ??
        data.lead ??
        extractLeadIdFromConsaltingUrl(data.url || data.link || raw?.url) ??
        null,
      source:
        data.meta?.source ??
        data.source ??
        data.channel ??
        null,
    },
  };

  if (!normalized.url && !normalized.link) {
    const path = resolveConsultingNotificationUrl(normalized);
    if (path) normalized.url = path;
  } else {
    // Бэкенд часто шлёт /consalting/leads/... — переписываем на SPA-маршрут
    const resolved = resolveConsultingNotificationUrl(normalized);
    if (resolved) normalized.url = resolved;
  }

  return normalized;
}

function buildWebSocketUrl(token) {
  const encoded = encodeURIComponent(token);
  const envBase = import.meta.env.VITE_WS_API_URL;

  if (envBase) {
    const wsBase = envBase.replace(/^http/i, (m) =>
      m.toLowerCase() === "https" ? "wss" : "ws",
    );
    return `${wsBase.replace(/\/$/, "")}/ws/notifications/?token=${encoded}`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws/notifications/?token=${encoded}`;
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return null;
  try {
    const { data } = await api.post("/users/auth/refresh/", { refresh });
    if (data?.access) {
      localStorage.setItem("accessToken", data.access);
      return data.access;
    }
  } catch {
    /* handled by caller */
  }
  return null;
}

export function useNotificationsSocket({ enabled = true } = {}) {
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const reconnectRef = useRef(null);
  const retryRef = useRef(0);
  const connectGenRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const connectRef = useRef(() => {});

  const clearPing = useCallback(() => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    clearPing();
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "Client closed");
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearPing]);

  const handleMessage = useCallback(
    (msg) => {
      if (!msg || typeof msg !== "object") return;

      const type = String(msg.type || msg.event || "").toLowerCase();
      if (type === "connection_established" || type === "pong") return;

      if (type === "unread_count") {
        dispatch(unreadCountSet(msg.count ?? msg.data?.count ?? 0));
        return;
      }

      const payload = msg.data || msg.notification || msg.payload || msg;
      const innerType = String(
        payload?.type || payload?.category || payload?.event || "",
      ).toLowerCase();
      const consultingType = isConsultingLeadEventType(type)
        ? type
        : isConsultingLeadEventType(innerType)
          ? innerType
          : null;

      if (consultingType) {
        const normalized = normalizeConsultingNotification(
          consultingType,
          payload,
          msg,
        );
        const leadId = consultingNotificationLeadId(normalized);
        // SLA/warning всегда со звуком — даже если чат открыт.
        const isSla =
          consultingType.includes("no_reply") ||
          consultingType.includes("sla") ||
          consultingType.includes("no_activity") ||
          consultingType.includes("task_overdue") ||
          consultingType.includes("unanswered") ||
          consultingType.includes("reply_overdue");
        const skipSound =
          !isSla &&
          leadId &&
          isConsultingActiveChatLead(leadId) &&
          document.visibilityState === "visible" &&
          consultingType.includes("message");
        dispatch(notificationReceived(normalized));
        if (!(normalized.is_read ?? false) && !skipSound) {
          playNotificationSound();
        }
        return;
      }

      // Generic path: create_and_publish часто шлёт без id
      // { type:"notification", data:{ type:"lead_message", title, message, url } }
      const hasContent = !!(
        payload?.title ||
        payload?.message ||
        payload?.body ||
        payload?.url ||
        payload?.type
      );
      if (!hasContent) return;

      const enriched = {
        ...payload,
        id:
          payload?.id ??
          payload?.uuid ??
          payload?.pk ??
          payload?.notification_id ??
          `ws-${innerType || type || "notif"}-${Date.now()}`,
      };

      // SLA-текст без спец. type → level warning
      if (
        !enriched.level &&
        isConsultingLeadNoReplyEvent(enriched)
      ) {
        enriched.level = "warning";
        if (!enriched.type || enriched.type === "notification") {
          enriched.type = "sla_breach";
        }
      }

      const resolved = resolveConsultingNotificationUrl(enriched);
      if (resolved) enriched.url = resolved;

      const leadId = consultingNotificationLeadId(enriched);
      if (leadId) {
        enriched.meta = {
          ...(typeof enriched.meta === "object" && enriched.meta
            ? enriched.meta
            : {}),
          lead_id: enriched.meta?.lead_id ?? leadId,
        };
      }

      const isSla = isConsultingLeadNoReplyEvent(enriched);
      const skipSound =
        !isSla &&
        leadId &&
        isConsultingActiveChatLead(leadId) &&
        document.visibilityState === "visible";

      dispatch(notificationReceived(enriched));

      const unread = !(enriched.is_read ?? enriched.read ?? false);
      if (unread && !skipSound) playNotificationSound();
    },
    [dispatch],
  );

  const connect = useCallback(
    (_isReconnect = false) => {
      if (!enabled) return;
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const myGen = ++connectGenRef.current;
      intentionalCloseRef.current = false;
      clearReconnect();
      clearPing();
      closeSocket();

      let ws;
      try {
        ws = new WebSocket(buildWebSocketUrl(token));
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (myGen !== connectGenRef.current) return;
        retryRef.current = 0;
        setIsConnected(true);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (myGen !== connectGenRef.current) return;
        try {
          handleMessage(JSON.parse(event.data));
        } catch {
          /* ignore malformed payloads */
        }
      };

      ws.onclose = async (event) => {
        if (myGen !== connectGenRef.current) return;
        clearPing();
        setIsConnected(false);
        wsRef.current = null;
        if (intentionalCloseRef.current) return;

        if (event.code === 4401) {
          const newToken = await refreshAccessToken();
          if (newToken && myGen === connectGenRef.current) {
            connectRef.current(true);
          }
          return;
        }

        const delay = Math.min(
          MAX_RECONNECT_DELAY_MS,
          1000 * 2 ** retryRef.current,
        );
        retryRef.current += 1;
        reconnectRef.current = setTimeout(() => {
          if (myGen === connectGenRef.current) connectRef.current(true);
        }, delay);
      };

      ws.onerror = () => {
        /* onclose обработает переподключение */
      };
    },
    [enabled, clearReconnect, clearPing, closeSocket, handleMessage],
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setTimeout(() => connect(false), 0);

    const onOnline = () => {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectRef.current(true);
      }
    };
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)
      ) {
        connectRef.current(true);
      }
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timer);
      intentionalCloseRef.current = true;
      connectGenRef.current += 1;
      clearReconnect();
      closeSocket();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, connect, clearReconnect, closeSocket]);

  return { isConnected };
}

export default useNotificationsSocket;
