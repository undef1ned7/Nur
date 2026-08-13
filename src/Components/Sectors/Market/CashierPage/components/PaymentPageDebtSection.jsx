import { Calendar } from "lucide-react";
import {
  DAY_INTERVAL_PRESETS,
  DAY_SCHEDULE_PRESETS,
  MAX_DAY_INTERVAL,
  MAX_MONTH_INTERVAL,
  MONTH_INTERVAL_PRESETS,
  MONTH_SCHEDULE_PRESETS,
  dayIntervalLabel,
  dayIntervalPresetLabel,
  formatIsoDateRu,
  maxInstallmentsForUnit,
  monthIntervalLabel,
  monthIntervalPresetLabel,
  paymentCountLabel,
  scheduleCountLabel,
  todayIsoDate,
} from "../../../../../tools/buildDebtSchedule";
import {
  calcDaysUntilIsoDate,
  formatDaysLabel,
  getTodayIsoDate,
} from "../../../../../tools/deferredPaymentDates";

export default function PaymentPageDebtSection({
  total,
  totalDebt,
  deferredPrepaymentValue,
  deferredSaleDebtRemaining,
  deferredPrepaymentEnabled,
  onDeferredPrepaymentEnabledChange,
  deferredPrepaymentAmount,
  onDeferredPrepaymentAmountChange,
  deferredPrepaymentMethod,
  onDeferredPrepaymentMethodChange,
  deferredPrepaymentBank,
  onSelectDeferredPrepaymentBank,
  banks,
  version = "v2",
  debtDays,
  onDebtDaysChange,
  onDebtDaysBlur,
  onDebtDaysDateChange,
  scheduleUnit,
  onScheduleUnitChange,
  scheduleCount,
  onScheduleCountChange,
  onScheduleCountBlur,
  onSchedulePreset,
  dayInterval,
  onDayIntervalChange,
  onDayIntervalBlur,
  onDayIntervalPreset,
  debtSchedule,
  deferredDueDate,
  deferredDueDateInputRef,
  onOpenDeferredDueDatePicker,
  onFirstDueDateChange,
}) {
  const presets =
    scheduleUnit === "month" ? MONTH_SCHEDULE_PRESETS : DAY_SCHEDULE_PRESETS;
  const intervalPresets =
    scheduleUnit === "month" ? MONTH_INTERVAL_PRESETS : DAY_INTERVAL_PRESETS;
  const previewRows = debtSchedule?.installments ?? [];
  const intervalMax =
    scheduleUnit === "month" ? MAX_MONTH_INTERVAL : MAX_DAY_INTERVAL;

  return (
    <div className="payment-page__debt-section">
      <div className="payment-page__debt-amount">
        <div className="payment-page__debt-label">
          {deferredPrepaymentValue > 0 ? "ОСТАТОК В ДОЛГ" : "СУММА ДОЛГА"}
        </div>
        <div className="payment-page__debt-value">
          {deferredSaleDebtRemaining.toFixed(2)}
        </div>
        {deferredPrepaymentValue > 0 && (
          <p className="payment-page__debt-hint">
            Сумма заказа {total.toFixed(2)} сом · предоплата{" "}
            {deferredPrepaymentValue.toFixed(2)} сом
          </p>
        )}
      </div>

      {version === "v1" ? (
        <>
          <label className="payment-page__deferred-prepay-toggle">
            <input
              type="checkbox"
              checked={deferredPrepaymentEnabled}
              onChange={(e) => {
                onDeferredPrepaymentEnabledChange(e.target.checked);
              }}
            />
            <span>Предоплата при отсрочке</span>
          </label>

          {deferredPrepaymentEnabled && (
            <div className="payment-page__deferred-prepay">
              <div className="payment-page__deferred-prepay-field">
                <label className="payment-page__debt-days-label">
                  Сумма предоплаты (сом)
                </label>
                <input
                  type="number"
                  min={0}
                  max={total}
                  step="0.01"
                  className="payment-page__debt-days-input"
                  value={deferredPrepaymentAmount}
                  onChange={(e) =>
                    onDeferredPrepaymentAmountChange(e.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="payment-page__deferred-prepay-field">
                <span className="payment-page__debt-days-label">
                  Способ предоплаты
                </span>
                <div className="payment-page__deferred-prepay-method-row">
                  <button
                    type="button"
                    className={`payment-page__deferred-prepay-method${
                      deferredPrepaymentMethod === "cash"
                        ? " payment-page__deferred-prepay-method--active"
                        : ""
                    }`}
                    onClick={() => onDeferredPrepaymentMethodChange("cash")}
                  >
                    Наличные
                  </button>
                  <button
                    type="button"
                    className={`payment-page__deferred-prepay-method${
                      deferredPrepaymentMethod === "cashless"
                        ? " payment-page__deferred-prepay-method--active"
                        : ""
                    }`}
                    onClick={() =>
                      onDeferredPrepaymentMethodChange("cashless")
                    }
                  >
                    Безналичные
                  </button>
                </div>
              </div>
              {deferredPrepaymentMethod === "cashless" && (
                <div className="payment-page__deferred-prepay-field">
                  <p className="payment-page__debt-days-label">
                    Банк предоплаты
                  </p>
                  <div className="payment-page__banks">
                    {banks.map((bank) => (
                      <button
                        key={bank.id}
                        type="button"
                        className={`payment-page__bank ${
                          deferredPrepaymentBank === bank.id
                            ? "payment-page__bank--selected"
                            : ""
                        }`}
                        onClick={() => onSelectDeferredPrepaymentBank(bank.id)}
                      >
                        <div className="payment-page__bank-content">
                          {bank.logo ? (
                            typeof bank.logo === "string" ? (
                              <img
                                src={bank.logo}
                                alt={bank.name}
                                className="payment-page__bank-logo"
                              />
                            ) : (
                              bank.logo
                            )
                          ) : (
                            <div className="payment-page__bank-name">
                              {bank.name}
                            </div>
                          )}
                        </div>
                        {deferredPrepaymentBank === bank.id && (
                          <div className="payment-page__bank-check">✓</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="payment-page__debt-days">
            <label
              className="payment-page__debt-days-label"
              htmlFor="deferred-debt-days"
            >
              Срок рассрочки (дней):
            </label>
            <div className="payment-page__debt-days-row">
              <input
                id="deferred-debt-days"
                type="text"
                className="payment-page__debt-days-input"
                value={debtDays}
                onChange={(e) => onDebtDaysChange(e.target.value)}
                onBlur={(e) => onDebtDaysBlur(e.target.value)}
                min="1"
                inputMode="numeric"
                autoComplete="off"
              />
              <button
                type="button"
                className="payment-page__debt-days-calendar-btn"
                onClick={onOpenDeferredDueDatePicker}
                title="Выбрать дату погашения"
                aria-label="Выбрать дату погашения в календаре"
              >
                <Calendar size={20} strokeWidth={2} />
              </button>
              <input
                ref={deferredDueDateInputRef}
                type="date"
                className="payment-page__debt-date-input"
                value={deferredDueDate}
                min={getTodayIsoDate()}
                onChange={(e) => onDebtDaysDateChange(e.target.value)}
                tabIndex={-1}
                aria-hidden
              />
            </div>
            <p className="payment-page__debt-days-hint">
              Дата погашения:{" "}
              <strong>{formatIsoDateRu(deferredDueDate)}</strong>
              {" · "}
              {typeof debtDays === "number"
                ? debtDays
                : calcDaysUntilIsoDate(deferredDueDate)}{" "}
              {formatDaysLabel(
                typeof debtDays === "number"
                  ? debtDays
                  : calcDaysUntilIsoDate(deferredDueDate),
              )}{" "}
              от сегодня
            </p>
          </div>
        </>
      ) : (
        <>
      <div className="payment-page__debt-step">
        <div className="payment-page__debt-step-title">1. Предоплата</div>
        <p className="payment-page__debt-step-hint">Необязательно</p>
        <label className="payment-page__deferred-prepay-toggle">
          <input
            type="checkbox"
            checked={deferredPrepaymentEnabled}
            onChange={(e) => {
              onDeferredPrepaymentEnabledChange(e.target.checked);
            }}
          />
          <span>Принять предоплату сейчас</span>
        </label>

        {deferredPrepaymentEnabled && (
          <div className="payment-page__deferred-prepay">
            <div className="payment-page__deferred-prepay-field">
              <label className="payment-page__debt-days-label">
                Сумма предоплаты (сом)
              </label>
              <input
                type="number"
                min={0}
                max={total}
                step="0.01"
                className="payment-page__debt-days-input"
                value={deferredPrepaymentAmount}
                onChange={(e) =>
                  onDeferredPrepaymentAmountChange(e.target.value)
                }
                placeholder="0.00"
              />
            </div>
            <div className="payment-page__deferred-prepay-field">
              <span className="payment-page__debt-days-label">
                Способ предоплаты
              </span>
              <div className="payment-page__deferred-prepay-method-row">
                <button
                  type="button"
                  className={`payment-page__deferred-prepay-method${
                    deferredPrepaymentMethod === "cash"
                      ? " payment-page__deferred-prepay-method--active"
                      : ""
                  }`}
                  onClick={() => onDeferredPrepaymentMethodChange("cash")}
                >
                  Наличные
                </button>
                <button
                  type="button"
                  className={`payment-page__deferred-prepay-method${
                    deferredPrepaymentMethod === "cashless"
                      ? " payment-page__deferred-prepay-method--active"
                      : ""
                  }`}
                  onClick={() => onDeferredPrepaymentMethodChange("cashless")}
                >
                  Безналичные
                </button>
              </div>
            </div>
            {deferredPrepaymentMethod === "cashless" && (
              <div className="payment-page__deferred-prepay-field">
                <p className="payment-page__debt-days-label">Банк предоплаты</p>
                <div className="payment-page__banks">
                  {banks.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      className={`payment-page__bank ${
                        deferredPrepaymentBank === bank.id
                          ? "payment-page__bank--selected"
                          : ""
                      }`}
                      onClick={() => onSelectDeferredPrepaymentBank(bank.id)}
                    >
                      <div className="payment-page__bank-content">
                        {bank.logo ? (
                          typeof bank.logo === "string" ? (
                            <img
                              src={bank.logo}
                              alt={bank.name}
                              className="payment-page__bank-logo"
                            />
                          ) : (
                            bank.logo
                          )
                        ) : (
                          <div className="payment-page__bank-name">
                            {bank.name}
                          </div>
                        )}
                      </div>
                      {deferredPrepaymentBank === bank.id && (
                        <div className="payment-page__bank-check">✓</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="payment-page__debt-step">
        <div className="payment-page__debt-step-title">2. График погашения</div>
        <p className="payment-page__debt-step-hint">
          Разделите остаток на платежи по дням или месяцам
        </p>

        <div className="payment-page__deferred-prepay-method-row payment-page__schedule-unit-row">
          <button
            type="button"
            className={`payment-page__deferred-prepay-method${
              scheduleUnit === "day"
                ? " payment-page__deferred-prepay-method--active"
                : ""
            }`}
            onClick={() => onScheduleUnitChange("day")}
          >
            По дням
          </button>
          <button
            type="button"
            className={`payment-page__deferred-prepay-method${
              scheduleUnit === "month"
                ? " payment-page__deferred-prepay-method--active"
                : ""
            }`}
            onClick={() => onScheduleUnitChange("month")}
          >
            По месяцам
          </button>
        </div>

        <div className="payment-page__debt-days">
          <label
            className="payment-page__debt-days-label"
            htmlFor="deferred-schedule-count"
          >
            {scheduleUnit === "month"
              ? "Количество месяцев"
              : "Количество платежей"}
          </label>
          <input
            id="deferred-schedule-count"
            type="text"
            className="payment-page__debt-days-input"
            value={scheduleCount}
            onChange={(e) => onScheduleCountChange(e.target.value)}
            onBlur={(e) => onScheduleCountBlur(e.target.value)}
            min="1"
            max={maxInstallmentsForUnit(scheduleUnit)}
            inputMode="numeric"
            autoComplete="off"
          />
          <div className="payment-page__schedule-presets">
            {presets.map((count) => (
              <button
                key={`${scheduleUnit}-${count}`}
                type="button"
                className={`payment-page__schedule-preset${
                  scheduleCount === count
                    ? " payment-page__schedule-preset--active"
                    : ""
                }`}
                onClick={() => onSchedulePreset(count)}
              >
                {count}
              </button>
            ))}
          </div>

          <label
            className="payment-page__debt-days-label"
            htmlFor="deferred-day-interval"
          >
            Интервал
          </label>
          <div className="payment-page__schedule-presets">
            {intervalPresets.map((interval) => (
              <button
                key={`interval-${scheduleUnit}-${interval}`}
                type="button"
                className={`payment-page__schedule-preset${
                  dayInterval === interval
                    ? " payment-page__schedule-preset--active"
                    : ""
                }`}
                onClick={() => onDayIntervalPreset(interval)}
              >
                {scheduleUnit === "month"
                  ? monthIntervalPresetLabel(interval)
                  : dayIntervalPresetLabel(interval)}
              </button>
            ))}
          </div>
          <div className="payment-page__day-interval-row">
            <span className="payment-page__day-interval-prefix">Каждые</span>
            <input
              id="deferred-day-interval"
              type="text"
              className="payment-page__debt-days-input payment-page__day-interval-input"
              value={dayInterval}
              onChange={(e) => onDayIntervalChange(e.target.value)}
              onBlur={(e) => onDayIntervalBlur(e.target.value)}
              min="1"
              max={intervalMax}
              inputMode="numeric"
              autoComplete="off"
              aria-label={
                scheduleUnit === "month"
                  ? "Интервал в месяцах"
                  : "Интервал в днях"
              }
            />
            <span className="payment-page__day-interval-suffix">
              {typeof dayInterval === "number"
                ? scheduleCountLabel(scheduleUnit, dayInterval)
                : scheduleUnit === "month"
                  ? "месяцев"
                  : "дней"}
            </span>
          </div>
          <p className="payment-page__debt-days-hint">
            {typeof dayInterval === "number"
              ? scheduleUnit === "month"
                ? monthIntervalLabel(dayInterval)
                : dayIntervalLabel(dayInterval)
              : scheduleUnit === "month"
                ? "Укажите, через сколько месяцев повторять платёж"
                : "Укажите, через сколько дней повторять платёж"}
          </p>

          <label
            className="payment-page__debt-days-label"
            htmlFor="deferred-first-due-date"
          >
            Дата первого платежа
          </label>
          <div className="payment-page__debt-days-row">
            <input
              ref={deferredDueDateInputRef}
              id="deferred-first-due-date"
              type="date"
              className="payment-page__debt-days-input"
              value={deferredDueDate}
              min={todayIsoDate()}
              onChange={(e) => onFirstDueDateChange(e.target.value)}
            />
            <button
              type="button"
              className="payment-page__debt-days-calendar-btn"
              onClick={onOpenDeferredDueDatePicker}
              title="Выбрать дату первого платежа"
              aria-label="Выбрать дату первого платежа"
            >
              <Calendar size={20} strokeWidth={2} />
            </button>
          </div>

          {debtSchedule ? (
            <>
              <p className="payment-page__debt-days-hint">
                {debtSchedule.count}{" "}
                {scheduleUnit === "month"
                  ? scheduleCountLabel("month", debtSchedule.count)
                  : paymentCountLabel(debtSchedule.count)}
                {` · ${
                  scheduleUnit === "month"
                    ? monthIntervalLabel(debtSchedule.intervalMonths)
                    : dayIntervalLabel(debtSchedule.intervalDays)
                }`}{" "}
                · по <strong>{debtSchedule.perPeriod.toFixed(2)} сом</strong>
                {debtSchedule.lastAmount !== debtSchedule.perPeriod
                  ? ` · последний ${debtSchedule.lastAmount.toFixed(2)} сом`
                  : null}
                {" · "}
                до <strong>{formatIsoDateRu(debtSchedule.lastDueDate)}</strong>
              </p>
              <div className="payment-page__schedule-table" role="table">
                <div className="payment-page__schedule-row payment-page__schedule-row--head">
                  <span>#</span>
                  <span>Дата</span>
                  <span>Сумма</span>
                </div>
                {previewRows.map((row) => (
                  <div key={row.number} className="payment-page__schedule-row">
                    <span>{row.number}</span>
                    <span>{formatIsoDateRu(row.dueDate)}</span>
                    <span>{row.amountStr}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="payment-page__debt-days-hint">
              Укажите число платежей, чтобы увидеть график
            </p>
          )}
        </div>
      </div>
        </>
      )}

      <div className="payment-page__total-debt">
        <span>ОБЩИЙ ДОЛГ КЛИЕНТА</span>
        <span className="payment-page__total-debt-amount">
          {totalDebt.toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          сом
        </span>
      </div>
    </div>
  );
}
