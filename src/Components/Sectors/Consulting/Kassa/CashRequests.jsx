/**
 * Касса → Подтверждения (ТЗ №9).
 *
 * Продажа и приход денег разделены: менеджер оформляет продажу, а
 * ответственный за кассу подтверждает поступление. Пока заявка не
 * подтверждена, деньги НЕ входят в остаток кассы — поэтому суммы «в ожидании»
 * показываем отдельно, а не смешиваем с приходом.
 */
import { useCallback, useMemo, useState } from "react";
import { FaCheck, FaSyncAlt, FaTimes } from "react-icons/fa";
import {
  CASH_REJECT_REASONS,
  CASH_REQUEST_KIND_LABELS,
  CASH_REQUEST_STATUS,
  CASH_REQUEST_STATUS_LABELS,
  confirmCashRequest,
  getCashRequestCounters,
  listCashRequests,
  rejectCashRequest,
} from "../../../../api/consultingCashbox";
import { useAlert } from "../../../../hooks/useDialog";
import {
  CounterTabs,
  ListState,
  Pagination,
  PeriodFilter,
  SearchInput,
} from "../common/ListControls";
import { fmtDateTime, fmtMoney, plural } from "../common/listUtils";
import useConsultingList from "../common/useConsultingList";
import useCounters from "../common/useCounters";

const STATUS_TABS = [
  { value: CASH_REQUEST_STATUS.PENDING, label: "Ожидают" },
  { value: CASH_REQUEST_STATUS.CONFIRMED, label: "Подтверждены" },
  { value: CASH_REQUEST_STATUS.REJECTED, label: "Отклонены" },
  { value: "", label: "Все" },
];

