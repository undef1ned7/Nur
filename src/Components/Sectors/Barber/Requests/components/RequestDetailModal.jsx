import React from "react";
import {
  FaTimes,
  FaUser,
  FaPhone,
  FaCalendarAlt,
  FaClock,
  FaComment,
} from "react-icons/fa";

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
};

const fmtTime = (timeStr) => {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
};

const STATUS_LABELS = {
  new: "Новая",
  confirmed: "Подтверждена",
  no_show: "Не пришел",
  spam: "Спам/Ошибка",
};

const RequestDetailModal = ({ request, onClose }) => {
  if (!request) return null;

  const statusKey = request.status || "new";
  const services = request.services || [];
  const totalDuration = request.total_duration_min || 
    services.reduce((sum, s) => sum + (s.duration_min || 0), 0);

  return (
    <>
      <div className="barberrequests__overlay" onClick={onClose} />
      <div className="barberrequests__modal">
        <div className="barberrequests__modalHeader">
          <h3 className="barberrequests__modalTitle">Детали заявки</h3>
          <button
            type="button"
            className="barberrequests__modalClose"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="barberrequests__modalBody">
          <div className="barberrequests__modalStatus">
            <span className={`barberrequests__badge barberrequests__badge--${statusKey}`}>
              {STATUS_LABELS[statusKey] || statusKey}
            </span>
          </div>

          <div className="barberrequests__modalSection">
            <h4 className="barberrequests__modalSectionTitle">
              <FaUser className="barberrequests__modalSectionIcon" />
              Информация о клиенте
            </h4>
            <div className="barberrequests__modalClientInfo">
              <div className="barberrequests__modalClientRow">
                <div className="barberrequests__modalClientLabel">Имя клиента</div>
                <div className="barberrequests__modalClientValue">{request.client_name || "—"}</div>
              </div>
              <div className="barberrequests__modalClientRow">
                <div className="barberrequests__modalClientLabel">Телефон</div>
                <div className="barberrequests__modalClientValue">
                  <FaPhone className="barberrequests__modalInlineIcon" />
                  {request.client_phone || "—"}
                </div>
              </div>
              {request.client_comment && (
                <div className="barberrequests__modalClientRow barberrequests__modalClientRow--full">
                  <div className="barberrequests__modalClientLabel">Комментарий</div>
                  <div className="barberrequests__modalClientComment">
                    <FaComment className="barberrequests__modalInlineIcon" />
                    {request.client_comment}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="barberrequests__modalGrid">
            <div className="barberrequests__modalItem">
              <div className="barberrequests__modalIcon">
                <FaUser />
              </div>
              <div className="barberrequests__modalInfo">
                <span className="barberrequests__modalLabel">Мастер</span>
                <span className="barberrequests__modalValue">{request.master_name || "—"}</span>
              </div>
            </div>

            <div className="barberrequests__modalItem">
              <div className="barberrequests__modalIcon">
                <FaCalendarAlt />
              </div>
              <div className="barberrequests__modalInfo">
                <span className="barberrequests__modalLabel">Дата</span>
                <span className="barberrequests__modalValue">{fmtDate(request.date)}</span>
              </div>
            </div>

            <div className="barberrequests__modalItem barberrequests__modalItem--full">
              <div className="barberrequests__modalIcon">
                <FaClock />
              </div>
              <div className="barberrequests__modalInfo">
                <span className="barberrequests__modalLabel">Время записи</span>
                <span className="barberrequests__modalValue">
                  {fmtTime(request.time_start)} - {fmtTime(request.time_end)}
                </span>
              </div>
            </div>
          </div>

          <div className="barberrequests__modalSection">
            <h4 className="barberrequests__modalSectionTitle">
              <FaClock className="barberrequests__modalSectionIcon" />
              Услуги и стоимость
            </h4>
            <div className="barberrequests__modalServices">
              {services.map((service, idx) => (
                <div key={idx} className="barberrequests__modalServiceRow">
                  <div className="barberrequests__modalServiceInfo">
                    <span className="barberrequests__modalServiceName">{service.title}</span>
                    {service.duration_min && (
                      <span className="barberrequests__modalServiceDuration">
                        {service.duration_min} мин
                      </span>
                    )}
                  </div>
                  <span className="barberrequests__modalServicePrice">{fmtMoney(service.price)} сом</span>
                </div>
              ))}
              <div className="barberrequests__modalServiceTotal">
                <div className="barberrequests__modalServiceRow barberrequests__modalServiceRow--total">
                  <div className="barberrequests__modalServiceInfo">
                    <span className="barberrequests__modalServiceName">Итого</span>
                    <span className="barberrequests__modalServiceDuration">
                      {totalDuration} мин
                    </span>
                  </div>
                  <span className="barberrequests__modalTotalPrice">{fmtMoney(request.total_price)} сом</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RequestDetailModal;
