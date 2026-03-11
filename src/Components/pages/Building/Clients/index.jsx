import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  fetchBuildingSuppliers,
  deleteBuildingSupplier,
} from "@/store/creators/building/suppliersCreators";
import {
  fetchBuildingContractors,
  deleteBuildingContractor,
} from "@/store/creators/building/contractorsCreators";
import { useBuildingSuppliers } from "@/store/slices/building/suppliersSlice";
import { useBuildingContractors } from "@/store/slices/building/contractorsSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import BuildingActionsMenu from "../shared/ActionsMenu";
import ClientsTab from "./ClientsTab";
import SuppliersTab from "./SuppliersTab";
import ContractorsTab from "./ContractorsTab";
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
  CARDS: "cards",
  TABLE: "table",
};

const MAIN_TAB_CLIENTS = "clients";
const MAIN_TAB_SUPPLIERS = "suppliers";
const MAIN_TAB_CONTRACTORS = "contractors";

const STORAGE_KEY = "building_clients_view_mode";

export default function BuildingClients() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const {
    list: suppliers,
    loading: suppliersLoading,
    error: suppliersError,
  } = useBuildingSuppliers();

  const {
    list: contractors,
    loading: contractorsLoading,
    error: contractorsError,
  } = useBuildingContractors();

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

  const initialMainTab = (() => {
    const t = searchParams.get("tab");
    if (t === MAIN_TAB_SUPPLIERS || t === MAIN_TAB_CONTRACTORS) return t;
    return MAIN_TAB_CLIENTS;
  })();
  const [mainTab, setMainTab] = useState(initialMainTab);

  const handleMainTabChange = (nextTab) => {
    setMainTab(nextTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === MAIN_TAB_CLIENTS) {
          next.delete("tab");
        } else {
          next.set("tab", nextTab);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedProjectId || mainTab !== MAIN_TAB_CLIENTS) return;
    dispatch(
      fetchBuildingClients({
        residential_complex: selectedProjectId,
        search: search.trim() || undefined,
        is_active: onlyActive ? true : undefined,
      }),
    );
  }, [dispatch, selectedProjectId, search, onlyActive, mainTab]);

  useEffect(() => {
    if (mainTab !== MAIN_TAB_SUPPLIERS) return;
    dispatch(fetchBuildingSuppliers());
  }, [dispatch, mainTab]);

  useEffect(() => {
    if (mainTab !== MAIN_TAB_CONTRACTORS) return;
    dispatch(fetchBuildingContractors());
  }, [dispatch, mainTab]);

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
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">
            {mainTab === MAIN_TAB_SUPPLIERS
              ? "Поставщики"
              : mainTab === MAIN_TAB_CONTRACTORS
              ? "Подрядчики"
              : "Клиенты"}
          </h1>
          <p className="sell-header__subtitle">
            {mainTab === MAIN_TAB_CLIENTS ? (
              selectedProjectId ? (
                <>
              Список
                  клиентов по объекту
                </>
              ) : (
                "Выберите жилой комплекс в шапке раздела"
              )
            ) : mainTab === MAIN_TAB_SUPPLIERS ? (
              "Список поставщиков строительного модуля."
            ) : (
              "Список подрядчиков и субподрядчиков."
            )}
          </p>
        </div>
        {mainTab === MAIN_TAB_CLIENTS && (
          <button
            type="button"
            className="sell-header__btn"
            disabled={!selectedProjectId}
            onClick={openCreate}
          >
            Добавить клиента
          </button>
        )}
        {mainTab === MAIN_TAB_SUPPLIERS && (
          <button
            type="button"
            className="sell-header__btn"
            onClick={() => navigate("/crm/building/clients/suppliers/new")}
          >
            Добавить поставщика
          </button>
        )}
        {mainTab === MAIN_TAB_CONTRACTORS && (
          <button
            type="button"
            className="sell-header__btn"
            onClick={() =>
              navigate("/crm/building/clients/contractors/new")
            }
          >
            Добавить подрядчика
          </button>
        )}
      </header>

      <div className="client-detail__tabs">
        <button
          type="button"
          className={
            mainTab === MAIN_TAB_CLIENTS
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleMainTabChange(MAIN_TAB_CLIENTS)}
        >
          Клиенты
        </button>
        <button
          type="button"
          className={
            mainTab === MAIN_TAB_SUPPLIERS
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleMainTabChange(MAIN_TAB_SUPPLIERS)}
        >
          Поставщики
        </button>
        <button
          type="button"
          className={
            mainTab === MAIN_TAB_CONTRACTORS
              ? "client-detail__tab client-detail__tab--active"
              : "client-detail__tab"
          }
          onClick={() => handleMainTabChange(MAIN_TAB_CONTRACTORS)}
        >
          Подрядчики
        </button>
      </div>

      {mainTab === MAIN_TAB_CLIENTS && <ClientsTab />}

      {false && mainTab === MAIN_TAB_CLIENTS && !selectedProjectId && (
        <div className="sell-empty-hint">
          <span className="sell-empty-hint__icon">👥</span>
          <p className="sell-empty-hint__text">
            Выберите ЖК в шапке — откроется список клиентов с поиском и
            фильтрами.
          </p>
        </div>
      )}

   
      {mainTab === MAIN_TAB_SUPPLIERS && <SuppliersTab />}
      {mainTab === MAIN_TAB_CONTRACTORS && <ContractorsTab />}

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
