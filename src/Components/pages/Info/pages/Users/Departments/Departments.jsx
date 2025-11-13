import React, { useState, useRef, useEffect } from 'react';
import './Departments.scss';

const Departments = () => {
  const [departments, setDepartments] = useState([
    { name: 'Руководитель', description: '' }
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editIndex, setEditIndex] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenMenuIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openModal = (dept = { name: '', description: '' }, index = null) => {
    setForm(dept);
    setEditIndex(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setForm({ name: '', description: '' });
    setEditIndex(null);
    setIsModalOpen(false);
  };

  const saveDepartment = () => {
    if (!form.name.trim()) return;
    const updated = [...departments];
    if (editIndex !== null) {
      updated[editIndex] = form;
    } else {
      updated.push(form);
    }
    setDepartments(updated);
    closeModal();
  };

  const requestDelete = (index) => {
    setDeleteIndex(index);
    setIsConfirmOpen(true);
    setOpenMenuIndex(null);
  };

  const confirmDelete = () => {
    if (deleteIndex !== null) {
      const updated = [...departments];
      updated.splice(deleteIndex, 1);
      setDepartments(updated);
    }
    setDeleteIndex(null);
    setIsConfirmOpen(false);
  };

  return (
    <div className="departments">
      <div className="departments__table">
        <div className="departments__header">
          <div>Название отдела</div>
          <div>Описание отдела</div>
          <button className="departments__add" onClick={() => openModal()}>+</button>
        </div>

        {departments.map((dept, index) => (
          <div className="departments__row" key={index}>
            <div>{dept.name}</div>
            <div>{dept.description}</div>
            <div className="departments__actions">
              <button onClick={() => setOpenMenuIndex(index)}>⋯</button>
              {openMenuIndex === index && (
                <div className="departments__dropdown" ref={dropdownRef}>
                  <div onClick={() => openModal(dept, index)}>Редактировать</div>
                  <div onClick={() => requestDelete(index)}>Удалить</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="departments__modal">
          <div className="departments__modal-content">
            <h3>{editIndex !== null ? 'Редактирование отдела' : 'Создание отдела'}</h3>
            <input
              type="text"
              placeholder="Название отдела"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              placeholder="Описание отдела"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="departments__modal-actions">
              <button onClick={saveDepartment} className="create">
                {editIndex !== null ? 'Сохранить' : 'Создать'}
              </button>
              <button onClick={closeModal} className="cancel">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <div className="departments__modal">
          <div className="departments__modal-content">
            <h3>Удаление отдела</h3>
            <p>Вы уверены, что хотите удалить отдел?</p>
            <div className="departments__modal-actions">
              <button onClick={confirmDelete} className="create">Да</button>
              <button onClick={() => setIsConfirmOpen(false)} className="cancel">Нет</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
