/**
 * Зарплата → Штрафы и премии (ТЗ №2).
 *
 * Ручные корректировки: штраф уменьшает сумму к выплате, разовая премия
 * увеличивает. Причина обязательна — это защита обеих сторон: сотрудник видит,
 * за что удержали, руководитель может показать историю.
 */
import { useMemo, useState } from "react";
import { FaBan, FaPlus, FaTimes } from "react-icons/fa";
import {
  ACCRUAL_KIND,
  FINE_REASONS,
  cancelSalaryAdjustment,
  createSalaryAdjustment,
  listSalaryAdjustments,
} from "../../../../api/consultingSalary";
import { useConfirm } from "../../../../hooks/useDialog";
import {
  ListState,
  Pagination,
  PeriodFilter,
  SearchInput,
} from "../common/ListControls";
import { employeeName, fmtDate, fmtMoney, num, plural, toISODate } from "../common/listUtils";
import useConsultingList from "../common/useConsultingList";

const KIND_OPTIONS = [
  { value: ACCRUAL_KIND.FINE, label: "Штраф" },
  { value: ACCRUAL_KIND.MANUAL_BONUS, label: "Премия" },
];

export default function SalaryAdjustments({ employees = [], isOwnerOrAdmin, alert }) {
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);

  const list = useConsultingList({
    fetcher: listSalaryAdjustments,
    filters: { kind: "", user: "", date_from: "", date_to: "" },
    prefix: "adj",
  });

  const totals = useMemo(() => {
    let fines = 0;
    let bonuses = 0;
    for (const row of list.items) {
      if (row.status === "canceled") continue;
      if (row.kind === ACCRUAL_KIND.FINE) fines += num(row.amount);
      else bonuses += num(row.amount);
    }
    return { fines, bonuses };
  }, [list.items]);

  const cancel = (row) => {
    confirm("Отменить эту корректировку?", async (ok) => {
      if (!ok) return;
      try {
        await cancelSalaryAdjustment(row.id);
        list.refresh();
      } catch (e) {
        alert(e?.detail || "Не удалось отменить корректировку.", true);
      }
    });
  };

  return (
    <div className="salary__pane">
      <div className="cList__toolbar">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearch}
          placeholder="Сотрудник или комментарий…"
          ariaLabel="Поиск корректировок"
        />
        <select
          className="cList__input"
          value={list.filters.kind}
          onChange={(e) => list.setFilter("kind", e.target.value)}
          aria-label="Тип"
        >
          <option value="">Штрафы и премии</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        {isOwnerOrAdmin && (
          <select
            className="cList__input"
            value={list.filters.user}
            onChange={(e) => list.setFilter("user", e.target.value)}
            aria-label="Сотрудник"
          >
            <option value="">Все сотрудники</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeName(e)}
              </option>
            ))}
          </select>
        )}
        <PeriodFilter
          dateFrom={list.filters.date_from}
          dateTo={list.filters.date_to}
          onChange={({ date_from, date_to }) =>
            list.setFilters({ date_from, date_to })
          }
        />
        <span className="cList__toolbarSpacer" />
        {isOwnerOrAdmin && (
          <button
            type="button"
            className="salary__btn salary__btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            <FaPlus aria-hidden /> Добавить
          </button>
        )}
      </div>

      {!!list.items.length && (
        <div className="salary__totalsRow">
          <span>
            Штрафы за период: <b>−{fmtMoney(totals.fines)}</b>
          </span>
          <span>
            Премии за период: <b>+{fmtMoney(totals.bonuses)}</b>
          </span>
        </div>
      )}

      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="Штрафы и премии подключаются"
          notReadyText="После реализации на сервере корректировки начнут попадать в расчётный лист."
          emptyTitle="Корректировок нет"
          emptyText="Здесь появятся штрафы и разовые премии — они видны сотруднику в его расчётном листе."
          hasActiveFilters={list.hasActiveFilters}
          onResetFilters={list.resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Тип</th>
                <th>Причина</th>
                <th>Комментарий</th>
                <th className="cList__num">Сумма</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => {
                const isFine = row.kind === ACCRUAL_KIND.FINE;
                const canceled = row.status === "canceled";
                return (
                  <tr key={row.id} className={canceled ? "salary__row--off" : undefined}>
                    <td>{fmtDate(row.date || row.created_at)}</td>
                    <td>{row.user_display || "—"}</td>
                    <td>
                      <span
                        className={`salary__kind salary__kind--${isFine ? "fine" : "bonus"}`}
                      >
                        {isFine ? "Штраф" : "Премия"}
                      </span>
                    </td>
                    <td className="cList__muted">
                      {row.reason_display ||
                        FINE_REASONS.find((r) => r.value === row.reason)?.label ||
                        "—"}
                    </td>
                    <td className="cList__muted">{row.comment || "—"}</td>
                    <td className="cList__num">
                      <b className={isFine ? "salary__neg" : "salary__pos"}>
                        {isFine ? "−" : "+"}
                        {fmtMoney(row.amount)}
                      </b>
                    </td>
                    <td>
                      {isOwnerOrAdmin && !canceled && (
                        <button
                          type="button"
                          className="salary__btn salary__btn--sm"
                          onClick={() => cancel(row)}
                          title="Отменить корректировку"
                        >
                          <FaBan aria-hidden /> Отменить
                        </button>
                      )}
                      {canceled && <span className="cList__muted">Отменено</span>}
                    </td>
                  </tr>
                );
              })}
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
        unitLabel={plural.records}
        loading={list.loading}
      />

      {createOpen && (
        <AdjustmentModal
          employees={employees}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            list.refresh();
            alert("Корректировка добавлена.");
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </div>
  );
}

