/**
 * React-обёртка над единым /ws/wazzup/ (wazzupSocketManager).
 * Несколько компонентов могут подписаться — соединение одно.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireWazzupSocket,
  sendWazzupChatMessage,
  subscribeWazzupSocket,
  subscribeWazzupStatus,
} from "../services/wazzupSocketManager";

/**
 * @param {{
 *   enabled?: boolean,
 *   onNewMessage?: Function,
 *   onStatus?: Function,
 *   onSendAck?: Function,
 * }} opts
 */
export function useWazzupChatSocket({
  enabled = true,
  onNewMessage,
  onStatus,
  onSendAck,
} = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef({ onNewMessage, onStatus, onSendAck });

  useEffect(() => {
    handlersRef.current = { onNewMessage, onStatus, onSendAck };
  }, [onNewMessage, onStatus, onSendAck]);

  useEffect(() => {
    if (!enabled) return undefined;

    const release = acquireWazzupSocket();
    const unsubStatus = subscribeWazzupStatus(setIsConnected);
    const unsub = subscribeWazzupSocket({
      onNewMessage: (data, msg) => handlersRef.current.onNewMessage?.(data, msg),
      onStatus: (data, msg) => handlersRef.current.onStatus?.(data, msg),
      onSendAck: (msg) => handlersRef.current.onSendAck?.(msg),
    });

    return () => {
      unsub();
      unsubStatus();
      release();
    };
  }, [enabled]);

  const sendMessage = useCallback((payload) => sendWazzupChatMessage(payload), []);

  return { isConnected, sendMessage };
}

export default useWazzupChatSocket;
