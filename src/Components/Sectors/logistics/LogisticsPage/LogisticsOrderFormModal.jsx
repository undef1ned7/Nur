import { useState } from "react";
import { useDispatch } from "react-redux";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";

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
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [newClientErrors, setNewClientErrors] = useState({
    full_name: "",
    phone: "",
    email: "",
    common: "",
  });

  const handleAddClient = async () => {
    const fullName = newClientName.trim();
    const phone = newClientPhone.trim();
    const email = newClientEmail.trim();

    if (!fullName) {
      setNewClientErrors((prev) => ({
        ...prev,
        full_name: "Введите имя клиента",
        common: "",
      }));
      return;
    }

    try {
      setNewClientSaving(true);
      setNewClientErrors({ full_name: "", phone: "", email: "", common: "" });

      const client = await dispatch(
        createClientAsync({
          full_name: fullName,
          phone,
          email,
          date: new Date().toISOString().split("T")[0],
          type: "client",
          llc: "",
          inn: "",
          okpo: "",
          score: "",
          bik: "",
          address: "",
        })
      ).unwrap();

      // Сразу подставим созданного клиента в форму
      setForm((f) => ({ ...f, clientId: client.id }));

      // Обновим список клиентов, чтобы он появился в селекте
      dispatch(fetchClientsAsync());

      setNewClientName("");
      setNewClientPhone("");
      setNewClientEmail("");
      setShowNewClient(false);
    } catch (err) {
      console.error("Ошибка при создании клиента в логистике:", err);

      const data =
        err?.data ??
        err?.response?.data ??
        err?.payload?.data ??
        err?.payload ??
        err;

      const toMsg = (v) => {
        if (Array.isArray(v)) return v.filter(Boolean).map(String).join("\n");
        if (typeof v === "string") return v.trim();
        return "";
      };

      const fieldErrors = {
        full_name: toMsg(data?.full_name),
        phone: toMsg(data?.phone),
        email: toMsg(data?.email),
        common: toMsg(data?.non_field_errors) || "",
      };

      const common =
        fieldErrors.common ||
        validateResErrors(err, "Не удалось создать клиента");

      setNewClientErrors({
        ...fieldErrors,
        common:
          fieldErrors.full_name || fieldErrors.phone || fieldErrors.email
            ? ""
            : common,
      });
    }
    finally {
      setNewClientSaving(false);
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
                    className={`logistics-page__input${newClientErrors.full_name ? " logistics-page__input--error" : ""
                      }`}
                    placeholder="Имя клиента *"
                    value={newClientName}
                    onChange={(e) => {
                      setNewClientName(e.target.value);
                      if (newClientErrors.full_name) {
                        setNewClientErrors((prev) => ({ ...prev, full_name: "" }));
                      }
                    }}
                  />
                  <input
                    className={`logistics-page__input${newClientErrors.phone ? " logistics-page__input--error" : ""
                      }`}
                    placeholder="Телефон"
                    value={newClientPhone}
                    onChange={(e) => {
                      setNewClientPhone(e.target.value);
                      if (newClientErrors.phone) {
                        setNewClientErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                  />
                  <input
                    className={`logistics-page__input${newClientErrors.email ? " logistics-page__input--error" : ""
                      }`}
                    placeholder="E-mail"
                    value={newClientEmail}
                    onChange={(e) => {
                      setNewClientEmail(e.target.value);
                      if (newClientErrors.email) {
                        setNewClientErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                  />

                  {(newClientErrors.full_name ||
                    newClientErrors.phone ||
                    newClientErrors.email ||
                    newClientErrors.common) && (
                    <div className="logistics-page__new-client-errors">
                      {newClientErrors.full_name && (
                        <div className="logistics-page__field-hint logistics-page__field-hint--error">
                          {newClientErrors.full_name}
                        </div>
                      )}
                      {newClientErrors.phone && (
                        <div className="logistics-page__field-hint logistics-page__field-hint--error">
                          {newClientErrors.phone}
                        </div>
                      )}
                      {newClientErrors.email && (
                        <div className="logistics-page__field-hint logistics-page__field-hint--error">
                          {newClientErrors.email}
                        </div>
                      )}
                      {newClientErrors.common && (
                        <div className="logistics-page__field-hint logistics-page__field-hint--error">
                          {newClientErrors.common}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="logistics-page__btn logistics-page__btn--secondary"
                    onClick={handleAddClient}
                    disabled={newClientSaving}
                  >
                    {newClientSaving ? "Сохранение..." : "Сохранить клиента"}
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

            {/* Цена продажи */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Цена продажи</label>
              <input
                className="logistics-page__input"
                placeholder="Цена продажи машины"
                value={form.salePrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salePrice: e.target.value }))
                }
              />
            </div>

            {/* Выручка с продажи (вычисляется автоматически) */}
            <div className="logistics-page__field">
              <label className="logistics-page__label">Выручка с продажи</label>
              <p className="bg-[#f9fafb] py-2 px-2.5 border border-[#e5e7eb] rounded-[10px] text-[14px]">
                {(() => {
                  const salePrice = parseFloat(form.salePrice || 0);
                  const carPrice = parseFloat(form.carPrice || 0);
                  const revenue = !isNaN(salePrice) && !isNaN(carPrice) 
                    ? salePrice - carPrice 
                    : 0;
                  return revenue.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                })()}{" "}
                $
              </p>
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
