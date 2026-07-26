import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaInstagram,
  FaSearch,
  FaTelegram,
  FaWhatsapp,
} from "react-icons/fa";
import {
  getConsultingLead,
  listWazzupChats,
} from "../../../../api/consultingWazzup";
import {
  isConsultingChatRealtimeEvent,
  leadSourceLabel,
} from "../../../../utils/consultingLeadSources";
import {
  ensurePushPermission,
  useConsultingRealtime,
} from "../common/useConsultingRealtime";
import LeadMessengerPanel from "../Funnel/LeadMessengerPanel";
import "../Funnel/Funnel.scss";
import "./chats.scss";

const CHANNEL_META = {
  whatsapp: { title: "WhatsApp", Icon: FaWhatsapp, tone: "wa" },
  telegram: { title: "Telegram", Icon: FaTelegram, tone: "tg" },
  instagram: { title: "Instagram", Icon: FaInstagram, tone: "ig" },
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

/**
 * Inbox канала: список чатов слева, диалог справа.
 * /crm/consulting/chats/:channel[/:leadId]
 */
export default function ChatsInbox() {
  const { channel: channelParam, leadId } = useParams();
  const navigate = useNavigate();
  const channel = String(channelParam || "whatsapp").toLowerCase();
  const meta = CHANNEL_META[channel] || CHANNEL_META.whatsapp;
  const Icon = meta.Icon;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const [apiLead, setApiLead] = useState(null);
  const [leadLoading, setLeadLoading] = useState(false);

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

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setErr("");
    setNotReady(false);
    try {
      const { threads: rows, notReady: nr } = await listWazzupChats(channel);
      setThreads(rows);
      setNotReady(!!nr && !rows.length);
    } catch (e) {
      setErr(
        typeof e?.detail === "string"
          ? e.detail
          : "Не удалось загрузить список чатов.",
      );
      setThreads([]);
    } finally {
      setLoading(false);
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

  const onChatSignal = useCallback(() => {
    startTransition(() => {
      loadThreads();
    });
  }, [loadThreads]);

  useConsultingRealtime({
    match: isConsultingChatRealtimeEvent,
    onSignal: onChatSignal,
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

  // Пока API грузится — показываем данные из списка чатов
  const lead = useMemo(() => {
    if (!leadId) return null;
    if (apiLead && String(apiLead.id) === String(leadId)) {
      // если это только stub "Чат" и есть thread — предпочитаем thread
      if (apiLead.full_name === "Чат" && threadLead) return threadLead;
      return apiLead;
    }
    return threadLead;
  }, [leadId, apiLead, threadLead]);

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

  return (
    <section className={`crmInbox crmInbox--${meta.tone}`}>
      <header className="crmInbox__top">
        <Link to="/crm/consulting/chats" className="crmInbox__back">
          <FaArrowLeft /> CRM
        </Link>
        <div className="crmInbox__brand">
          <Icon className="crmInbox__brandIcon" />
          <div>
            <h1 className="crmInbox__title">{meta.title}</h1>
            <p className="crmInbox__sub">
              {loading ? "Загрузка…" : `${filtered.length} чатов`}
            </p>
          </div>
        </div>
        <nav className="crmInbox__channels" aria-label="Мессенджеры">
          {Object.entries(CHANNEL_META).map(([id, m]) => {
            const I = m.Icon;
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
              placeholder="Поиск по имени или телефону…"
            />
          </div>

          {notReady && (
            <div className="crmInbox__emptyHint">
              Список чатов с бэка пока пуст или эндпоинт не готов. Диалоги
              появятся из лидов с источником «{leadSourceLabel(channel)}» после
              входящих сообщений Wazzup.
            </div>
          )}

          <div className="crmInbox__list">
            {loading ? (
              <div className="crmInbox__emptyHint">Загрузка чатов…</div>
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
                        {t.unread_count > 0 && (
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
                Чатов пока нет. Когда клиент напишет в {meta.title}, диалог
                появится здесь.
              </div>
            )}
          </div>
        </aside>

        <main className="crmInbox__chatPane">
          {!leadId ? (
            <div className="crmInbox__placeholder">
              <Icon />
              <p>Выберите чат слева, чтобы открыть переписку</p>
            </div>
          ) : leadLoading && !lead ? (
            <div className="crmInbox__placeholder">
              <p>Открываем чат…</p>
            </div>
          ) : lead ? (
            <div className="crmInbox__chatWrap">
              <LeadMessengerPanel
                lead={lead}
                onNotice={(m) => setNotice(m || "")}
                onError={(m) => setErr(m || "")}
              />
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
