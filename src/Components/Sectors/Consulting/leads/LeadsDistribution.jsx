/**
 * Консалтинг → Лиды → Распределение.
 *
 * Кто и как получает входящие лиды: авто-раздача (round-robin / по загрузке /
 * вручную) и роли-получатели. Предпросмотр показывает конкретных людей, которым
 * реально будут падать лиды, — иначе настройку легко сделать «в пустоту».
 */
import { useEffect, useMemo, useState } from "react";
import {
  getLeadDistribution,
  updateLeadDistribution,
} from "../../../../api/consultingLeads";
import { isNotReadyError } from "../common/useConsultingList";
import { employeeName } from "./Leads";

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

export default function LeadsDistribution({ roles, employees, alert }) {
  const [enabled, setEnabled] = useState(true);
  const [strategy, setStrategy] = useState("round_robin");
  const [roleIds, setRoleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    getLeadDistribution({ signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setEnabled(data?.enabled ?? true);
        setStrategy(data?.strategy || "round_robin");
        setRoleIds((data?.role_ids || []).map(String));
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (isNotReadyError(e)) setNotReady(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const toggleRole = (id) =>
    setRoleIds((prev) =>
      prev.includes(String(id))
        ? prev.filter((x) => x !== String(id))
        : [...prev, String(id)],
    );

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
      await updateLeadDistribution({ enabled, strategy, role_ids: roleIds });
      alert("Настройки распределения сохранены.");
    } catch (e) {
      if (isNotReadyError(e)) {
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

  if (loading) return <div className="cList__state">Загрузка настроек…</div>;

  return (
    <div className="leads__settings">
      {notReady && (
        <div className="cList__notice">
          <b>Сохранение настроек пока недоступно</b>
          <p>
            Можно задать правила заранее — они заработают после подключения на
            сервере.
          </p>
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
              Новый лид из мессенджера сразу назначается сотруднику по выбранной
              стратегии.
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
              className={`leads__strategy ${strategy === s.value ? "is-active" : ""} ${
                !enabled ? "is-disabled" : ""
              }`}
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
                <li key={e.id}>{employeeName(e)}</li>
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
