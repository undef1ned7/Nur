import React from "react";
import {
  FaPhone,
  FaUser,
  FaCut,
  FaClock,
  FaMoneyBillWave,
  FaComment,
  FaCheck,
  FaBan,
  FaExclamationTriangle,
  FaCalendarAlt,
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

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const fmtTime = (timeStr) => {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
};

const RequestCard = ({ request, onStatusChange, onClick }) => {
  const statusInfo = STATUS_MAP[request.status] || STATUS_MAP.new;
  const StatusIcon = statusInfo.icon;

  const handleStatusClick = (e) => {
    e.stopPropagation();
  };

  const handleStatusChange = (newValue) => {
    onStatusChange(request.id, newValue);
  };

  return (
    <article className="barberrequests__card" onClick={() => onClick(request)}>
      <div className="barberrequests__cardHeader">
        <div className="barberrequests__statusWrap" onClick={handleStatusClick}>
          <div className={`barberrequests__statusIndicator barberrequests__statusIndicator--${request.status}`}>
            <StatusIcon className="barberrequests__statusIndicatorIcon" />
          </div>
          <BarberSelect
            value={request.status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            placeholder="Статус"
            hideClear
            hideSearch
            className="barberrequests__statusSelect"
          />
        </div>

        <div className="barberrequests__dateBadge">{fmtDate(request.date)}</div>

        <button className="barberrequests__chatBtn" title="Комментарий">
          <FaComment />
        </button>
      </div>

      <div className="barberrequests__cardBody">
        <div className="barberrequests__cardLeft">
          <div className="barberrequests__infoRow">
            <FaUser className="barberrequests__infoIcon" />
            <span>Мастер: <strong>{request.master_name || "—"}</strong></span>
          </div>
          <div className="barberrequests__infoRow">
            <FaPhone className="barberrequests__infoIcon" />
            <span>Телефон: {request.client_phone || "—"}</span>
          </div>
          <div className="barberrequests__infoRow">
            <FaCut className="barberrequests__infoIcon" />
            <span>
              Услуги: {(request.services || []).map((s) => s.title).join(", ") || "—"}
            </span>
          </div>
          {request.client_comment && (
            <div className="barberrequests__infoRow barberrequests__infoRow--comment">
              <FaComment className="barberrequests__infoIcon" />
              <span>Комментарий: <em>{request.client_comment}</em></span>
            </div>
          )}
        </div>

        <div className="barberrequests__cardRight">
          <div className="barberrequests__infoRow">
            <FaUser className="barberrequests__infoIcon" />
            <span>Клиент: <strong>{request.client_name || "—"}</strong></span>
          </div>
          <div className="barberrequests__infoRow barberrequests__infoRow--price">
            <FaMoneyBillWave className="barberrequests__infoIcon" />
            <span>Сумма: <strong>{fmtMoney(request.total_price)} сом</strong></span>
          </div>
          <div className="barberrequests__infoRow">
            <FaClock className="barberrequests__infoIcon" />
            <span>
              Время: {fmtTime(request.time_start)} - {fmtTime(request.time_end)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default RequestCard;
