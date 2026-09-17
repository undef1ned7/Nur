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
  getRegionalFunnelRouting,
  updateRegionalFunnelRouting,
  CONSULTING_REGIONS,
} from "../../../../api/consultingLeads";
import { isNotReadyError } from "../common/useConsultingList";
import { redistributeRegionalLeads } from "../../../../api/consultingRegions";
import { invalidateConsultingRegions } from "../common/useConsultingRegions";
import { employeeName } from "./Leads";

const REDISTRIBUTE_SCOPES = [
  { value: "main_unassigned", label: "Нераспределённые на главной воронке" },
  { value: "inbound_new", label: "Новые входящие лиды" },
  { value: "all_open", label: "Все открытые лиды" },
];

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

const FALLBACK_STRATEGIES = [
  {
    value: "round_robin",
    label: "Round-robin между регионами",
    hint: "Если город не определён — лид по очереди в одну из настроенных воронок.",
  },
  {
    value: "default_funnel",
    label: "Воронка по умолчанию",
    hint: "Все неопознанные лиды попадают в выбранную воронку.",
  },
];

function emptyRegionalRules() {
  return CONSULTING_REGIONS.map((r) => ({
    region_code: r.code,
    funnel_id: "",
    phone_prefixes: [...r.phonePrefixes],
    assign_role_ids: [],
    assign_strategy: "round_robin",
  }));
}

