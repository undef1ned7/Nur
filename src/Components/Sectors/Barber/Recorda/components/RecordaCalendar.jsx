// RecordaCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { DELETED_STATUS, isScheduleBlocking, fmtMoney } from "./RecordaUtils";
import {
  clockMinFromDate,
  END_OF_DAY_MIN,
  formatWorkSlotTime,
  buildMinuteToPxMapper,
} from "./recordaWorkHours";

const STATUS_LABELS = {
  booked: "Забронировано",
  confirmed: "Подтверждено",
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не явился",
  [DELETED_STATUS]: "Удалено",
};

const STATUS_LABELS_SHORT = {
  booked: "Бронь",
  confirmed: "Подтв.",
  completed: "Готово",
  canceled: "Отмена",
  no_show: "Не яв.",
  [DELETED_STATUS]: "Удал.",
};

const MIN_EVENT_H = 18;
const COMPACT_MAX_MIN = 45;
const STICK_CHIP_H = 30;
const STICK_CHIP_W = 156;
const STICK_LANE_GAP = 5;
const STICK_MIN_H = 22;

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
    case DELETED_STATUS:
      return {
        bg: "#F3F4F6",
        border: "#9CA3AF",
        shadow: "0 4px 14px rgba(107,114,128,.12)",
      };
    default:
      return {
        bg: "#F3F4F6",
        border: "#D1D5DB",
        shadow: "0 4px 14px rgba(2,6,23,.08)",
      };
  }
};

const layoutForBarber = (list, minuteMapper, workBounds = { startMin: 9 * 60 }) => {
  const map = minuteMapper;
  const originPx = map?.originPx ?? 0;

  const items = list.map((r) => {
    const start = new Date(r.start_at);
    const end = new Date(r.end_at);
    const startM = clockMinFromDate(start, workBounds);
    let endM = clockMinFromDate(end, workBounds);
    if (endM < startM) endM += END_OF_DAY_MIN;
    const durMin = Math.max(1, endM - startM);
    const heightByTime = map
      ? map.rangePx(startM, endM)
      : durMin * (32 / 30);
    const useStick = durMin <= COMPACT_MAX_MIN;

    return {
      r,
      tStart: startM,
      tEnd: endM,
      durMin,
      useStick,
      heightByTime,
      top: map ? map.minuteToPx(startM) - originPx : 0,
      height: Math.max(MIN_EVENT_H, heightByTime),
    };
  });

  items.sort((a, b) => a.tStart - b.tStart || a.tEnd - b.tEnd);

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
    if (it.lanes > 1) it.useStick = true;
  });

  const GAP = 6;
  items.forEach((it) => {
    const { bg, border, shadow } = colorByStatus(it.r.status);
    it.colors = { bg, border, shadow };

    if (it.useStick) {
      const chipH = Math.min(
        STICK_CHIP_H,
        Math.max(STICK_MIN_H, it.heightByTime),
      );
      it.style = {
        top: `${it.top}px`,
        height: `${chipH}px`,
        left: `${4 + it.lane * (STICK_CHIP_W + STICK_LANE_GAP)}px`,
        width: `${STICK_CHIP_W}px`,
        zIndex: 4 + it.lane,
        "--stick-accent": border,
        "--stick-bg": bg,
      };
      return;
    }

    const widthPct = (100 - (it.lanes - 1) * GAP) / it.lanes;
    it.style = {
      top: `${it.top}px`,
      height: `${Math.max(MIN_EVENT_H, it.heightByTime - 4)}px`,
      left: `calc(${it.lane * (widthPct + GAP)}%)`,
      width: `${widthPct}%`,
      background: bg,
      borderColor: border,
      boxShadow: shadow,
      zIndex: 2 + it.lane,
    };
  });

  return items;
};

