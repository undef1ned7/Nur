// src/Components/Sectors/Consulting/Funnel/Funnel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Funnel.scss";
import { useDispatch } from "react-redux";
import {
  getFunnels,
  createFunnel,
  getFunnelBoard,
  createStage,
  createLead,
  updateLead,
  deleteLead,
  moveLeadStage,
  getAllowedTransitions,
  recalculateScore,
  winLead,
  loseLead,
  getLeadTimeline,
  addLeadActivity,
  getLeadTasks,
  createLeadTask,
  updateLeadTask,
  deleteLeadTask,
  getLossReasons,
  getFunnelAnalytics,
} from "../../../../store/creators/funnelThunk";
import {
  useFunnel,
  moveLeadLocally,
  clearLeadDetail,
} from "../../../../store/slices/funnelSlice";

/**
 * Расширенные возможности «Воронка 2.0» (скоринг, лента, задачи, win/lose,
 * аналитика, allowed-transitions) включаются флагом, когда соответствующие
 * эндпоинты задеплоены на бэкенде. Базовый канбан (funnels/stages/leads/board/
 * move-stage) работает всегда. По умолчанию выключено — на проде этих URL ещё нет.
 */
const FUNNEL_V2 = import.meta.env.VITE_FUNNEL_V2 === "true";

/* ===================== справочники ===================== */
const STATUS_LABELS = {
  new: "Новый",
  in_work: "В работе",
  won: "Успех",
  lost: "Отказ",
};

const STAGE_TYPES = [
  { value: "new_lead", label: "Новый лид" },
  { value: "first_contact", label: "Первый контакт" },
  { value: "qualification", label: "Квалификация" },
  { value: "nurture", label: "Прогрев / в работе" },
  { value: "proposal_sent", label: "КП отправлено" },
  { value: "negotiation", label: "Переговоры" },
  { value: "decision_pending", label: "Ожидание решения" },
  { value: "won", label: "Выиграно / оплачено" },
  { value: "onboarding", label: "Онбординг" },
  { value: "completed", label: "Завершено" },
  { value: "lost", label: "Потеряно" },
];

const URGENCY = [
  { value: "low", label: "Низкая" },
  { value: "medium", label: "Средняя" },
  { value: "high", label: "Высокая" },
];

const ACTION_TYPES = [
  { value: "call", label: "Звонок" },
  { value: "message", label: "Сообщение" },
  { value: "meeting", label: "Встреча" },
  { value: "follow_up", label: "Follow-up" },
];

const ACTIVITY_TYPES = [
  { value: "note", label: "Заметка" },
  { value: "call", label: "Звонок" },
  { value: "message", label: "Сообщение" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Встреча" },
  { value: "file", label: "Файл" },
];

/* ===================== утилиты ===================== */
const fmtMoney = (v) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString() + " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

// краткая сумма: 50000 -> «50 тыс», 1250000 -> «1.25 млн»
const fmtMoneyShort = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0) + " млн";
  if (n >= 1_000) return Math.round(n / 1000) + " тыс";
  return String(n);
};

// инициалы для аватара владельца
const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

// детерминированный цвет аватара по строке
const avatarHue = (str) => {
  let h = 0;
  for (let i = 0; i < String(str).length; i++)
    h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
};

// ISO -> значение для <input type="datetime-local">
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
// значение datetime-local -> ISO
const fromLocalInput = (val) => (val ? new Date(val).toISOString() : null);

const errToText = (err, fallback = "Что-то пошло не так.") => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.detail && !err.errors) return err.detail;
  const parts = [];
  if (Array.isArray(err.errors)) parts.push(...err.errors);
  for (const [k, v] of Object.entries(err)) {
    if (k === "detail" || k === "errors") continue;
    parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  }
  if (err.detail) parts.unshift(err.detail);
  return parts.join("\n") || fallback;
};

