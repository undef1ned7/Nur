// src/.../CafeAnalyticsModals.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaChevronDown, FaChevronRight, FaSync, FaTimes, FaDownload } from "react-icons/fa";

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
};

const PAYMENT_LABEL = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  mixed: "Смешанная оплата",
};

const pickPaymentLabel = (code) =>
  (code && PAYMENT_LABEL[String(code).toLowerCase()]) || code || "—";

const pickStatusLabel = (s) => {
  if (!s) return "—";
  const v = String(s).toLowerCase().replace(/\s+/g, "_");
  if (v === "closed") return "Закрыт";
  if (v === "paid") return "Оплачен";
  if (v === "open") return "Открыт";
  if (v === "cancelled" || v === "canceled") return "Отменён";
  return s;
};

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
  cafeClients,

  salesItems,
  allMenuItems = [],
  allMenuItemsLoading = false,
  allMenuMeta = {},
  onExportMenuAllPdf,
  menuAllHideZeroQty = false,
  setMenuAllHideZeroQty,
  menuAllDateFrom = "",
  setMenuAllDateFrom,
  menuAllDateTo = "",
  setMenuAllDateTo,
  onMenuAllApplyDates,
  onMenuAllQuickRange,
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

  exportReport,
  setExportReport,
  exportFormat,
  setExportFormat,
  exportDateFrom,
  setExportDateFrom,
  exportDateTo,
  setExportDateTo,
  exportLoading,
  exportError,
  onExport,

  revenueInflowRows = [],
  rejectionRows = [],
  expensesBlock = { total: 0, count: 0, categories: [] },
  debtRows = [],
  waiterSalaryRows = [],
}) => {
  const [expandedGuestId, setExpandedGuestId] = useState(null);
  const [salaryQ, setSalaryQ] = useState("");
  const [salarySort, setSalarySort] = useState("total_desc");

  useEffect(() => {
    if (modalKey !== "clients") setExpandedGuestId(null);
  }, [modalKey]);

  useEffect(() => {
    if (modalKey !== "salary_waiters") {
      setSalaryQ("");
      setSalarySort("total_desc");
    }
  }, [modalKey]);

  const salaryFiltered = useMemo(() => {
    const rows = Array.isArray(waiterSalaryRows) ? waiterSalaryRows : [];
    const q = (salaryQ || "").trim().toLowerCase();
    const base = q
      ? rows.filter((x) => String(x?.name || "").toLowerCase().includes(q))
      : rows.slice();
    base.sort((a, b) => {
      if (salarySort === "name_asc")
        return String(a.name || "").localeCompare(String(b.name || ""), "ru");
      if (salarySort === "revenue_desc")
        return toNum(b.waiter_revenue) - toNum(a.waiter_revenue);
      return toNum(b.total) - toNum(a.total);
    });
    return base;
  }, [waiterSalaryRows, salaryQ, salarySort]);

  const salaryTotals = useMemo(() => {
    const rows = Array.isArray(waiterSalaryRows) ? waiterSalaryRows : [];
    return {
      total: rows.reduce((a, x) => a + toNum(x?.total), 0),
      base: rows.reduce((a, x) => a + toNum(x?.base_part), 0),
      percent: rows.reduce((a, x) => a + toNum(x?.percent_part), 0),
      revenue: rows.reduce((a, x) => a + toNum(x?.waiter_revenue), 0),
    };
  }, [waiterSalaryRows]);

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

  if (modalKey === "menu_all") {
    const rowsBase = Array.isArray(allMenuItems) ? allMenuItems : [];
    const rows = menuAllHideZeroQty
      ? rowsBase.filter((x) => toNum(x?.qty) !== 0)
      : rowsBase;
    const totalQty = rows.reduce((a, x) => a + toNum(x?.qty), 0);
    const totalRevenue = rows.reduce((a, x) => a + toNum(x?.revenue), 0);
    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__staffBar">
          <label className="cafeAnalytics__staffField">
            <span>От</span>
            <input
              type="date"
              className="cafeAnalytics__input"
              value={menuAllDateFrom || ""}
              onChange={(e) => setMenuAllDateFrom?.(e.target.value)}
            />
          </label>
          <label className="cafeAnalytics__staffField">
            <span>До</span>
            <input
              type="date"
              className="cafeAnalytics__input"
              value={menuAllDateTo || ""}
              onChange={(e) => setMenuAllDateTo?.(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="cafeAnalytics__btn cafeAnalytics__btn--sm"
            onClick={() => onMenuAllQuickRange?.("today")}
          >
            Сегодня
          </button>
          <button
            type="button"
            className="cafeAnalytics__btn cafeAnalytics__btn--sm"
            onClick={() => onMenuAllQuickRange?.("yesterday")}
          >
            Вчера
          </button>
          <button
            type="button"
            className="cafeAnalytics__btn cafeAnalytics__btn--sm"
            onClick={() => onMenuAllQuickRange?.("3days")}
          >
            За 3 дня
          </button>
          <button
            type="button"
            className="cafeAnalytics__btn cafeAnalytics__btn--sm"
            onClick={() => onMenuAllQuickRange?.("week")}
          >
            Неделя
          </button>
          <button
            type="button"
            className="cafeAnalytics__btn cafeAnalytics__staffBtn"
            onClick={onMenuAllApplyDates}
            disabled={allMenuItemsLoading}
          >
            <FaSync /> Обновить
          </button>
          <label className="cafeAnalytics__toggleCheck">
            <input
              type="checkbox"
              checked={menuAllHideZeroQty}
              onChange={(e) => setMenuAllHideZeroQty(e.target.checked)}
            />
            <span>Скрыть блюда с нулевым количеством продаж</span>
          </label>
        </div>

        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--3">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Блюд в отчете</div>
            <div className="cafeAnalytics__modalKVal">
              {fmtInt(allMenuMeta?.total_items || rows.length)}
            </div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Порций</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(totalQty)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Выручка</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(totalRevenue)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockHead">
            <div className="cafeAnalytics__modalBlockTitle">Все блюда по выручке</div>
            <button
              type="button"
              className="cafeAnalytics__btn cafeAnalytics__btn--sm"
              onClick={onExportMenuAllPdf}
              disabled={allMenuItemsLoading || !rows.length}
            >
              <FaDownload /> Экспорт PDF
            </button>
          </div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable">
              <thead>
                <tr>
                  <th>Блюдо</th>
                  <th>Категория</th>
                  <th>Кухня</th>
                  <th>Цена</th>
                  <th>Кол-во</th>
                  <th>Выручка</th>
                  <th>Средняя цена</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x, idx) => (
                  <tr key={x.menu_item_id || x.id || `${x.title || "menu"}_${idx}`}>
                    <td className="cafeAnalytics__modalTdTitle" title={x.title}>
                      {x.title || "—"}
                    </td>
                    <td>{x.category_title || "—"}</td>
                    <td>{x.kitchen_title || "—"}</td>
                    <td>{fmtMoney(toNum(x.price))}</td>
                    <td>{fmtInt(x.qty)}</td>
                    <td>{fmtMoney(toNum(x.revenue))}</td>
                    <td>{fmtMoney(toNum(x.avg_unit_price))}</td>
                  </tr>
                ))}
                {!allMenuItemsLoading && !rows.length && (
                  <tr>
                    <td colSpan={7} className="cafeAnalytics__modalEmpty">
                      Нет данных за период.
                    </td>
                  </tr>
                )}
                {allMenuItemsLoading && (
                  <tr>
                    <td colSpan={7} className="cafeAnalytics__modalEmpty">
                      Загрузка списка блюд...
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
    const clients = Array.isArray(cafeClients) ? cafeClients : [];

    return (
      <div className="cafeAnalytics__modalContent cafeAnalytics__modalContent--guests">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--1">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Всего клиентов</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(guestsCount)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__guestList">
          {clients.map((c, idx) => {
            const id = c?.id ?? `guest_${idx}`;
            const name = c?.name || "Без имени";
            const phone = c?.phone ? String(c.phone) : "";
            const history = Array.isArray(c?.history) ? c.history : [];
            const open = expandedGuestId === id;

            return (
              <div key={id} className="cafeAnalytics__guestCard">
                <button
                  type="button"
                  className="cafeAnalytics__guestCardHead"
                  onClick={() => setExpandedGuestId(open ? null : id)}
                  aria-expanded={open}
                >
                  <span className="cafeAnalytics__guestCardChevron" aria-hidden>
                    {open ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                  <span className="cafeAnalytics__guestCardName" title={name}>
                    {name}
                  </span>
                  {phone ? (
                    <span className="cafeAnalytics__guestCardPhone" title={phone}>
                      {phone}
                    </span>
                  ) : null}
                  <span className="cafeAnalytics__guestCardMeta">
                    {fmtInt(history.length)} в истории
                  </span>
                </button>

                {open && (
                  <div className="cafeAnalytics__guestHistory">
                    {!history.length ? (
                      <div className="cafeAnalytics__guestHistoryEmpty">Нет записей в истории.</div>
                    ) : (
                      <div className="cafeAnalytics__modalTableWrap cafeAnalytics__guestHistoryTable">
                        <table className="cafeAnalytics__modalTable cafeAnalytics__modalTable--guestArchive">
                          <thead>
                            <tr>
                              <th>Архив</th>
                              <th>Стол</th>
                              <th>Гости</th>
                              <th>Сумма</th>
                              <th>Статус</th>
                              <th>Оплата</th>
                              <th>Оплачено</th>
                              <th>Официант</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h) => (
                              <tr key={h?.id || `${h?.original_order_id}_${h?.archived_at}`}>
                                <td>{fmtDateTime(h?.archived_at)}</td>
                                <td>{h?.table_number != null ? fmtInt(h.table_number) : "—"}</td>
                                <td>{fmtInt(h?.guests)}</td>
                                <td>{fmtMoney(toNum(h?.total_amount))}</td>
                                <td>{pickStatusLabel(h?.status)}</td>
                                <td>
                                  {pickPaymentLabel(h?.payment_method)}
                                  {h?.is_paid ? " · да" : ""}
                                </td>
                                <td>{fmtDateTime(h?.paid_at)}</td>
                                <td className="cafeAnalytics__guestArchiveWaiter" title={h?.waiter_label || ""}>
                                  {h?.waiter_label || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!clients.length && (
            <div className="cafeAnalytics__guestHistoryEmpty">Нет клиентов в списке.</div>
          )}
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
              placeholder={
                modalKey === "cooks" ? "Кухня…" : "Официант…"
              }
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
            {modalKey === "cooks" ? "Выручка по кухням" : "Выручка по официантам"}
          </div>

          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable cafeAnalytics__modalTable--staff">
              <thead>
                <tr>
                  <th>{modalKey === "cooks" ? "Кухня" : "Официант"}</th>
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

  if (modalKey === "payment_inflow") {
    const rows = Array.isArray(revenueInflowRows) ? revenueInflowRows : [];
    const sumAmt = rows.reduce((a, x) => a + toNum(x?.amount), 0);
    const sumOrd = rows.reduce((a, x) => a + toNum(x?.orders_count), 0);

    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--2">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Сумма по способам</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(sumAmt)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Заказов (строк)</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(sumOrd)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">Разбивка по способу оплаты</div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable">
              <thead>
                <tr>
                  <th>Способ</th>
                  <th>Заказов</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x._id}>
                    <td className="cafeAnalytics__modalTdTitle" title={x.label}>
                      {x.label}
                    </td>
                    <td>{fmtInt(x.orders_count)}</td>
                    <td>{fmtMoney(toNum(x.amount))}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={3} className="cafeAnalytics__modalEmpty">
                      Нет данных за период.
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

  if (modalKey === "rejections") {
    const rows = Array.isArray(rejectionRows) ? rejectionRows : [];
    const lines = rows.reduce((a, x) => a + toNum(x?.qty), 0);
    const lostRevenue = rows.reduce((a, x) => a + toNum(x?.lost_revenue), 0);

    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--2">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Отказов (позиций)</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(lines)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Упущенная выручка</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(lostRevenue)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">Отказы по позициям</div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable">
              <thead>
                <tr>
                  <th>Причина</th>
                  <th>Кол-во</th>
                  <th>Упущенная выручка</th>
                  <th>Сотрудник</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x._id}>
                    <td className="cafeAnalytics__modalTdTitle" title={x.reason}>
                      {x.reason}
                    </td>
                    <td>{fmtInt(x.qty)}</td>
                    <td>{fmtMoney(toNum(x.lost_revenue))}</td>
                    <td>{x.employee_name || "—"}</td>
                    <td>{fmtDateTime(x.created_at)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="cafeAnalytics__modalEmpty">
                      Нет отказов за период.
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

  if (modalKey === "expenses") {
    const block = expensesBlock || { total: 0, count: 0, categories: [] };
    const cats = Array.isArray(block.categories) ? block.categories : [];

    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--2">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Всего расходов</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(toNum(block.total))}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Записей</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(block.count)}</div>
          </div>
        </div>

        {cats.length > 0 && (
          <div className="cafeAnalytics__modalBlock">
            <div className="cafeAnalytics__modalBlockTitle">По категориям / статьям</div>
            <div className="cafeAnalytics__modalTableWrap">
              <table className="cafeAnalytics__modalTable">
                <thead>
                  <tr>
                    <th>Статья</th>
                    <th>Записей</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((x) => (
                    <tr key={String(x._id)}>
                      <td className="cafeAnalytics__modalTdTitle" title={x.name}>
                        {x.name}
                      </td>
                      <td>{fmtInt(x.count)}</td>
                      <td>{fmtMoney(toNum(x.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!cats.length && (
          <div className="cafeAnalytics__modalNote">
            Детализация по категориям недоступна — показаны только итоги периода (если API их
            возвращает).
          </div>
        )}
      </div>
    );
  }

  if (modalKey === "debts") {
    const rows = Array.isArray(debtRows) ? debtRows : [];

    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--2">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Сумма долга</div>
            <div className="cafeAnalytics__modalKVal">
              {fmtMoney(rows.reduce((a, x) => a + toNum(x?.balance), 0))}
            </div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Чеков</div>
            <div className="cafeAnalytics__modalKVal">{fmtInt(rows.length)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">Неоплаченные заказы</div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable">
              <thead>
                <tr>
                  <th>Чек / заказ</th>
                  <th>Стол</th>
                  <th>К доплате</th>
                  <th>Создан</th>
                  <th>Официант</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const title =
                    [x.check_label, x.order_number ? `#${x.order_number}` : ""]
                      .filter(Boolean)
                      .join(" · ") || String(x._id ?? "—");
                  return (
                    <tr key={String(x._id)}>
                      <td className="cafeAnalytics__modalTdTitle" title={title}>
                        {title}
                      </td>
                      <td>
                        {x.table_number != null && x.table_number !== ""
                          ? String(x.table_number)
                          : "—"}
                      </td>
                      <td>{fmtMoney(toNum(x.balance))}</td>
                      <td>{fmtDateTime(x.created_at)}</td>
                      <td>{x.waiter_label || "—"}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="cafeAnalytics__modalEmpty">
                      Открытых долгов нет.
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

  if (modalKey === "salary_waiters") {
    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__staffBar">
          <label className="cafeAnalytics__staffField">
            <span>Поиск</span>
            <input
              type="text"
              className="cafeAnalytics__input"
              value={salaryQ}
              onChange={(e) => setSalaryQ(e.target.value)}
              placeholder="Официант…"
            />
          </label>

          <label className="cafeAnalytics__staffField">
            <span>Сортировка</span>
            <select
              className="cafeAnalytics__staffSelect"
              value={salarySort}
              onChange={(e) => setSalarySort(e.target.value)}
            >
              <option value="total_desc">Итого ↓</option>
              <option value="revenue_desc">Выручка ↓</option>
              <option value="name_asc">Имя A–Я</option>
            </select>
          </label>
        </div>

        <div className="cafeAnalytics__modalKpiRow cafeAnalytics__modalKpiRow--4">
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Начислено</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(salaryTotals.total)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Окладная часть</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(salaryTotals.base)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Процент</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(salaryTotals.percent)}</div>
          </div>
          <div className="cafeAnalytics__modalKpi">
            <div className="cafeAnalytics__modalKLabel">Личная выручка</div>
            <div className="cafeAnalytics__modalKVal">{fmtMoney(salaryTotals.revenue)}</div>
          </div>
        </div>

        <div className="cafeAnalytics__modalBlock">
          <div className="cafeAnalytics__modalBlockTitle">По официантам</div>
          <div className="cafeAnalytics__modalTableWrap">
            <table className="cafeAnalytics__modalTable cafeAnalytics__modalTable--staff">
              <thead>
                <tr>
                  <th>Официант</th>
                  <th>Дней</th>
                  <th>Выручка</th>
                  <th>Оклад</th>
                  <th>%</th>
                  <th>Итого</th>
                  <th>Профиль</th>
                </tr>
              </thead>
              <tbody>
                {salaryFiltered.map((x) => (
                  <tr key={String(x._id)}>
                    <td className="cafeAnalytics__modalTdTitle" title={x.name}>
                      {x.name}
                    </td>
                    <td>{fmtInt(x.days)}</td>
                    <td>{fmtMoney(toNum(x.waiter_revenue))}</td>
                    <td>{fmtMoney(toNum(x.base_part))}</td>
                    <td>{fmtMoney(toNum(x.percent_part))}</td>
                    <td>{fmtMoney(toNum(x.total))}</td>
                    <td title={x.scope}>{x.scope || "—"}</td>
                  </tr>
                ))}
                {!salaryFiltered.length && (
                  <tr>
                    <td colSpan={7} className="cafeAnalytics__modalEmpty">
                      Нет данных: задайте период и профили зарплаты у официантов.
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

  if (modalKey === "export") {
    return (
      <div className="cafeAnalytics__modalContent">
        <div className="cafeAnalytics__exportForm">
          <label className="cafeAnalytics__staffField">
            <span>Тип отчета</span>
            <select
              className="cafeAnalytics__staffSelect"
              value={exportReport}
              onChange={(e) => setExportReport(e.target.value)}
            >
              <option value="analytics">Аналитика</option>
              <option value="cash">Касса</option>
            </select>
          </label>

          <label className="cafeAnalytics__staffField">
            <span>Формат</span>
            <select
              className="cafeAnalytics__staffSelect"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="word">Word (.doc)</option>
            </select>
          </label>

          <label className="cafeAnalytics__staffField">
            <span>Дата от (опционально)</span>
            <input
              type="date"
              className="cafeAnalytics__input"
              value={exportDateFrom}
              onChange={(e) => setExportDateFrom(e.target.value)}
            />
          </label>

          <label className="cafeAnalytics__staffField">
            <span>Дата до (опционально)</span>
            <input
              type="date"
              className="cafeAnalytics__input"
              value={exportDateTo}
              onChange={(e) => setExportDateTo(e.target.value)}
            />
          </label>
        </div>

        {exportError ? <div className="cafeAnalytics__exportError">{exportError}</div> : null}

        <div className="cafeAnalytics__exportActions">
          <button className="cafeAnalytics__btn" type="button" onClick={onExport} disabled={exportLoading}>
            {exportLoading ? "Экспорт..." : "Скачать файл"}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export { CafeAnalyticsModal, CafeAnalyticsModalContent };
