// RecordaCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";

const STATUS_LABELS = {
  booked: "Забронировано",
  confirmed: "Подтверждено",
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не явился",
};

const STATUS_LABELS_SHORT = {
  booked: "Бронь",
  confirmed: "Подтв.",
  completed: "Готово",
  canceled: "Отмена",
  no_show: "Не явился",
};

/* компактная шкала */
const PX_PER_MIN = 32 / 30;
const MIN_EVENT_H = 72;

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

const estimateContentMin = (svc, client, phone) => {
  const wrapLen = 30;
  const lines =
    1 +
    Math.ceil(String(svc || "").length / wrapLen) +
    Math.ceil(String(client || "").length / wrapLen) +
    (phone ? 1 : 0);
  return 30 + lines * 18 + 10;
};

const colorByStatus = (status) => {
  switch (status) {
    case "booked":
      return {
        bg: "#DBEAFF",
        border: "#3B82F6",
        shadow: "0 4px 14px rgba(59,130,246,.18)",
      };
    case "confirmed":
      return {
        bg: "#EDE9FF",
        border: "#7C3AED",
        shadow: "0 4px 14px rgba(124,58,237,.18)",
      };
    case "completed":
      return {
        bg: "#DCFCE7",
        border: "#16A34A",
        shadow: "0 4px 14px rgba(22,163,74,.18)",
      };
    case "canceled":
      return {
        bg: "#FEE2E2",
        border: "#EF4444",
        shadow: "0 4px 14px rgba(239,68,68,.18)",
      };
    case "no_show":
      return {
        bg: "#FEF3C7",
        border: "#F59E0B",
        shadow: "0 4px 14px rgba(245,158,11,.18)",
      };
    default:
      return {
        bg: "#F3F4F6",
        border: "#D1D5DB",
        shadow: "0 4px 14px rgba(2,6,23,.08)",
      };
  }
};

const layoutForBarber = (
  list,
  COL_HEADER_H,
  toTime,
  serviceNamesFromRecord,
  clientName,
  clientPhone
) => {
  const items = list.map((r) => {
    const start = new Date(r.start_at);
    const end = new Date(r.end_at);
    const startM = start.getHours() * 60 + start.getMinutes();
    const endM = end.getHours() * 60 + end.getMinutes();
    const topMin = Math.max(0, startM - OPEN_HOUR * 60);
    const durMin = Math.max(15, endM - startM);

    const svc = serviceNamesFromRecord(r);
    const cl = clientName(r);
    const ph = clientPhone(r);

    const heightByTime = durMin * PX_PER_MIN;
    const heightByText = estimateContentMin(svc, cl, ph);

    return {
      r,
      tStart: startM,
      tEnd: endM,
      top: topMin * PX_PER_MIN,
      height: Math.max(MIN_EVENT_H, heightByTime, heightByText),
    };
  });

  // раскладка по "дорожкам" при пересечениях
  const lanes = [];
  items.forEach((it) => {
    let lane = 0;
    for (; lane < lanes.length; lane++) {
      if (it.tStart >= lanes[lane]) break;
    }
    if (lane === lanes.length) {
      lanes.push(it.tEnd);
    } else {
      lanes[lane] = it.tEnd;
    }
    it.lane = lane;
    it.lanes = lanes.length;
  });

  const GAP = 6; // расстояние между пересекающимися карточками
  items.forEach((it) => {
    const widthPct = (100 - (it.lanes - 1) * GAP) / it.lanes;
    const { bg, border, shadow } = colorByStatus(it.r.status);
    it.style = {
      top: `${it.top}px`,
      height: `${it.height - 4}px`,
      left: `calc(${it.lane * (widthPct + GAP)}%)`,
      width: `${widthPct}%`,
      background: bg,
      borderColor: border,
      boxShadow: shadow,
    };
  });

  return items;
};

