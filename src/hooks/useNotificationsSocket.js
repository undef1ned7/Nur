import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../api";
import {
  notificationReceived,
  unreadCountSet,
} from "../store/slices/notificationSlice";
import { playNotificationSound } from "../config/notificationSound";

/**
 * Real-time уведомления через WebSocket, интегрированные с колокольчиком в шапке.
 *
 * Подключается к `/ws/notifications/?token=<accessToken>` (см.
 * docs/production/08-websocket-notifications.md), авторизуясь текущим
 * JWT/Access Token. Каналы/группы и фильтрацию по бизнес-логике (компания,
 * роль, склад, агент …) определяет бэкенд — клиент просто получает то, что ему
 * положено.
 *
 * Возможности:
 *  - переподключение с экспоненциальной задержкой;
 *  - обновление access-токена при коде закрытия 4401;
 *  - ping/pong для удержания соединения;
 *  - защита от дублей (дедуп по id в слайсе);
 *  - звук при новом непрочитанном уведомлении (best-effort);
 *  - без лишних API-запросов: новые уведомления приходят из сокета и кладутся
 *    в общий redux-слайс `notification`.
 *
 * Паттерн соединения повторяет существующий useFunnelBoardWebSocket — чтобы
 * быть нативным для проекта.
 */

const PING_INTERVAL_MS = 25000;
const MAX_RECONNECT_DELAY_MS = 30000;

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

      // Явное обновление счётчика непрочитанных
      if (type === "unread_count") {
        dispatch(unreadCountSet(msg.count ?? msg.data?.count ?? 0));
        return;
      }

      // Уведомление: поддерживаем { type:"notification", data:{...} } и
      // прямой объект уведомления.
      const payload = msg.data || msg.notification || msg.payload || msg;
      const id = payload?.id ?? payload?.uuid ?? payload?.pk;
      const looksLikeNotification =
        id != null && (payload.title || payload.message || payload.type);
      if (!looksLikeNotification) return;

      dispatch(notificationReceived(payload));

      const unread = !(payload.is_read ?? payload.read ?? false);
      if (unread) playNotificationSound();
    },
    [dispatch],
  );

  const connect = useCallback(
    (isReconnect = false) => {
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

        // токен протух → обновляем и переподключаемся
        if (event.code === 4401) {
          const newToken = await refreshAccessToken();
          if (newToken && myGen === connectGenRef.current) connect(true);
          return;
        }

        const delay = Math.min(
          MAX_RECONNECT_DELAY_MS,
          1000 * 2 ** retryRef.current,
        );
        retryRef.current += 1;
        reconnectRef.current = setTimeout(() => {
          if (myGen === connectGenRef.current) connect(true);
        }, delay);
      };

      ws.onerror = () => {
        /* onclose обработает переподключение */
      };
    },
    [enabled, clearReconnect, clearPing, closeSocket, handleMessage],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    connect(false);

    // переподключение при возврате вкладки в фокус / онлайн
    const onOnline = () => {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect(true);
      }
    };
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)
      ) {
        connect(true);
      }
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
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
