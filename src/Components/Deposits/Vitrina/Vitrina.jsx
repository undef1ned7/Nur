
import React, { useState } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  ChevronRight,
  SlidersHorizontal,
  X,
  ChevronDown,
} from "lucide-react";
import './Vitrina.scss';

const items = [
  {
    name: "Моторное масло Shell Helix Ultra, 4л",
    code: "739934",
    brand: "Shell",
    category: "Масла и жидкости",
    stock: 7,
    price: "2 500",
  },
  {
    name: "Моторное масло Shell Helix Ultra, 4л",
    code: "739934",
    brand: "Shell",
    category: "Масла и жидкости",
    stock: 12,
    price: "2 500",
  },
  {
    name: "Моторное масло Shell Helix Ultra, 4л",
    code: "739934",
    brand: "Shell",
    category: "Масла и жидкости",
    stock: 13,
    price: "2 500",
  },
  {
    name: "Моторное масло Shell Helix Ultra, 4л",
    code: "739934",
    brand: "Shell",
    category: "Масла и жидкости",
    stock: 6,
    price: "2 500",
  },
  {
    name: "Моторное масло Shell Helix Ultra, 4л",
    code: "739934",
    brand: "Shell",
    category: "Масла и жидкости",
    stock: 3,
    price: "2 500",
  },
  {
    name: "Моторное масло Shell Helix Ultra, 4л",
    code: "739934",
    brand: "Shell",
    category: "Масла и жидкости",
    stock: 7,
    price: "2 500",
  },
];