function AdjustmentModal({ employees, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    user: "",
    kind: ACCRUAL_KIND.FINE,
    amount: "",
    reason: FINE_REASONS[0].value,
    comment: "",
    date: toISODate(new Date()),
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isFine = form.kind === ACCRUAL_KIND.FINE;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.user) return onError?.("Выберите сотрудника.");
    if (num(form.amount) <= 0) return onError?.("Укажите сумму больше нуля.");
    if (isFine && form.reason === "other" && !form.comment.trim())
      return onError?.("Для причины «Другое» нужен комментарий.");

    setSaving(true);
    try {
      await createSalaryAdjustment({
        user: form.user,
        kind: form.kind,
        amount: num(form.amount),
        reason: isFine ? form.reason : "bonus",
        comment: form.comment.trim(),
        date: form.date,
      });
      onSaved?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось сохранить корректировку.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="salary__overlay" onClick={() => !saving && onClose()}>
      <div
        className="salary__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="salary__modalHead">
          <h3 className="salary__modalTitle">Штраф или премия</h3>
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
          <label className="salary__label">Сотрудник</label>
          <select
            className="cList__input"
            value={form.user}
            onChange={set("user")}
            autoFocus
          >
            <option value="">Выберите сотрудника</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeName(e)}
              </option>
            ))}
          </select>

          <label className="salary__label">Тип</label>
          <select className="cList__input" value={form.kind} onChange={set("kind")}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>

          <label className="salary__label">Сумма</label>
          <input
            className="cList__input"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={set("amount")}
          />

          {isFine && (
            <>
              <label className="salary__label">Причина</label>
              <select
                className="cList__input"
                value={form.reason}
                onChange={set("reason")}
              >
                {FINE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="salary__label">Дата</label>
          <input
            className="cList__input"
            type="date"
            value={form.date}
            onChange={set("date")}
          />

          <label className="salary__label">
            Комментарий{isFine && form.reason === "other" ? "" : " (необязательно)"}
          </label>
          <textarea
            className="cList__input"
            rows={2}
            value={form.comment}
            onChange={set("comment")}
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
      </div>
    </div>
  );
}
