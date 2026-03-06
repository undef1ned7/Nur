import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Table2 } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
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
    <div className="warehouse-page building-page building-page--clients">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">👥</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Клиенты строительства</h1>
            <p className="warehouse-header__subtitle">
              ЖК: <b>{selectedProjectName}</b>. Список клиентов по объекту с
              поиском и фильтрами.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Добавить клиента
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по имени, телефону, email, ИНН"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            {selectedProjectId
              ? `Найдено ${filteredCount} из ${totalClients} клиентов`
              : "Выберите жилой комплекс в шапке раздела."}
          </span>
          <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.TABLE
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <Table2 size={16} />
              Таблица
            </button>

            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.CARDS)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                ${
                  viewMode === VIEW_MODES.CARDS
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
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
        <div className="mt-2 text-sm text-red-500">
          {String(validateResErrors(error, "Не удалось загрузить клиентов"))}
        </div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {viewMode === VIEW_MODES.TABLE ? (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Имя / название</th>
                  <th>Телефон</th>
                  <th>Email</th>
                  <th>ИНН</th>
                  <th>Адрес</th>
                  <th>Статус</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {!selectedProjectId ? (
                  <tr>
                    <td colSpan={7} className="warehouse-table__empty">
                      Выберите жилой комплекс в шапке раздела.
                    </td>
                  </tr>
                ) : loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : !loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="warehouse-table__empty">
                      Клиентов пока нет.
                    </td>
                  </tr>
                ) : (
                  effectiveList.map((c) => {
                    const id = c?.id ?? c?.uuid;
                    const busyDelete = id != null && deletingId === id;
                    const busyUpdate = id != null && updatingId === id;
                    const busy = busyDelete || busyUpdate;
                    return (
                      <tr
                        key={id}
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
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {c?.is_active ? (
                            <span className="building-page__status">
                              Активен
                            </span>
                          ) : (
                            <span className="building-page__status is-danger">
                              Отключён
                            </span>
                          )}
                        </td>
                        <td
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
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
                  })
                )}
              </tbody>
            </table>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите жилой комплекс в шапке раздела.
                </div>
              ) : loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__loading">Загрузка...</div>
              ) : !loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__empty">Клиентов пока нет.</div>
              ) : (
                effectiveList.map((c) => {
                  const id = c?.id ?? c?.uuid;
                  const busyDelete = id != null && deletingId === id;
                  const busyUpdate = id != null && updatingId === id;
                  const busy = busyDelete || busyUpdate;

                  return (
                    <div
                      key={id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                      onClick={() =>
                        id && navigate(`/crm/building/clients/${id}`)
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {c?.name || "—"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                            <div>{c?.phone || "—"}</div>
                            <div>{c?.email || "—"}</div>
                            <div>ИНН: {c?.inn || "—"}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {c?.is_active ? (
                              <span className="building-page__status">
                                Активен
                              </span>
                            ) : (
                              <span className="building-page__status is-danger">
                                Отключён
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {c?.address && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                          <span className="font-medium">Адрес: </span>
                          {c.address}
                        </div>
                      )}
                      {c?.notes && (
                        <div className="mt-2 text-xs text-slate-500">
                          {c.notes}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="px-3 cursor-pointer py-2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed w-1/2"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(c);
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="px-3 cursor-pointer py-2 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed w-1/2"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {(createError || updatingError) && (
            <div className="building-page__error" style={{ marginTop: 8 }}>
              {String(
                validateResErrors(
                  createError || updatingError,
                  "Ошибка при сохранении клиента",
                ),
              )}
            </div>
          )}
        </div>
      </DataContainer>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить клиента" : "Добавить клиента"}
      >
        <form className="building-page" onSubmit={handleSubmit}>
          <label>
            <div className="building-page__label">Имя / название *</div>
            <input
              className="building-page__input"
              value={form.name}
              onChange={handleFormChange("name")}
              placeholder="ОсОО Ромашка"
              required
            />
          </label>
          <label>
            <div className="building-page__label">Телефон</div>
            <input
              className="building-page__input"
              value={form.phone}
              onChange={handleFormChange("phone")}
              placeholder="+996700000000"
            />
          </label>
          <label>
            <div className="building-page__label">Email</div>
            <input
              type="email"
              className="building-page__input"
              value={form.email}
              onChange={handleFormChange("email")}
              placeholder="info@example.com"
            />
          </label>
          <label>
            <div className="building-page__label">ИНН</div>
            <input
              className="building-page__input"
              value={form.inn}
              onChange={handleFormChange("inn")}
              placeholder="123456789"
            />
          </label>
          <label>
            <div className="building-page__label">Адрес</div>
            <input
              className="building-page__input"
              value={form.address}
              onChange={handleFormChange("address")}
              placeholder="г. Бишкек, ..."
            />
          </label>
          <label>
            <div className="building-page__label">Заметки</div>
            <textarea
              className="building-page__textarea"
              rows={3}
              value={form.notes}
              onChange={handleFormChange("notes")}
              placeholder="Постоянный клиент"
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={handleFormChange("is_active")}
            />
            <span className="building-page__label">Активный клиент</span>
          </label>
          {formError && (
            <div className="building-page__error">{String(formError)}</div>
          )}
          <div className="building-page__actions">
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
