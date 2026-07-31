/**
 * Консалтинг → Лиды → Очередь.
 *
 * Табы-статусы со счётчиками, отложенные с напоминанием, фильтры
 * (сотрудник, источник, период, «только просроченные»), серверный поиск и
 * пагинация. Параметры — в URL (префикс `q`).
 */
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCheck,
  FaClock,
  FaComments,
  FaExclamationTriangle,
  FaFilter,
  FaInstagram,
  FaLayerGroup,
  FaPlay,
  FaPlus,
  FaSyncAlt,
  FaTelegram,
  FaTimes,
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

/** «через 2 ч», «просрочено на 3 ч» — для отложенных. */
const fmtRemind = (iso) => {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return String(iso);
  const diff = ts - Date.now();
  const hours = Math.round(Math.abs(diff) / 3600000);
  const label =
    hours < 24 ? `${hours} ч` : `${Math.round(hours / 24)} дн.`;
  return diff >= 0 ? `через ${label}` : `просрочено на ${label}`;
};

const initials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
};

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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const overdueCount = Number(counters?.overdue) || 0;
  const newCount = Number(counters?.new) || 0;
  const filterCount = [
    filters.owner,
    filters.source,
    filters.date_from,
    filters.date_to,
    filters.overdue,
  ].filter(Boolean).length;

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
    <div className="leads__inbox">
      {(newCount > 0 || overdueCount > 0) && (
        <div className="leads__pulseRow" aria-live="polite">
          {newCount > 0 && (
            <span className="leads__pulse leads__pulse--new">
              {newCount} новых в очереди
            </span>
          )}
          {overdueCount > 0 && (
            <span className="leads__pulse leads__pulse--overdue">
              <FaExclamationTriangle aria-hidden /> {overdueCount} пора
              связаться
            </span>
          )}
        </div>
      )}

      <div
        className="leads__queueTabs"
        role="tablist"
        aria-label="Статусы лидов"
      >
        {tabs.map((t) => {
          const active = String(filters.queue) === String(t.value);
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`leads__queueTab${active ? " is-active" : ""}`}
              onClick={() => setFilter("queue", t.value)}
            >
              <span className="leads__queueTabLabel">{t.label}</span>
              {Number.isFinite(t.count) && (
                <span
                  className={`leads__queueTabCount${
                    t.countTone === "danger" ? " is-danger" : ""
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="leads__toolbar">
        <SearchInput
          value={searchInput}
          onChange={setSearch}
          placeholder="Имя, телефон, сообщение…"
          ariaLabel="Поиск лидов"
        />

        <button
          type="button"
          className={`leads__chip${filtersOpen || filterCount ? " is-active" : ""}`}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <FaFilter aria-hidden />
          Фильтры
          {filterCount > 0 && (
            <span className="leads__chipBadge">{filterCount}</span>
          )}
        </button>

        {isManager && (
          <button
            type="button"
            className={`leads__chip${onlyMine ? " is-active" : ""}`}
            onClick={() => setFilter("owner", onlyMine ? "" : myId)}
            disabled={!myId}
          >
            Мои
          </button>
        )}

        {filters.queue === "deferred" && (
          <button
            type="button"
            className={`leads__chip${filters.overdue ? " is-active" : ""}`}
            onClick={() => setFilter("overdue", filters.overdue ? "" : "true")}
          >
            <FaExclamationTriangle aria-hidden /> Просроченные
          </button>
        )}

        <span className="leads__toolbarSpacer" />

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
          <FaPlus aria-hidden /> <span>Лид</span>
        </button>
      </div>

      {filtersOpen && (
        <div className="leads__filtersPanel">
          {isManager && (
            <label className="leads__filterField">
              <span className="leads__filterLabel">Сотрудник</span>
              <select
                className="leads__input"
                value={filters.owner}
                onChange={(e) => setFilter("owner", e.target.value)}
              >
                <option value="">Все сотрудники</option>
                <option value="none">Не назначен</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {employeeName(e)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="leads__filterField">
            <span className="leads__filterLabel">Источник</span>
            <select
              className="leads__input"
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
          </label>

          <div className="leads__filterField leads__filterField--period">
            <span className="leads__filterLabel">Период</span>
            <PeriodFilter
              dateFrom={filters.date_from}
              dateTo={filters.date_to}
              onChange={({ date_from, date_to }) =>
                setFilters({ date_from, date_to })
              }
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="leads__chip leads__chip--ghost"
              onClick={() => {
                resetFilters();
                setFiltersOpen(false);
              }}
            >
              <FaTimes aria-hidden /> Сбросить
            </button>
          )}
        </div>
      )}

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
        <ul className="leads__feed" aria-label="Список лидов">
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
            const chatPath =
              l.lead &&
              consultingChatPath(l.lead, l.source || "whatsapp");
            const funnelPath = l.lead && consultingFunnelLeadPath(l.lead);
            const msg = l.message ? String(l.message) : "";

            return (
              <li
                key={l.id}
                className={`leads__card${overdue ? " is-overdue" : ""}${
                  busy ? " is-busy" : ""
                }`}
              >
                <div className="leads__cardMain">
                  <span
                    className={`leads__avatar leads__avatar--${src.value || "manual"}`}
                    aria-hidden
                  >
                    {initials(name)}
                  </span>

                  <div className="leads__cardBody">
                    <div className="leads__cardTop">
                      <div className="leads__cardIdentity">
                        <span className="leads__name" title={name || undefined}>
                          {name || "Без имени"}
                        </span>
                        <span className="leads__phone">
                          {l.phone || "Телефон не указан"}
                        </span>
                      </div>
                      <div className="leads__cardMeta">
                        <span
                          className={`leads__sourceTag leads__sourceTag--${src.value || "manual"}`}
                          style={{ color: src.color }}
                        >
                          <SourceIcon source={src.value} /> {src.label}
                        </span>
                        <span
                          className={`leads__status leads__status--${l.status || "new"}`}
                        >
                          {LEAD_STATUS_LABELS[l.status] || l.status || "Новый"}
                        </span>
                      </div>
                    </div>

                    <p className="leads__msg" title={msg || undefined}>
                      {msg
                        ? msg.slice(0, 160) + (msg.length > 160 ? "…" : "")
                        : "Нет текста сообщения"}
                    </p>

                    <div className="leads__cardFoot">
                      <span className="leads__date">
                        {fmtDateTime(l.created_at || l.received_at)}
                      </span>
                      {ownerName ? (
                        <span className="leads__owner">{ownerName}</span>
                      ) : (
                        <span className="leads__unassigned">Не назначен</span>
                      )}
                      {deferred && (
                        <span
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
                            ? ` · ${l.defer_count}×`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="leads__cardActions">
                  {chatPath && (
                    <Link
                      to={chatPath}
                      className="leads__btn leads__btn--primary leads__btn--sm"
                      title="Открыть чат"
                    >
                      <FaComments aria-hidden /> Чат
                    </Link>
                  )}
                  {funnelPath && (
                    <Link
                      to={funnelPath}
                      className="leads__btn leads__btn--sm"
                      title="Открыть на воронке"
                    >
                      <FaLayerGroup aria-hidden />
                    </Link>
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
                        title="Отложить"
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
              </li>
            );
          })}
        </ul>
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
    </div>
  );
}
