// src/Components/Sectors/Consulting/leads/Leads.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaTimes,
  FaWhatsapp,
  FaSyncAlt,
  FaUserCheck,
} from "react-icons/fa";
import api from "../../../../api";
import {
  assignInboundLead,
  createInboundLead,
  getLeadDistribution,
  listInboundLeads,
  updateInboundLead,
  updateLeadDistribution,
} from "../../../../api/consultingLeads";
import { useAlert } from "../../../../hooks/useDialog";
import {
  ensurePushPermission,
  useConsultingRealtime,
} from "../common/useConsultingRealtime";
import "./leads.scss";

// Персональные события лидов текущего пользователя (назначение/новый лид).
const isLeadEvent = (n) => {
  const t = String(n?.type || n?.category || n?.event || "").toLowerCase();
  return t.includes("lead") || t.includes("лид");
};

const ROLES_URL = "/users/roles/";
const EMPLOYEES_URL = "/users/employees/";
const PER_PAGE = 12;

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";

const STATUS_RU = {
  new: "Новый",
  assigned: "Назначен",
  in_work: "В работе",
  converted: "Клиент",
  rejected: "Отклонён",
};

const STRATEGIES = [
  {
    value: "round_robin",
    label: "Поровну (round-robin)",
    hint: "Лиды раздаются получателям по кругу — каждому одинаковое количество.",
  },
  {
    value: "least_loaded",
    label: "По наименьшей загрузке",
    hint: "Новый лид уходит тому, у кого меньше активных лидов.",
  },
  {
    value: "manual",
    label: "Вручную",
    hint: "Авто-распределение выключено — лиды раздаёт ответственный вручную.",
  },
];

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ru-RU");
};

export default function ConsultingLeads() {
  const alert = useAlert();
  const [tab, setTab] = useState("inbox"); // inbox | settings

  /* справочники */
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const empById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), fullName(e)));
    return m;
  }, [employees]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(ROLES_URL)
      .then((res) => {
        if (cancelled) return;
        setRoles(
          asArray(res.data).map((r) => ({ id: r.id, name: r.name || "—" })),
        );
      })
      .catch(() => {});
    api
      .get(EMPLOYEES_URL)
      .then((res) => {
        if (cancelled) return;
        setEmployees(asArray(res.data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="leads">
      <header className="leads__header">
        <div>
          <h2 className="leads__title">
            <FaWhatsapp className="leads__titleIcon" /> Лиды
          </h2>
          <p className="leads__subtitle">
            Входящие обращения из WhatsApp и правила их распределения
          </p>
        </div>
        <div className="leads__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inbox"}
            className={`leads__tab ${tab === "inbox" ? "is-active" : ""}`}
            onClick={() => setTab("inbox")}
          >
            Входящие
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "settings"}
            className={`leads__tab ${tab === "settings" ? "is-active" : ""}`}
            onClick={() => setTab("settings")}
          >
            Распределение
          </button>
        </div>
      </header>

      {tab === "inbox" ? (
        <InboxTab empById={empById} employees={employees} alert={alert} />
      ) : (
        <SettingsTab roles={roles} employees={employees} alert={alert} />
      )}
    </section>
  );
}

