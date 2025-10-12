import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  MoreVertical,
  SlidersHorizontal,
  X,
  ChevronDown,
  Plus,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchEmployeesAsync,
  createEmployeeAsync,
  updateEmployeeAsync,
  deleteEmployeeAsync,
} from "../../../store/creators/employeeCreators";
import { clearEmployees } from "../../../store/slices/employeeSlice";
import "./Employ.scss";
import { useUser } from "../../../store/slices/userSlice";
import AccessList from "../../DepartmentDetails/AccessList";
import { ALL_ACCESS_TYPES_MAPPING } from "../../DepartmentDetails/DepartmentDetails";
const BASE_URL = "https://app.nurcrm.kg/api";
const AUTH_TOKEN = localStorage.getItem("accessToken");

const EditModal = ({ employee, onClose, onSaveSuccess, onDeleteConfirm }) => {
  const dispatch = useDispatch();
  const { updating, updateError, deleting, deleteError } = useSelector(
    (state) => state.employee
  );

  const [editedEmployee, setEditedEmployee] = useState(() => {
    const birthDate = employee.birth
      ? new Date(employee.birth.split(".").reverse().join("-"))
          .toISOString()
          .split("T")[0]
      : "";
    return {
      id: employee.id || "",
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      email: employee.email || "",
      role: employee.role || "",
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedEmployee((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (
      !editedEmployee.first_name ||
      !editedEmployee.last_name ||
      !editedEmployee.email ||
      !editedEmployee.role
    ) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    const payload = {
      ...editedEmployee,
      birth: editedEmployee.birth
        ? new Date(editedEmployee.birth).toLocaleDateString("ru-RU")
        : "",
    };

    try {
      await dispatch(
        updateEmployeeAsync({ employeeId: employee.id, updatedData: payload })
      ).unwrap();
      onClose();
      onSaveSuccess();
    } catch (err) {
      console.error("Failed to update employee:", err);
      alert(
        `Ошибка при обновлении сотрудника: ${
          err.message || JSON.stringify(err)
        }`
      );
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `Вы уверены, что хотите удалить сотрудника ${employee?.name}?`
      )
    ) {
      try {
        await dispatch(deleteEmployeeAsync(employee.id)).unwrap();
        onClose();
        onDeleteConfirm();
      } catch (err) {
        console.error("Failed to delete employee:", err);
        alert(
          `Ошибка при удалении сотрудника: ${
            err.message || JSON.stringify(err)
          }`
        );
      }
    }
  };

  const availableDepts = ["Склад", "Маркетинг", "Продажи", "HR", "Бухгалтерия"];
  const availableRoles = [
    {
      value: "admin",
      label: "Администратор",
    },
    {
      value: "manager",
      label: "Менеджер",
    },
    {
      value: "user",
      label: "Пользователь",
    },
    {
      value: "owner",
      label: "Владелец",
    },
  ];

  return (
    <div className="edit-modal">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
        <div className="edit-modal__header">
          <h3>Редактирование сотрудника №{employee?.id}</h3>
          <X className="edit-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {updateError && (
          <p className="edit-modal__error-message">
            Ошибка: {updateError.message || JSON.stringify(updateError)}
          </p>
        )}
        {deleteError && (
          <p className="edit-modal__error-message">
            Ошибка: {deleteError.message || JSON.stringify(deleteError)}
          </p>
        )}

        <div className="edit-modal__section">
          <label>Имя *</label>
          <input
            type="text"
            name="first_name"
            value={editedEmployee.first_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Фамилия *</label>
          <input
            type="text"
            name="last_name"
            value={editedEmployee.last_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Почта *</label>
          <input
            type="text"
            name="email"
            value={editedEmployee.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="edit-modal__section">
          <label>Должность *</label>
          <select
            name="role"
            value={editedEmployee.role}
            onChange={handleChange}
            required
          >
            <option value="">Выберите должность</option>
            {availableRoles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="edit-modal__footer">
          <button
            className="edit-modal__reset"
            onClick={handleDelete}
            disabled={deleting || updating}
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
          <button
            className="edit-modal__save"
            onClick={handleSave}
            disabled={updating || deleting}
          >
            {updating ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- FilterModal Component ---
const FilterModal = ({
  onClose,
  currentFilters,
  onApplyFilters,
  onResetFilters,
}) => {
  const [filters, setFilters] = useState(() => {
    const initial = { ...currentFilters };
    return initial;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : value,
    }));
  };

  const handleApply = () => {
    const cleanedFilters = {};
    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== "") {
        cleanedFilters[key] = value;
      }
    }
    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    const resetValues = {
      first_name: undefined,
      email: undefined,
      role: undefined,
    };
    setFilters(resetValues);
    onResetFilters();
    onClose();
  };

  // const availableDepts = ["Склад", "Маркетинг", "Продажи", "HR", "Бухгалтерия"];
  const availableRoles = [
    {
      value: "admin",
      label: "Администратор",
    },
    {
      value: "manager",
      label: "Менеджер",
    },
    {
      value: "user",
      label: "Пользователь",
    },
  ];

  return (
    <div className="filter-modal">
      <div className="filter-modal__overlay" onClick={onClose} />
      <div className="filter-modal__content">
        <div className="filter-modal__header">
          <h3>Фильтры</h3>
          <X className="filter-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="filter-modal__section">
          <label>Имя</label>
          <input
            type="text"
            name="first_name"
            placeholder="Иван Иванов"
            value={filters.name || ""}
            onChange={handleChange}
          />
        </div>

        <div className="filter-modal__section">
          <label>Фамилия</label>
          <input
            type="text"
            name="last_name"
            placeholder="Иван Иванов"
            value={filters.name || ""}
            onChange={handleChange}
          />
        </div>

        {/* <div className="filter-modal__section">
          <label>Отдел</label>
          <select
            name="dept"
            className="filter-modal__select"
            value={filters.dept || ''}
            onChange={handleChange}
          >
            <option value="">Все отделы</option>
            {availableDepts.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div> */}

        <div className="filter-modal__section">
          <label>Должность</label>
          <select
            name="role"
            className="filter-modal__select"
            value={filters.role || ""}
            onChange={handleChange}
          >
            <option value="">Все должности</option>
            {availableRoles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-modal__footer">
          <button className="filter-modal__reset" onClick={handleReset}>
            Сбросить фильтры
          </button>
          <button className="filter-modal__apply" onClick={handleApply}>
            Применить фильтры
          </button>
        </div>
      </div>
    </div>
  );
};

const AddModal = ({ onClose, onSaveSuccess }) => {
  const dispatch = useDispatch();
  const { creating, createError } = useSelector((state) => state.employee);

  const [newEmployeeData, setNewEmployeeData] = useState({
    first_name: "",
    email: "",
    role: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewEmployeeData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (
      !newEmployeeData.first_name ||
      !newEmployeeData.last_name ||
      !newEmployeeData.email ||
      !newEmployeeData.role
    ) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    const payload = {
      ...newEmployeeData,
    };

    try {
      await dispatch(createEmployeeAsync(payload)).unwrap();
      onClose();
      onSaveSuccess();
    } catch (err) {
      console.error("Failed to create employee:", err);
      alert(
        `Ошибка при добавлении сотрудника: ${
          err.message || JSON.stringify(err)
        }`
      );
    }
  };

  const availableDepts = ["Склад", "Маркетинг", "Продажи", "HR", "Бухгалтерия"];
  const availableRoles = [
    {
      value: "admin",
      label: "Администратор",
    },
    {
      value: "manager",
      label: "Менеджер",
    },
    {
      value: "user",
      label: "Пользователь",
    },
  ];

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление сотрудника</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {createError && (
          <p className="add-modal__error-message">
            Ошибка: {createError.message || JSON.stringify(createError)}
          </p>
        )}

        <div className="add-modal__section">
          <label>Имя *</label>
          <input
            type="text"
            name="first_name"
            placeholder="Например, Иван"
            className="add-modal__input"
            value={newEmployeeData.first_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Фамилия *</label>
          <input
            type="text"
            name="last_name"
            placeholder="Например, Иванов"
            className="add-modal__input"
            value={newEmployeeData.last_name}
            onChange={handleChange}
            required
          />
        </div>

        {/* <div className="add-modal__section">
          <label>Дата рождения *</label>
          <input
            type="date"
            name="birth"
            className="add-modal__input"
            value={newEmployeeData.birth}
            onChange={handleChange}
            required
          />
        </div> */}

        {/* <div className="add-modal__section">
          <label>Отдел *</label>
          <select
            name="dept"
            className="add-modal__select"
            value={newEmployeeData.dept}
            onChange={handleChange}
            required
          >
            <option value="">Выберите отдел</option>
            {availableDepts.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div> */}

        <div className="add-modal__section">
          <label>Почта *</label>
          <input
            type="email"
            name="email"
            placeholder="Например, example@mail.com"
            className="add-modal__input"
            value={newEmployeeData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="add-modal__section">
          <label>Должность *</label>
          <select
            name="role"
            className="add-modal__select"
            value={newEmployeeData.role}
            onChange={handleChange}
            required
          >
            <option value="">Выберите должность</option>
            {availableRoles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="add-modal__footer">
          <button
            className="add-modal__cancel"
            onClick={onClose}
            disabled={creating}
          >
            Отмена
          </button>
          <button
            className="add-modal__save"
            onClick={handleSubmit}
            disabled={creating}
          >
            {creating ? "Добавление..." : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function EmployeeTable() {
  const dispatch = useDispatch();
  const {
    list: employees,
    loading: loading1,
    error: error1,
    count,
    next,
    previous,
    creating,
    createError,
    updating,
    updateError,
    deleting,
    department,
    deleteError,
  } = useSelector((state) => state.employee);
  const { company: profile } = useUser();
  // console.log("====================================");
  // console.log(employees);
  // console.log("====================================");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState({
    name: undefined,
    dept: undefined,
    role: undefined,
  });

  const availableRoles = [
    {
      value: "admin",
      label: "Администратор",
    },
    {
      value: "manager",
      label: "Менеджер",
    },
    {
      value: "user",
      label: "Пользователь",
    },
    {
      value: "owner",
      label: "Владелец",
    },
  ];

  useEffect(() => {
    const params = {
      page: currentPage,
      search: searchTerm,
      ...currentFilters,
    };
    dispatch(fetchEmployeesAsync(params));

    return () => {
      dispatch(clearEmployees());
    };
  }, [
    dispatch,
    currentPage,
    searchTerm,
    creating,
    updating,
    deleting,
    currentFilters,
    showEditModal,
    showAddModal,
  ]);

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleSaveSuccess = () => {
    setShowEditModal(false);
    setShowAddModal(false);
    alert("Операция успешна!");
  };

  const handleDeleteConfirm = () => {
    setShowEditModal(false);
    alert("Сотрудник успешно удален!");
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (next) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (previous) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    setCurrentPage(1);
  };

  const handleResetAllFilters = () => {
    setSearchTerm("");
    setCurrentFilters({
      name: undefined,
      dept: undefined,
      role: undefined,
    });
    setCurrentPage(1);
  };

  const convertBackendAccessesToLabels = useCallback((accessData) => {
    const labelsArray = [];
    ALL_ACCESS_TYPES_MAPPING.forEach((type) => {
      if (accessData && accessData[type.backendKey] === true) {
        labelsArray.push(type.value);
      }
    });
    return labelsArray;
  }, []);

  const convertLabelsToBackendAccesses = useCallback((labelsArray) => {
    const backendAccessObject = {};
    ALL_ACCESS_TYPES_MAPPING.forEach((type) => {
      backendAccessObject[type.backendKey] = labelsArray.includes(type.value);
    });
    return backendAccessObject;
  }, []);

  // const fetchDepartmentDetails = useCallback(async () => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const response = await fetch(
  //       `${BASE_URL}/construction/departments/${departmentId}/`,
  //       {
  //         method: "GET",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${AUTH_TOKEN}`,
  //         },
  //       }
  //     );

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(
  //         errorData.detail || "Не удалось получить данные отдела"
  //       );
  //     }

  //     const data = await response.json();
  //     setDepartment(data);

  //     const processedEmployees = (data.employees || []).map((employee) => ({
  //       ...employee,
  //       accesses: convertBackendAccessesToLabels(employee),
  //     }));
  //     setEmployees(processedEmployees);
  //   } catch (err) {
  //     console.error("Ошибка при получении данных отдела:", err);
  //     setError(err.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [departmentId, AUTH_TOKEN, convertBackendAccessesToLabels]);

  const handleSaveEmployeeAccesses = async (employeeId, newAccessesPayload) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BASE_URL}/users/employees/${employeeId}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify(newAccessesPayload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail ||
            JSON.stringify(errorData) ||
            "Не удалось обновить доступы сотрудника"
        );
      }
    } catch (err) {
      console.error("Ошибка при редактировании доступов сотрудника:", err);
      setError(`Ошибка при редактировании доступов: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const itemsPerPage = employees.length > 0 ? employees.length : 10;
  const calculatedTotalPages = count ? Math.ceil(count / itemsPerPage) : 1;

  return (
    <div className="employee">
      <div className="employee__top">
        <div className="employee__search">
          <div className="employee__search-wrapper">
            <Search size={16} className="employee__search-icon" />
            <input
              className="employee__search-input"
              placeholder="Поиск"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            {searchTerm && (
              <X
                size={16}
                className="employee__clear-search"
                onClick={handleClearSearch}
              />
            )}
          </div>
          {/* <button
            className="employee__filter"
            onClick={() => setShowFilterModal(true)}
          >
            <SlidersHorizontal size={16} />
          </button> */}
        </div>

        <div className="employee__top-buttons">
          <button className="employee__export">Экспорт</button>
          <button
            className="employee__add"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} style={{ marginRight: "4px" }} /> Добавить
            сотрудника
          </button>
        </div>
      </div>

      {loading1 ? (
        <p className="employee__loading-message">Загрузка сотрудников...</p>
      ) : error1 ? (
        <p className="employee__error-message">
          Ошибка загрузки: {error1.message || JSON.stringify(error1)}
        </p>
      ) : employees.length === 0 ? (
        <p className="employee__no-employees-message">
          Нет доступных сотрудников.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="employee__table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th>№</th>
                <th>Имя</th>
                <th>Почта</th>
                <th>Доступы</th>
                <th>Роль</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, index) => {
                const serialNumber =
                  (currentPage - 1) * itemsPerPage + index + 1;
                return (
                  <tr key={e.id}>
                    <td>
                      <input type="checkbox" />
                    </td>
                    <td>{serialNumber}</td>
                    <td className="employee__name">
                      <span>{e.first_name}</span>
                    </td>
                    <td>{e.email}</td>
                    <td>
                      {profile?.owner?.role === "owner" ||
                      profile?.owner?.role === "admin" ? (
                        <AccessList
                          employeeAccesses={e.accesses}
                          onSaveAccesses={(newAccessesPayload) =>
                            handleSaveEmployeeAccesses(e.id, newAccessesPayload)
                          }
                        />
                      ) : (
                        <span>
                          {convertBackendAccessesToLabels(e).join(", ") ||
                            "Нет доступов"}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`employee__role ${
                          e.role === "Маркетолог"
                            ? "employee__role--red"
                            : "employee__role--green"
                        }`}
                      >
                        {availableRoles.map((item) => {
                          return item.value === e.role ? item.label : false;
                        })}
                      </span>
                    </td>
                    <td>
                      <MoreVertical
                        size={18}
                        onClick={() => handleEdit(e)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <p className="employee__loading-message">Добавление сотрудника...</p>
      )}
      {createError && (
        <p className="employee__error-message">
          Ошибка добавления:
          {createError.message || JSON.stringify(createError)}
        </p>
      )}
      {updating && (
        <p className="employee__loading-message">Обновление сотрудника...</p>
      )}
      {updateError && (
        <p className="employee__error-message">
          Ошибка обновления:
          {updateError.message || JSON.stringify(updateError)}
        </p>
      )}
      {deleting && (
        <p className="employee__loading-message">Удаление сотрудника...</p>
      )}
      {deleteError && (
        <p className="employee__error-message">
          Ошибка удаления: {deleteError.message || JSON.stringify(deleteError)}
        </p>
      )}

      <div className="employee__pagination">
        <button
          onClick={handlePreviousPage}
          disabled={!previous || loading1 || creating || updating || deleting}
        >
          ←
        </button>
        <span>
          {currentPage} из {calculatedTotalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={!next || loading1 || creating || updating || deleting}
        >
          →
        </button>
      </div>

      {showEditModal && selectedEmployee && (
        <EditModal
          employee={selectedEmployee}
          onClose={() => setShowEditModal(false)}
          onSaveSuccess={handleSaveSuccess}
          onDeleteConfirm={handleDeleteConfirm}
        />
      )}

      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={currentFilters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetAllFilters}
        />
      )}

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}
