import React, { useState, useEffect, useMemo } from "react";
import { X, Search, ChevronRight, Calendar } from "lucide-react";
import { useDispatch } from "react-redux";
import api from "../../../../../api";
import { payDebtDeal } from "../../../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../../store/slices/cashSlice";
import { useUser } from "../../../../../store/slices/userSlice";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import "./DebtPaymentModal.scss";

const DebtPaymentModal = ({ onClose, customers = [] }) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientDebts, setClientDebts] = useState(new Map()); // Map<clientId, totalDebt>
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDeals, setClientDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [selectedCashBox, setSelectedCashBox] = useState("");
  const [paymentAmounts, setPaymentAmounts] = useState({}); // { dealId-installmentNumber: amount }
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  const showAlert = (type, title, message) => {
    setAlertModal({ open: true, type, title, message });
  };

  const closeAlert = () => {
    setAlertModal((prev) => ({ ...prev, open: false }));
  };

  // Функция для загрузки всех страниц
  const fetchAllPages = async (url) => {
    const allItems = [];
    let nextUrl = url;
    let guard = 0;
    const maxPages = 100;

    while (nextUrl && guard < maxPages) {
      try {
        const { data } = await api.get(nextUrl);
        const results = Array.isArray(data?.results) ? data.results : [];
        allItems.push(...results);
        nextUrl = data?.next || null;
        guard += 1;
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
        break;
      }
    }

    return allItems;
  };

  // Загрузка должников
  useEffect(() => {
    const loadDebtors = async () => {
      try {
        setLoading(true);
        const allDebtors = await fetchAllPages("/main/clients/with-debts/");
        setDebtors(allDebtors);

        // Загружаем deals для каждого клиента, чтобы получить сумму долга
        // Используем Promise.allSettled для параллельной загрузки с обработкой ошибок
        const debtsMap = new Map();
        const debtPromises = allDebtors.map(async (client) => {
          try {
            const deals = await fetchAllPages(
              `/main/clients/${client.id}/deals/?kind=debt`
            );
            // Суммируем remaining_debt из всех deals типа "debt"
            const totalDebt = deals.reduce((sum, deal) => {
              const remainingDebt = parseFloat(deal.remaining_debt || 0);
              return sum + remainingDebt;
            }, 0);
            if (totalDebt > 0) {
              debtsMap.set(client.id, totalDebt);
            }
            return { clientId: client.id, debt: totalDebt };
          } catch (error) {
            console.error(
              `Ошибка при загрузке deals для клиента ${client.id}:`,
              error
            );
            return { clientId: client.id, debt: 0 };
          }
        });

        await Promise.allSettled(debtPromises);
        setClientDebts(debtsMap);
      } catch (error) {
        console.error("Ошибка при загрузке должников:", error);
        showAlert("error", "Ошибка", "Не удалось загрузить список должников");
      } finally {
        setLoading(false);
      }
    };

    loadDebtors();
  }, []);

  // Фильтруем по поисковому запросу и показываем только тех, у кого есть долг
  const filteredDebtors = useMemo(() => {
    let filtered = debtors.filter((customer) => {
      const debt = clientDebts.get(customer.id) || 0;
      return debt > 0; // Показываем только клиентов с долгом > 0
    });

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((customer) => {
        const name = (customer.full_name || customer.name || "").toLowerCase();
        const phone = (customer.phone || "").toLowerCase();
        return name.includes(searchLower) || phone.includes(searchLower);
      });
    }

    return filtered;
  }, [debtors, searchTerm, clientDebts]);

  // Вычисляем общий долг
  const totalDebt = useMemo(() => {
    return filteredDebtors.reduce((sum, customer) => {
      const debt = clientDebts.get(customer.id) || 0;
      return sum + debt;
    }, 0);
  }, [filteredDebtors, clientDebts]);

  // Функция для получения инициалов
  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (
        words[0].charAt(0).toUpperCase() +
        words[words.length - 1].charAt(0).toUpperCase()
      );
    }
    return name.charAt(0).toUpperCase();
  };

  // Функция для получения цвета аватара
  const getAvatarColor = (name) => {
    const colors = [
      "#3b82f6", // blue
      "#8b5cf6", // purple
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#06b6d4", // cyan
      "#ec4899", // pink
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Загрузка касс
  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectedCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectedCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectedCashBox]);

  // Загрузка deals клиента
  const loadClientDeals = async (clientId) => {
    try {
      setLoadingDeals(true);
      // Используем query параметр kind=debt для фильтрации на сервере
      const deals = await fetchAllPages(
        `/main/clients/${clientId}/deals/?kind=debt`
      );
      // Фильтруем только deals с remaining_debt > 0
      const debtDeals = deals.filter(
        (deal) => parseFloat(deal.remaining_debt || 0) > 0
      );
      setClientDeals(debtDeals);
    } catch (error) {
      console.error("Ошибка при загрузке deals:", error);
      showAlert("error", "Ошибка", "Не удалось загрузить долги клиента");
    } finally {
      setLoadingDeals(false);
    }
  };

  const handleCustomerClick = async (customer) => {
    setSelectedClient(customer);
    setPaymentAmounts({});
    await loadClientDeals(customer.id);
  };

  const handleBackToList = () => {
    setSelectedClient(null);
    setClientDeals([]);
    setPaymentAmounts({});
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handlePayDebt = async (deal, installment) => {
    if (!selectedCashBox) {
      showAlert("warning", "Предупреждение", "Выберите кассу");
      return;
    }

    const paymentAmount = parseFloat(
      paymentAmounts[`${deal.id}-${installment.number}`] ||
        installment.remaining_for_period ||
        0
    );

    if (paymentAmount <= 0) {
      showAlert("warning", "Предупреждение", "Введите сумму для погашения");
      return;
    }

    const remaining = parseFloat(installment.remaining_for_period || 0);
    if (paymentAmount > remaining) {
      showAlert(
        "warning",
        "Предупреждение",
        `Сумма не может превышать ${remaining.toFixed(2)} сом`
      );
      return;
    }

    try {
      const paymentData = {
        idempotency_key: crypto.randomUUID(),
        installment_id: installment.id, // Используем ID взноса вместо номера
        amount: paymentAmount.toFixed(2),
        date: new Date().toISOString().split("T")[0],
        note: "",
      };

      // Погашаем долг
      const updatedDeal = await dispatch(
        payDebtDeal({
          id: deal.id,
          clientId: selectedClient.id,
          data: paymentData,
        })
      ).unwrap();

      // Обновляем локальное состояние сделки из ответа API
      setClientDeals((prev) =>
        prev.map((d) => (d.id === deal.id ? updatedDeal : d))
      );

      // Добавляем денежный поток
      try {
        await dispatch(
          addCashFlows({
            cashbox: selectedCashBox,
            type: "income",
            name: `Погашение долга: ${deal.title || "Долг"}`,
            amount: paymentAmount.toFixed(2),
            source_cashbox_flow_id: deal.id,
            source_business_operation_id: "Погашение долга",
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          })
        ).unwrap();
      } catch (cashError) {
        console.warn("Ошибка при создании денежного потока:", cashError);
        // Не блокируем успешное погашение, если ошибка с кассой
      }

      // Обновляем общий долг клиента из обновленной сделки
      const allDeals = clientDeals.map((d) =>
        d.id === deal.id ? updatedDeal : d
      );
      const updatedTotalDebt = allDeals.reduce((sum, d) => {
        const remainingDebt = parseFloat(d.remaining_debt || 0);
        return sum + remainingDebt;
      }, 0);

      setClientDebts((prev) => {
        const next = new Map(prev);
        if (updatedTotalDebt > 0) {
          next.set(selectedClient.id, updatedTotalDebt);
        } else {
          next.delete(selectedClient.id);
        }
        return next;
      });

      // Очищаем сумму платежа
      setPaymentAmounts((prev) => {
        const next = { ...prev };
        delete next[`${deal.id}-${installment.number}`];
        return next;
      });

      showAlert("success", "Успех", "Долг успешно погашен");
    } catch (error) {
      console.error("Ошибка при погашении долга:", error);
      showAlert(
        "error",
        "Ошибка",
        "Не удалось погасить долг: " + (error.message || "Неизвестная ошибка")
      );
    }
  };

  // Обработка нажатия ESC
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (selectedClient) {
          handleBackToList();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onClose, selectedClient]);

  // Если выбран клиент, показываем его deals
  if (selectedClient) {
    return (
      <div className="debt-payment-modal-overlay" onClick={onClose}>
        <div
          className="debt-payment-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="debt-payment-modal__header">
            <button
              className="debt-payment-modal__back"
              onClick={handleBackToList}
            >
              <ChevronRight size={20} style={{ transform: "rotate(180deg)" }} />
            </button>
            <h2 className="debt-payment-modal__title">
              Долги: {selectedClient.full_name || selectedClient.name}
            </h2>
            <button className="debt-payment-modal__close" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {cashBoxes && cashBoxes.length > 1 && (
            <div className="debt-payment-modal__cashbox-selector">
              <label className="debt-payment-modal__cashbox-label">
                Касса:
              </label>
              <select
                className="debt-payment-modal__cashbox-select"
                value={selectedCashBox}
                onChange={(e) => setSelectedCashBox(e.target.value)}
              >
                {cashBoxes.map((cashbox) => {
                  const cashboxId = cashbox.id || cashbox.uuid || "";
                  const cashboxName = cashbox.name || "Касса";
                  return (
                    <option key={cashboxId} value={cashboxId}>
                      {cashboxName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="debt-payment-modal__deals">
            {loadingDeals ? (
              <div className="debt-payment-modal__empty">Загрузка...</div>
            ) : clientDeals.length === 0 ? (
              <div className="debt-payment-modal__empty">
                Нет активных долгов
              </div>
            ) : (
              clientDeals.map((deal) => (
                <div key={deal.id} className="debt-payment-modal__deal">
                  <div className="debt-payment-modal__deal-header">
                    <div className="debt-payment-modal__deal-title">
                      {deal.title || "Долг"}
                    </div>
                    <div className="debt-payment-modal__deal-amount">
                      Остаток: {parseFloat(deal.remaining_debt || 0).toFixed(2)}{" "}
                      сом
                    </div>
                  </div>

                  {deal.installments && deal.installments.length > 0 && (
                    <div className="debt-payment-modal__installments">
                      {deal.installments.map((installment) => {
                        const isPaid = Boolean(installment.paid_on);
                        const remaining = parseFloat(
                          installment.remaining_for_period || 0
                        );

                        return (
                          <div
                            key={installment.number}
                            className={`debt-payment-modal__installment ${
                              isPaid
                                ? "debt-payment-modal__installment--paid"
                                : ""
                            }`}
                          >
                            <div className="debt-payment-modal__installment-info">
                              <div className="debt-payment-modal__installment-number">
                                Платеж #{installment.number}
                              </div>
                              <div className="debt-payment-modal__installment-date">
                                <Calendar size={14} />
                                {formatDate(installment.due_date)}
                              </div>
                              <div className="debt-payment-modal__installment-amount">
                                Сумма:{" "}
                                {parseFloat(installment.amount || 0).toFixed(2)}{" "}
                                сом
                              </div>
                              {isPaid ? (
                                <div className="debt-payment-modal__installment-paid">
                                  Оплачено: {formatDate(installment.paid_on)}
                                </div>
                              ) : (
                                <div className="debt-payment-modal__installment-remaining">
                                  Остаток: {remaining.toFixed(2)} сом
                                </div>
                              )}
                            </div>

                            {!isPaid && remaining > 0 && (
                              <div className="debt-payment-modal__installment-payment">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  max={remaining}
                                  placeholder="Сумма"
                                  value={
                                    paymentAmounts[
                                      `${deal.id}-${installment.number}`
                                    ] || ""
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPaymentAmounts((prev) => ({
                                      ...prev,
                                      [`${deal.id}-${installment.number}`]:
                                        value,
                                    }));
                                  }}
                                  className="debt-payment-modal__payment-input"
                                />
                                <button
                                  className="debt-payment-modal__pay-btn"
                                  onClick={() =>
                                    handlePayDebt(deal, installment)
                                  }
                                >
                                  Погасить
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="debt-payment-modal__footer">
            <button
              className="debt-payment-modal__close-btn"
              onClick={handleBackToList}
            >
              НАЗАД
            </button>
          </div>

          <AlertModal
            open={alertModal.open}
            type={alertModal.type}
            title={alertModal.title}
            message={alertModal.message}
            okText="ОК"
            onClose={closeAlert}
            onConfirm={closeAlert}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="debt-payment-modal-overlay" onClick={onClose}>
      <div className="debt-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="debt-payment-modal__header">
          <h2 className="debt-payment-modal__title">Список должников</h2>
          <button className="debt-payment-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="debt-payment-modal__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Введите текст для поиска"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="debt-payment-modal__search-input"
          />
        </div>

        <div className="debt-payment-modal__summary">
          <div className="debt-payment-modal__summary-item">
            Найдено {filteredDebtors.length}
          </div>
          <div className="debt-payment-modal__summary-item">
            Общий долг:{" "}
            {totalDebt.toLocaleString("ru-RU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            сом
          </div>
        </div>

        <div className="debt-payment-modal__list">
          {loading ? (
            <div className="debt-payment-modal__empty">Загрузка...</div>
          ) : filteredDebtors.length === 0 ? (
            <div className="debt-payment-modal__empty">
              {searchTerm ? "Должники не найдены" : "Нет должников"}
            </div>
          ) : (
            filteredDebtors.map((customer) => {
              const debt = clientDebts.get(customer.id) || 0;
              const initials = getInitials(customer.full_name || customer.name);
              const avatarColor = getAvatarColor(
                customer.full_name || customer.name
              );

              return (
                <div
                  key={customer.id}
                  className="debt-payment-modal__item"
                  onClick={() => handleCustomerClick(customer)}
                >
                  <div
                    className="debt-payment-modal__avatar"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="debt-payment-modal__item-content">
                    <div className="debt-payment-modal__item-name">
                      {customer.full_name || customer.name || "Без имени"}
                    </div>
                    {customer.phone && (
                      <div className="debt-payment-modal__item-phone">
                        {customer.phone}
                      </div>
                    )}
                  </div>
                  <div className="debt-payment-modal__item-debt">
                    {debt.toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    сом
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="debt-payment-modal__footer">
          <button className="debt-payment-modal__close-btn" onClick={onClose}>
            ЗАКРЫТЬ [ESC]
          </button>
        </div>

        <AlertModal
          open={alertModal.open}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          okText="ОК"
          onClose={closeAlert}
          onConfirm={closeAlert}
        />
      </div>
    </div>
  );
};

export default DebtPaymentModal;
