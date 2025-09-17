import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Modal from "./Modal";
import Select from "./Select"; // Используется для выбора сотрудника
import AccessList from "./AccessList"; // Используется в таблице (редактирование с кнопкой сохранения)
import "./DepartmentDetails.scss";
import { useDispatch } from "react-redux";
import { updateEmployees } from "../../store/creators/departmentCreators";

// --- API Configuration ---
const BASE_URL = "https://app.nurcrm.kg/api";
const AUTH_TOKEN = localStorage.getItem("accessToken");

// Базовые permissions (общие для всех секторов)
const BASIC_ACCESS_TYPES = [
  { value: "Касса", label: "Касса", backendKey: "can_view_cashbox" },
  { value: "Отделы", label: "Отделы", backendKey: "can_view_departments" },
  { value: "Долги", label: "Долги", backendKey: "can_view_debts" },
  { value: "Заказы", label: "Заказы", backendKey: "can_view_orders" },
  { value: "Аналитика", label: "Аналитика", backendKey: "can_view_analytics" },
  { 
    value: "Аналитика Отделов",
    label: "Аналитика Отделов",
    backendKey: "can_view_department_analytics",
  },
  { value: "Продажа", label: "Продажа", backendKey: "can_view_sale" },
  { value: "Склад", label: "Склад", backendKey: "can_view_products" },
  {
    value: "Бронирование",
    label: "Бронирование",
    backendKey: "can_view_booking",
  },
  { value: "Клиенты", label: "Клиенты", backendKey: "can_view_clients" },
  {
    value: "Бренд,Категория",
    label: "Бренд,Категория",
    backendKey: "can_view_brand_category",
  },
  {
    value: "Сотрудники",
    label: "Сотрудники",
    backendKey: "can_view_employees",
  },
  { value: "Настройки", label: "Настройки", backendKey: "can_view_settings" },
];

// Секторные permissions
const SECTOR_ACCESS_TYPES = {
  Барбершоп: [
    {
      value: "Клиенты Барбершопа",
      label: "Клиенты Барбершопа",
      backendKey: "can_view_barber_clients",
    },
    {
      value: "Услуги",
      label: "Услуги",
      backendKey: "can_view_barber_services",
    },
    {
      value: "История",
      label: "История",
      backendKey: "can_view_barber_history",
    },
    { value: "Записи", label: "Записи", backendKey: "can_view_barber_records" },
  ],
  Гостиница: [
    { value: "Комнаты", label: "Комнаты", backendKey: "can_view_hostel_rooms" },
    {
      value: "Бронирования",
      label: "Бронирования",
      backendKey: "can_view_hostel_booking",
    },
    {
      value: "Клиенты Гостиницы",
      label: "Клиенты Гостиницы",
      backendKey: "can_view_hostel_clients",
    },
    {
      value: "Аналитика Гостиницы",
      label: "Аналитика Гостиницы",
      backendKey: "can_view_hostel_analytics",
    },
  ],
  Школа: [
    {
      value: "Ученики",
      label: "Ученики",
      backendKey: "can_view_school_students",
    },
    { value: "Группы", label: "Группы", backendKey: "can_view_school_groups" },
    { value: "Уроки", label: "Уроки", backendKey: "can_view_school_lessons" },
    {
      value: "Учителя",
      label: "Учителя",
      backendKey: "can_view_school_teachers",
    },
    { value: "Лиды", label: "Лиды", backendKey: "can_view_school_leads" },
    { value: "Счета", label: "Счета", backendKey: "can_view_school_invoices" },
  ],
  Кафе: [
    { value: "Меню", label: "Меню", backendKey: "can_view_cafe_menu" },
    {
      value: "Заказы Кафе",
      label: "Заказы Кафе",
      backendKey: "can_view_cafe_orders",
    },
    {
      value: "Закупки",
      label: "Закупки",
      backendKey: "can_view_cafe_purchasing",
    },
    { value: "Бронь", label: "Бронь", backendKey: "can_view_cafe_booking" },
    {
      value: "Клиенты Кафе",
      label: "Клиенты Кафе",
      backendKey: "can_view_cafe_clients",
    },
    { value: "Столы", label: "Столы", backendKey: "can_view_cafe_tables" },
  ],
  "Строительная компания": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Объекты",
      label: "Объекты",
      backendKey: "can_view_building_objects",
    },
  ],
  "Ремонтные и отделочные работы": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Объекты",
      label: "Объекты",
      backendKey: "can_view_building_objects",
    },
  ],
  "Архитектура и дизайн": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Объекты",
      label: "Объекты",
      backendKey: "can_view_building_objects",
    },
  ],
};

