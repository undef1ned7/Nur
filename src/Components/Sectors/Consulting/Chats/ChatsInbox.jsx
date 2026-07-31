import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  FaArrowLeft,
  FaCog,
  FaExternalLinkAlt,
  FaInstagram,
  FaSearch,
  FaTelegram,
  FaWhatsapp,
} from "react-icons/fa";
import {
  getConsultingLead,
  listWazzupChats,
  messageBelongsToLead,
  normalizeChatMessage,
  normalizePhone,
} from "../../../../api/consultingWazzup";
import { claimLead } from "../../../../store/creators/funnelThunk";
import { useWazzupChatSocket } from "../../../../hooks/useWazzupChatSocket";
import {
  consultingFunnelLeadPath,
  consultingLeadsIntegrationPath,
  isConsultingChatRealtimeEvent,
  leadSourceLabel,
} from "../../../../utils/consultingLeadSources";
import {
  canEditLead,
  resolveCurrentUserId,
  resolveEntityId,
} from "../../../../utils/consultingFunnelLeadUtils";
import { useUser } from "../../../../store/slices/userSlice";
import {
  ensurePushPermission,
  useConsultingRealtime,
} from "../common/useConsultingRealtime";
import LeadMessengerPanel from "../Funnel/LeadMessengerPanel";
import "../Funnel/Funnel.scss";
import "./chats.scss";

const CHANNEL_META = {
  whatsapp: { title: "WhatsApp", Icon: FaWhatsapp, tone: "wa", available: true },
  telegram: {
    title: "Telegram",
    Icon: FaTelegram,
    tone: "tg",
    available: false,
  },
  instagram: {
    title: "Instagram",
    Icon: FaInstagram,
    tone: "ig",
    available: false,
  },
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
};

/** Не затирать локальный unread/preview устаревшим ответом API. */
function mergeChatThreads(prev, next, openLeadId) {
  const prevById = new Map(
    (prev || []).map((t) => [String(t.lead_id || t.id), t]),
  );
  return (next || []).map((row) => {
    const id = String(row.lead_id || row.id);
    const old = prevById.get(id);
    if (openLeadId && id === String(openLeadId)) {
      return { ...row, unread_count: 0, has_unread: false };
    }
    if (!old) return row;

    const oldT = new Date(old.last_message_at || 0).getTime();
    const newT = new Date(row.last_message_at || 0).getTime();
    const oldUnread = Number(old.unread_count) || 0;
    const newUnread = Number(row.unread_count) || 0;

    if (oldT > newT) {
      return {
        ...row,
        last_message: old.last_message || row.last_message,
        last_message_at: old.last_message_at,
        unread_count: Math.max(oldUnread, newUnread),
        has_unread: Math.max(oldUnread, newUnread) > 0,
      };
    }
    if (oldT === newT && oldUnread > newUnread) {
      return {
        ...row,
        unread_count: oldUnread,
        has_unread: oldUnread > 0,
      };
    }
    return row;
  });
}

/**
 * Inbox канала: список чатов слева, диалог справа.
 * /crm/consulting/chats/:channel[/:leadId]
 */
