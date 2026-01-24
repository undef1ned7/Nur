// MastersHistoryList.jsx
import React, { useState } from "react";
import { FaTimes, FaUser, FaCut, FaCalendarAlt, FaClock, FaMoneyBillWave, FaPercent, FaTag } from "react-icons/fa";
import {
  dateISO,
  timeISO,
  fmtMoney,
  barberNameOf,
  serviceNamesFromRecord,
  clientNameOf,
  priceOfAppointment,
  basePriceOfAppointment,
  discountPercentOfAppointment,
  statusLabel,
} from "../MastersHistoryUtils";

const statusKeyFromAppointment = (a) => {
  const raw = String(a.status || "").trim().toLowerCase();
  if (raw === "booked") return "booked";
  if (raw === "confirmed") return "confirmed";
  if (raw === "completed") return "completed";
  if (raw === "canceled") return "canceled";
  if (raw === "no_show" || raw === "no-show") return "no-show";
  return "other";
};

const MastersHistoryList = ({
  records,
  employees,
  services,
  clients,
  loading,
  viewMode,
}) => {
  const [selectedRecord, setSelectedRecord] = useState(null);

  const openModal = (record) => setSelectedRecord(record);
  const closeModal = () => setSelectedRecord(null);

  if (loading) {
    return (
      <div className="barbermastershistory__skeletonList" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="barbermastershistory__skeletonCard" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return <div className="barbermastershistory__empty">Записей нет</div>;
  }

  // Подготовка данных для записи
  const getRecordData = (a) => {
    const date = dateISO(a.start_at);
    const time = timeISO(a.start_at);
    const client = clientNameOf(a, clients);
    const service = serviceNamesFromRecord(a, services);
    const barber = barberNameOf(a, employees);
    const totalPrice = priceOfAppointment(a, services);
    const basePrice = basePriceOfAppointment(a, services);
    const discountPct = discountPercentOfAppointment(a, basePrice, totalPrice);
    const statusKey = statusKeyFromAppointment(a);
    const statusText = a.status_display || statusLabel(a.status);

    return { date, time, client, service, barber, totalPrice, basePrice, discountPct, statusKey, statusText };
  };

  // Модальное окно с полной информацией
  const renderModal = () => {
    if (!selectedRecord) return null;

    const data = getRecordData(selectedRecord);

    return (
      <>
        <div className="barbermastershistory__overlay" onClick={closeModal} />
        <div className="barbermastershistory__modal">
          <div className="barbermastershistory__modalHeader">
            <h3 className="barbermastershistory__modalTitle">Детали записи</h3>
            <button
              type="button"
              className="barbermastershistory__modalClose"
              onClick={closeModal}
            >
              <FaTimes />
            </button>
          </div>

          <div className="barbermastershistory__modalBody">
            <div className="barbermastershistory__modalStatus">
              <span className={`barbermastershistory__badge barbermastershistory__badge--${data.statusKey}`}>
                {data.statusText}
              </span>
            </div>

            <div className="barbermastershistory__modalGrid">
              <div className="barbermastershistory__modalItem">
                <div className="barbermastershistory__modalIcon">
                  <FaCalendarAlt />
                </div>
                <div className="barbermastershistory__modalInfo">
                  <span className="barbermastershistory__modalLabel">Дата</span>
                  <span className="barbermastershistory__modalValue">{data.date}</span>
                </div>
              </div>

              <div className="barbermastershistory__modalItem">
                <div className="barbermastershistory__modalIcon">
                  <FaClock />
                </div>
                <div className="barbermastershistory__modalInfo">
                  <span className="barbermastershistory__modalLabel">Время</span>
                  <span className="barbermastershistory__modalValue">{data.time}</span>
                </div>
              </div>

              <div className="barbermastershistory__modalItem">
                <div className="barbermastershistory__modalIcon">
                  <FaUser />
                </div>
                <div className="barbermastershistory__modalInfo">
                  <span className="barbermastershistory__modalLabel">Сотрудник</span>
                  <span className="barbermastershistory__modalValue">{data.barber}</span>
                </div>
              </div>

              <div className="barbermastershistory__modalItem">
                <div className="barbermastershistory__modalIcon">
                  <FaUser />
                </div>
                <div className="barbermastershistory__modalInfo">
                  <span className="barbermastershistory__modalLabel">Клиент</span>
                  <span className="barbermastershistory__modalValue">{data.client}</span>
                </div>
              </div>
            </div>

            <div className="barbermastershistory__modalSection">
              <div className="barbermastershistory__modalItem barbermastershistory__modalItem--full">
                <div className="barbermastershistory__modalIcon">
                  <FaCut />
                </div>
                <div className="barbermastershistory__modalInfo">
                  <span className="barbermastershistory__modalLabel">Услуги</span>
                  <span className="barbermastershistory__modalValue">{data.service}</span>
                </div>
              </div>
            </div>

            <div className="barbermastershistory__modalPricing">
              <div className="barbermastershistory__modalPriceRow">
                <span className="barbermastershistory__modalPriceLabel">
                  <FaTag /> Цена
                </span>
                <span className="barbermastershistory__modalPriceValue">{fmtMoney(data.basePrice)}</span>
              </div>

              {data.discountPct > 0 && (
                <div className="barbermastershistory__modalPriceRow barbermastershistory__modalPriceRow--discount">
                  <span className="barbermastershistory__modalPriceLabel">
                    <FaPercent /> Скидка
                  </span>
                  <span className="barbermastershistory__modalPriceValue">-{data.discountPct}%</span>
                </div>
              )}

              <div className="barbermastershistory__modalPriceRow barbermastershistory__modalPriceRow--total">
                <span className="barbermastershistory__modalPriceLabel">
                  <FaMoneyBillWave /> Итого
                </span>
                <span className="barbermastershistory__modalPriceValue">{fmtMoney(data.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  if (viewMode === "table") {
    return (
      <>
        <div className="barbermastershistory__tableWrap">
          <table className="barbermastershistory__table">
            <thead>
              <tr>
                <th className="barbermastershistory__thDate">Дата</th>
                <th className="barbermastershistory__thEmployee">Сотрудник</th>
                <th className="barbermastershistory__thClient">Клиент</th>
                <th className="barbermastershistory__thTotal">Итого</th>
                <th className="barbermastershistory__thStatus">Статус</th>
              </tr>
            </thead>
            <tbody>
              {records.map((a) => {
                const data = getRecordData(a);

                return (
                  <tr
                    key={a.id ?? `${a.start_at}-${data.client}`}
                    className="barbermastershistory__tableRow"
                    onClick={() => openModal(a)}
                  >
                    <td className="barbermastershistory__tdDate">{data.date}</td>
                    <td className="barbermastershistory__tdEmployee">{data.barber}</td>
                    <td className="barbermastershistory__tdClient">{data.client}</td>
                    <td className="barbermastershistory__tdTotal">{fmtMoney(data.totalPrice)}</td>
                    <td className="barbermastershistory__tdStatus">
                      <span className={`barbermastershistory__badge barbermastershistory__badge--${data.statusKey}`}>
                        {data.statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderModal()}
      </>
    );
  }

  // Cards view
  return (
    <>
      <div className="barbermastershistory__list">
        {records.map((a) => {
          const data = getRecordData(a);

          return (
            <article
              key={a.id ?? `${a.start_at}-${data.client}-${data.service}`}
              className={`barbermastershistory__card barbermastershistory__card--${data.statusKey}`}
              onClick={() => openModal(a)}
            >
              <div className="barbermastershistory__cardHead">
                <h4 className="barbermastershistory__cardTitle">
                  {data.date}
                </h4>
                <span className={`barbermastershistory__badge barbermastershistory__badge--${data.statusKey}`}>
                  {data.statusText}
                </span>
              </div>

              <div className="barbermastershistory__body">
                <div className="barbermastershistory__row">
                  <span className="barbermastershistory__label">Сотрудник:</span>
                  <span className="barbermastershistory__value">{data.barber}</span>
                </div>
                <div className="barbermastershistory__row">
                  <span className="barbermastershistory__label">Клиент:</span>
                  <span className="barbermastershistory__value">{data.client}</span>
                </div>
                <div className="barbermastershistory__cardTotal">
                  <span className="barbermastershistory__cardTotalLabel">Итого:</span>
                  <span className="barbermastershistory__cardTotalValue">{fmtMoney(data.totalPrice)}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {renderModal()}
    </>
  );
};

export default MastersHistoryList;
