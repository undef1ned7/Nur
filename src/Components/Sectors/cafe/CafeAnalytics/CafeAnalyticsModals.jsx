// src/.../CafeAnalyticsModals.jsx
import React, { useEffect } from "react";
import { FaSync, FaTimes } from "react-icons/fa";

/* ===== Modal shell ===== */
const CafeAnalyticsModal = ({ open, title, subtitle, onClose, children }) => {
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
    <div className="cafeAnalytics__modal" role="dialog" aria-modal="true">
      <button
        className="cafeAnalytics__modalOverlay"
        aria-label="Закрыть"
        onClick={onClose}
        type="button"
      />
      <div className="cafeAnalytics__modalPanel">
        <div className="cafeAnalytics__modalHead">
          <div className="cafeAnalytics__modalHeadText">
            <div className="cafeAnalytics__modalTitle">{title}</div>
            {subtitle ? <div className="cafeAnalytics__modalSub">{subtitle}</div> : null}
          </div>
          <button className="cafeAnalytics__modalClose" onClick={onClose} type="button" aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>

        <div className="cafeAnalytics__modalBody">{children}</div>
      </div>
    </div>
  );
};

/* ===== Modal content (by modalKey) ===== */
const CafeAnalyticsModalContent = ({
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
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--2">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Выручка</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(revenueTotal)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Транзакции</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(trxCount)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">Топ блюд по выручке</div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable">
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
                    <td className="cafeAnalytics__modalTdTitle" title={x.title}>
                      {x.title}
                    </td>
                    <td>{fmtInt(x.qty)}</td>
                    <td>{fmtMoney(toNum(x.revenue))}</td>
                  </tr>
                ))}
                {!salesItems.length && (
                  <tr>
                    <td colSpan={3} className="cafeAnalytics__modalEmpty">
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
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--1">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Гости</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(guestsCount)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (modalKey === "avg") {
    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--2">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Средний чек</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(avgCheck)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Транзакции</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(trxCount)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (modalKey === "stock") {
    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">Позиции ниже минимума</div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable">
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
                    <td className="cafeAnalytics__modalTdTitle" title={x.title}>
                      {x.title}{" "}
                      <span className="cafeAnalytics__modalUnit">{x.unit ? `· ${x.unit}` : ""}</span>
                    </td>
                    <td>{String(x.remainder || "0")}</td>
                    <td>{String(x.minimum || "0")}</td>
                  </tr>
                ))}
                {!lowStock.length && (
                  <tr>
                    <td colSpan={3} className="cafeAnalytics__modalEmpty">
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
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__staffBar">
          <label className="cafeAnalytics__staffField">
            <span>Поиск</span>
            <input
              type="text"
              className="cafeAnalytics__input"
              value={staffQ}
              onChange={(e) => setStaffQ(e.target.value)}
              placeholder="Имя сотрудника…"
            />
          </label>

          <label className="cafeAnalytics__staffField">
            <span>Сортировка</span>
            <select
              className="cafeAnalytics__staffSelect"
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
            className="cafeAnalytics__btn cafeAnalytics__staffBtn"
            type="button"
            onClick={onRefreshKitchen}
            disabled={kitchenLoading}
          >
            <FaSync /> Обновить
          </button>
        </div>

        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--3">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Выручка</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(staffTotals.revenue)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Чеки</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(staffTotals.orders)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Позиции</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(staffTotals.items)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">
            {modalKey === "cooks" ? "Рейтинг поваров" : "Рейтинг официантов"}
          </div>

          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable cafeAnalytics__modalTable--staff">
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
                    <td colSpan={5} className="cafeAnalytics__modalEmpty">
                      Загрузка…
                    </td>
                  </tr>
                )}

                {!kitchenLoading &&
                  activeStaffRows.map((x) => (
                    <tr key={x._id}>
                      <td className="cafeAnalytics__modalTdTitle" title={x.name}>
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
                    <td colSpan={5} className="cafeAnalytics__modalEmpty">
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

export { CafeAnalyticsModal, CafeAnalyticsModalContent };
