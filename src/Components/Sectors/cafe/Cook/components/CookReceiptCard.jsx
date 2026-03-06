import React, { useMemo } from "react";

const CookReceiptCard = ({
  group,
  activeTab,
  collapsed,
  onToggle,
  formatReceiptDate,
  getStatusLabel,
  extractPortionsFromTask,
  toNum,
  isUpdating,
  onClaimOne,
  onReadyOne,
  onRemoveAfterReady
}) => {
  const headerDate = formatReceiptDate(group.created_at);
  const status = String(group?.status || "");
  const isPending = status === "pending";
  const isInProgress = status === "in_progress";
  const isReady = status === "ready";
  const isTakeaway =
    group?.table_number === null ||
    group?.table_number === undefined ||
    group?.table_number === "";
  const updating =
    isUpdating(group.id) ||
    (Array.isArray(group?.tasks_ids) && group.tasks_ids.some((id) => isUpdating(id)));
  const portions = extractPortionsFromTask(group);

  return (
    <article className="cafeCook__receipt">
      <div className="cafeCook__receiptHeader">
        <div className="cafeCook__receiptLeft">
          <div className="cafeCook__receiptTable">
            {isTakeaway ? "С собой" : `СТОЛ ${group.table_number || "—"}`}
          </div>
          {group.waiter_label ? (
            <div className="cafeCook__receiptWaiter">Официант: {group.waiter_label}</div>
          ) : null}
        </div>

        <div className="cafeCook__receiptMeta">
          {headerDate ? <div className="cafeCook__receiptDate">{headerDate}</div> : null}
        </div>
      </div>

      <div className="cafeCook__receiptDivider" />
      <div className="cafeCook__row">
        <div className="cafeCook__rowLeft">
          <div className="cafeCook__rowTitle" title={group?.menu_item_title || ""}>
            {group?.menu_item_title || "Блюдо"}
          </div>
          <div className="cafeCook__rowSub">Кол-во: {portions}</div>
        </div>

        <div className="cafeCook__rowRight">
          <span className={`cafeCook__receiptStatusBadge cafeCook__receiptStatusBadge--${status}`}>
            {getStatusLabel(status)}
          </span>

          {activeTab === "current" ? (
            <>
              {isPending && (
                <button
                  className="cafeCook__btn cafeCook__btn--inProgress cafeCook__btn--compact"
                  onClick={(e) => onClaimOne(group, e)}
                  disabled={updating}
                  type="button"
                >
                  {updating ? "…" : "В работу"}
                </button>
              )}

              {isInProgress && (
                <button
                  className="cafeCook__btn cafeCook__btn--ready cafeCook__btn--compact"
                  onClick={(e) => onReadyOne(group, e)}
                  disabled={updating}
                  type="button"
                  title="ГОТОВ (списывает склад)"
                >
                  {updating ? "…" : "Готов"}
                </button>
              )}

              {isReady && (
                <button
                  className="cafeCook__btn cafeCook__btn--ready cafeCook__btn--compact"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAfterReady(group?.tasks_ids?.length ? group.tasks_ids : group.id);
                  }}
                  type="button"
                >
                  Убрать
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
      {activeTab === "history" && group.status === "ready" ? (
        <div className="cafeCook__receiptPaid">
          <span className="cafeCook__receiptPaidBadge">ГОТОВ</span>
        </div>
      ) : null}
    </article>
  );
};

export default CookReceiptCard;
