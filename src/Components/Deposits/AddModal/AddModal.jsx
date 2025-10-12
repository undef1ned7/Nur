import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { fetchEmployeesAsync } from "../../../store/creators/employeeCreators";
import { useSelector, useDispatch } from "react-redux";
const days = [
  { label: "Понедельник", shortLabel: "Пон", date: "13" },
  { label: "Вторник", shortLabel: "Втор", date: "14" },
  { label: "Среда", shortLabel: "Среда", date: "15" },
  { label: "Четверг", shortLabel: "Четв", date: "16" },
  { label: "Пятница", shortLabel: "Пят", date: "17" },
  { label: "Суббота", shortLabel: "Суб", date: "18" },
  { label: "Воскресенье", shortLabel: "Воск", date: "19" },
];

const AddModal = ({ onClose, onSave, isLoading, error }) => {
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");
  const [selectedDayLabel, setSelectedDayLabel] = useState("");
  const [selectedColor, setSelectedColor] = useState("#D4EFDF");
  const dispatch = useDispatch();
  const { list:employees } = useSelector((state) => state.employee);

  const handleSubmit = () => {
    if (!title || !datetime) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    const formattedDatetime = datetime + ":00Z";

    const newEventData = {
      title,
      datetime: formattedDatetime,
      company: 1,
      participants: [],
      notes: "Добавлено из календаря",
    };
    onSave(newEventData);
  };

  useEffect(() => {
        const params = {
      page: 1,
      search: '',
      // ...currentFilters,
    };
    dispatch(fetchEmployeesAsync(params));
  },[]);
  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление события</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Название</label>
          <input
            type="text"
            placeholder="Например, Утренняя пробежка"
            className="add-modal__input"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="add-modal__section">
          <label>Дата и Время</label>
          <input
            type="datetime-local"
            className="add-modal__input"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>

        <div className="add-modal__section">
          <label>Сотрудник</label>
          {/* <input
            type="text"
            className="add-modal__input"
            value={selectedDayLabel}
            onChange={(e) => setSelectedDayLabel(e.target.value)}
          /> */}

          <select>
            <option value="">Выберите сотрудника</option>
            {employees?.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="add-modal__footer">
          <button
            className="add-modal__cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            className="add-modal__save"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Добавляем..." : "Добавить"}
          </button>
        </div>
        {error && <p className="add-modal__error-message">Ошибка: {error}</p>}
      </div>
    </div>
  );
};

export default AddModal;
