// RecordaDaySummary.jsx — итог за день сверху + модалка разбивки по клиентам
import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  RECORDA_LAYOUT,
  computeDaySummaryByClient,
  fmtMoney,
  pluralRecordsLabel,
} from "./RecordaUtils";

const pluralClientsLabel = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "клиент";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "клиента";
  return "клиентов";
};

const RecordaDaySummary = ({
  dateLabel = "",
  count = 0,
  expectedTotal = 0,
  records = [],
  services = [],
  clients = [],
  dayLayout,
  onDayLayoutChange,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const byClient = useMemo(
    () =>
      computeDaySummaryByClient({
        records,
        services,
        clients,
      }),
    [records, services, clients],
  );

  const canOpenModal = count > 0 && byClient.length > 0;

  useEffect(() => {
    if (!modalOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setModalOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen]);

  return (
    <>
      <div className="barberrecorda__daySummaryWrap">
        <div className="barberrecorda__daySummaryTop" aria-live="polite">
          <button
            type="button"
            className={`barberrecorda__daySummaryTotalBtn ${
              canOpenModal ? "" : "is-static"
            }`}
            onClick={() => canOpenModal && setModalOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={modalOpen}
            disabled={!canOpenModal}
            title={
              canOpenModal
                ? "Открыть сумму по клиентам"
                : "Нет записей для детализации"
            }
          >
            <span className="barberrecorda__daySummaryTotalLabel">Итого за день</span>
            <span className="barberrecorda__daySummaryTotalValue">
              {fmtMoney(expectedTotal)}
            </span>
          </button>

          <div className="barberrecorda__daySummaryMeta">
            <span className="barberrecorda__daySummaryLead">{dateLabel}</span>
            <span className="barberrecorda__daySummaryItem">
              <strong>{count}</strong> {pluralRecordsLabel(count)}
            </span>
          </div>

          <div
            className="barberrecorda__layoutToggle"
            role="group"
            aria-label="Вид расписания"
          >
            <button
              type="button"
              className={`barberrecorda__layoutBtn ${
                dayLayout === RECORDA_LAYOUT.CALENDAR ? "is-active" : ""
              }`}
              onClick={() => onDayLayoutChange(RECORDA_LAYOUT.CALENDAR)}
            >
              Календарь
            </button>
            <button
              type="button"
              className={`barberrecorda__layoutBtn ${
                dayLayout === RECORDA_LAYOUT.LIST ? "is-active" : ""
              }`}
              onClick={() => onDayLayoutChange(RECORDA_LAYOUT.LIST)}
            >
              Список
            </button>
          </div>
        </div>
      </div>

      {modalOpen && canOpenModal ? (
        <>
          <div
            className="barberrecorda__summaryModalOverlay"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <div
            id="barberrecorda-day-summary-breakdown"
            className="barberrecorda__summaryModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barberrecorda-summary-modal-title"
          >
            <div className="barberrecorda__summaryModalHead">
              <div className="barberrecorda__summaryModalHeadMain">
                <h3
                  id="barberrecorda-summary-modal-title"
                  className="barberrecorda__summaryModalTitle"
                >
                  Сумма по клиентам
                </h3>
                <p className="barberrecorda__summaryModalSubtitle">
                  {dateLabel} · {count} {pluralRecordsLabel(count)} ·{" "}
                  {fmtMoney(expectedTotal)}
                </p>
              </div>
              <button
                type="button"
                className="barberrecorda__summaryModalClose"
                onClick={() => setModalOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberrecorda__summaryModalMeta">
              {byClient.length} {pluralClientsLabel(byClient.length)}
            </div>

            <div className="barberrecorda__summaryModalBody">
              <table className="barberrecorda__daySummaryBreakdownTable">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th className="barberrecorda__daySummaryBreakdownTh--count">
                      Записей
                    </th>
                    <th className="barberrecorda__daySummaryBreakdownTh--sum">
                      Сумма
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <span className="barberrecorda__daySummaryClientName">
                          {row.name}
                        </span>
                        {row.phone ? (
                          <span className="barberrecorda__daySummaryClientPhone">
                            {row.phone}
                          </span>
                        ) : null}
                      </td>
                      <td className="barberrecorda__daySummaryBreakdownTd--count">
                        {row.count}
                      </td>
                      <td className="barberrecorda__daySummaryBreakdownTd--sum">
                        {fmtMoney(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Всего</td>
                    <td className="barberrecorda__daySummaryBreakdownTd--count">
                      {count}
                    </td>
                    <td className="barberrecorda__daySummaryBreakdownTd--sum">
                      {fmtMoney(expectedTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default RecordaDaySummary;
