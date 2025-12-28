import React from "react";
import { FaMapMarkerAlt, FaClock, FaCheck } from "react-icons/fa";

const getStatusStep = (status) => {
  if (status === "completed") return 3;
  if (status === "transit") return 2;
  return 1; // decorated
};

const getProgressPercent = (status) => {
  const step = getStatusStep(status);
  if (step <= 1) return 33;
  if (step === 2) return 66;
  return 100;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

/**
 * Логика клика по шагам:
 * - "Отправка" всегда выполнена (статус хотя бы decorated).
 * - Клик "В пути":
 *    decorated  -> transit
 *    transit    -> decorated
 *    completed  -> transit
 * - Клик "Прибытие":
 *    completed  -> transit
 *    (decorated | transit) -> completed
 */
const getNextStatusByClick = (currentStatus, stepKey) => {
  if (stepKey === "decorated") {
    return "decorated";
  }

  if (stepKey === "transit") {
    if (currentStatus === "decorated") return "transit";
    if (currentStatus === "transit") return "decorated";
    if (currentStatus === "completed") return "transit";
  }

  if (stepKey === "completed") {
    if (currentStatus === "completed") return "transit";
    return "completed";
  }

  return currentStatus;
};

const LogisticsOrderViewModal = ({ order, onClose, getClientName, onStatusChange }) => {
  if (!order) return null;

  const handleStepClick = (stepKey) => {
    const nextStatus = getNextStatusByClick(order.status, stepKey);
    if (nextStatus !== order.status && typeof onStatusChange === "function") {
      onStatusChange(nextStatus);
    }
  };

  return (
    <div className="logistics-page__modal-overlay" onClick={onClose}>
      <div
        className="logistics-page__modal logistics-page__modal--view"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logistics-page__form logistics-page__timeline-card">
          <div className="logistics-page__timeline-header">
            <div className="logistics-page__timeline-icon">
              <FaMapMarkerAlt />
            </div>
            <div>
              <div className="logistics-page__timeline-title">
                Отслеживание маршрута
              </div>
              <div className="logistics-page__timeline-subtitle">
                {getClientName(order.clientId)}
              </div>
            </div>
          </div>

          <div className="logistics-page__timeline">
            {[
              {
                key: "decorated",
                title: "Отправка автомобиля",
                subtitle: order.carName || "Машина подготовлена к отправке",
                date: formatDate(order.updated_at),
              },
              {
                key: "transit",
                title: "В пути",
                subtitle: "Транспортировка груза",
                date: formatDate(order.updated_at),
              },
              {
                key: "completed",
                title: "Прибытие",
                subtitle: "Прибытие в пункт назначения",
                date: formatDate(order.updated_at),
              },
            ].map((step, index, arr) => {
              const statusStep = getStatusStep(order.status);
              const isDone = index + 1 < statusStep;
              const isCurrent = index + 1 === statusStep;
              const isLast = index === arr.length - 1;

              const isActive = isDone || isCurrent;

              return (
                <div
                  key={step.key}
                  className={`logistics-page__timeline-step${
                    isCurrent
                      ? " logistics-page__timeline-step--current"
                      : ""
                  }${
                    isDone
                      ? " logistics-page__timeline-step--done"
                      : ""
                  }`}
                  onClick={() => step.key !== "decorated" && handleStepClick(step.key)}
                  style={{ cursor: step.key === "decorated" ? "default" : "pointer" }}
                >
                  <div className="logistics-page__timeline-axis">
                    <div className="logistics-page__timeline-dot">
                      {isActive && <FaCheck />}
                    </div>
                    {!isLast && (
                      <div className="logistics-page__timeline-line" />
                    )}
                  </div>
                  <div className="logistics-page__timeline-content">
                    <div className="logistics-page__timeline-row">
                      <div className="logistics-page__timeline-step-title">
                        {step.title}
                      </div>
                      {isCurrent && (
                        <span className="logistics-page__timeline-badge">
                          {step.key === "completed" ? "Прибыл" : "В процессе"}
                        </span>
                      )}
                    </div>
                    <div className="logistics-page__timeline-step-subtitle">
                      {step.subtitle}
                    </div>
                    <div className="logistics-page__timeline-date">
                      <FaClock />
                      <span>{step.date}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="logistics-page__timeline-progress">
            <div className="logistics-page__timeline-progress-header">
              <span>Прогресс доставки</span>
              <span>{getProgressPercent(order.status)}%</span>
            </div>
            <div className="logistics-page__timeline-progress-bar">
              <div
                className="logistics-page__timeline-progress-bar-fill"
                style={{
                  width: `${getProgressPercent(order.status)}%`,
                }}
              />
            </div>
          </div>

          <div className="logistics-page__timeline-eta">
            <div className="logistics-page__timeline-eta-label">
              <FaClock />
              <span>Ожидаемое прибытие:</span>
            </div>
            <div className="logistics-page__timeline-eta-date">
              {order.arrivalDate || order.arrival_date || "—"}
            </div>
          </div>

          {order.description && (
            <div className="logistics-page__timeline-description">
              {order.description}
            </div>
          )}

          <div className="logistics-page__form-actions">
            <button
              type="button"
              className="logistics-page__btn logistics-page__btn--ghost"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsOrderViewModal;
