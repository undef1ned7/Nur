import { useCallback, useEffect, useState } from "react";
import {
  FaLink,
  FaPlus,
  FaSyncAlt,
  FaTimes,
  FaTrash,
  FaCloudDownloadAlt,
} from "react-icons/fa";
import {
  createWazzupAccount,
  deleteWazzupAccount,
  getDefaultWazzupWebhookUrl,
  listWazzupAccounts,
  setupWazzupWebhook,
} from "../../../../api/consultingWazzup";
import {
  WAZZUP_INTEGRATION_TYPES,
  leadSourceLabel,
} from "../../../../utils/consultingLeadSources";

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const errText = (e, fallback) => {
  if (!e) return fallback;
  if (typeof e.detail === "string") return e.detail;
  if (Array.isArray(e.detail)) return e.detail.join(" ");
  if (typeof e === "string") return e;
  const first = Object.values(e).find(
    (v) => typeof v === "string" || Array.isArray(v),
  );
  if (typeof first === "string") return first;
  if (Array.isArray(first)) return first.join(" ");
  return fallback;
};

/** Wazzup transport → наш integration_type. */
function transportToIntegrationType(transport) {
  const t = String(transport || "").toLowerCase();
  if (t.includes("instagram") || t === "ig") return "instagram";
  if (t.includes("telegram") || t === "tg" || t === "max") return "telegram";
  return "whatsapp";
}

function accountStatusLabel(a) {
  // Поля из GET /consalting/wazzup-accounts/: is_connected, is_active
  if (a?.is_active === false) return "off";
  if (a?.is_connected === true) return "is_connected";
  if (a?.webhook_configured || a?.is_webhook_set) return "is_connected";
  return "saved";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ru-RU");
}

function typeLabel(a) {
  return (
    a?.integration_type_display ||
    leadSourceLabel(a?.integration_type || "whatsapp")
  );
}

/**
 * Вкладка «Интеграция Wazzup» (модуль Консалтинг).
 *
 * Шаг 1: POST /consalting/wazzup-accounts/  { api_key, channel_id, integration_type }
 * Шаг 2: POST /consalting/wazzup-accounts/{id}/setup-webhook/  { webhook_url }
 *        → бэкенд ставит is_connected = true
 *
 * Параллельный общий CRM-модуль: /crm/wazzup-accounts/ (не эта вкладка).
 * Channel ID — UUID из GET https://api.wazzup24.com/v3/channels → channelId.
 */
