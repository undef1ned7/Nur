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
            className="orders-modal__overlay"
            onClick={() => !saving && setModalOpen(false)}
        >
            <div
                className="orders-modal__card"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="orders-modal__header">
                    <h3 className="orders-modal__title">
                        Просмотр заказа
                    </h3>
                    <button
                        className="orders-modal__close"
                        onClick={() => !saving && setModalOpen(false)}
                        disabled={saving}
                        title={saving ? "Сохранение…" : "Закрыть"}
                        aria-label="Закрыть"
                    >
                        <FaTimes />
                    </button>
                </div>

                <form className="orders__form" onSubmit={saveForm}>
                    <div className="orders__formGrid">
                        {/* Стол */}
                        <div className="orders__field">
                            <label className="orders__label">Стол</label>
                            <span> {`Стол ${table.number}${table.places ? ` • ${table.places} мест` : ""
                                }`}</span>

                        </div>

                        {/* Гостей */}
                        <div className="orders__field">
                            <label className="orders__label">Гостей</label>
                            <span>{form.guests}</span>
                        </div>

                        {/* Официант */}
                        <div className="orders__field">
                            <label className="orders__label">Официант</label>
                            {waiterName}
                        </div>
                    </div>



                    {/* Позиции */}
                    <div className="orders__itemsBlock">
                        <h4 className="orders__subtitle">Позиции заказа</h4>


                        {form.items.length ? (
                            <div className="orders__tableWrap">
                                <table className="orders__table">
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
                                                        <div className="orders__dishCell">
                                                            <span
                                                                className="orders__thumb orders__thumb--sm"
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
                                                    <td className="orders__qtyCell">
                                                        {it.quantity}

                                                    </td>


                                                </tr>
                                            );
                                        })}

                                    </tbody>

                                </table>
                            </div>
                        ) : (
                            <div className="orders__alert">Добавьте блюдо из меню.</div>
                        )}
                    </div>




                    <div className="orders__formActions">
                        <button
                            className="orders__btn orders__btn--primary"
                            type="button">Взять заказ</button>

                        <button
                            type="submit"
                            className="orders__btn orders__btn--primary"
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
