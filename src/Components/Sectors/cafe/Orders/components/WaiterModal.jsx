import {
    FaPlus,
    FaTimes,
    FaClipboardList,
    FaTrash,
} from "react-icons/fa";
import { useEffect } from "react";

const WaiterModal = ({
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
}) => {

    useEffect(()=>{
         setForm((f) => ({ ...f, waiter: localStorage.getItem('userId')}))
    }, []);
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
                        {isEditing ? "Редактировать заказ" : "Новый заказ"}
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
                            <select
                                className="cafeOrders__input"
                                value={form.table ?? ""}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, table: e.target.value }))
                                }
                                disabled={saving}
                            >
                                <option value="">С собой</option>
                                {tables
                                    .filter(
                                        (t) =>
                                            !busyTableIds.has(t.id) ||
                                            String(t.id) === String(form.table)
                                    )
                                    .map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {`Стол ${t.number}${t.places ? ` • ${t.places} мест` : ""
                                                }`}
                                        </option>
                                    ))}
                            </select>
                            {busyTableIds.size > 0 && (
                                <div className="cafeOrders__hint">
                                    Занятые столы скрыты до оплаты.
                                </div>
                            )}
                        </div>

                        {/* Гостей */}
                        <div className="cafeOrders__field">
                            <label className="cafeOrders__label">Гостей</label>
                            <input
                                type="number"
                                min={0}
                                className="cafeOrders__input"
                                value={form.guests}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        guests: Math.max(0, Number(e.target.value) || 0),
                                    }))
                                }
                                disabled={saving}
                            />
                        </div>

                        {/* Официант */}
                        <div className="cafeOrders__field">
                            <label className="cafeOrders__label">Официант</label>
                            {JSON.parse(localStorage.getItem('userData')).first_name}
                        </div>

                        <div className="cafeOrders__field cafeOrders__field--full">
                            <div className="cafeOrders__subtitle">
                                {isEditing ? (
                                    "Можно менять стол, состав заказа и кол-во гостей."
                                ) : (
                                    <>
                                        Статус при создании = <b>Оплата</b>.
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Клиент */}
                    <div className="cafeOrders__itemsBlock">
                        <h4 className="cafeOrders__subtitle">Клиент</h4>

                        <div className="cafeOrders__clientRow">
                            <input
                                className="cafeOrders__input cafeOrders__input--grow"
                                placeholder="Найти клиента по имени или телефону…"
                                value={clientQ}
                                onChange={(e) => setClientQ(e.target.value)}
                                disabled={saving}
                            />
                            <button
                                type="button"
                                className="cafeOrders__btn cafeOrders__btn--secondary"
                                onClick={() => setShowAddClient((v) => !v)}
                                disabled={saving}
                            >
                                + Добавить клиента
                            </button>
                        </div>

                        {showAddClient && (
                            <div className="cafeOrders__clientAdd">
                                <input
                                    className="cafeOrders__input"
                                    placeholder="Имя *"
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleCreateClient(e);
                                        }
                                    }}
                                    required
                                    disabled={addClientSaving || saving}
                                />
                                <input
                                    className="cafeOrders__input"
                                    placeholder="Телефон"
                                    value={newClientPhone}
                                    onChange={(e) => setNewClientPhone(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleCreateClient(e);
                                        }
                                    }}
                                    disabled={addClientSaving || saving}
                                />
                                <button
                                    type="button"
                                    className="cafeOrders__btn cafeOrders__btn--primary"
                                    onClick={handleCreateClient}
                                    disabled={addClientSaving || saving}
                                    title={
                                        addClientSaving ? "Сохранение…" : "Сохранить клиента"
                                    }
                                >
                                    {addClientSaving ? "Сохранение…" : "Сохранить"}
                                </button>
                            </div>
                        )}

                        <div className="cafeOrders__clientList">
                            {clientsErr && (
                                <div className="cafeOrders__clientErr">{clientsErr}</div>
                            )}
                            {clientsLoading ? (
                                <div className="cafeOrders__clientLoading">Загрузка…</div>
                            ) : filteredClients.length ? (
                                filteredClients.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, client: c.id }))}
                                        className={`cafeOrders__clientItem ${String(form.client) === String(c.id)
                                            ? "cafeOrders__clientItem--active"
                                            : ""
                                            }`}
                                        title={c.full_name}
                                        disabled={saving}
                                    >
                                        <span className="cafeOrders__clientName">
                                            {c.full_name || "—"}
                                        </span>
                                        <span className="cafeOrders__clientPhone">
                                            {c.phone || ""}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="cafeOrders__clientLoading">
                                    Ничего не найдено
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Позиции */}
                    <div className="cafeOrders__itemsBlock">
                        <h4 className="cafeOrders__subtitle">Позиции заказа</h4>

                        <div className="cafeOrders__formGrid">
                            <div className="cafeOrders__field">
                                <label className="cafeOrders__label">Позиция меню</label>
                                <select
                                    className="cafeOrders__input"
                                    value={addingId}
                                    onChange={(e) => setAddingId(e.target.value)}
                                    disabled={saving}
                                >
                                    <option value="">— Выберите позицию —</option>
                                    {menuItems.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.title} — {fmtMoney(m.price)} сом
                                        </option>
                                    ))}
                                </select>

                                {/* превью выбранной позиции */}
                                {addingId && (
                                    <div className="cafeOrders__selectPreview">
                                        <span
                                            className="cafeOrders__thumb cafeOrders__thumb--sm"
                                            aria-hidden
                                        >
                                            {menuImageUrl(addingId) ? (
                                                <img src={menuImageUrl(addingId)} alt="" />
                                            ) : (
                                                <FaClipboardList />
                                            )}
                                        </span>
                                        <span className="cafeOrders__selectPreviewText">
                                            {menuMap.get(String(addingId))?.title ||
                                                "Позиция меню"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="cafeOrders__field">
                                <label className="cafeOrders__label">Кол-во</label>
                                <input
                                    type="number"
                                    min={1}
                                    className="cafeOrders__input"
                                    value={addingQty}
                                    onChange={(e) =>
                                        setAddingQty(Math.max(1, Number(e.target.value) || 1))
                                    }
                                    disabled={saving}
                                />
                            </div>

                            <div className="cafeOrders__field">
                                <label className="cafeOrders__label">&nbsp;</label>
                                <button
                                    type="button"
                                    className="cafeOrders__btn cafeOrders__btn--primary"
                                    onClick={addItem}
                                    disabled={!addingId || saving}
                                >
                                    <FaPlus /> Добавить позицию
                                </button>
                            </div>
                        </div>

                        {form.items.length ? (
                            <div className="cafeOrders__tableWrap">
                                <table className="cafeOrders__table">
                                    <thead>
                                        <tr>
                                            <th>Блюдо</th>
                                            <th>Цена</th>
                                            <th>Кол-во</th>
                                            <th>Сумма</th>
                                            <th></th>
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
                                                    <td>{fmtMoney(it.price)} сом</td>
                                                    <td className="cafeOrders__qtyCell">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            className="cafeOrders__input"
                                                            value={it.quantity}
                                                            onChange={(e) =>
                                                                changeItemQty(it.menu_item, e.target.value)
                                                            }
                                                            disabled={saving}
                                                        />
                                                    </td>
                                                    <td>
                                                        {fmtMoney(
                                                            toNum(it.price) * (Number(it.quantity) || 0)
                                                        )}{" "}
                                                        сом
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="cafeOrders__btn cafeOrders__btn--danger"
                                                            onClick={() => removeItem(it.menu_item)}
                                                            title="Удалить позицию"
                                                            disabled={saving}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr>
                                            <td rowSpan={4}>
                                                <div className="cafeOrders__field">
                                                    <label className="cafeOrders__label">скидка</label>
                                                    <input className="cafeOrders__input" type="number" />
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={2}>
                                                <b>Итого</b>
                                            </td>
                                            <td>
                                                <b>
                                                    {form.items.reduce(
                                                        (s, i) => s + (Number(i.quantity) || 0),
                                                        0
                                                    )}
                                                </b>
                                            </td>
                                            <td>
                                                <b>
                                                    {fmtMoney(
                                                        form.items.reduce(
                                                            (s, i) =>
                                                                s +
                                                                toNum(i.price) * (Number(i.quantity) || 0),
                                                            0
                                                        )
                                                    )}{" "}
                                                    сом
                                                </b>
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="cafeOrders__alert">Добавьте блюдо из меню.</div>
                        )}
                    </div>


                    {
                        isEditing
                            ? <div className="cafeOrders__field cafeOrders__field--checkbox">
                                <label className="cafeOrders__label">Подано</label>
                                <input className="cafeOrders__input" type="checkbox" />
                            </div>
                            : ''
                    }

                    <div className="cafeOrders__formActions">
                        {
                            isEditing
                                ? <div className="cafeOrders__formActions">
                                    <button className="cafeOrders__btn cafeOrders__btn--primary" type="button">Пометить как оплачено</button>
                                </div>
                                : ''
                        }

                        <button
                            type="submit"
                            className="cafeOrders__btn cafeOrders__btn--primary"
                            disabled={saving || !form.items.length}
                        >
                            {saving ? "Сохраняем…" : isEditing ? "Сохранить" : "Добавить"}
                        </button>

                    </div>



                </form>
            </div>
        </div>
    );
}

export default WaiterModal;