const RecordaCalendar = ({
  barbers,
  fltBarber,
  recordsByBarber,
  timesAll,
  calendarHeight,
  busySlots,
  loading,
  toTime,
  serviceNamesFromRecord,
  clientName,
  clientPhone,
  COL_HEADER_H,
  SLOT_PX,
  onRecordClick,
  isToday,
}) => {
  const visibleBarbers = useMemo(
    () =>
      barbers.filter(
        (b) => !fltBarber || String(b.id) === String(fltBarber)
      ),
    [barbers, fltBarber]
  );

  // Линия текущего времени
  const [nowLineTop, setNowLineTop] = useState(null);

  useEffect(() => {
    if (!isToday) {
      setNowLineTop(null);
      return;
    }

    const updateNowLine = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      
      // Проверяем, что время в рабочем диапазоне
      if (nowMins < OPEN_HOUR * 60 || nowMins > CLOSE_HOUR * 60) {
        setNowLineTop(null);
        return;
      }
      
      const topMin = nowMins - OPEN_HOUR * 60;
      setNowLineTop(topMin * PX_PER_MIN);
    };

    updateNowLine();
    const timer = setInterval(updateNowLine, 60_000); // обновляем каждую минуту
    return () => clearInterval(timer);
  }, [isToday]);

  return (
    <div className="barberrecorda__calendar barberrecorda__calendar--noGutter">
      <div className="barberrecorda__colsWrap">
        <div
          className="barberrecorda__cols"
          style={{ height: calendarHeight }}
        >
          {visibleBarbers.map((b) => {
            const list = recordsByBarber.get(String(b.id)) || [];
            const layout = layoutForBarber(
              list,
              COL_HEADER_H,
              toTime,
              serviceNamesFromRecord,
              clientName,
              clientPhone
            );

            return (
              <section key={b.id} className="barberrecorda__calCol">
                <header
                  className="barberrecorda__calHeader"
                  style={{ height: COL_HEADER_H }}
                >
                  <div className="barberrecorda__colTitle">
                    <span className="barberrecorda__avatar" aria-hidden>
                      {((b.name || "•").trim()[0] || "•")
                        .toUpperCase()
                        .trim()}
                    </span>
                    <span className="barberrecorda__name">{b.name}</span>
                  </div>
                  {/* Счётчик записей у мастера */}
                  <span className="barberrecorda__colCount">
                    {list.length}
                  </span>
                </header>

                <div
                  className="barberrecorda__gridLines"
                  style={{ top: COL_HEADER_H }}
                >
                  {timesAll.slice(0, -1).map((_, i) => (
                    <div
                      key={i}
                      className="barberrecorda__gridLine"
                      style={{ height: SLOT_PX }}
                    />
                  ))}
                </div>

                <div
                  className="barberrecorda__eventsArea"
                  style={{ height: calendarHeight - COL_HEADER_H }}
                >
                  {/* Линия текущего времени */}
                  {nowLineTop !== null && (
                    <div 
                      className="barberrecorda__nowLine"
                      style={{ top: nowLineTop }}
                    />
                  )}

                  {layout.length === 0 && !loading && (
                    <div className="barberrecorda__emptyInCol">
                      Свободно
                    </div>
                  )}

                  {layout.map((it) => {
                    const r = it.r;
                    const cl = clientName(r);
                    const phone = clientPhone(r);

                    return (
                      <article
                        key={r.id}
                        className="barberrecorda__event"
                        style={it.style}
                        onClick={() => onRecordClick(r)}
                        title={cl}
                      >
                        <div className="barberrecorda__eventHeader">
                          <div className="barberrecorda__eventTime">
                            <span>{toTime(r.start_at)}</span>
                            <span>–</span>
                            <span>{toTime(r.end_at)}</span>
                          </div>
                          <span
                            className={`barberrecorda__badge barberrecorda__badge--${r.status}`}
                            title={STATUS_LABELS[r.status] || r.status}
                          >
                            <span className="barberrecorda__badgeFull">{STATUS_LABELS[r.status] || r.status}</span>
                            <span className="barberrecorda__badgeShort">{STATUS_LABELS_SHORT[r.status] || r.status}</span>
                          </span>
                        </div>
                        <div className="barberrecorda__eventClient">
                          {cl}
                        </div>
                        {phone && (
                          <div className="barberrecorda__eventPhone">
                            {phone}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RecordaCalendar;
