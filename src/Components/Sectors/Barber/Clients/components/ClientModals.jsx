// ClientModals.jsx
import React, { useState, useMemo, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import BarberSelect from "../../common/BarberSelect";

const ClientModals = ({
  modalOpen,
  confirmOpen,
  historyOpen,
  currentClient,
  historyClient,
  historyList,
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
  servicesById,
  employees = [],
}) => {
  const [historySearch, setHistorySearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(currentClient?.status || "Активен");

  // Обновляем статус при смене клиента
  useEffect(() => {
    setSelectedStatus(currentClient?.status || "Активен");
  }, [currentClient]);

  // Опции статуса для BarberSelect
  const statusSelectOptions = useMemo(() => {
    return statusOptions.map((s) => ({ value: s, label: s }));
  }, [statusOptions]);

  // Создаём Map сотрудников для быстрого поиска
  const employeesById = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => {
      const name = [e.last_name, e.first_name].filter(Boolean).join(" ").trim() || e.email || "—";
      map.set(e.id, { ...e, displayName: name });
    });
    return map;
  }, [employees]);

  const getEmployeeName = (barberId) => {
    if (!barberId) return "—";
    const emp = employeesById.get(barberId);
    return emp?.displayName || `ID ${barberId}`;
  };

  const filteredHistory = historyList.filter((a) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    const date = a.start_at || "";
    const svcNames = (a.services || [])
      .map((sid) => servicesById.get(sid)?.name || "")
      .join(" ")
      .toLowerCase();
    const masterName = getEmployeeName(a.barber || a.employee || a.master).toLowerCase();
    return date.includes(q) || svcNames.includes(q) || masterName.includes(q);
  });

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

  return (
    <>
      {/* Модалка редактирования клиента */}
      {modalOpen && (
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
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>

              {filteredHistory.length === 0 ? (
                <div className="barberclient__loading">
                  {historyList.length === 0 ? "Записей нет" : "Ничего не найдено"}
                </div>
              ) : (
                <div className="barberclient__historyList">
                  {filteredHistory.map((a, idx) => {
                    // Получаем услуги - могут быть ID или объекты
                    const rawServices = a.services || [];
                    const svcs = rawServices.map((s) => {
                      if (typeof s === "object" && s !== null) {
                        return { 
                          id: s.id, 
                          name: s.service_name || s.name || "Услуга",
                          price: s.price || s.amount || 0 
                        };
                      }
                      const found = servicesById.get(s);
                      return found ? { id: found.id, name: found.name, price: found.price } : null;
                    }).filter(Boolean);

                    // Цена из записи или сумма услуг
                    const basePrice = a.service_price ?? a.base_price ?? a.original_price ?? a.price ?? 
                      svcs.reduce((s, sv) => s + (sv.price || 0), 0);
                    const discountPct = a.discount ?? a.discount_percent ?? 0;
                    const total = a.total_price ?? a.final_price ?? 
                      (discountPct > 0 ? Math.round(basePrice * (1 - discountPct / 100)) : basePrice);
                    
                    const masterName = getEmployeeName(a.barber || a.employee || a.master);
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

                          {svcs.length > 0 && (
                            <div className="barberclient__historyServicesRow">
                              <span className="barberclient__historyLabel">Услуги</span>
                              <div className="barberclient__historyServices">
                                {svcs.map((sv, i) => (
                                  <span key={sv.id || i} className="barberclient__historyServiceTag">
                                    {sv.name}
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientModals;
