import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  Wallet,
  Store,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  XCircle,
  User,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { fetchShiftsAsync } from "../../../store/creators/shiftThunk";
import "./Shifts.scss";

const Shifts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { shifts, loading } = useSelector((state) => state.shifts);

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

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return "—";
    return `${parseFloat(value || 0).toFixed(2)} сом`;
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return "—";
    return value.toLocaleString("ru-RU");
  };

  const handleShiftClick = (shiftId) => {
    navigate(`/crm/shifts/${shiftId}`);
  };

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

      <div className="shifts-page__list">
        {shifts.length === 0 ? (
          <div className="shifts-page__empty">Смены не найдены</div>
        ) : (
          shifts.map((shift) => (
            <div
              key={shift.id}
              className="shifts-page__shift-card"
              onClick={() => handleShiftClick(shift.id)}
            >
              <div className="shifts-page__shift-header">
                <div className="shifts-page__shift-title">
                  <Wallet size={24} style={{ color: "#f7d617" }} />
                  <span>Смена #{shift.id?.slice(0, 8) || "—"}</span>
                </div>
                <div
                  className={`shifts-page__shift-status shifts-page__shift-status--${shift.status}`}
                >
                  {shift.status === "open" ? (
                    <>
                      <CheckCircle size={16} />
                      <span>Открыта</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      <span>Закрыта</span>
                    </>
                  )}
                </div>
              </div>

              <div className="shifts-page__shift-info">
                <div className="shifts-page__shift-info-item">
                  <Calendar size={16} />
                  <span>Открыта {formatDate(shift.opened_at)}</span>
                </div>
                {shift.closed_at && (
                  <div className="shifts-page__shift-info-item">
                    <Calendar size={16} />
                    <span>Закрыта {formatDate(shift.closed_at)}</span>
                  </div>
                )}
                <div className="shifts-page__shift-info-item">
                  <User size={16} />
                  <span>
                    Кассир: {shift.cashier_display || shift.cashier || "—"}
                    {shift.cashier && (
                      <span className="shifts-page__shift-cashier-id">
                        {" "}
                        (ID: {shift.cashier})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Основные метрики продаж */}
              <div className="shifts-page__shift-section">
                <h3 className="shifts-page__shift-section-title">Продажи</h3>
                <div className="shifts-page__shift-metrics">
                  <div className="shifts-page__shift-metric">
                    <DollarSign size={20} style={{ color: "#10b981" }} />
                    <div>
                      <div className="shifts-page__shift-metric-label">
                        Общая выручка
                      </div>
                      <div className="shifts-page__shift-metric-value">
                        {formatCurrency(shift.sales_total)}
                      </div>
                    </div>
                  </div>
                  <div className="shifts-page__shift-metric">
                    <ShoppingCart size={20} style={{ color: "#f7d617" }} />
                    <div>
                      <div className="shifts-page__shift-metric-label">
                        Количество продаж
                      </div>
                      <div className="shifts-page__shift-metric-value">
                        {formatNumber(shift.sales_count)}
                      </div>
                    </div>
                  </div>
                  <div className="shifts-page__shift-metric">
                    <Banknote size={20} style={{ color: "#10b981" }} />
                    <div>
                      <div className="shifts-page__shift-metric-label">
                        Наличными
                      </div>
                      <div className="shifts-page__shift-metric-value">
                        {formatCurrency(shift.cash_sales_total)}
                      </div>
                    </div>
                  </div>
                  <div className="shifts-page__shift-metric">
                    <CreditCard size={20} style={{ color: "#3b82f6" }} />
                    <div>
                      <div className="shifts-page__shift-metric-label">
                        Безнал
                      </div>
                      <div className="shifts-page__shift-metric-value">
                        {formatCurrency(shift.noncash_sales_total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Наличные в кассе */}
              <div className="shifts-page__shift-section">
                <h3 className="shifts-page__shift-section-title">Наличные в кассе</h3>
                <div className="shifts-page__shift-cash-grid">
                  <div className="shifts-page__shift-cash-item">
                    <div className="shifts-page__shift-cash-label">
                      Начальная сумма
                    </div>
                    <div className="shifts-page__shift-cash-value">
                      {formatCurrency(shift.opening_cash)}
                    </div>
                  </div>
                  {shift.closed_at && (
                    <div className="shifts-page__shift-cash-item">
                      <div className="shifts-page__shift-cash-label">
                        Фактическая сумма
                      </div>
                      <div className="shifts-page__shift-cash-value">
                        {formatCurrency(shift.closing_cash)}
                      </div>
                    </div>
                  )}
                  <div className="shifts-page__shift-cash-item">
                    <div className="shifts-page__shift-cash-label">
                      Ожидаемая сумма
                    </div>
                    <div className="shifts-page__shift-cash-value">
                      {formatCurrency(shift.expected_cash)}
                    </div>
                  </div>
                  {shift.closed_at && shift.cash_diff !== null && (
                    <div
                      className={`shifts-page__shift-cash-item shifts-page__shift-cash-item--${
                        parseFloat(shift.cash_diff || 0) === 0
                          ? "zero"
                          : parseFloat(shift.cash_diff || 0) > 0
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      <div className="shifts-page__shift-cash-label">
                        Расхождение
                      </div>
                      <div className="shifts-page__shift-cash-value">
                        {parseFloat(shift.cash_diff || 0) === 0 ? (
                          <span style={{ color: "#10b981" }}>✓ {formatCurrency(Math.abs(shift.cash_diff))}</span>
                        ) : parseFloat(shift.cash_diff || 0) > 0 ? (
                          <span style={{ color: "#10b981" }}>
                            +{formatCurrency(shift.cash_diff)}
                          </span>
                        ) : (
                          <span style={{ color: "#ef4444" }}>
                            {formatCurrency(shift.cash_diff)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Приходы и расходы */}
              <div className="shifts-page__shift-section">
                <h3 className="shifts-page__shift-section-title">
                  Приходы и расходы
                </h3>
                <div className="shifts-page__shift-metrics">
                  <div className="shifts-page__shift-metric">
                    <TrendingUp size={20} style={{ color: "#10b981" }} />
                    <div>
                      <div className="shifts-page__shift-metric-label">
                        Прочие приходы
                      </div>
                      <div className="shifts-page__shift-metric-value">
                        {formatCurrency(shift.income_total)}
                      </div>
                    </div>
                  </div>
                  <div className="shifts-page__shift-metric">
                    <TrendingDown size={20} style={{ color: "#ef4444" }} />
                    <div>
                      <div className="shifts-page__shift-metric-label">
                        Расходы
                      </div>
                      <div className="shifts-page__shift-metric-value">
                        {formatCurrency(shift.expense_total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="shifts-page__shift-footer">
                <div className="shifts-page__shift-footer-grid">
                  <div className="shifts-page__shift-footer-item">
                    <Wallet size={16} />
                    <span>{shift.cashbox_name || "—"}</span>
                  </div>
                  <div className="shifts-page__shift-footer-item">
                    <Store size={16} />
                    <span>{shift.branch || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Shifts;
