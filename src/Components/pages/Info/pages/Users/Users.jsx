import React, { useState } from 'react';
import './Users.scss';
import Departments from './Departments/Departments'; // добавлено

const sidebarTabs = ['Пользователи', 'Права доступа', 'Управление отделами'];

const users = [
  {
    name: 'Иван Иванов',
    role: 'Администратор',
    phone: '+996555 123 456',
    email: 'alex_osh_kg@...',
    status: 'Активен',
    avatar: 'https://via.placeholder.com/32',
  },
  {
    name: 'Иван Иванов',
    role: 'Менеджер',
    phone: '+996555 123 456',
    email: 'alex_osh_kg@...',
    status: 'Активен',
    avatar: 'https://via.placeholder.com/32',
  },
];

const Users = () => {
  const [activeTab, setActiveTab] = useState('Пользователи');

  return (
    <div className="users">
      <div className="users__sidebar">
        <h3 className="users__sidebar-title">Пользователи</h3>
        <ul className="users__sidebar-list">
          {sidebarTabs.map((tab) => (
            <li
              key={tab}
              className={`users__sidebar-item ${
                activeTab === tab ? 'users__sidebar-item--active' : ''
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {activeTab === tab && <span className="users__arrow">›</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="users__content">
        {activeTab === 'Пользователи' && (
          <>
            <div className="users__top">
              <input
                type="text"
                placeholder="Поиск"
                className="users__search"
              />
              <button className="users__add-button">Создать пользователя</button>
            </div>

            <table className="users__table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль доступа</th>
                  <th>Телефон</th>
                  <th>Эл. почта</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr key={index}>
                    <td className="users__name-cell">
                      <img src={u.avatar} alt="avatar" />
                      {u.name}
                    </td>
                    <td>{u.role}</td>
                    <td>{u.phone}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="users__status">{u.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {activeTab === 'Управление отделами' && <Departments />}
        {activeTab === 'Права доступа' && <div>Здесь будет "Права доступа"</div>}
      </div>
    </div>
  );
};

export default Users;
