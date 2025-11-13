import React, { useState, useEffect } from "react";
import { SlidersHorizontal, MoreVertical, X, ChevronDown, Plus } from "lucide-react";

import { useDispatch, useSelector } from "react-redux";

import {
  fetchProductsAsync,
  createProductAsync,
  updateProductAsync,
  deleteProductAsync,
} from '../../../store/creators/productCreators'; 

import { clearProducts } from '../../../store/slices/productSlice'; 


const EditModal = ({ item, onClose, onSaveSuccess, onDeleteConfirm }) => {
  const dispatch = useDispatch();
  const { updating, updateError, deleting, deleteError } = useSelector(state => state.product); 

  const [editedItem, setEditedItem] = useState({
    id: item.id || '',
    name: item.name || '', 
    price: item.price || '',
    brand: item.brand || '',
    article: item.article || '',
    quantity: item.quantity || '', 
    category: item.category || '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedItem(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    if (!editedItem.name || !editedItem.price || !editedItem.quantity) {
      alert('Пожалуйста, заполните все обязательные поля (Название, Цена, Количество).');
      return;
    }

    try {
      const dataToSave = {
        ...editedItem,
        price: parseFloat(editedItem.price),
        quantity: parseInt(editedItem.quantity, 10),
      };

      await dispatch(updateProductAsync({ productId: item.id, updatedData: dataToSave })).unwrap();
      onClose(); 
      onSaveSuccess(); 
    } catch (err) {
      console.error('Failed to update product:', err);
      alert(`Ошибка при обновлении товара: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Вы уверены, что хотите удалить товар "${item?.name}"?`)) {
      try {
        await dispatch(deleteProductAsync(item.id)).unwrap();
        onClose(); 
        onDeleteConfirm(); 
      } catch (err) {
        console.error('Failed to delete product:', err);
        alert(`Ошибка при удалении товара: ${err.message || JSON.stringify(err)}`);
      }
    }
  };

  return (
    <div className="edit-modal">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
        <div className="edit-modal__header">
          <h3>Редактирование товара №{item?.id}</h3>
          <X className="edit-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {updateError && <p className="edit-modal__error-message">Ошибка обновления: {updateError.message || JSON.stringify(updateError)}</p>}
        {deleteError && <p className="edit-modal__error-message">Ошибка удаления: {deleteError.message || JSON.stringify(deleteError)}</p>}

        <div className="edit-modal__section">
          <label>Название *</label>
          <input type="text" name="name" value={editedItem.name} onChange={handleChange} required />
        </div>

        {/* <div className="edit-modal__section">
          <label>Описание</label>
          <textarea name="description" rows="3" onChange={handleChange}>{editedItem.description}</textarea>
        </div> */}

        <div className="edit-modal__section">
          <label>Цена *</label>
          <input type="number" name="price" value={editedItem.price} onChange={handleChange} min="0" step="0.01" required />
        </div>

        <div className="edit-modal__section">
          <label>Количество *</label>
          <input type="number" name="quantity" value={editedItem.quantity} onChange={handleChange} min="0" required />
        </div>

        <div className="edit-modal__section">
          <label>Категория</label>
          <input type="text" name="category" value={editedItem.category} onChange={handleChange} />
        </div>

        <div className="edit-modal__footer">
          <button className="edit-modal__reset" onClick={handleDelete} disabled={deleting || updating}>
            {deleting ? 'Удаление...' : 'Удалить'}
          </button>
          <button className="edit-modal__save" onClick={handleSave} disabled={updating || deleting}>
            {updating ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterModal = ({ onClose, currentFilters, onApplyFilters, onResetFilters }) => {
  const [filters, setFilters] = useState(() => {
    return {
      name: currentFilters.name || '',
      category: currentFilters.category || '',
      min_price: currentFilters.min_price || '',
      max_price: currentFilters.max_price || '',
      min_quantity: currentFilters.min_quantity || '',
      max_quantity: currentFilters.max_quantity || '',
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApply = () => {
    const cleanedFilters = {};
    for (const key in filters) {
        const value = filters[key];
        if (value !== undefined && value !== null && value !== '') {
            cleanedFilters[key] = value;
        }
    }
    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    const resetValues = {
      name: '',
      category: '',
      min_price: '',
      max_price: '',
      min_quantity: '',
      max_quantity: '',
    };
    setFilters(resetValues);
    onResetFilters();
    onClose();
  };

  return (
    <div className="filter-modal">
      <div className="filter-modal__overlay" onClick={onClose} />
      <div className="filter-modal__content">
        <div className="filter-modal__header">
          <h3>Фильтры товаров</h3>
          <X className="filter-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="filter-modal__section">
          <label>Название</label>
          <input type="text" name="name" placeholder="Название товара" value={filters.name} onChange={handleChange} />
        </div>

        <div className="filter-modal__section">
          <label>Категория</label>
          <input type="text" name="category" placeholder="Например, Электроника" value={filters.category} onChange={handleChange} />
        </div>

        <div className="filter-modal__section">
          <label>Минимальная цена</label>
          <input type="number" name="min_price" placeholder="0" value={filters.min_price} onChange={handleChange} min="0" step="0.01" />
        </div>

        <div className="filter-modal__section">
          <label>Максимальная цена</label>
          <input type="number" name="max_price" placeholder="1000" value={filters.max_price} onChange={handleChange} min="0" step="0.01" />
        </div>

        <div className="filter-modal__section">
          <label>Минимальное количество</label>
          <input type="number" name="min_quantity" placeholder="0" value={filters.min_quantity} onChange={handleChange} min="0" />
        </div>

        <div className="filter-modal__section">
          <label>Максимальное количество</label>
          <input type="number" name="max_quantity" placeholder="100" value={filters.max_quantity} onChange={handleChange} min="0" />
        </div>

        <div className="filter-modal__footer">
          <button className="filter-modal__reset" onClick={handleReset}>Сбросить фильтры</button>
          <button className="filter-modal__apply" onClick={handleApply}>Применить фильтры</button>
        </div>
      </div>
    </div>
  );
};

const AddModal = ({ onClose, onSaveSuccess }) => {
  const dispatch = useDispatch();
  const { creating, createError } = useSelector(state => state.product);

  const [newItemData, setNewItemData] = useState({
    name: '',
    // description: '',
    article:'',
    brand: '',
    price: 0,
    quantity: 0,
    category: '',
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setNewItemData(prevData => ({
      ...prevData,
      [name]: type === 'number' ? parseFloat(value) : value, 
    }));
  };

  
  const handleSubmit = async () => {
    // Простая валидация полей
    if (!newItemData.name || newItemData.price === 0 || newItemData.quantity === 0) { 
      alert('Пожалуйста, заполните все обязательные поля (Название, Цена, Количество).');
      return;
    }

    try {
      await dispatch(createProductAsync(newItemData)).unwrap();
      onClose(); 
      onSaveSuccess(); 
    } catch (err) {
      console.error('Failed to create product:', err);
      alert(`Ошибка при добавлении товара: ${err.message || JSON.stringify(err)}`);
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {createError && <p className="add-modal__error-message">Ошибка добавления: {createError.message || JSON.stringify(createError)}</p>}

        <div className="add-modal__section">
          <label>Название *</label>
          <input type="text" name="name" placeholder="Например, Монитор Dell" className="add-modal__input" value={newItemData.name} onChange={handleChange} required />
        </div>
{/* 
        <div className="add-modal__section">
          <label>Описание</label>
          <textarea name="description" placeholder="Краткое описание товара" className="add-modal__input" rows="3" value={newItemData.description} onChange={handleChange}></textarea>
        </div> */}

        <div className="add-modal__section">
          <label>Артикл</label>
          <textarea name="article" placeholder="Артикл" className="add-modal__input" rows="3" value={newItemData.article} onChange={handleChange}></textarea>
        </div>

        <div className="add-modal__section">
          <label>Бренд</label>
          <textarea name="brand" placeholder="Бренд" className="add-modal__input" rows="3" value={newItemData.brand} onChange={handleChange}></textarea>
        </div>

        <div className="add-modal__section">
          <label>Цена *</label>
          <input type="number" name="price" placeholder="999.99" className="add-modal__input" value={newItemData.price} onChange={handleChange} min="0" step="0.01" required />
        </div>

        <div className="add-modal__section">
          <label>Количество *</label>
          <input type="number" name="quantity" placeholder="100" className="add-modal__input" value={newItemData.quantity} onChange={handleChange} min="0" required />
        </div>

        <div className="add-modal__section">
          <label>Категория</label>
          <input type="text" name="category" placeholder="Например, Электроника" className="add-modal__input" value={newItemData.category} onChange={handleChange} />
        </div>

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose} disabled={creating}>Отмена</button>
          <button className="add-modal__save" onClick={handleSubmit} disabled={creating}>
            {creating ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};


export default function WarehouseAccounting() {
  const dispatch = useDispatch();
  
  const {
    list: products, 
    loading,
    error,
    count,
    next,
    previous,
    creating,
    updating,
    deleting
  } = useSelector((state) => state.product); 

  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); 

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState({}); 

  
  useEffect(() => {
    const params = {
      page: currentPage,
      search: searchTerm, 
      ...currentFilters,
    };
    dispatch(fetchProductsAsync(params));

    return () => {
      dispatch(clearProducts());
    };
  }, [dispatch, currentPage, searchTerm, creating, updating, deleting, currentFilters]); 

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleSaveSuccess = () => {
    setShowEditModal(false);
    setShowAddModal(false);
    alert('Операция с товаром успешно завершена!');
  };

  const handleDeleteConfirm = () => {
    setShowEditModal(false);
    alert('Товар успешно удален!');
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
  };

  const handleResetAllFilters = () => {
    setSearchTerm('');
    setCurrentFilters({}); 
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (next) { 
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (previous) { 
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    setCurrentPage(1); 
  };

  const isFiltered = searchTerm || Object.keys(currentFilters).length > 0;

  const totalPages = count && products.length > 0 ? Math.ceil(count / products.length) : 1;


  return (
    <div className="sklad">
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по названию товара"
            className="sklad__search"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {/* <button className="sklad__filter" onClick={() => setShowFilterModal(true)}>
            <SlidersHorizontal size={16} />
          </button> */}
          <div className="sklad__center">
            <span>Всего: {count !== null ? count : '-'}</span>
            <span>Найдено: {products.length}</span>
            {isFiltered && (
              <span className="sklad__reset" onClick={handleResetAllFilters} style={{ cursor: 'pointer' }}>Сбросить</span>
            )}
          </div>
        </div>
        <button className="sklad__add" onClick={handleAdd}>
          <Plus size={16} style={{ marginRight: '4px' }} /> Добавить товар
        </button>
      </div>

      {loading ? (
        <p className="sklad__loading-message">Загрузка товаров...</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки: {error.detail || error.message || JSON.stringify(error)}</p>
      ) : products.length === 0 ? (
        <p className="sklad__no-products-message">Нет доступных товаров.</p>
      ) : (
        <table className="sklad__table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th></th>
              <th>ID</th>
              <th>Название</th>
              {/* <th>Описание</th> */}
              <th>Цена</th>
              <th>Количество</th>
              <th>Категория</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item) => (
              <tr key={item.id}>
                <td><input type="checkbox" /></td>
                <td><MoreVertical size={16} onClick={() => handleEdit(item)} style={{ cursor: 'pointer' }} /></td>
                <td>{item.id}</td> 
                <td><strong>{item.name}</strong></td> 
                <td>{item.price}</td> 
                <td>{item.quantity}</td> 
                <td>{item.category}</td> 
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="sklad__pagination">
        <span>{currentPage} из {totalPages}</span>
        <button onClick={handlePreviousPage} disabled={!previous || loading || creating || updating || deleting}>
          ←
        </button>
        <button onClick={handleNextPage} disabled={!next || loading || creating || updating || deleting}>
          →
        </button>
      </div>

      {showEditModal && selectedItem && (
        <EditModal
          item={selectedItem}
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