import React, { useState, useEffect } from "react";
import {
    Search,
    Plus,
    SlidersHorizontal,
    X,
    ChevronRight,
    ChevronDown,
    MoreVertical,
} from "lucide-react";
import './Vitrina.scss';
import { type } from "@testing-library/user-event/dist/cjs/utility/type.js";

const Kassa = () => {
    const [cashboxes, setCashboxes] = useState([]); // Now storing cashbox summaries
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('Расход'); // This tab will now filter cashboxes if applicable, or be a UI placeholder
    const [searchTerm, setSearchTerm] = useState('');

    const [showFilter, setShowFilter] = useState(false);
    // Renaming to reflect actual content: now it's about adding/editing a Cashbox
    const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
    const [selectedCashbox, setSelectedCashbox] = useState(null); // For editing
    const [showEditCashboxModal, setShowEditCashboxModal] = useState(false);

    // State for adding a new cashbox
    const [newCashbox, setNewCashbox] = useState({
        cashbox: '', // UUID for cashbox
        name: '',
        amount: 0, // Assuming a balance field for adding, though not in the provided model for GET
    });
    const typeMap = {
  'Приход': 'income',
  'Расход': 'expense',
};
    const fetchCashboxes = async () => {
            setLoading(true);
            try {
                const response = await fetch('https://app.nurcrm.kg/api/construction/cashflows/', {
                    headers: {
                        Authorization: "Bearer " + localStorage.getItem('accessToken')
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                // console.log("Fetched cashboxes data:", data);

                // Assuming data.results is an array of cashbox objects
                setCashboxes(data.results || []); // Ensure it's an array
            } catch (err) {
                console.error("Failed to fetch cashboxes:", err);
                setError("Не удалось загрузить данные кассы. Пожалуйста, попробуйте еще раз.");
            } finally {
                setLoading(false);
            }
        };
    // Effect to fetch cashboxes data
    useEffect(() => {
    

        fetchCashboxes();
    }, []); // Empty dependency array means this runs once on component mount

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Filter cashboxes based on search term
 const filteredCashboxes = cashboxes.filter(cashbox =>
  (
    (cashbox.name && cashbox.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (cashbox.id && cashbox.id.toLowerCase().includes(searchTerm.toLowerCase()))
  ) &&
  (!typeMap[activeTab] || cashbox.type === typeMap[activeTab])
);


    // Handle adding a new cashbox
    const handleAddCashbox = async () => {
        try {
            const response = await fetch('https://app.nurcrm.kg/api/construction/cashflows/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: "Bearer " + localStorage.getItem('accessToken')
                },
                body: JSON.stringify({
                    name: newCashbox.name, 
                    amount: newCashbox.amount,
                    type: activeTab === 'Приход' ? 'income' : 'expense'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error adding cashbox:", errorData);
                throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const addedCashbox = await response.json();
            setCashboxes(prev => [...prev, addedCashbox]);
            setShowAddCashboxModal(false);
            setNewCashbox({ department: '', department_name: '', balance: 0 }); // Reset form
            // Re-fetch all cashboxes to ensure updated data, especially for analytics
            fetchCashboxes(); // This will re-trigger the useEffect to get fresh data
        } catch (err) {
            console.error("Failed to add cashbox:", err);
            setError("Не удалось добавить кассу. Пожалуйста, проверьте данные и попробуйте еще раз.");
        }
    };

    // Handle editing an existing cashbox (PUT/PATCH)
    const handleEditCashbox = async () => {
        if (!selectedCashbox) return; // Should not happen if modal is open

        try {
            // Your API might expect a PATCH for partial updates or PUT for full replacement
            // Assuming PATCH for simplicity, updating only what's needed.
            // Based on your model, department_name is readOnly, so you might only be able to update 'department'
            // or other hidden fields. The `balance` field isn't in your GET model for Cashbox,
            // so if you're sending it, ensure your PUT/PATCH endpoint supports it.
            const response = await fetch(`https://app.nurcrm.kg/api/construction/cashflows/${selectedCashbox.id}/`, {
                method: 'POST', // Or 'PUT'
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: "Bearer " + localStorage.getItem('accessToken')
                },
                body: JSON.stringify({
                    // Only send mutable fields. department_name is readOnly.
                    // If you have a mutable 'balance' or other fields, add them here.
                    // For demonstration, let's assume 'department' can be updated or you just
                    // want to trigger a refresh after closing modal if no actual update is sent.
                    department: selectedCashbox.department, // Send current value or updated value
                    // If balance is a field that can be updated, uncomment:
                    // balance: selectedCashbox.balance,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error updating cashbox:", errorData);
                throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            // Optionally, update state locally with returned data, or re-fetch all
            // const updatedCashbox = await response.json();
            // setCashboxes(prev => prev.map(cb => cb.id === updatedCashbox.id ? updatedCashbox : cb));
            setShowEditCashboxModal(false);
            setSelectedCashbox(null);
            fetchCashboxes(); // Re-fetch to ensure data consistency
        } catch (err) {
            console.error("Failed to edit cashbox:", err);
            setError("Не удалось обновить кассу. Пожалуйста, проверьте данные и попробуйте еще раз.");
        }
    };

    // Handle deleting a cashbox
    const handleDeleteCashbox = async () => {
        const isConfirmed = window.confirm("Вы уверены, что хотите удалить эту кассу?");
        if (!isConfirmed) {
            setShowEditCashboxModal(false);
            return;
        }
        if (!selectedCashbox) return;

        try {

            const response = await fetch(`https://app.nurcrm.kg/api/construction/cashflows/${selectedCashbox.id}/`, {
                method: 'DELETE',
                headers: {
                    Authorization: "Bearer " + localStorage.getItem('accessToken')
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error deleting cashbox:", errorData);
                throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            setCashboxes(prev => prev.filter(cb => cb.id !== selectedCashbox.id));
            setShowEditCashboxModal(false);
            setSelectedCashbox(null);
        } catch (err) {
            console.error("Failed to delete cashbox:", err);
            setError("Не удалось удалить кассу. Пожалуйста, попробуйте еще раз.");
        }
    };

    if (loading) {
        return <div className="vitrina">Загрузка данных...</div>;
    }

    if (error) {
        return <div className="vitrina vitrina--error">{error}</div>;
    }

    return (
        <div className="vitrina">
            <div className="vitrina__header">
                <div className="vitrina__tabs">
                    {/* These tabs currently don't filter the cashbox data directly from API */}
                    <span
                        className={`vitrina__tab ${activeTab === 'Расход' ? 'vitrina__tab--active' : ''}`}
                        onClick={() => setActiveTab('Расход')}
                    >
                        Расход
                    </span>
                    <span
                        className={`vitrina__tab ${activeTab === 'Приход' ? 'vitrina__tab--active' : ''}`}
                        onClick={() => setActiveTab('Приход')}
                    >
                        Приход
                    </span>
                </div>
                <div className="vitrina__actions">
                    <div class="vitrina__controls"><div class="vitrina__search-wrapper"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search vitrina__search-icon"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg><input class="vitrina__search" type="text" placeholder="Поиск"/></div><button class="vitrina__filter-button"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sliders-horizontal "><line x1="21" x2="14" y1="4" y2="4"></line><line x1="10" x2="3" y1="4" y2="4"></line><line x1="21" x2="12" y1="12" y2="12"></line><line x1="8" x2="3" y1="12" y2="12"></line><line x1="21" x2="16" y1="20" y2="20"></line><line x1="12" x2="3" y1="20" y2="20"></line><line x1="14" x2="14" y1="2" y2="6"></line><line x1="8" x2="8" y1="10" y2="14"></line><line x1="16" x2="16" y1="18" y2="22"></line></svg></button></div>
                   <button className="vitrina__add-expense-button  sklad__add vitrina__add-expense-button vitrina__button vitrina__button--delete " onClick={() => setShowAddCashboxModal(true)}>
                    Добавить {activeTab === 'Расход' ? 'расход' : 'приход'}
                </button>
                </div>
                {/* "Добавить расход" button from the image design */}
           
            </div>

            <div className="vitrina__toolbar">
                {/* <div className="vitrina__toolbar-div">
                    <div className="vitrina__search-wrapper">
                        <Search className="vitrina__search-icon" size={16} />
                        <input
                            className="vitrina__search"
                            type="text"
                            placeholder="Поиск"
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <button className="vitrina__filter-button" onClick={() => setShowFilter(true)}>
                        <SlidersHorizontal size={18} />
                    </button>
                </div> */}
            </div>

            {/* Table for Cashbox Summaries (as per API) */}
      <div className="table-wrapper"> 

            <table className="vitrina__table">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Название</th>
                        <th>{activeTab} (Всего)</th>
                        <th>Дата создания</th>
                        {/* <th>Расход (Всего)</th> */}
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredCashboxes.length > 0 ? (
                        filteredCashboxes.map((cashbox, index) => (
                            <tr key={cashbox.id}>
                                <td>{index + 1}</td>
                                <td>{cashbox.name}</td>
                                <td>{cashbox.amount} c</td>
                                <td>{new Date(cashbox.created_at).toLocaleDateString()}</td>
                                <td className="vitrina__actions">
                                    {/* <MoreVertical
                                        className="vitrina__more-icon"
                                        size={16}
                                        onClick={() => {
                                            setSelectedCashbox(cashbox);
                                            setShowEditCashboxModal(true);
                                        }}
                                    /> */}
                            <button className="vitrina__button vitrina__button--reset" onClick={()=>{
                                setSelectedCashbox(cashbox);
                                handleDeleteCashbox();
                            }}>Удалить</button>

                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="text-center">Нет данных о кассовых аппаратах.</td>
                        </tr>
                    )}
                </tbody>
            </table>
</div>
            <div className="vitrina__pagination">
                <span className="vitrina__pagination-info">1 из {Math.ceil(filteredCashboxes.length / 10) || 1}</span>
                <ChevronRight className="vitrina__arrow" size={18} />
            </div>

            {/* Filter Modal (unchanged from previous version) */}
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
                                <label>Отделы</label>
                                <div className="vitrina__dropdown">
                                    <span>Все</span>
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                            <div className="vitrina__filter-footer">
                                <button className="vitrina__reset vitrina__reset--full">Сбросить фильтры</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Add Cashbox Modal (adapted for adding a new cashbox/department) */}
            {showAddCashboxModal && (
                <div className="vitrina__overlay">
                    <div className="vitrina__modal vitrina__modal--add">
                        <div className="vitrina__modal-header">

                            <h3>Добавление кассы</h3>
                            <X className="vitrina__close-icon" size={20} onClick={() => setShowAddCashboxModal(false)} />
                        </div>
                        <div className="vitrina__modal-section">
                            <label>Название</label>
                            <input
                                type="text"
                                placeholder="Например, Главный офис"
                                className="vitrina__modal-input"
                                value={newCashbox.name} // Using department_name for display/input
                                onChange={(e) => setNewCashbox({ ...newCashbox, name: e.target.value })}
                            />
                        </div>
                        {/* Note: The 'department' UUID is required by your model for POST.
                            You'll likely need a dropdown or selection for existing departments here,
                            or your backend might auto-create a department based on the name.
                            For now, I'm setting a dummy department UUID. In a real app, you'd fetch departments.
                        */}
                        <div className="vitrina__modal-section">
                            <label>Цена</label>
                            <input
                                type="text"
                                placeholder="Например,10000"
                                className="vitrina__modal-input"
                                value={newCashbox.amount}
                                onChange={(e) => setNewCashbox({ ...newCashbox, amount: e.target.value })}
                            />
                        </div>
                        {/* If 'balance' is a field you can set on creation, add it here */}
                        {/* <div className="vitrina__modal-section">
                            <label>Начальный баланс, сом</label>
                            <input
                                type="number"
                                placeholder="0"
                                min="0"
                                className="vitrina__modal-input"
                                value={newCashbox.balance}
                                onChange={(e) => setNewCashbox({ ...newCashbox, balance: parseFloat(e.target.value) })}
                            />
                        </div> */}
                        <div className="vitrina__modal-footer">
                            <button className="vitrina__button vitrina__button--cancel" onClick={() => setShowAddCashboxModal(false)}>Отмена</button>
                            <button className="vitrina__button vitrina__button--save" onClick={handleAddCashbox}>Добавить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Cashbox Modal (adapted for editing a cashbox/department) */}
            {showEditCashboxModal && selectedCashbox && (
                <div className="vitrina__overlay">
                    <div className="vitrina__modal vitrina__modal--edit">
                        <div className="vitrina__modal-header">
                            <h3>Редактирование кассы</h3>
                            <X className="vitrina__close-icon" size={20} onClick={() => setShowEditCashboxModal(false)} />
                        </div>
                        <div className="vitrina__modal-section">
                            <label>ID</label>
                            <input type="text" value={selectedCashbox.id || ''} readOnly className="vitrina__modal-input" />
                        </div>
                        <div className="vitrina__modal-section">
                            <label>Название</label>
                            <input
                                type="text"
                                value={selectedCashbox.name || ''}
                                onChange={(e) => setSelectedCashbox({ ...selectedCashbox, name: e.target.value })}
                                 // As per your model, department_name is readOnly for GET.
                                // If it's editable via PUT/PATCH, remove readOnly and add onChange handler.
                                className="vitrina__modal-input"
                            />
                        </div>
                         <div className="vitrina__modal-section">
                            <label>Цена</label>
                            <input
                                type="number"
                                onChange={(e) => setSelectedCashbox({ ...selectedCashbox, amount: e.target.value })}
                                value={selectedCashbox.amount || ''}
                                 // As per your model, department_name is readOnly for GET.
                                // If it's editable via PUT/PATCH, remove readOnly and add onChange handler.
                                className="vitrina__modal-input"
                            />
                        </div>
                        {/* If 'balance' or 'department' (UUID) can be edited, add inputs for them here */}
                        {/*
                        <div className="vitrina__modal-section">
                            <label>Баланс, сом</label>
                            <input
                                type="number"
                                value={selectedCashbox.balance || 0}
                                onChange={(e) => setSelectedCashbox({ ...selectedCashbox, balance: parseFloat(e.target.value) })}
                                className="vitrina__modal-input"
                            />
                        </div>
                        <div className="vitrina__modal-section">
                            <label>UUID Отдела</label>
                            <input
                                type="text"
                                value={selectedCashbox.department || ''}
                                onChange={(e) => setSelectedCashbox({ ...selectedCashbox, department: e.target.value })}
                                className="vitrina__modal-input"
                            />
                        </div>
                        */}
                        <div className="vitrina__modal-footer">
                            <button className="vitrina__button vitrina__button--reset" onClick={handleDeleteCashbox}>Удалить</button>
                            <button className="vitrina__button vitrina__button--save" onClick={handleEditCashbox}>Сохранить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Kassa;