export default function CashRequests({ employees = [] }) {
  const alert = useAlert();
  const [rejectFor, setRejectFor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const list = useConsultingList({
    fetcher: listCashRequests,
    filters: {
      status: CASH_REQUEST_STATUS.PENDING,
      kind: "",
      user: "",
      date_from: "",
      date_to: "",
    },
    prefix: "cr",
  });

  const counterParams = useMemo(
    () => ({
      user: list.filters.user || undefined,
      date_from: list.filters.date_from || undefined,
      date_to: list.filters.date_to || undefined,
    }),
    [list.filters.user, list.filters.date_from, list.filters.date_to],
  );

  const { data: counters, reload: reloadCounters } = useCounters(
    getCashRequestCounters,
    counterParams,
  );

  const reloadAll = useCallback(() => {
    list.refresh();
    reloadCounters();
  }, [list, reloadCounters]);

  const tabs = useMemo(
    () =>
      STATUS_TABS.map((t) => ({
        ...t,
        count: counters
          ? Number(counters[t.value || "all"]) || 0
          : undefined,
        countTone:
          t.value === CASH_REQUEST_STATUS.PENDING &&
          Number(counters?.pending) > 0
            ? "warn"
            : undefined,
      })),
    [counters],
  );

  const confirm = useCallback(
    async (row) => {
      setBusyId(row.id);
      try {
        await confirmCashRequest(row.id);
        reloadAll();
        alert("Поступление подтверждено — деньги проведены в кассу.");
      } catch (e) {
        alert(e?.detail || "Не удалось подтвердить поступление.", true);
      } finally {
        setBusyId(null);
      }
    },
    [alert, reloadAll],
  );

  const pendingAmount = Number(counters?.pending_amount) || 0;

  return (
    <div className="kassa__requests">
      <CounterTabs
        tabs={tabs}
        value={list.filters.status}
        onChange={(v) => list.setFilter("status", v)}
        ariaLabel="Статусы заявок"
      />

      {pendingAmount > 0 && (
        <div className="kassa__pendingBanner">
          Ожидает подтверждения: <b>{fmtMoney(pendingAmount)}</b>. Эти деньги
          пока не входят в остаток кассы.
        </div>
      )}

      <div className="cList__toolbar">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearch}
          placeholder="Клиент, услуга, сотрудник…"
          ariaLabel="Поиск заявок"
        />
        <select
          className="cList__input"
          value={list.filters.kind}
          onChange={(e) => list.setFilter("kind", e.target.value)}
          aria-label="Тип операции"
        >
          <option value="">Все типы</option>
          {Object.entries(CASH_REQUEST_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="cList__input"
          value={list.filters.user}
          onChange={(e) => list.setFilter("user", e.target.value)}
          aria-label="Сотрудник"
        >
          <option value="">Все сотрудники</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {[e.last_name, e.first_name].filter(Boolean).join(" ") || e.email}
            </option>
          ))}
        </select>
        <PeriodFilter
          dateFrom={list.filters.date_from}
          dateTo={list.filters.date_to}
          onChange={({ date_from, date_to }) =>
            list.setFilters({ date_from, date_to })
          }
        />
        <span className="cList__toolbarSpacer" />
        <button
          type="button"
          className="kassa__btn"
          onClick={reloadAll}
          disabled={list.loading}
          title="Обновить"
        >
          <FaSyncAlt aria-hidden />
        </button>
      </div>

      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="Подтверждение поступлений подключается"
          notReadyText="После реализации на сервере каждая продажа будет создавать заявку на приход, и касса начнёт сходиться автоматически."
          emptyTitle="Заявок нет"
          emptyText="Новые поступления появятся здесь сразу после оформления продажи."
          hasActiveFilters={list.hasActiveFilters}
          onResetFilters={list.resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Основание</th>
                <th>Клиент</th>
                <th>Оформил</th>
                <th className="cList__num">Сумма</th>
                <th>Способ</th>
                <th>Статус</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((r) => {
                const pending = r.status === CASH_REQUEST_STATUS.PENDING;
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} className={r.is_overdue ? "kassa__row--overdue" : undefined}>
                    <td>{fmtDateTime(r.created_at)}</td>
                    <td>{CASH_REQUEST_KIND_LABELS[r.kind] || r.kind || "—"}</td>
                    <td className="cList__muted">
                      {r.source_display || r.service_display || "—"}
                    </td>
                    <td>{r.client_display || "—"}</td>
                    <td>{r.user_display || "—"}</td>
                    <td className="cList__num">
                      <b>{fmtMoney(r.amount)}</b>
                    </td>
                    <td>{r.payment_method_display || r.payment_method || "—"}</td>
                    <td>
                      <span className={`kassa__reqStatus kassa__reqStatus--${r.status}`}>
                        {CASH_REQUEST_STATUS_LABELS[r.status] || r.status}
                      </span>
                      {r.reject_reason_display && (
                        <div className="kassa__reqHint">{r.reject_reason_display}</div>
                      )}
                    </td>
                    <td>
                      {pending && (
                        <div className="kassa__reqActions">
                          <button
                            type="button"
                            className="kassa__btn kassa__btn--success"
                            onClick={() => confirm(r)}
                            disabled={busy}
                            title="Подтвердить поступление"
                          >
                            <FaCheck aria-hidden /> Подтвердить
                          </button>
                          <button
                            type="button"
                            className="kassa__btn kassa__btn--danger"
                            onClick={() => setRejectFor(r)}
                            disabled={busy}
                            title="Отклонить"
                          >
                            <FaTimes aria-hidden />
                          </button>
                        </div>
                      )}
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
        unitLabel={plural.operations}
        loading={list.loading}
      />

      {rejectFor && (
        <RejectRequestModal
          request={rejectFor}
          onClose={() => setRejectFor(null)}
          onDone={() => {
            setRejectFor(null);
            reloadAll();
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </div>
  );
}

/** Отклонение заявки: причина обязательна — менеджер должен понимать, что не так. */
function RejectRequestModal({ request, onClose, onDone, onError }) {
  const [reason, setReason] = useState(CASH_REJECT_REASONS[0].value);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (reason === "other" && !comment.trim()) {
      onError?.("Для причины «Другое» нужен комментарий.");
      return;
    }
    setSaving(true);
    try {
      await rejectCashRequest(request.id, { reason, comment: comment.trim() });
      onDone?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось отклонить заявку.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kassa__overlay" onClick={() => !saving && onClose()}>
      <div
        className="kassa__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-cash-title"
      >
        <h3 className="kassa__modalTitle" id="reject-cash-title">
          Отклонить поступление
        </h3>
        <p className="kassa__modalNote">
          Сумма {fmtMoney(request.amount)} от {request.user_display || "—"}.
          Менеджер увидит отказ у себя в продажах.
        </p>

        <form className="kassa__form" onSubmit={submit}>
          <label className="kassa__label">Причина</label>
          <select
            className="cList__input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          >
            {CASH_REJECT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <label className="kassa__label">
            Комментарий{reason === "other" ? "" : " (необязательно)"}
          </label>
          <textarea
            className="cList__input"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <div className="kassa__formActions">
            <button
              type="button"
              className="kassa__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="kassa__btn kassa__btn--danger"
              disabled={saving}
            >
              {saving ? "…" : "Отклонить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