// Функция для получения всех доступных permissions на основе сектора и тарифа
const getAllAccessTypes = (sectorName, tariff = null) => {
  console.log("getAllAccessTypes - sectorName:", sectorName, "tariff:", tariff);

  let basicAccess = [...BASIC_ACCESS_TYPES];

  // Фильтруем базовые permissions для тарифа "Старт"
  if (tariff === "Старт") {
    const startTariffPermissions = [
      "can_view_sale", // Продажа
      "can_view_products", // Склад
      "can_view_cashbox", // Касса
      "can_view_brand_category", // Бренд и категория
      "can_view_settings", // Настройки
      "can_view_analytics", // Аналитика
    ];

    basicAccess = basicAccess.filter((access) =>
      startTariffPermissions.includes(access.backendKey)
    );

    console.log(
      "getAllAccessTypes - Start tariff, filtered basicAccess:",
      basicAccess
    );

    // Для тарифа "Старт" не показываем секторные permissions
    return basicAccess;
  }

  const sectorAccess = SECTOR_ACCESS_TYPES[sectorName] || [];
  const result = [...basicAccess, ...sectorAccess];
  console.log("getAllAccessTypes - Other tariff, result:", result);
  return result;
};

// Для обратной совместимости
export const ALL_ACCESS_TYPES_MAPPING = BASIC_ACCESS_TYPES;

/**
 * InlineAccessList — простой инлайн-список чекбоксов без кнопки "Сохранить".
 * При каждом клике сразу вызывает onChange(newLabels).
 */
const InlineAccessList = ({
  selectedLabels = [],
  onChange,
  sectorName,
  profile,
  tariff,
}) => {
  const isChecked = useCallback(
    (label) => selectedLabels.includes(label),
    [selectedLabels]
  );

  const toggle = (label) => {
    const next = isChecked(label)
      ? selectedLabels.filter((l) => l !== label)
      : [...selectedLabels, label];
    onChange?.(next);
  };

  // Получаем доступные permissions на основе сектора, тарифа и роли пользователя
  const availableAccessTypes = (() => {
    if (!sectorName) return ALL_ACCESS_TYPES_MAPPING;

    // Для тарифа "Старт" всегда показываем только базовые permissions
    if (tariff === "Старт") {
      return getAllAccessTypes(sectorName, tariff);
    }

    const allTypes = getAllAccessTypes(sectorName, tariff);

    // Если пользователь не владелец, показываем только базовые permissions
    if (profile?.role_display !== "Владелец") {
      return ALL_ACCESS_TYPES_MAPPING;
    }

    return allTypes;
  })();

  return (
    <div className="inline-access-list">
      {availableAccessTypes.map((type) => (
        <label key={type.backendKey} className="inline-access-item">
          <input
            type="checkbox"
            checked={isChecked(type.value)}
            onChange={() => toggle(type.value)}
          />
          <span>{type.label}</span>
        </label>
      ))}
    </div>
  );
};

