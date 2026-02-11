import React, { useState } from "react";
import {
  FaPhone,
  FaUser,
  FaCut,
  FaClock,
  FaComment,
  FaCheck,
  FaBan,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaSpinner,
} from "react-icons/fa";
import BarberSelect from "../../common/BarberSelect";

const STATUS_MAP = {
  new: { label: "Новая", icon: FaCalendarAlt },
  confirmed: { label: "Подтверждена", icon: FaCheck },
  no_show: { label: "Не пришел", icon: FaBan },
  spam: { label: "Спам/Ошибка", icon: FaExclamationTriangle },
};

const STATUS_OPTIONS = [
  { value: "new", label: "Новая" },
  { value: "confirmed", label: "Подтверждена" },
  { value: "no_show", label: "Не пришел" },
  { value: "spam", label: "Спам/Ошибка" },
];

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const fmtTime = (timeStr) => {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
};

const getMasterName = (request) => {
  if (request.master_name) return request.master_name;
  const m = request.master;
  if (m && (m.full_name || m.first_name || m.last_name)) {
    return m.full_name || [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || "—";
  }
  return "—";
};

const RequestCard = ({ request, onStatusChange, onClick }) => {
  const [statusLoading, setStatusLoading] = useState(false);
  const statusInfo = STATUS_MAP[request.status] || STATUS_MAP.new;
  const StatusIcon = statusInfo.icon;

  const handleStatusClick = (e) => {
    e.stopPropagation();
  };

  const handleStatusChange = async (newValue) => {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await onStatusChange(request.id, newValue);
    } finally {
      setStatusLoading(false);
    }
  };

  // Получаем первую услугу или показываем количество
  const servicesText = (() => {
    const services = request.services || [];
    if (services.length === 0) return "—";
    if (services.length === 1) return services[0].title;
    return `${services[0].title} +${services.length - 1}`;
  })();

  return (
    <article className="barberrequests__card" onClick={() => onClick(request)}>
      <div className="barberrequests__cardHeader">
        <div className="barberrequests__statusWrap" onClick={handleStatusClick}>
          <div className={`barberrequests__statusIndicator barberrequests__statusIndicator--${request.status}`}>
            {statusLoading ? (
              <FaSpinner className="barberrequests__statusIndicatorIcon barberrequests__spinner" />
            ) : (
              <StatusIcon className="barberrequests__statusIndicatorIcon" />
            )}
          </div>
          <BarberSelect
            value={request.status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            placeholder="Статус"
            hideClear
            hideSearch
            className="barberrequests__statusSelect"
            disabled={statusLoading}
          />
        </div>

        <div className="barberrequests__dateBadge">{fmtDate(request.date)}</div>
      </div>

      <div className="barberrequests__cardBody">
        <div className="barberrequests__cardMain">
          <div className="barberrequests__clientInfo">
            <FaUser className="barberrequests__clientIcon" />
            <div className="barberrequests__clientDetails">
              <div className="barberrequests__clientName">{request.client_name || "—"}</div>
              <div className="barberrequests__clientPhone">{request.client_phone || "—"}</div>
            </div>
          </div>

          <div className="barberrequests__timeInfo">
            <FaClock className="barberrequests__timeIcon" />
            <div className="barberrequests__timeText">
              {fmtTime(request.time_start)} - {fmtTime(request.time_end)}
            </div>
          </div>
        </div>

        <div className="barberrequests__cardFooter">
          <div className="barberrequests__servicePreview">
            <FaCut className="barberrequests__serviceIcon" />
            <span className="barberrequests__serviceText">{servicesText}</span>
          </div>
          <div className="barberrequests__masterPreview">
            <span className="barberrequests__masterLabel">Мастер:</span>
            <span className="barberrequests__masterName">{getMasterName(request)}</span>
          </div>
        </div>
        {request.status === "new" && (
          <div className="barberrequests__cardAccept" onClick={handleStatusClick}>
            <button
              type="button"
              className="barberrequests__acceptBtn"
              disabled={statusLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange("confirmed");
              }}
            >
              {statusLoading ? (
                <FaSpinner className="barberrequests__acceptBtnSpinner" />
              ) : (
                <FaCheck className="barberrequests__acceptBtnIcon" />
              )}
              Принять в запись
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default RequestCard;
