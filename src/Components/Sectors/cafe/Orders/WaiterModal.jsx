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
            className="orders-modal__overlay"
            onClick={() => !saving && setModalOpen(false)}
        >
            <div
                className="orders-modal__card"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="orders-modal__header">
                    <h3 className="orders-modal__title">
                        {isEditing ? "Редактировать заказ" : "Новый заказ"}
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
                            <select
                                className="orders__input"
                                value={form.table ?? ""}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, table: e.target.value }))
                                }
                                required
                                disabled={saving}
                            >
                                {!isEditing && <option value="">— Выберите стол —</option>}
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
                                <div className="orders__hint">
                                    Занятые столы скрыты до оплаты.
                                </div>
                            )}
                        </div>

                        {/* Гостей */}
                        <div className="orders__field">
                            <label className="orders__label">Гостей</label>
                            <input
                                type="number"
                                min={0}
                                className="orders__input"
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
                        <div className="orders__field">
                            <label className="orders__label">Официант</label>
                            {JSON.parse(localStorage.getItem('userData')).first_name}
                        </div>

                        <div className="orders__field orders__field--full">
                            <div className="orders__subtitle">
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
                    <div className="orders__itemsBlock">
                        <h4 className="orders__subtitle">Клиент</h4>

                        <div className="orders__clientRow">
                            <input
                                className="orders__input orders__input--grow"
                                placeholder="Найти клиента по имени или телефону…"
                                value={clientQ}
                                onChange={(e) => setClientQ(e.target.value)}
                                disabled={saving}
                            />
                            <button
                                type="button"
                                className="orders__btn orders__btn--secondary"
                                onClick={() => setShowAddClient((v) => !v)}
                                disabled={saving}
                            >
                                + Добавить клиента
                            </button>
                        </div>

                        {showAddClient && (
                            <div className="orders__clientAdd">
                                <input
                                    className="orders__input"
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
                                    className="orders__input"
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
                                    className="orders__btn orders__btn--primary"
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

                        <div className="orders__clientList">
                            {clientsErr && (
                                <div className="orders__clientErr">{clientsErr}</div>
                            )}
                            {clientsLoading ? (
                                <div className="orders__clientLoading">Загрузка…</div>
                            ) : filteredClients.length ? (
                                filteredClients.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, client: c.id }))}
                                        className={`orders__clientItem ${String(form.client) === String(c.id)
                                            ? "orders__clientItem--active"
                                            : ""
                                            }`}
                                        title={c.full_name}
                                        disabled={saving}
                                    >
                                        <span className="orders__clientName">
                                            {c.full_name || "—"}
                                        </span>
                                        <span className="orders__clientPhone">
                                            {c.phone || ""}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="orders__clientLoading">
                                    Ничего не найдено
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Позиции */}
                    <div className="orders__itemsBlock">
                        <h4 className="orders__subtitle">Позиции заказа</h4>

                        <div className="orders__formGrid">
                            <div className="orders__field">
                                <label className="orders__label">Позиция меню</label>
                                <select
                                    className="orders__input"
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
                                    <div className="orders__selectPreview">
                                        <span
                                            className="orders__thumb orders__thumb--sm"
                                            aria-hidden
                                        >
                                            {menuImageUrl(addingId) ? (
                                                <img src={menuImageUrl(addingId)} alt="" />
                                            ) : (
                                                <FaClipboardList />
                                            )}
                                        </span>
                                        <span className="orders__selectPreviewText">
                                            {menuMap.get(String(addingId))?.title ||
                                                "Позиция меню"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="orders__field">
                                <label className="orders__label">Кол-во</label>
                                <input
                                    type="number"
                                    min={1}
                                    className="orders__input"
                                    value={addingQty}
                                    onChange={(e) =>
                                        setAddingQty(Math.max(1, Number(e.target.value) || 1))
                                    }
                                    disabled={saving}
                                />
                            </div>

                            <div className="orders__field">
                                <label className="orders__label">&nbsp;</label>
                                <button
                                    type="button"
                                    className="orders__btn orders__btn--primary"
                                    onClick={addItem}
                                    disabled={!addingId || saving}
                                >
                                    <FaPlus /> Добавить позицию
                                </button>
                            </div>
                        </div>

                        {form.items.length ? (
                            <div className="orders__tableWrap">
                                <table className="orders__table">
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
                                                    <td>{fmtMoney(it.price)} сом</td>
                                                    <td className="orders__qtyCell">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            className="orders__input"
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
                                                            className="orders__btn orders__btn--danger"
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
                                                <div className="orders__field">
                                                    <label className="orders__label">скидка</label>
                                                    <input className="orders__input" type="number" />
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
                            <div className="orders__alert">Добавьте блюдо из меню.</div>
                        )}
                    </div>


                    {
                        isEditing
                            ? <div className="orders__field orders__field--checkbox">
                                <label className="orders__label">Подано</label>
                                <input className="orders__input" type="checkbox" />
                            </div>
                            : ''
                    }

                    <div className="orders__formActions">
                        {
                            isEditing
                                ? <div className="orders__formActions">
                                    <button className="orders__btn orders__btn--primary" type="button">Пометить как оплачено</button>
                                </div>
                                : ''
                        }

                        <button
                            type="submit"
                            className="orders__btn orders__btn--primary"
                            disabled={saving || !form.table || !form.items.length}
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
