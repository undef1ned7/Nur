import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asCurrency, asDateTime } from "../shared/constants";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";

const LEDGER_ENTRY_TYPE_LABELS = {
  charge: "Начисление",
  payment: "Оплата",
  barter: "Бартер",
  adjustment: "Корректировка",
  writeoff: "Списание",
};

const LEDGER_STATUS_LABELS = {
  draft: "Черновик",
  approved: "Подтверждено",
  cancelled: "Отменено",
};

const LEDGER_SOURCE_LABELS = {
  procurement: "Закупка",
  work_entry: "Процесс работ",
  treaty: "Договор",
  manual: "Вручную",
};

const SETTLEMENT_STATUS_LABELS = {
  draft: "Черновик",
  confirmed: "Подтверждено",
  approved: "Подтверждено",
  cancelled: "Отменено",
};

const pickFirst = (source, keys) => {
  if (!source || typeof source !== "object") return null;
  const foundKey = keys.find((key) => source[key] != null && source[key] !== "");
  return foundKey ? source[foundKey] : null;
};

const countList = (value) => {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.results)) return value.results.length;
  return 0;
};

const normalizeList = (value) => {
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value)) return value;
  return [];
};

const getSummaryMetrics = (summary) => [
  {
    key: "balance",
    label: "Текущий баланс",
    value: pickFirst(summary, ["balance", "amount", "total_balance"]),
  },
  {
    key: "charges",
    label: "Начисления",
    value: pickFirst(summary, [
      "charges_total",
      "charge_total",
      "charges",
      "total_charges",
    ]),
  },
  {
    key: "payments",
    label: "Оплаты",
    value: pickFirst(summary, [
      "payments_total",
      "payment_total",
      "payments",
      "total_payments",
    ]),
  },
  {
    key: "barter",
    label: "Бартер",
    value: pickFirst(summary, [
      "barter_total",
      "barters_total",
      "barter",
      "total_barter",
    ]),
  },
  {
    key: "writeoff",
    label: "Списания",
    value: pickFirst(summary, [
      "writeoff_total",
      "writeoffs_total",
      "writeoff",
      "total_writeoff",
    ]),
  },
].filter((item) => item.value != null);

