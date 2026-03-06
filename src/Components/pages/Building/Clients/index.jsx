import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Table2 } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import {
  fetchBuildingClients,
  createBuildingClient,
  updateBuildingClient,
  deleteBuildingClient,
} from "../../../../store/creators/building/clientsCreators";
import { useBuildingClients } from "../../../../store/slices/building/clientsSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import BuildingActionsMenu from "../shared/ActionsMenu";
import "./Clients.scss";

const FORM_INITIAL = {
  name: "",
  phone: "",
  email: "",
  inn: "",
  address: "",
  notes: "",
  is_active: true,
};

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

const STORAGE_KEY = "building_clients_view_mode";

export default function BuildingClients() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const {
    list,
    loading,
    error,
    creating,
    updatingId,
    createError,
    updatingError,
    deletingId,
  } = useBuildingClients();

  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [formError, setFormError] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingClients({
        residential_complex: selectedProjectId,
        search: search.trim() || undefined,
        is_active: onlyActive ? true : undefined,
      }),
    );
  }, [dispatch, selectedProjectId, search, onlyActive]);

  const openCreate = () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    setEditing(null);
    setForm(FORM_INITIAL);
    setFormError(null);
    setOpenModal(true);
  };

  const openEdit = (client) => {
    setEditing(client);
    setForm({
      name: client?.name || "",
      phone: client?.phone || "",
      email: client?.email || "",
      inn: client?.inn || "",
      address: client?.address || "",
      notes: client?.notes || "",
      is_active: client?.is_active ?? true,
    });
    setFormError(null);
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(FORM_INITIAL);
    setFormError(null);
  };

  const handleFormChange = (key) => (e) => {
    const value = key === "is_active" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    if (!String(form.name || "").trim()) {
      setFormError("Имя / название обязательно");
      return;
    }

    try {
      let res;
      if (editing) {
        const id = editing?.id ?? editing?.uuid;
        if (!id) return;
        res = await dispatch(updateBuildingClient({ id, data: form }));
      } else {
        res = await dispatch(createBuildingClient(form));
      }
      if (res.meta.requestStatus === "fulfilled") {
        alert(editing ? "Клиент обновлён" : "Клиент создан");
        closeModal();
        dispatch(
          fetchBuildingClients({
            residential_complex: selectedProjectId,
            search: search.trim() || undefined,
            is_active: onlyActive ? true : undefined,
          }),
        );
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить клиента",
          ),
        );
      }
    } catch (err) {
      setFormError(validateResErrors(err, "Не удалось сохранить клиента"));
    }
  };

  const handleDelete = (client) => {
    const id = client?.id ?? client?.uuid;
    if (!id) return;
    confirm(`Удалить клиента «${client?.name || "без имени"}»?`, async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(deleteBuildingClient(id));
        if (res.meta.requestStatus === "fulfilled") {
          alert("Клиент удалён");
          dispatch(
            fetchBuildingClients({
              residential_complex: selectedProjectId,
              search: search.trim() || undefined,
              is_active: onlyActive ? true : undefined,
            }),
          );
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              "Не удалось удалить клиента",
            ),
            true,
          );
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось удалить клиента"), true);
      }
    });
  };

  const effectiveList = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    if (!search.trim() && onlyActive) return arr;
    return arr.filter((c) => {
      if (onlyActive && !c.is_active) return false;
      if (!search.trim()) return true;
      const hay =
        `${c.name || ""} ${c.phone || ""} ${c.email || ""} ${c.inn || ""}`
          .toLowerCase()
          .trim();
      return hay.includes(search.toLowerCase().trim());
    });
  }, [list, search, onlyActive]);

  const totalClients = Array.isArray(list) ? list.length : 0;
  const filteredCount = Array.isArray(effectiveList) ? effectiveList.length : 0;

  return (
    <div className="building-page building-page--clients">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">Клиенты</h1>
          <p className="sell-header__subtitle">
            {selectedProjectId ? (
              <>
                ЖК <strong>{selectedProjectName}</strong> · Поиск и список
                клиентов по объекту
              </>
            ) : (
              "Выберите жилой комплекс в шапке раздела"
            )}
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Добавить клиента
        </button>
      </header>

      {!selectedProjectId && (
        <div className="sell-empty-hint">
          <span className="sell-empty-hint__icon">👥</span>
          <p className="sell-empty-hint__text">
            Выберите ЖК в шапке — откроется список клиентов с поиском и
            фильтрами.
          </p>
        </div>
      )}

      {selectedProjectId && (
        <div className="sell-card clients-card">
          <div className="sell-toolbar clients-toolbar">
            <div className="clients-toolbar__search-wrap">
              <input
                className="clients-toolbar__search"
                value={search}
                placeholder="Поиск по имени, телефону, email, ИНН"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="clients-toolbar__meta">
              <span className="clients-toolbar__count">
                {filteredCount} из {totalClients} клиентов
              </span>
              <div className="clients-toolbar__view">
                <button
                  type="button"
                  className={`clients-toolbar__viewBtn${viewMode === VIEW_MODES.TABLE ? " clients-toolbar__viewBtn--active" : ""}`}
                  onClick={() => setViewMode(VIEW_MODES.TABLE)}
                >
                  <Table2 size={16} />
                  Таблица
                </button>
                <button
                  type="button"
                  className={`clients-toolbar__viewBtn${viewMode === VIEW_MODES.CARDS ? " clients-toolbar__viewBtn--active" : ""}`}
                  onClick={() => setViewMode(VIEW_MODES.CARDS)}
                >
                  <LayoutGrid size={16} />
                  Карточки
                </button>
              </div>
              <label className="clients-toolbar__check">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                Только активные
              </label>
            </div>
          </div>

          {error && (
            <div className="building-page__error" style={{ marginBottom: 12 }}>
              {String(validateResErrors(error, "Не удалось загрузить клиентов"))}
            </div>
          )}

          {loading && effectiveList.length === 0 ? (
            <div className="sell-loading">
              <div className="sell-loading__spinner" />
              <p className="sell-loading__text">Загрузка клиентов...</p>
            </div>
          ) : !loading && effectiveList.length === 0 ? (
            <div className="sell-empty">
              <p className="sell-empty__text">Клиентов пока нет.</p>
            </div>
          ) : viewMode === VIEW_MODES.TABLE ? (
            <div className="clients-table-wrap">
              <table className="clients-table">
                <thead>
                  <tr>
                    <th>Имя / название</th>
                    <th>Телефон</th>
                    <th>Email</th>
                    <th>ИНН</th>
                    <th>Адрес</th>
                    <th>Статус</th>
                    <th className="clients-table__actionsCol">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveList.map((c) => {
                    const id = c?.id ?? c?.uuid;
                    const busyDelete = id != null && deletingId === id;
                    const busyUpdate = id != null && updatingId === id;
                    const busy = busyDelete || busyUpdate;
                    return (
                      <tr
                        key={id}
                        className="clients-table__row"
                        onClick={() =>
                          id && navigate(`/crm/building/clients/${id}`)
                        }
                      >
                        <td>{c?.name || "—"}</td>
                        <td>{c?.phone || "—"}</td>
                        <td>{c?.email || "—"}</td>
                        <td>{c?.inn || "—"}</td>
                        <td>{c?.address || "—"}</td>
                        <td
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c?.is_active ? (
                            <span className="clients-table__status clients-table__status--active">
                              Активен
                            </span>
                          ) : (
                            <span className="clients-table__status clients-table__status--inactive">
                              Отключён
                            </span>
                          )}
                        </td>
                        <td
                          className="clients-table__actionsCol"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BuildingActionsMenu
                            actions={[
                              {
                                label: "Изменить",
                                onClick: () => openEdit(c),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(c),
                                disabled: busy,
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="clients-grid">
              {effectiveList.map((c) => {
                const id = c?.id ?? c?.uuid;
                const busyDelete = id != null && deletingId === id;
                const busyUpdate = id != null && updatingId === id;
                const busy = busyDelete || busyUpdate;
                return (
                  <div
                    key={id}
                    className="clients-grid__card"
                    onClick={() =>
                      id && navigate(`/crm/building/clients/${id}`)
                    }
                  >
                    <div className="clients-grid__cardHead">
                      <div className="clients-grid__cardName">
                        {c?.name || "—"}
                      </div>
                      <div
                        className="clients-grid__cardMeta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c?.is_active ? (
                          <span className="clients-table__status clients-table__status--active">
                            Активен
                          </span>
                        ) : (
                          <span className="clients-table__status clients-table__status--inactive">
                            Отключён
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="clients-grid__cardBody">
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">Телефон</span>
                        {c?.phone || "—"}
                      </div>
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">Email</span>
                        {c?.email || "—"}
                      </div>
                      {c?.inn && (
                        <div className="clients-grid__cardRow">
                          <span className="clients-grid__cardLabel">ИНН</span>
                          {c.inn}
                        </div>
                      )}
                      {c?.address && (
                        <div className="clients-grid__cardRow clients-grid__cardRow--address">
                          <span className="clients-grid__cardLabel">Адрес</span>
                          {c.address}
                        </div>
                      )}
                      {c?.notes && (
                        <p className="clients-grid__cardNotes">{c.notes}</p>
                      )}
                    </div>
                    <div
                      className="clients-grid__cardActions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="clients-grid__cardBtn"
                        disabled={busy}
                        onClick={() => openEdit(c)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="clients-grid__cardBtn clients-grid__cardBtn--danger"
                        disabled={busy}
                        onClick={() => handleDelete(c)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(createError || updatingError) && (
            <div className="building-page__error" style={{ marginTop: 12 }}>
              {String(
                validateResErrors(
                  createError || updatingError,
                  "Ошибка при сохранении клиента",
                ),
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить клиента" : "Добавить клиента"}
      >
        <form className="sell-form" onSubmit={handleSubmit}>
          <section className="sell-form__section">
            <h4 className="sell-form__sectionTitle">Основное</h4>
            <label>
              <div className="sell-form__label">Имя / название *</div>
              <input
                className="building-page__input"
                value={form.name}
                onChange={handleFormChange("name")}
                placeholder="ОсОО Ромашка"
                required
              />
            </label>
            <label>
              <div className="sell-form__label">Телефон</div>
              <input
                className="building-page__input"
                value={form.phone}
                onChange={handleFormChange("phone")}
                placeholder="+996 700 000 000"
              />
            </label>
            <label>
              <div className="sell-form__label">Email</div>
              <input
                type="email"
                className="building-page__input"
                value={form.email}
                onChange={handleFormChange("email")}
                placeholder="info@example.com"
              />
            </label>
            <label>
              <div className="sell-form__label">ИНН</div>
              <input
                className="building-page__input"
                value={form.inn}
                onChange={handleFormChange("inn")}
                placeholder="123456789"
              />
            </label>
          </section>
          <section className="sell-form__section">
            <h4 className="sell-form__sectionTitle">Дополнительно</h4>
            <label>
              <div className="sell-form__label">Адрес</div>
              <input
                className="building-page__input"
                value={form.address}
                onChange={handleFormChange("address")}
                placeholder="г. Бишкек, ..."
              />
            </label>
            <label>
              <div className="sell-form__label">Заметки</div>
              <textarea
                className="building-page__input building-page__textarea"
                rows={3}
                value={form.notes}
                onChange={handleFormChange("notes")}
                placeholder="Постоянный клиент"
              />
            </label>
            <label className="clients-form__activeCheck">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={handleFormChange("is_active")}
              />
              <span>Активный клиент</span>
            </label>
          </section>
          {formError && (
            <div className="building-page__error">{String(formError)}</div>
          )}
          <div className="sell-form__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeModal}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={creating}
            >
              {creating ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