/* ===================== главный экран ===================== */
export default function ConsultingFunnel() {
  const dispatch = useDispatch();
  const {
    funnels = [],
    board,
    loading,
    boardLoading,
    error,
    allowedTransitions,
  } = useFunnel();

  const [selectedId, setSelectedId] = useState(null);
  const [dragLeadId, setDragLeadId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // фильтры доски
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("");

  const [funnelFormOpen, setFunnelFormOpen] = useState(false);
  const [stageFormOpen, setStageFormOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [leadModal, setLeadModal] = useState(null); // { create, stageId } | { leadId }

  const funnelId = selectedId || funnels[0]?.id || null;

  useEffect(() => {
    dispatch(getFunnels());
    if (FUNNEL_V2) dispatch(getLossReasons());
  }, [dispatch]);

  useEffect(() => {
    if (funnelId) dispatch(getFunnelBoard(funnelId));
  }, [dispatch, funnelId]);

  const rawColumns = useMemo(() => board?.columns || [], [board]);
  const rawUnassigned = useMemo(() => board?.unassigned || [], [board]);
  const totalLeads = board?.funnel?.leads_count ?? 0;

  // список владельцев для фильтра — собираем из карточек доски
  const owners = useMemo(() => {
    const map = new Map();
    const all = [...rawColumns.flatMap((c) => c.leads || []), ...rawUnassigned];
    for (const l of all)
      if (l.owner && !map.has(l.owner))
        map.set(l.owner, l.owner_display || "Без имени");
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rawColumns, rawUnassigned]);

  // предикат фильтрации одной карточки
  const matchLead = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lead) => {
      if (riskOnly && !lead.is_at_risk) return false;
      if (ownerFilter && lead.owner !== ownerFilter) return false;
      if (gradeFilter && lead.score_grade !== gradeFilter) return false;
      if (q) {
        const hay = [lead.title, lead.full_name, lead.phone, lead.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
  }, [query, riskOnly, ownerFilter, gradeFilter]);

  const hasFilters = !!(query.trim() || ownerFilter || riskOnly || gradeFilter);

  // применяем фильтр (колонки сохраняем все — чтобы можно было перетащить)
  const columns = useMemo(
    () =>
      rawColumns.map((c) => ({
        ...c,
        leads: hasFilters ? (c.leads || []).filter(matchLead) : c.leads || [],
      })),
    [rawColumns, hasFilters, matchLead]
  );
  const unassigned = useMemo(
    () => (hasFilters ? rawUnassigned.filter(matchLead) : rawUnassigned),
    [rawUnassigned, hasFilters, matchLead]
  );

  const shownLeads = useMemo(
    () =>
      columns.reduce((n, c) => n + (c.leads?.length || 0), 0) +
      unassigned.length,
    [columns, unassigned]
  );

  const resetFilters = () => {
    setQuery("");
    setOwnerFilter("");
    setRiskOnly(false);
    setGradeFilter("");
  };

  // множество разрешённых стадий для текущего перетаскивания
  const allowedStageIds = useMemo(() => {
    if (!dragLeadId || !allowedTransitions) return null;
    return new Set((allowedTransitions.allowed || []).map((s) => s.id));
  }, [dragLeadId, allowedTransitions]);

  /* ---------- авто-скролл доски при перетаскивании к краям ---------- */
  const boardRef = useRef(null);
  const scrollDir = useRef(0);
  const scrollRAF = useRef(0);

  const stepAutoScroll = () => {
    const el = boardRef.current;
    if (el && scrollDir.current) {
      el.scrollLeft += scrollDir.current * 18;
      scrollRAF.current = requestAnimationFrame(stepAutoScroll);
    } else {
      scrollRAF.current = 0;
    }
  };
  const stopAutoScroll = () => {
    if (scrollRAF.current) cancelAnimationFrame(scrollRAF.current);
    scrollRAF.current = 0;
    scrollDir.current = 0;
  };
  const onBoardDragOver = (e) => {
    const el = boardRef.current;
    if (!el || !dragLeadId) return;
    const r = el.getBoundingClientRect();
    const edge = 100;
    let dir = 0;
    if (e.clientX < r.left + edge) dir = -1;
    else if (e.clientX > r.right - edge) dir = 1;
    scrollDir.current = dir;
    if (dir && !scrollRAF.current)
      scrollRAF.current = requestAnimationFrame(stepAutoScroll);
  };
  useEffect(() => () => stopAutoScroll(), []);

  /* ---------- drag & drop ---------- */
  const onDragStart = (leadId) => {
    setDragLeadId(leadId);
    if (FUNNEL_V2) dispatch(getAllowedTransitions(leadId));
  };
  const onDragEnd = () => {
    setDragLeadId(null);
    setDragOverStage(null);
    stopAutoScroll();
  };

  const onDropToStage = async (stageId) => {
    const leadId = dragLeadId;
    setDragOverStage(null);
    setDragLeadId(null);
    stopAutoScroll();
    if (!leadId) return;

    const current =
      columns.find((c) => (c.leads || []).some((l) => l.id === leadId))?.stage
        ?.id ?? null;
    const target = stageId ?? null;
    if (current === target) return;

    dispatch(moveLeadLocally({ leadId, toStageId: target }));
    try {
      if (target) {
        await dispatch(moveLeadStage({ id: leadId, stage: target })).unwrap();
      } else {
        await dispatch(
          updateLead({ id: leadId, data: { stage: null } })
        ).unwrap();
      }
    } catch {
      dispatch(getFunnelBoard(funnelId));
    }
  };

  const selectedFunnel = useMemo(
    () => funnels.find((f) => f.id === funnelId) || null,
    [funnels, funnelId]
  );

  return (
    <section className="funnel">
      <header className="funnel__header">
        <div>
          <h2 className="funnel__title">Воронка продаж</h2>
          <p className="funnel__subtitle">
            {selectedFunnel
              ? hasFilters
                ? `${selectedFunnel.name} · показано ${shownLeads} из ${totalLeads}`
                : `${selectedFunnel.name} · ${totalLeads} лид(ов)`
              : "Канбан-доска лидов"}
          </p>
        </div>

        <div className="funnel__actions">
          <select
            className="funnel__select"
            value={funnelId || ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            disabled={!funnels.length}
            aria-label="Выбор воронки"
          >
            {!funnels.length && <option value="">Нет воронок</option>}
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.is_active ? "" : " (неактивна)"}
              </option>
            ))}
          </select>

          {FUNNEL_V2 && (
            <button
              className="funnel__btn"
              onClick={() => setAnalyticsOpen(true)}
              disabled={!funnelId}
            >
              Аналитика
            </button>
          )}
          <button className="funnel__btn" onClick={() => setFunnelFormOpen(true)}>
            + Воронка
          </button>
          <button
            className="funnel__btn"
            onClick={() => setStageFormOpen(true)}
            disabled={!funnelId}
          >
            + Стадия
          </button>
          <button
            className="funnel__btn funnel__btn--primary"
            onClick={() =>
              setLeadModal({ create: true, stageId: columns[0]?.stage?.id })
            }
            disabled={!funnelId}
          >
            + Лид
          </button>
        </div>
      </header>

      {!!error && <div className="funnel__error">{errToText(error)}</div>}

      {funnelId && (rawColumns.length > 0 || rawUnassigned.length > 0) && (
        <div className="funnel__toolbar">
          <div className="funnel__searchWrap">
            <span className="funnel__searchIcon" aria-hidden>
              🔍
            </span>
            <input
              className="funnel__search"
              placeholder="Поиск по названию, имени, телефону…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="funnel__searchClear"
                onClick={() => setQuery("")}
                aria-label="Очистить"
              >
                ×
              </button>
            )}
          </div>

          {owners.length > 1 && (
            <select
              className="funnel__select funnel__select--sm"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Ответственный"
            >
              <option value="">Все ответственные</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}

          {FUNNEL_V2 &&
            ["A", "B", "C"].map((g) => (
              <button
                key={g}
                className={`funnel__gradeBtn funnel__gradeBtn--${g.toLowerCase()}${
                  gradeFilter === g ? " funnel__gradeBtn--active" : ""
                }`}
                onClick={() => setGradeFilter((v) => (v === g ? "" : g))}
                title={`Грейд ${g}`}
              >
                {g}
              </button>
            ))}

          {FUNNEL_V2 && (
            <button
              className={`funnel__chipBtn${
                riskOnly ? " funnel__chipBtn--active" : ""
              }`}
              onClick={() => setRiskOnly((v) => !v)}
            >
              ⚠ Под риском
            </button>
          )}

          {hasFilters && (
            <button className="funnel__chipBtn" onClick={resetFilters}>
              Сбросить
            </button>
          )}
        </div>
      )}

      {boardLoading || loading ? (
        <div className="funnel__placeholder">Загрузка…</div>
      ) : !funnelId ? (
        <div className="funnel__placeholder">
          Создайте воронку, чтобы начать работу.
        </div>
      ) : !rawColumns.length && !rawUnassigned.length ? (
        <div className="funnel__placeholder">
          В воронке пока нет стадий. Добавьте стадию, затем создавайте лиды.
        </div>
      ) : (
        <div
          className="funnel__board"
          ref={boardRef}
          onDragOver={onBoardDragOver}
        >
          {columns.map((col) => (
            <Column
              key={col.stage?.id}
              stage={col.stage}
              leads={col.leads || []}
              isOver={dragOverStage === col.stage?.id}
              dragLeadId={dragLeadId}
              dropState={
                !dragLeadId || !allowedStageIds
                  ? null
                  : allowedStageIds.has(col.stage?.id)
                  ? "allowed"
                  : "blocked"
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(col.stage?.id);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => onDropToStage(col.stage?.id)}
              onCardDragStart={onDragStart}
              onCardDragEnd={onDragEnd}
              onAddLead={() => setLeadModal({ create: true, stageId: col.stage?.id })}
              onCardClick={(lead) => setLeadModal({ leadId: lead.id })}
            />
          ))}

          {!!unassigned.length && (
            <Column
              key="unassigned"
              stage={{ name: "Без стадии", color: "#94a3b8" }}
              leads={unassigned}
              unassigned
              isOver={dragOverStage === "unassigned"}
              dragLeadId={dragLeadId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage("unassigned");
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => onDropToStage(null)}
              onCardDragStart={onDragStart}
              onCardDragEnd={onDragEnd}
              onCardClick={(lead) => setLeadModal({ leadId: lead.id })}
            />
          )}
        </div>
      )}

      {funnelFormOpen && <FunnelForm onClose={() => setFunnelFormOpen(false)} />}
      {stageFormOpen && (
        <StageForm
          funnelId={funnelId}
          nextOrder={columns.length}
          onClose={() => setStageFormOpen(false)}
        />
      )}
      {leadModal?.create && (
        <LeadCreateForm
          funnelId={funnelId}
          stages={columns.map((c) => c.stage)}
          initialStageId={leadModal.stageId}
          onClose={() => setLeadModal(null)}
        />
      )}
      {leadModal?.leadId && (
        <LeadDetail
          leadId={leadModal.leadId}
          funnelId={funnelId}
          stages={columns.map((c) => c.stage)}
          onClose={() => setLeadModal(null)}
        />
      )}
      {FUNNEL_V2 && analyticsOpen && (
        <AnalyticsModal
          funnelId={funnelId}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}
    </section>
  );
}

