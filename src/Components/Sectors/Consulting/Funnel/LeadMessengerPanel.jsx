import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useDispatch } from "react-redux";
import {
  FaCheck,
  FaCheckDouble,
  FaExclamationCircle,
  FaInstagram,
  FaPaperclip,
  FaPaperPlane,
  FaTelegram,
  FaWhatsapp,
} from "react-icons/fa";
import {
  listLeadMessages,
  listWazzupAccounts,
  markLeadChatRead,
  messageBelongsToLead,
  normalizeChatMessage,
} from "../../../../api/consultingWazzup";
import {
  leadSourceLabel,
  WAZZUP_INTEGRATION_TYPES,
} from "../../../../utils/consultingLeadSources";
import { setConsultingActiveChatLead } from "../../../../utils/consultingActiveChat";
import { useWazzupChatSocket } from "../../../../hooks/useWazzupChatSocket";
import { markLeadNotificationsReadAsync } from "../../../../store/creators/notificationCreators";

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
  const s = String(status || "").toLowerCase();
  if (s === "error") {
    return (
      <span className="funnel__chatTicks funnel__chatTicks--error" title="Ошибка">
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

function sameMessage(a, b) {
  if (a?.id && b?.id && String(a.id) === String(b.id)) return true;
  if (
    a?.message_id &&
    b?.message_id &&
    String(a.message_id) === String(b.message_id)
  ) {
    return true;
  }
  return false;
}

function upsertMessage(list, msg) {
  const idx = list.findIndex((m) => sameMessage(m, msg));
  if (idx === -1) return [...list, msg].sort(byTime);
  const next = list.slice();
  next[idx] = { ...next[idx], ...msg };
  return next.sort(byTime);
}

function applyStatus(list, data) {
  const mid = data?.message_id || data?.messageId;
  const id = data?.id;
  const status = data?.status;
  if (!status) return list;
  return list.map((m) => {
    const match =
      (mid && m.message_id && String(m.message_id) === String(mid)) ||
      (id && String(m.id) === String(id));
    return match ? { ...m, status: String(status).toLowerCase() } : m;
  });
}

function byTime(a, b) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/**
 * WhatsApp-чат лида по WAZZUP_FRONTEND_DOCUMENTATION:
 *  REST история  GET /wazzup-messages/?lead=
 *  REST отправка POST /wazzup-accounts/{id}/send-message/
 *  WS realtime   wss://…/ws/wazzup/?token=  → new_message | message_status
 */
export default function LeadMessengerPanel({ lead, onNotice, onError }) {
  const dispatch = useDispatch();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReadyAccounts, setNotReadyAccounts] = useState(false);
  const [historyNotReady, setHistoryNotReady] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef(null);
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

  const preferredType = String(lead?.source || "")
    .trim()
    .toLowerCase();
  const leadId = lead?.id ? String(lead.id) : "";

  /**
   * Открыли чат:
   * 1) mark-read → Wazzup unread: 0 (синие ✓✓ у клиента)
   * 2) связанные уведомления в колокольчике → прочитаны
   */
  useEffect(() => {
    if (!leadId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await markLeadChatRead(leadId);
      } catch {
        /* 404/501 — эндпоинт ещё не на проде; UI не блокируем */
      }
      if (cancelled) return;
      dispatch(markLeadNotificationsReadAsync(leadId));
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, dispatch]);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const loadMessages = useCallback(async () => {
    const current = leadRef.current;
    if (!current?.id) return;
    setLoadingMsgs(true);
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
      setMessages(rows.length ? rows.sort(byTime) : seed);
      scrollBottom();
    } catch (e) {
      onErrorRef.current?.(errText(e, "Не удалось загрузить историю чата."));
    } finally {
      setLoadingMsgs(false);
    }
  }, [scrollBottom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listWazzupAccounts();
        if (cancelled) return;
        const rows = asArray(data);
        setAccounts(rows);
        const preferred =
          rows.find(
            (a) =>
              a.is_connected !== false &&
              a.is_active !== false &&
              String(a.integration_type || "").toLowerCase() === preferredType,
          ) ||
          rows.find((a) => a.is_connected && a.is_active !== false) ||
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

  // История только при смене лида — не при каждом ререндере родителя / preview.
  useEffect(() => {
    if (!leadId) return;
    startTransition(() => {
      loadMessages();
    });
  }, [leadId, loadMessages]);
  const onNewMessage = useCallback(
    (data) => {
      const current = leadRef.current;
      if (!current?.id) return;
      const normalized = normalizeChatMessage(data, {
        lead_id: current.id,
      });
      // Явный lead_id / lead — главный критерий; иначе телефон chat_id
      if (!messageBelongsToLead(normalized, current)) return;
      setMessages((prev) => upsertMessage(prev, normalized));
      scrollBottom();
    },
    [scrollBottom],
  );

  const onStatus = useCallback((data) => {
    const current = leadRef.current;
    setMessages((prev) => {
      const mid = data?.message_id || data?.id;
      const inThread = prev.some(
        (m) =>
          (mid &&
            (String(m.message_id) === String(mid) ||
              String(m.id) === String(mid))) ||
          messageBelongsToLead(
            normalizeChatMessage(data, { lead_id: current?.id }),
            current,
          ),
      );
      if (!inThread && data?.chat_id) {
        if (
          !messageBelongsToLead(
            { chat_id: data.chat_id, lead_id: null },
            current,
          )
        ) {
          return prev;
        }
      }
      return applyStatus(prev, data);
    });
  }, []);

  // Подтверждение отправки через сокет (send_message_ack).
  const pendingTempIdRef = useRef(null);
  const onSendAck = useCallback(
    (msg) => {
      const ok = String(msg?.status || "").toLowerCase() === "success";
      const data = msg?.data || {};
      const tempId = pendingTempIdRef.current;
      if (!ok) {
        if (tempId) {
          setMessages((prev) =>
            upsertMessage(prev, {
              id: tempId,
              status: "error",
              direction: "out",
              text: data.text || "",
              created_at: new Date().toISOString(),
            }),
          );
        }
        onErrorRef.current?.(
          msg?.detail ||
            msg?.error ||
            data?.detail ||
            "Не удалось отправить сообщение через WebSocket.",
        );
        pendingTempIdRef.current = null;
        setSending(false);
        return;
      }
      const confirmed = normalizeChatMessage(data, {
        lead_id: lead.id,
        direction: "out",
        status: data.status || "sent",
      });
      if (data.message_id) confirmed.message_id = String(data.message_id);
      setMessages((prev) => {
        let next = prev;
        if (tempId) next = next.filter((m) => m.id !== tempId);
        return upsertMessage(next, confirmed);
      });
      pendingTempIdRef.current = null;
      setSending(false);
      scrollBottom();
      onNoticeRef.current?.("Сообщение отправлено в WhatsApp.");
    },
    [lead.id, scrollBottom],
  );

  const { isConnected: wsConnected, sendMessage: sendViaWs } =
    useWazzupChatSocket({
      enabled: !!lead?.id,
      onNewMessage,
      onStatus,
      onSendAck,
    });

  const selected = useMemo(
    () => accounts.find((a) => String(a.id) === String(accountId)),
    [accounts, accountId],
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim() && !mediaUrl.trim()) {
      onErrorRef.current?.("Введите текст или укажите ссылку на файл.");
      return;
    }
    if (!wsConnected) {
      onErrorRef.current?.(
        "WebSocket /ws/wazzup/ не подключён (offline). Дождитесь live и отправьте снова.",
      );
      return;
    }

    const tempId = `local-${Date.now()}`;
    const text = message.trim();
    const media = mediaUrl.trim();
    const optimistic = normalizeChatMessage(
      {
        id: tempId,
        text,
        media_url: media || undefined,
        direction: "outbound",
        status: "pending",
        created_at: new Date().toISOString(),
      },
      { lead_id: lead.id },
    );
    pendingTempIdRef.current = tempId;
    setMessages((prev) => upsertMessage(prev, optimistic));
    setSending(true);
    scrollBottom();

    const ok = sendViaWs({
      lead_id: lead.id,
      text: text || " ",
      media_url: media || undefined,
    });
    if (!ok) {
      pendingTempIdRef.current = null;
      setMessages((prev) =>
        upsertMessage(prev, { ...optimistic, status: "error" }),
      );
      setSending(false);
      onErrorRef.current?.("Сокет закрылся — сообщение не отправлено.");
      return;
    }

    setMessage("");
    setMediaUrl("");
    setShowMedia(false);

    // Если ack не придёт — снимем «отправку…» через таймаут.
    window.setTimeout(() => {
      if (pendingTempIdRef.current === tempId) {
        pendingTempIdRef.current = null;
        setSending(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId && m.status === "pending"
              ? { ...m, status: "sent" }
              : m,
          ),
        );
      }
    }, 12000);
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
          messages.map((m) => (
            <div
              key={m.id}
              className={`funnel__chatBubble funnel__chatBubble--${m.direction}`}
            >
              {!!m.text && <div className="funnel__chatText">{m.text}</div>}
              {!!m.media_url && (
                <a
                  className="funnel__chatMedia"
                  href={m.media_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaPaperclip /> Файл / медиа
                </a>
              )}
              <div className="funnel__chatMeta">
                <span>{fmtTime(m.created_at)}</span>
                {m.direction === "out" && <StatusTicks status={m.status} />}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form className="funnel__chatComposer" onSubmit={submit}>
        {showMedia && (
          <input
            className="funnel__input"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://… ссылка на файл или изображение"
          />
        )}
        <div className="funnel__chatComposerRow">
          <button
            type="button"
            className="funnel__btn funnel__btn--icon"
            onClick={() => setShowMedia((v) => !v)}
            title="Прикрепить ссылку на медиа"
          >
            <FaPaperclip />
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
              !wsConnected ||
              (!message.trim() && !mediaUrl.trim())
            }
            title={
              wsConnected
                ? "Отправить через WebSocket"
                : "Нужен live WebSocket"
            }
          >
            <FaPaperPlane />
          </button>
        </div>
      </form>
    </div>
  );
}
