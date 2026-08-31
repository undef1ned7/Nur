import PaymentPageDebtSection from "../../../../Sectors/Market/CashierPage/components/PaymentPageDebtSection";
import { MARKET_PAYMENT_BANKS } from "../../../../../constants/marketPaymentBanks";
import "../../../../Sectors/Market/CashierPage/PaymentPage.scss";

/**
 * Блок долга поставщику на странице добавления товара (как отсрочка в кассе).
 */
export default function SkladDebtForm({
  showDebtForm,
  onShowDebtFormChange,
  hasSupplier,
  supplierName,
  counterpartyDebt = 0,
  purchaseTotal = 0,
  company,
  startPlanPhone = "",
  onStartPlanPhoneChange,
  debtForm,
  classNamePrefix = "add-product-page",
}) {
  const checkbox = (
    <label className={`${classNamePrefix}__checkbox-label`}>
      <input
        type="checkbox"
        checked={showDebtForm}
        onChange={(e) => onShowDebtFormChange(e.target.checked)}
      />
      Добавить закупку в долг поставщику
    </label>
  );

  if (!showDebtForm) {
    return checkbox;
  }

  const totalDebt = debtForm.deferredSaleDebtRemaining + counterpartyDebt;

  return (
    <>
      {checkbox}

      <div
        className={`${classNamePrefix}__debt-form payment-page payment-page--embedded`}
      >
        {!hasSupplier && (
          <p className={`${classNamePrefix}__error`}>
            Выберите поставщика в форме выше!
          </p>
        )}

        {company?.subscription_plan?.name === "Старт" && hasSupplier && (
          <div className={`${classNamePrefix}__form-group`}>
            <label className={`${classNamePrefix}__label`}>
              Телефон поставщика
            </label>
            <input
              type="text"
              name="phone"
              value={startPlanPhone}
              onChange={(e) => onStartPlanPhoneChange?.(e.target.value)}
              className={`${classNamePrefix}__input`}
            />
          </div>
        )}

        {purchaseTotal > 0 && (
          <p className={`${classNamePrefix}__hint`} style={{ marginBottom: 12 }}>
            Сумма закупки:{" "}
            <strong>
              {purchaseTotal.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              сом
            </strong>
            {supplierName ? ` · ${supplierName}` : null}
          </p>
        )}

        <PaymentPageDebtSection
          total={purchaseTotal}
          totalDebt={totalDebt}
          deferredPrepaymentValue={debtForm.deferredPrepaymentValue}
          deferredSaleDebtRemaining={debtForm.deferredSaleDebtRemaining}
          deferredPrepaymentEnabled={debtForm.deferredPrepaymentEnabled}
          onDeferredPrepaymentEnabledChange={
            debtForm.setDeferredPrepaymentEnabled
          }
          deferredPrepaymentAmount={debtForm.deferredPrepaymentAmount}
          onDeferredPrepaymentAmountChange={
            debtForm.setDeferredPrepaymentAmount
          }
          deferredPrepaymentMethod={debtForm.deferredPrepaymentMethod}
          onDeferredPrepaymentMethodChange={(method) => {
            debtForm.setDeferredPrepaymentMethod(method);
            if (method === "cash") debtForm.setDeferredPrepaymentBank("");
          }}
          deferredPrepaymentBank={debtForm.deferredPrepaymentBank}
          onSelectDeferredPrepaymentBank={debtForm.setDeferredPrepaymentBank}
          banks={MARKET_PAYMENT_BANKS}
          version={debtForm.debtIsV2 ? "v2" : "v1"}
          debtDays={debtForm.debtDays}
          onDebtDaysChange={(value) => {
            if (value === "") {
              debtForm.setDebtDays("");
              return;
            }
            const numValue = parseInt(value, 10);
            if (!Number.isNaN(numValue)) {
              debtForm.setDebtDaysAndSyncDate(numValue);
            }
          }}
          onDebtDaysBlur={(value) => {
            const parsed = parseInt(value, 10);
            if (Number.isNaN(parsed) || parsed < 1) {
              debtForm.setDebtDaysAndSyncDate(30);
            }
          }}
          onDebtDaysDateChange={debtForm.setDebtDaysFromDate}
          scheduleUnit={debtForm.scheduleUnit}
          onScheduleUnitChange={debtForm.handleScheduleUnitChange}
          scheduleCount={debtForm.scheduleCount}
          onScheduleCountChange={debtForm.handleScheduleCountChange}
          onScheduleCountBlur={debtForm.handleScheduleCountBlur}
          onSchedulePreset={debtForm.handleScheduleCountChange}
          dayInterval={debtForm.dayInterval}
          onDayIntervalChange={debtForm.handleDayIntervalChange}
          onDayIntervalBlur={debtForm.handleDayIntervalBlur}
          onDayIntervalPreset={debtForm.handleDayIntervalPreset}
          debtSchedule={debtForm.debtSchedule}
          deferredDueDate={debtForm.deferredDueDate}
          deferredDueDateInputRef={debtForm.deferredDueDateInputRef}
          onOpenDeferredDueDatePicker={debtForm.openDeferredDueDatePicker}
          onFirstDueDateChange={debtForm.setDeferredDueDate}
          counterpartyKind="supplier"
        />
      </div>
    </>
  );
}
