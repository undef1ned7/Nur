import {
    FaPlus,
    FaTimes,
    FaClipboardList,
    FaTrash,
} from "react-icons/fa";
import { useState, useEffect } from "react";
const CookModal = ({
    saving,
    setModalOpen,
    saveForm,
    form,
    setForm,
    isEditing,
    tables,
    busyTableIds,
    clientQ,
    setClientQ,
    showAddClient,
    setShowAddClient,
    newClientName,
    setNewClientName,
    handleCreateClient,
    addClientSaving,
    newClientPhone,
    setNewClientPhone,
    clientsErr,
    clientsLoading,
    filteredClients,
    addingId,
    setAddingId,
    menuItems,
    fmtMoney,
    menuImageUrl,
    menuMap,
    addingQty,
    setAddingQty,
    addItem,
    changeItemQty,
    toNum,
    removeItem,
    waiters,
}) => {
    const [waiterName, setWaiterName] = useState('');
    const [table, setTable] = useState({});
    useEffect(() => {
        if (waiters.find(item => {
            return item.id === form.waiter
        })) {
            setWaiterName(waiters.find(item => {
                return item.id === form.waiter
            }).name);
        } else{
            setWaiterName('Без официанта')
        }

        setTable(tables.find(item => {
            return item.id === form.table
        }));
    }, [waiters, form])
    return (
        <div
            className="cafeOrdersModal__overlay"
            onClick={() => !saving && setModalOpen(false)}
        >
            <div
                className="cafeOrdersModal__card"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="cafeOrdersModal__header">
                    <h3 className="cafeOrdersModal__title">
                        Просмотр заказа
                    </h3>
                    <button
                        className="cafeOrdersModal__close"
                        onClick={() => !saving && setModalOpen(false)}
                        disabled={saving}
                        title={saving ? "Сохранение…" : "Закрыть"}
                        aria-label="Закрыть"
                    >
                        <FaTimes />
                    </button>
                </div>

                <form className="cafeOrders__form" onSubmit={saveForm}>
                    <div className="cafeOrders__formGrid">
                        {/* Стол */}
                        <div className="cafeOrders__field">
                            <label className="cafeOrders__label">Стол</label>
                            <span> {`Стол ${table.number}${table.places ? ` • ${table.places} мест` : ""
                                }`}</span>

                        </div>

                        {/* Гостей */}
                        <div className="cafeOrders__field">
                            <label className="cafeOrders__label">Гостей</label>
                            <span>{form.guests}</span>
                        </div>

                        {/* Официант */}
                        <div className="cafeOrders__field">
                            <label className="cafeOrders__label">Официант</label>
                            {waiterName}
                        </div>
                    </div>



                    {/* Позиции */}
                    <div className="cafeOrders__itemsBlock">
                        <h4 className="cafeOrders__subtitle">Позиции заказа</h4>


                        {form.items.length ? (
                            <div className="cafeOrders__tableWrap">
                                <table className="cafeOrders__table">
                                    <thead>
                                        <tr>
                                            <th>Блюдо</th>
                                            <th>Кол-во</th>

                                        </tr>
                                    </thead>
                                    <tbody>
                                        {form.items.map((it) => {
                                            const img = menuImageUrl(it.menu_item);
                                            return (
                                                <tr key={it.menu_item}>
                                                    <td>
                                                        <div className="cafeOrders__dishCell">
                                                            <span
                                                                className="cafeOrders__thumb cafeOrders__thumb--sm"
                                                                aria-hidden
                                                            >
                                                                {img ? (
                                                                    <img src={img} alt="" />
                                                                ) : (
                                                                    <FaClipboardList />
                                                                )}
                                                            </span>
                                                            <span>{it.title}</span>
                                                        </div>
                                                    </td>
                                                    <td className="cafeOrders__qtyCell">
                                                        {it.quantity}

                                                    </td>


                                                </tr>
                                            );
                                        })}

                                    </tbody>

                                </table>
                            </div>
                        ) : (
                            <div className="cafeOrders__alert">Добавьте блюдо из меню.</div>
                        )}
                    </div>




                    <div className="cafeOrders__formActions">
                        <button
                            className="cafeOrders__btn cafeOrders__btn--primary"
                            type="button">Взять заказ</button>

                        <button
                            type="submit"
                            className="cafeOrders__btn cafeOrders__btn--primary"
                            disabled={saving || !form.table || !form.items.length}
                        >
                            Закрыть
                        </button>

                    </div>



                </form>
            </div>
        </div>
    );
}

export default CookModal;