const DepartmentDetails = () => {
  const { id: departmentId } = useParams();
  const navigate = useNavigate();

  const [department, setDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [allAvailableEmployees, setAllAvailableEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState({
    first_name: "",
    last_name: "",
  });
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [tariff, setTariff] = useState("Старт"); // Устанавливаем значение по умолчанию
  console.log("DepartmentDetails - Tariff:", tariff);

  const [employeeForm, setEmployeeForm] = useState({
    employee_id: "",
    accesses: [], // массив ярлыков (["Обзор", "Касса", ...])
  });

  const convertBackendAccessesToLabels = useCallback(
    (accessData) => {
      const labelsArray = [];
      const availableAccessTypes = company?.sector?.name
        ? getAllAccessTypes(company.sector.name)
        : ALL_ACCESS_TYPES_MAPPING;

      availableAccessTypes.forEach((type) => {
        if (accessData && accessData[type.backendKey] === true) {
          labelsArray.push(type.value);
        }
      });
      return labelsArray;
    },
    [company?.sector?.name]
  );

  const convertLabelsToBackendAccesses = useCallback(
    (labelsArray) => {
      const backendAccessObject = {};
      const availableAccessTypes = company?.sector?.name
        ? getAllAccessTypes(company.sector.name)
        : ALL_ACCESS_TYPES_MAPPING;

      availableAccessTypes.forEach((type) => {
        backendAccessObject[type.backendKey] = labelsArray.includes(type.value);
      });
      return backendAccessObject;
    },
    [company?.sector?.name]
  );

  const fetchDepartmentDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BASE_URL}/construction/departments/${departmentId}/`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Не удалось получить данные отдела"
        );
      }

      const data = await response.json();
      setDepartment(data);

      const processedEmployees = (data.employees || []).map((employee) => ({
        ...employee,
        // предполагается, что флаги доступов на верхнем уровне employee
        accesses: convertBackendAccessesToLabels(employee),
      }));
      setEmployees(processedEmployees);
    } catch (err) {
      console.error("Ошибка при получении данных отдела:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [departmentId, convertBackendAccessesToLabels]);

  const fetchAllAvailableEmployees = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/users/employees/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Не удалось получить список сотрудников"
        );
      }

      const data = await response.json();
      setAllAvailableEmployees(data.results || data);
    } catch (err) {
      console.error("Ошибка при получении всех сотрудников:", err);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch("https://app.nurcrm.kg/api/users/profile/", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        console.error("Ошибка загрузки профиля");
      }
    } catch (err) {
      console.error("Ошибка запроса профиля:", err);
    }
  };

  const fetchCompany = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch("https://app.nurcrm.kg/api/users/company/", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCompany(data);
        setTariff(data.subscription_plan?.name || "Старт");
      } else {
        console.error("Ошибка загрузки компании");
      }
    } catch (err) {
      console.error("Ошибка запроса компании:", err);
    }
  };

  useEffect(() => {
    if (departmentId) {
      fetchDepartmentDetails();
      fetchAllAvailableEmployees();
      fetchProfile();
      fetchCompany();
    }
  }, [departmentId, fetchDepartmentDetails, fetchAllAvailableEmployees]);

  const handleOpenAddEmployeeModal = () => {
    setEmployeeForm({ employee_id: "", accesses: [] });
    setIsAddEmployeeModalOpen(true);
  };

  const handleCloseAddEmployeeModal = () => {
    setIsAddEmployeeModalOpen(false);
  };

  const handleOpenEditEmployeeModal = (employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      employee_id: employee.id,
      accesses: [],
    });
    setIsEditEmployeeModalOpen(true);
  };

  const handleCloseEditEmployeeModal = () => {
    setIsEditEmployeeModalOpen(false);
    setEditingEmployee(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployeeForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const accessesPayload = convertLabelsToBackendAccesses(
        employeeForm.accesses
      );

      // Фильтруем секторные permissions - они должны быть только у владельца
      const filteredAccessesPayload = { ...accessesPayload };

      // Если тариф "Старт" или пользователь не владелец, убираем секторные permissions
      if (tariff === "Старт" || profile?.role_display !== "Владелец") {
        const sectorPermissions = company?.sector?.name
          ? getAllAccessTypes(company.sector.name, tariff)
              .filter(
                (type) =>
                  !BASIC_ACCESS_TYPES.some(
                    (basic) => basic.backendKey === type.backendKey
                  )
              )
              .map((type) => type.backendKey)
          : [];

        sectorPermissions.forEach((permission) => {
          delete filteredAccessesPayload[permission];
        });

        console.log(
          "Filtered out sector permissions for tariff/role:",
          tariff,
          profile?.role_display,
          sectorPermissions
        );
      }

      const payload = {
        employee_id: employeeForm.employee_id,
        ...filteredAccessesPayload,
      };

      const response = await fetch(
        `${BASE_URL}/construction/departments/${departmentId}/assign-employee/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail ||
            JSON.stringify(errorData) ||
            "Не удалось добавить сотрудника в отдел"
        );
      }

      // Дополнительно синхронизируем флаги доступов на самом сотруднике,
      // т.к. эндпоинт assign-employee может не проставлять отдельные флаги (например, can_view_sale)
      try {
        await fetch(
          `${BASE_URL}/users/employees/${employeeForm.employee_id}/`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${AUTH_TOKEN}`,
            },
            body: JSON.stringify(filteredAccessesPayload),
          }
        );
      } catch (_) {
        // Мягко игнорируем, список всё равно перезагрузим ниже
      }

      await fetchDepartmentDetails();
      handleCloseAddEmployeeModal();
    } catch (err) {
      console.error("Ошибка при добавлении сотрудника:", err);
      setError(`Ошибка при добавлении сотрудника: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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

      await fetchDepartmentDetails();
    } catch (err) {
      console.error("Ошибка при редактировании доступов сотрудника:", err);
      setError(`Ошибка при редактировании доступов: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmployee = async (employeeId) => {
    if (
      !window.confirm(
        "Вы уверены, что хотите удалить этого сотрудника из отдела?"
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = { employee_id: employeeId };

      const response = await fetch(
        `${BASE_URL}/construction/departments/${departmentId}/remove-employee/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail ||
            JSON.stringify(errorData) ||
            "Не удалось удалить сотрудника из отдела"
        );
      }

      await fetchDepartmentDetails();
    } catch (err) {
      console.error("Ошибка при удалении сотрудника:", err);
      setError(`Ошибка при удалении сотрудника: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить отдел "${department.name}"? Это действие необратимо.`
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BASE_URL}/construction/departments/${departmentId}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Не удалось удалить отдел";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || JSON.stringify(errorData);
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      navigate("/crm/departments");
    } catch (err) {
      console.error("Ошибка при удалении отдела:", err);
      setError(`Ошибка при удалении отдела: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setEditingEmployee((prev) => ({ ...prev, [name]: value }));
  };

  const dispatch = useDispatch();

  const onFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const { id, first_name = "", last_name = "" } = editingEmployee;
      await dispatch(
        updateEmployees({
          id,
          data: { first_name: first_name.trim(), last_name: last_name.trim() },
        })
      ).unwrap();
      fetchDepartmentDetails();
      handleCloseEditEmployeeModal();
    } catch (e) {
      console.log(e);
    }
  };

  if (loading && !department) {
    return <div className="container">Загрузка данных отдела...</div>;
  }

  if (error) {
    return (
      <div className="container" style={{ color: "red" }}>
        Ошибка: {error}
      </div>
    );
  }

  if (!department) {
    return <div className="container">Отдел не найден.</div>;
  }

  return (
    <div className="container">
      <header className="header">
        <div className="departmentHeader">
          <h2>Отдел {department.name}</h2>
        </div>
        <div className="userSection">
          {profile?.role === "owner" || profile?.role === "admin" ? (
            <>
              <button
                className="addEmployeeButton"
                onClick={handleDeleteDepartment}
                disabled={loading}
              >
                Удалить отдел
              </button>

              <button
                className="addEmployeeButton"
                onClick={handleOpenAddEmployeeModal}
              >
                Добавить сотрудника
              </button>
            </>
          ) : null}
        </div>
      </header>

      {loading && department && (
        <div style={{ textAlign: "center", margin: "20px" }}>
          Обновление данных...
        </div>
      )}
      {error && (
        <div style={{ color: "red", textAlign: "center", margin: "10px" }}>
          {error}
        </div>
      )}

      <div className="employeeTableContainer">
        <table className="employeeTable">
          <thead>
            <tr>
              <th>№</th>
              <th>ФИО</th>
              <th>Доступы</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {employees.length > 0 ? (
              employees.map((employee, index) => (
                <tr disabled={employee.role === "owner"} key={employee.id}>
                  {console.log(employee)}
                  <td>{index + 1}</td>
                  <td>
                    {employee.first_name} {employee.last_name}
                  </td>
                  <td>
                    {profile?.role === "owner" || profile?.role === "admin" ? (
                      <>
                        <AccessList
                          role={employee.role}
                          employeeAccesses={employee.accesses}
                          onSaveAccesses={(newAccessesPayload) =>
                            handleSaveEmployeeAccesses(
                              employee.id,
                              newAccessesPayload
                            )
                          }
                          sectorName={company?.sector?.name}
                          profile={profile}
                          tariff={tariff}
                        />
                        {console.log(employee.accesses)}
                      </>
                    ) : (
                      <span>
                        {convertBackendAccessesToLabels(employee).join(", ") ||
                          "Нет доступов"}
                      </span>
                    )}
                  </td>
                  <td className="row-btn">
                    <button
                      className="bar__btn bar__btn--secondary"
                      onClick={() => handleOpenEditEmployeeModal(employee)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="bar__btn bar__btn--secondary"
                      onClick={() => handleRemoveEmployee(employee.id)}
                      title="Удалить сотрудника из отдела"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="noEmployees">
                  Сотрудники не найдены в этом отделе.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="footer">
        <span>1-8 из {employees.length}</span>
        <div className="pagination">
          <span className="arrow">&larr;</span>
          <span className="arrow">&rarr;</span>
        </div>
      </footer>

      {/* Модалка: Добавить сотрудника */}
      <Modal
        isOpen={isAddEmployeeModalOpen}
        onClose={handleCloseAddEmployeeModal}
        title="Добавить сотрудника"
      >
        <form onSubmit={handleSubmitAddEmployee} className="form">
          <Select
            label="Выбрать существующего сотрудника"
            name="employee_id"
            value={employeeForm.employee_id}
            onChange={handleChange}
            options={allAvailableEmployees
              .filter(
                (emp) => !employees.some((deptEmp) => deptEmp.id === emp.id)
              )
              .map((emp) => ({
                value: emp.id,
                label: emp.first_name + " " + emp.last_name,
              }))}
            required
          />

          {/* Доступы без кнопки сохранения — сразу пишем в форму */}
          <div className="field">
            <label className="field__label">Доступы</label>
            <InlineAccessList
              selectedLabels={employeeForm.accesses}
              onChange={(nextLabels) =>
                setEmployeeForm((prev) => ({ ...prev, accesses: nextLabels }))
              }
              sectorName={company?.sector?.name}
              profile={profile}
              tariff={tariff}
            />
          </div>

          <div className="modalActions">
            <button
              type="button"
              onClick={handleCloseAddEmployeeModal}
              className="cancelButton"
            >
              Отмена
            </button>
            <button type="submit" className="submitButton">
              Добавить
            </button>
          </div>
        </form>
      </Modal>

      {/* Модалка: Редактировать ФИО */}
      <Modal
        isOpen={isEditEmployeeModalOpen}
        onClose={handleCloseEditEmployeeModal}
        title={`Редактировать сотрудника: ${
          editingEmployee?.first_name || ""
        } ${editingEmployee?.last_name || ""}`}
      >
        <form onSubmit={onFormSubmit} className="form">
          <p>
            <strong>Имя:</strong>{" "}
            <input
              type="text"
              name="first_name"
              onChange={onChange}
              value={editingEmployee?.first_name}
            />
          </p>
          <p>
            <strong>Фамилия:</strong>{" "}
            <input
              type="text"
              name="last_name"
              onChange={onChange}
              value={editingEmployee?.last_name}
            />
          </p>

          <div className="modalActions">
            <button
              type="button"
              onClick={handleCloseEditEmployeeModal}
              className="cancelButton"
            >
              Отмена
            </button>
            <button type="submit" className="submitButton">
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DepartmentDetails;
