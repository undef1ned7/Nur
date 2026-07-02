import { useMemo } from "react";
import { TAKEAWAY_LABEL } from "../../utils/resolveTableLabel";
import "../../Tables/Tables.scss";

const asKey = (v) => (v === null || v === undefined ? "" : String(v));

const isUnpaid = (s) => {
  const v = (s || "").toString().trim().toLowerCase();
  return ![
    "paid",
    "оплачен",
    "оплачено",
    "closed",
    "done",
    "completed",
    "cancelled",
    "canceled",
    "отменён",
    "отменен",
  ].includes(v);
};

const pickItemTitle = (it) =>
  String(
    it?.menu_item_title ??
      it?.menu_item_name ??
      it?.menu_item?.title ??
      it?.title ??
      it?.name ??
      "",
  ).trim();

const COLLAPSED_LIMIT = 4;

/**
 * Доска столов для официанта — как «Зал» на странице Столы, но без изменения/удаления.
 * Клик по свободному столу / «С собой» — создать заказ, по занятому — открыть заказ.
 */
const TablesBoard = ({ tables = [], orders = [], onCreate, onOpen }) => {
  const activeByTable = useMemo(() => {
    const m = new Map();
    for (const o of orders || []) {
      if (!isUnpaid(o?.status)) continue;
      const key = asKey(o?.table?.id ?? o?.table);
      if (!key) continue;
      const ex = m.get(key) || { orders: [] };
      ex.orders.push(o);
      m.set(key, ex);
    }
    return m;
  }, [orders]);

  const sortedTables = useMemo(
    () =>
      [...(tables || [])].sort(
        (a, b) => (Number(a?.number) || 0) - (Number(b?.number) || 0),
      ),
    [tables],
  );

  return (
    <div className="cafeTables cafeTables--board">
      <div className="cafeTables__hallGrid">
        {/* С собой */}
        <article
          className="cafeTables__hallCard"
          style={{ cursor: "pointer" }}
          onClick={() => onCreate("")}
        >
          <div className="cafeTables__hallHead">
            <div className="cafeTables__hallTitle">{TAKEAWAY_LABEL}</div>
          </div>
          <div className="cafeTables__hallBody">
            <div className="cafeTables__hallEmpty">Заказ на вынос</div>
          </div>
          <div className="cafeTables__hallStatus cafeTables__hallStatus--free">
            С СОБОЙ
          </div>
        </article>

        {sortedTables.map((t) => {
          const key = asKey(t?.id);
          const group = activeByTable.get(key);
          const isBusy = !!group;
          const latest = group?.orders?.[0] || null;

          const rawItems =
            group?.orders?.flatMap((o) =>
              Array.isArray(o.items) ? o.items : [],
            ) || [];
          const agg = new Map();
          for (const it of rawItems) {
            const title = pickItemTitle(it);
            if (!title) continue;
            const qty = Math.max(1, Number(it?.quantity) || 1);
            agg.set(title, (agg.get(title) || 0) + qty);
          }
          const dishes = Array.from(agg.entries())
            .sort((a, b) => a[0].localeCompare(b[0], "ru"))
            .map(([title, qty]) => (qty > 1 ? `${title} x${qty}` : title));
          const visibleDishes = dishes.slice(0, COLLAPSED_LIMIT);
          const moreCount = Math.max(0, dishes.length - COLLAPSED_LIMIT);

          const label = t?.number ?? t?.name ?? t?.title ?? "";

          return (
            <article
              key={t.id}
              className="cafeTables__hallCard"
              style={{ cursor: "pointer" }}
              onClick={() => (isBusy ? onOpen?.(latest) : onCreate(t.id))}
            >
              <div className="cafeTables__hallHead">
                <div className="cafeTables__hallTitle">СТОЛ {label}</div>
              </div>

              <div className="cafeTables__hallBody">
                {isBusy ? (
                  dishes.length ? (
                    <div className="cafeTables__dishes">
                      {visibleDishes.map((name, idx) => (
                        <div
                          key={`${t.id}-${idx}`}
                          className="cafeTables__dish"
                          title={name}
                        >
                          {name}
                        </div>
                      ))}
                      {moreCount > 0 && (
                        <div className="cafeTables__dish">
                          + ещё {moreCount}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="cafeTables__hallEmpty">Заказ в работе</div>
                  )
                ) : (
                  <div className="cafeTables__hallEmpty">Нет активного заказа</div>
                )}
              </div>

              <div
                className={`cafeTables__hallStatus ${
                  isBusy
                    ? "cafeTables__hallStatus--busy"
                    : "cafeTables__hallStatus--free"
                }`}
              >
                {isBusy ? "ЗАНЯТ" : "СВОБОДЕН"}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default TablesBoard;
