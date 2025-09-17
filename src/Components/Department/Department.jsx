import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import Input from "./Input";
import Select from "./Select";

const BASE_URL = "https://app.nurcrm.kg/api";
const AUTH_TOKEN = localStorage.getItem("accessToken");
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const DepartmentCard = ({ department, onClick }) => (
  <div className="departmentCard" onClick={() => onClick(department)}>
    <div
      className="departmentCardHeader"
      style={{ backgroundColor: department.color }}
    ></div>
    <div className="departmentCardContent">
      <h3>{department.name}</h3>
      <p>
        {department.employees.length ? department.employees.length : 0}{" "}
        сотрудников
      </p>
    </div>
  </div>
);

const Department = () => {
  const navigate = useNavigate();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    employee_ids: [],
    cashbox: {
      department: "",
    },
  });

  const [employees, setEmployees] = useState([]);

  const [departments, setDepartments] = useState([]);

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

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/construction/departments/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Не удалось получить отделы");
      }

      const data = await response.json();
      setDepartments(data.results || data);
    } catch (err) {
      console.error("Ошибка при получении отделов:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [AUTH_TOKEN]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/users/employees/`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      });
      if (!response.ok) throw new Error("Не удалось получить сотрудников");
      const data = await response.json();
      setEmployees(data.results || data);
    } catch (err) {
      console.error("Ошибка при получении сотрудников:", err);
    }
  }, [AUTH_TOKEN]);

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
    fetchProfile();
  }, [fetchDepartments, fetchEmployees]);

  const handleOpenAddModal = () => {
    setDepartmentForm({
      name: "",
      employee_ids: [],
      cashbox: { department: "" },
    });
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (department) => {
    setEditingDepartment(department);

    setDepartmentForm({
      name: department.name,
      employee_ids: department.employee_ids || [],
      cashbox: {
        department: department.cashbox?.department || "",
      },
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingDepartment(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "cashbox.department") {
      setDepartmentForm((prev) => ({
        ...prev,
        cashbox: { ...prev.cashbox, department: value },
      }));
    } else {
      setDepartmentForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleMultiSelectChange = (name, selectedOptions) => {
    setDepartmentForm((prev) => ({ ...prev, [name]: selectedOptions }));
  };

  const handleSubmitAddDepartment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: departmentForm.name,
        employee_ids: departmentForm.employee_ids,
        ...(departmentForm.cashbox.department && {
          cashbox: departmentForm.cashbox,
        }),
      };

      const response = await fetch(`${BASE_URL}/construction/departments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          errorData.detail ||
          JSON.stringify(errorData) ||
          "Не удалось добавить отдел";
        throw new Error(errorMessage);
      }

      await fetchDepartments();
      handleCloseAddModal();
    } catch (err) {
      console.error("Ошибка при добавлении отдела:", err);
      setError(`Ошибка при добавлении отдела: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEditDepartment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!editingDepartment || !editingDepartment.id) {
        throw new Error("Не выбран отдел для редактирования.");
      }

      const payload = {
        name: departmentForm.name,
        employee_ids: departmentForm.employee_ids,
        ...(departmentForm.cashbox.department && {
          cashbox: departmentForm.cashbox,
        }),
      };

      const response = await fetch(
        `${BASE_URL}/construction/departments/${editingDepartment.id}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          errorData.detail ||
          JSON.stringify(errorData) ||
          "Не удалось обновить отдел";
        throw new Error(errorMessage);
      }

      await fetchDepartments();
      handleCloseEditModal();
    } catch (err) {
      console.error("Ошибка при редактировании отдела:", err);
      setError(`Ошибка при редактировании отдела: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDepartmentDetails = (department) => {
    navigate(`/crm/departments/${department.id}`);
  };

  if (loading && departments.length === 0) {
    return <div className="container">Загрузка отделов...</div>;
  }

  if (error && departments.length === 0) {
    return (
      <div className="container" style={{ color: "red" }}>
        Ошибка: {error}
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="vitrina__controls">
          <div className="vitrina__search-wrapper">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-search vitrina__search-icon"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              className="vitrina__search"
              type="text"
              placeholder="Поиск"
            />
          </div>
          <button className="vitrina__filter-button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-sliders-horizontal "
            >
              <line x1="21" x2="14" y1="4" y2="4"></line>
              <line x1="10" x2="3" y1="4" y2="4"></line>
              <line x1="21" x2="12" y1="12" y2="12"></line>
              <line x1="8" x2="3" y1="12" y2="12"></line>
              <line x1="21" x2="16" y1="20" y2="20"></line>
              <line x1="12" x2="3" y1="20" y2="20"></line>
              <line x1="14" x2="14" y1="2" y2="6"></line>
              <line x1="8" x2="8" y1="10" y2="14"></line>
              <line x1="16" x2="16" y1="18" y2="22"></line>
            </svg>
          </button>
        </div>

        {profile?.role === "owner" || profile?.role === "admin" ? (
          <button className="addDepartmentButton" onClick={handleOpenAddModal}>
            Добавить отдел
          </button>
        ) : null}
      </header>

      {loading && departments.length > 0 && (
        <div style={{ textAlign: "center", margin: "20px" }}>
          Обновление данных...
        </div>
      )}
      {error && (
        <div style={{ color: "red", textAlign: "center", margin: "10px" }}>
          {error}
        </div>
      )}

      <div className="departmentGrid">
        {departments.length > 0
          ? departments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleViewDepartmentDetails}
              />
            ))
          : !loading && <p>Отделы не найдены. Добавьте первый отдел!</p>}
      </div>

      <footer className="footer">
        <span>1-8 из {departments.length}</span>
        <div className="pagination">
          <span className="arrow">&larr;</span>
          <span className="arrow">&rarr;</span>
        </div>
      </footer>

      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        title="Добавить новый отдел"
      >
        <form onSubmit={handleSubmitAddDepartment} className="form">
          <Input
            label="Название отдела"
            name="name"
            value={departmentForm.name}
            onChange={handleChange}
            required
            maxLength={255}
            minLength={1}
          />
          <Select
            label="Сотрудники"
            name="employee_ids"
            value={departmentForm.employee_ids}
            onChange={(e) =>
              handleMultiSelectChange(
                "employee_ids",
                Array.from(e.target.selectedOptions, (option) => option.value)
              )
            }
            options={employees.map((emp) => ({
              value: emp.id,
              label: `${emp.first_name} ${emp.last_name}`,
            }))}
            multiple
          />
          <div className="modalActions">
            <button
              type="button"
              onClick={handleCloseAddModal}
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

      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        title={`Редактировать отдел: ${editingDepartment?.name || ""}`}
      >
        <form onSubmit={handleSubmitEditDepartment} className="form">
          <Input
            label="Название отдела"
            name="name"
            value={departmentForm.name}
            onChange={handleChange}
            required
            maxLength={255}
            minLength={1}
          />

          <Select
            label="Сотрудники"
            name="employee_ids"
            value={departmentForm.employee_ids}
            onChange={(e) =>
              handleMultiSelectChange(
                "employee_ids",
                Array.from(e.target.selectedOptions, (option) => option.value)
              )
            }
            options={employees.map((emp) => ({
              value: emp.id,
              label: emp.email,
            }))}
            multiple
          />

          <div className="modalActions">
            <button
              type="button"
              onClick={handleCloseEditModal}
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

export default Department;
