// ClientModals.jsx
import React, { useMemo, useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import BarberSelect from "../../common/BarberSelect";
import Loading from "../../../../common/Loading/Loading";
import Pager from "./Pager";

const ClientModals = ({
  modalOpen,
  confirmOpen,
  historyOpen,
  currentClient,
  historyClient,
  historyList,
  historyCount,
  historyNext,
  historyPrevious,
  historyPage,
  historyLoading,
  historyError,
  historySearch,
  onHistorySearchChange,
  onHistoryPageChange,
  clientAlerts,
  formErrors,
  saving,
  deleting,
  statusOptions,
  onCloseModal,
  onSubmit,
  onOpenConfirm,
  onCloseConfirm,
  onConfirmDelete,
  onCloseHistory,
  fmtMoney,
}) => {
  const [selectedStatus, setSelectedStatus] = useState(currentClient?.status || "Активен");

  // Обновляем статус при смене клиента
  useEffect(() => {
    setSelectedStatus(currentClient?.status || "Активен");
  }, [currentClient]);

  // Опции статуса для BarberSelect
  const statusSelectOptions = useMemo(() => {
    return statusOptions.map((s) => ({ value: s, label: s }));
  }, [statusOptions]);

  // Вычисляем totalPages для истории
  const historyTotalPages = useMemo(() => {
    if (historyCount === 0) return 1;
    const pageSize = historyList.length || 1;
    if (pageSize === 0) return 1;
    if (historyNext) {
      return Math.ceil(historyCount / pageSize);
    }
    return historyPage;
  }, [historyCount, historyList.length, historyNext, historyPage]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatus = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed" || s === "done") return "Завершён";
    if (s === "cancelled" || s === "canceled") return "Отменён";
    if (s === "pending") return "Ожидание";
    if (s === "confirmed") return "Подтверждён";
    return status || "—";
  };

  const num = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const getMasterName = (a) => {
    const direct = a?.barber_name || a?.barber_public?.full_name;
    if (direct) return direct;
    const pub = a?.barber_public;
    if (pub) {
      const fallback = [pub.last_name, pub.first_name].filter(Boolean).join(" ").trim();
      if (fallback) return fallback;
    }
    return "—";
  };

  const getServiceNames = (a) => {
    if (Array.isArray(a?.services_names) && a.services_names.length) {
      return a.services_names.filter(Boolean);
    }
    if (Array.isArray(a?.services_public) && a.services_public.length) {
      return a.services_public.map((s) => s?.name).filter(Boolean);
    }
    if (a?.service_name) {
      return [a.service_name];
    }
    return [];
  };

  return (
    <>
      {/* Модалка редактирования клиента */}
      {modalOpen && !confirmOpen && (
        <div className="barberclient__modalOverlay" onClick={onCloseModal}>
          <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barberclient__modalHeader">
              <h3 className="barberclient__modalTitle">
                {currentClient?.id ? "Редактирование клиента" : "Новый клиент"}
              </h3>
              <button
                type="button"
                className="barberclient__iconBtn"
                onClick={onCloseModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="barberclient__form" onSubmit={onSubmit}>
              <div className="barberclient__formGrid">
                {Array.isArray(clientAlerts) && clientAlerts.length > 0 && (
                  <div className="barberclient__field barberclient__field--full">
                    <div className="barberclient__alert">
                      {clientAlerts.map((a, i) => (
                        <div key={i}>{a}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`barberclient__field ${
                    formErrors?.fullName ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label className="barberclient__label" htmlFor="fullName">
                    ФИО <span className="barberclient__req">*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    className={`barberclient__input ${
                      formErrors?.fullName ? "barberclient__input--invalid" : ""
                    }`}
                    defaultValue={currentClient?.fullName || ""}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div
                  className={`barberclient__field ${
                    formErrors?.phone ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label className="barberclient__label" htmlFor="phone">
                    Телефон <span className="barberclient__req">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className={`barberclient__input ${
                      formErrors?.phone ? "barberclient__input--invalid" : ""
                    }`}
                    defaultValue={currentClient?.phone || ""}
                    placeholder="+996 XXX XXX XXX"
                  />
                </div>

                <div
                  className={`barberclient__field ${
                    formErrors?.birthDate ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label className="barberclient__label" htmlFor="birthDate">
                    Дата рождения
                  </label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    className={`barberclient__input ${
                      formErrors?.birthDate ? "barberclient__input--invalid" : ""
                    }`}
                    defaultValue={currentClient?.birthDate || ""}
                  />
                </div>

                <div
                  className={`barberclient__field ${
                    formErrors?.status ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label className="barberclient__label">
                    Статус <span className="barberclient__req">*</span>
                  </label>
                  <input type="hidden" name="status" value={selectedStatus} />
                  <BarberSelect
                    value={selectedStatus}
                    onChange={setSelectedStatus}
                    options={statusSelectOptions}
                    placeholder="Выберите статус"
                    hideClear
                  />
                </div>

                <div className="barberclient__field barberclient__field--full">
                  <label className="barberclient__label" htmlFor="notes">
                    Заметки
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    className="barberclient__textarea"
                    defaultValue={currentClient?.notes || ""}
                    placeholder="Дополнительная информация о клиенте..."
                  />
                </div>
              </div>

              <div className="barberclient__formActions">
                {currentClient?.id && (
                  <button
                    type="button"
                    className="barberclient__btn barberclient__btn--danger"
                    onClick={onOpenConfirm}
                    disabled={saving || deleting}
                  >
                    Удалить
                  </button>
                )}
                <div className="barberclient__actionsSpacer" />
                <div className="barberclient__actionsRight">
                  <button
                    type="button"
                    className="barberclient__btn barberclient__btn--secondary"
                    onClick={onCloseModal}
                    disabled={saving || deleting}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barberclient__btn barberclient__btn--primary"
                    disabled={saving || deleting}
                  >
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Подтверждение удаления */}
      {confirmOpen && (
        <div className="barberclient__confirmOverlay" onClick={onCloseConfirm}>
          <div className="barberclient__confirm" onClick={(e) => e.stopPropagation()}>
            <h4 className="barberclient__confirm-title">Удалить клиента?</h4>
            <p className="barberclient__confirm-text">
              Вы уверены, что хотите удалить клиента{" "}
              <strong>{currentClient?.fullName}</strong>? Это действие нельзя отменить.
            </p>
            <div className="barberclient__confirm-actions">
              <button
                type="button"
                className="barberclient__btn barberclient__btn--secondary"
                onClick={onCloseConfirm}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                className="barberclient__btn barberclient__btn--danger"
                onClick={onConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* История записей клиента */}
      {historyOpen && historyClient && (
        <div className="barberclient__modalOverlay" onClick={onCloseHistory}>
          <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barberclient__modalHeader">
              <h3 className="barberclient__modalTitle">
                История: {historyClient.fullName}
              </h3>
              <button
                type="button"
                className="barberclient__iconBtn"
                onClick={onCloseHistory}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberclient__history">
              <div className="barberclient__historySearch">
                <input
                  type="text"
                  className="barberclient__historySearch-input"
                  placeholder="Поиск по истории..."
                  value={historySearch}
                  onChange={(e) => onHistorySearchChange(e.target.value)}
                />
              </div>

              {historyLoading ? (
                <Loading message="Загрузка истории..." />
              ) : historyError ? (
                <div className="barberclient__loading">{historyError}</div>
              ) : historyList.length === 0 ? (
                <div className="barberclient__loading">
                  {historySearch.trim() ? "Ничего не найдено" : "Записей нет"}
                </div>
              ) : (
                <>
                  <div className="barberclient__historyList">
                    {historyList.map((a, idx) => {
                    const serviceNames = getServiceNames(a);
                    const servicesPublic = Array.isArray(a?.services_public)
                      ? a.services_public
                      : [];
                    const servicesPriceSum = servicesPublic.reduce(
                      (sum, s) => sum + (num(s?.price) || 0),
                      0
                    );

                    const basePriceRaw = num(a?.price);
                    const discountPct = num(a?.discount) || 0;
                    const basePrice =
                      basePriceRaw !== null
                        ? basePriceRaw
                        : servicesPriceSum || null;
                    const total =
                      basePrice !== null && discountPct > 0
                        ? Math.round(basePrice * (1 - discountPct / 100))
                        : basePrice;

                    const masterName = getMasterName(a);
                    const status = getStatus(a.status);
                    const statusClass = String(a.status || "").toLowerCase();

                    return (
                      <div key={a.id || idx} className="barberclient__historyCard">
                        <div className="barberclient__historyCardHead">
                          <div className="barberclient__historyDate">
                            <span className="barberclient__historyDateDay">{fmtDate(a.start_at)}</span>
                            <span className="barberclient__historyDateTime">{fmtTime(a.start_at)}</span>
                          </div>
                          <span className={`barberclient__historyStatus barberclient__historyStatus--${statusClass}`}>
                            {status}
                          </span>
                        </div>

                        <div className="barberclient__historyCardBody">
                          <div className="barberclient__historyMasterRow">
                            <span className="barberclient__historyLabel">Мастер</span>
                            <span className="barberclient__historyMaster">{masterName}</span>
                          </div>

                          {serviceNames.length > 0 && (
                            <div className="barberclient__historyServicesRow">
                              <span className="barberclient__historyLabel">Услуги</span>
                              <div className="barberclient__historyServices">
                                {serviceNames.map((name, i) => (
                                  <span key={`${name}-${i}`} className="barberclient__historyServiceTag">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="barberclient__historyCardFoot">
                          <div className="barberclient__historyPriceItem">
                            <span className="barberclient__historyLabel">Цена</span>
                            <span className="barberclient__historyPrice">{fmtMoney(basePrice)}</span>
                          </div>
                          {discountPct > 0 && (
                            <div className="barberclient__historyPriceItem">
                              <span className="barberclient__historyLabel">Скидка</span>
                              <span className="barberclient__historyDiscount">{discountPct}%</span>
                            </div>
                          )}
                          <div className="barberclient__historyPriceItem barberclient__historyPriceItem--total">
                            <span className="barberclient__historyLabel">Итого</span>
                            <span className="barberclient__historyTotal">{fmtMoney(total)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  <Pager
                    count={historyCount}
                    page={historyPage}
                    totalPages={historyTotalPages}
                    next={historyNext}
                    previous={historyPrevious}
                    onChange={onHistoryPageChange}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientModals;
