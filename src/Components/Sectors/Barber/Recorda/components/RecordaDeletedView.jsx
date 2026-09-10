// RecordaDeletedView.jsx
import React from "react";
import { FaCalendarAlt, FaClock, FaUser, FaCut } from "react-icons/fa";
import { fmtMoney } from "./RecordaUtils";

const formatRecordDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const RecordaDeletedView = ({
  records = [],
  loading = false,
  barbers = [],
  onRecordClick,
  serviceNamesFromRecord,
  clientName,
  clientPhone,
  toTime,
}) => {
  const barberName = (barberId) =>
    barbers.find((b) => String(b.id) === String(barberId))?.name || "—";

  if (loading) {
    return (
      <div className="barberrecorda__deletedView">
        <div className="barberrecorda__deletedEmpty">Загрузка…</div>
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="barberrecorda__deletedView">
        <div className="barberrecorda__deletedEmpty">
          <strong>Удалённых записей пока нет</strong>
          <p>Записи, удалённые из расписания, будут появляться здесь.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="barberrecorda__deletedView">
      <div className="barberrecorda__deletedList" role="list">
        {records.map((record) => {
          const services = serviceNamesFromRecord(record);
          const client = clientName(record);
          const phone = clientPhone(record);
          const price =
            record.price != null && record.price !== ""
              ? fmtMoney(record.price)
              : null;

          return (
            <button
              key={record.id}
              type="button"
              className="barberrecorda__deletedCard"
              onClick={() => onRecordClick?.(record)}
              role="listitem"
            >
              <div className="barberrecorda__deletedCardHead">
                <span className="barberrecorda__deletedBadge">Удалено</span>
                {price ? (
                  <span className="barberrecorda__deletedPrice">{price}</span>
                ) : null}
              </div>

              <div className="barberrecorda__deletedCardMeta">
                <span className="barberrecorda__deletedMetaItem">
                  <FaCalendarAlt aria-hidden="true" />
                  {formatRecordDate(record.start_at)}
                </span>
                <span className="barberrecorda__deletedMetaItem">
                  <FaClock aria-hidden="true" />
                  {toTime(record.start_at)}–{toTime(record.end_at)}
                </span>
              </div>

              <div className="barberrecorda__deletedCardBody">
                <div className="barberrecorda__deletedRow">
                  <FaCut aria-hidden="true" />
                  <span>{services}</span>
                </div>
                <div className="barberrecorda__deletedRow">
                  <FaUser aria-hidden="true" />
                  <span>
                    {barberName(record.barber)}
                    {client && client !== "—" ? ` · ${client}` : ""}
                    {phone ? ` · ${phone}` : ""}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RecordaDeletedView;