const RecordaCalendar = ({
  barbers,
  fltBarber,
  recordsByBarber,
  calendarGridSlots = [],
  gutterBlocks = [],
  busyGutterBlocks,
  calendarHeight,
  busySlots,
  loading,
  toTime,
  serviceNamesFromRecord,
  clientName,
  clientPhone,
  COL_HEADER_H,
  PX_PER_MIN,
  workBounds,
  onRecordClick,
  onSlotClick,
  isToday,
  getRecordPrice,
}) => {
  const startMin = workBounds?.startMin ?? 9 * 60;
  const endMin = workBounds?.endMin ?? 21 * 60;

  const visibleBarbers = useMemo(
    () =>
      barbers.filter(
        (b) => !fltBarber || String(b.id) === String(fltBarber),
      ),
    [barbers, fltBarber],
  );

  const [nowLineTop, setNowLineTop] = useState(null);

  const pxPerMin = PX_PER_MIN ?? 32 / 30;

  const minuteMapper = useMemo(
    () => buildMinuteToPxMapper(calendarGridSlots, workBounds),
    [calendarGridSlots, workBounds],
  );

  useEffect(() => {
    if (!isToday) {
      setNowLineTop(null);
      return;
    }

    const updateNowLine = () => {
      const now = new Date();
      const nowMins = clockMinFromDate(now, { startMin, endMin });

      if (nowMins < startMin || nowMins > endMin) {
        setNowLineTop(null);
        return;
      }

      setNowLineTop(minuteMapper.minuteToPx(nowMins) - minuteMapper.originPx);
    };

    updateNowLine();
    const timer = setInterval(updateNowLine, 60_000);
    return () => clearInterval(timer);
  }, [isToday, minuteMapper, startMin, endMin]);

  const isBarberBusyAtSlot = (barberId, slot) => {
    const list = recordsByBarber.get(String(barberId)) || [];
    const slotStart = slot.startMin;
    const slotEnd = slotStart + slot.gridMin;
    const bounds = { startMin, endMin };
    return list.some((r) => {
      if (!isScheduleBlocking(r.status)) return false;
      const s = new Date(r.start_at);
      const e = new Date(r.end_at);
      const rs = clockMinFromDate(s, bounds);
      const re = clockMinFromDate(e, bounds);
      return rs < slotEnd && slotStart < re;
    });
  };

  return (
    <div className="barberrecorda__calendar">
      <div className="barberrecorda__colsWrap">
        <div
          className="barberrecorda__cols"
          style={{ height: calendarHeight }}
        >
          <aside
            className="barberrecorda__timeGutter"
            style={{ height: calendarHeight }}
            aria-label="Время"
          >
            <div
              className="barberrecorda__timeHeader"
              style={{ height: COL_HEADER_H }}
            />
            {gutterBlocks.map((block, i) => (
              <div
                key={`gutter-${block.startMin}`}
                className={`barberrecorda__timeCell ${
                  busyGutterBlocks?.has(i) ? "is-busy" : ""
                } ${block.label ? "" : "barberrecorda__timeCell--tick"} ${
                  block.isMidHour ? "barberrecorda__timeCell--mid" : ""
                } ${block.isSubdivided ? "barberrecorda__timeCell--sub" : ""}`}
                style={{ height: block.heightPx }}
              >
                {block.label ? <span>{block.label}</span> : null}
              </div>
            ))}
          </aside>

          {visibleBarbers.map((b) => {
            const list = recordsByBarber.get(String(b.id)) || [];
            const layout = layoutForBarber(list, minuteMapper, workBounds);

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
                  <span className="barberrecorda__colCount">
                    {list.length}
                  </span>
                </header>

                <div
                  className="barberrecorda__gridLines"
                  style={{ top: COL_HEADER_H }}
                >
                  {calendarGridSlots.map((slot) => (
                    <div
                      key={`line-${b.id}-${slot.startMin}`}
                      className={`barberrecorda__gridLine ${
                        slot.label ? "barberrecorda__gridLine--labeled" : ""
                      } ${slot.isMidHour ? "barberrecorda__gridLine--mid" : ""}`}
                      style={{ height: slot.heightPx }}
                    />
                  ))}
                </div>

                <div
                  className="barberrecorda__eventsArea"
                  style={{ height: calendarHeight - COL_HEADER_H }}
                >
                  <div className="barberrecorda__slotLayer" aria-hidden="true">
                    {calendarGridSlots.map((slot, i) => {
                      const busy = isBarberBusyAtSlot(b.id, slot);
                      const startTime = formatWorkSlotTime(slot.startMin);
                      return (
                        <button
                          key={`${b.id}-${slot.startMin}`}
                          type="button"
                          className={`barberrecorda__slotHit ${
                            busy ? "is-busy" : ""
                          }`}
                          style={{
                            top: slot.topPx,
                            height: slot.heightPx,
                          }}
                          disabled={busy}
                          tabIndex={-1}
                          aria-hidden="true"
                          onClick={() =>
                            onSlotClick?.({
                              barberId: String(b.id),
                              startTime,
                            })
                          }
                        />
                      );
                    })}
                  </div>

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
                    const svc = serviceNamesFromRecord(r);
                    const cl = clientName(r);
                    const phone = clientPhone(r);
                    const hasClient = cl && cl !== "—";
                    const priceValue = getRecordPrice?.(r) ?? 0;
                    const priceLabel =
                      Number.isFinite(priceValue) && priceValue > 0
                        ? fmtMoney(priceValue)
                        : null;
                    const tip = `${toTime(r.start_at)}–${toTime(r.end_at)} · ${svc}${
                      cl && cl !== "—" ? ` · ${cl}` : ""
                    }${phone ? ` · ${phone}` : ""}${
                      priceLabel ? ` · ${priceLabel}` : ""
                    }`;

                    if (it.useStick) {
                      const { border } = it.colors;
                      const timeEnd = toTime(r.end_at);
                      const timeStart = toTime(r.start_at);
                      const timeLabel =
                        timeEnd && timeEnd !== timeStart
                          ? `${timeStart}–${timeEnd}`
                          : timeStart;

                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`barberrecorda__eventStick barberrecorda__eventStick--${r.status}`}
                          style={it.style}
                          onClick={() => onRecordClick(r)}
                          title={tip}
                        >
                          <span
                            className="barberrecorda__eventStickAccent"
                            style={{ background: border }}
                            aria-hidden="true"
                          />
                          <span className="barberrecorda__eventStickMain">
                            <span className="barberrecorda__eventStickTime">
                              {timeLabel}
                            </span>
                          </span>
                          {priceLabel ? (
                            <span className="barberrecorda__eventStickPrice">
                              {priceLabel}
                            </span>
                          ) : null}
                        </button>
                      );
                    }

                    return (
                      <article
                        key={r.id}
                        className={`barberrecorda__event ${
                          r.status === DELETED_STATUS
                            ? "barberrecorda__event--deleted"
                            : ""
                        }`}
                        style={it.style}
                        onClick={() => onRecordClick(r)}
                        title={tip}
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
                            <span className="barberrecorda__badgeFull">
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                            <span className="barberrecorda__badgeShort">
                              {STATUS_LABELS_SHORT[r.status] || r.status}
                            </span>
                          </span>
                        </div>
                        <div className="barberrecorda__eventSvc">{svc}</div>
                        {hasClient ? (
                          <div className="barberrecorda__eventClient">{cl}</div>
                        ) : null}
                        {phone ? (
                          <div className="barberrecorda__eventPhone">{phone}</div>
                        ) : null}
                        {priceLabel ? (
                          <div className="barberrecorda__eventPrice">{priceLabel}</div>
                        ) : null}
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
