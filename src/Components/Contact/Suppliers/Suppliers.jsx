import { MoreVertical, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import { clearClients, useClient } from "../../../store/slices/ClientSlice"; // 👈 регистр тот же, что в store
// import ContactClient from "../../Contact/ContactClient/ContactClient";
// import "./Clients.scss"; // 🔄 подключаем тот же SCSS, что и у Employee

/* ---------- AddModal ---------- */
const AddModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { creating, createError } = useSelector((s) => s.client);
  // const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    date: "",
    email: "",
    phone: "",
    status: "new",
  });

  const paymentSchedule = [
    {
      month: "Август 2025",
      date: "30.08.2025",
      principal: 5000,
      interest: 800,
      total: 5800,
      remainingDebt: 45000,
    },
    {
      month: "Сентябрь 2025",
      date: "30.09.2025",
      principal: 5000,
      interest: 700,
      total: 5700,
      remainingDebt: 40000,
    },
  ];

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const { full_name, phone, status } = form;
    if (!full_name || !phone || !status) return alert("Заполните все поля.");
    try {
      const response = await dispatch(
        createClientAsync({ ...form, type: "suppliers" })
      ).unwrap();
      onClose();
      navigate(`/crm/clients/${response.id}`);
      // console.log(response);
    } catch {
      alert("Ошибка добавления клиента");
    }
  };
  // console.log(form.status);

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Новый клиент</h3>
          <X size={18} onClick={onClose} className="add-modal__close-icon" />
        </div>

        {createError && (
          <p className="add-modal__error-message">{String(createError)}</p>
        )}

        <div className="add-modal__section">
          <label>ФИО *</label>
          <input
            name="full_name"
            className="add-modal__input"
            value={form.full_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Дата *</label>
          <input
            name="date"
            className="add-modal__input"
            value={form.date}
            onChange={handleChange}
            type="date"
            required
          />
        </div>

        <div className="add-modal__section">
          <label>Телефон *</label>
          <input
            className="add-modal__input"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
          />
        </div>
        {/* {form.status == "credit" && (
          <div className="add-modal__credit">
            <table className="add-modal__table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Основной долг</th>
                  <th>Проценты</th>
                  <th>Платёж</th>
                  <th>Остаток долга</th>
                </tr>
              </thead>
              <tbody>
                {paymentSchedule.map((item, index) => (
                  <tr key={index}>
                    <td>{item.date}</td>
                    <td>{item.principal} KGS</td>
                    <td>{item.interest} KGS</td>
                    <td>{item.total} KGS</td>
                    <td>{item.remainingDebt} KGS</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <LineChart
              width={600}
              style={{ margin: "0 auto" }}
              height={300}
              data={paymentSchedule}
            >
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey="remainingDebt"
                stroke="#8884d8"
                name="Остаток долга"
              />
            </LineChart>
          </div>
        )} */}
        <div className="add-modal__section">
          <label>Почта</label>
          <input
            name="email"
            className="add-modal__input"
            value={form.email}
            onChange={handleChange}
            type="email"
            required
          />
        </div>
        <div className="add-modal__section">
          <label>Статус *</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="add-modal__input"
            required
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="add-modal__footer">
          <button
            onClick={onClose}
            disabled={creating}
            className="add-modal__cancel"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            className="add-modal__save"
          >
            {creating ? "Добавление..." : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Suppliers = ({ hideStatus = false }) => {
  const dispatch = useDispatch();
  const {
    list: clients,
    loading,
    error,
    count,
    next,
    previous,
    deleting,
    updating,
    creating,
  } = useClient();
  const [selectFilter, setSelectFilter] = useState([]);
  const [selectValue, setSelectValue] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const [params, setParams] = useState({
    search: "",
    type: "suppliers",
  });
  useEffect(() => {
    dispatch(fetchClientsAsync({ page, ...params }));
    return () => dispatch(clearClients());
  }, [dispatch, page, params, creating, updating, deleting]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setParams((p) => ({ ...p, [name]: value }));
  };
  const perPage = clients.length || 10;
  const pagesTotal = count ? Math.ceil(count / perPage) : 1;

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
  const navigate = useNavigate();

  const filter =
    selectValue === "all"
      ? clients
      : clients.filter((item) => item.status === selectValue);
  return (
    <div>
      <div className="employee__top">
        <div className="employee__search">
          <div className="employee__search-wrapper">
            <Search size={16} className="employee__search-icon" />
            <input
              className="employee__search-input"
              placeholder="Поиск"
              name="search"
              value={params.search}
              onChange={onChange}
            />
            {params.search && (
              <X
                size={16}
                className="employee__clear-search"
                onClick={() => setParams((p) => ({ ...p, search: "" }))}
              />
            )}
          </div>
          {!hideStatus && (
            <select
              className="employee__search-wrapper"
              onChange={(e) => setSelectValue(e.target.value)}
            >
              {statusOptions.map((status, index) => (
                <option key={index} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="employee__top-buttons">
          <button className="employee__export">Экспорт</button>
          <button className="employee__add" onClick={() => setShowAdd(true)}>
            <Plus size={16} style={{ marginRight: 4 }} /> Добавить поставщика
          </button>
        </div>
      </div>
      {/* table */}
      {loading ? (
        <p className="employee__loading-message">Загрузка клиентов…</p>
      ) : error ? (
        <p className="employee__error-message">{String(error)}</p>
      ) : clients.length === 0 ? (
        <p className="employee__no-employees-message">Нет клиентов.</p>
      ) : (
        <div className="table-wrapper">
          <table className="employee__table">
            <thead>
              <tr>
                <th>№</th>
                <th>ФИО</th>
                <th>Телефон</th>
                {!hideStatus && <th>Статус</th>}
                {/* <th></th> */}
              </tr>
            </thead>
            <tbody>
              {filter.map((c, idx) => (
                <tr
                  style={{ cursor: "pointer" }}
                  key={c.id}
                  onClick={() => navigate(`/crm/clients/${c.id}`)}
                >
                  <td>{(page - 1) * perPage + idx + 1}</td>
                  <td className="employee__name">{c.full_name}</td>
                  <td>{c.phone}</td>
                  {!hideStatus && (
                    <td>
                      {statusOptions.find((i) => i.value === c.status)?.label ||
                        ""}
                    </td>
                  )}
                  {/* <td>
                    <MoreVertical
                      size={18}
                      onClick={() => {
                        setSelected(c);
                        setShowEdit(true);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* pagination */}
      <div className="employee__pagination">
        <button
          onClick={() => previous && setPage(page - 1)}
          disabled={!previous}
        >
          ←
        </button>
        <span>
          {page} из {pagesTotal}
        </span>
        <button onClick={() => next && setPage(page + 1)} disabled={!next}>
          →
        </button>
      </div>
      {/* modals */}
      {/* {showEdit && selected && (
        <EditModal client={selected} onClose={() => setShowEdit(false)} />
      )} */}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  );
};

export default Suppliers;