/* ==================== ВКЛАДКА «ВХОДЯЩИЕ» ==================== */
function InboxTab({ empById, employees, alert }) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignFor, setAssignFor] = useState(null);

  const fetchLeads = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setErr("");
      setNotReady(false);
      try {
        const data = await listInboundLeads({
          page: pageNum,
          page_size: PER_PAGE,
          status: status || undefined,
          search: q.trim() || undefined,
        });
        const rows = asArray(data);
        setItems(rows);
        setCount(typeof data?.count === "number" ? data.count : rows.length);
        setPage(pageNum);
      } catch (e) {
        // Эндпоинт ещё не реализован на бэке — показываем «ожидание подключения».
        if (e?.status === 404 || e?.status === 501) {
          setNotReady(true);
          setItems([]);
          setCount(0);
        } else {
          setErr(e?.detail || "Не удалось загрузить лиды.");
        }
      } finally {
        setLoading(false);
      }
    },
    [status, q],
  );

  useEffect(() => {
    fetchLeads(1);
  }, [fetchLeads]);

  // Запрашиваем разрешение на десктоп-пуш один раз при открытии вкладки.
  useEffect(() => {
    ensurePushPermission();
  }, []);

  // Реалтайм: когда ЛИЧНО мне назначили/пришёл лид — обновляем список.
  const onLeadSignal = useCallback(() => fetchLeads(1), [fetchLeads]);
  useConsultingRealtime({ match: isLeadEvent, onSignal: onLeadSignal });

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));

  return (
    <>
      <div className="leads__toolbar">
        <div className="leads__filters">
          <input
            className="leads__input"
            placeholder="Поиск по имени / телефону…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="leads__input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_RU).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="leads__toolbarActions">
          <button
            type="button"
            className="leads__btn"
            onClick={() => fetchLeads(page)}
            title="Обновить"
          >
            <FaSyncAlt /> Обновить
          </button>
          <button
            type="button"
            className="leads__btn leads__btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            <FaPlus /> Лид вручную
          </button>
        </div>
      </div>

      {!!err && <div className="leads__alert">{err}</div>}

      {notReady && (
        <div className="leads__notice">
          <FaWhatsapp className="leads__noticeIcon" />
          <div>
            <b>Интеграция с WhatsApp ещё не подключена.</b>
            <p>
              Как только бэкенд подключит webhook, входящие сообщения из WhatsApp
              будут автоматически появляться здесь и распределяться между
              сотрудниками по правилам из вкладки «Распределение». Пока можно
              добавлять лиды вручную.
            </p>
          </div>
        </div>
      )}

      {!notReady && (
        <div className="leads__tableWrap">
          <table className="leads__table">
            <thead>
              <tr>
                <th>Получен</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Источник</th>
                <th>Назначен</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="leads__empty" colSpan={7}>
                    Загрузка…
                  </td>
                </tr>
              ) : items.length ? (
                items.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDateTime(l.created_at || l.received_at)}</td>
                    <td>{l.full_name || l.name || "—"}</td>
                    <td>{l.phone || "—"}</td>
                    <td>
                      <span className="leads__sourceTag">
                        {l.source === "whatsapp" ? (
                          <>
                            <FaWhatsapp /> WhatsApp
                          </>
                        ) : (
                          l.source || "Вручную"
                        )}
                      </span>
                    </td>
                    <td>
                      {l.owner
                        ? empById.get(String(l.owner)) ||
                          l.owner_display ||
                          "—"
                        : "— не распределён —"}
                    </td>
                    <td>
                      <span
                        className={`leads__status leads__status--${
                          l.status || "new"
                        }`}
                      >
                        {STATUS_RU[l.status] || l.status || "Новый"}
                      </span>
                    </td>
                    <td className="leads__rowActions">
                      <button
                        type="button"
                        className="leads__btn leads__btn--sm"
                        onClick={() => setAssignFor(l)}
                      >
                        <FaUserCheck /> Назначить
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="leads__empty" colSpan={7}>
                    Пока нет входящих лидов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {count > PER_PAGE && (
        <div className="leads__pager">
          <button
            className="leads__btn"
            disabled={page <= 1}
            onClick={() => fetchLeads(page - 1)}
          >
            Назад
          </button>
          <span className="leads__page">
            Стр. {page} из {totalPages}
          </span>
          <button
            className="leads__btn"
            disabled={page >= totalPages}
            onClick={() => fetchLeads(page + 1)}
          >
            Далее
          </button>
        </div>
      )}

      {createOpen && (
        <CreateLeadModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            fetchLeads(1);
          }}
          onError={(m) => alert(m, true)}
        />
      )}

      {assignFor && (
        <AssignModal
          lead={assignFor}
          employees={employees}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null);
            fetchLeads(page);
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </>
  );
}

function CreateLeadModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    source: "manual",
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() && !form.phone.trim()) {
      onError?.("Укажите имя или телефон лида.");
      return;
    }
    setSaving(true);
    try {
      await createInboundLead({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        message: form.message.trim(),
      });
      onCreated?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось создать лид.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="leads__overlay" onClick={onClose}>
      <div className="leads__modal" onClick={(e) => e.stopPropagation()}>
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle">Новый лид</h3>
          <button className="leads__iconBtn" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>
        <form className="leads__form" onSubmit={submit}>
          <div className="leads__field">
            <label className="leads__label">Имя</label>
            <input
              className="leads__input"
              value={form.full_name}
              onChange={set("full_name")}
              autoFocus
            />
          </div>
          <div className="leads__field">
            <label className="leads__label">Телефон</label>
            <input
              className="leads__input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+996700000000"
            />
          </div>
          <div className="leads__field">
            <label className="leads__label">Сообщение / комментарий</label>
            <textarea
              className="leads__input"
              rows={3}
              value={form.message}
              onChange={set("message")}
            />
          </div>
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
              {saving ? "Сохранение…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ lead, employees, onClose, onAssigned, onError }) {
  const [owner, setOwner] = useState(lead.owner ? String(lead.owner) : "");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!owner) {
      onError?.("Выберите сотрудника.");
      return;
    }
    setSaving(true);
    try {
      await assignInboundLead(lead.id, { owner });
      onAssigned?.();
    } catch (e2) {
      // fallback: обычный PATCH, если спец-эндпоинт назначения не готов
      try {
        await updateInboundLead(lead.id, { owner, status: "assigned" });
        onAssigned?.();
      } catch (e3) {
        onError?.(e3?.detail || e2?.detail || "Не удалось назначить лид.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="leads__overlay" onClick={onClose}>
      <div className="leads__modal" onClick={(e) => e.stopPropagation()}>
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle">Назначить лид</h3>
          <button className="leads__iconBtn" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>
        <form className="leads__form" onSubmit={submit}>
          <div className="leads__field">
            <label className="leads__label">Сотрудник</label>
            <select
              className="leads__input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              autoFocus
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {fullName(e)}
                </option>
              ))}
            </select>
          </div>
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
              {saving ? "…" : "Назначить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== ВКЛАДКА «РАСПРЕДЕЛЕНИЕ» ==================== */
function SettingsTab({ roles, employees, alert }) {
  const [enabled, setEnabled] = useState(true);
  const [strategy, setStrategy] = useState("round_robin");
  const [roleIds, setRoleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getLeadDistribution();
        if (cancelled) return;
        setEnabled(data?.enabled ?? true);
        setStrategy(data?.strategy || "round_robin");
        setRoleIds((data?.role_ids || []).map(String));
      } catch (e) {
        if (e?.status === 404 || e?.status === 501) setNotReady(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleRole = (id) =>
    setRoleIds((prev) =>
      prev.includes(String(id))
        ? prev.filter((x) => x !== String(id))
        : [...prev, String(id)],
    );

  // Предпросмотр получателей: сотрудники, у которых выбранная роль.
  const recipients = useMemo(() => {
    if (!roleIds.length) return [];
    const set = new Set(roleIds.map(String));
    return employees.filter((e) => set.has(String(e.custom_role)));
  }, [employees, roleIds]);

  const save = async () => {
    if (enabled && strategy !== "manual" && !roleIds.length) {
      alert("Выберите хотя бы одну роль-получатель.", true);
      return;
    }
    setSaving(true);
    try {
      await updateLeadDistribution({
        enabled,
        strategy,
        role_ids: roleIds,
      });
      alert("Настройки распределения сохранены.");
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) {
        setNotReady(true);
        alert(
          "Бэкенд ещё не поддерживает настройки распределения — они будут применены после реализации.",
          true,
        );
      } else {
        alert(e?.detail || "Не удалось сохранить настройки.", true);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="leads__alert">Загрузка настроек…</div>;

  return (
    <div className="leads__settings">
      {notReady && (
        <div className="leads__notice">
          <FaWhatsapp className="leads__noticeIcon" />
          <div>
            <b>Хранение настроек на бэкенде ещё не реализовано.</b>
            <p>
              Можно задать желаемые правила заранее — они вступят в силу после
              подключения. Контракт для бэка: docs/consulting/leads-whatsapp.md.
            </p>
          </div>
        </div>
      )}

      <div className="leads__settingsCard">
        <label className="leads__switchRow">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>
            <b>Авто-распределение входящих лидов</b>
            <small>
              Когда включено, каждый новый лид из WhatsApp сразу назначается
              сотруднику по выбранной стратегии.
            </small>
          </span>
        </label>
      </div>

      <div className="leads__settingsCard">
        <div className="leads__settingsTitle">Стратегия распределения</div>
        <div className="leads__strategies">
          {STRATEGIES.map((s) => (
            <label
              key={s.value}
              className={`leads__strategy ${
                strategy === s.value ? "is-active" : ""
              } ${!enabled ? "is-disabled" : ""}`}
            >
              <input
                type="radio"
                name="strategy"
                value={s.value}
                checked={strategy === s.value}
                onChange={() => setStrategy(s.value)}
                disabled={!enabled}
              />
              <span>
                <b>{s.label}</b>
                <small>{s.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="leads__settingsCard">
        <div className="leads__settingsTitle">
          Роли-получатели
          <span className="leads__hintInline">
            лиды получают только сотрудники с этими ролями
          </span>
        </div>
        {roles.length ? (
          <div className="leads__roleGrid">
            {roles.map((r) => (
              <label key={r.id} className="leads__roleChip">
                <input
                  type="checkbox"
                  checked={roleIds.includes(String(r.id))}
                  onChange={() => toggleRole(r.id)}
                  disabled={!enabled || strategy === "manual"}
                />
                <span>{r.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="leads__muted">Роли не найдены.</p>
        )}

        <div className="leads__recipients">
          <div className="leads__recipientsHead">
            Получатели ({recipients.length})
          </div>
          {recipients.length ? (
            <ul className="leads__recipientsList">
              {recipients.map((e) => (
                <li key={e.id}>{fullName(e)}</li>
              ))}
            </ul>
          ) : (
            <p className="leads__muted">
              {roleIds.length
                ? "Среди сотрудников нет пользователей с выбранными ролями."
                : "Выберите роли, чтобы увидеть, кто будет получать лиды."}
            </p>
          )}
        </div>
      </div>

      <div className="leads__formActions">
        <button
          type="button"
          className="leads__btn leads__btn--primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Сохранение…" : "Сохранить настройки"}
        </button>
      </div>
    </div>
  );
}
