import { useCallback, useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaInstagram,
  FaSyncAlt,
  FaTelegram,
  FaWhatsapp,
} from "react-icons/fa";
import { listWazzupAccounts } from "../../../../api/consultingWazzup";
import {
  WAZZUP_INTEGRATION_TYPES,
  leadSourceLabel,
} from "../../../../utils/consultingLeadSources";

const errText = (e, fallback) => {
  if (!e) return fallback;
  if (typeof e.detail === "string") return e.detail;
  if (Array.isArray(e.detail)) return e.detail.join(" ");
  if (typeof e === "string") return e;
  return fallback;
};

const TypeIcon = ({ type }) => {
  const t = String(type || "").toLowerCase();
  if (t === "instagram") return <FaInstagram aria-hidden />;
  if (t === "telegram") return <FaTelegram aria-hidden />;
  return <FaWhatsapp aria-hidden />;
};

function statusOf(a) {
  if (a?.is_active === false) return { key: "off", label: "Выключен" };
  if (a?.is_connected) return { key: "ok", label: "Подключён" };
  return { key: "wait", label: "Ожидает" };
}

/**
 * Статус каналов Wazzup (только чтение).
 * Ключи и webhook настраивает админ в Django Admin — пользователь CRM ничего
 * не вводит. Данные: GET /consalting/wazzup/credentials/
 */
export default function WazzupAccountsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setErr("");
    setNotReady(false);
    try {
      const rows = await listWazzupAccounts();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) {
        setNotReady(true);
        setItems([]);
      } else {
        setErr(errText(e, "Не удалось загрузить статус каналов."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const byType = WAZZUP_INTEGRATION_TYPES.map((meta) => {
    const account = items.find(
      (a) => String(a.integration_type || "").toLowerCase() === meta.value,
    );
    return { ...meta, account };
  });

  return (
    <div className="leads__settings">
      <div className="leads__settingsCard">
        <div className="leads__settingsTitleRow">
          <div className="leads__settingsTitle">Каналы мессенджеров</div>
          <button
            type="button"
            className="leads__btn leads__btn--ghost"
            onClick={fetchAccounts}
            disabled={loading}
            title="Обновить статус"
          >
            <FaSyncAlt /> {loading ? "Обновление…" : "Обновить"}
          </button>
        </div>
        <p className="leads__muted">
          Подключение выполняется автоматически: администратор настраивает
          каналы в системе, вам ничего вводить не нужно. Здесь только статус.
        </p>
      </div>

      {notReady && (
        <div className="leads__notice">
          <FaExclamationTriangle className="leads__noticeIcon" />
          <div>
            <b>Каналы ещё не настроены на сервере.</b>
            <p>
              Обратитесь к администратору NurCRM — интеграция Wazzup
              подключается в админ-панели, без действий со стороны менеджера.
            </p>
          </div>
        </div>
      )}

      {!!err && <div className="leads__alert">{err}</div>}

      {!notReady && (
        <div className="leads__channelStatusGrid">
          {byType.map(({ value, label, color, account }) => {
            const st = account
              ? statusOf(account)
              : { key: "none", label: "Не подключён" };
            return (
              <div
                key={value}
                className={`leads__channelStatus leads__channelStatus--${st.key}`}
                style={{ "--ch-color": color }}
              >
                <div className="leads__channelStatusIcon">
                  <TypeIcon type={value} />
                </div>
                <div className="leads__channelStatusBody">
                  <b>{label}</b>
                  <span className="leads__channelStatusBadge">{st.label}</span>
                  {account?.is_connected && (
                    <span className="leads__channelStatusOk">
                      <FaCheckCircle /> Работает в фоне
                    </span>
                  )}
                  {!account && (
                    <span className="leads__muted">
                      Появится после настройки администратором
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!notReady && !loading && items.length > 0 && (
        <div className="leads__settingsCard" style={{ marginTop: 16 }}>
          <div className="leads__settingsTitle">Активные каналы</div>
          <ul className="leads__channelList">
            {items.map((a) => {
              const st = statusOf(a);
              return (
                <li key={a.id} className="leads__channelListItem">
                  <TypeIcon type={a.integration_type} />
                  <span>
                    {a.integration_type_display ||
                      leadSourceLabel(a.integration_type)}
                  </span>
                  <span className={`leads__pill leads__pill--${st.key}`}>
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
