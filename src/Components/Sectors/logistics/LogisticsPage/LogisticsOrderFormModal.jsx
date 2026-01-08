import { useState } from "react";
import { useDispatch } from "react-redux";
import { createClientAsync } from "../../../../store/creators/clientCreators";

const LogisticsOrderFormModal = ({
  visible,
  onClose,
  form,
  setForm,
  clients,
  clientsLoading,
  onSubmit,
  editingId,
}) => {
  const dispatch = useDispatch();

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const action = await dispatch(
        createClientAsync({
          full_name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          date: new Date().toISOString().split("T")[0],
          type: "client",
          llc: "",
          inn: "",
          okpo: "",
          score: "",
          bik: "",
          address: "",
        })
      );
      if (createClientAsync.fulfilled.match(action)) {
        const client = action.payload;
        // сразу подставим созданного клиента в форму
        setForm((f) => ({ ...f, clientId: client.id }));
        setNewClientName("");
        setNewClientPhone("");
        setNewClientEmail("");
        setShowNewClient(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!visible) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="logistics-page__modal-overlay" onClick={onClose}>
      <div
        className="logistics-page__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="logistics-page__form" onSubmit={handleFormSubmit}>
          <h2 className="logistics-page__form-title">
            {editingId ? "Редактировать заявку" : "Новая заявка"}
          </h2>

          <div className="logistics-page__form-grid">
            {/* Клиент */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Клиент</label>
              <select
                className="logistics-page__input"
                value={form.clientId}
                disabled={clientsLoading}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clientId: e.target.value }))
                }
              >
                <option value="">
                  {clientsLoading ? "Загрузка клиентов..." : "Выберите клиента"}
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.phone || `ID ${c.id}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="logistics-page__link-btn"
                onClick={() => setShowNewClient((v) => !v)}
              >
                {showNewClient
                  ? "Скрыть создание клиента"
                  : "Создать нового клиента"}
              </button>
            </div>

            {showNewClient && (
              <div className="logistics-page__field logistics-page__field--full">
                <div className="logistics-page__new-client">
                  <input
                    className="logistics-page__input"
                    placeholder="Имя клиента *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <input
                    className="logistics-page__input"
                    placeholder="Телефон"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                  <input
                    className="logistics-page__input"
                    placeholder="E-mail"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className="logistics-page__btn logistics-page__btn--secondary"
                    onClick={handleAddClient}
                  >
                    Сохранить клиента
                  </button>
                </div>
              </div>
            )}

            {/* Название машины */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Название машины</label>
              <input
                className="logistics-page__input"
                placeholder="Например: MAN TGX, гос. номер…"
                value={form.carName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, carName: e.target.value }))
                }
              />
            </div>

            {/* Примерная дата прибытия */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">
                Примерная дата прибытия (например: 10-20)
              </label>
              <input
                type="text"
                className="logistics-page__input"
                placeholder="10-20"
                value={form.arrivalDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, arrivalDate: e.target.value }))
                }
              />
            </div>

            {/* Цена машины */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Цена машины</label>
              <input
                className="logistics-page__input"
                placeholder="Сумма за машину"
                value={form.carPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, carPrice: e.target.value }))
                }
              />
            </div>

            {/* Стоимость услуги */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Стоимость услуги</label>
              <input
                className="logistics-page__input"
                placeholder="Логистическая услуга"
                value={form.servicePrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, servicePrice: e.target.value }))
                }
              />
            </div>

            {/* Статус */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Статус</label>
              <p className="bg-[#f9fafb] py-2 px-2.5 border border-[#e5e7eb] rounded-[10px] text-[14px]">
                Оформлен
              </p>
            </div>

            {/* Описание */}
            <div className="logistics-page__field logistics-page__field--full">
              <label className="logistics-page__label">Описание</label>
              <textarea
                className="logistics-page__input logistics-page__input--textarea"
                rows={3}
                placeholder="Дополнительная информация по рейсу, условия, контакты…"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="logistics-page__form-actions">
            <button
              type="button"
              className="logistics-page__btn logistics-page__btn--ghost"
              onClick={onClose}
            >
              Отменить
            </button>
            <button
              type="submit"
              className="logistics-page__btn logistics-page__btn--primary"
            >
              Сохранить заявку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogisticsOrderFormModal;
