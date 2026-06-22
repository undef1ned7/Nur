import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { usePointerReorder } from "../../../../hooks/usePointerReorder";
import {
  getAllowedTransitions,
  claimLead,
  updateStage,
  reorderStages,
} from "../../../../store/creators/funnelThunk";
import {
  isSystemStage,
  funnelProtectionLabel,
  getFunnelDisplayName,
} from "../../../../utils/consultingFunnelDefaults";
import {
  canManageLeadsInFunnel,
  canManageStagesInFunnel,
  canEditFunnelMeta,
} from "../../../../utils/consultingFunnelAccess";
import {
  canDragLead,
  filterActiveBoardLeads,
  isLeadOnCompletedStage,
} from "../../../../utils/consultingFunnelLeadUtils";

const COLLAPSED_KEY = "consulting_funnel_collapsed_v1";
const FUNNEL_V2 = import.meta.env.VITE_FUNNEL_V2 === "true";

function readCollapsedMap() {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "{}"); }
  catch { return {}; }
}
function isFunnelCollapsed(id) { return !!readCollapsedMap()[String(id)]; }
function setFunnelCollapsed(id, val) {
  const m = readCollapsedMap();
  m[String(id)] = val;
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(m));
}

const STATUS_LABELS = { new: "Новый", in_work: "В работе", won: "Успех", lost: "Отказ" };

const fmtMoney = (v) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString() + " с";

const fmtMoneyShort = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0) + " млн";
  if (n >= 1_000) return Math.round(n / 1000) + " тыс";
  return String(n);
};

/* ─── LeadCard ─────────────────────────────────────────────────── */
function LeadCard({ lead, dragging, onDragStart, onDragEnd, onClick, onClaim, claimBusy, canManageLeads, onTransfer, canDrag = true, completed = false }) {
  const inPool = !lead.owner;
  return (
    <article
      className={[
        "funnel__card",
        dragging    ? "funnel__card--dragging"  : "",
        lead.is_at_risk ? "funnel__card--risk"  : "",
        inPool      ? "funnel__card--pool"       : "",
        !canDrag    ? "funnel__card--readonly"   : "",
        completed   ? "funnel__card--completed"  : "",
      ].filter(Boolean).join(" ")}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={onClick}
    >
      <div className="funnel__cardTop">
        <div className="funnel__cardTitle" title={lead.title}>{lead.title || "Без названия"}</div>
        <div className="funnel__cardTopRight">
          {inPool && <span className="funnel__poolBadge">Пул</span>}
          {lead.score_grade && (
            <span className={`funnel__grade funnel__grade--${String(lead.score_grade).toLowerCase()}`}>
              {lead.score_grade}
            </span>
          )}
        </div>
      </div>
      {(lead.full_name || lead.phone) && (
        <div className="funnel__cardContact">
          {lead.full_name && <span className="funnel__cardName">{lead.full_name}</span>}
          {lead.phone && <span className="funnel__cardPhone">{lead.phone}</span>}
        </div>
      )}
      <div className="funnel__cardMeta">
        {Number(lead.estimated_value) > 0 && (
          <span className="funnel__cardValue">{fmtMoney(lead.estimated_value)}</span>
        )}
        <span className={`funnel__badge funnel__badge--${lead.status}`}>
          {STATUS_LABELS[lead.status] || lead.status}
        </span>
      </div>
      <div className="funnel__cardFoot">
        {inPool && canManageLeads ? (
          <button type="button" className="funnel__cardClaim" disabled={claimBusy}
            onClick={(e) => { e.stopPropagation(); onClaim?.(lead.id); }}>
            {claimBusy ? "…" : "Взять"}
          </button>
        ) : (
          lead.owner_display && <span className="funnel__cardOwner">{lead.owner_display}</span>
        )}
        {canManageLeads && (
          <button type="button" className="funnel__cardTransfer"
            onClick={(e) => { e.stopPropagation(); onTransfer?.(lead); }}
            title="Передать в другую воронку">⇄</button>
        )}
      </div>
    </article>
  );
}

