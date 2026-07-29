/**
 * Консалтинг → Лиды → Очередь.
 *
 * Табы-статусы со счётчиками, отложенные лиды с напоминанием, фильтры
 * (сотрудник, источник, период, «только просроченные»), серверные поиск и
 * пагинация. Все параметры уходят в запрос и в URL.
 */
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCheck,
  FaClock,
  FaComments,
  FaExclamationTriangle,
  FaInstagram,
  FaLayerGroup,
  FaPlay,
  FaPlus,
  FaSyncAlt,
  FaTelegram,
  FaTimesCircle,
  FaUserCheck,
  FaWhatsapp,
} from "react-icons/fa";
import {
  DEFER_REASONS,
  LEAD_STATUS,
  LEAD_STATUS_LABELS,
  LEAD_TABS,
  isLeadOverdue,
  leadTabByValue,
  listInboundLeads,
  getLeadCounters,
  markInboundLeadWon,
  reasonLabel,
  resumeInboundLead,
} from "../../../../api/consultingLeads";
import {
  LEAD_SOURCES,
  consultingChatPath,
  consultingFunnelLeadPath,
  isConsultingChatRealtimeEvent,
  leadSourceMeta,
} from "../../../../utils/consultingLeadSources";
import { useUser } from "../../../../store/slices/userSlice";
import useConsultingList from "../common/useConsultingList";
import useCounters from "../common/useCounters";
import {
  CounterTabs,
  ListState,
  Pagination,
  PeriodFilter,
  SearchInput,
} from "../common/ListControls";
import { employeeName, fmtDateTime, plural } from "../common/listUtils";
import { useConsultingRealtime } from "../common/useConsultingRealtime";
import AssignLeadModal from "./modals/AssignLeadModal";
import CreateLeadModal from "./modals/CreateLeadModal";
import DeferLeadModal from "./modals/DeferLeadModal";
import RejectLeadModal from "./modals/RejectLeadModal";

const SourceIcon = ({ source }) => {
  const s = String(source || "").toLowerCase();
  if (s === "instagram") return <FaInstagram aria-hidden />;
  if (s === "telegram") return <FaTelegram aria-hidden />;
  if (s === "whatsapp") return <FaWhatsapp aria-hidden />;
  return null;
};

/** «через 2 ч», «завтра в 10:00», «просрочено на 3 ч» — для отложенных. */
const fmtRemind = (iso) => {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return String(iso);
  const diff = ts - Date.now();
  const hours = Math.round(Math.abs(diff) / 3600000);
  const label =
    hours < 24
      ? `${hours} ч`
      : `${Math.round(hours / 24)} дн.`;
  return diff >= 0 ? `через ${label}` : `просрочено на ${label}`;
};

const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
};

/** Таб очереди → набор статусов для сервера. */
const queueToStatus = (queue) => {
  const tab = leadTabByValue(queue);
  return tab.statuses.length ? tab.statuses.join(",") : "";
};

