// MastersHistoryList.jsx
import React, { useState, useEffect } from "react";
import { FaTimes, FaUser, FaCut, FaCalendarAlt, FaClock, FaMoneyBillWave, FaPercent, FaTag } from "react-icons/fa";
import api from "../../../../../../api";
import Loading from "../../../../../common/Loading/Loading";
import {
  dateISO,
  timeISO,
  fmtMoney,
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
  loading,
  viewMode,
}) => {
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [appointmentDetails, setAppointmentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const openModal = (record) => setSelectedRecord(record);
  const closeModal = () => {
    setSelectedRecord(null);
    setAppointmentDetails(null);
    setDetailsError("");
  };

  // Загружаем полную информацию о записи при открытии модального окна
  useEffect(() => {
    if (!selectedRecord?.id) {
      return;
    }

    const fetchDetails = async () => {
      try {
        setDetailsLoading(true);
        setDetailsError("");
        const response = await api.get(`/barbershop/appointments/${selectedRecord.id}/`);
        setAppointmentDetails(response.data);
      } catch (error) {
        setDetailsError("Не удалось загрузить детали записи");
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedRecord]);

  if (loading) {
    return <Loading message="Загрузка истории..." />;
  }

  if (records.length === 0) {
    return <div className="barbermastershistory__empty">Записей нет</div>;
  }

  // Подготовка данных для записи из нового формата API
  const getRecordData = (a) => {
    // Новый формат: { id, date, employee, client, total, status }
    const date = dateISO(a.date);
    const time = timeISO(a.date);
    const client = a.client || "—";
    const barber = a.employee || "—";
    const totalPrice = a.total ? parseFloat(a.total) : null;
    const statusKey = statusKeyFromAppointment(a);
    const statusText = a.status_display || statusLabel(a.status);

    return { date, time, client, barber, totalPrice, statusKey, statusText };
  };

  // Модальное окно с полной информацией
  const renderModal = () => {
    if (!selectedRecord) return null;

    const data = getRecordData(selectedRecord);

    // Используем детальные данные, если они загружены
    const details = appointmentDetails;
    
    // Получаем услуги
    const serviceNames = details?.services_names || [];
    
    // Получаем цены
    const num = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const servicesPublic = Array.isArray(details?.services_public) ? details.services_public : [];
    const servicesPriceSum = servicesPublic.reduce((sum, s) => sum + (num(s?.price) || 0), 0);
    
    const basePriceRaw = num(details?.price);
    const discountPct = num(details?.discount) || 0;
    const basePrice = basePriceRaw !== null ? basePriceRaw : servicesPriceSum || num(selectedRecord.total);
    const totalPrice = basePrice !== null && discountPct > 0
      ? Math.round(basePrice * (1 - discountPct / 100))
      : basePrice;

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
            {detailsLoading && (
              <div className="barbermastershistory__modalLoading">Загрузка деталей...</div>
            )}
            
            {detailsError && (
              <div className="barbermastershistory__modalError">{detailsError}</div>
            )}

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

            {/* Услуги */}
            {serviceNames.length > 0 && (
              <div className="barbermastershistory__modalSection">
                <div className="barbermastershistory__modalItem barbermastershistory__modalItem--full">
                  <div className="barbermastershistory__modalIcon">
                    <FaCut />
                  </div>
                  <div className="barbermastershistory__modalInfo">
                    <span className="barbermastershistory__modalLabel">Услуги</span>
                    <span className="barbermastershistory__modalValue">{serviceNames.join(", ")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Цены */}
            {!detailsLoading && details && (
              <div className="barbermastershistory__modalPricing">
                {basePrice !== null && (
                  <div className="barbermastershistory__modalPriceRow">
                    <span className="barbermastershistory__modalPriceLabel">
                      <FaTag /> Цена
                    </span>
                    <span className="barbermastershistory__modalPriceValue">{fmtMoney(basePrice)}</span>
                  </div>
                )}

                {discountPct > 0 && (
                  <div className="barbermastershistory__modalPriceRow barbermastershistory__modalPriceRow--discount">
                    <span className="barbermastershistory__modalPriceLabel">
                      <FaPercent /> Скидка
                    </span>
                    <span className="barbermastershistory__modalPriceValue">-{discountPct}%</span>
                  </div>
                )}

                <div className="barbermastershistory__modalPriceRow barbermastershistory__modalPriceRow--total">
                  <span className="barbermastershistory__modalPriceLabel">
                    <FaMoneyBillWave /> Итого
                  </span>
                  <span className="barbermastershistory__modalPriceValue">{fmtMoney(totalPrice)}</span>
                </div>
              </div>
            )}

            {/* Если детали еще не загружены, показываем только итого из списка */}
            {!detailsLoading && !details && (
              <div className="barbermastershistory__modalPricing">
                <div className="barbermastershistory__modalPriceRow barbermastershistory__modalPriceRow--total">
                  <span className="barbermastershistory__modalPriceLabel">
                    <FaMoneyBillWave /> Итого
                  </span>
                  <span className="barbermastershistory__modalPriceValue">{fmtMoney(data.totalPrice)}</span>
                </div>
              </div>
            )}
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
                    key={a.id}
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
              key={a.id}
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