/* ─── Column ────────────────────────────────────────────────────── */
function Column({
  stage, leads, unassigned,
  isOver, dragLeadId, dropState,
  onDragOver, onDragLeave, onDrop,
  onCardDragStart, onCardDragEnd,
  onAddLead, onCardClick, onClaimLead, onTransferLead,
  onEditStage, onDeleteStage,
  claimBusyId, canManageLeads, canManageStages,
  board, profile,
  // stage reorder (pointer-based)
  isStageDragging, isStageDragOver, canDragStage,
  onStageHandlePointerDown,    // (e, stageId) => void
}) {
  const stageColor = stage?.color || "#cbd5e1";
  const sum = leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);
  const systemStage = !unassigned && isSystemStage(stage);

  // Колонка — drop-таргет только для нативного drag лидов.
  // Перетаскивание самих стадий работает на pointer-событиях (см. handle ниже).
  const handleDragOver = (e) => {
    if (!canManageLeads) return;
    e.preventDefault();
    onDragOver?.(e);
  };
  const handleDragLeave = (e) => {
    if (canManageLeads) onDragLeave?.(e);
  };
  const handleDrop = (e) => {
    if (!canManageLeads) return;
    e.preventDefault();
    onDrop?.(e);
  };

  return (
    <div
      data-stage-id={!unassigned && stage?.id ? String(stage.id) : undefined}
      className={[
        "funnel__col",
        isOver           ? "funnel__col--over"          : "",
        dropState === "allowed" ? "funnel__col--allowed" : "",
        dropState === "blocked" ? "funnel__col--blocked" : "",
        systemStage      ? "funnel__col--system"         : "",
        isStageDragging  ? "funnel__col--stageDragging"  : "",
        isStageDragOver  ? "funnel__col--stageDragOver"  : "",
      ].filter(Boolean).join(" ")}
      style={{ "--stage-color": stageColor }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="funnel__colBar" />
      <div className="funnel__colHead">
        <div className="funnel__colTitleRow">
          {canDragStage && !unassigned && (
            <span
              className="funnel__colDragHandle"
              onPointerDown={(e) => onStageHandlePointerDown?.(e, String(stage?.id))}
              title="Перетащить стадию"
            >
              ⠿
            </span>
          )}
          <span className="funnel__colDot" style={{ background: stageColor }} />
          <span className="funnel__colName">{stage?.name || "—"}</span>
          {systemStage && <span className="funnel__colLock">🔒</span>}
          <span className="funnel__colCount">{leads.length}</span>
          {canManageStages && !unassigned && !systemStage && stage?.id && (
            <span className="funnel__colStageActions">
              <button type="button" className="funnel__colStageBtn"
                title="Изменить стадию" onClick={() => onEditStage?.(stage)}>✎</button>
              <button type="button" className="funnel__colStageBtn funnel__colStageBtn--danger"
                title="Удалить стадию" onClick={() => onDeleteStage?.(stage)}>×</button>
            </span>
          )}
        </div>
        {sum > 0 && <span className="funnel__colSum">{fmtMoneyShort(sum)} с</span>}
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
            onClaim={onClaimLead}
            onTransfer={onTransferLead}
            claimBusy={claimBusyId === lead.id}
            canManageLeads={canManageLeads}
            canDrag={canDragLead(lead, board, profile, canManageLeads)}
            completed={isLeadOnCompletedStage(lead, board)}
          />
        ))}
        {!leads.length && (
          <div className="funnel__colEmpty">
            {canManageLeads ? "Перетащите карточку" : "Нет лидов"}
          </div>
        )}
      </div>
      {!unassigned && canManageLeads && (
        <button type="button" className="funnel__colAdd" onClick={onAddLead}>
          <span>+</span> Добавить лид
        </button>
      )}
    </div>
  );
}