export default function WazzupAccountsTab({ alert }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const webhookUrl = getDefaultWazzupWebhookUrl();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setErr("");
    setNotReady(false);
    try {
      const data = await listWazzupAccounts();
      setItems(asArray(data));
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) {
        setNotReady(true);
        setItems([]);
      } else {
        setErr(errText(e, "Не удалось загрузить аккаунты Wazzup."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listWazzupAccounts();
        if (cancelled) return;
        setItems(asArray(data));
        setNotReady(false);
        setErr("");
      } catch (e) {
        if (cancelled) return;
        if (e?.status === 404 || e?.status === 501) {
          setNotReady(true);
          setItems([]);
        } else {
          setErr(errText(e, "Не удалось загрузить аккаунты Wazzup."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSetupWebhook = async (account) => {
    setBusyId(account.id);
    try {
      await setupWazzupWebhook(account.id, { webhook_url: webhookUrl });
      alert?.(
        "Webhook зарегистрирован в Wazzup (PATCH /v3/webhooks), is_connected = true. Диалоги синхронизируются.",
      );
      fetchAccounts();
    } catch (e) {
      const detail = errText(e, "Не удалось зарегистрировать webhook.");
      // Типичная ошибка до фикса бэка: POST вместо PATCH к api.wazzup24.com/v3/webhooks
      const hint = /404.*wazzup24\.com\/v3\/webhooks|Not Found for url:.*\/v3\/webhooks/i.test(
        detail,
      )
        ? " Бэкенд должен вызывать Wazzup через PATCH /v3/webhooks (не POST). После деплоя фикса нажмите кнопку ещё раз."
        : "";
      alert?.(`${detail}${hint}`, true);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (account) => {
    if (
      !window.confirm(
        `Отключить канал ${typeLabel(account)} (${account.channel_id || account.id})?`,
      )
    ) {
      return;
    }
    setBusyId(account.id);
    try {
      await deleteWazzupAccount(account.id);
      alert?.("Аккаунт Wazzup удалён.");
      fetchAccounts();
    } catch (e) {
      alert?.(errText(e, "Не удалось удалить аккаунт."), true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="leads__settings">
      {notReady && (
        <div className="leads__notice">
          <FaLink className="leads__noticeIcon" />
          <div>
            <b>API Wazzup-аккаунтов ещё не доступен на бэкенде.</b>
            <p>
              Нужны эндпоинты{" "}
              <code>POST /consalting/wazzup-accounts/</code> и{" "}
              <code>…/setup-webhook/</code>. Пока — Django Admin (Консалтинг →
              Wazzup аккаунты) или общий модуль{" "}
              <code>/api/crm/wazzup-accounts/</code>.
            </p>
          </div>
        </div>
      )}

      {!notReady && (
        <>
          <div className="leads__settingsCard">
            <div className="leads__settingsTitle">
              Подключение (2 шага)
            </div>
            <ol className="leads__steps">
              <li>
                <b>Сохранить API Key + Channel ID</b> →{" "}
                <code>POST /consalting/wazzup-accounts/</code>
              </li>
              <li>
                <b>Привязать webhook</b> →{" "}
                <code>POST …/setup-webhook/</code> (бэкенд пишет в Wazzup и
                ставит <code>is_connected = true</code>)
              </li>
            </ol>
            <p className="leads__muted" style={{ marginBottom: 8 }}>
              Webhook URL для консалтинга (подставляется автоматически):
            </p>
            <code className="leads__codeBlock">{webhookUrl}</code>
            <p className="leads__muted" style={{ marginTop: 10 }}>
              Channel ID — поле <code>channelId</code> из{" "}
              <code>GET https://api.wazzup24.com/v3/channels</code> (Bearer =
              API Key), UUID вида{" "}
              <code>ae07aa7e-717f-4765-8798-…</code>. Тип берётся из{" "}
              <code>transport</code> (whatsapp / instagram / telegram).
            </p>
          </div>

          <div className="leads__toolbar">
            <div className="leads__settingsTitle" style={{ margin: 0 }}>
              Подключённые каналы
            </div>
            <div className="leads__toolbarActions">
              <button
                type="button"
                className="leads__btn"
                onClick={fetchAccounts}
                disabled={loading}
              >
                <FaSyncAlt /> Обновить
              </button>
              <button
                type="button"
                className="leads__btn leads__btn--primary"
                onClick={() => setCreateOpen(true)}
              >
                <FaPlus /> Подключить канал
              </button>
            </div>
          </div>

          {!!err && <div className="leads__alert">{err}</div>}

          {items.some((a) => a.is_connected !== true && a.is_active !== false) && (
            <div className="leads__alert" style={{ background: "#fffbeb", color: "#92400e" }}>
              Есть аккаунты без webhook (<code>is_connected: false</code>). Нажмите
              «Зарегистрировать Webhook» — NurCRM вызовет Wazzup{" "}
              <code>PATCH /v3/webhooks</code> с вашим URL. Аккаунт уже создан, заново
              вводить API Key не нужно.
            </div>
          )}

          <div className="leads__tableWrap">
            <table className="leads__table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Channel ID</th>
                  <th>API</th>
                  <th>Статус</th>
                  <th>Обновлён</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="leads__empty" colSpan={6}>
                      Загрузка…
                    </td>
                  </tr>
                ) : items.length ? (
                  items.map((a) => {
                    const st = accountStatusLabel(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <span
                            className={`leads__sourceTag leads__sourceTag--${a.integration_type || "whatsapp"}`}
                          >
                            {typeLabel(a)}
                          </span>
                        </td>
                        <td>
                          <code>{a.channel_id || "—"}</code>
                        </td>
                        <td>
                          <div className="leads__apiCell">
                            <code title={a.api_key || ""}>
                              {a.api_key || "—"}
                            </code>
                            {a.api_url && (
                              <small className="leads__muted">
                                {a.api_url}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          {st === "is_connected" && (
                            <span className="leads__status leads__status--converted">
                              is_connected
                            </span>
                          )}
                          {st === "off" && (
                            <span className="leads__status leads__status--rejected">
                              is_active=false
                            </span>
                          )}
                          {st === "saved" && (
                            <span className="leads__status leads__status--assigned">
                              сохранён · нужен webhook
                            </span>
                          )}
                        </td>
                        <td>{fmtDate(a.updated_at || a.created_at)}</td>
                        <td className="leads__rowActions">
                          <button
                            type="button"
                            className="leads__btn leads__btn--sm"
                            disabled={busyId === a.id || st === "is_connected"}
                            onClick={() => onSetupWebhook(a)}
                            title={
                              st === "is_connected"
                                ? "Webhook уже зарегистрирован (is_connected)"
                                : "Зарегистрировать Webhook"
                            }
                          >
                            <FaLink />{" "}
                            {st === "is_connected"
                              ? "Webhook OK"
                              : "Зарегистрировать Webhook"}
                          </button>
                          <button
                            type="button"
                            className="leads__btn leads__btn--sm"
                            disabled={busyId === a.id}
                            onClick={() => onDelete(a)}
                            title="Удалить"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="leads__empty" colSpan={6}>
                      Каналы ещё не подключены. Нажмите «Подключить канал».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {createOpen && (
        <ConnectModal
          webhookUrl={webhookUrl}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            fetchAccounts();
          }}
          onError={(m) => alert?.(m, true)}
          onNotice={(m) => alert?.(m)}
        />
      )}
    </div>
  );
}

function ConnectModal({ webhookUrl, onClose, onCreated, onError, onNotice }) {
  const [form, setForm] = useState({
    api_key: "",
    channel_id: "",
    integration_type: "whatsapp",
  });
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsErr, setChannelsErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadChannels = async () => {
    const key = form.api_key.trim();
    if (!key) {
      onError?.("Сначала вставьте API Key, затем загрузите каналы.");
      return;
    }
    setLoadingChannels(true);
    setChannelsErr("");
    setChannels([]);
    try {
      // Прямой запрос к Wazzup API v3 (как в curl). Может упереться в CORS
      // в браузере — тогда Channel ID вводят вручную.
      const res = await fetch("https://api.wazzup24.com/v3/channels", {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Wazzup ответил ${res.status}. Проверьте API Key.`,
        );
      }
      const data = await res.json();
      const rows = Array.isArray(data) ? data : asArray(data);
      if (!rows.length) {
        setChannelsErr("У этого API Key нет активных каналов.");
        return;
      }
      setChannels(rows);
      const first = rows[0];
      const channelId = first.channelId || first.channel_id || "";
      if (channelId) {
        setForm((f) => ({
          ...f,
          channel_id: channelId,
          integration_type: transportToIntegrationType(first.transport),
        }));
      }
    } catch (e) {
      const msg =
        e?.message?.includes("Failed to fetch") || e?.name === "TypeError"
          ? "Браузер не дал вызвать api.wazzup24.com (CORS). Скопируйте channelId из curl/кабинета вручную."
          : e?.message || "Не удалось загрузить каналы Wazzup.";
      setChannelsErr(msg);
    } finally {
      setLoadingChannels(false);
    }
  };

  const pickChannel = (ch) => {
    setForm((f) => ({
      ...f,
      channel_id: ch.channelId || ch.channel_id || "",
      integration_type: transportToIntegrationType(ch.transport),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.api_key.trim() || !form.channel_id.trim()) {
      onError?.("Укажите API Key и Channel ID (UUID из Wazzup).");
      return;
    }
    setSaving(true);
    try {
      // Шаг 1 — сохранить ключи в NurCRM (консалтинг).
      const account = await createWazzupAccount({
        api_key: form.api_key.trim(),
        channel_id: form.channel_id.trim(),
        integration_type: form.integration_type,
      });
      // Шаг 2 — авто-привязка webhook → is_connected = true.
      // Бэкенд обязан слать в Wazzup PATCH /v3/webhooks (не POST).
      try {
        await setupWazzupWebhook(account.id, { webhook_url: webhookUrl });
        onNotice?.(
          "Готово: аккаунт сохранён, webhook зарегистрирован (is_connected = true).",
        );
      } catch (whErr) {
        onNotice?.(
          `Шаг 1 ок (аккаунт ${account.id}). Webhook не зарегистрирован: ${errText(
            whErr,
            "ошибка",
          )}. Нажмите «Зарегистрировать Webhook» в списке после фикса бэка.`,
        );
      }
      onCreated?.();
    } catch (e2) {
      onError?.(errText(e2, "Не удалось подключить канал Wazzup."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="leads__overlay" onClick={onClose}>
      <div
        className="leads__modal leads__modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle">Подключить Wazzup</h3>
          <button
            type="button"
            className="leads__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
        <form className="leads__form" onSubmit={submit}>
          <p className="leads__muted" style={{ margin: 0 }}>
            Модуль <b>Консалтинг</b>:{" "}
            <code>/api/consalting/wazzup-accounts/</code> (не путать с общим{" "}
            <code>/api/crm/wazzup-accounts/</code>).
          </p>

          <div className="leads__field">
            <label className="leads__label">1. API Key</label>
            <input
              className="leads__input"
              value={form.api_key}
              onChange={set("api_key")}
              autoComplete="off"
              placeholder="Bearer-ключ из Wazzup24 → API"
              autoFocus
            />
            <button
              type="button"
              className="leads__btn leads__btn--sm"
              style={{ marginTop: 8, width: "fit-content" }}
              onClick={loadChannels}
              disabled={loadingChannels || !form.api_key.trim()}
            >
              <FaCloudDownloadAlt />{" "}
              {loadingChannels
                ? "Загрузка…"
                : "Загрузить каналы (v3/channels)"}
            </button>
            {!!channelsErr && (
              <small className="leads__fieldHint leads__fieldHint--warn">
                {channelsErr}
              </small>
            )}
          </div>

          {!!channels.length && (
            <div className="leads__field">
              <label className="leads__label">Каналы из Wazzup</label>
              <div className="leads__channelList">
                {channels.map((ch) => {
                  const id = ch.channelId || ch.channel_id;
                  const selected = form.channel_id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`leads__channelCard${selected ? " is-active" : ""}`}
                      onClick={() => pickChannel(ch)}
                    >
                      <b>{leadSourceLabel(transportToIntegrationType(ch.transport))}</b>
                      <span>{ch.name || ch.plainId || "—"}</span>
                      <code>{id}</code>
                      <small>
                        {ch.state || "—"}
                        {ch.plainId ? ` · ${ch.plainId}` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="leads__field">
            <label className="leads__label">Тип канала (integration_type)</label>
            <select
              className="leads__input"
              value={form.integration_type}
              onChange={set("integration_type")}
            >
              {WAZZUP_INTEGRATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="leads__field">
            <label className="leads__label">2. Channel ID</label>
            <input
              className="leads__input"
              value={form.channel_id}
              onChange={set("channel_id")}
              placeholder="ae07aa7e-717f-4765-8798-c26ea4b3c7b7"
            />
            <small className="leads__fieldHint">
              Это <code>channelId</code> из ответа Wazzup, не номер телефона (
              <code>plainId</code>).
            </small>
          </div>

          <p className="leads__muted">
            При «Подключить» сначала сохраняем ключи, затем вызываем
            setup-webhook на <code>{webhookUrl}</code>.
          </p>
          <div className="leads__formActions">
            <button
              type="button"
              className="leads__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="leads__btn leads__btn--primary"
              disabled={saving}
            >
              {saving ? "Шаг 1→2…" : "Сохранить и зарегистрировать Webhook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
