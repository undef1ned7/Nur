import { useCallback, useEffect, useRef, useState } from "react";

import api from "../api";



const PING_INTERVAL_MS = 25000;

const MAX_RECONNECT_DELAY_MS = 30000;



const UPSERT_EVENTS = new Set([

  "lead.created",

  "lead.claimed",

  "lead.released",

  "lead.updated",

  "lead.stage_changed",

  "lead.won",

  "lead.lost",

]);



function buildWebSocketUrl(token) {

  const encoded = encodeURIComponent(token);

  const envBase = import.meta.env.VITE_WS_API_URL;



  if (envBase) {

    const wsBase = envBase.replace(/^http/i, (m) =>

      m.toLowerCase() === "https" ? "wss" : "ws"

    );

    return `${wsBase.replace(/\/$/, "")}/ws/consalting/funnel/?token=${encoded}`;

  }



  const proto = window.location.protocol === "https:" ? "wss" : "ws";

  return `${proto}://${window.location.host}/ws/consalting/funnel/?token=${encoded}`;

}



function resolveAllowedIds(funnelIdsKey, funnelIds, funnelId) {

  if (funnelIdsKey) {

    return funnelIdsKey.split(",").filter(Boolean);

  }

  return (funnelIds?.length ? funnelIds : funnelId ? [funnelId] : []).map(String);

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



/**

 * Real-time канбан воронки консалтинга (docs/message.txt).

 * Передавайте funnelIdsKey (стабильная строка id через запятую), чтобы не

 * переподключать сокет при каждом рендере.

 */

export function useFunnelBoardWebSocket({

  funnelId,

  funnelIds,

  funnelIdsKey = "",

  enabled = true,

  onUpsert,

  onRemove,

  onAssigned,

  onReconnect,

}) {

  const [isConnected, setIsConnected] = useState(false);

  const [userId, setUserId] = useState(null);

  const [isManager, setIsManager] = useState(false);



  const wsRef = useRef(null);

  const pingRef = useRef(null);

  const reconnectRef = useRef(null);

  const retryRef = useRef(0);

  const intentionalCloseRef = useRef(false);

  const connectGenRef = useRef(0);

  const allowedIdsRef = useRef(new Set());



  const callbacksRef = useRef({

    onUpsert,

    onRemove,

    onAssigned,

    onReconnect,

  });

  callbacksRef.current = { onUpsert, onRemove, onAssigned, onReconnect };



  const syncAllowedIds = useCallback(() => {

    allowedIdsRef.current = new Set(

      resolveAllowedIds(funnelIdsKey, funnelIds, funnelId),

    );

    return allowedIdsRef.current;

  }, [funnelId, funnelIds, funnelIdsKey]);



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



  const handleMessage = useCallback((msg) => {

    if (!msg || typeof msg !== "object") return;



    if (msg.type === "connection_established") {

      setUserId(msg.user_id || null);

      setIsManager(!!msg.is_manager);

      return;

    }



    if (msg.type === "pong") return;



    const data = msg.data || {};

    const allowedIds = allowedIdsRef.current;



    if (data.funnel && allowedIds.size && !allowedIds.has(String(data.funnel))) {

      return;

    }



    const { onUpsert: upsert, onRemove: remove, onAssigned: assigned } =

      callbacksRef.current;



    switch (msg.type) {

      case "lead.removed":

      case "lead.deleted":

        if (data.id) remove?.(data);

        break;

      case "lead.assigned":

        assigned?.(data);

        break;

      default:

        if (UPSERT_EVENTS.has(msg.type) && data.id) {

          upsert?.(data);

        }

        break;

    }

  }, []);



  const connect = useCallback(

    async (isReconnect = false) => {

      const allowedSet = syncAllowedIds();

      if (!enabled || !allowedSet.size) return;



      const token = localStorage.getItem("accessToken");

      if (!token) return;



      const myGen = ++connectGenRef.current;

      intentionalCloseRef.current = false;

      clearReconnect();

      clearPing();

      closeSocket();



      const url = buildWebSocketUrl(token);

      const ws = new WebSocket(url);

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



        if (isReconnect) {

          callbacksRef.current.onReconnect?.();

        }

      };



      ws.onmessage = (event) => {

        if (myGen !== connectGenRef.current) return;

        try {

          const msg = JSON.parse(event.data);

          handleMessage(msg);

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

            connect(true);

          }

          return;

        }



        const delay = Math.min(

          MAX_RECONNECT_DELAY_MS,

          1000 * 2 ** retryRef.current

        );

        retryRef.current += 1;



        reconnectRef.current = setTimeout(() => {

          if (myGen === connectGenRef.current) connect(true);

        }, delay);

      };



      ws.onerror = () => {

        /* onclose handles reconnect */

      };

    },

    [

      enabled,

      syncAllowedIds,

      clearPing,

      clearReconnect,

      closeSocket,

      handleMessage,

    ]

  );



  useEffect(() => {

    const allowedSet = syncAllowedIds();

    if (!enabled || !allowedSet.size) {

      intentionalCloseRef.current = true;

      clearReconnect();

      closeSocket();

      setUserId(null);

      setIsManager(false);

      return undefined;

    }



    intentionalCloseRef.current = false;

    retryRef.current = 0;

    connect(false);



    return () => {

      intentionalCloseRef.current = true;

      connectGenRef.current += 1;

      clearReconnect();

      closeSocket();

    };

  }, [

    enabled,

    funnelId,

    funnelIdsKey,

    connect,

    syncAllowedIds,

    clearReconnect,

    closeSocket,

  ]);



  return { isConnected, userId, isManager };

}


