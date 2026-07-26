/**
 * Единый WebSocket Wazzup для консалтинга.
 * Один CONNECT на вкладку → Daphne видит /ws/wazzup/, чат и уведомления
 * без опроса HTTP.
 *
 * URL: wss://…/ws/wazzup/?token=<JWT>
 */
import api from "../api";

const PING_INTERVAL_MS = 25000;
const MAX_RECONNECT_DELAY_MS = 30000;

function buildWazzupWsUrl(token) {
  const encoded = encodeURIComponent(token);
  const envBase = import.meta.env.VITE_WS_API_URL;

  if (envBase) {
    const wsBase = envBase.replace(/^http/i, (m) =>
      m.toLowerCase() === "https" ? "wss" : "ws",
    );
    return `${wsBase.replace(/\/$/, "")}/ws/wazzup/?token=${encoded}`;
  }

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  if (import.meta.env.PROD) {
    return `wss://app.nurcrm.kg/ws/wazzup/?token=${encoded}`;
  }
  return `${proto}://${window.location.host}/ws/wazzup/?token=${encoded}`;
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

let ws = null;
let pingTimer = null;
let reconnectTimer = null;
let retry = 0;
let connectGen = 0;
let intentionalClose = false;
let refCount = 0;
const listeners = new Set();
const statusListeners = new Set();

function clearPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function notifyStatus(connected) {
  statusListeners.forEach((fn) => {
    try {
      fn(connected);
    } catch {
      /* noop */
    }
  });
}

function dispatchFrame(msg) {
  if (!msg || typeof msg !== "object") return;
  const type = String(msg.type || msg.event || "").toLowerCase();
  const action = String(msg.action || "").toLowerCase();
  if (type === "connection_established" || type === "pong" || action === "pong") {
    return;
  }

  listeners.forEach((handlers) => {
    try {
      if (action === "send_message_ack" || type === "send_message_ack") {
        handlers.onSendAck?.(msg);
        return;
      }
      const data = msg.data || msg.payload || msg;
      if (type === "new_message") {
        handlers.onNewMessage?.(data, msg);
        return;
      }
      if (type === "message_status") {
        handlers.onStatus?.(data, msg);
      }
    } catch {
      /* isolate subscriber errors */
    }
  });
}

function hardClose() {
  clearPing();
  if (ws) {
    try {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onopen = null;
      ws.close(1000, "close");
    } catch {
      /* noop */
    }
    ws = null;
  }
  notifyStatus(false);
}

function connect() {
  const token = localStorage.getItem("accessToken");
  if (!token || refCount <= 0) return;

  const myGen = ++connectGen;
  intentionalClose = false;
  clearReconnect();
  clearPing();
  if (ws) {
    try {
      ws.onclose = null;
      ws.close(1000, "reconnect");
    } catch {
      /* noop */
    }
    ws = null;
  }

  let socket;
  try {
    socket = new WebSocket(buildWazzupWsUrl(token));
  } catch {
    scheduleReconnect(myGen);
    return;
  }
  ws = socket;

  socket.onopen = () => {
    if (myGen !== connectGen) return;
    retry = 0;
    notifyStatus(true);
    pingTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ action: "ping" }));
        } catch {
          /* noop */
        }
      }
    }, PING_INTERVAL_MS);
  };

  socket.onmessage = (event) => {
    if (myGen !== connectGen) return;
    try {
      dispatchFrame(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };

  socket.onclose = async (event) => {
    if (myGen !== connectGen) return;
    clearPing();
    ws = null;
    notifyStatus(false);
    if (intentionalClose || refCount <= 0) return;

    if (event.code === 4401) {
      const newToken = await refreshAccessToken();
      if (newToken && myGen === connectGen && refCount > 0) {
        connect();
      }
      return;
    }

    scheduleReconnect(myGen);
  };

  socket.onerror = () => {
    /* onclose reconnects */
  };
}

function scheduleReconnect(myGen) {
  const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** retry);
  retry += 1;
  reconnectTimer = setTimeout(() => {
    if (myGen === connectGen && refCount > 0) connect();
  }, delay);
}

/**
 * Удерживает соединение (ref-count). Пока есть хотя бы один holder — WS открыт.
 * @returns {() => void} release
 */
export function acquireWazzupSocket() {
  refCount += 1;
  if (refCount === 1 || !ws || ws.readyState === WebSocket.CLOSED) {
    // microtask — не дёргать setState синхронно из React effect
    window.setTimeout(() => {
      if (refCount > 0) connect();
    }, 0);
  }
  return () => {
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      intentionalClose = true;
      connectGen += 1;
      clearReconnect();
      hardClose();
    }
  };
}

export function subscribeWazzupSocket(handlers) {
  listeners.add(handlers);
  return () => {
    listeners.delete(handlers);
  };
}

export function subscribeWazzupStatus(fn) {
  statusListeners.add(fn);
  const open = !!(ws && ws.readyState === WebSocket.OPEN);
  try {
    fn(open);
  } catch {
    /* noop */
  }
  return () => {
    statusListeners.delete(fn);
  };
}

export function sendWazzupChatMessage(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const frame = {
    action: "send_message",
    lead_id: payload.lead_id,
    text: payload.text || "",
  };
  if (payload.media_url) frame.media_url = payload.media_url;
  ws.send(JSON.stringify(frame));
  return true;
}

export function isWazzupSocketOpen() {
  return !!(ws && ws.readyState === WebSocket.OPEN);
}

/** Для отладки в консоли: window.__wazzupSocketDebug?.() */
if (typeof window !== "undefined") {
  window.__wazzupSocketDebug = () => ({
    refCount,
    readyState: ws?.readyState ?? null,
    listeners: listeners.size,
    urlHint: "/ws/wazzup/",
  });
}
