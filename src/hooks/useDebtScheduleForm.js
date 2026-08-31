import { useState, useMemo, useCallback, useRef } from "react";
import { isDebtScheduleV2 } from "../tools/debtScheduleVersion";
import {
  addCalendarDaysToIso,
  calcDaysUntilIsoDate,
} from "../tools/deferredPaymentDates";
import {
  DEFAULT_DAY_INTERVAL,
  DEFAULT_MONTH_INTERVAL,
  MAX_DAY_INTERVAL,
  MAX_MONTH_INTERVAL,
  buildDebtSchedule,
  defaultFirstDueDate,
  defaultIntervalForUnit,
  defaultScheduleCount,
  maxInstallmentsForUnit,
  maxIntervalForUnit,
  normalizeScheduleInterval,
  toDealInstallments,
  todayIsoDate,
} from "../tools/buildDebtSchedule";

/**
 * Состояние и логика графика долга (как в PaymentPage «Отсрочка»).
 * @param {{ total: number, debtScheduleVersion?: string }} options
 */
export function useDebtScheduleForm({ total = 0, debtScheduleVersion = "v2" } = {}) {
  const debtIsV2 = isDebtScheduleV2(debtScheduleVersion);
  const deferredDueDateInputRef = useRef(null);

  const [scheduleUnit, setScheduleUnit] = useState("month");
  const [scheduleCount, setScheduleCount] = useState(
    defaultScheduleCount("month"),
  );
  const [dayInterval, setDayInterval] = useState(DEFAULT_MONTH_INTERVAL);
  const [debtDays, setDebtDays] = useState(30);
  const [deferredDueDate, setDeferredDueDate] = useState(() =>
    defaultFirstDueDate("month"),
  );
  const [deferredPrepaymentEnabled, setDeferredPrepaymentEnabled] =
    useState(false);
  const [deferredPrepaymentAmount, setDeferredPrepaymentAmount] = useState("");
  const [deferredPrepaymentMethod, setDeferredPrepaymentMethod] =
    useState("cash");
  const [deferredPrepaymentBank, setDeferredPrepaymentBank] = useState("");

  const deferredPrepaymentValue = useMemo(() => {
    if (!deferredPrepaymentEnabled) return 0;
    const n = parseFloat(
      String(deferredPrepaymentAmount || "").replace(",", "."),
    );
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [deferredPrepaymentEnabled, deferredPrepaymentAmount]);

  const deferredSaleDebtRemaining = useMemo(
    () => Math.max(0, total - deferredPrepaymentValue),
    [total, deferredPrepaymentValue],
  );

  const debtSchedule = useMemo(
    () =>
      buildDebtSchedule({
        remainingAmount: deferredSaleDebtRemaining,
        unit: scheduleUnit,
        count: typeof scheduleCount === "number" ? scheduleCount : 0,
        firstDueDate: deferredDueDate,
        intervalDays:
          typeof dayInterval === "number" ? dayInterval : DEFAULT_DAY_INTERVAL,
        intervalMonths:
          typeof dayInterval === "number"
            ? dayInterval
            : DEFAULT_MONTH_INTERVAL,
      }),
    [
      dayInterval,
      deferredDueDate,
      deferredSaleDebtRemaining,
      scheduleCount,
      scheduleUnit,
    ],
  );

  const handleScheduleUnitChange = useCallback((unit) => {
    setScheduleUnit(unit);
    setScheduleCount(defaultScheduleCount(unit));
    setDayInterval(defaultIntervalForUnit(unit));
    setDeferredDueDate(defaultFirstDueDate(unit));
  }, []);

  const handleScheduleCountChange = useCallback(
    (value) => {
      if (value === "") {
        setScheduleCount("");
        return;
      }
      const numValue = parseInt(value, 10);
      if (Number.isNaN(numValue)) return;
      const max = maxInstallmentsForUnit(scheduleUnit);
      setScheduleCount(Math.min(max, Math.max(1, numValue)));
    },
    [scheduleUnit],
  );

  const handleScheduleCountBlur = useCallback(
    (value) => {
      const numValue = parseInt(value, 10);
      const max = maxInstallmentsForUnit(scheduleUnit);
      if (Number.isNaN(numValue) || numValue < 1) {
        setScheduleCount(defaultScheduleCount(scheduleUnit));
        return;
      }
      setScheduleCount(Math.min(max, numValue));
    },
    [scheduleUnit],
  );

  const handleDayIntervalChange = useCallback(
    (value) => {
      if (value === "") {
        setDayInterval("");
        return;
      }
      const numValue = parseInt(value, 10);
      if (Number.isNaN(numValue)) return;
      setDayInterval(normalizeScheduleInterval(scheduleUnit, numValue));
    },
    [scheduleUnit],
  );

  const handleDayIntervalBlur = useCallback(
    (value) => {
      const numValue = parseInt(value, 10);
      if (Number.isNaN(numValue) || numValue < 1) {
        setDayInterval(defaultIntervalForUnit(scheduleUnit));
        return;
      }
      setDayInterval(normalizeScheduleInterval(scheduleUnit, numValue));
    },
    [scheduleUnit],
  );

  const setDebtDaysFromDate = useCallback((isoDate) => {
    if (!isoDate) return;
    setDeferredDueDate(isoDate);
    setDebtDays(calcDaysUntilIsoDate(isoDate));
  }, []);

  const setDebtDaysAndSyncDate = useCallback((days) => {
    const safeDays = Math.max(1, Number(days) || 1);
    setDebtDays(safeDays);
    setDeferredDueDate(addCalendarDaysToIso(safeDays));
  }, []);

  const openDeferredDueDatePicker = useCallback(() => {
    const input = deferredDueDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  }, []);

  const handleDayIntervalPreset = useCallback(
    (interval) => {
      setDayInterval(normalizeScheduleInterval(scheduleUnit, interval));
    },
    [scheduleUnit],
  );

  const reset = useCallback(() => {
    setScheduleUnit("month");
    setScheduleCount(defaultScheduleCount("month"));
    setDayInterval(DEFAULT_MONTH_INTERVAL);
    setDebtDays(30);
    setDeferredDueDate(defaultFirstDueDate("month"));
    setDeferredPrepaymentEnabled(false);
    setDeferredPrepaymentAmount("");
    setDeferredPrepaymentMethod("cash");
    setDeferredPrepaymentBank("");
  }, []);

  /** @returns {{ ok: true } | { ok: false, message: string }} */
  const validate = useCallback(() => {
    if (deferredPrepaymentEnabled) {
      if (deferredPrepaymentValue <= 0) {
        return { ok: false, message: "Укажите сумму предоплаты" };
      }
      if (
        debtIsV2
          ? deferredPrepaymentValue >= total
          : deferredPrepaymentValue > total
      ) {
        return {
          ok: false,
          message: debtIsV2
            ? "Предоплата должна быть меньше суммы закупки — остаток уходит в долг"
            : "Сумма предоплаты не может быть больше суммы закупки",
        };
      }
      if (
        deferredPrepaymentMethod === "cashless" &&
        !deferredPrepaymentBank
      ) {
        return {
          ok: false,
          message: "Выберите банк для безналичной предоплаты",
        };
      }
    }

    if (debtIsV2) {
      if (deferredSaleDebtRemaining <= 0) {
        return {
          ok: false,
          message: "После предоплаты должен остаться долг больше нуля",
        };
      }
      const countNum =
        typeof scheduleCount === "number"
          ? scheduleCount
          : parseInt(String(scheduleCount), 10);
      if (!Number.isFinite(countNum) || countNum < 1) {
        return {
          ok: false,
          message:
            scheduleUnit === "month"
              ? "Укажите число месяцев не менее 1"
              : "Укажите число платежей не менее 1",
        };
      }
      if (countNum > maxInstallmentsForUnit(scheduleUnit)) {
        return {
          ok: false,
          message:
            scheduleUnit === "month"
              ? `Максимум ${maxInstallmentsForUnit("month")} месяцев`
              : `Максимум ${maxInstallmentsForUnit("day")} платежей`,
        };
      }
      const intervalNum =
        typeof dayInterval === "number"
          ? dayInterval
          : parseInt(String(dayInterval), 10);
      if (!Number.isFinite(intervalNum) || intervalNum < 1) {
        return {
          ok: false,
          message:
            scheduleUnit === "month"
              ? "Укажите интервал не менее 1 месяца"
              : "Укажите интервал не менее 1 дня",
        };
      }
      if (intervalNum > maxIntervalForUnit(scheduleUnit)) {
        return {
          ok: false,
          message:
            scheduleUnit === "month"
              ? `Максимум ${MAX_MONTH_INTERVAL} месяцев между платежами`
              : `Максимум ${MAX_DAY_INTERVAL} дней между платежами`,
        };
      }
      if (!deferredDueDate || deferredDueDate < todayIsoDate()) {
        return {
          ok: false,
          message: "Дата первого платежа не может быть раньше сегодня",
        };
      }
      if (!debtSchedule) {
        return {
          ok: false,
          message:
            "Не удалось построить график. Проверьте срок и дату первого платежа",
        };
      }
    } else {
      const daysNum =
        typeof debtDays === "number"
          ? debtDays
          : parseInt(String(debtDays), 10);
      if (!Number.isFinite(daysNum) || daysNum < 1) {
        return {
          ok: false,
          message: "Укажите срок рассрочки не менее 1 дня",
        };
      }
    }

    return { ok: true };
  }, [
    dayInterval,
    debtDays,
    debtIsV2,
    debtSchedule,
    deferredDueDate,
    deferredPrepaymentBank,
    deferredPrepaymentEnabled,
    deferredPrepaymentMethod,
    deferredPrepaymentValue,
    deferredSaleDebtRemaining,
    scheduleCount,
    scheduleUnit,
    total,
  ]);

  const buildCreateDealParams = useCallback(
    ({ clientId, counterpartyName, amount }) => {
      const hasPrepayment =
        deferredPrepaymentValue > 0 && deferredPrepaymentValue < amount;
      const name = counterpartyName || "Контрагент";
      const daysAdd =
        typeof debtDays === "number" && debtDays >= 1
          ? debtDays
          : calcDaysUntilIsoDate(deferredDueDate);
      const dueDateString = debtIsV2
        ? debtSchedule?.lastDueDate || deferredDueDate || todayIsoDate()
        : deferredDueDate || addCalendarDaysToIso(daysAdd);

      if (debtIsV2) {
        return {
          clientId,
          title: `${hasPrepayment ? "Предоплата" : "Долг"} ${name}`,
          statusRu: "Долги",
          amount,
          prepayment: hasPrepayment ? deferredPrepaymentValue : undefined,
          debtDays:
            debtSchedule?.unit === "day" ? debtSchedule.count : undefined,
          debtMonths:
            debtSchedule?.unit === "month" ? debtSchedule.count : undefined,
          first_due_date: debtSchedule?.firstDueDate || deferredDueDate,
          intervalDays:
            debtSchedule?.unit === "day" ? debtSchedule.intervalDays : undefined,
          intervalMonths:
            debtSchedule?.unit === "month"
              ? debtSchedule.intervalMonths
              : undefined,
          installments: toDealInstallments(debtSchedule),
          scheduleVersion: "v2",
          dueDateString,
          debtRecordAmount: hasPrepayment
            ? deferredSaleDebtRemaining
            : amount,
        };
      }

      return {
        clientId,
        title: `${hasPrepayment ? "Предоплата" : "Долг"} ${name}`,
        statusRu: hasPrepayment ? "Предоплата" : "Долги",
        amount,
        prepayment: hasPrepayment ? deferredPrepaymentValue : undefined,
        debtDays: daysAdd,
        first_due_date: dueDateString,
        scheduleVersion: "v1",
        dueDateString,
        debtRecordAmount: hasPrepayment ? deferredSaleDebtRemaining : amount,
      };
    },
    [
      debtDays,
      debtIsV2,
      debtSchedule,
      deferredDueDate,
      deferredPrepaymentValue,
      deferredSaleDebtRemaining,
    ],
  );

  return {
    debtIsV2,
    deferredDueDateInputRef,
    scheduleUnit,
    scheduleCount,
    dayInterval,
    debtDays,
    setDebtDays,
    deferredDueDate,
    deferredPrepaymentEnabled,
    setDeferredPrepaymentEnabled,
    deferredPrepaymentAmount,
    setDeferredPrepaymentAmount,
    deferredPrepaymentMethod,
    setDeferredPrepaymentMethod,
    deferredPrepaymentBank,
    setDeferredPrepaymentBank,
    deferredPrepaymentValue,
    deferredSaleDebtRemaining,
    debtSchedule,
    handleScheduleUnitChange,
    handleScheduleCountChange,
    handleScheduleCountBlur,
    handleDayIntervalChange,
    handleDayIntervalBlur,
    setDebtDaysFromDate,
    setDebtDaysAndSyncDate,
    openDeferredDueDatePicker,
    handleDayIntervalPreset,
    setDeferredDueDate,
    reset,
    validate,
    buildCreateDealParams,
  };
}

export default useDebtScheduleForm;
