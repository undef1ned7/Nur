import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
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

const FORM_INITIAL = {
  name: "",
  phone: "",
  email: "",
  inn: "",
  address: "",
  notes: "",
  is_active: true,
};

export default function BuildingClients() {
  const dispatch = useDispatch();
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

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

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

  return (
    <div className="building-page building-page--clients">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Клиенты строительства</h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Список клиентов по объекту с
            поиском и фильтрами.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Добавить клиента
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters">
          <input
            className="building-page__input"
            value={search}
            placeholder="Поиск по имени, телефону, email, ИНН"
            onChange={(e) => setSearch(e.target.value)}
          />
          <label
            className="building-page__muted"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Только активные
          </label>
        </div>
        {error && (
          <div className="building-page__error">
            {String(validateResErrors(error, "Не удалось загрузить клиентов"))}
          </div>
        )}
      </div>

      <div className="building-page__card">
        {(!selectedProjectId || loading) && (
          <div className="building-page__muted">
            {!selectedProjectId
              ? "Выберите жилой комплекс в шапке раздела."
              : "Загрузка..."}
          </div>
        )}
        {selectedProjectId && !loading && effectiveList.length === 0 && (
          <div className="building-page__muted">Клиентов пока нет.</div>
        )}
        {selectedProjectId && !loading && effectiveList.length > 0 && (
          <div className="building-table building-table--shadow">
            <table>
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
                {effectiveList.map((c) => {
                  const id = c?.id ?? c?.uuid;
                  const busyDelete = id != null && deletingId === id;
                  const busyUpdate = id != null && updatingId === id;
                  const busy = busyDelete || busyUpdate;
                  return (
                    <tr key={id}>
                      <td>{c?.name || "—"}</td>
                      <td>{c?.phone || "—"}</td>
                      <td>{c?.email || "—"}</td>
                      <td>{c?.inn || "—"}</td>
                      <td>{c?.address || "—"}</td>
                      <td>
                        {c?.is_active ? (
                          <span className="building-page__status">Активен</span>
                        ) : (
                          <span className="building-page__status is-danger">
                            Отключён
                          </span>
                        )}
                      </td>
                      <td>
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
