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
  sendWazzupMessageWithFile,
  uploadConsultingChatMedia,
} from "../../../../api/consultingWazzup";
import {
  leadSourceLabel,
  WAZZUP_INTEGRATION_TYPES,
} from "../../../../utils/consultingLeadSources";
import { setConsultingActiveChatLead } from "../../../../utils/consultingActiveChat";
import { useWazzupChatSocket } from "../../../../hooks/useWazzupChatSocket";
import { markLeadNotificationsReadAsync } from "../../../../store/creators/notificationCreators";
import ChatMessageMedia from "./ChatMessageMedia";
import {
  applyChatMessageStatus,
  reconcilePendingMessage,
  takePendingForAck,
  upsertChatMessage,
} from "./chatMessageState";

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
 * WhatsApp-чат лида (контракт async Wazzup):
 *  — своё исходящее рисуем из send_message_ack (по сокету себе не приходит)
 *  — upsert строго по data.id
 *  — финальный статус: message_status (pending → sent|failed|delivered|read)
 *  REST история GET /wazzup-messages/?lead=
 */
export default function LeadMessengerPanel({ lead, onNotice, onError, readOnly = false }) {
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
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const markReadTimerRef = useRef(null);
  const deliveryWatchdogsRef = useRef(new Map());
  const mountedRef = useRef(true);
  const leadRef = useRef(lead);
  const onNoticeRef = useRef(onNotice);
  const onErrorRef = useRef(onError);
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

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const loadMessages = useCallback(async ({ merge = false } = {}) => {
    const current = leadRef.current;
    if (!current?.id) return;
    if (!merge) setLoadingMsgs(true);
    try {
      const { messages: rows, notReady } = await listLeadMessages(current.id);
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
      setMessages((prev) => {
        if (!merge || !prev.length) {
          return incoming.reduce((acc, m) => upsertChatMessage(acc, m), []);
        }
        return incoming.reduce((acc, m) => upsertChatMessage(acc, m), prev);
      });
      scrollBottom();
    } catch (e) {
      onErrorRef.current?.(errText(e, "Не удалось загрузить историю чата."));
    } finally {
      if (!merge) setLoadingMsgs(false);
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

  /** Pending WS-отправки: ack сопоставляется внутри активного leadId. */
  const pendingQueueRef = useRef([]);

  // История только при смене лида — не при каждом ререндере родителя / preview.
  useEffect(() => {
    if (!leadId) return;
    startTransition(() => {
      loadMessages();
    });
  }, [leadId, loadMessages]);

  const enqueuePending = useCallback((tempId, text, meta = {}) => {
    const currentLeadId = leadRef.current?.id;
    pendingQueueRef.current = [
      ...pendingQueueRef.current,
      {
        tempId,
        leadId: currentLeadId ? String(currentLeadId) : "",
        text: String(text || "").trim(),
        mediaUrl: meta.mediaUrl || "",
        mediaType: meta.mediaType || "",
        createdAt: meta.createdAt || new Date().toISOString(),
        at: Date.now(),
      },
    ];
  }, []);

  const takePending = useCallback((ackData = {}) => {
    const activeLeadId = leadRef.current?.id
      ? String(leadRef.current.id)
      : "";
    const result = takePendingForAck(
      pendingQueueRef.current,
      ackData,
      activeLeadId,
    );
    pendingQueueRef.current = result.queue;
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
        setMessages((prev) =>
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
      setMessages((prev) => upsertChatMessage(prev, normalized));
      if (normalized.direction === "in") {
        scheduleMarkRead(current.id);
      }
      scrollBottom();
    },
    [scheduleMarkRead, scrollBottom],
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
    setMessages((prev) => {
      const id = data?.id != null ? String(data.id) : "";
      if (
        leadIdFromEvent ||
        prev.some((m) => id && String(m.id) === id)
      ) {
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
      const taken = takePending(data);

      if (!ok) {
        // Ошибка без нашей pending-записи относится к другому/уже закрытому чату.
        if (!taken) return;
        onErrorRef.current?.(
          msg?.detail ||
            msg?.error ||
            data?.detail ||
            "Не удалось отправить сообщение через WebSocket.",
        );
        if (!pendingQueueRef.current.length) setSending(false);
        return;
      }

      // Успешный ack без lead_id принимаем только при наличии локальной отправки.
      if (!ackLeadId && !taken) return;

      // Пузырь исходящего — из ack: id сервера, status обычно "pending",
      // дальше message_status догоняет sent/delivered/read/failed.
      const confirmed = normalizeChatMessage(data, {
        lead_id: currentLeadId,
        direction: "out",
        status: data.status || "pending",
        text: taken?.text || "",
        media_url: taken?.mediaUrl || "",
        created_at: taken?.createdAt,
      });
      if (!confirmed.id) {
        onErrorRef.current?.(
          "Сервер вернул ack без id сообщения. Пузырь не добавлен, чтобы избежать дублей.",
        );
        if (!pendingQueueRef.current.length) setSending(false);
        return;
      }
      if (!confirmed.media_type && taken?.mediaType) {
        confirmed.media_type = taken.mediaType;
      }
      if (data.message_id) confirmed.message_id = String(data.message_id);

      setMessages((prev) => upsertChatMessage(prev, confirmed));
      scheduleDeliveryWatchdog(confirmed);
      if (!pendingQueueRef.current.length) setSending(false);
      scrollBottom();
    },
    [scheduleDeliveryWatchdog, scrollBottom, takePending],
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
    loadMessages({ merge: true });
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

  /** Нет ack за 15с — error (не «sent»: иначе статус врёт до message_status). */
  const finishPendingTimeout = (tempId) => {
    window.setTimeout(() => {
      const still = pendingQueueRef.current.some((p) => p.tempId === tempId);
      if (!still) return;
      pendingQueueRef.current = pendingQueueRef.current.filter(
        (p) => p.tempId !== tempId,
      );
      if (!pendingQueueRef.current.length) setSending(false);
      onErrorRef.current?.(
        "Нет подтверждения отправки (ack). Проверьте соединение и попробуйте снова.",
      );
    }, 15000);
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    const link = mediaUrl.trim();
    const file = mediaFile;

    if (!text && !link && !file) {
      onErrorRef.current?.("Введите текст, выберите файл или укажите ссылку.");
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

    setSending(true);

    // 1) Файл с устройства → upload → публичный URL → WS
    if (file) {
      try {
        const uploaded = await uploadConsultingChatMedia(file, {
          accountId: accountId || undefined,
        });
        media = uploaded.url;
        mediaType = uploaded.media_type || mediaType;
      } catch (uploadErr) {
        // 2) Запасной путь: multipart send-message (если бэк умеет file)
        if (
          uploadErr?.notReady ||
          uploadErr?.status === 404 ||
          uploadErr?.status === 501
        ) {
          if (!accountId) {
            setSending(false);
            onErrorRef.current?.(
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
            const raw = data?.data || data;
            const confirmed = normalizeChatMessage(raw, {
              lead_id: lead.id,
              direction: "out",
              status: raw?.status || "pending",
            });
            if (!confirmed.id) {
              throw {
                detail:
                  "Сервер отправил файл, но не вернул id сообщения. Обновите историю чата.",
              };
            }
            // Не сохраняем blob:-preview: clearMediaFile отзывает этот URL.
            // Серверный content_uri появится в REST-ответе или при refetch истории.
            if (!confirmed.media_type) confirmed.media_type = mediaType;
            setMessages((prev) => upsertChatMessage(prev, confirmed));
            scheduleDeliveryWatchdog(confirmed);
            setSending(false);
            setMessage("");
            clearMediaFile();
            setMediaUrl("");
            setShowMediaLink(false);
            onNoticeRef.current?.("Файл отправлен.");
            scrollBottom();
            return;
          } catch (multipartErr) {
            setSending(false);
            onErrorRef.current?.(
              errText(
                multipartErr,
                errText(
                  uploadErr,
                  "Загрузка файлов ещё не подключена на сервере. Можно отправить по публичной ссылке (🔗).",
                ),
              ),
            );
            return;
          }
        }
        setSending(false);
        onErrorRef.current?.(
          errText(uploadErr, "Не удалось загрузить файл."),
        );
        return;
      }
    }

    // URL / уже загруженный файл — через WebSocket
    if (!wsConnected) {
      setSending(false);
      onErrorRef.current?.(
        "WebSocket /ws/wazzup/ не подключён (offline). Дождитесь live и отправьте снова.",
      );
      return;
    }

    enqueuePending(tempId, text, {
      mediaUrl: media,
      mediaType,
      createdAt,
    });
    const ok = sendViaWs({
      lead_id: lead.id,
      text: text || (media ? " " : ""),
      media_url: media || undefined,
      content_uri: media || undefined,
      account_id: accountId || undefined,
    });
    if (!ok) {
      pendingQueueRef.current = pendingQueueRef.current.filter(
        (p) => p.tempId !== tempId,
      );
      if (!pendingQueueRef.current.length) setSending(false);
      onErrorRef.current?.("Сокет закрылся — сообщение не отправлено.");
      return;
    }

    setMessage("");
    setMediaUrl("");
    setShowMediaLink(false);
    clearMediaFile();
    // Текст можно слать дальше, не дожидаясь ack — очередь pending разрулит галочки
    setSending(false);
    finishPendingTimeout(tempId);
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
          <span className="funnel__chatAvatar">
            <SourceIcon type={lead.source || selected?.integration_type} />
          </span>
          <div>
            <div className="funnel__chatPeerName">
              {lead.full_name || lead.title || "Клиент"}
            </div>
            <div className="funnel__chatPeerMeta">
              {leadSourceLabel(lead.source || selected?.integration_type)}
              {lead.phone ? ` · ${lead.phone}` : ""}
              {" · "}
              <span
                className={
                  wsConnected
                    ? "funnel__chatWs funnel__chatWs--on"
                    : "funnel__chatWs"
                }
                title={
                  wsConnected
                    ? "WebSocket /ws/wazzup/ подключён"
                    : "WebSocket отключён — входящие могут не приходить live"
                }
              >
                {wsConnected ? "live" : "offline"}
              </span>
            </div>
          </div>
        </div>
        <select
          className="funnel__select funnel__select--inline"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          aria-label="Канал Wazzup"
          title="Канал отправки"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.integration_type_display ||
                leadSourceLabel(a.integration_type)}{" "}
              · {a.channel_id || a.id}
              {a.is_connected ? " ✓" : ""}
            </option>
          ))}
        </select>
      </header>

      {!WAZZUP_INTEGRATION_TYPES.some((t) => t.value === preferredType) &&
        preferredType && (
          <p className="funnel__hint" style={{ margin: "0 0 8px" }}>
            Источник лида «{preferredType}» — проверьте выбранный канал.
          </p>
        )}

      {historyNotReady && (
        <p className="funnel__hint" style={{ margin: "0 0 8px" }}>
          История пока недоступна — нужен{" "}
          <code>GET /consalting/wazzup-messages/?lead=…</code>. Отправка и live
          через <code>/ws/wazzup/</code> работают отдельно.
        </p>
      )}

      <div className="funnel__chatBody" role="log" aria-live="polite">
        {loadingMsgs && !messages.length ? (
          <div className="funnel__chatEmpty">Загрузка сообщений…</div>
        ) : !messages.length ? (
          <div className="funnel__chatEmpty">
            Напишите сообщение — оно уйдёт через WebSocket (
            <code>action: send_message</code>). Входящие —{" "}
            <code>new_message</code>.
          </div>
        ) : (
          messages.map((m) => {
            const text = bubbleText(m);
            return (
              <div
                key={m.id}
                className={`funnel__chatBubble funnel__chatBubble--${m.direction}`}
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
              {mediaTypeLabel(selectedMediaType) || "📎"} {mediaFile.name}
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
            placeholder="https://… публичная ссылка на файл"
          />
        )}
        <div className="funnel__chatComposerRow">
          <button
            type="button"
            className="funnel__btn funnel__btn--icon"
            onClick={() => fileInputRef.current?.click()}
            title="Прикрепить фото, видео, аудио или документ"
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
            title="Отправить по ссылке"
            disabled={sending}
          >
            <FaLink />
          </button>
          <input
            className="funnel__input funnel__chatInput"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Сообщение в WhatsApp…"
            autoComplete="off"
          />
          <button
            type="submit"
            className="funnel__btn funnel__btn--primary funnel__btn--icon"
            disabled={
              sending ||
              (!message.trim() && !mediaUrl.trim() && !mediaFile) ||
              (!mediaFile && !wsConnected)
            }
            title={
              mediaFile
                ? "Загрузить и отправить файл"
                : wsConnected
                  ? "Отправить через WebSocket"
                  : "Нужен live WebSocket"
            }
          >
            <FaPaperPlane />
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
