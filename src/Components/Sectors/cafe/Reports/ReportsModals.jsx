import React, { useEffect } from "react";
import { FaSync, FaTimes } from "react-icons/fa";

/* ===== Modal shell ===== */
const Modal = ({ open, title, subtitle, onClose, children }) => {
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cafeAnalyticsModal" role="dialog" aria-modal="true">
      <button
        className="cafeAnalyticsModal__overlay"
        aria-label="Закрыть"
        onClick={onClose}
        type="button"
      />
      <div className="cafeAnalyticsModal__panel">
        <div className="cafeAnalyticsModal__head">
          <div className="cafeAnalyticsModal__headText">
            <div className="cafeAnalyticsModal__title">{title}</div>
            {subtitle ? <div className="cafeAnalyticsModal__sub">{subtitle}</div> : null}
          </div>
          <button className="cafeAnalyticsModal__close" onClick={onClose} type="button" aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>

        <div className="cafeAnalyticsModal__body">{children}</div>
      </div>
    </div>
  );
};

/* ===== Modal content (by modalKey) ===== */
const ReportsModalContent = ({
  modalKey,

  revenueTotal,
  trxCount,
  avgCheck,
  guestsCount,

  salesItems,
  lowStock,

  kitchenLoading,
  staffQ,
  setStaffQ,
  staffSort,
  setStaffSort,
  onRefreshKitchen,

  activeStaffRows,
  staffTotals,

  fmtInt,
  fmtMoney,
  toNum,
}) => {
  if (!modalKey) return null;

  if (modalKey === "revenue") {
    return (
      <div className="cafeAnalyticsModalContent">
        <div className="cafeAnalyticsModalContent__kpiRow cafeAnalyticsModalContent__kpiRow--2">
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Выручка</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtMoney(revenueTotal)}</div>
          </div>
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Транзакции</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtInt(trxCount)}</div>
          </div>
        </div>

        <div className="cafeAnalyticsModalContent__block">
          <div className="cafeAnalyticsModalContent__blockTitle">Топ блюд по выручке</div>
          <div className="cafeAnalyticsModalContent__tableWrap">
            <table className="cafeAnalyticsModalContent__table">
              <thead>
                <tr>
                  <th>Блюдо</th>
                  <th>Кол-во</th>
                  <th>Выручка</th>
                </tr>
              </thead>
              <tbody>
                {salesItems.map((x) => (
                  <tr key={x.menu_item_id || x.title}>
                    <td className="cafeAnalyticsModalContent__tdTitle" title={x.title}>
                      {x.title}
                    </td>
                    <td>{fmtInt(x.qty)}</td>
                    <td>{fmtMoney(toNum(x.revenue))}</td>
                  </tr>
                ))}
                {!salesItems.length && (
                  <tr>
                    <td colSpan={3} className="cafeAnalyticsModalContent__empty">
                      Нет данных.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (modalKey === "clients") {
    return (
      <div className="cafeAnalyticsModalContent">
        <div className="cafeAnalyticsModalContent__kpiRow cafeAnalyticsModalContent__kpiRow--1">
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Гости</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtInt(guestsCount)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (modalKey === "avg") {
    return (
      <div className="cafeAnalyticsModalContent">
        <div className="cafeAnalyticsModalContent__kpiRow cafeAnalyticsModalContent__kpiRow--2">
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Средний чек</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtMoney(avgCheck)}</div>
          </div>
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Транзакции</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtInt(trxCount)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (modalKey === "stock") {
    return (
      <div className="cafeAnalyticsModalContent">
        <div className="cafeAnalyticsModalContent__block">
          <div className="cafeAnalyticsModalContent__blockTitle">Позиции ниже минимума</div>
          <div className="cafeAnalyticsModalContent__tableWrap">
            <table className="cafeAnalyticsModalContent__table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Остаток</th>
                  <th>Минимум</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((x) => (
                  <tr key={x.id}>
                    <td className="cafeAnalyticsModalContent__tdTitle" title={x.title}>
                      {x.title}{" "}
                      <span className="cafeAnalyticsModalContent__unit">
                        {x.unit ? `· ${x.unit}` : ""}
                      </span>
                    </td>
                    <td>{String(x.remainder || "0")}</td>
                    <td>{String(x.minimum || "0")}</td>
                  </tr>
                ))}
                {!lowStock.length && (
                  <tr>
                    <td colSpan={3} className="cafeAnalyticsModalContent__empty">
                      Склад в норме: ниже минимума ничего нет.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (modalKey === "cooks" || modalKey === "waiters") {
    return (
      <div className="cafeAnalyticsModalContent">
        <div className="cafeAnalyticsStaffBar">
          <label className="cafeAnalyticsStaffBar__field">
            <span>Поиск</span>
            <input
              className="cafeAnalytics__input"
              value={staffQ}
              onChange={(e) => setStaffQ(e.target.value)}
              placeholder="Имя сотрудника…"
            />
          </label>

          <label className="cafeAnalyticsStaffBar__field">
            <span>Сортировка</span>
            <select
              className="cafeAnalyticsStaffBar__select"
              value={staffSort}
              onChange={(e) => setStaffSort(e.target.value)}
            >
              <option value="revenue_desc">Выручка ↓</option>
              <option value="orders_desc">Чеки ↓</option>
              <option value="avg_desc">Средний чек ↓</option>
              <option value="name_asc">Имя A–Я</option>
            </select>
          </label>

          <button
            className="cafeAnalytics__btn cafeAnalyticsStaffBar__btn"
            type="button"
            onClick={onRefreshKitchen}
            disabled={kitchenLoading}
          >
            <FaSync /> Обновить
          </button>
        </div>

        <div className="cafeAnalyticsModalContent__kpiRow cafeAnalyticsModalContent__kpiRow--3">
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Выручка</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtMoney(staffTotals.revenue)}</div>
          </div>
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Чеки</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtInt(staffTotals.orders)}</div>
          </div>
          <div className="cafeAnalyticsModalContent__kpi">
            <div className="cafeAnalyticsModalContent__kLabel">Позиции</div>
            <div className="cafeAnalyticsModalContent__kVal">{fmtInt(staffTotals.items)}</div>
          </div>
        </div>

        <div className="cafeAnalyticsModalContent__block">
          <div className="cafeAnalyticsModalContent__blockTitle">
            {modalKey === "cooks" ? "Рейтинг поваров" : "Рейтинг официантов"}
          </div>

          <div className="cafeAnalyticsModalContent__tableWrap">
            <table className="cafeAnalyticsModalContent__table cafeAnalyticsModalContent__table--staff">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Чеки</th>
                  <th>Позиции</th>
                  <th>Выручка</th>
                  <th>Средний чек</th>
                </tr>
              </thead>
              <tbody>
                {kitchenLoading && (
                  <tr>
                    <td colSpan={5} className="cafeAnalyticsModalContent__empty">
                      Загрузка…
                    </td>
                  </tr>
                )}

                {!kitchenLoading &&
                  activeStaffRows.map((x) => (
                    <tr key={x._id}>
                      <td className="cafeAnalyticsModalContent__tdTitle" title={x.name}>
                        {x.name}
                      </td>
                      <td>{fmtInt(x.orders_count)}</td>
                      <td>{fmtInt(x.items_qty)}</td>
                      <td>{fmtMoney(x.revenue)}</td>
                      <td>{fmtMoney(x.avg_check)}</td>
                    </tr>
                  ))}

                {!kitchenLoading && !activeStaffRows.length && (
                  <tr>
                    <td colSpan={5} className="cafeAnalyticsModalContent__empty">
                      Нет данных за выбранный период.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export { Modal, ReportsModalContent };
