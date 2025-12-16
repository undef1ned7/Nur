import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  Wallet,
  CheckCircle,
  XCircle,
  User,
  DollarSign,
  ShoppingCart,
  Lock,
} from "lucide-react";
import { fetchShiftsAsync } from "../../../store/creators/shiftThunk";
import "./Shifts.scss";

const Shifts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { shifts, loading } = useSelector((state) => state.shifts);
  const [activeTab, setActiveTab] = useState("open"); // "open" или "closed"

  useEffect(() => {
    dispatch(fetchShiftsAsync());
  }, [dispatch]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const handleShiftClick = (shiftId) => {
    navigate(`/crm/shifts/${shiftId}`);
  };

  // Разделяем смены на открытые и закрытые
  const { openShifts, closedShifts } = useMemo(() => {
    const open = shifts.filter((shift) => shift.status === "open");
    const closed = shifts.filter((shift) => shift.status === "closed");
    return { openShifts: open, closedShifts: closed };
  }, [shifts]);

  // Получаем смены для активного таба
  const displayedShifts = activeTab === "open" ? openShifts : closedShifts;

  if (loading) {
    return (
      <div className="shifts-page">
        <div className="shifts-page__loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="shifts-page">
      <div className="shifts-page__header">
        <h1 className="shifts-page__title">Смены</h1>
      </div>

      {/* Табы */}
      <div className="shifts-page__tabs">
        <button
          className={`shifts-page__tab ${
            activeTab === "open" ? "shifts-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("open")}
        >
          <CheckCircle size={18} />
          <span>Открытые</span>
          {openShifts.length > 0 && (
            <span className="shifts-page__tab-badge">{openShifts.length}</span>
          )}
        </button>
        <button
          className={`shifts-page__tab ${
            activeTab === "closed" ? "shifts-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab("closed")}
        >
          <XCircle size={18} />
          <span>Закрытые</span>
          {closedShifts.length > 0 && (
            <span className="shifts-page__tab-badge">
              {closedShifts.length}
            </span>
          )}
        </button>
      </div>

      <div className="shifts-page__list">
        {displayedShifts.length === 0 ? (
          <div className="shifts-page__empty">
            {activeTab === "open"
              ? "Открытые смены не найдены"
              : "Закрытые смены не найдены"}
          </div>
        ) : (
          <ul className="shifts-page__shift-list">
            {displayedShifts.map((shift) => {
              const shiftNumber =
                shift?.code ||
                (() => {
                  const idStr = shift.id?.toString() || "";
                  const digitsOnly = idStr.replace(/\D/g, "");
                  return digitsOnly.length >= 4
                    ? digitsOnly.slice(-8)
                    : idStr.replace(/-/g, "").slice(-8).toUpperCase();
                })() ||
                "—";

              return (
                <li
                  key={shift.id}
                  className="shifts-page__shift-card"
                  onClick={() => handleShiftClick(shift.id)}
                >
                  {/* Верхняя часть: информация о смене */}
                  <div className="shifts-page__shift-header">
                    <div className="shifts-page__shift-header-left">
                      <div className="shifts-page__shift-icon">
                        <Wallet size={24} style={{ color: "#fff" }} />
                      </div>
                      <div className="shifts-page__shift-header-info">
                        <h3 className="shifts-page__shift-title">
                          Смена #{shiftNumber}
                        </h3>
                        <div className="shifts-page__shift-date">
                          <Calendar size={14} />
                          <span>Открыта {formatDate(shift.opened_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`shifts-page__shift-status shifts-page__shift-status--${shift.status}`}
                    >
                      {shift.status === "open" ? (
                        <>
                          <Lock size={14} />
                          <span>Открыта</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          <span>Закрыта</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Карточки с метриками */}
                  <div className="shifts-page__shift-metrics">
                    {/* Выручка */}
                    {shift.sales_total !== null &&
                      shift.sales_total !== undefined && (
                        <div className="shifts-page__shift-metric-card shifts-page__shift-metric-card--revenue">
                          <DollarSign size={20} />
                          <div className="shifts-page__shift-metric-content">
                            <div className="shifts-page__shift-metric-label">
                              Выручка
                            </div>
                            <div className="shifts-page__shift-metric-value">
                              {parseFloat(shift.sales_total || 0).toFixed(2)}{" "}
                              сом
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Продажи */}
                    {shift.sales_count !== null &&
                      shift.sales_count !== undefined && (
                        <div className="shifts-page__shift-metric-card shifts-page__shift-metric-card--sales">
                          <ShoppingCart size={20} />
                          <div className="shifts-page__shift-metric-content">
                            <div className="shifts-page__shift-metric-label">
                              Продажи
                            </div>
                            <div className="shifts-page__shift-metric-value">
                              {shift.sales_count || 0}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Касса */}
                    {shift.cashbox_name && (
                      <div className="shifts-page__shift-metric-card shifts-page__shift-metric-card--cashbox">
                        <Wallet size={20} />
                        <div className="shifts-page__shift-metric-content">
                          <div className="shifts-page__shift-metric-label">
                            Касса
                          </div>
                          <div className="shifts-page__shift-metric-value">
                            {shift.cashbox_name}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Информация о кассире */}
                  <div className="shifts-page__shift-footer">
                    <span className="shifts-page__shift-footer-label">
                      Кассир:
                    </span>
                    <span className="shifts-page__shift-footer-value">
                      {shift.cashier_display || shift.cashier || "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Shifts;