export default function LeadsInbox({ employees, empById, isManager, alert }) {
  const { profile } = useUser();
  const myId = profile?.id ? String(profile.id) : "";

  const [createOpen, setCreateOpen] = useState(false);
  const [assignFor, setAssignFor] = useState(null);
  const [deferFor, setDeferFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // `queue` — таб очереди, на сервер уходит как список статусов.
  const mapParams = useCallback((p) => {
    const { queue, ...rest } = p;
    const status = queueToStatus(queue);
    return status ? { ...rest, status } : rest;
  }, []);

  const list = useConsultingList({
    fetcher: listInboundLeads,
    filters: {
      queue: "all",
      owner: "",
      source: "",
      date_from: "",
      date_to: "",
      overdue: "",
    },
    mapParams,
    prefix: "q",
  });

  const {
    items,
    count,
    loading,
    error,
    notReady,
    page,
    pageSize,
    totalPages,
    searchInput,
    setSearch,
    filters,
    setFilter,
    setFilters,
    setPage,
    setPageSize,
    resetFilters,
    hasActiveFilters,
    refresh,
  } = list;

  /* Счётчики табов считаются по тем же фильтрам, но без самого таба. */
  const counterParams = useMemo(
    () => ({
      owner: filters.owner || undefined,
      source: filters.source || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      search: list.search || undefined,
    }),
    [filters.owner, filters.source, filters.date_from, filters.date_to, list.search],
  );

  const { data: counters, reload: reloadCounters } = useCounters(
    getLeadCounters,
    counterParams,
  );

  const reloadAll = useCallback(() => {
    refresh();
    reloadCounters();
  }, [refresh, reloadCounters]);

  // Реалтайм: новое сообщение / назначение / напоминание — обновляем список.
  useConsultingRealtime({
    match: isConsultingChatRealtimeEvent,
    onSignal: reloadAll,
  });

  const tabs = useMemo(
    () =>
      LEAD_TABS.map((t) => {
        const isDeferred = t.value === "deferred";
        const overdue = Number(counters?.overdue) || 0;
        return {
          value: t.value,
          label: t.label,
          count: counters ? Number(counters[t.value]) || 0 : undefined,
          countTone: isDeferred && overdue > 0 ? "danger" : undefined,
        };
      }),
    [counters],
  );

  const onlyMine = myId && String(filters.owner) === myId;

  const runAction = useCallback(
    async (lead, action, successText) => {
      setBusyId(lead.id);
      try {
        await action();
        reloadAll();
        if (successText) alert(successText);
      } catch (e) {
        alert(e?.detail || "Не удалось выполнить действие.", true);
      } finally {
        setBusyId(null);
      }
    },
    [alert, reloadAll],
  );

  return (
    <>
      <CounterTabs
        tabs={tabs}
        value={filters.queue}
        onChange={(v) => setFilter("queue", v)}
        ariaLabel="Статусы лидов"
        className="leads__queueTabs"
      />

      <div className="leads__toolbar">
        <SearchInput
          value={searchInput}
          onChange={setSearch}
          placeholder="Имя, телефон, сообщение…"
          ariaLabel="Поиск лидов"
        />

        {isManager && (
          <>
            <button
              type="button"
              className={`leads__chip${onlyMine ? " is-active" : ""}`}
              onClick={() => setFilter("owner", onlyMine ? "" : myId)}
              disabled={!myId}
            >
              Мои лиды
            </button>
            <select
              className="cList__input"
              value={filters.owner}
              onChange={(e) => setFilter("owner", e.target.value)}
              aria-label="Сотрудник"
            >
              <option value="">Все сотрудники</option>
              <option value="none">Не назначен</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)}
                </option>
              ))}
            </select>
          </>
        )}

        <select
          className="cList__input"
          value={filters.source}
          onChange={(e) => setFilter("source", e.target.value)}
          aria-label="Источник"
        >
          <option value="">Все источники</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <PeriodFilter
          dateFrom={filters.date_from}
          dateTo={filters.date_to}
          onChange={({ date_from, date_to }) =>
            setFilters({ date_from, date_to })
          }
        />

        {filters.queue === "deferred" && (
          <button
            type="button"
            className={`leads__chip${filters.overdue ? " is-active" : ""}`}
            onClick={() => setFilter("overdue", filters.overdue ? "" : "true")}
          >
            <FaExclamationTriangle aria-hidden /> Пора связаться
          </button>
        )}

        <span className="cList__toolbarSpacer" />

        <button
          type="button"
          className="leads__btn"
          onClick={reloadAll}
          title="Обновить"
          disabled={loading}
        >
          <FaSyncAlt aria-hidden />
        </button>
        <button
          type="button"
          className="leads__btn leads__btn--primary"
          onClick={() => setCreateOpen(true)}
        >
          <FaPlus aria-hidden /> Лид
        </button>
      </div>

      {loading || error || notReady || !items.length ? (
        <ListState
          loading={loading}
          error={error}
          notReady={notReady}
          empty={!items.length}
          notReadyTitle="Входящие лиды пока недоступны"
          notReadyText="Сообщения из WhatsApp, Instagram и Telegram появятся здесь после подключения на сервере. Каналы — во вкладке «Интеграция», правила раздачи — в «Распределении». Пока можно добавить лид вручную."
          emptyTitle="Пока нет лидов в этом разделе"
          emptyText="Новые обращения из мессенджеров появятся здесь автоматически."
          emptyAction={
            <button
              type="button"
              className="leads__btn leads__btn--primary"
              onClick={() => setCreateOpen(true)}
            >
              <FaPlus aria-hidden /> Добавить лид
            </button>
          }
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table leads__table">
            <thead>
              <tr>
                <th>Лид</th>
                <th>Получен</th>
                <th>Источник</th>
                <th>Сообщение</th>
                <th>Назначен</th>
                <th>Статус</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const src = leadSourceMeta(l.source || "manual");
                const name = l.full_name || l.name || "";
                const ownerName = l.owner
                  ? empById.get(String(l.owner)) || l.owner_display || "—"
                  : null;
                const overdue = isLeadOverdue(l);
                const deferred = l.status === LEAD_STATUS.DEFERRED;
                const closed =
                  l.status === LEAD_STATUS.CONVERTED ||
                  l.status === LEAD_STATUS.REJECTED;
                const busy = busyId === l.id;

                return (
                  <tr
                    key={l.id}
                    className={`leads__row${overdue ? " leads__row--overdue" : ""}`}
                  >
                    <td>
                      <div className="leads__person">
                        <span className="leads__avatar" aria-hidden>
                          {initials(name)}
                        </span>
                        <div className="leads__personText">
                          <div className="leads__name" title={name || undefined}>
                            {name || "Без имени"}
                          </div>
                          <div className="leads__phone">
                            {l.phone || "Телефон не указан"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="leads__date">
                      {fmtDateTime(l.created_at || l.received_at)}
                    </td>
                    <td>
                      <span
                        className={`leads__sourceTag leads__sourceTag--${src.value || "manual"}`}
                        style={{ color: src.color }}
                      >
                        <SourceIcon source={src.value} /> {src.label}
                      </span>
                    </td>
                    <td className="leads__msgPreview" title={l.message || ""}>
                      {l.message
                        ? String(l.message).slice(0, 80) +
                          (String(l.message).length > 80 ? "…" : "")
                        : "—"}
                    </td>
                    <td title={ownerName || undefined}>
                      {ownerName ? (
                        <span className="leads__cellText">{ownerName}</span>
                      ) : (
                        <span className="leads__unassigned">Не назначен</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`leads__status leads__status--${l.status || "new"}`}
                      >
                        {LEAD_STATUS_LABELS[l.status] || l.status || "Новый"}
                      </span>
                      {deferred && (
                        <div
                          className={`leads__deferHint${
                            overdue ? " leads__deferHint--overdue" : ""
                          }`}
                          title={l.defer_comment || undefined}
                        >
                          <FaClock aria-hidden />{" "}
                          {fmtRemind(l.remind_at || l.deferred_until)}
                          {l.defer_reason
                            ? ` · ${reasonLabel(DEFER_REASONS, l.defer_reason)}`
                            : ""}
                          {Number(l.defer_count) > 1
                            ? ` · откладывали ${l.defer_count} раз`
                            : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="leads__rowActions">
                        {l.lead && (
                          <>
                            <Link
                              to={
                                consultingChatPath(l.lead, l.source || "whatsapp") ||
                                "#"
                              }
                              className="leads__btn leads__btn--sm"
                              title="Открыть чат"
                            >
                              <FaComments aria-hidden />
                            </Link>
                            <Link
                              to={consultingFunnelLeadPath(l.lead) || "#"}
                              className="leads__btn leads__btn--sm"
                              title="Открыть на воронке"
                            >
                              <FaLayerGroup aria-hidden />
                            </Link>
                          </>
                        )}

                        {!closed && (
                          <button
                            type="button"
                            className="leads__btn leads__btn--sm"
                            onClick={() => setAssignFor(l)}
                            title="Назначить сотрудника"
                            disabled={busy}
                          >
                            <FaUserCheck aria-hidden />
                          </button>
                        )}

                        {deferred ? (
                          <button
                            type="button"
                            className="leads__btn leads__btn--sm"
                            onClick={() =>
                              runAction(
                                l,
                                () => resumeInboundLead(l.id),
                                "Лид возвращён в работу.",
                              )
                            }
                            title="Вернуть в работу"
                            disabled={busy}
                          >
                            <FaPlay aria-hidden />
                          </button>
                        ) : (
                          !closed && (
                            <button
                              type="button"
                              className="leads__btn leads__btn--sm"
                              onClick={() => setDeferFor(l)}
                              title="Отложить на потом"
                              disabled={busy}
                            >
                              <FaClock aria-hidden />
                            </button>
                          )
                        )}

                        {!closed && (
                          <>
                            <button
                              type="button"
                              className="leads__btn leads__btn--sm leads__btn--success"
                              onClick={() =>
                                runAction(
                                  l,
                                  () => markInboundLeadWon(l.id),
                                  "Лид помечен как покупка.",
                                )
                              }
                              title="Купил"
                              disabled={busy}
                            >
                              <FaCheck aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="leads__btn leads__btn--sm leads__btn--danger"
                              onClick={() => setRejectFor(l)}
                              title="Отказ"
                              disabled={busy}
                            >
                              <FaTimesCircle aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        count={count}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={setPageSize}
        unitLabel={plural.leads}
        loading={loading}
      />

      {createOpen && (
        <CreateLeadModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            reloadAll();
          }}
          onError={(m) => alert(m, true)}
        />
      )}

      {assignFor && (
        <AssignLeadModal
          lead={assignFor}
          employees={employees}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null);
            reloadAll();
          }}
          onError={(m) => alert(m, true)}
        />
      )}

      {deferFor && (
        <DeferLeadModal
          lead={deferFor}
          onClose={() => setDeferFor(null)}
          onDeferred={() => {
            setDeferFor(null);
            reloadAll();
          }}
          onError={(m) => alert(m, true)}
        />
      )}

      {rejectFor && (
        <RejectLeadModal
          lead={rejectFor}
          onClose={() => setRejectFor(null)}
          onRejected={() => {
            setRejectFor(null);
            reloadAll();
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </>
  );
}
