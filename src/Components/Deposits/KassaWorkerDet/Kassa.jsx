import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  Plus,
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronDown,
  MoreVertical,
} from "lucide-react";
import "./Vitrina.scss";
import { useUser } from "../../../store/slices/userSlice";

const KassaDet = () => {
  const { id } = useParams();
  const cashboxId = id;
  const { company } = useUser();

  const [cashboxDetails, setCashboxDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // НОВОЕ СОСТОЯНИЕ ДЛЯ ФИЛЬТРАЦИИ ПОТОКОВ
  const [activeFlowType, setActiveFlowType] = useState("all"); // 'all', 'income', 'expense'

  const [showFilter, setShowFilter] = useState(false);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [selectedCashbox, setSelectedCashbox] = useState(null);
  const [showEditCashboxModal, setShowEditCashboxModal] = useState(false);
  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    type: "expense", // Дефолтный тип для новой операции
  });

  const fetchCashboxDetails = async (idToFetch) => {
    if (!idToFetch) {
      setError("ID кассы не указан в URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        company?.subscription_plan?.name === "Старт"
          ? `https://app.nurcrm.kg/api/construction/cashboxes/${idToFetch}/`
          : `https://app.nurcrm.kg/api/construction/cashboxes/${idToFetch}/detail/owner/`,
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
        }
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Касса с указанным ID не найдена.");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // console.log("Fetched cashbox details:", data);
      setCashboxDetails(data);
      setSelectedCashbox(data);
    } catch (err) {
      console.error(
        `Failed to fetch cashbox details for ID ${idToFetch}:`,
        err
      );
      setError(
        `Не удалось загрузить данные кассы: ${err.message}. Пожалуйста, попробуйте еще раз.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cashboxId) {
      fetchCashboxDetails(cashboxId);
    } else {
      setError("ID кассы не указан в URL.");
      setLoading(false);
    }
  }, [cashboxId]);

  const handleAddCashbox = async () => {
    try {
      const response = await fetch(
        "https://app.nurcrm.kg/api/construction/cashflows/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
          body: JSON.stringify({
            name: newCashbox.name,
            amount: newCashbox.amount,
            cashbox: cashboxId, // Важно: привязываем новую операцию к текущей кассе
            type: newCashbox.type,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error adding cashflow:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      // После добавления операции, повторно получаем детали кассы, чтобы обновить список потоков
      fetchCashboxDetails(cashboxId);
      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  const handleEditCashbox = async () => {
    if (!selectedCashbox || !cashboxId) return;

    try {
      const response = await fetch(
        `https://app.nurcrm.kg/api/construction/cashboxes/${cashboxId}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
          body: JSON.stringify({
            title: selectedCashbox.title,
            department: selectedCashbox.department,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating cashbox:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      const updatedCashbox = await response.json();
      setCashboxDetails(updatedCashbox);
      setShowEditCashboxModal(false);
      setSelectedCashbox(updatedCashbox);
      fetchCashboxDetails(cashboxId);
    } catch (err) {
      console.error("Failed to edit cashbox:", err);
      setError(
        "Не удалось обновить кассу. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  const handleDeleteCashbox = async () => {
    if (!cashboxId) return;

    try {
      const response = await fetch(
        `https://app.nurcrm.kg/api/construction/cashflows/${cashboxId}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("accessToken"),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error deleting cashbox:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      setCashboxDetails(null);
      setError("Касса успешно удалена.");
      // Возможно, здесь вы захотите перенаправить пользователя на страницу списка касс
      // history.push('/cashboxes');
    } catch (err) {
      console.error("Failed to delete cashbox:", err);
      setError("Не удалось удалить кассу. Пожалуйста, попробуйте еще раз.");
    }
  };

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const filteredCashflows = cashboxDetails
    ? cashboxDetails.cashflows.filter((flow) => {
        if (activeFlowType === "all") {
          return true; // Показать все потоки
        }
        return flow.type === activeFlowType; // Фильтровать по выбранному типу ('income' или 'expense')
      })
    : [];

  if (loading) {
    return <div className="vitrina">Загрузка данных...</div>;
  }

  if (error) {
    return <div className="vitrina vitrina--error">{error}</div>;
  }

  if (!cashboxDetails) {
    return <div className="vitrina">Данные о кассе не доступны.</div>;
  }

  return (
    <div className="vitrina">
      <div className="vitrina__header">
        <div className="vitrina__tabs">
          <span
            className={`vitrina__tab ${
              activeFlowType === "expense" ? "vitrina__tab--active" : ""
            }`}
            onClick={() => setActiveFlowType("expense")}
          >
            Расход
          </span>
          <span
            className={`vitrina__tab ${
              activeFlowType === "income" ? "vitrina__tab--active" : ""
            }`}
            onClick={() => setActiveFlowType("income")}
          >
            Приход
          </span>
          <span
            className={`vitrina__tab ${
              activeFlowType === "all" ? "vitrina__tab--active" : ""
            }`}
            onClick={() => setActiveFlowType("all")}
          >
            Все
          </span>
        </div>
        <br />
        <button
          className=" sklad__add vitrina__add-expense-button vitrina__button vitrina__button--delete "
          onClick={() => setShowAddCashboxModal(true)}
        >
          Добавить операцию
        </button>
      </div>

      <div className="vitrina__toolbar">
        <div className="vitrina__toolbar-div">
          <div className="vitrina__search-wrapper">
            <Search className="vitrina__search-icon" size={16} />
            <input
              className="vitrina__search"
              type="text"
              placeholder="Поиск потоков"
              // Здесь может быть реализован поиск по наименованию потока
              // value={cashflowSearchTerm}
              // onChange={(e) => setCashflowSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="vitrina__filter-button"
            onClick={() => setShowFilter(true)}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="cashbox-detail-view">
        {/* <h2>Детали кассы: {cashboxDetails.title}</h2>
                <p><strong>ID:</strong> {cashboxDetails.id}</p>
                <p><strong>Отдел:</strong> {cashboxDetails.department_name}</p>

                <h3>Движения денежных средств:</h3> */}
        {filteredCashflows && filteredCashflows.length > 0 ? (
          <div className="table-wrapper">
            <table className="vitrina__table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Наименование</th>
                  <th>Сумма</th>
                  <th>Дата создания</th>
                </tr>
              </thead>
              <tbody>
                {filteredCashflows.map((flow) => (
                  <tr key={flow.id}>
                    <td>{flow.type === "income" ? "Приход" : "Расход"}</td>
                    <td>{flow.name}</td>
                    <td>{flow.amount}</td>
                    <td>{new Date(flow.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Нет движений денежных средств для этой кассы
            {activeFlowType === "income"
              ? " (Приходы)."
              : activeFlowType === "expense"
              ? " (Расходы)."
              : "."}
          </p>
        )}

        <div className="vitrina__actions-bottom">
          {/* <button className="vitrina__button vitrina__button--edit" onClick={() => setShowEditCashboxModal(true)}>
                        Редактировать кассу
                    </button> */}
          <br />
          {/* <button className="vitrina__button vitrina__button--delete vitrina__button--reset" onClick={handleDeleteCashbox}>
                        Удалить кассу
                    </button> */}
        </div>
      </div>

      <div className="vitrina__pagination">
        <span className="vitrina__pagination-info">1 из 1</span>
      </div>

      {showFilter && (
        <>
          <div
            className="vitrina__overlay"
            onClick={() => setShowFilter(false)}
          />
          <div className="vitrina__filter-modal">
            <div className="vitrina__filter-content">
              <div className="vitrina__filter-header">
                <h3>Фильтры потоков</h3>
                <X
                  className="vitrina__close-icon"
                  size={20}
                  onClick={() => setShowFilter(false)}
                />
              </div>
              <div className="vitrina__filter-section">
                <div className="vitrina__search-wrapper">
                  <Search size={16} className="vitrina__search-icon" />
                  <input
                    type="text"
                    placeholder="Поиск потоков"
                    className="vitrina__search"
                  />
                </div>
              </div>
              <div className="vitrina__filter-section">
                <label>Тип потока</label>
                <div className="vitrina__dropdown">
                  <span>Все</span>
                  <ChevronDown size={16} />
                </div>
              </div>
              <div className="vitrina__filter-footer">
                <button className="vitrina__reset vitrina__reset--full">
                  Сбросить фильтры
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddCashboxModal && (
        <div className="vitrina__overlay">
          <div className="vitrina__modal vitrina__modal--add">
            <div className="vitrina__modal-header">
              <h3>Добавление операции по кассе</h3>
              <X
                className="vitrina__close-icon"
                size={20}
                onClick={() => setShowAddCashboxModal(false)}
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Наименование</label>
              <input
                type="text"
                placeholder="Например, Закупка материалов"
                className="vitrina__modal-input"
                value={newCashbox.name}
                onChange={(e) =>
                  setNewCashbox({ ...newCashbox, name: e.target.value })
                }
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Сумма</label>
              <input
                type="number"
                placeholder="Например, 10000"
                className="vitrina__modal-input"
                value={newCashbox.amount}
                onChange={(e) =>
                  setNewCashbox({
                    ...newCashbox,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Тип операции</label>
              <select
                className="vitrina__modal-input"
                value={newCashbox.type} // Теперь используем newCashbox.type
                onChange={(e) =>
                  setNewCashbox({ ...newCashbox, type: e.target.value })
                }
              >
                <option value="expense">Расход</option>
                <option value="income">Приход</option>
              </select>
            </div>
            <div className="vitrina__modal-footer">
              <button
                className="vitrina__button vitrina__button--cancel"
                onClick={() => setShowAddCashboxModal(false)}
              >
                Отмена
              </button>
              <button
                className="vitrina__button vitrina__button--save"
                onClick={handleAddCashbox}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditCashboxModal && selectedCashbox && (
        <div className="vitrina__overlay">
          <div className="vitrina__modal vitrina__modal--edit">
            <div className="vitrina__modal-header">
              <h3>Редактирование кассы</h3>
              <X
                className="vitrina__close-icon"
                size={20}
                onClick={() => setShowEditCashboxModal(false)}
              />
            </div>
            <div className="vitrina__modal-section">
              <label>ID</label>
              <input
                type="text"
                value={selectedCashbox.id || ""}
                readOnly
                className="vitrina__modal-input"
              />
            </div>
            <div className="vitrina__modal-section">
              <label>Название</label>
              <input
                type="text"
                value={selectedCashbox.title || ""}
                onChange={(e) =>
                  setSelectedCashbox({
                    ...selectedCashbox,
                    title: e.target.value,
                  })
                }
                className="vitrina__modal-input"
              />
            </div>
            <div className="vitrina__modal-footer">
              {/* <button className="vitrina__button vitrina__button--reset" onClick={handleDeleteCashbox}>Удалить кассу</button> */}
              <button
                className="vitrina__button vitrina__button--save"
                onClick={handleEditCashbox}
              >
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KassaDet;
