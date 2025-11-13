import React from 'react';
import './Tabs.scss';

const tabList = [
  'Общие',
  'Безопасность',
  'Пользователи',
  'Справочники',
  'Шаблоны',
  'Управление воронками',
  'Моя компания'
];

const Tabs = ({ activeTab, setActiveTab }) => {
  return (
    <div className="tabs">
      {tabList.map((tab) => (
        <button
          key={tab}
          className={`tabs__item ${activeTab === tab ? 'tabs__item--active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
