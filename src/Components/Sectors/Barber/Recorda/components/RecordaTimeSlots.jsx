// RecordaTimeSlots.jsx
import React, { useMemo } from "react";
import { pad, OPEN_HOUR, CLOSE_HOUR, minsOf, ts, BLOCKING, toDate } from "./RecordaUtils";
import "../Recorda.scss";

const SLOT_MINUTES = 30;

/**
 * Визуальный выбор времени слотами
 */
const RecordaTimeSlots = ({
  selectedDate,
  selectedBarber,
  appointments = [],
  currentRecordId,
  startTime,
  endTime,
  totalMinutes = 30,
  onSelectSlot,
  disabled = false,
}) => {
  // Генерация всех слотов
  const slots = useMemo(() => {
    const arr = [];
    for (let m = OPEN_HOUR * 60; m < CLOSE_HOUR * 60; m += SLOT_MINUTES) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      arr.push({
        time: `${pad(h)}:${pad(mm)}`,
        mins: m,
      });
    }
    return arr;
  }, []);

  // Определение занятых слотов
  const busySlots = useMemo(() => {
    const set = new Set();
    if (!selectedDate || !selectedBarber) return set;

    appointments.forEach((a) => {
      if (toDate(a.start_at) !== selectedDate) return;
      if (String(a.barber) !== String(selectedBarber)) return;
      if (!BLOCKING.has(a.status)) return;
      if (currentRecordId && String(currentRecordId) === String(a.id)) return;

      const startMins = minsOf(a.start_at?.slice(11, 16));
      const endMins = minsOf(a.end_at?.slice(11, 16));

      // Помечаем все слоты, которые пересекаются с записью
      slots.forEach((slot) => {
        const slotEnd = slot.mins + SLOT_MINUTES;
        if (slot.mins < endMins && startMins < slotEnd) {
          set.add(slot.time);
        }
      });
    });

    return set;
  }, [selectedDate, selectedBarber, appointments, currentRecordId, slots]);

  // Проверка, достаточно ли места для записи с заданной длительностью
  const canFitService = useMemo(() => {
    const map = new Map();
    
    slots.forEach((slot) => {
      if (busySlots.has(slot.time)) {
        map.set(slot.time, false);
        return;
      }

      // Проверяем, хватит ли места для услуги
      const endNeeded = slot.mins + totalMinutes;
      if (endNeeded > CLOSE_HOUR * 60) {
        map.set(slot.time, false);
        return;
      }

      // Проверяем, что все слоты до конца услуги свободны
      let canFit = true;
      for (let m = slot.mins; m < endNeeded; m += SLOT_MINUTES) {
        const checkTime = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
        if (busySlots.has(checkTime)) {
          canFit = false;
          break;
        }
      }
      map.set(slot.time, canFit);
    });

    return map;
  }, [slots, busySlots, totalMinutes]);

  // Выбранный диапазон
  const selectedRange = useMemo(() => {
    if (!startTime) return new Set();
    const set = new Set();
    const startMins = minsOf(startTime);
    const endMins = endTime ? minsOf(endTime) : startMins + totalMinutes;
    
    slots.forEach((slot) => {
      if (slot.mins >= startMins && slot.mins < endMins) {
        set.add(slot.time);
      }
    });
    
    return set;
  }, [startTime, endTime, totalMinutes, slots]);

  const handleSlotClick = (slot) => {
    if (disabled || !selectedBarber) return;
    if (busySlots.has(slot.time)) return;
    if (!canFitService.get(slot.time)) return;
    onSelectSlot?.(slot.time);
  };

  if (!selectedBarber) {
    return (
      <div className="barberrecorda__timeSlotsHint">
        Выберите сотрудника, чтобы увидеть доступные слоты
      </div>
    );
  }

  return (
    <div className="barberrecorda__timeSlots">
      <div className="barberrecorda__timeSlotsGrid">
        {slots.map((slot) => {
          const isBusy = busySlots.has(slot.time);
          const canFit = canFitService.get(slot.time);
          const isSelected = selectedRange.has(slot.time);
          const isStart = startTime === slot.time;

          let className = "barberrecorda__timeSlot";
          if (isBusy) className += " is-busy";
          else if (!canFit) className += " is-partial";
          else className += " is-free";
          if (isSelected) className += " is-selected";
          if (isStart) className += " is-start";

          return (
            <button
              key={slot.time}
              type="button"
              className={className}
              onClick={() => handleSlotClick(slot)}
              disabled={disabled || isBusy || !canFit}
              title={
                isBusy
                  ? "Занято"
                  : !canFit
                  ? "Недостаточно времени для услуги"
                  : `Начать в ${slot.time}`
              }
            >
              {slot.time}
            </button>
          );
        })}
      </div>
      <div className="barberrecorda__timeSlotsLegend">
        <span className="barberrecorda__legendItem">
          <span className="barberrecorda__legendDot is-free"></span>
          Свободно
        </span>
        <span className="barberrecorda__legendItem">
          <span className="barberrecorda__legendDot is-busy"></span>
          Занято
        </span>
        <span className="barberrecorda__legendItem">
          <span className="barberrecorda__legendDot is-selected"></span>
          Выбрано
        </span>
      </div>
    </div>
  );
};

export default RecordaTimeSlots;
