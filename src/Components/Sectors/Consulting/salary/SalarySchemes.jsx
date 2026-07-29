/**
 * Зарплата → Схемы оплаты (ТЗ №2).
 *
 * Конструктор мотивации сотрудника: оклад, процент со сделки, фикс за сделку —
 * любая комбинация. Ставку можно переопределить на конкретную услугу.
 *
 * Приоритет ставки при начислении: сотрудник → услуга → компания. Поэтому здесь
 * же редактируются значения по умолчанию для всей компании: без них новый
 * сотрудник остался бы без мотивации вовсе.
 */
import { useCallback, useEffect, useState } from "react";
import { FaCog, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import {
  SALARY_PERIOD,
  SALARY_PERIOD_LABELS,
  getSalaryDefaults,
  getSalaryScheme,
  listSalarySchemes,
  updateSalaryDefaults,
  updateSalaryScheme,
} from "../../../../api/consultingSalary";
import { ListState, Pagination, SearchInput } from "../common/ListControls";
import { fmtMoney, fmtPercent, num, plural } from "../common/listUtils";
import useConsultingList from "../common/useConsultingList";
import { isNotReadyError } from "../common/useConsultingList";

const emptyScheme = {
  base_salary_enabled: false,
  base_salary: "",
  base_salary_period: SALARY_PERIOD.MONTH,
  percent_enabled: false,
  percent: "",
  fixed_enabled: false,
  fixed_amount: "",
  service_overrides: [],
};

export default function SalarySchemes({ services = [], alert }) {
  const [editUser, setEditUser] = useState(null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  const list = useConsultingList({
    fetcher: listSalarySchemes,
    filters: { is_active: "" },
    prefix: "sch",
  });

  return (
    <div className="salary__pane">
      <div className="cList__toolbar">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearch}
          placeholder="Сотрудник или должность…"
          ariaLabel="Поиск сотрудников"
        />
        <span className="cList__toolbarSpacer" />
        <button
          type="button"
          className="salary__btn"
          onClick={() => setDefaultsOpen(true)}
        >
          <FaCog aria-hidden /> Ставки по умолчанию
        </button>
      </div>

      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="Схемы оплаты подключаются"
          notReadyText="После реализации на сервере здесь можно будет задать каждому сотруднику оклад, процент и фикс за сделку."
          emptyTitle="Сотрудники не найдены"
          hasActiveFilters={list.hasActiveFilters}
          onResetFilters={list.resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Должность</th>
                <th className="cList__num">Оклад</th>
                <th className="cList__num">Процент</th>
                <th className="cList__num">Фикс за сделку</th>
                <th className="cList__num">Особые ставки</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={row.user}>
                  <td>{row.user_display || "—"}</td>
                  <td className="cList__muted">{row.role_display || "—"}</td>
                  <td className="cList__num">
                    {row.base_salary_enabled ? (
                      <>
                        {fmtMoney(row.base_salary)}
                        <span className="cList__muted">
                          {" "}
                          /{" "}
                          {(
                            SALARY_PERIOD_LABELS[row.base_salary_period] || "мес."
                          ).toLowerCase()}
                        </span>
                      </>
                    ) : (
                      <span className="cList__muted">—</span>
                    )}
                  </td>
                  <td className="cList__num">
                    {row.percent_enabled ? (
                      fmtPercent(row.percent)
                    ) : (
                      <span className="cList__muted">—</span>
                    )}
                  </td>
                  <td className="cList__num">
                    {row.fixed_enabled ? (
                      fmtMoney(row.fixed_amount)
                    ) : (
                      <span className="cList__muted">—</span>
                    )}
                  </td>
                  <td className="cList__num">
                    {(row.service_overrides || []).length || (
                      <span className="cList__muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="salary__btn salary__btn--sm"
                      onClick={() => setEditUser(row)}
                    >
                      Настроить
                    </button>
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
        unitLabel={plural.employees}
        loading={list.loading}
      />

      {editUser && (
        <SchemeModal
          row={editUser}
          services={services}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            list.refresh();
            alert("Схема оплаты сохранена.");
          }}
          onError={(m) => alert(m, true)}
        />
      )}

      {defaultsOpen && (
        <DefaultsModal
          onClose={() => setDefaultsOpen(false)}
          onSaved={() => {
            setDefaultsOpen(false);
            list.refresh();
            alert("Ставки по умолчанию сохранены.");
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </div>
  );
}

/* ==================== Схема конкретного сотрудника ==================== */

function SchemeModal({ row, services, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ ...emptyScheme, ...row });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    getSalaryScheme(row.user, { signal: controller.signal })
      .then((data) => {
        if (!cancelled && data) setForm({ ...emptyScheme, ...data });
      })
      .catch(() => {
        /* нет сохранённой схемы — работаем со значениями из списка */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [row.user]);

  const set = (k) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const addOverride = () =>
    setForm((f) => ({
      ...f,
      service_overrides: [
        ...(f.service_overrides || []),
        { service: "", percent: "", fixed_amount: "" },
      ],
    }));

  const setOverride = (idx, patch) =>
    setForm((f) => ({
      ...f,
      service_overrides: f.service_overrides.map((o, i) =>
        i === idx ? { ...o, ...patch } : o,
      ),
    }));

  const removeOverride = (idx) =>
    setForm((f) => ({
      ...f,
      service_overrides: f.service_overrides.filter((_, i) => i !== idx),
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.percent_enabled && (num(form.percent) < 0 || num(form.percent) > 100)) {
      onError?.("Процент должен быть в диапазоне 0–100.");
      return;
    }
    const overrides = (form.service_overrides || []).filter((o) => o.service);
    if (new Set(overrides.map((o) => String(o.service))).size !== overrides.length) {
      onError?.("Одна услуга указана в особых ставках дважды.");
      return;
    }

    setSaving(true);
    try {
      await updateSalaryScheme(row.user, {
        base_salary_enabled: !!form.base_salary_enabled,
        base_salary: form.base_salary_enabled ? num(form.base_salary) : 0,
        base_salary_period: form.base_salary_period || SALARY_PERIOD.MONTH,
        percent_enabled: !!form.percent_enabled,
        percent: form.percent_enabled ? num(form.percent) : 0,
        fixed_enabled: !!form.fixed_enabled,
        fixed_amount: form.fixed_enabled ? num(form.fixed_amount) : 0,
        service_overrides: overrides.map((o) => ({
          service: o.service,
          percent: num(o.percent),
          fixed_amount: num(o.fixed_amount),
        })),
      });
      onSaved?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось сохранить схему оплаты.");
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
            Схема оплаты · {row.user_display}
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

        {loading ? (
          <div className="cList__state">Загрузка схемы…</div>
        ) : (
          <form className="salary__form" onSubmit={submit}>
            <p className="salary__formNote">
              Включите нужные части — они складываются. Пустая схема означает,
              что применяются ставки компании по умолчанию.
            </p>

            <label className="salary__switchRow">
              <input
                type="checkbox"
                checked={!!form.base_salary_enabled}
                onChange={set("base_salary_enabled")}
              />
              <span>
                <b>Оклад</b>
                <small>Начисляется автоматически в конце периода.</small>
              </span>
            </label>
            {form.base_salary_enabled && (
              <div className="salary__row2">
                <input
                  className="cList__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.base_salary}
                  onChange={set("base_salary")}
                  placeholder="40000"
                />
                <select
                  className="cList__input"
                  value={form.base_salary_period}
                  onChange={set("base_salary_period")}
                >
                  {Object.entries(SALARY_PERIOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="salary__switchRow">
              <input
                type="checkbox"
                checked={!!form.percent_enabled}
                onChange={set("percent_enabled")}
              />
              <span>
                <b>Процент от сделки</b>
                <small>
                  Считается от фактической суммы продажи по цене роли продавца.
                </small>
              </span>
            </label>
            {form.percent_enabled && (
              <input
                className="cList__input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percent}
                onChange={set("percent")}
                placeholder="10"
              />
            )}

            <label className="salary__switchRow">
              <input
                type="checkbox"
                checked={!!form.fixed_enabled}
                onChange={set("fixed_enabled")}
              />
              <span>
                <b>Фикс за сделку</b>
                <small>Фиксированная сумма за каждую закрытую сделку.</small>
              </span>
            </label>
            {form.fixed_enabled && (
              <input
                className="cList__input"
                type="number"
                min="0"
                step="0.01"
                value={form.fixed_amount}
                onChange={set("fixed_amount")}
                placeholder="500"
              />
            )}

            <div className="salary__overrides">
              <div className="salary__overridesHead">
                <b>Особые ставки по услугам</b>
                <button
                  type="button"
                  className="salary__btn salary__btn--sm"
                  onClick={addOverride}
                >
                  <FaPlus aria-hidden /> Добавить
                </button>
              </div>
              <p className="salary__hint">
                Переопределяют общий процент и фикс этого сотрудника для
                конкретной услуги.
              </p>

              {(form.service_overrides || []).map((o, idx) => (
                <div className="salary__overrideRow" key={`${o.service}-${idx}`}>
                  <select
                    className="cList__input"
                    value={o.service || ""}
                    onChange={(e) =>
                      setOverride(idx, { service: e.target.value })
                    }
                  >
                    <option value="">Услуга…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="cList__input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={o.percent ?? ""}
                    onChange={(e) => setOverride(idx, { percent: e.target.value })}
                    placeholder="%"
                  />
                  <input
                    className="cList__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={o.fixed_amount ?? ""}
                    onChange={(e) =>
                      setOverride(idx, { fixed_amount: e.target.value })
                    }
                    placeholder="фикс"
                  />
                  <button
                    type="button"
                    className="salary__iconBtn"
                    onClick={() => removeOverride(idx)}
                    aria-label="Убрать ставку"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

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
        )}
      </div>
    </div>
  );
}

/* ==================== Ставки компании по умолчанию ==================== */

function DefaultsModal({ onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    percent: "",
    fixed_amount: "",
    base_salary: "",
    base_salary_period: SALARY_PERIOD.MONTH,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    getSalaryDefaults({ signal: controller.signal })
      .then((data) => {
        if (!cancelled && data) setForm((f) => ({ ...f, ...data }));
      })
      .catch((e) => {
        if (!cancelled && isNotReadyError(e)) setNotReady(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
        await updateSalaryDefaults({
          percent: num(form.percent),
          fixed_amount: num(form.fixed_amount),
          base_salary: num(form.base_salary),
          base_salary_period: form.base_salary_period,
        });
        onSaved?.();
      } catch (e2) {
        onError?.(e2?.detail || "Не удалось сохранить ставки по умолчанию.");
      } finally {
        setSaving(false);
      }
    },
    [form, onSaved, onError],
  );

  return (
    <div className="salary__overlay" onClick={() => !saving && onClose()}>
      <div
        className="salary__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="salary__modalHead">
          <h3 className="salary__modalTitle">Ставки по умолчанию</h3>
          <button
            type="button"
            className="salary__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        {notReady && (
          <div className="cList__notice">
            <b>Раздел подключается</b>
            <p>Настройки сохранятся после реализации на сервере.</p>
          </div>
        )}

        {loading ? (
          <div className="cList__state">Загрузка…</div>
        ) : (
          <form className="salary__form" onSubmit={submit}>
            <p className="salary__formNote">
              Применяются, когда у сотрудника и у услуги ставка не задана.
            </p>
            <label className="salary__label">Процент со сделки, %</label>
            <input
              className="cList__input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.percent}
              onChange={set("percent")}
            />
            <label className="salary__label">Фикс за сделку</label>
            <input
              className="cList__input"
              type="number"
              min="0"
              step="0.01"
              value={form.fixed_amount}
              onChange={set("fixed_amount")}
            />
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
        )}
      </div>
    </div>
  );
}
