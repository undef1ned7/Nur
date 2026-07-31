import { useState } from "react";
import { Link } from "react-router-dom";
import { FaInstagram, FaTelegram, FaWhatsapp } from "react-icons/fa";
import ConsultingShell from "../common/ConsultingShell";
import "./chats.scss";

const CHANNELS = [
  {
    id: "whatsapp",
    title: "WhatsApp",
    hint: "Диалоги клиентов из WhatsApp",
    Icon: FaWhatsapp,
    tone: "wa",
    available: true,
  },
  {
    id: "telegram",
    title: "Telegram",
    hint: "Диалоги из Telegram",
    Icon: FaTelegram,
    tone: "tg",
    available: false,
  },
  {
    id: "instagram",
    title: "Instagram",
    hint: "Диалоги из Instagram Direct",
    Icon: FaInstagram,
    tone: "ig",
    available: false,
  },
];

/**
 * Хаб выбора мессенджера (WA / TG / IG).
 * Primary entry — /crm/consulting/chats/whatsapp; хаб — fallback для TG/IG.
 */
export default function ChatsHub() {
  const [notice, setNotice] = useState("");

  const onUnavailable = (title) => {
    setNotice(`${title} пока не доступен. Сейчас работают только чаты WhatsApp.`);
  };

  return (
    <ConsultingShell
      eyebrow="Консалтинг · Чаты"
      title="Чаты"
      subtitle="Выберите мессенджер — откроется список всех чатов. Можно зайти в любой диалог и ответить клиенту."
    >
      <div className="crmChats crmChats--embedded">
      {!!notice && (
        <div
          className="crmChats__notice"
          role="status"
          onClick={() => setNotice("")}
        >
          {notice}
        </div>
      )}

      <div className="crmChats__grid">
        {CHANNELS.map(({ id, title, hint, Icon, tone, available }) =>
          available ? (
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
          ) : (
            <button
              key={id}
              type="button"
              className={`crmChats__card crmChats__card--${tone} is-unavailable`}
              onClick={() => onUnavailable(title)}
            >
              <span className="crmChats__cardIcon">
                <Icon />
              </span>
              <span className="crmChats__cardTitle">{title}</span>
              <span className="crmChats__cardHint">{hint}</span>
              <span className="crmChats__cardCta crmChats__cardCta--soon">
                Пока не доступно
              </span>
            </button>
          ),
        )}
      </div>

      <p className="crmChats__foot">
        Каналы WhatsApp подключаются администратором.{" "}
        <Link to="/crm/consulting/leads?tab=integration">
          Настройки каналов
        </Link>
        {" — "}просто отвечайте клиентам в чатах.
      </p>
      </div>
    </ConsultingShell>
  );
}
