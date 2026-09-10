// RecordaDayList.jsx — компактный список записей за день (100+ строк)
import React, { useMemo } from "react";
import { STATUS_LABELS, fmtMoney, ts } from "./RecordaUtils";

const STATUS_CLASS = {
  booked: "booked",
  confirmed: "confirmed",
  completed: "completed",
  canceled: "canceled",
  cancelled: "canceled",
  no_show: "no_show",
};

const RecordaDayList = ({
  records = [],
  loading = false,
  barbers = [],
  showBarberColumn = true,
  dayTotal = 0,
  dayCount = 0,
  onRecordClick,
  serviceNamesFromRecord,
  clientName,
  clientPhone,
  toTime,
  getRecordPrice,
}) => {
  const barberName = (barberId) =>
    barbers.find((b) => String(b.id) === String(barberId))?.name || "—";

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => ts(a.start_at) - ts(b.start_at)),
    [records],
  );

  if (loading) {
    return (
      <div className="barberrecorda__dayList">
        <div className="barberrecorda__dayListEmpty">Загрузка…</div>
      </div>
    );
  }

  if (!sortedRecords.length) {
    return (
      <div className="barberrecorda__dayList">
        <div className="barberrecorda__dayListEmpty">
          <strong>На этот день записей нет</strong>
          <p>Нажмите «Записать» или выберите другую дату.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="barberrecorda__dayList">
      <div className="barberrecorda__dayListScroll">
        <table className="barberrecorda__dayListTable">
          <thead>
            <tr>
              <th className="barberrecorda__dayListTh barberrecorda__dayListTh--time">
                Время
              </th>
              <th className="barberrecorda__dayListTh">Клиент</th>
              <th className="barberrecorda__dayListTh">Услуги</th>
              {showBarberColumn ? (
                <th className="barberrecorda__dayListTh barberrecorda__dayListTh--barber">
                  Мастер
                </th>
              ) : null}
              <th className="barberrecorda__dayListTh barberrecorda__dayListTh--status">
                Статус
              </th>
              <th className="barberrecorda__dayListTh barberrecorda__dayListTh--price">
                Сумма
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record) => {
              const statusKey = record.status === "cancelled" ? "canceled" : record.status;
              const statusClass = STATUS_CLASS[record.status] || "default";
              const statusLabel =
                STATUS_LABELS[statusKey] || STATUS_LABELS[record.status] || record.status;
              const services = serviceNamesFromRecord(record);
              const client = clientName(record);
              const phone = clientPhone(record);
              const price = getRecordPrice?.(record);

              return (
                <tr
                  key={record.id}
                  className="barberrecorda__dayListRow"
                  onClick={() => onRecordClick?.(record)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRecordClick?.(record);
                    }
                  }}
                >
                  <td className="barberrecorda__dayListTd barberrecorda__dayListTd--time">
                    <span className="barberrecorda__dayListTime">
                      {toTime(record.start_at)}
                    </span>
                    <span className="barberrecorda__dayListTimeEnd">
                      {toTime(record.end_at)}
                    </span>
                  </td>
                  <td className="barberrecorda__dayListTd">
                    <span className="barberrecorda__dayListClient">{client}</span>
                    {phone ? (
                      <span className="barberrecorda__dayListPhone">{phone}</span>
                    ) : null}
                  </td>
                  <td className="barberrecorda__dayListTd barberrecorda__dayListTd--services">
                    {services}
                  </td>
                  {showBarberColumn ? (
                    <td className="barberrecorda__dayListTd barberrecorda__dayListTd--barber">
                      {barberName(record.barber)}
                    </td>
                  ) : null}
                  <td className="barberrecorda__dayListTd barberrecorda__dayListTd--status">
                    <span
                      className={`barberrecorda__dayListStatus barberrecorda__dayListStatus--${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="barberrecorda__dayListTd barberrecorda__dayListTd--price">
                    {fmtMoney(price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="barberrecorda__dayListTotalRow">
              <td colSpan={showBarberColumn ? 5 : 4}>
                <strong>Итого за день</strong>
                <span className="barberrecorda__dayListTotalMeta">
                  {dayCount || sortedRecords.length} записей
                </span>
              </td>
              <td className="barberrecorda__dayListTd barberrecorda__dayListTd--price">
                <strong>{fmtMoney(dayTotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="barberrecorda__dayListFoot">
        Показано {sortedRecords.length}{" "}
        {sortedRecords.length === 1
          ? "запись"
          : sortedRecords.length >= 2 && sortedRecords.length <= 4
          ? "записи"
          : "записей"}
      </div>
    </div>
  );
};

export default RecordaDayList;