export default function LeadsDistribution({ roles, employees, funnels = [], alert }) {
  const [enabled, setEnabled] = useState(true);
  const [strategy, setStrategy] = useState("round_robin");
  const [roleIds, setRoleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notReady, setNotReady] = useState(false);

  const [regionalEnabled, setRegionalEnabled] = useState(false);
  const [regionalFallback, setRegionalFallback] = useState("round_robin");
  const [defaultFunnelId, setDefaultFunnelId] = useState("");
  const [regionalRules, setRegionalRules] = useState(emptyRegionalRules);
  const [regionalNotReady, setRegionalNotReady] = useState(false);
  const [regionalSaving, setRegionalSaving] = useState(false);

  // Разовое выравнивание базы лидов по регионам.
  const [redistScope, setRedistScope] = useState("main_unassigned");
  const [redistPlan, setRedistPlan] = useState(null); // { planned, total }
  const [redistBusy, setRedistBusy] = useState(false);

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

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    getRegionalFunnelRouting({ signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setRegionalEnabled(data?.enabled ?? false);
        setRegionalFallback(data?.fallback_strategy || "round_robin");
        setDefaultFunnelId(data?.default_funnel_id ? String(data.default_funnel_id) : "");
        const fromApi = Array.isArray(data?.rules) ? data.rules : [];
        setRegionalRules(
          CONSULTING_REGIONS.map((region) => {
            const row = fromApi.find((r) => r.region_code === region.code) || {};
            return {
              region_code: region.code,
              funnel_id: row.funnel_id ? String(row.funnel_id) : "",
              phone_prefixes:
                Array.isArray(row.phone_prefixes) && row.phone_prefixes.length
                  ? row.phone_prefixes
                  : [...region.phonePrefixes],
              assign_role_ids: (row.assign_role_ids || []).map(String),
              assign_strategy: row.assign_strategy || "round_robin",
            };
          }),
        );
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (isNotReadyError(e)) setRegionalNotReady(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const funnelLabel = (id) => {
    const f = funnels.find((x) => String(x.id) === String(id));
    return f?.name || f?.custom_role_name || id || "—";
  };

  const updateRegionalRule = (regionCode, patch) => {
    setRegionalRules((prev) =>
      prev.map((r) =>
        r.region_code === regionCode ? { ...r, ...patch } : r,
      ),
    );
  };

  const toggleRegionalRole = (regionCode, roleId) => {
    const id = String(roleId);
    setRegionalRules((prev) =>
      prev.map((r) => {
        if (r.region_code !== regionCode) return r;
        const ids = r.assign_role_ids || [];
        return {
          ...r,
          assign_role_ids: ids.includes(id)
            ? ids.filter((x) => x !== id)
            : [...ids, id],
        };
      }),
    );
  };

  const toggleRole = (id) =>
    setRoleIds((prev) =>
      prev.includes(String(id))
        ? prev.filter((x) => x !== String(id))
        : [...prev, String(id)],
    );

  // Сотрудник, попавший в получатели двух и более регионов по общей роли
  // (assign_role_ids не фильтруется по consulting_region_codes на бэке) —
  // реально получит лиды из чужого региона через round-robin. Считаем
  // пересечения, чтобы предупредить админа прямо в форме настроек.
  const regionRecipientsByCode = useMemo(() => {
    const map = new Map();
    for (const region of CONSULTING_REGIONS) {
      const rule = regionalRules.find((r) => r.region_code === region.code);
      const roleIdsForRegion = rule?.assign_role_ids || [];
      map.set(
        region.code,
        employees.filter((e) =>
          roleIdsForRegion.includes(String(e.custom_role)),
        ),
      );
    }
    return map;
  }, [regionalRules, employees]);

  const crossRegionEmployeeIds = useMemo(() => {
    const seenIn = new Map(); // employeeId -> Set(regionCode)
    for (const [code, list] of regionRecipientsByCode) {
      for (const e of list) {
        const id = String(e.id);
        if (!seenIn.has(id)) seenIn.set(id, new Set());
        seenIn.get(id).add(code);
      }
    }
    const overlapping = new Set();
    for (const [id, codes] of seenIn) {
      if (codes.size > 1) overlapping.add(id);
    }
    return overlapping;
  }, [regionRecipientsByCode]);

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

  const saveRegional = async () => {
    if (regionalEnabled) {
      const mapped = regionalRules.filter((r) => r.funnel_id);
      if (!mapped.length) {
        alert("Выберите воронку хотя бы для одного региона.", true);
        return;
      }
      if (regionalFallback === "default_funnel" && !defaultFunnelId) {
        alert("Выберите воронку по умолчанию для неопознанных лидов.", true);
        return;
      }
    }
    setRegionalSaving(true);
    try {
      await updateRegionalFunnelRouting({
        enabled: regionalEnabled,
        fallback_strategy: regionalFallback,
        default_funnel_id:
          regionalFallback === "default_funnel" ? defaultFunnelId || null : null,
        rules: regionalRules
          .filter((r) => r.funnel_id)
          .map((r) => ({
            region_code: r.region_code,
            funnel_id: r.funnel_id,
            phone_prefixes: r.phone_prefixes,
            assign_role_ids: r.assign_role_ids,
            assign_strategy: r.assign_strategy,
          })),
      });
      alert("Настройки региональных воронок сохранены.");
    } catch (e) {
      if (isNotReadyError(e)) {
        setRegionalNotReady(true);
        alert(
          "Бэкенд ещё не поддерживает региональную маршрутизацию — настройки будут применены после реализации.",
          true,
        );
      } else {
        alert(e?.detail || "Не удалось сохранить региональные настройки.", true);
      }
    } finally {
      setRegionalSaving(false);
    }
  };

  const previewRedistribute = async () => {
    setRedistBusy(true);
    setRedistPlan(null);
    try {
      const res = await redistributeRegionalLeads({
        scope: redistScope,
        dry_run: true,
      });
      setRedistPlan({
        planned: res?.planned || {},
        total:
          res?.total ??
          Object.values(res?.planned || {}).reduce((s, n) => s + Number(n || 0), 0),
      });
    } catch (e) {
      if (isNotReadyError(e)) {
        alert("Бэкенд ещё не поддерживает выравнивание лидов по регионам.", true);
      } else {
        alert(e?.detail || "Не удалось построить план распределения.", true);
      }
    } finally {
      setRedistBusy(false);
    }
  };

  const applyRedistribute = async () => {
    if (!redistPlan) return;
    setRedistBusy(true);
    try {
      const res = await redistributeRegionalLeads({
        scope: redistScope,
        dry_run: false,
      });
      const moved = res?.moved ?? redistPlan.total;
      alert(`Разделено лидов: ${moved}.`);
      setRedistPlan(null);
      invalidateConsultingRegions();
    } catch (e) {
      alert(e?.detail || "Не удалось разделить лиды.", true);
    } finally {
      setRedistBusy(false);
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

      <hr className="leads__settingsDivider" />

      {regionalNotReady && (
        <div className="cList__notice">
          <b>Региональная маршрутизация пока на сервере не подключена</b>
          <p>
            Задайте правила заранее. После деплоя бэкенда inbound будет
            автоматически попадать в воронку города. См.{" "}
            <code>docs/consulting/regional-funnels-distribution.md</code>.
          </p>
        </div>
      )}

      <div className="leads__settingsCard">
        <label className="leads__switchRow">
          <input
            type="checkbox"
            checked={regionalEnabled}
            onChange={(e) => setRegionalEnabled(e.target.checked)}
          />
          <span>
            <b>Региональные воронки (Бишкек / Ош / Джалал-Абад)</b>
            <small>
              Входящий лид определяется по телефону или источнику и попадает в
              воронку соответствующего города; ответственный назначается по
              ролям региона.
            </small>
          </span>
        </label>
      </div>

      <div className="leads__settingsCard">
        <div className="leads__settingsTitle">Если город не определён</div>
        <div className="leads__strategies">
          {FALLBACK_STRATEGIES.map((s) => (
            <label
              key={s.value}
              className={`leads__strategy ${
                regionalFallback === s.value ? "is-active" : ""
              } ${!regionalEnabled ? "is-disabled" : ""}`}
            >
              <input
                type="radio"
                name="regionalFallback"
                value={s.value}
                checked={regionalFallback === s.value}
                onChange={() => setRegionalFallback(s.value)}
                disabled={!regionalEnabled}
              />
              <span>
                <b>{s.label}</b>
                <small>{s.hint}</small>
              </span>
            </label>
          ))}
        </div>
        {regionalEnabled && regionalFallback === "default_funnel" && (
          <div className="leads__field" style={{ marginTop: 12 }}>
            <label className="leads__label">Воронка по умолчанию</label>
            <select
              className="leads__select"
              value={defaultFunnelId}
              onChange={(e) => setDefaultFunnelId(e.target.value)}
            >
              <option value="">Выберите воронку</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {funnelLabel(f.id)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {CONSULTING_REGIONS.map((region) => {
        const rule =
          regionalRules.find((r) => r.region_code === region.code) ||
          emptyRegionalRules().find((r) => r.region_code === region.code);
        const regionRecipients =
          regionRecipientsByCode.get(region.code) || [];
        const overlapping = regionRecipients.filter((e) =>
          crossRegionEmployeeIds.has(String(e.id)),
        );
        return (
          <div key={region.code} className="leads__settingsCard">
            <div className="leads__settingsTitle">{region.label}</div>
            <div className="leads__field">
              <label className="leads__label">Воронка продаж</label>
              <select
                className="leads__select"
                value={rule.funnel_id}
                disabled={!regionalEnabled}
                onChange={(e) =>
                  updateRegionalRule(region.code, { funnel_id: e.target.value })
                }
              >
                <option value="">Не выбрана</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {funnelLabel(f.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="leads__field">
              <label className="leads__label">
                Префиксы телефона (через запятую)
              </label>
              <input
                className="leads__input"
                disabled={!regionalEnabled}
                value={(rule.phone_prefixes || []).join(", ")}
                onChange={(e) =>
                  updateRegionalRule(region.code, {
                    phone_prefixes: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="+996312, +996555"
              />
            </div>
            <div className="leads__settingsTitle leads__settingsTitle--sub">
              Роли менеджеров региона
            </div>
            {roles.length ? (
              <div className="leads__roleGrid">
                {roles.map((r) => (
                  <label key={r.id} className="leads__roleChip">
                    <input
                      type="checkbox"
                      checked={(rule.assign_role_ids || []).includes(String(r.id))}
                      onChange={() => toggleRegionalRole(region.code, r.id)}
                      disabled={!regionalEnabled}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="leads__muted">Роли не найдены.</p>
            )}
            <p className="leads__muted">
              Менеджеры ({regionRecipients.length}):{" "}
              {regionRecipients.length
                ? regionRecipients.map((e) => employeeName(e)).join(", ")
                : "не выбраны"}
            </p>
            {overlapping.length > 0 && (
              <p
                className="leads__warning"
                role="alert"
                style={{
                  color: "#b45309",
                  background: "#fffbeb",
                  border: "1px solid #f59e0b",
                  borderRadius: 6,
                  padding: "8px 10px",
                  marginTop: 6,
                }}
              >
                ⚠ Пересечение с другим регионом: {overlapping
                  .map((e) => employeeName(e))
                  .join(", ")}
                {" "}— эти сотрудники состоят в роли, выбранной сразу в
                нескольких региональных правилах, и будут получать лиды из
                чужого региона по round-robin. Заведите для каждого региона
                отдельную роль-получателя (например «Продавец Бишкек» /
                «Продавец Ош»), чтобы разделить пулы.
              </p>
            )}
          </div>
        );
      })}

      <div className="leads__formActions">
        <button
          type="button"
          className="leads__btn leads__btn--primary"
          onClick={saveRegional}
          disabled={regionalSaving}
        >
          {regionalSaving ? "Сохранение…" : "Сохранить региональные воронки"}
        </button>
      </div>

      <div className="leads__settingsCard">
        <div className="leads__settingsTitle">
          Разделить лиды по регионам поровну
          <span className="leads__hintInline">
            существующие лиды раскидываются по региональным воронкам примерно
            равными долями; ответственного назначает руководитель региона
          </span>
        </div>
        <div className="leads__field">
          <label className="leads__label">Какие лиды делим</label>
          <select
            className="leads__select"
            value={redistScope}
            onChange={(e) => {
              setRedistScope(e.target.value);
              setRedistPlan(null);
            }}
          >
            {REDISTRIBUTE_SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {redistPlan && (
          <div className="leads__redistPlan">
            <div className="leads__redistPlanHead">
              План распределения · всего {redistPlan.total}
            </div>
            <ul className="leads__redistPlanList">
              {Object.entries(redistPlan.planned).map(([code, cnt]) => (
                <li key={code}>
                  <span>{code}</span>
                  <b>{cnt}</b>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="leads__formActions">
          <button
            type="button"
            className="leads__btn"
            onClick={previewRedistribute}
            disabled={redistBusy}
          >
            {redistBusy && !redistPlan ? "Считаем…" : "Показать план"}
          </button>
          {redistPlan && redistPlan.total > 0 && (
            <button
              type="button"
              className="leads__btn leads__btn--primary"
              onClick={applyRedistribute}
              disabled={redistBusy}
            >
              {redistBusy ? "Делим…" : `Разделить ${redistPlan.total} лидов`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