/* ===================== Колонка ===================== */
function Column({
  stage,
  leads,
  unassigned = false,
  isOver,
  dragLeadId,
  dropState,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  onAddLead,
  onCardClick,
}) {
  const cls = [
    "funnel__col",
    isOver ? "funnel__col--over" : "",
    dropState === "allowed" ? "funnel__col--allowed" : "",
    dropState === "blocked" ? "funnel__col--blocked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stageColor = stage?.color || "#cbd5e1";
  const sum = leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);

  return (
    <div
      className={cls}
      style={{ "--stage-color": stageColor }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="funnel__colBar" />
      <div className="funnel__colHead">
        <div className="funnel__colTitleRow">
          <span className="funnel__colDot" style={{ background: stageColor }} />
          <span className="funnel__colName" title={stage?.name}>
            {stage?.name || "—"}
          </span>
          <span className="funnel__colCount">{leads.length}</span>
        </div>
        {sum > 0 && (
          <span className="funnel__colSum">{fmtMoneyShort(sum)} с</span>
        )}
      </div>

      <div className="funnel__colBody">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            dragging={dragLeadId === lead.id}
            onDragStart={() => onCardDragStart(lead.id)}
            onDragEnd={onCardDragEnd}
            onClick={() => onCardClick(lead)}
          />
        ))}
        {!leads.length && (
          <div className="funnel__colEmpty">
            <span className="funnel__colEmptyIcon">↓</span>
            Перетащите карточку
          </div>
        )}
      </div>

      {!unassigned && (
        <button className="funnel__colAdd" onClick={onAddLead}>
          <span>+</span> Добавить лид
        </button>
      )}
    </div>
  );
}