/* ─── FunnelBoardRow ────────────────────────────────────────────── */
export default function FunnelBoardRow({
  funnel, board, profile, isManager,
  matchLead, hasFilters,
  dragState, onDragStart, onDragEnd, onDropStage,
  boardRef, claimBusyId, onClaimLead,
  onOpenLead, onCreateLead, onTransferLead,
  onEditStage, onDeleteStage, onEditFunnel, onDeleteFunnel, onAddStage,
  allowedTransitions, onRefreshBoard,
  // funnel row reorder (pointer-based, из Funnel.jsx)
  funnelDragId, isDragOver, onFunnelHandlePointerDown,
}) {
  const dispatch = useDispatch();
  const [dragOverStage, setDragOverStage] = useState(null);
  const [collapsed, setCollapsed] = useState(() => isFunnelCollapsed(funnel.id));

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setFunnelCollapsed(funnel.id, next);
      return next;
    });
  }, [funnel.id]);

  const canManageLeads  = canManageLeadsInFunnel(profile, funnel);
  const canManageStages = canManageStagesInFunnel(profile, funnel);
  const canEditMeta     = canEditFunnelMeta(profile, funnel);
  const tag             = funnelProtectionLabel(funnel);

  const rawColumns    = board?.columns   || [];
  const rawUnassigned = board?.unassigned || [];
  const totalLeads    = board?.funnel?.leads_count ?? 0;

  const mapLeads = (leads) => {
    const active = filterActiveBoardLeads(leads);
    return hasFilters ? active.filter(matchLead) : active;
  };

  const columns    = rawColumns.map((c) => ({ ...c, leads: mapLeads(c.leads) }));
  const unassigned = mapLeads(rawUnassigned);
  const shownLeads = columns.reduce((n, c) => n + (c.leads?.length || 0), 0) + unassigned.length;

  const dragLeadId     = dragState?.funnelId === funnel.id ? dragState.leadId : null;
  const allowedStageIds = dragLeadId && allowedTransitions
    ? new Set((allowedTransitions.allowed || []).map((s) => s.id))
    : null;

  const handleLeadDrop = (stageId) => {
    if (!canManageLeads || !dragLeadId) return;
    setDragOverStage(null);
    onDropStage?.(funnel.id, dragLeadId, stageId);
  };

  const handleClaim = async (leadId) => {
    if (!canManageLeads) return;
    try { await dispatch(claimLead(leadId)).unwrap(); } catch {}
    onClaimLead?.(leadId);
  };

  /* ── stage reorder (pointer-based) ── */
  const handleStageReorder = useCallback(
    async (fromId, targetStageId) => {
      if (!fromId || String(fromId) === String(targetStageId)) return;

      const fromIdx = rawColumns.findIndex((c) => String(c.stage?.id) === String(fromId));
      const toIdx   = rawColumns.findIndex((c) => String(c.stage?.id) === String(targetStageId));
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = [...rawColumns];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);

      const updates = reordered
        .map((col, idx) => ({ stage: col.stage, newOrder: idx }))
        .filter(({ stage, newOrder }) => !isSystemStage(stage) && stage?.order !== newOrder);

      if (!updates.length) return;

      try {
        // Сначала bulk-эндпоинт одним запросом; при 404 — fallback на N×PATCH.
        try {
          const items = updates.map(({ stage, newOrder }) => ({
            id: stage.id,
            order: newOrder,
          }));
          await dispatch(reorderStages(items)).unwrap();
        } catch (err) {
          if (err?.status === 404) {
            await Promise.all(
              updates.map(({ stage, newOrder }) =>
                dispatch(updateStage({ id: stage.id, data: { order: newOrder } })).unwrap()
              )
            );
          } else {
            throw err;
          }
        }
        onRefreshBoard?.();
      } catch { /* доска остаётся как есть */ }
    },
    [rawColumns, dispatch, onRefreshBoard]
  );

  const {
    dragId: stageDragId,
    overId: stageDragOverId,
    onHandlePointerDown: onStageHandlePointerDown,
  } = usePointerReorder({
    itemSelector: ".funnel__col",
    idAttr: "data-stage-id",
    onReorder: handleStageReorder,
  });

  /* ── early returns ── */
  if (!board) {
    return (
      <section className="funnel__row">
        <div className="funnel__rowHead">
          <h3 className="funnel__rowTitle">{getFunnelDisplayName(funnel)}</h3>
        </div>
        <div className="funnel__placeholder funnel__placeholder--sm">Загрузка…</div>
      </section>
    );
  }

  if (!rawColumns.length && !rawUnassigned.length) {
    return (
      <section className="funnel__row">
        <div className="funnel__rowHead">
          <h3 className="funnel__rowTitle">
            {getFunnelDisplayName(funnel)}
            {tag && <span className="funnel__rowTag">{tag}</span>}
          </h3>
          <div className="funnel__rowActions">
            {canManageStages && (
              <button type="button" className="funnel__btn funnel__btn--sm"
                onClick={() => onAddStage?.(funnel.id)}>+ Стадия</button>
            )}
          </div>
        </div>
        <div className="funnel__placeholder funnel__placeholder--sm">
          Нет стадий. Добавьте стадию для работы с лидами.
        </div>
      </section>
    );
  }

  const isDraggingThisRow = funnelDragId === String(funnel.id);

  return (
    <section
      data-funnel-id={String(funnel.id)}
      className={[
        "funnel__row",
        collapsed        ? "funnel__row--collapsed" : "",
        isDraggingThisRow ? "funnel__row--dragging"  : "",
        isDragOver && !isDraggingThisRow ? "funnel__row--dragOver" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="funnel__rowHead">
        {/* drag handle — только если есть доступ на изменение воронки.
            Перетаскивание на pointer-событиях (кросс-браузерно + тач). */}
        {canEditMeta && (
          <span
            className="funnel__rowDragHandle"
            title="Перетащить воронку"
            onPointerDown={(e) => onFunnelHandlePointerDown?.(e, String(funnel.id))}
          >
            ⠿
          </span>
        )}

        <button type="button" className="funnel__rowToggle"
          onClick={toggleCollapsed} aria-expanded={!collapsed}>
          <span className="funnel__rowChevron" aria-hidden>
            {collapsed ? "▸" : "▾"}
          </span>
          <span className="funnel__rowTitle">
            {getFunnelDisplayName(funnel)}
            {tag && <span className="funnel__rowTag">{tag}</span>}
          </span>
          {collapsed && (
            <span className="funnel__rowMeta funnel__rowMeta--inline">{totalLeads} лид(ов)</span>
          )}
        </button>

        {!collapsed && (
          <p className="funnel__rowMeta">
            {hasFilters ? `Показано ${shownLeads} из ${totalLeads}` : `${totalLeads} лид(ов)`}
          </p>
        )}

        <div className="funnel__rowActions">
          {isManager && canEditMeta && (
            <button type="button" className="funnel__btn funnel__btn--sm"
              onClick={() => onEditFunnel?.(funnel)}>Изменить</button>
          )}
          {isManager && canEditMeta && (
            <button type="button" className="funnel__btn funnel__btn--sm funnel__btn--danger"
              onClick={() => onDeleteFunnel?.(funnel)}>Удалить</button>
          )}
          {canManageStages && (
            <button type="button" className="funnel__btn funnel__btn--sm"
              onClick={() => onAddStage?.(funnel.id)}>+ Стадия</button>
          )}
          {canManageLeads && (
            <button type="button" className="funnel__btn funnel__btn--sm funnel__btn--primary"
              onClick={() => onCreateLead?.(funnel.id, columns[0]?.stage?.id)}>+ Лид</button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="funnel__board funnel__board--row" ref={boardRef}>
          {columns.map((col) => (
            <Column
              key={col.stage?.id}
              stage={col.stage}
              leads={col.leads || []}
              isOver={dragOverStage === col.stage?.id}
              dragLeadId={dragLeadId}
              dropState={
                !dragLeadId || !allowedStageIds ? null
                  : allowedStageIds.has(col.stage?.id) ? "allowed" : "blocked"
              }
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(col.stage?.id); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => handleLeadDrop(col.stage?.id)}
              onCardDragStart={(leadId) => {
                if (FUNNEL_V2) dispatch(getAllowedTransitions(leadId));
                onDragStart?.(funnel.id, leadId);
              }}
              onCardDragEnd={onDragEnd}
              onAddLead={() => onCreateLead?.(funnel.id, col.stage?.id)}
              onCardClick={(lead) => onOpenLead?.(funnel.id, lead.id)}
              onClaimLead={handleClaim}
              onTransferLead={(lead) => onTransferLead?.(funnel.id, lead)}
              onEditStage={(stage) => onEditStage?.(funnel.id, stage)}
              onDeleteStage={(stage) => onDeleteStage?.(funnel.id, stage)}
              claimBusyId={claimBusyId}
              canManageLeads={canManageLeads}
              canManageStages={canManageStages}
              board={board}
              profile={profile}
              // stage reorder (pointer-based)
              isStageDragging={String(stageDragId) === String(col.stage?.id)}
              isStageDragOver={String(stageDragOverId) === String(col.stage?.id)}
              canDragStage={canManageStages && !isSystemStage(col.stage)}
              onStageHandlePointerDown={onStageHandlePointerDown}
            />
          ))}

          {!!unassigned.length && (
            <Column
              stage={{ name: "Без стадии", color: "#94a3b8" }}
              leads={unassigned}
              unassigned
              isOver={dragOverStage === "unassigned"}
              dragLeadId={dragLeadId}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage("unassigned"); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => handleLeadDrop(null)}
              onCardDragStart={(leadId) => onDragStart?.(funnel.id, leadId)}
              onCardDragEnd={onDragEnd}
              onCardClick={(lead) => onOpenLead?.(funnel.id, lead.id)}
              onClaimLead={handleClaim}
              onTransferLead={(lead) => onTransferLead?.(funnel.id, lead)}
              claimBusyId={claimBusyId}
              canManageLeads={canManageLeads}
              canManageStages={false}
              board={board}
              profile={profile}
              isStageDragging={false}
              isStageDragOver={false}
              canDragStage={false}
            />
          )}
        </div>
      )}
    </section>
  );
}
