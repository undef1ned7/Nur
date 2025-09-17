import { MoreVertical, Plus, X } from "lucide-react";
import { useDispatch } from "react-redux";
import {
  useJobs,
  getJobs,
  createJob,
  updateJob, // ← убедитесь, что этот экшн есть в вашем jobsSlice
} from "../../../../store/slices/jobsSlice";
import { useEffect, useState } from "react";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import { getDepartments } from "../../../../store/creators/departmentCreators";
import { useDebounce } from "../../../../hooks/useDebounce";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";

/* ---------- helpers ---------- */
const toDate10 = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
    return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

/* ================= AddModal (создание) ================= */
const AddModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { departments } = useDepartments();
  const { list: contractorList } = useClient();
  const { loading: creating } = useJobs();

  const today = new Date().toISOString().slice(0, 10);

  const [state, setState] = useState({
    title: "",
    contractor_name: "",
    contractor_phone: "",
    contractor_entity_type: "llc",
    contractor_entity_name: "",
    amount: "",
    department: "",
    start_date: today,
    end_date: today,
    planned_completion_date: today,
    work_calendar_date: today,
    description: "",
  });
  const [showInputs, setShowInputs] = useState(false);

  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "contractor",
  });

  const contractors = (contractorList || []).filter(
    (c) => String(c.type).toLowerCase() === "contractor"
  );
  const [selectedContractorId, setSelectedContractorId] = useState("");

  useEffect(() => {
    dispatch(getDepartments());
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };
  const onChange = (e) => {
    const { name, value } = e.target;
    setNewClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleContractorSelect = (e) => {
    const id = e.target.value;
    setSelectedContractorId(id);
    const found = contractors.find((c) => String(c.id) === String(id));
    setState((prev) => ({
      ...prev,
      contractor_name: found?.full_name || "",
      contractor_phone: found?.phone || "",
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!state.title || !state.department || !state.amount) {
      alert("Заполните обязательные поля: Наименование, Отдел, Сумма");
      return;
    }
    try {
      await dispatch(createJob(state)).unwrap();
      dispatch(getJobs());
      onClose();
    } catch (err) {
      console.error(err);
      alert("Не удалось создать запись");
    }
  };

  const onClientSubmit = async () => {
    try {
      const created = await dispatch(createClientAsync(newClient)).unwrap();
      dispatch(fetchClientsAsync());
      setSelectedContractorId(String(created.id));
      setState((prev) => ({
        ...prev,
        contractor_name: created.full_name || "",
        contractor_phone: created.phone || "",
      }));
      setShowInputs(false);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Создание работы</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <form onSubmit={onSubmit}>
          <div className="add-modal__section">
            <label>Наименование договора *</label>
            <input
              name="title"
              className="add-modal__input"
              value={state.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Подрядчик (из списка)</label>
            <select
              className="add-modal__input"
              value={selectedContractorId}
              onChange={handleContractorSelect}
            >
              <option value="">-- Выберите подрядчика --</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="add-modal__section">
            <label>Имя подрядчика *</label>
            <input
              name="contractor_name"
              className="add-modal__input"
              value={state.contractor_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Телефон подрядчика</label>
            <input
              name="contractor_phone"
              className="add-modal__input"
              value={state.contractor_phone}
              onChange={handleChange}
              placeholder="+996 700 00-00-00"
            />
          </div>

          <button
            className="create-client"
            style={{ width: "100%", marginBottom: "10px" }}
            type="button"
            onClick={() => setShowInputs(!showInputs)}
          >
            {showInputs ? "Отменить" : "Создать подрядчика"}
          </button>
          {showInputs && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                rowGap: "10px",
              }}
              // onSubmit={onSubmit}
            >
              <input
                className="add-modal__input"
                onChange={onChange}
                type="text"
                placeholder="ФИО"
                name="full_name"
              />
              <input
                className="add-modal__input"
                onChange={onChange}
                type="text"
                name="phone"
                placeholder="Телефон"
              />
              <input
                className="add-modal__input"
                onChange={onChange}
                type="email"
                name="email"
                placeholder="Почта"
              />
              <button
                style={{ width: "100%", marginBottom: "10px" }}
                type="button"
                className="create-client"
                onClick={onClientSubmit}
              >
                Создать
              </button>
            </div>
          )}

          <div className="add-modal__section">
            <label>Тип юр.лица</label>
            <select
              name="contractor_entity_type"
              className="add-modal__input"
              value={state.contractor_entity_type}
              onChange={handleChange}
            >
              <option value="llc">ООО (llc)</option>
              <option value="sole_prop">ИП</option>
              <option value="individual">Физ. лицо</option>
              <option value="other">Другое</option>
            </select>
          </div>

          <div className="add-modal__section">
            <label>Название юр.лица</label>
            <input
              name="contractor_entity_name"
              className="add-modal__input"
              value={state.contractor_entity_name}
              onChange={handleChange}
              placeholder='Напр., ООО "СтройМир"'
            />
          </div>

          <div className="add-modal__section">
            <label>Отдел *</label>
            <select
              name="department"
              className="add-modal__input"
              value={state.department}
              onChange={handleChange}
              required
            >
              <option value="">-- Выберите отдел --</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="add-modal__section">
            <label>Сумма *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="amount"
              className="add-modal__input"
              value={state.amount}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Дата начала *</label>
            <input
              type="date"
              name="start_date"
              className="add-modal__input"
              value={state.start_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Дата конца *</label>
            <input
              type="date"
              name="end_date"
              className="add-modal__input"
              value={state.end_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Плановая дата завершения</label>
            <input
              type="date"
              name="planned_completion_date"
              className="add-modal__input"
              value={state.planned_completion_date}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__section">
            <label>Дата в календаре работ</label>
            <input
              type="date"
              name="work_calendar_date"
              className="add-modal__input"
              value={state.work_calendar_date}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__section">
            <label>Описание</label>
            <input
              name="description"
              className="add-modal__input"
              value={state.description}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__footer">
            <button
              className="add-modal__cancel"
              onClick={onClose}
              disabled={creating}
              type="button"
            >
              Отмена
            </button>
            <button
              className="add-modal__save"
              disabled={creating}
              type="submit"
            >
              {creating ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =============== ViewModal (детальный просмотр) =============== */
const ViewModal = ({ job, onClose }) => {
  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Просмотр работы</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="add-modal__section">
          <strong>Наименование:</strong> {job.title || job.name || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Подрядчик:</strong> {job.contractor_name || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Телефон подрядчика:</strong> {job.contractor_phone || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Тип юр.лица:</strong> {job.contractor_entity_type || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Юр.лицо:</strong> {job.contractor_entity_name || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Сумма:</strong> {job.amount || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Статус:</strong> {job.status || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Отдел:</strong> {job.department_name || job.department || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Дата начала:</strong> {toDate10(job.start_date) || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Дата конца:</strong> {toDate10(job.end_date) || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Плановая дата завершения:</strong>{" "}
          {toDate10(job.planned_completion_date) || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Дата в календаре работ:</strong>{" "}
          {toDate10(job.work_calendar_date) || "—"}
        </div>
        <div className="add-modal__section">
          <strong>Описание:</strong> {job.description || "—"}
        </div>

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

/* =============== EditModal (редактирование) =============== */
const EditModal = ({ job, onClose }) => {
  const dispatch = useDispatch();
  const { departments } = useDepartments();
  const { list: contractorList } = useClient();
  const { loading: creating } = useJobs();

  const contractors = (contractorList || []).filter(
    (c) => String(c.type).toLowerCase() === "contractor"
  );

  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [state, setState] = useState({
    title: job.title || job.name || "",
    contractor_name: job.contractor_name || "",
    contractor_phone: job.contractor_phone || "",
    contractor_entity_type: job.contractor_entity_type || "llc",
    contractor_entity_name: job.contractor_entity_name || "",
    amount: String(job.amount ?? ""),
    department: job.department || job.department_id || "",
    start_date: toDate10(job.start_date),
    end_date: toDate10(job.end_date),
    planned_completion_date: toDate10(job.planned_completion_date),
    work_calendar_date: toDate10(job.work_calendar_date),
    description: job.description || "",
    status: job.status || "new",
  });

  useEffect(() => {
    dispatch(getDepartments());
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleContractorSelect = (e) => {
    const id = e.target.value;
    setSelectedContractorId(id);
    const found = contractors.find((c) => String(c.id) === String(id));
    setState((prev) => ({
      ...prev,
      contractor_name: found?.full_name || "",
      contractor_phone: found?.phone || "",
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateJob({ id: job.id, data: state })).unwrap();
      dispatch(getJobs());
      onClose();
    } catch (err) {
      console.error(err);
      alert("Не удалось обновить запись");
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Редактирование работы</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <form onSubmit={onSubmit}>
          <div className="add-modal__section">
            <label>Наименование договора *</label>
            <input
              name="title"
              className="add-modal__input"
              value={state.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Подрядчик (из списка)</label>
            <select
              className="add-modal__input"
              value={selectedContractorId}
              onChange={handleContractorSelect}
            >
              <option value="">-- Выберите подрядчика --</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="add-modal__section">
            <label>Имя подрядчика *</label>
            <input
              name="contractor_name"
              className="add-modal__input"
              value={state.contractor_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Телефон подрядчика</label>
            <input
              name="contractor_phone"
              className="add-modal__input"
              value={state.contractor_phone}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__section">
            <label>Тип юр.лица</label>
            <select
              name="contractor_entity_type"
              className="add-modal__input"
              value={state.contractor_entity_type}
              onChange={handleChange}
            >
              <option value="llc">ООО (llc)</option>
              <option value="sole_prop">ИП</option>
              <option value="individual">Физ. лицо</option>
              <option value="other">Другое</option>
            </select>
          </div>

          <div className="add-modal__section">
            <label>Название юр.лица</label>
            <input
              name="contractor_entity_name"
              className="add-modal__input"
              value={state.contractor_entity_name}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__section">
            <label>Отдел *</label>
            <select
              name="department"
              className="add-modal__input"
              value={state.department}
              onChange={handleChange}
              required
            >
              <option value="">-- Выберите отдел --</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="add-modal__section">
            <label>Сумма *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="amount"
              className="add-modal__input"
              value={state.amount}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Статус</label>
            <select
              name="status"
              className="add-modal__input"
              value={state.status}
              onChange={handleChange}
            ></select>
          </div>

          <div className="add-modal__section">
            <label>Дата начала *</label>
            <input
              type="date"
              name="start_date"
              className="add-modal__input"
              value={state.start_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Дата конца *</label>
            <input
              type="date"
              name="end_date"
              className="add-modal__input"
              value={state.end_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Плановая дата завершения</label>
            <input
              type="date"
              name="planned_completion_date"
              className="add-modal__input"
              value={state.planned_completion_date}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__section">
            <label>Дата в календаре работ</label>
            <input
              type="date"
              name="work_calendar_date"
              className="add-modal__input"
              value={state.work_calendar_date}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__section">
            <label>Описание</label>
            <input
              name="description"
              className="add-modal__input"
              value={state.description}
              onChange={handleChange}
            />
          </div>

          <div className="add-modal__footer">
            <button
              className="add-modal__cancel"
              onClick={onClose}
              type="button"
            >
              Отмена
            </button>
            <button className="add-modal__save" type="submit">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ====================== Основной список ====================== */
const BuildingWork = () => {
  const dispatch = useDispatch();
  const { loading, list: history, error } = useJobs();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const kindTranslate = {
    new: "Новый",
    approved: "Одобренно",
    cancelled: "Отклонено",
  };

  const debouncedSearch = useDebounce((value) => {
    dispatch(getJobs({ search: value }));
  }, 1000);

  const onChangeSearch = (e) => debouncedSearch(e.target.value);
  const onChangeFilter = (e) => setStatusFilter(e.target.value);

  useEffect(() => {
    dispatch(getJobs());
  }, [dispatch]);

  const filteredHistory = (history || []).filter((item) =>
    statusFilter ? item.status === statusFilter : true
  );

  const openView = (job) => {
    setSelectedJob(job);
    setShowViewModal(true);
  };

  const openEdit = (job) => {
    setSelectedJob(job);
    setShowEditModal(true);
  };

  return (
    <div className="job">
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по названию"
            className="sklad__search"
            name="search"
            onChange={onChangeSearch}
          />
          <select
            className="employee__search-wrapper"
            value={statusFilter}
            onChange={onChangeFilter}
          >
            <option value={""}>Все</option>
            <option value={"new"}>в процессе</option>
            <option value={"approved"}>Завершен</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button className="sklad__add" onClick={() => setShowAddModal(true)}>
            <Plus size={16} style={{ marginRight: "4px" }} /> Добавить работу
          </button>
        </div>
      </div>

      {loading ? (
        <p className="sklad__loading-message">Загрузка…</p>
      ) : error ? (
        <p className="sklad__error-message">Ошибка загрузки</p>
      ) : filteredHistory.length === 0 ? (
        <p className="sklad__no-products-message">Нет доступных записей.</p>
      ) : (
        <div className="table-wrapper">
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th></th>
                <th>№</th>
                <th>Название</th>
                <th>Описание</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Действия</th> {/* новая колонка */}
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item, index) => (
                <tr key={item.id} style={{ cursor: "pointer" }}>
                  <td>
                    <input
                      onClick={(e) => e.stopPropagation()}
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <MoreVertical size={16} style={{ cursor: "pointer" }} />
                  </td>
                  <td>{index + 1}</td>
                  <td>{item.title || item.name || "Нет названия"}</td>
                  <td>{item.description}</td>
                  <td>{item.amount}</td>
                  <td>{kindTranslate[item.status] || item.status}</td>
                  <td>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="add-modal__cancel"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openView(item);
                      }}
                      style={{ marginRight: 8 }}
                    >
                      Просмотр
                    </button>
                    <button
                      className="add-modal__save"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      Редактировать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && <AddModal onClose={() => setShowAddModal(false)} />}

      {showViewModal && selectedJob && (
        <ViewModal job={selectedJob} onClose={() => setShowViewModal(false)} />
      )}

      {showEditModal && selectedJob && (
        <EditModal job={selectedJob} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
};

export default BuildingWork;