const Vitrina = () => {
  const [showFilter, setShowFilter] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    setShowEditModal(false);
  };

  const handleDelete = () => {
    setShowEditModal(false);
  };

  const handleSaveAdd = () => {
    setShowAddModal(false);
  };

  return (
    <div className="vitrina">
      <div className="vitrina__header">
        <div className="vitrina__tabs">
          <span className="vitrina__tab vitrina__tab--inactive">Запчасти</span>
          <span className="vitrina__tab vitrina__tab--active">Автотовары</span>
        </div>
      </div>

      <div className="vitrina__toolbar">
        <div className="vitrina__toolbar-div">
          <button className="vitrina__add-button" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
          </button>
          <span className="vitrina__total">Всего: {items.length}</span>
        </div>

        <div className="vitrina__controls">
          <div className="vitrina__search-wrapper">
            <Search className="vitrina__search-icon" size={16} />
            <input className="vitrina__search" type="text" placeholder="Поиск" />
          </div>
          <button className="vitrina__filter-button" onClick={() => setShowFilter(true)}>
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      <table className="vitrina__table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Артикул</th>
            <th>Бренд</th>
            <th>Категория</th>
            <th>Остаток</th>
            <th>Цена</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="vitrina__name">
                <MoreVertical
                  className="vitrina__more-icon"
                  size={16}
                  onClick={() => handleEdit(item)}
                />
                <div className="vitrina__image-placeholder" />
                <span>{item.name}</span>
              </td>
              <td>{item.code}</td>
              <td>{item.brand}</td>
              <td>{item.category}</td>
              <td>{item.stock} шт.</td>
              <td>{item.price} с</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="vitrina__pagination">
        <span className="vitrina__pagination-info">1 из 28</span>
        <ChevronRight className="vitrina__arrow" size={18} />
      </div>

      {showFilter && (
        <>
          <div className="vitrina__overlay" onClick={() => setShowFilter(false)} />
          <div className="vitrina__filter-modal">
            <div className="vitrina__filter-content">
              <div className="vitrina__filter-header">
                <h3>Фильтры</h3>
                <X className="vitrina__close-icon" size={20} onClick={() => setShowFilter(false)} />
              </div>

              <div className="vitrina__filter-section">
                <div className="vitrina__search-wrapper">
                  <Search size={16} className="vitrina__search-icon" />
                  <input type="text" placeholder="Поиск" className="vitrina__search" />
                </div>
              </div>

              <div className="vitrina__filter-section">
                <label>Бренды</label>
                <div className="vitrina__dropdown">
                  <span>Все</span>
                  <ChevronDown size={16} />
                </div>
              </div>

              <div className="vitrina__filter-section">
                <label>Категории</label>
                <div className="vitrina__dropdown">
                  <span>Выбрано: 2</span>
                  <ChevronDown size={16} />
                </div>
                <div className="vitrina__tags">
                  <div className="vitrina__tag">
                    Масла и жидкости <X size={12} />
                  </div>
                  <div className="vitrina__tag">
                    Шины и диски <X size={12} />
                  </div>
                </div>
                <button className="vitrina__reset">Сбросить</button>
              </div>

              <div className="vitrina__filter-section">
                <label>Остаток, шт.</label>
                <div className="vitrina__range">
                  <input placeholder="от 0" />
                  <input placeholder="до 100" />
                </div>
              </div>

              <div className="vitrina__filter-section">
                <label>Цена, сом</label>
                <div className="vitrina__range">
                  <input value="1 000" readOnly />
                  <input value="2 500" readOnly />
                </div>
                <button className="vitrina__reset">Сбросить</button>
              </div>

              <div className="vitrina__filter-footer">
                <button className="vitrina__reset vitrina__reset--full">Сбросить фильтры</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showEditModal && (
        <div className="edit-modal">
          <div className="edit-modal__overlay" onClick={() => setShowEditModal(false)} />
          <div className="edit-modal__content">
            <div className="edit-modal__header">
              <h3>Редактирование</h3>
              <X className="edit-modal__close-icon" size={20} onClick={() => setShowEditModal(false)} />
            </div>

            <div className="edit-modal__image">
              <div className="edit-modal__image-placeholder" />
              <div className="edit-modal__info">
                <h4>{selectedItem.name}</h4>
                <p>Подробнее о товаре</p>
              </div>
            </div>

            <div className="edit-modal__section">
              <label>Остаток, шт.</label>
              <input type="number" defaultValue={selectedItem.stock} />
            </div>

            <div className="edit-modal__section">
              <label>Цена, сом</label>
              <input type="text" defaultValue={selectedItem.price} />
            </div>

            <div className="edit-modal__footer">
              <button className="edit-modal__reset" onClick={handleDelete}>Удалить</button>
              <button className="edit-modal__save" onClick={handleSaveEdit}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="add-modal">
          <div className="add-modal__overlay" onClick={() => setShowAddModal(false)} />
          <div className="add-modal__content">
            <div className="add-modal__header">
              <h3>Добавление товара</h3>
              <X className="add-modal__close-icon" size={20} onClick={() => setShowAddModal(false)} />
            </div>

            <div className="add-modal__section">
              <label>Изображение товара</label>
              <div className="add-modal__upload">
                <p className="add-modal__upload-text">
                  Выберите изображение или перетащите его сюда
                  <br />
                  <span className="add-modal__upload-hint">JPG/PNG, макс. 3 МБ</span>
                </p>
                <input type="file" accept="image/jpeg,image/png" className="add-modal__file" />
              </div>
            </div>

            <div className="add-modal__section">
              <label>Название</label>
              <input
                type="text"
                placeholder="Например, Моторное масло Shell Helix Ultra, 4л"
                className="add-modal__input"
              />
            </div>

            <div className="add-modal__section">
              <label>Артикул</label>
              <input
                type="text"
                placeholder="Например, 739934"
                className="add-modal__input"
              />
            </div>

            <div className="add-modal__section">
              <label>Бренд</label>
              <select className="add-modal__select">
                <option value="">Выберите бренд</option>
                <option value="Shell">Shell</option>
                <option value="Castrol">Castrol</option>
                <option value="Mobil">Mobil</option>
              </select>
            </div>

            <div className="add-modal__section">
              <label>Категория</label>
              <select className="add-modal__select">
                <option value="">Выберите категорию</option>
                <option value="Масла и жидкости">Масла и жидкости</option>
                <option value="Шины и диски">Шины и диски</option>
                <option value="Автохимия">Автохимия</option>
              </select>
            </div>

            <div className="add-modal__section">
              <label>Остаток, шт.</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                className="add-modal__input"
              />
            </div>

            <div className="add-modal__section">
              <label>Цена, сом</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                className="add-modal__input"
              />
            </div>

            <div className="add-modal__footer">
              <button className="add-modal__cancel" onClick={() => setShowAddModal(false)}>Отмена</button>
              <button className="add-modal__save" onClick={handleSaveAdd}>Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vitrina;