export default function CounterpartySettlementsTab({
  counterpartyType,
  counterpartyId,
}) {
  const { selectedProjectId } = useBuildingProjects();
  const [state, setState] = useState({
    loading: false,
    loaded: false,
    error: null,
    summary: null,
    ledger: [],
    barterSettlements: [],
  });

  useEffect(() => {
    if (!counterpartyType || !counterpartyId) return;
    let cancelled = false;

    const load = async () => {
      setState((prev) => ({
        ...prev,
        loading: true,
        loaded: false,
        error: null,
      }));

      try {
        const summaryPromise = api.get(
          `/building/debts/summary/${counterpartyType}/${counterpartyId}/`,
          {
            params: {
              residential_complex: selectedProjectId || undefined,
            },
          },
        );

        const ledgerPromise = api.get("/building/debts/ledger/", {
          params: {
            residential_complex: selectedProjectId || undefined,
            counterparty_type: counterpartyType,
            counterparty_id: counterpartyId,
            page_size: 50,
          },
        });

        const barterPromise = api.get("/building/barter-settlements/", {
          params: {
            residential_complex: selectedProjectId || undefined,
            [counterpartyType]: counterpartyId,
            page_size: 50,
          },
        });

        const [summaryRes, ledgerRes, barterRes] = await Promise.all([
          summaryPromise,
          ledgerPromise,
          barterPromise,
        ]);

        if (cancelled) return;

        setState({
          loading: false,
          loaded: true,
          error: null,
          summary: summaryRes?.data ?? null,
          ledger: normalizeList(ledgerRes?.data),
          barterSettlements: normalizeList(barterRes?.data),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          loading: false,
          loaded: true,
          error: err,
          summary: null,
          ledger: [],
          barterSettlements: [],
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [counterpartyId, counterpartyType, selectedProjectId]);

  const metrics = useMemo(
    () => getSummaryMetrics(state.summary),
    [state.summary],
  );

  if (!counterpartyId) return null;

  return (
    <div className="client-detail__section" style={{ display: "grid", gap: 16 }}>
      {state.loading && (
        <div className="sell-loading">
          <div className="sell-loading__spinner" />
          <p className="sell-loading__text">
            Загрузка взаиморасчётов и бартерных зачётов...
          </p>
        </div>
      )}

      {state.error && (
        <div className="building-page__error">
          {String(
            validateResErrors(
              state.error,
              "Не удалось загрузить взаиморасчёты контрагента",
            ),
          )}
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          <div className="sell-card client-detail__card">
            <div
              className="client-detail__row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h4 className="sell-form__sectionTitle" style={{ margin: 0 }}>
                Сводка по долгам
              </h4>
              <div className="building-page__muted">
                {selectedProjectId
                  ? "По выбранному ЖК"
                  : "По всем проектам"}
              </div>
            </div>

            {metrics.length === 0 ? (
              <div className="client-detail__empty">
                Данных по сводке пока нет.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                {metrics.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div className="building-page__muted">{item.label}</div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginTop: 6,
                      }}
                    >
                      {asCurrency(item.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sell-card client-detail__card">
            <h4 className="sell-form__sectionTitle" style={{ marginTop: 0 }}>
              Реестр долгов
            </h4>

            {state.ledger.length === 0 ? (
              <div className="client-detail__empty">
                Записей в реестре долгов пока нет.
              </div>
            ) : (
              <div className="client-detail__tableWrap">
                <table className="client-detail__table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Тип</th>
                      <th>Источник</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.ledger.map((row, index) => {
                      const rowId = row?.id ?? row?.uuid ?? `${row?.created_at}-${index}`;
                      const sourceLabel =
                        row?.source_display ||
                        LEDGER_SOURCE_LABELS[row?.source_type] ||
                        row?.source_type ||
                        "—";

                      return (
                        <tr key={rowId}>
                          <td>{asDateTime(row?.approved_at || row?.created_at)}</td>
                          <td>
                            {LEDGER_ENTRY_TYPE_LABELS[row?.entry_type] ||
                              row?.entry_type ||
                              "—"}
                          </td>
                          <td>
                            {sourceLabel}
                            {row?.source_id ? ` #${row.source_id}` : ""}
                          </td>
                          <td>{asCurrency(row?.amount)}</td>
                          <td>
                            {LEDGER_STATUS_LABELS[row?.status] ||
                              row?.status ||
                              "—"}
                          </td>
                          <td>{row?.comment || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="sell-card client-detail__card">
            <h4 className="sell-form__sectionTitle" style={{ marginTop: 0 }}>
              Бартерные зачёты
            </h4>

            {state.barterSettlements.length === 0 ? (
              <div className="client-detail__empty">
                Бартерные зачёты по этому контрагенту пока не зарегистрированы.
              </div>
            ) : (
              <div className="client-detail__tableWrap">
                <table className="client-detail__table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Контрагент</th>
                      <th>Сумма</th>
                      <th>Встречные поставки</th>
                      <th>Строки закупок</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.barterSettlements.map((row, index) => {
                      const rowId = row?.id ?? row?.uuid ?? `${row?.created_at}-${index}`;
                      const counterpartyName =
                        row?.supplier_name ||
                        row?.contractor_name ||
                        row?.counterparty_name ||
                        "—";

                      return (
                        <tr key={rowId}>
                          <td>{asDateTime(row?.confirmed_at || row?.created_at)}</td>
                          <td>{counterpartyName}</td>
                          <td>
                            {asCurrency(
                              pickFirst(row, ["amount_total", "amount", "total_amount"]),
                            )}
                          </td>
                          <td>{countList(row?.counter_deliveries)}</td>
                          <td>{countList(row?.purchase_items)}</td>
                          <td>
                            {SETTLEMENT_STATUS_LABELS[row?.status] ||
                              row?.status ||
                              "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
