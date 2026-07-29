/**
 * Зарплата → Правила премий (ТЗ №2).
 *
 * Правило = условие → вознаграждение. Поддержаны количественные планы, план по
 * выручке и прогрессивная шкала («лестница»), когда процент зависит от
 * достигнутой ступени.
 */
import { useState } from "react";
import { FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import {
  BONUS_CONDITIONS,
  BONUS_REWARD_TYPES,
  SALARY_PERIOD,
  SALARY_PERIOD_LABELS,
  createBonusRule,
  deleteBonusRule,
  listBonusRules,
  updateBonusRule,
} from "../../../../api/consultingSalary";
import { useConfirm } from "../../../../hooks/useDialog";
import { ListState, Pagination, SearchInput } from "../common/ListControls";
import { fmtMoney, fmtPercent, num, plural } from "../common/listUtils";
import useConsultingList from "../common/useConsultingList";

const conditionMeta = (value) =>
  BONUS_CONDITIONS.find((c) => c.value === value) || BONUS_CONDITIONS[0];

const emptyRule = {
  name: "",
  condition: BONUS_CONDITIONS[0].value,
  service: "",
  threshold: "",
  reward_type: "fixed",
  reward_value: "",
  period: SALARY_PERIOD.MONTH,
  applies_to: "all",
  role: "",
  user: "",
  tiers: [{ from: "", to: "", percent: "" }],
  is_active: true,
};

/** Человекочитаемое описание правила для таблицы. */
function describeRule(rule) {
  const meta = conditionMeta(rule.condition);
  if (meta.isLadder) {
    const tiers = rule.tiers || [];
    return `Шкала: ${tiers
      .map((t) => `${fmtMoney(t.from)}+ → ${fmtPercent(t.percent)}`)
      .join(", ")}`;
  }
  const target =
    rule.condition === "service_count"
      ? `${rule.threshold} × ${rule.service_name || "услуга"}`
      : rule.condition === "revenue_amount"
        ? fmtMoney(rule.threshold)
        : `${rule.threshold} сделок`;
  const reward =
    rule.reward_type === "percent"
      ? fmtPercent(rule.reward_value)
      : fmtMoney(rule.reward_value);
  return `${target} → ${reward}`;
}

export default function SalaryBonusRules({ services = [], employees = [], roles = [], alert }) {
  const confirm = useConfirm();
  const [editRule, setEditRule] = useState(null);

  const list = useConsultingList({
    fetcher: listBonusRules,
    filters: { is_active: "", condition: "" },
    prefix: "br",
  });

  const remove = (rule) => {
    confirm(`Удалить правило «${rule.name}»?`, async (ok) => {
      if (!ok) return;
      try {
        await deleteBonusRule(rule.id);
        list.refresh();
      } catch (e) {
        alert(e?.detail || "Не удалось удалить правило.", true);
      }
    });
  };

  const toggle = async (rule) => {
    try {
      await updateBonusRule(rule.id, { is_active: !rule.is_active });
      list.refresh();
    } catch (e) {
      alert(e?.detail || "Не удалось изменить правило.", true);
    }
  };

  return (
    <div className="salary__pane">
      <div className="cList__toolbar">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearch}
          placeholder="Название правила…"
          ariaLabel="Поиск правил"
        />
        <select
          className="cList__input"
          value={list.filters.condition}
          onChange={(e) => list.setFilter("condition", e.target.value)}
          aria-label="Тип условия"
        >
          <option value="">Все условия</option>
          {BONUS_CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="cList__input"
          value={list.filters.is_active}
          onChange={(e) => list.setFilter("is_active", e.target.value)}
          aria-label="Активность"
        >
          <option value="">Все</option>
          <option value="true">Только активные</option>
          <option value="false">Только выключенные</option>
        </select>
        <span className="cList__toolbarSpacer" />
        <button
          type="button"
          className="salary__btn salary__btn--primary"
          onClick={() => setEditRule({ ...emptyRule })}
        >
          <FaPlus aria-hidden /> Правило
        </button>
      </div>

      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="Премии подключаются"
          notReadyText="После реализации на сервере правила начнут начислять премии автоматически."
          emptyTitle="Правил премий пока нет"
          emptyText="Например: «продал 5 внедрений за месяц → +10 000» или прогрессивная шкала процента."
          hasActiveFilters={list.hasActiveFilters}
          onResetFilters={list.resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table">
            <thead>
              <tr>
                <th>Правило</th>
                <th>Условие</th>
                <th>Расчёт</th>
                <th>Период</th>
                <th>Кому</th>
                <th>Статус</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td className="cList__muted">
                    {conditionMeta(rule.condition).label}
                  </td>
                  <td>{describeRule(rule)}</td>
                  <td>{SALARY_PERIOD_LABELS[rule.period] || "Месяц"}</td>
                  <td className="cList__muted">
                    {rule.applies_to === "user"
                      ? rule.user_display || "сотрудник"
                      : rule.applies_to === "role"
                        ? rule.role_display || "роль"
                        : "Все"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`salary__pill${rule.is_active ? " salary__pill--on" : ""}`}
                      onClick={() => toggle(rule)}
                    >
                      {rule.is_active ? "Активно" : "Выключено"}
                    </button>
                  </td>
                  <td>
                    <div className="salary__rowActions">
                      <button
                        type="button"
                        className="salary__btn salary__btn--sm"
                        onClick={() => setEditRule(rule)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="salary__iconBtn"
                        onClick={() => remove(rule)}
                        aria-label="Удалить правило"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        count={list.count}
        pageSize={list.pageSize}
        onPage={list.setPage}
        onPageSize={list.setPageSize}
        unitLabel={plural.rules}
        loading={list.loading}
      />

      {editRule && (
        <RuleModal
          rule={editRule}
          services={services}
          employees={employees}
          roles={roles}
          onClose={() => setEditRule(null)}
          onSaved={() => {
            setEditRule(null);
            list.refresh();
            alert("Правило премии сохранено.");
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </div>
  );
}

function RuleModal({ rule, services, employees, roles, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ ...emptyRule, ...rule });
  const [saving, setSaving] = useState(false);
  const meta = conditionMeta(form.condition);

  const set = (k) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const setTier = (idx, patch) =>
    setForm((f) => ({
      ...f,
      tiers: f.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));

  const addTier = () =>
    setForm((f) => ({
      ...f,
      tiers: [...(f.tiers || []), { from: "", to: "", percent: "" }],
    }));

  const removeTier = (idx) =>
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, i) => i !== idx) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return onError?.("Введите название правила.");
    if (meta.needsService && !form.service)
      return onError?.("Выберите услугу для этого условия.");
    if (!meta.isLadder && num(form.threshold) <= 0)
      return onError?.("Укажите порог срабатывания больше нуля.");
    if (!meta.isLadder && num(form.reward_value) <= 0)
      return onError?.("Укажите размер вознаграждения.");
    if (meta.isLadder && !(form.tiers || []).some((t) => num(t.percent) > 0))
      return onError?.("Заполните хотя бы одну ступень шкалы.");
    if (form.applies_to === "user" && !form.user)
      return onError?.("Выберите сотрудника.");
    if (form.applies_to === "role" && !form.role)
      return onError?.("Выберите роль.");

    const payload = {
      name: form.name.trim(),
      condition: form.condition,
      service: meta.needsService ? form.service : null,
      threshold: meta.isLadder ? null : num(form.threshold),
      reward_type: meta.isLadder ? "percent" : form.reward_type,
      reward_value: meta.isLadder ? null : num(form.reward_value),
      period: form.period,
      applies_to: form.applies_to,
      role: form.applies_to === "role" ? form.role : null,
      user: form.applies_to === "user" ? form.user : null,
      tiers: meta.isLadder
        ? (form.tiers || [])
            .filter((t) => num(t.percent) > 0)
            .map((t) => ({
              from: num(t.from),
              to: t.to === "" ? null : num(t.to),
              percent: num(t.percent),
            }))
        : [],
      is_active: !!form.is_active,
    };

    setSaving(true);
    try {
      if (rule.id) await updateBonusRule(rule.id, payload);
      else await createBonusRule(payload);
      onSaved?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось сохранить правило.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="salary__overlay" onClick={() => !saving && onClose()}>
      <div
        className="salary__modal salary__modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="salary__modalHead">
          <h3 className="salary__modalTitle">
            {rule.id ? "Изменить правило" : "Новое правило премии"}
          </h3>
          <button
            type="button"
            className="salary__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="salary__form" onSubmit={submit}>
          <label className="salary__label">Название</label>
          <input
            className="cList__input"
            value={form.name}
            onChange={set("name")}
            placeholder="Например: план 300 тыс. в месяц"
            autoFocus
          />

          <label className="salary__label">Условие</label>
          <select
            className="cList__input"
            value={form.condition}
            onChange={set("condition")}
          >
            {BONUS_CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <small className="salary__hint">{meta.hint}</small>

          {meta.needsService && (
            <>
              <label className="salary__label">Услуга</label>
              <select
                className="cList__input"
                value={form.service || ""}
                onChange={set("service")}
              >
                <option value="">Выберите услугу</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {meta.isLadder ? (
            <div className="salary__overrides">
              <div className="salary__overridesHead">
                <b>Ступени шкалы</b>
                <button
                  type="button"
                  className="salary__btn salary__btn--sm"
                  onClick={addTier}
                >
                  <FaPlus aria-hidden /> Ступень
                </button>
              </div>
              <p className="salary__hint">
                «От» — сумма выручки за период, с которой действует процент.
                Верхнюю границу последней ступени можно оставить пустой.
              </p>
              {(form.tiers || []).map((t, idx) => (
                <div className="salary__tierRow" key={idx}>
                  <input
                    className="cList__input"
                    type="number"
                    min="0"
                    step="1"
                    value={t.from}
                    onChange={(e) => setTier(idx, { from: e.target.value })}
                    placeholder="от"
                  />
                  <input
                    className="cList__input"
                    type="number"
                    min="0"
                    step="1"
                    value={t.to}
                    onChange={(e) => setTier(idx, { to: e.target.value })}
                    placeholder="до"
                  />
                  <input
                    className="cList__input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={t.percent}
                    onChange={(e) => setTier(idx, { percent: e.target.value })}
                    placeholder="%"
                  />
                  <button
                    type="button"
                    className="salary__iconBtn"
                    onClick={() => removeTier(idx)}
                    aria-label="Убрать ступень"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <label className="salary__label">
                {form.condition === "revenue_amount"
                  ? "План по выручке"
                  : "Порог (количество)"}
              </label>
              <input
                className="cList__input"
                type="number"
                min="0"
                step="1"
                value={form.threshold}
                onChange={set("threshold")}
              />

              <label className="salary__label">Вознаграждение</label>
              <div className="salary__row2">
                <select
                  className="cList__input"
                  value={form.reward_type}
                  onChange={set("reward_type")}
                >
                  {BONUS_REWARD_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <input
                  className="cList__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reward_value}
                  onChange={set("reward_value")}
                  placeholder={form.reward_type === "percent" ? "%" : "сумма"}
                />
              </div>
            </>
          )}

          <label className="salary__label">Период</label>
          <select
            className="cList__input"
            value={form.period}
            onChange={set("period")}
          >
            {Object.entries(SALARY_PERIOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          <label className="salary__label">Кому применяется</label>
          <select
            className="cList__input"
            value={form.applies_to}
            onChange={set("applies_to")}
          >
            <option value="all">Всем сотрудникам</option>
            <option value="role">Роли</option>
            <option value="user">Конкретному сотруднику</option>
          </select>

          {form.applies_to === "role" && (
            <select
              className="cList__input"
              value={form.role || ""}
              onChange={set("role")}
            >
              <option value="">Выберите роль</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          {form.applies_to === "user" && (
            <select
              className="cList__input"
              value={form.user || ""}
              onChange={set("user")}
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {[e.last_name, e.first_name].filter(Boolean).join(" ") ||
                    e.email}
                </option>
              ))}
            </select>
          )}

          <label className="salary__switchRow">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={set("is_active")}
            />
            <span>
              <b>Правило активно</b>
              <small>Выключенное правило не начисляет премии.</small>
            </span>
          </label>

          <div className="salary__formActions">
            <button
              type="button"
              className="salary__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="salary__btn salary__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
