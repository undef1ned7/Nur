import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  Wallet,
  CheckCircle,
  XCircle,
  DollarSign,
  ShoppingCart,
  Lock,
} from "lucide-react";
import { fetchShiftsAsync } from "../../../store/creators/shiftThunk";
import "./Shifts.scss";
import DataContainer from "../../common/DataContainer/DataContainer";

const PAGE_SIZE = 50;

const Shifts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    shifts,
    loading,
    shiftsCount,
    shiftsNext,
    shiftsPrevious
  } = useSelector((state) => state.shifts);
  const [activeTab, setActiveTab] = useState("open"); // "open" или "closed"

  // Refs для отслеживания изменений данных
  const isInitialMountRef = useRef(true);
  const prevShiftsRef = useRef([]);

  // Получаем текущую страницу из URL
  const currentPage = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

  // Расчет общего количества страниц
  const totalPages = useMemo(
    () => (shiftsCount && PAGE_SIZE ? Math.ceil(shiftsCount / PAGE_SIZE) : 1),
    [shiftsCount]
  );

  const hasNextPage = !!shiftsNext;
  const hasPrevPage = !!shiftsPrevious;

  // Синхронизация URL с состоянием страницы
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    } else {
      params.delete("page");
    }
    const newSearchString = params.toString();
    const currentSearchString = searchParams.toString();
    if (newSearchString !== currentSearchString) {
      setSearchParams(params, { replace: true });
    }
  }, [currentPage, searchParams, setSearchParams]);

  // Обработчик смены страницы
  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    const params = new URLSearchParams(searchParams);
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    setSearchParams(params, { replace: true });
  };


  useEffect(() => {
    // Загружаем смены с фильтром по статусу в зависимости от активного таба
    const params = {
      ...(activeTab === "open" ? { status: "open" } : { status: "closed" }),
      page: currentPage,
    };
    dispatch(fetchShiftsAsync(params));
  }, [dispatch, activeTab, currentPage]);

  // Плавно прокручиваем страницу вверх при изменении данных смен
  useEffect(() => {
    if (loading) return;
    // Пропускаем первый рендер
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevShiftsRef.current = shifts || [];
      return;
    }

    // Проверяем, что смены изменились (новый запрос)
    const prevShifts = prevShiftsRef.current;
    const currentShifts = shifts || [];

    // Сравниваем первые смены - если они разные, значит новый запрос
    const isNewData =
      prevShifts.length > 0 &&
      currentShifts.length > 0 &&
      prevShifts[0]?.id !== currentShifts[0]?.id;

    if (isNewData) {
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Fallback на window, если root не найден
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    prevShiftsRef.current = currentShifts;
  }, [shifts, loading]);

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

  // Смены уже отфильтрованы на сервере, используем их напрямую
  const displayedShifts = shifts;

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
          className={`shifts-page__tab ${activeTab === "open" ? "shifts-page__tab--active" : ""
            }`}
          onClick={() => {
            setActiveTab("open");
            // Сбрасываем на первую страницу при переключении таба
            const params = new URLSearchParams(searchParams);
            params.delete("page");
            setSearchParams(params, { replace: true });
          }}
        >
          <CheckCircle size={18} />
          <span>Открытые</span>
          {activeTab === "open" && displayedShifts.length > 0 && (
            <span className="shifts-page__tab-badge">{displayedShifts.length}</span>
          )}
        </button>
        <button
          className={`shifts-page__tab ${activeTab === "closed" ? "shifts-page__tab--active" : ""
            }`}
          onClick={() => {
            setActiveTab("closed");
            // Сбрасываем на первую страницу при переключении таба
            const params = new URLSearchParams(searchParams);
            params.delete("page");
            setSearchParams(params, { replace: true });
          }}
        >
          <XCircle size={18} />
          <span>Закрытые</span>
          {activeTab === "closed" && displayedShifts.length > 0 && (
            <span className="shifts-page__tab-badge">
              {displayedShifts.length}
            </span>
          )}
        </button>
      </div>
      <DataContainer>
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
      </DataContainer>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="shifts-page__pagination">
          <button
            type="button"
            className="shifts-page__pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading || !hasPrevPage}
          >
            Назад
          </button>
          <span className="shifts-page__pagination-info">
            Страница {currentPage} из {totalPages}
            {shiftsCount ? ` (${shiftsCount} смен)` : ""}
          </span>
          <button
            type="button"
            className="shifts-page__pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={loading || !hasNextPage || (totalPages && currentPage >= totalPages)}
          >
            Вперед
          </button>
        </div>
      )}
    </div>
  );
};

export default Shifts;
