import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useDispatch } from "react-redux";
import {
  FaCheck,
  FaCheckDouble,
  FaExclamationCircle,
  FaInstagram,
  FaLink,
  FaPaperclip,
  FaPaperPlane,
  FaTelegram,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import {
  CHAT_MEDIA_ACCEPT,
  CHAT_MEDIA_MAX_BYTES,
  listLeadMessages,
  listWazzupAccounts,
  markLeadChatRead,
  mediaTypeLabel,
  messageBelongsToLead,
  normalizeChatMessage,
  normalizeMessageStatus,
  resolveMediaType,
  resolveMediaTypeFromFile,
  sendWazzupMessage,
  sendWazzupMessageWithFile,
  uploadConsultingChatMedia,
} from "../../../../api/consultingWazzup";
import {
  leadSourceLabel,
} from "../../../../utils/consultingLeadSources";
import { setConsultingActiveChatLead } from "../../../../utils/consultingActiveChat";
import { useWazzupChatSocket } from "../../../../hooks/useWazzupChatSocket";
import { markLeadNotificationsReadAsync } from "../../../../store/creators/notificationCreators";
import ChatMessageMedia from "./ChatMessageMedia";
import {
  applyChatMessageStatus,
  confirmOptimisticMessage,
  markMessageError,
  mergeChatMessages,
  reconcilePendingMessage,
  sortChatMessages,
  takePendingForAck,
  upsertChatMessage,
} from "./chatMessageState";

/** §6 гайда: если за 20–30 с после ack нет message_status — REST + «не подтверждено». */
const DELIVERY_STATUS_TIMEOUT_MS = 25000;

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const errText = (e, fallback) => {
  if (!e) return fallback;
  if (typeof e.detail === "string") return e.detail;
  if (Array.isArray(e.detail)) return e.detail.join(" ");
  if (typeof e === "string") return e;
  return fallback;
};

const SourceIcon = ({ type }) => {
  const t = String(type || "").toLowerCase();
  if (t === "instagram") return <FaInstagram aria-hidden />;
  if (t === "telegram") return <FaTelegram aria-hidden />;
  return <FaWhatsapp aria-hidden />;
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function StatusTicks({ status }) {
  const s = normalizeMessageStatus(status);
  if (s === "unconfirmed") {
    return (
      <span
        className="funnel__chatTicks funnel__chatTicks--unconfirmed"
        title="Доставка не подтверждена"
      >
        <FaExclamationCircle /> Не подтверждено
      </span>
    );
  }
  if (s === "error") {
    return (
      <span
        className="funnel__chatTicks funnel__chatTicks--error"
        title="Ошибка отправки / доставки"
      >
        <FaExclamationCircle />
      </span>
    );
  }
  if (s === "read") {
    return (
      <span className="funnel__chatTicks funnel__chatTicks--read" title="Прочитано">
        <FaCheckDouble />
      </span>
    );
  }
  if (s === "delivered") {
    return (
      <span
        className="funnel__chatTicks funnel__chatTicks--delivered"
        title="Доставлено"
      >
        <FaCheckDouble />
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="funnel__chatTicks" title="Отправляется…">
        …
      </span>
    );
  }
  return (
    <span className="funnel__chatTicks" title="Отправлено">
      <FaCheck />
    </span>
  );
}

/** Текст в бабле: скрыть плейсхолдер медиа, если есть плеер/картинка. */
function bubbleText(m) {
  const t = String(m?.text || "").trim();
  if (!t) return "";
  if (m?.media_url && m?.media_type) {
    const ph = mediaTypeLabel(m.media_type);
    if (ph && t === ph) return "";
  }
  return t;
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * WhatsApp-чат лида (контракт async Wazzup — docs/consulting/wazzup-chat-async.md):
 *  — своё исходящее рисуем из send_message_ack / REST (по сокету себе не приходит)
 *  — Map upsert строго по data.id
 *  — финальный статус: message_status (pending → sent|failed|delivered|read)
 *  — история GET /wazzup-messages/?lead= при открытии и после реконнекта
 */
export default function LeadMessengerPanel({
  lead,
  onNotice,
  onError,
  onMessageUpsert,
  refreshSignal = 0,
  readOnly = false,
}) {
  const dispatch = useDispatch();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReadyAccounts, setNotReadyAccounts] = useState(false);
  const [historyNotReady, setHistoryNotReady] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMediaLink, setShowMediaLink] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [messagesById, setMessagesById] = useState(() => new Map());
  const messages = useMemo(
    () => sortChatMessages(messagesById),
    [messagesById],
  );
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef(null);
  const bodyRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const seqRef = useRef(0);
  const fileInputRef = useRef(null);
  const markReadTimerRef = useRef(null);
  const deliveryWatchdogsRef = useRef(new Map());
  const historySyncInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const leadRef = useRef(lead);
  const onNoticeRef = useRef(onNotice);
  const onErrorRef = useRef(onError);
  const onMessageUpsertRef = useRef(onMessageUpsert);
  const refreshSignalRef = useRef(refreshSignal);
  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);
  useEffect(() => {
    onNoticeRef.current = onNotice;
  }, [onNotice]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onMessageUpsertRef.current = onMessageUpsert;
  }, [onMessageUpsert]);

  useEffect(() => {
    setConsultingActiveChatLead(lead?.id || null);
    return () => setConsultingActiveChatLead(null);
  }, [lead?.id]);

  const clearMediaFile = useCallback(() => {
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const deliveryWatchdogs = deliveryWatchdogsRef.current;
    return () => {
      mountedRef.current = false;
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
      }
      deliveryWatchdogs.forEach((timer) => clearTimeout(timer));
      deliveryWatchdogs.clear();
    };
  }, []);

  const onPickFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > CHAT_MEDIA_MAX_BYTES) {
        onErrorRef.current?.(
          `Файл слишком большой (макс. ${Math.round(CHAT_MEDIA_MAX_BYTES / (1024 * 1024))} МБ).`,
        );
        e.target.value = "";
        return;
      }
      setMediaFile(file);
      setMediaUrl("");
      setShowMediaLink(false);
    },
    [],
  );

  const preferredType = String(lead?.source || "")
    .trim()
    .toLowerCase();
  const leadId = lead?.id ? String(lead.id) : "";

  /**
   * Открыли чат:
   * 1) mark-read fire-and-forget (бэк асинхронно патчит Wazzup, ответ <1с)
   * 2) уведомления в колокольчике → прочитаны
   * Не await mark-read — история и UI открываются параллельно.
   */
  useEffect(() => {
    if (!leadId) return undefined;
    markLeadChatRead(leadId).catch(() => {
      /* 404/501 / сеть — UI не блокируем */
    });
    dispatch(markLeadNotificationsReadAsync(leadId));
    return () => {
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [leadId, dispatch]);

  const scheduleMarkRead = useCallback(
    (targetLeadId) => {
      if (!targetLeadId) return;
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = window.setTimeout(() => {
        markReadTimerRef.current = null;
        const activeId = leadRef.current?.id;
        if (!activeId || String(activeId) !== String(targetLeadId)) return;
        markLeadChatRead(targetLeadId).catch(() => {
          /* чтение не должно блокировать live-чат */
        });
        dispatch(markLeadNotificationsReadAsync(targetLeadId));
      }, 250);
    },
    [dispatch],
  );

  const scrollBottom = useCallback((instant = false) => {
    const run = () => {
      const el = bodyRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      bottomRef.current?.scrollIntoView({
        behavior: instant ? "auto" : "smooth",
        block: "end",
      });
    };
    // Два кадра: после commit DOM и после layout пузыря/медиа.
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, []);

  const onBodyScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }, []);

  const maybeScrollForMessage = useCallback(
    (message, { force = false } = {}) => {
      if (force || message?.direction === "out" || stickToBottomRef.current) {
        stickToBottomRef.current = true;
        scrollBottom(true);
      }
    },
    [scrollBottom],
  );

  const loadMessages = useCallback(async ({
    merge = false,
    silent = false,
  } = {}) => {
    const current = leadRef.current;
    if (!current?.id) return;
    const requestLeadId = String(current.id);
    if (merge && historySyncInFlightRef.current) return;
    if (merge) historySyncInFlightRef.current = true;
    if (!merge && !silent) setLoadingMsgs(true);
    try {
      const { messages: rows, notReady } = await listLeadMessages(current.id);
      if (
        !mountedRef.current ||
        String(leadRef.current?.id || "") !== requestLeadId
      ) {
        return;
      }
      setHistoryNotReady(!!notReady && !rows.length);
      const seed = [];
      const seedText = current.message || current.first_message || "";
      if (!rows.length && seedText) {
        seed.push(
          normalizeChatMessage(
            {
              id: `seed-${current.id}`,
              text: seedText,
              direction: "inbound",
              created_at: current.created_at,
            },
            { lead_id: current.id },
          ),
        );
      }
      const incoming = rows.length ? rows : seed;
      // Дедуп по id (в т.ч. после реконнекта — пересечение с сокетом)
      setMessagesById((prev) =>
        mergeChatMessages(merge ? prev : new Map(), incoming),
      );
      if (!silent) scrollBottom();
    } catch (e) {
      if (!silent) {
        onErrorRef.current?.(errText(e, "Не удалось загрузить историю чата."));
      }
    } finally {
      if (merge) historySyncInFlightRef.current = false;
      if (!merge && !silent && mountedRef.current) setLoadingMsgs(false);
    }
  }, [scrollBottom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotReadyAccounts(false);
      try {
        const data = await listWazzupAccounts();
        if (cancelled) return;
        const rows = asArray(data).filter(
          (a) => a.is_active !== false && a.is_connected !== false,
        );
        setAccounts(rows);
        const preferred =
          rows.find(
            (a) =>
              String(a.integration_type || "").toLowerCase() === preferredType,
          ) ||
          rows[0];
        setAccountId(preferred ? String(preferred.id) : "");
      } catch (e) {
        if (cancelled) return;
        if (e?.status === 404 || e?.status === 501) {
          setNotReadyAccounts(true);
        } else {
          onErrorRef.current?.(
            errText(e, "Не удалось загрузить каналы Wazzup."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferredType]);

  /** WS-запросы до ack: ответ сопоставляется внутри активного leadId. */
  // Только корреляция запроса с ack. После ack ожидание доставки живёт отдельно
  // в deliveryWatchdogsRef и завершается лишь по message_status/REST-сверке.
  const sendRequestsRef = useRef([]);

  // История при открытии диалога (§5.2), дальше — сокет + реконнект/watchdog.
  useEffect(() => {
    if (!leadId) return;
    startTransition(() => {
      loadMessages();
    });
  }, [leadId, loadMessages]);

  // Резервная тихая REST-сверка по сигналу уведомлений (Map не очищаем).
  useEffect(() => {
    if (refreshSignalRef.current === refreshSignal) return;
    refreshSignalRef.current = refreshSignal;
    if (!leadId) return;
    startTransition(() => {
      loadMessages({ merge: true, silent: true });
    });
  }, [refreshSignal, leadId, loadMessages]);

  const enqueueSendRequest = useCallback((tempId, text, meta = {}) => {
    const currentLeadId = leadRef.current?.id;
    sendRequestsRef.current = [
      ...sendRequestsRef.current,
      {
        tempId,
        leadId: currentLeadId ? String(currentLeadId) : "",
        text: String(text || "").trim(),
        mediaUrl: meta.mediaUrl || "",
        mediaType: meta.mediaType || "",
        createdAt: meta.createdAt || new Date().toISOString(),
        blobUrl: meta.blobUrl || "",
        at: Date.now(),
      },
    ];
  }, []);

  const takeSendRequest = useCallback((ackData = {}) => {
    const activeLeadId = leadRef.current?.id
      ? String(leadRef.current.id)
      : "";
    const result = takePendingForAck(
      sendRequestsRef.current,
      ackData,
      activeLeadId,
    );
    sendRequestsRef.current = result.queue;
    return result.pending;
  }, []);

  const clearDeliveryWatchdog = useCallback((messageId) => {
    const key = messageId ? String(messageId) : "";
    if (!key) return;
    const timer = deliveryWatchdogsRef.current.get(key);
    if (timer) clearTimeout(timer);
    deliveryWatchdogsRef.current.delete(key);
  }, []);

  const scheduleDeliveryWatchdog = useCallback(
    (message) => {
      const messageId = message?.id ? String(message.id) : "";
      const targetLeadId = message?.lead_id
        ? String(message.lead_id)
        : String(leadRef.current?.id || "");
      if (!messageId || !targetLeadId || message?.status !== "pending") return;

      clearDeliveryWatchdog(messageId);
      const timer = window.setTimeout(async () => {
        deliveryWatchdogsRef.current.delete(messageId);
        if (
          !mountedRef.current ||
          String(leadRef.current?.id || "") !== targetLeadId
        ) {
          return;
        }

        let history = [];
        try {
          const result = await listLeadMessages(targetLeadId);
          history = result.messages || [];
        } catch {
          /* Даже при ошибке REST показываем, что доставка не подтверждена. */
        }
        if (!mountedRef.current) return;
        setMessagesById((prev) =>
          reconcilePendingMessage(prev, history, messageId),
        );
      }, DELIVERY_STATUS_TIMEOUT_MS);
      deliveryWatchdogsRef.current.set(messageId, timer);
    },
    [clearDeliveryWatchdog],
  );

  const onNewMessage = useCallback(
    (data) => {
      const current = leadRef.current;
      if (!current?.id) return;
      // Своё исходящее отправителю по сокету НЕ приходит (контракт бэка).
      // Здесь — входящие и чужие исходящие; upsert строго по data.id.
      const normalized = normalizeChatMessage(data);
      if (!messageBelongsToLead(normalized, current)) return;
      seqRef.current += 1;
      normalized._seq = seqRef.current;
      setMessagesById((prev) => upsertChatMessage(prev, normalized));
      if (normalized.direction === "in") {
        scheduleMarkRead(current.id);
      }
      maybeScrollForMessage(normalized);
    },
    [scheduleMarkRead, maybeScrollForMessage],
  );

  const onStatus = useCallback((data) => {
    const current = leadRef.current;
    if (!current?.id) return;
    const leadIdFromEvent = data?.lead_id || data?.lead;
    if (
      leadIdFromEvent &&
      String(leadIdFromEvent) !== String(current.id)
    ) {
      return;
    }
    const normalizedStatus = normalizeMessageStatus(data?.status, {
      isOut: true,
    });
    if (normalizedStatus && normalizedStatus !== "pending") {
      clearDeliveryWatchdog(data?.id);
    }
    // Без lead_id — обновляем только если id уже есть в треде
    setMessagesById((prev) => {
      const id = data?.id != null ? String(data.id) : "";
      if (leadIdFromEvent || (id && prev.has(id))) {
        return applyChatMessageStatus(prev, data);
      }
      return prev;
    });
  }, [clearDeliveryWatchdog]);

  const onSendAck = useCallback(
    (msg) => {
      const ok = String(msg?.status || "").toLowerCase() === "success";
      const data = msg?.data || {};
      const currentLeadId = leadRef.current?.id
        ? String(leadRef.current.id)
        : "";
      const ackLeadId = data.lead_id || data.lead;
      if (
        ackLeadId &&
        currentLeadId &&
        String(ackLeadId) !== currentLeadId
      ) {
        return;
      }
      const taken = takeSendRequest(data);

      if (!ok) {
        if (!taken) return;
        if (taken.tempId) {
          setMessagesById((prev) => markMessageError(prev, taken.tempId));
        }
        if (taken.blobUrl) URL.revokeObjectURL(taken.blobUrl);
        onErrorRef.current?.(
          msg?.detail ||
            msg?.error ||
            data?.detail ||
            "Не удалось отправить сообщение.",
        );
        if (!sendRequestsRef.current.length) setSending(false);
        return;
      }

      // Успешный ack без lead_id принимаем только при наличии локальной отправки.
      if (!ackLeadId && !taken) return;

      // Optimistic local-* → серверный id (контракт: пузырь из ack).
      const confirmed = normalizeChatMessage(data, {
        lead_id: currentLeadId,
        direction: "out",
        status: data.status || "pending",
        text: taken?.text || data.text || "",
        media_url: data.media_url || data.content_uri || taken?.mediaUrl || "",
        created_at: taken?.createdAt,
      });
      if (!confirmed.id) {
        if (taken?.tempId) {
          setMessagesById((prev) => markMessageError(prev, taken.tempId));
        }
        onErrorRef.current?.(
          "Сервер вернул ack без id сообщения. Обновите историю чата.",
        );
        if (!sendRequestsRef.current.length) setSending(false);
        return;
      }
      if (!confirmed.media_type && taken?.mediaType) {
        confirmed.media_type = taken.mediaType;
      }
      if (data.message_id) confirmed.message_id = String(data.message_id);

      setMessagesById((prev) =>
        confirmOptimisticMessage(prev, taken?.tempId, confirmed),
      );
      if (taken?.blobUrl) URL.revokeObjectURL(taken.blobUrl);
      onMessageUpsertRef.current?.(confirmed);
      scheduleDeliveryWatchdog(confirmed);
      if (!sendRequestsRef.current.length) setSending(false);
      maybeScrollForMessage(confirmed, { force: true });
    },
    [scheduleDeliveryWatchdog, maybeScrollForMessage, takeSendRequest],
  );

  const { isConnected: wsConnected, sendMessage: sendViaWs } =
    useWazzupChatSocket({
      enabled: !!lead?.id,
      onNewMessage,
      onStatus,
      onSendAck,
    });

  // Реконнект сокета: догрузить историю REST (§6), upsert по id
  const wsEverConnectedRef = useRef(false);
  const hadWsDisconnectRef = useRef(false);
  useEffect(() => {
    wsEverConnectedRef.current = false;
    hadWsDisconnectRef.current = false;
  }, [leadId]);
  useEffect(() => {
    if (!leadId) return;
    if (!wsConnected) {
      if (wsEverConnectedRef.current) hadWsDisconnectRef.current = true;
      return;
    }
    wsEverConnectedRef.current = true;
    if (!hadWsDisconnectRef.current) return;
    hadWsDisconnectRef.current = false;
    loadMessages({ merge: true, silent: true });
  }, [wsConnected, leadId, loadMessages]);

  const selected = useMemo(
    () => accounts.find((a) => String(a.id) === String(accountId)),
    [accounts, accountId],
  );

  const selectedMediaType = mediaFile
    ? resolveMediaTypeFromFile(mediaFile)
    : mediaUrl.trim()
      ? resolveMediaType({}, mediaUrl.trim())
      : "";

  /** Нет ack за 15с — помечаем optimistic-пузырь error. */
  const finishPendingTimeout = (tempId, blobUrl) => {
    window.setTimeout(() => {
      const still = sendRequestsRef.current.some((p) => p.tempId === tempId);
      if (!still) return;
      const row = sendRequestsRef.current.find((p) => p.tempId === tempId);
      sendRequestsRef.current = sendRequestsRef.current.filter(
        (p) => p.tempId !== tempId,
      );
      setMessagesById((prev) => markMessageError(prev, tempId));
      if (blobUrl || row?.blobUrl) {
        URL.revokeObjectURL(blobUrl || row.blobUrl);
      }
      if (!sendRequestsRef.current.length) setSending(false);
      onErrorRef.current?.(
        "Нет подтверждения отправки. Проверьте соединение и попробуйте снова.",
      );
    }, 15000);
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    const text = message.trim();
    const link = mediaUrl.trim();
    const file = mediaFile;

    if (!text && !link && !file) return;

    const canSendOffline = !!accountId;
    if (!wsConnected && !canSendOffline && !file) {
      onErrorRef.current?.(
        "Нет соединения. Выберите канал Wazzup или дождитесь live.",
      );
      return;
    }

    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let media = link;
    let mediaType = media
      ? resolveMediaType({}, media)
      : file
        ? resolveMediaTypeFromFile(file)
        : "";
    const createdAt = new Date().toISOString();
    const blobUrl = file ? URL.createObjectURL(file) : "";

    // Мгновенный пузырь (как WhatsApp) — потом confirmOptimistic по ack/REST.
    seqRef.current += 1;
    const optimistic = {
      id: tempId,
      text,
      media_url: blobUrl || media,
      media_type: mediaType,
      direction: "out",
      status: "pending",
      created_at: createdAt,
      lead_id: lead.id,
      optimistic: true,
      _seq: seqRef.current,
    };
    setMessagesById((prev) => upsertChatMessage(prev, optimistic));
    onMessageUpsertRef.current?.(optimistic);
    setMessage("");
    setMediaUrl("");
    setShowMediaLink(false);
    clearMediaFile();
    maybeScrollForMessage(optimistic, { force: true });

    const failOptimistic = (errMsg) => {
      setMessagesById((prev) => markMessageError(prev, tempId));
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      onErrorRef.current?.(errMsg);
      setSending(false);
    };

    const confirmFromServer = (raw, extras = {}) => {
      const confirmed = normalizeChatMessage(raw, {
        lead_id: lead.id,
        direction: "out",
        status: raw?.status || "pending",
        text: extras.text ?? text,
        media_url: extras.mediaUrl ?? media,
        created_at: extras.createdAt ?? createdAt,
      });
      if (!confirmed.id) {
        throw {
          detail:
            "Сервер не вернул id сообщения. Обновите историю чата.",
        };
      }
      if (!confirmed.media_type && (extras.mediaType || mediaType)) {
        confirmed.media_type = extras.mediaType || mediaType;
      }
      if (raw?.message_id) confirmed.message_id = String(raw.message_id);
      setMessagesById((prev) =>
        confirmOptimisticMessage(prev, tempId, confirmed),
      );
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      onMessageUpsertRef.current?.(confirmed);
      scheduleDeliveryWatchdog(confirmed);
      maybeScrollForMessage(confirmed, { force: true });
      return confirmed;
    };

    if (file) {
      setSending(true);
      try {
        const uploaded = await uploadConsultingChatMedia(file, {
          accountId: accountId || undefined,
        });
        media = uploaded.url;
        mediaType = uploaded.media_type || mediaType;
        setMessagesById((prev) =>
          upsertChatMessage(prev, {
            ...optimistic,
            media_url: media,
            media_type: mediaType,
          }),
        );
      } catch (uploadErr) {
        if (
          uploadErr?.notReady ||
          uploadErr?.status === 404 ||
          uploadErr?.status === 501
        ) {
          if (!accountId) {
            failOptimistic(
              "Загрузка файлов ещё не подключена. Выберите канал или отправьте по ссылке.",
            );
            return;
          }
          try {
            const data = await sendWazzupMessageWithFile(accountId, {
              lead_id: lead.id,
              message: text,
              file,
            });
            confirmFromServer(data?.data || data, { mediaType });
            setSending(false);
            return;
          } catch (multipartErr) {
            failOptimistic(
              errText(
                multipartErr,
                errText(
                  uploadErr,
                  "Не удалось отправить файл. Попробуйте ссылку.",
                ),
              ),
            );
            return;
          }
        }
        failOptimistic(errText(uploadErr, "Не удалось загрузить файл."));
        return;
      }
    }

    if (!wsConnected) {
      if (!accountId) {
        failOptimistic(
          "WebSocket offline и не выбран канал Wazzup.",
        );
        return;
      }
      setSending(true);
      try {
        const data = await sendWazzupMessage(accountId, {
          lead_id: lead.id,
          message: text,
          content_uri: media || undefined,
          media_url: media || undefined,
        });
        confirmFromServer(data?.data || data, {
          mediaUrl: media,
          mediaType,
        });
        setSending(false);
      } catch (restErr) {
        failOptimistic(errText(restErr, "Не удалось отправить сообщение."));
      }
      return;
    }

    enqueueSendRequest(tempId, text, {
      mediaUrl: media || blobUrl,
      mediaType,
      createdAt,
      blobUrl,
    });
    const ok = sendViaWs({
      lead_id: lead.id,
      text: text || (media || blobUrl ? " " : ""),
      media_url: media || undefined,
      content_uri: media || undefined,
      account_id: accountId || undefined,
    });
    if (!ok) {
      sendRequestsRef.current = sendRequestsRef.current.filter(
        (p) => p.tempId !== tempId,
      );
      failOptimistic("Сокет закрылся — сообщение не отправлено.");
      return;
    }

    setSending(false);
    finishPendingTimeout(tempId, blobUrl);
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) submit(e);
    }
  };

  if (loading) {
    return <div className="funnel__hint">Загрузка чата…</div>;
  }

  if (notReadyAccounts) {
    return (
      <div className="funnel__messengerNotice">
        <b>Каналы мессенджеров ещё не готовы.</b>
        <p>
          Интеграция настраивается администратором в фоне. Если чат не
          открывается — обратитесь к администратору NurCRM.
        </p>
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="funnel__messengerNotice">
        <b>Нет активных каналов Wazzup.</b>
        <p>
          Каналы подключаются автоматически. Попросите администратора проверить
          настройки компании — вам ничего вводить не нужно.
        </p>
      </div>
    );
  }

  return (
    <div className="funnel__chat">
      <header className="funnel__chatHead">
        <div className="funnel__chatPeer">
          <span className="funnel__chatAvatar" aria-hidden>
            {(lead.full_name || lead.title || "?").trim().charAt(0).toUpperCase()}
          </span>
          <div className="funnel__chatPeerText">
            <div className="funnel__chatPeerName">
              {lead.full_name || lead.title || "Клиент"}
            </div>
            <div className="funnel__chatPeerMeta">
              <SourceIcon type={lead.source || selected?.integration_type} />
              <span>
                {leadSourceLabel(lead.source || selected?.integration_type)}
                {lead.phone ? ` · ${lead.phone}` : ""}
              </span>
              <span
                className={
                  wsConnected
                    ? "funnel__chatWs funnel__chatWs--on"
                    : "funnel__chatWs"
                }
                title={wsConnected ? "В сети" : "Офлайн — REST-отправка"}
              >
                {wsConnected ? "online" : "offline"}
              </span>
            </div>
          </div>
        </div>
        {accounts.length > 1 && (
          <select
            className="funnel__select funnel__select--inline"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Канал отправки"
            title="Канал отправки"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.integration_type_display ||
                  leadSourceLabel(a.integration_type)}
                {a.is_connected ? " ✓" : ""}
              </option>
            ))}
          </select>
        )}
      </header>

      {historyNotReady && (
        <p className="funnel__chatBanner">
          История подгрузится позже — live-сообщения уже работают.
        </p>
      )}

      <div
        className="funnel__chatBody"
        role="log"
        aria-live="polite"
        ref={bodyRef}
        onScroll={onBodyScroll}
      >
        {loadingMsgs && !messages.length ? (
          <div className="funnel__chatEmpty">Загрузка…</div>
        ) : !messages.length ? (
          <div className="funnel__chatEmpty">
            Начните диалог — сообщение появится сразу.
          </div>
        ) : (
          messages.map((m) => {
            const text = bubbleText(m);
            return (
              <div
                key={m.id}
                className={`funnel__chatBubble funnel__chatBubble--${m.direction}${
                  m.optimistic ? " funnel__chatBubble--optimistic" : ""
                }`}
              >
                {!!text && <div className="funnel__chatText">{text}</div>}
                {!!m.media_url && (
                  <ChatMessageMedia
                    url={m.media_url}
                    mediaType={m.media_type}
                  />
                )}
                <div className="funnel__chatMeta">
                  <span>{fmtTime(m.created_at)}</span>
                  {m.direction === "out" && <StatusTicks status={m.status} />}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <p className="funnel__hint funnel__hint--lock" style={{ margin: "8px 0 0" }}>
          Отправка недоступна.
        </p>
      ) : (
        <form className="funnel__chatComposer" onSubmit={submit}>
          <input
            ref={fileInputRef}
            type="file"
            className="funnel__chatFileInput"
            accept={CHAT_MEDIA_ACCEPT}
            onChange={onPickFile}
            tabIndex={-1}
            aria-hidden
          />
          {mediaFile && (
            <div className="funnel__chatAttach">
              <span className="funnel__chatAttachName" title={mediaFile.name}>
                {mediaTypeLabel(selectedMediaType) || "Файл"} {mediaFile.name}
                <span className="funnel__chatAttachSize">
                  {" "}
                  · {formatFileSize(mediaFile.size)}
                </span>
              </span>
              <button
                type="button"
                className="funnel__btn funnel__btn--icon"
                onClick={clearMediaFile}
                title="Убрать файл"
                aria-label="Убрать файл"
              >
                <FaTimes />
              </button>
            </div>
          )}
          {showMediaLink && !mediaFile && (
            <input
              className="funnel__input"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Публичная ссылка на файл"
            />
          )}
          <div className="funnel__chatComposerRow">
            <button
              type="button"
              className="funnel__btn funnel__btn--icon"
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить файл"
              disabled={sending}
            >
              <FaPaperclip />
            </button>
            <button
              type="button"
              className={`funnel__btn funnel__btn--icon${showMediaLink ? " is-active" : ""}`}
              onClick={() => {
                setShowMediaLink((v) => !v);
                if (!showMediaLink) clearMediaFile();
              }}
              title="Ссылка на файл"
              disabled={sending}
            >
              <FaLink />
            </button>
            <textarea
              className="funnel__input funnel__chatInput"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Сообщение"
              autoComplete="off"
              rows={1}
            />
            <button
              type="submit"
              className="funnel__btn funnel__btn--primary funnel__btn--icon"
              disabled={
                sending || (!message.trim() && !mediaUrl.trim() && !mediaFile)
              }
              title="Отправить"
            >
              <FaPaperPlane />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