/* ===================== Карточка лида ===================== */
function LeadCard({ lead, dragging, onDragStart, onDragEnd, onClick }) {
  return (
    <article
      className={`funnel__card${dragging ? " funnel__card--dragging" : ""}${
        lead.is_at_risk ? " funnel__card--risk" : ""
      }`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="funnel__cardTop">
        <div className="funnel__cardTitle" title={lead.title}>
          {lead.title || "Без названия"}
        </div>
        {lead.score_grade && (
          <span
            className={`funnel__grade funnel__grade--${String(
              lead.score_grade
            ).toLowerCase()}`}
            title={`Скоринг: ${lead.score_value ?? "—"}`}
          >
            {lead.score_grade}
          </span>
        )}
      </div>

      {(lead.full_name || lead.phone) && (
        <div className="funnel__cardContact">
          {lead.full_name && (
            <span className="funnel__cardName">{lead.full_name}</span>
          )}
          {lead.phone && (
            <span className="funnel__cardPhone">{lead.phone}</span>
          )}
        </div>
      )}

      <div className="funnel__cardMeta">
        {Number(lead.estimated_value) > 0 && (
          <span className="funnel__cardValue">
            {fmtMoney(lead.estimated_value)}
          </span>
        )}
        <span className={`funnel__badge funnel__badge--${lead.status}`}>
          {STATUS_LABELS[lead.status] || lead.status}
        </span>
      </div>

      {lead.probability != null && Number(lead.probability) > 0 && (
        <div className="funnel__cardProbWrap" title={`Вероятность ${lead.probability}%`}>
          <div className="funnel__cardProbTrack">
            <div
              className="funnel__cardProbFill"
              style={{ width: `${Math.min(100, Number(lead.probability))}%` }}
            />
          </div>
          <span className="funnel__cardProbVal">{lead.probability}%</span>
        </div>
      )}

      {lead.is_at_risk && (
        <div className="funnel__cardRisk" title={lead.risk_reason}>
          <span className="funnel__cardRiskDot" />
          Под риском{lead.risk_reason ? `: ${lead.risk_reason}` : ""}
        </div>
      )}

      {(lead.next_action_date || lead.owner_display) && (
        <div className="funnel__cardFoot">
          {lead.next_action_date && (
            <span className="funnel__cardNext">
              🕑 {fmtDate(lead.next_action_date)}
            </span>
          )}
          {lead.owner_display && (
            <span
              className="funnel__avatar"
              title={lead.owner_display}
              style={{
                background: `hsl(${avatarHue(lead.owner_display)} 65% 55%)`,
              }}
            >
              {initials(lead.owner_display)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/* ===================== Модалка-обёртка ===================== */
function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="funnel__overlay" onClick={onClose}>
      <div
        className={`funnel__modal${wide ? " funnel__modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="funnel__modalHead">
          <div className="funnel__modalTitle">{title}</div>
          <button
            className="funnel__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormActions({ saving, onClose }) {
  return (
    <div className="funnel__formActions funnel__formActions--end">
      <button
        type="button"
        className="funnel__btn"
        onClick={onClose}
        disabled={saving}
      >
        Отмена
      </button>
      <button
        type="submit"
        className="funnel__btn funnel__btn--primary"
        disabled={saving}
      >
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  );
}

/* ===================== Форма воронки ===================== */
function FunnelForm({ onClose }) {
  const dispatch = useDispatch();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Введите название воронки.");
    setSaving(true);
    try {
      await dispatch(
        createFunnel({
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
      ).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать воронку."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новая воронка" onClose={onClose}>
      {!!err && <div className="funnel__error">{err}</div>}
      <form className="funnel__form" onSubmit={submit}>
        <div className="funnel__field">
          <label className="funnel__label">Название *</label>
          <input
            className="funnel__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Описание</label>
          <textarea
            className="funnel__input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="funnel__check">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Активна
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ===================== Форма стадии ===================== */
const PRESET_COLORS = [
  "#3498db",
  "#f39c12",
  "#9b59b6",
  "#2ecc71",
  "#e74c3c",
  "#1abc9c",
];

function StageForm({ funnelId, nextOrder, onClose }) {
  const dispatch = useDispatch();
  const [name, setName] = useState("");
  const [order, setOrder] = useState(nextOrder ?? 0);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  // v2
  const [stageType, setStageType] = useState("new_lead");
  const [slaHours, setSlaHours] = useState("");
  const [allowSkip, setAllowSkip] = useState(false);
  const [requiredFields, setRequiredFields] = useState("");
  // базовый бэкенд
  const [isFinal, setIsFinal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Введите название стадии.");
    setSaving(true);
    try {
      const payload = {
        funnel: funnelId,
        name: name.trim(),
        order: Number(order) || 0,
        color,
      };
      if (FUNNEL_V2) {
        payload.stage_type = stageType;
        payload.allow_skip = allowSkip;
        if (slaHours !== "") payload.sla_hours = Number(slaHours) || 0;
        const rf = requiredFields
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (rf.length) payload.required_fields = rf;
      } else {
        payload.is_final = isFinal;
        payload.is_success = isFinal ? isSuccess : false;
      }

      await dispatch(createStage(payload)).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать стадию."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новая стадия" onClose={onClose}>
      {!!err && <div className="funnel__error">{err}</div>}
      <form className="funnel__form" onSubmit={submit}>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Название *</label>
            <input
              className="funnel__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Порядок</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
        </div>

        {FUNNEL_V2 && (
          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Тип стадии</label>
              <select
                className="funnel__input"
                value={stageType}
                onChange={(e) => setStageType(e.target.value)}
              >
                {STAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="funnel__field">
              <label className="funnel__label">SLA, часов</label>
              <input
                className="funnel__input"
                type="number"
                min="0"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="напр. 24"
              />
            </div>
          </div>
        )}

        <div className="funnel__field">
          <label className="funnel__label">Цвет</label>
          <div className="funnel__colors">
            {PRESET_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`funnel__colorDot${
                  color === c ? " funnel__colorDot--active" : ""
                }`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              className="funnel__colorPicker"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>

        {FUNNEL_V2 ? (
          <>
            <div className="funnel__field">
              <label className="funnel__label">
                Обязательные поля (через запятую)
              </label>
              <input
                className="funnel__input"
                value={requiredFields}
                onChange={(e) => setRequiredFields(e.target.value)}
                placeholder="estimated_value, phone"
              />
            </div>
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={allowSkip}
                onChange={(e) => setAllowSkip(e.target.checked)}
              />
              Разрешить прыжки через стадии
            </label>
            <p className="funnel__hint">
              Финальность (успех/провал) определяется типом стадии автоматически.
            </p>
          </>
        ) : (
          <>
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={isFinal}
                onChange={(e) => setIsFinal(e.target.checked)}
              />
              Финальная стадия (закрытие лида)
            </label>
            {isFinal && (
              <label className="funnel__check">
                <input
                  type="checkbox"
                  checked={isSuccess}
                  onChange={(e) => setIsSuccess(e.target.checked)}
                />
                Успешное закрытие
              </label>
            )}
          </>
        )}

        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ===================== Создание лида ===================== */
function LeadCreateForm({ funnelId, stages, initialStageId, onClose }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    title: "",
    stage: initialStageId || "",
    full_name: "",
    phone: "",
    email: "",
    source: "",
    estimated_value: "",
    probability: "",
    urgency: "medium",
    description: "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.title.trim()) return setErr("Введите название лида.");
    const payload = {
      funnel: funnelId,
      stage: form.stage || null,
      title: form.title.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      source: form.source.trim(),
      description: form.description.trim(),
      estimated_value:
        form.estimated_value === "" ? 0 : Number(form.estimated_value) || 0,
      probability: form.probability === "" ? 0 : Number(form.probability) || 0,
    };
    if (FUNNEL_V2) payload.urgency = form.urgency;

    setSaving(true);
    try {
      await dispatch(createLead(payload)).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать лид."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новый лид" onClose={onClose}>
      {!!err && <div className="funnel__error">{err}</div>}
      <form className="funnel__form" onSubmit={submit}>
        <div className="funnel__field">
          <label className="funnel__label">Название *</label>
          <input
            className="funnel__input"
            value={form.title}
            onChange={set("title")}
            autoFocus
          />
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Стадия</label>
            <select
              className="funnel__input"
              value={form.stage}
              onChange={set("stage")}
            >
              <option value="">Без стадии</option>
              {(stages || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Источник</label>
            <input
              className="funnel__input"
              value={form.source}
              onChange={set("source")}
              placeholder="Сайт, Instagram…"
            />
          </div>
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Контактное лицо</label>
            <input
              className="funnel__input"
              value={form.full_name}
              onChange={set("full_name")}
            />
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Телефон</label>
            <input
              className="funnel__input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+996700000000"
            />
          </div>
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Email</label>
            <input
              className="funnel__input"
              type="email"
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Оценочная сумма, с</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_value}
              onChange={set("estimated_value")}
            />
          </div>
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Вероятность, %</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={set("probability")}
            />
          </div>
          {FUNNEL_V2 && (
            <div className="funnel__field">
              <label className="funnel__label">Срочность</label>
              <select
                className="funnel__input"
                value={form.urgency}
                onChange={set("urgency")}
              >
                {URGENCY.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Описание</label>
          <textarea
            className="funnel__input"
            rows={3}
            value={form.description}
            onChange={set("description")}
          />
        </div>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ===================== Карточка лида (детально) ===================== */
function findLead(board, leadId) {
  if (!board) return null;
  for (const col of board.columns || []) {
    const f = (col.leads || []).find((l) => l.id === leadId);
    if (f) return f;
  }
  return (board.unassigned || []).find((l) => l.id === leadId) || null;
}

function LeadDetail({ leadId, funnelId, stages, onClose }) {
  const dispatch = useDispatch();
  const { board, lossReasons = [], timeline, tasks } = useFunnel();
  const lead = findLead(board, leadId);

  const [tab, setTab] = useState("info");
  const [loseOpen, setLoseOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (FUNNEL_V2) {
      dispatch(getLeadTimeline(leadId));
      dispatch(getLeadTasks({ lead: leadId }));
    }
    return () => {
      dispatch(clearLeadDetail());
    };
  }, [dispatch, leadId]);

  if (!lead) {
    return (
      <Modal title="Лид" onClose={onClose} wide>
        <div className="funnel__form">Лид не найден.</div>
      </Modal>
    );
  }

  const closed = lead.status === "won" || lead.status === "lost";

  const onWin = async () => {
    setErr("");
    setBusy(true);
    try {
      await dispatch(winLead({ id: leadId })).unwrap();
    } catch (e) {
      setErr(errToText(e, "Не удалось закрыть как успех."));
    } finally {
      setBusy(false);
    }
  };

  const onRecalc = async () => {
    setBusy(true);
    try {
      await dispatch(recalculateScore(leadId)).unwrap();
    } catch (e) {
      setErr(errToText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={lead.title || "Лид"} onClose={onClose} wide>
      <div className="funnel__detailHead">
        <div className="funnel__detailBadges">
          {lead.score_grade && (
            <span
              className={`funnel__grade funnel__grade--${String(
                lead.score_grade
              ).toLowerCase()}`}
            >
              {lead.score_grade} · {lead.score_value ?? "—"}
            </span>
          )}
          <span className={`funnel__badge funnel__badge--${lead.status}`}>
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
          {lead.stage_name && (
            <span className="funnel__chip">{lead.stage_name}</span>
          )}
          {lead.is_at_risk && (
            <span className="funnel__chip funnel__chip--risk">⚠ Под риском</span>
          )}
        </div>
        {FUNNEL_V2 && (
          <div className="funnel__detailActions">
            <button className="funnel__btn" onClick={onRecalc} disabled={busy}>
              ↻ Скоринг
            </button>
            {!closed && (
              <>
                <button
                  className="funnel__btn funnel__btn--success"
                  onClick={onWin}
                  disabled={busy}
                >
                  Выиграть
                </button>
                <button
                  className="funnel__btn funnel__btn--danger"
                  onClick={() => setLoseOpen((v) => !v)}
                  disabled={busy}
                >
                  Проиграть
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!!err && <div className="funnel__error">{err}</div>}

      {FUNNEL_V2 && loseOpen && !closed && (
        <LoseForm
          leadId={leadId}
          lossReasons={lossReasons}
          onDone={() => setLoseOpen(false)}
          onError={setErr}
        />
      )}

      {FUNNEL_V2 && (
        <div className="funnel__tabs">
          {[
            ["info", "Информация"],
            ["timeline", "Лента"],
            ["tasks", "Задачи"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`funnel__tab${
                tab === key ? " funnel__tab--active" : ""
              }`}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "tasks" && tasks?.length ? ` (${tasks.length})` : ""}
            </button>
          ))}
        </div>
      )}

      {tab === "info" && (
        <LeadInfoForm
          lead={lead}
          funnelId={funnelId}
          stages={stages}
          onClose={onClose}
        />
      )}
      {FUNNEL_V2 && tab === "timeline" && (
        <TimelineTab leadId={leadId} timeline={timeline} />
      )}
      {FUNNEL_V2 && tab === "tasks" && (
        <TasksTab leadId={leadId} tasks={tasks} />
      )}
    </Modal>
  );
}

/* ---------- форма закрытия с потерей ---------- */
function LoseForm({ leadId, lossReasons, onDone, onError }) {
  const dispatch = useDispatch();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return onError("Выберите причину проигрыша.");
    setBusy(true);
    try {
      await dispatch(
        loseLead({ id: leadId, loss_reason: reason, loss_comment: comment })
      ).unwrap();
      onDone();
    } catch (e) {
      onError(errToText(e, "Не удалось закрыть с потерей."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="funnel__loseBox">
      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Причина *</label>
          <select
            className="funnel__input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">— выберите —</option>
            {lossReasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Комментарий</label>
          <input
            className="funnel__input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>
      <div className="funnel__formActions funnel__formActions--end">
        <button className="funnel__btn" onClick={onDone} disabled={busy}>
          Отмена
        </button>
        <button
          className="funnel__btn funnel__btn--danger"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "…" : "Закрыть с потерей"}
        </button>
      </div>
    </div>
  );
}

/* ---------- вкладка «Информация» ---------- */
function LeadInfoForm({ lead, funnelId, stages, onClose }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    title: lead.title || "",
    stage: lead.stage || "",
    source: lead.source || "",
    full_name: lead.full_name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    estimated_value:
      lead.estimated_value != null ? String(lead.estimated_value) : "",
    probability: lead.probability != null ? String(lead.probability) : "",
    urgency: lead.urgency || "medium",
    budget_confirmed: !!lead.budget_confirmed,
    decision_maker_engaged: !!lead.decision_maker_engaged,
    avg_response_minutes:
      lead.avg_response_minutes != null ? String(lead.avg_response_minutes) : "",
    next_action_type: lead.next_action_type || "",
    next_action_date: toLocalInput(lead.next_action_date),
    next_action_note: lead.next_action_note || "",
    description: lead.description || "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setChk = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.title.trim()) return setErr("Введите название лида.");
    const data = {
      funnel: funnelId,
      stage: form.stage || null,
      title: form.title.trim(),
      source: form.source.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      description: form.description.trim(),
      estimated_value:
        form.estimated_value === "" ? 0 : Number(form.estimated_value) || 0,
      probability: form.probability === "" ? 0 : Number(form.probability) || 0,
    };
    if (FUNNEL_V2) {
      data.urgency = form.urgency;
      data.budget_confirmed = form.budget_confirmed;
      data.decision_maker_engaged = form.decision_maker_engaged;
      data.avg_response_minutes =
        form.avg_response_minutes === ""
          ? null
          : Number(form.avg_response_minutes) || 0;
      data.next_action_type = form.next_action_type || null;
      data.next_action_date = fromLocalInput(form.next_action_date);
      data.next_action_note = form.next_action_note.trim();
    }

    setSaving(true);
    try {
      await dispatch(updateLead({ id: lead.id, data })).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось сохранить лид."));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteLead(lead.id)).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось удалить лид."));
      setDeleting(false);
    }
  };

  return (
    <form className="funnel__form" onSubmit={submit}>
      {!!err && <div className="funnel__error">{err}</div>}

      <div className="funnel__field">
        <label className="funnel__label">Название *</label>
        <input
          className="funnel__input"
          value={form.title}
          onChange={set("title")}
        />
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Стадия</label>
          <select
            className="funnel__input"
            value={form.stage}
            onChange={set("stage")}
          >
            <option value="">Без стадии</option>
            {(stages || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Источник</label>
          <input
            className="funnel__input"
            value={form.source}
            onChange={set("source")}
          />
        </div>
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Контактное лицо</label>
          <input
            className="funnel__input"
            value={form.full_name}
            onChange={set("full_name")}
          />
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Телефон</label>
          <input
            className="funnel__input"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Email</label>
          <input
            className="funnel__input"
            type="email"
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Оценочная сумма, с</label>
          <input
            className="funnel__input"
            type="number"
            min="0"
            step="0.01"
            value={form.estimated_value}
            onChange={set("estimated_value")}
          />
        </div>
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Вероятность, %</label>
          <input
            className="funnel__input"
            type="number"
            min="0"
            max="100"
            value={form.probability}
            onChange={set("probability")}
          />
        </div>
        {FUNNEL_V2 && (
          <div className="funnel__field">
            <label className="funnel__label">Срочность</label>
            <select
              className="funnel__input"
              value={form.urgency}
              onChange={set("urgency")}
            >
              {URGENCY.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {FUNNEL_V2 && (
        <>
          <div className="funnel__sectionTitle">Квалификация и скоринг</div>
          <div className="funnel__grid2">
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={form.budget_confirmed}
                onChange={setChk("budget_confirmed")}
              />
              Бюджет подтверждён
            </label>
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={form.decision_maker_engaged}
                onChange={setChk("decision_maker_engaged")}
              />
              ЛПР вовлечён
            </label>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Среднее время ответа, мин</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              value={form.avg_response_minutes}
              onChange={set("avg_response_minutes")}
            />
          </div>

          <div className="funnel__sectionTitle">Следующее действие</div>
          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Тип</label>
              <select
                className="funnel__input"
                value={form.next_action_type}
                onChange={set("next_action_type")}
              >
                <option value="">—</option>
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="funnel__field">
              <label className="funnel__label">Дата</label>
              <input
                className="funnel__input"
                type="datetime-local"
                value={form.next_action_date}
                onChange={set("next_action_date")}
              />
            </div>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Заметка</label>
            <input
              className="funnel__input"
              value={form.next_action_note}
              onChange={set("next_action_note")}
            />
          </div>
        </>
      )}

      <div className="funnel__field">
        <label className="funnel__label">Описание</label>
        <textarea
          className="funnel__input"
          rows={3}
          value={form.description}
          onChange={set("description")}
        />
      </div>

      {(lead.stage_entered_at || lead.last_activity_at) && (
        <p className="funnel__hint">
          В стадии с {fmtDate(lead.stage_entered_at)} · последняя активность{" "}
          {fmtDate(lead.last_activity_at)}
        </p>
      )}

      <div className="funnel__formActions">
        <button
          type="button"
          className="funnel__btn funnel__btn--danger"
          onClick={onDelete}
          disabled={deleting || saving}
        >
          {deleting ? "Удаление…" : "Удалить"}
        </button>
        <div className="funnel__formActionsRight">
          <button
            type="button"
            className="funnel__btn"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="funnel__btn funnel__btn--primary"
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------- вкладка «Лента» ---------- */
function TimelineTab({ leadId, timeline }) {
  const dispatch = useDispatch();
  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("Введите заголовок активности.");
    setBusy(true);
    try {
      await dispatch(
        addLeadActivity({ leadId, type, title: title.trim(), body: body.trim() })
      ).unwrap();
      setTitle("");
      setBody("");
    } catch (e2) {
      setErr(errToText(e2, "Не удалось добавить активность."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="funnel__tabBody">
      <form className="funnel__activityForm" onSubmit={add}>
        {!!err && <div className="funnel__error">{err}</div>}
        <div className="funnel__grid2">
          <select
            className="funnel__input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="funnel__input"
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <textarea
          className="funnel__input"
          rows={2}
          placeholder="Комментарий…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="funnel__formActions funnel__formActions--end">
          <button
            className="funnel__btn funnel__btn--primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "…" : "Добавить"}
          </button>
        </div>
      </form>

      <ul className="funnel__timeline">
        {(timeline || []).map((a) => (
          <li key={a.id} className="funnel__tlItem">
            <div className="funnel__tlDot" />
            <div className="funnel__tlContent">
              <div className="funnel__tlTitle">{a.title}</div>
              {a.body && <div className="funnel__tlBody">{a.body}</div>}
              <div className="funnel__tlMeta">
                {a.actor_display ? `${a.actor_display} · ` : ""}
                {fmtDate(a.created_at)}
              </div>
            </div>
          </li>
        ))}
        {!timeline?.length && (
          <li className="funnel__colEmpty">Активностей пока нет</li>
        )}
      </ul>
    </div>
  );
}

/* ---------- вкладка «Задачи» ---------- */
function TasksTab({ leadId, tasks }) {
  const dispatch = useDispatch();
  const [type, setType] = useState("call");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("Введите название задачи.");
    setBusy(true);
    try {
      await dispatch(
        createLeadTask({
          lead: leadId,
          type,
          title: title.trim(),
          due_date: fromLocalInput(due),
        })
      ).unwrap();
      setTitle("");
      setDue("");
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать задачу."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (t) =>
    dispatch(
      updateLeadTask({
        id: t.id,
        data: { status: t.status === "done" ? "open" : "done" },
      })
    );

  const remove = (id) => dispatch(deleteLeadTask(id));

  return (
    <div className="funnel__tabBody">
      <form className="funnel__activityForm" onSubmit={add}>
        {!!err && <div className="funnel__error">{err}</div>}
        <div className="funnel__grid2">
          <select
            className="funnel__input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="funnel__input"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <input
          className="funnel__input"
          placeholder="Название задачи"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="funnel__formActions funnel__formActions--end">
          <button
            className="funnel__btn funnel__btn--primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "…" : "Добавить задачу"}
          </button>
        </div>
      </form>

      <ul className="funnel__tasks">
        {(tasks || []).map((t) => (
          <li
            key={t.id}
            className={`funnel__task${
              t.status === "done" ? " funnel__task--done" : ""
            }${t.status === "overdue" ? " funnel__task--overdue" : ""}`}
          >
            <input
              type="checkbox"
              checked={t.status === "done"}
              onChange={() => toggle(t)}
            />
            <div className="funnel__taskBody">
              <div className="funnel__taskTitle">{t.title}</div>
              <div className="funnel__taskMeta">
                {t.due_date ? `до ${fmtDate(t.due_date)}` : "без срока"}
                {t.created_by_automation ? " · авто" : ""}
              </div>
            </div>
            <button
              className="funnel__iconBtn"
              onClick={() => remove(t.id)}
              aria-label="Удалить"
            >
              ×
            </button>
          </li>
        ))}
        {!tasks?.length && <li className="funnel__colEmpty">Задач пока нет</li>}
      </ul>
    </div>
  );
}

/* ===================== Аналитика ===================== */
function AnalyticsModal({ funnelId, onClose }) {
  const dispatch = useDispatch();
  const { analytics, analyticsLoading } = useFunnel();

  useEffect(() => {
    dispatch(getFunnelAnalytics({ funnelId }));
  }, [dispatch, funnelId]);

  const t = analytics?.totals;

  return (
    <Modal title="Аналитика воронки" onClose={onClose} wide>
      <div className="funnel__form">
        {analyticsLoading || !analytics ? (
          <div className="funnel__placeholder">Загрузка…</div>
        ) : (
          <>
            <div className="funnel__statGrid">
              <Stat label="Сделок" value={t?.deals ?? 0} />
              <Stat label="В работе, сумма" value={fmtMoney(t?.pipeline_value)} />
              <Stat label="Выиграно" value={t?.won ?? 0} />
              <Stat label="Проиграно" value={t?.lost ?? 0} />
              <Stat
                label="Win rate"
                value={
                  t?.win_rate != null ? `${Math.round(t.win_rate * 100)}%` : "—"
                }
              />
              <Stat label="Ср. цикл, дн." value={t?.avg_cycle_days ?? "—"} />
              <Stat label="Под риском" value={t?.at_risk ?? 0} />
            </div>

            <div className="funnel__sectionTitle">По стадиям</div>
            <div className="funnel__tableWrap">
              <table className="funnel__table">
                <thead>
                  <tr>
                    <th>Стадия</th>
                    <th>Кол-во</th>
                    <th>Сумма</th>
                    <th>Ср. часов</th>
                    <th>Конверсия</th>
                    <th>Отток</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.stages || []).map((s) => (
                    <tr key={s.stage_id}>
                      <td>{s.name}</td>
                      <td>{s.count}</td>
                      <td>{fmtMoney(s.value)}</td>
                      <td>{s.avg_hours_in_stage ?? "—"}</td>
                      <td>
                        {s.conversion_to_next != null
                          ? `${Math.round(s.conversion_to_next * 100)}%`
                          : "—"}
                      </td>
                      <td>
                        {s.drop_off_rate != null
                          ? `${Math.round(s.drop_off_rate * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="funnel__grid2">
              <div>
                <div className="funnel__sectionTitle">Причины оттока</div>
                <ul className="funnel__plainList">
                  {(analytics.by_loss_reason || []).map((r) => (
                    <li key={r.code}>
                      <span>{r.label}</span>
                      <strong>{r.count}</strong>
                    </li>
                  ))}
                  {!analytics.by_loss_reason?.length && (
                    <li className="funnel__colEmpty">Нет данных</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="funnel__sectionTitle">По качеству</div>
                <ul className="funnel__plainList">
                  {["A", "B", "C"].map((g) => (
                    <li key={g}>
                      <span>Грейд {g}</span>
                      <strong>{analytics.by_score?.[g] ?? 0}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }) {
  return (
    <div className="funnel__stat">
      <div className="funnel__statValue">{value}</div>
      <div className="funnel__statLabel">{label}</div>
    </div>
  );
}
