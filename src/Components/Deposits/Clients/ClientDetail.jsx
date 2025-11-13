import { ArrowLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  createDeals,
  getClientDeals,
  getItemClient,
  updateClientAsync,
} from "../../../store/creators/clientCreators";
import { useClient } from "../../../store/slices/ClientSlice";

const AddModal = ({ onClose }) => {
  const dispatch = useDispatch();
  // const {  } = useSelector((s) => s.client);
  const { client, creating, createError } = useClient();

  const [form, setForm] = useState({
    title: "",
    amount: "",
    note: "",
    kind: "sale",
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const statusOptions = [
    { value: "new", label: "Новый" },
    { value: "contacted", label: "Контакт установлен" },
    { value: "interested", label: "Заинтересован" },
    { value: "converted", label: "Конвертирован" },
    { value: "inactive", label: "Неактивный" },
    { value: "paid_for", label: "оплачено" },
    { value: "awaiting", label: "ожидает" },
    { value: "credit", label: "долг" },
    { value: "rejection", label: "отказ" },
  ];

  // console.log(form.status);
  const onFormSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createDeals({ clientId: client.id, ...form })).unwrap();
      dispatch(getClientDeals(client.id));
      onClose();
    } catch {
      alert("Ошибка");
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <form className="add-modal__content" onSubmit={onFormSubmit}>
        <div className="add-modal__header">
          <h3>Новая сделка</h3>
          <X size={18} onClick={onClose} className="add-modal__close-icon" />
        </div>

        {createError && (
          <p className="add-modal__error-message">{String(createError)}</p>
        )}

        <div className="add-modal__section">
          <label>Название сделки *</label>
          <input
            name="title"
            className="add-modal__input"
            value={form.title}
            onChange={onChange}
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Сумма *</label>
          <input
            name="amount"
            className="add-modal__input"
            value={form.amount}
            onChange={onChange}
            type="text"
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Статус *</label>
          <select
            name="kind"
            value={form.kind}
            onChange={onChange}
            className="add-modal__input"
            required
          >
            <option value="sale">Продажа</option>
            <option value="debt">Долг</option>
            <option value="prepayment">Предоплата</option>
          </select>
        </div>
        <div className="add-modal__section">
          <label>Комментарий *</label>
          <input
            name="note"
            className="add-modal__input"
            value={form.note}
            onChange={onChange}
            type="text"
            required
          />
        </div>
        <div className="add-modal__footer">
          <button
            onClick={onClose}
            type="button"
            disabled={creating}
            className="add-modal__cancel"
          >
            Отмена
          </button>
          <button
            type="submit"
            // onClick={handleSubmit}
            disabled={creating}
            className="add-modal__save"
          >
            {creating ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
};

function getSumsByKind(results) {
  return results.reduce((acc, item) => {
    const kind = item.kind;
    const amount = parseFloat(item.amount);

    if (!acc[kind]) acc[kind] = 0;
    acc[kind] += amount;

    return acc;
  }, {});
}

const ClientDetail = () => {
  const [showModal, setShowModal] = useState(false);
  const { client, clientDeals } = useClient();
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: client?.full_name || "",
    phone: client?.phone || "",
    status: client?.status || "",
    price: client?.price || "",
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // console.log(id);
  const statusOptions = [
    { value: "all", label: "Все" },
    { value: "new", label: "Новый" },
    { value: "contacted", label: "Контакт установлен" },
    { value: "interested", label: "Заинтересован" },
    { value: "converted", label: "Конвертирован" },
    { value: "inactive", label: "Неактивный" },
    { value: "paid_for", label: "оплачено" },
    { value: "awaiting", label: "ожидает" },
    { value: "credit", label: "долг" },
    { value: "rejection", label: "отказ" },
  ];

  function getStatusLabel(status) {
    const found = statusOptions.find((s) => s.value === status);
    return found ? found.label : status;
  }

  const sums = getSumsByKind(clientDeals);

  const kindTranslate = {
    debt: "Долг",
    sale: "Продажа",
    prepayment: "Предоплата",
  };

  const onFormSubmit = async () => {
    try {
      await dispatch(
        updateClientAsync({ clientId: client?.id, updatedData: formData })
      ).unwrap();
      setIsEditing(false);
      dispatch(getItemClient(id));
    } catch {
      alert("Ошибка обновления клиента");
    }
  };

  useEffect(() => {
    dispatch(getItemClient(id));
    dispatch(getClientDeals(id));
  }, [id]);
  return (
    <div className="clientDetail">
      <div className="clientDetail__back">
        <button
          onClick={() => navigate(-1)}
          className="clientDetail__back-button"
        >
          <ArrowLeft />
          Назад
        </button>

        <button
          className="clientDetail__add-deal"
          onClick={() => setShowModal(true)}
        >
          Быстрое добавления сделки
        </button>
      </div>
      <div className="clientDetail__head">
        <h2 className="clientDetail__head-title">
          Клиент # {client?.full_name}
        </h2>
      </div>
      <div className="row">
        <div className="clientDetail__data">
          <div className="clientDetail__data-item">
            <div>
              <p className="clientDetail__data-label">ФИО:</p>
              {isEditing ? (
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={onChange}
                />
              ) : (
                <p className="clientDetail__data-value">{client?.full_name}</p>
              )}
            </div>
          </div>

          <div className="clientDetail__data-item">
            <div>
              <p className="clientDetail__data-label">Телефон:</p>
              {isEditing ? (
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={onChange}
                />
              ) : (
                <p className="clientDetail__data-value">{client?.phone}</p>
              )}
            </div>
          </div>

          <div className="clientDetail__data-item">
            <div>
              <p className="clientDetail__data-label">Статус:</p>
              {isEditing ? (
                <input
                  type="text"
                  name="status"
                  value={getStatusLabel(client?.status)}
                  onChange={onChange}
                />
              ) : (
                <p className="clientDetail__data-value">
                  {getStatusLabel(client?.status)}
                </p>
              )}
            </div>
          </div>

          <div className="clientDetail__data-item">
            <div>
              <p className="clientDetail__data-label">Сумма покупки:</p>
              {isEditing ? (
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={onChange}
                />
              ) : (
                <p className="clientDetail__data-value">{client?.price} сом</p>
              )}
            </div>
            <button
              className="clientDetail__data-button"
              onClick={() => {
                setIsEditing((prev) => !prev);
                if (isEditing) {
                  onFormSubmit();
                } else {
                  setFormData({
                    full_name: client?.full_name || "",
                    phone: client?.phone || "",
                    status: client?.status || "",
                    price: client?.price || "",
                  });
                }
              }}
            >
              {isEditing ? "Сохранить" : "Редактировать"}
            </button>
          </div>
        </div>
        <div className="clientDetail__status">
          <div className="clientDetail__status-box credit">
            <p>Долги</p>
            <b>{sums.debt || 0} сом</b>
          </div>
          <div className="clientDetail__status-box sale">
            <p>Продажа</p>
            <b>{sums.sale || 0} сом</b>
          </div>
          <div className="clientDetail__status-box prepayment">
            <p>Предоплата</p>
            <b>{sums.prepayment || 0} сом</b>
          </div>
        </div>
      </div>
      <div className="clientDetail__dealsList">
        <h2 className="clientDetail__dealsList-title">Сделки</h2>

        <table className="clientDetail__dealsList-table sklad__table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Сумма</th>
              <th>Тип</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {clientDeals?.map((deal) => (
              <tr key={deal.id}>
                <td>{deal.title}</td>
                <td>
                  <b>{deal.amount} с</b>
                </td>
                <td>{kindTranslate[deal.kind] || deal.kind}</td>
                <td>{deal.note.length > 0 ? deal.note : "Нет комментария"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <AddModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default ClientDetail;