export default function ChatsInbox() {
  const { channel: channelParam, leadId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { profile, userId: storeUserId } = useUser();
  const channel = String(channelParam || "whatsapp").toLowerCase();
  const meta = CHANNEL_META[channel] || CHANNEL_META.whatsapp;
  const Icon = meta.Icon;
  const channelAvailable = meta.available !== false;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const [apiLead, setApiLead] = useState(null);
  const [leadLoading, setLeadLoading] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0);
  const leadIdRef = useRef(leadId);
  useEffect(() => {
    leadIdRef.current = leadId;
  }, [leadId]);

  const threadLead = useMemo(() => {
    if (!leadId) return null;
    const fromList = threads.find(
      (t) => String(t.lead_id || t.id) === String(leadId),
    );
    if (!fromList) return null;
    return {
      id: fromList.lead_id || fromList.id,
      full_name: fromList.full_name,
      phone: fromList.phone,
      source: fromList.source || channel,
      title: fromList.full_name,
      message: fromList.last_message,
    };
  }, [leadId, threads, channel]);

  const loadThreads = useCallback(async ({ silent = false } = {}) => {
    if (CHANNEL_META[channel]?.available === false) {
      setThreads([]);
      setLoading(false);
      setNotReady(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setErr("");
      setNotReady(false);
    }
    try {
      const { threads: rows, notReady: nr } = await listWazzupChats(channel);
      setThreads((prev) =>
        silent
          ? mergeChatThreads(prev, rows, leadIdRef.current)
          : rows,
      );
      setNotReady(!!nr && !rows.length);
    } catch (e) {
      if (!silent) {
        setErr(
          typeof e?.detail === "string"
            ? e.detail
            : "Не удалось загрузить список чатов.",
        );
        setThreads([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    startTransition(() => {
      loadThreads();
    });
  }, [loadThreads]);

  useEffect(() => {
    ensurePushPermission();
  }, []);

  /**
   * Уведомление — резервный сигнал синхронизации на случай, если чатовый WS
   * потерял событие. Сверка тихая: существующий UI не очищается, сообщения
   * в открытом диалоге сливаются по id.
   */
  const onChatSignal = useCallback(
    (n) => {
      const t = String(n?.type || n?.event || n?.notification_type || "").toLowerCase();
      const isMessage =
        t.includes("message") ||
        t.includes("lead_message") ||
        t.includes("new_message");
      startTransition(() => {
        loadThreads({ silent: true });
        if (isMessage) {
          setHistoryRefreshSignal((value) => value + 1);
        }
      });
    },
    [loadThreads],
  );

  useConsultingRealtime({
    match: isConsultingChatRealtimeEvent,
    onSignal: onChatSignal,
    desktopPush: false,
  });

  /** Подъём чата наверх + preview/unread по WS new_message */
  const onInboxNewMessage = useCallback(
    (data) => {
      const msg = normalizeChatMessage(data);
      const openId = leadIdRef.current ? String(leadIdRef.current) : "";

      setThreads((prev) => {
        const findIdx = (rows) => {
          let i = rows.findIndex((t) =>
            messageBelongsToLead(msg, {
              id: t.lead_id || t.id,
              phone: t.phone || t.chat_id,
            }),
          );
          if (i < 0 && msg.lead_id) {
            i = rows.findIndex(
              (t) => String(t.lead_id || t.id) === String(msg.lead_id),
            );
          }
          if (i < 0 && msg.chat_id) {
            const phone = normalizePhone(msg.chat_id);
            i = rows.findIndex((t) => {
              const tp = normalizePhone(t.phone || t.chat_id);
              return (
                tp &&
                phone &&
                (tp === phone || tp.endsWith(phone) || phone.endsWith(tp))
              );
            });
          }
          return i;
        };

        const rows = [...prev];
        const i = findIdx(rows);
        if (i < 0) {
          startTransition(() => loadThreads({ silent: true }));
          return prev;
        }

        const cur = rows[i];
        const threadId = String(cur.lead_id || cur.id);
        const isOpen =
          !!openId &&
          (threadId === openId ||
            (msg.lead_id && String(msg.lead_id) === openId));
        const bumpUnread = msg.direction === "in" && !isOpen;
        const nextUnread = bumpUnread
          ? (Number(cur.unread_count) || 0) + 1
          : isOpen
            ? 0
            : Number(cur.unread_count) || 0;

        const updated = {
          ...cur,
          // text уже содержит плейсхолдер медиа из normalizeChatMessage
          last_message: msg.text || cur.last_message,
          last_message_at: msg.created_at || cur.last_message_at,
          unread_count: nextUnread,
          has_unread: nextUnread > 0,
        };
        rows.splice(i, 1);
        return [updated, ...rows];
      });
    },
    [loadThreads],
  );

  useWazzupChatSocket({
    enabled: true,
    onNewMessage: onInboxNewMessage,
  });

  useEffect(() => {
    if (!leadId) return undefined;
    let cancelled = false;
    (async () => {
      startTransition(() => setLeadLoading(true));
      try {
        const data = await getConsultingLead(leadId);
        if (cancelled) return;
        setApiLead({
          ...data,
          source: data.source || channel,
        });
      } catch {
        if (cancelled) return;
        // fallback: threadLead из списка или минимальный объект
        setApiLead((prev) => {
          if (prev && String(prev.id) === String(leadId)) return prev;
          return {
            id: leadId,
            full_name: "Чат",
            phone: "",
            source: channel,
          };
        });
      } finally {
        if (!cancelled) setLeadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, channel]);

  // Стабильный lead для панели: preview из списка не должен менять identity
  // и провоцировать перезагрузку истории.
  const lead = useMemo(() => {
    if (!leadId) return null;
    const fromApi =
      apiLead && String(apiLead.id) === String(leadId) ? apiLead : null;
    const base =
      fromApi && fromApi.full_name !== "Чат"
        ? fromApi
        : threadLead || fromApi;
    if (!base) return null;
    return {
      ...fromApi,
      id: base.id || base.lead_id || leadId,
      full_name: base.full_name || "Чат",
      phone: base.phone || "",
      source: base.source || channel,
      title: base.title || base.full_name,
      message: base.message || base.first_message || "",
      first_message: base.first_message || "",
      created_at: base.created_at,
      owner: resolveEntityId(fromApi?.owner ?? base.owner) || null,
      owner_display: fromApi?.owner_display ?? base.owner_display,
      stage: fromApi?.stage ?? base.stage,
      status: fromApi?.status ?? base.status,
      is_archived: fromApi?.is_archived ?? base.is_archived,
    };
  }, [
    leadId,
    channel,
    apiLead,
    threadLead,
  ]);

  const userId = resolveCurrentUserId(profile, storeUserId);
  const canTouchChat = lead ? canEditLead(lead, null, profile, userId) : false;
  const inPool = !!(lead && !resolveEntityId(lead.owner));
  const funnelPath = lead?.id ? consultingFunnelLeadPath(lead.id) : null;

  const onClaimChat = useCallback(async () => {
    if (!lead?.id) return;
    setClaimBusy(true);
    setErr("");
    try {
      const data = await dispatch(claimLead(lead.id)).unwrap();
      setApiLead((prev) => ({
        ...(prev || {}),
        ...data,
        id: data?.id || lead.id,
        source: data?.source || lead.source || channel,
      }));
      setNotice("Лид взят в работу.");
    } catch (e) {
      setErr(
        typeof e?.detail === "string"
          ? e.detail
          : "Не удалось взять лид в работу.",
      );
    } finally {
      setClaimBusy(false);
    }
  }, [dispatch, lead, channel]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return threads;
    return threads.filter((t) => {
      const hay = `${t.full_name} ${t.phone} ${t.last_message}`.toLowerCase();
      return hay.includes(s);
    });
  }, [threads, q]);

  const openChat = (thread) => {
    const id = thread.lead_id || thread.id;
    navigate(`/crm/consulting/chats/${channel}/${id}`);
  };

  const handleNotice = useCallback((m) => setNotice(m || ""), []);
  const handleError = useCallback((m) => setErr(m || ""), []);
  const handlePanelMessage = useCallback(
    (message) => onInboxNewMessage(message),
    [onInboxNewMessage],
  );

  if (!channelAvailable) {
    return (
      <section className={`crmInbox crmInbox--${meta.tone}`}>
        <header className="crmInbox__top">
          <Link to="/crm/consulting/chats" className="crmInbox__back">
            <FaArrowLeft /> Чаты
          </Link>
          <div className="crmInbox__brand">
            <Icon className="crmInbox__brandIcon" />
            <div>
              <p className="crmInbox__eyebrow">Консалтинг · Чаты</p>
              <h1 className="crmInbox__title">{meta.title}</h1>
              <p className="crmInbox__sub">Пока не доступно</p>
            </div>
          </div>
        </header>
        <div className="crmInbox__unavailable">
          <Icon />
          <h2>{meta.title} пока не доступен</h2>
          <p>
            Сейчас работают только чаты WhatsApp. Telegram и Instagram появятся
            позже.
          </p>
          <Link to="/crm/consulting/chats/whatsapp" className="crmInbox__goWa">
            Открыть WhatsApp
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`crmInbox crmInbox--${meta.tone}${leadId ? " crmInbox--chatOpen" : ""}`}
    >
      <header className="crmInbox__top">
        <Link to="/crm/consulting/chats" className="crmInbox__back">
          <FaArrowLeft /> Чаты
        </Link>
        <div className="crmInbox__brand">
          <Icon className="crmInbox__brandIcon" />
          <div>
            <p className="crmInbox__eyebrow">Консалтинг · Чаты</p>
            <h1 className="crmInbox__title">{meta.title}</h1>
            <p className="crmInbox__sub">
              {loading ? "Загрузка…" : `${filtered.length} чатов`}
            </p>
          </div>
        </div>
        <nav className="crmInbox__channels" aria-label="Мессенджеры">
          {Object.entries(CHANNEL_META).map(([id, m]) => {
            const I = m.Icon;
            if (m.available === false) {
              return (
                <button
                  key={id}
                  type="button"
                  className="crmInbox__chPill is-disabled"
                  title={`${m.title} пока не доступен`}
                  onClick={() =>
                    setNotice(
                      `${m.title} пока не доступен. Сейчас работают только чаты WhatsApp.`,
                    )
                  }
                >
                  <I />
                </button>
              );
            }
            return (
              <Link
                key={id}
                to={`/crm/consulting/chats/${id}`}
                className={`crmInbox__chPill${channel === id ? " is-active" : ""}`}
                title={m.title}
              >
                <I />
              </Link>
            );
          })}
        </nav>
        <Link
          to={consultingLeadsIntegrationPath()}
          className="crmInbox__settings"
          title="Настройки каналов Wazzup"
        >
          <FaCog /> Настройки каналов
        </Link>
      </header>

      {!!err && <div className="crmInbox__alert">{err}</div>}
      {!!notice && (
        <div className="crmInbox__notice" onClick={() => setNotice("")}>
          {notice}
        </div>
      )}

      <div className="crmInbox__layout">
        <aside className="crmInbox__listPane">
          <div className="crmInbox__search">
            <FaSearch aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск"
            />
          </div>

          {notReady && (
            <div className="crmInbox__emptyHint">
              Диалоги появятся после входящих сообщений.
            </div>
          )}

          <div className="crmInbox__list">
            {loading ? (
              <div className="crmInbox__emptyHint">Загрузка…</div>
            ) : filtered.length ? (
              filtered.map((t) => {
                const active =
                  leadId && String(leadId) === String(t.lead_id || t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`crmInbox__item${active ? " is-active" : ""}`}
                    onClick={() => openChat(t)}
                  >
                    <span className="crmInbox__avatar" aria-hidden>
                      {(t.full_name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="crmInbox__itemBody">
                      <span className="crmInbox__itemRow">
                        <b className="crmInbox__itemName">{t.full_name}</b>
                        <time className="crmInbox__itemTime">
                          {fmtTime(t.last_message_at)}
                        </time>
                      </span>
                      <span className="crmInbox__itemRow">
                        <span className="crmInbox__itemPreview">
                          {t.last_message || t.phone || "Нет сообщений"}
                        </span>
                        {!active && t.unread_count > 0 && (
                          <span className="crmInbox__badge">
                            {t.unread_count > 99 ? "99+" : t.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="crmInbox__emptyHint">
                Пока нет чатов в {meta.title}
              </div>
            )}
          </div>
        </aside>

        <main className="crmInbox__chatPane">
          {!leadId ? (
            <div className="crmInbox__placeholder">
              <Icon />
              <p>Выберите чат</p>
            </div>
          ) : leadLoading && !lead ? (
            <div className="crmInbox__placeholder">
              <p>Открываем…</p>
            </div>
          ) : lead ? (
            <div className="crmInbox__chatWrap">
              <div className="crmInbox__chatBar">
                <button
                  type="button"
                  className="crmInbox__chatBack"
                  onClick={() => navigate(`/crm/consulting/chats/${channel}`)}
                >
                  <FaArrowLeft /> Назад
                </button>
                {funnelPath && (
                  <Link to={funnelPath} className="crmInbox__funnelLink">
                    <FaExternalLinkAlt /> Воронка
                  </Link>
                )}
                {inPool && (
                  <button
                    type="button"
                    className="crmInbox__claimBtn"
                    disabled={claimBusy}
                    onClick={onClaimChat}
                  >
                    {claimBusy ? "…" : "Взять в работу"}
                  </button>
                )}
              </div>
              {canTouchChat ? (
                <LeadMessengerPanel
                  key={lead.id}
                  lead={lead}
                  onNotice={handleNotice}
                  onError={handleError}
                  onMessageUpsert={handlePanelMessage}
                  refreshSignal={historyRefreshSignal}
                />
              ) : (
                <>
                  <LeadMessengerPanel
                    key={lead.id}
                    lead={lead}
                    onNotice={handleNotice}
                    onError={handleError}
                    onMessageUpsert={handlePanelMessage}
                    refreshSignal={historyRefreshSignal}
                    readOnly
                  />
                  <p className="crmInbox__lockHint">
                    {inPool
                      ? "Лид в общем пуле. Нажмите «Взять в работу», чтобы отвечать."
                      : "Чат доступен только назначенному сотруднику или руководителю."}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="crmInbox__placeholder">
              <p>Не удалось открыть чат</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
