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
}) => {
  const headerDate = formatReceiptDate(group.created_at);

  const items = useMemo(() => group.items || [], [group.items]);

  return (
    <article className="cook__receipt">
      <div className="cook__receiptHeader">
        <div className="cook__receiptLeft">
          <div className="cook__receiptTable">СТОЛ {group.table_number || "—"}</div>

          {group.guest ? <div className="cook__receiptClient">{group.guest}</div> : null}

          {group.waiter_label ? (
            <div className="cook__receiptWaiter">Официант: {group.waiter_label}</div>
          ) : null}
        </div>

        <div className="cook__receiptMeta">
          {headerDate ? <div className="cook__receiptDate">{headerDate}</div> : null}
          <span
            className={`cook__receiptStatusBadge cook__receiptStatusBadge--${group.status}`}
            title="Общий статус заказа"
          >
            {getStatusLabel(group.status)}
          </span>
        </div>
      </div>

      <div className="cook__receiptDivider" />

      <div className="cook__summary">
        <button
          type="button"
          className="cook__toggle"
          onClick={onToggle}
          title={collapsed ? "Показать позиции" : "Свернуть позиции"}
        >
          {collapsed ? `Показать позиции (${items.length})` : `Свернуть позиции (${items.length})`}
        </button>
      </div>

      {/* Закрыто = ничего не показываем (как на твоём 2-м фото) */}
      {!collapsed && (
        <div className="cook__rows">
          {items.map((t, idx) => {
            const status = String(t?.status || "");
            const isPending = status === "pending";
            const isInProgress = status === "in_progress";
            const isReady = status === "ready";
            const updating = isUpdating(t.id);

            const portions = extractPortionsFromTask(t);

            return (
              <div key={t?.id || idx} className="cook__row">
                <div className="cook__rowLeft">
                  <div className="cook__rowTitle" title={t?.menu_item_title || ""}>
                    {t?.menu_item_title || "Блюдо"}
                  </div>
                  <div className="cook__rowSub">Кол-во: {portions}</div>
                </div>

                <div className="cook__rowRight">
                  <div className="cook__rowPrice">{toNum(t?.price)}</div>

                  <span className={`cook__receiptStatusBadge cook__receiptStatusBadge--${status}`}>
                    {getStatusLabel(status)}
                  </span>

                  {activeTab === "current" ? (
                    <>
                      {isPending && (
                        <button
                          className="cook__btn cook__btn--inProgress cook__btn--compact"
                          onClick={(e) => onClaimOne(t.id, e)}
                          disabled={updating}
                          type="button"
                        >
                          {updating ? "…" : "В работу"}
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          className="cook__btn cook__btn--ready cook__btn--compact"
                          onClick={(e) => onReadyOne(t, e)}
                          disabled={updating}
                          type="button"
                          title="ГОТОВ (списывает склад)"
                        >
                          {updating ? "…" : "Готов"}
                        </button>
                      )}

                      {isReady && (
                        <button
                          className="cook__btn cook__btn--ready cook__btn--compact"
                          disabled
                          type="button"
                        >
                          Готов
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "history" && group.status === "ready" ? (
        <div className="cook__receiptPaid">
          <span className="cook__receiptPaidBadge">ГОТОВ</span>
        </div>
      ) : null}
    </article>
  );
};

export default CookReceiptCard;
