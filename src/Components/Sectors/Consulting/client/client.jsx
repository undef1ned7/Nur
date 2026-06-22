// src/components/Clients/Clients.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./client.scss";
import { useDispatch } from "react-redux";
import {
  fetchClientsAsync,
  createClientAsync,
  updateClientAsync,
  deleteClientAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useNavigate } from "react-router-dom";
import { useConsulting } from "../../../../store/slices/consultingSlice";
import { getConsultingServices } from "../../../../store/creators/consultingThunk";
import { getProfile, useUser } from "../../../../store/slices/userSlice";

const fmtMoney = (v) => (Number(v) || 0).toLocaleString() + " с";

export default function ConsultingClients() {
  const dispatch = useDispatch();
  // ожидаем, что слайс уже кладёт results в list
  const { list: rows = [], loading = false, error: err = "" } = useClient();

  const [q, setQ] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    // при желании сюда можно передать параметры пагинации/поиска
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = (rows || []).slice();
    if (t) {
      base = base.filter((r) =>
        [r.full_name, r.phone, r.seller, r.service]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      );
    }
    return base.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
    );
  }, [rows, q]);

  const onCreate = () => {
    setEditId(null);
    setIsFormOpen(true);
  };
  const onEdit = (id) => {
    setEditId(id);
    setIsFormOpen(true);
  };

  const askDelete = (id) => setConfirmId(String(id));
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async (id) => {
    const idStr = String(id);
    setDeletingId(idStr);
    try {
      await dispatch(deleteClientAsync(id)).unwrap();
      // редьюсер должен убрать клиента из state.list; если нет — можно рефетчнуть:
      // await dispatch(fetchClientsAsync());
    } catch (e) {
      console.error(e);
      // тут можно показать тост/ошибку
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };
  const navigate = useNavigate();

  return (
    <section className="clients">
      <header className="clients__header">
        <div>
          <h2 className="clients__title">Клиенты</h2>
          <p className="clients__subtitle">Справочник (сервер)</p>
        </div>

        <div className="clients__actions">
          <div className="clients__search">
            <span className="clients__searchIcon" aria-hidden>
              🔎
            </span>
            <input
              className="clients__searchInput"
              placeholder="Поиск по имени, телефону, продавцу, услуге…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск клиентов"
            />
          </div>

          <button
            className="clients__btn clients__btn--primary"
            onClick={onCreate}
          >
            + Клиент
          </button>
        </div>
      </header>

      {!!err && <div className="clients__error">{String(err)}</div>}

      <div className="clients__tableWrap">
        <table className="clients__table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Дата</th>
              <th>Продавец</th>
              <th>Услуга</th>
              <th>Цена</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="clients__empty" colSpan={7}>
                  Загрузка…
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((c) => {
                const isConfirm = String(c.id) === String(confirmId);
                const isDeleting = String(c.id) === String(deletingId);
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/crm/consulting/client/${c.id}`)}
                  >
                    <td className="clients__ellipsis" title={c.full_name}>
                      {c.full_name || "—"}
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.date || "—"}</td>
                    <td className="clients__ellipsis" title={c.seller}>
                      {c.salesperson_display || "—"}
                    </td>
                    <td className="clients__ellipsis" title={c.service}>
                      {c.service_display || "—"}
                    </td>
                    <td>{fmtMoney(c.score)}</td>
                    <td
                      className="clients__rowActions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isConfirm ? (
                        <>
                          <span
                            className="clients__muted"
                            style={{ marginRight: 8 }}
                          >
                            Удалить?
                          </span>
                          <button
                            className="clients__btn"
                            onClick={() => doDelete(c.id)}
                            disabled={isDeleting}
                          >
                            Да
                          </button>
                          <button
                            className="clients__btn clients__btn--secondary"
                            onClick={cancelDelete}
                            disabled={isDeleting}
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="clients__btn"
                            onClick={() => onEdit(c.id)}
                          >
                            Изм.
                          </button>
                          <button
                            className="clients__btn clients__btn--secondary"
                            onClick={() => askDelete(c.id)}
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="clients__empty" colSpan={7}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <ClientForm id={editId} onClose={() => setIsFormOpen(false)} />
      )}
    </section>
  );
}

/* ===== форма клиента ===== */
const ClientForm = ({ id, onClose }) => {
  const dispatch = useDispatch();
  const { list: rows = [] } = useClient();
  const { profile } = useUser();
  const editing = !!id;
  const current = editing
    ? rows.find((c) => String(c.id) === String(id))
    : null;

  // базовые поля (всегда)
  const [full_name, setFullName] = useState(current?.full_name || "");
  const [phone, setPhone] = useState(current?.phone || "");

  // поля для создания и редактирования
  const [date, setDate] = useState(current?.date || "");
  const [salesperson, setSalesperson] = useState(current?.salesperson || "");
  const [salesperson_display, setSalespersonDisplay] = useState(
    current?.salesperson_display || ""
  );
  const [score, setScore] = useState(
    current?.score != null ? String(current.score) : ""
  );
  const [service, setService] = useState(current?.service || "");
  const [service_display, setServiceDisplay] = useState(
    current?.service_display || ""
  );
  const [price, setPrice] = useState(
    current?.price != null ? String(current.price) : ""
  );
  const { services: availableServices } = useConsulting();

  // Список доступных услуг (можно расширить)
  // const availableServices = [
  //   { id: "consulting", name: "Консультация", price: 500 },
  //   { id: "analysis", name: "Анализ", price: 1000 },
  //   { id: "planning", name: "Планирование", price: 1500 },
  //   { id: "implementation", name: "Внедрение", price: 2000 },
  //   { id: "support", name: "Поддержка", price: 300 },
  // ];

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Обработчик выбора услуги
  const handleServiceChange = (e) => {
    const selectedServiceId = e.target.value;
    const selectedService = availableServices.find(
      (s) => s.id === selectedServiceId
    );

    setService(selectedServiceId);
    setServiceDisplay(selectedService ? selectedService.name : "");

    // Автоматически заполняем цену
    if (selectedService) {
      setPrice(String(selectedService.price));
    }
  };

  // Обработчик изменения продавца (для автоматического заполнения display поля)
  const handleSalespersonChange = (e) => {
    const salespersonValue = e.target.value;
    setSalesperson(salespersonValue);
    // Можно добавить логику для автоматического заполнения display поля
    // если есть связь между ID и именем продавца
    if (!salesperson_display && salespersonValue) {
      setSalespersonDisplay(`Продавец #${salespersonValue}`);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    dispatch(getProfile());
    dispatch(getConsultingServices());
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const name = String(full_name || "").trim();
    if (!name) return setErr("Введите имя клиента.");
    if (name.length < 2 || name.length > 120)
      return setErr("Имя: 2–120 символов.");

    const dtoCreate = {
      full_name: name,
      phone: String(phone || "").trim(),
      salesperson: profile?.id,
      date: date,
      // salesperson_display: null,
      score: price === "" ? 0 : Number(String(price).replace(",", ".")) || 0,
      service: String(service || "").trim() || null,
      // service_display: null,
    };

    const dtoEdit = {
      full_name: name,
      phone: String(phone || "").trim(),
      date: date,
      salesperson: profile?.id,
      // salesperson_display: String(salesperson_display || "").trim() || null,
      score: price === "" ? 0 : Number(String(price).replace(",", ".")) || 0,
      service: String(service || "").trim() || null,
      // service_display: String(service_display || "").trim() || null,
      // price: ,
    };

    setSaving(true);
    try {
      if (editing) {
        await dispatch(
          updateClientAsync({ clientId: current.id, updatedData: dtoEdit })
        ).unwrap();
      } else {
        await dispatch(createClientAsync(dtoCreate)).unwrap();
      }
      onClose();
      // при необходимости можно рефетчить:
      // await dispatch(fetchClientsAsync());
    } catch (e2) {
      console.error(e2);
      setErr(
        (typeof e2 === "string" ? e2 : e2?.detail) ||
          "Не удалось сохранить клиента."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="clients__modalOverlay" onClick={onClose}>
      <div
        className="clients__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clients-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clients__modalHeader">
          <div id="clients-form-title" className="clients__modalTitle">
            {editing ? "Редактировать клиента" : "Новый клиент"}
          </div>
          <button
            className="clients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {!!err && (
          <div className="clients__error" style={{ marginTop: 8 }}>
            {err}
          </div>
        )}

        <form className="clients__form" onSubmit={submit}>
          <div className="clients__formGrid">
            <div className="clients__field">
              <label className="clients__label">Имя *</label>
              <input
                className="clients__input"
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="clients__field">
              <label className="clients__label">Телефон</label>
              <input
                className="clients__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+996700000000"
              />
            </div>

            <div className="clients__field">
              <label className="clients__label">Дата</label>
              <input
                type="date"
                className="clients__input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="clients__field">
              <label className="clients__label">Услуга</label>
              <select
                className="clients__input"
                value={service}
                onChange={handleServiceChange}
              >
                <option value="">-- Выберите услугу --</option>
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - {s.price} с
                  </option>
                ))}
              </select>
            </div>

            <div className="clients__field">
              <label className="clients__label">Цена, с</label>
              <input
                className="clients__input"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="clients__formActions">
            <button
              type="button"
              className="clients__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="clients__btn clients__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
