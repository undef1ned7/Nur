import { Link } from "react-router-dom";
import { FaInstagram, FaTelegram, FaWhatsapp, FaComments } from "react-icons/fa";
import "./chats.scss";

const CHANNELS = [
  {
    id: "whatsapp",
    title: "WhatsApp",
    hint: "Диалоги клиентов из WhatsApp",
    Icon: FaWhatsapp,
    tone: "wa",
  },
  {
    id: "telegram",
    title: "Telegram",
    hint: "Диалоги из Telegram",
    Icon: FaTelegram,
    tone: "tg",
  },
  {
    id: "instagram",
    title: "Instagram",
    hint: "Диалоги из Instagram Direct",
    Icon: FaInstagram,
    tone: "ig",
  },
];

/**
 * CRM — хаб выбора мессенджера (WA / TG / IG).
 * Дальше: /crm/consulting/chats/:channel
 */
export default function ChatsHub() {
  return (
    <section className="crmChats">
      <header className="crmChats__hero">
        <div className="crmChats__heroIcon" aria-hidden>
          <FaComments />
        </div>
        <div>
          <h1 className="crmChats__title">CRM</h1>
          <p className="crmChats__subtitle">
            Выберите мессенджер — откроется список всех чатов. Можно зайти в
            любой диалог и ответить клиенту.
          </p>
        </div>
      </header>

      <div className="crmChats__grid">
        {CHANNELS.map(({ id, title, hint, Icon, tone }) => (
          <Link
            key={id}
            to={`/crm/consulting/chats/${id}`}
            className={`crmChats__card crmChats__card--${tone}`}
          >
            <span className="crmChats__cardIcon">
              <Icon />
            </span>
            <span className="crmChats__cardTitle">{title}</span>
            <span className="crmChats__cardHint">{hint}</span>
            <span className="crmChats__cardCta">Открыть чаты →</span>
          </Link>
        ))}
      </div>

      <p className="crmChats__foot">
        Каналы подключаются в{" "}
        <Link to="/crm/consulting/leads">Лиды → Интеграция</Link> (Wazzup API Key
        + Channel ID + webhook).
      </p>
    </section>
  );
}
