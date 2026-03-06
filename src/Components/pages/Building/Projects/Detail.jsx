import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import Modal from "@/Components/common/Modal/Modal";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingApartments } from "@/store/slices/building/apartmentsSlice";
import { useDepartments } from "@/store/slices/departmentSlice";
import { getEmployees } from "@/store/creators/departmentCreators";
import api from "../../../../api";
import {
  fetchBuildingApartments,
  createBuildingApartment,
  updateBuildingApartment,
  deleteBuildingApartment,
  fetchBuildingResidentialFloors,
} from "@/store/creators/building/apartmentsCreators";
import { updateBuildingProject } from "@/store/creators/building/projectsCreators";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import BuildingPagination from "../shared/Pagination";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asCurrency } from "../shared/constants";
import BuildingActionsMenu from "../shared/ActionsMenu";
import { MapPin, FileText, Building2, ArrowLeft } from "lucide-react";
import "./Detail.scss";

const APARTMENT_INITIAL = {
  floor: "",
  number: "",
  rooms: "",
  area: "",
  price: "",
  status: "available",
  notes: "",
};

const APARTMENT_STATUS_LABELS = {
  available: "Доступна",
  reserved: "Забронирована",
  sold: "Продана",
};

export default function BuildingProjectDetail() {
  const { id } = useParams();
  const residentialId = id ? String(id) : null;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alert = useAlert();
  const confirm = useConfirm();

  const { items: projects } = useBuildingProjects();
  const { employees = [], loading: employeesLoading } = useDepartments();
  const {
    list,
    count,
    loading,
    error,
    creating,
    updatingIds,
    deletingIds,
    actionError,
    floors,
    floorsLoading,
    floorsError,
  } = useBuildingApartments();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [floor, setFloor] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(APARTMENT_INITIAL);
  const [formError, setFormError] = useState(null);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [addingMemberId, setAddingMemberId] = useState("");

  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxesLoading, setCashboxesLoading] = useState(false);
  const [cashboxesError, setCashboxesError] = useState(null);
  const [salaryCashboxId, setSalaryCashboxId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count],
  );

  const project = useMemo(() => {
    if (!residentialId) return null;
    const list = Array.isArray(projects) ? projects : [];
    return (
      list.find((p) => String(p?.id ?? p?.uuid) === String(residentialId)) ||
      null
    );
  }, [projects, residentialId]);

  const memberUserIds = useMemo(
    () => new Set((members || []).map((m) => String(m.user))),
    [members],
  );

  const availableEmployees = useMemo(
    () =>
      (employees || []).filter(
        (e) => !memberUserIds.has(String(e.id ?? e.uuid)),
      ),
    [employees, memberUserIds],
  );

  useEffect(() => {
    if (!residentialId) return;
    dispatch(fetchBuildingResidentialFloors(residentialId));
  }, [dispatch, residentialId]);

  useEffect(() => {
    if (!employees || employees.length === 0) {
      dispatch(getEmployees());
    }
  }, [dispatch, employees]);

  useEffect(() => {
    if (!project) return;
    setSalaryCashboxId(project.salary_cashbox ?? "");
  }, [project]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!residentialId) return;
      setMembersLoading(true);
      setMembersError(null);
      try {
        const { data } = await api.get(
          `/building/objects/${residentialId}/members/`,
        );
        setMembers(Array.isArray(data) ? data : []);
      } catch (err) {
        setMembersError(
          err?.response?.data ||
            err?.message ||
            "Не удалось загрузить сотрудников ЖК",
        );
      } finally {
        setMembersLoading(false);
      }
    };
    loadMembers();
  }, [residentialId]);

  useEffect(() => {
    const loadCashboxes = async () => {
      setCashboxesLoading(true);
      setCashboxesError(null);
      try {
        const { data } = await api.get("/construction/cashboxes/");
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        setCashboxes(list);
      } catch (err) {
        setCashboxesError(
          err?.response?.data || err?.message || "Не удалось загрузить кассы",
        );
      } finally {
        setCashboxesLoading(false);
      }
    };

    loadCashboxes();
  }, []);

  useEffect(() => {
    if (!residentialId) return;
    const params = {
      residential_complex: residentialId,
      status: status || undefined,
      floor: floor || undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    };
    dispatch(fetchBuildingApartments(params));
  }, [dispatch, residentialId, status, floor, debouncedSearch, page]);

  const handleBack = () => {
    navigate("/crm/building/projects");
  };

  const handleFormChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    if (!residentialId) {
      alert("Не удалось определить ЖК", true);
      return;
    }
    setEditing(null);
    setForm({
      ...APARTMENT_INITIAL,
      floor: floors?.[0]?.floor ?? "",
    });
    setFormError(null);
    setOpenModal(true);
  };

  const openEdit = (apartment) => {
    setEditing(apartment);
    setForm({
      floor: apartment?.floor ?? "",
      number: apartment?.number ?? "",
      rooms: apartment?.rooms ?? "",
      area: apartment?.area ?? "",
      price: apartment?.price ?? "",
      status: apartment?.status ?? "available",
      notes: apartment?.notes ?? "",
    });
    setFormError(null);
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(APARTMENT_INITIAL);
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!residentialId) {
      alert("Не удалось определить ЖК", true);
      return;
    }
    if (!String(form.number || "").trim()) {
      setFormError("Номер квартиры обязателен");
      return;
    }
    const payload = {
      residential_complex: residentialId,
      floor: form.floor || null,
      number: String(form.number || "").trim(),
      rooms: form.rooms || null,
      area: form.area || null,
      price: form.price || null,
      status: form.status || "available",
      notes: form.notes || "",
    };
    try {
      let res;
      if (editing) {
        const aptId = editing?.id ?? editing?.uuid;
        if (!aptId) return;
        res = await dispatch(updateBuildingApartment({ id: aptId, payload }));
      } else {
        res = await dispatch(createBuildingApartment(payload));
      }
      if (res.meta.requestStatus === "fulfilled") {
        alert(editing ? "Квартира обновлена" : "Квартира добавлена");
        closeModal();
        setPage(1);
        dispatch(
          fetchBuildingApartments({
            residential_complex: residentialId,
            status: status || undefined,
            floor: floor || undefined,
            search: debouncedSearch || undefined,
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
          }),
        );
        dispatch(fetchBuildingResidentialFloors(residentialId));
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить квартиру",
          ),
        );
      }
    } catch (err) {
      setFormError(validateResErrors(err, "Не удалось сохранить квартиру"));
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!residentialId) {
      alert("Не удалось определить ЖК", true);
      return;
    }
    setSavingSettings(true);
    try {
      const res = await dispatch(
        updateBuildingProject({
          id: residentialId,
          data: { salary_cashbox: salaryCashboxId || null },
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Настройки ЖК сохранены");
        const from = searchParams.get("from");
        const payrollId = searchParams.get("payrollId");
        if (from === "salary-payroll" && payrollId) {
          navigate(`/crm/building/salary/payroll/${payrollId}`);
        }
      } else {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить настройки ЖК",
          ),
          true,
        );
      }
    } catch (err) {
      alert(validateResErrors(err, "Не удалось сохранить настройки ЖК"), true);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = (apartment) => {
    const aptId = apartment?.id ?? apartment?.uuid;
    if (!aptId) return;
    confirm(
      `Удалить квартиру «${apartment?.number || "квартира"}»?`,
      async (ok) => {
        if (!ok) return;
        try {
          const res = await dispatch(deleteBuildingApartment(aptId));
          if (res.meta.requestStatus === "fulfilled") {
            alert("Квартира удалена");
            dispatch(
              fetchBuildingApartments({
                residential_complex: residentialId,
                status: status || undefined,
                floor: floor || undefined,
                search: debouncedSearch || undefined,
                page,
                page_size: DEFAULT_PAGE_SIZE,
              }),
            );
            dispatch(fetchBuildingResidentialFloors(residentialId));
          } else {
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось удалить квартиру",
              ),
              true,
            );
          }
        } catch (err) {
          alert(validateResErrors(err, "Не удалось удалить квартиру"), true);
        }
      },
    );
  };

  const busyIds = useMemo(
    () =>
      new Set([
        ...Object.keys(updatingIds || {}),
        ...Object.keys(deletingIds || {}),
      ]),
    [updatingIds, deletingIds],
  );

  return (
    <div className="add-product-page project-detail">
      <div className="add-product-page__header">
        <button
          type="button"
          className="add-product-page__back"
          onClick={handleBack}
        >
          <ArrowLeft size={18} />К списку проектов
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">{project?.name || "ЖК"}</h1>
            <p className="add-product-page__subtitle">
              Управление квартирами, сотрудниками и настройками жилого
              комплекса.
            </p>
            {project?.address && (
              <p
                className="add-product-page__subtitle"
                style={{
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPin size={14} />
                {project.address}
              </p>
            )}
            {project?.description && (
              <p
                className="add-product-page__subtitle"
                style={{
                  marginTop: 2,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <FileText size={14} style={{ marginTop: 2 }} />
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="project-detail__header-actions">
          <button
            type="button"
            className="add-product-page__cancel-btn"
            onClick={handleBack}
          >
            Назад к списку
          </button>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={openCreate}
            disabled={!residentialId}
          >
            Добавить квартиру
          </button>
        </div>
      </div>

      <div className="add-product-page__content">
        <div className="add-product-page__section">
          <div className="add-product-page__section-header">
            <div className="add-product-page__section-number">1</div>
            <h3 className="add-product-page__section-title">Настройки ЖК</h3>
          </div>
          {cashboxesLoading && (
            <div className="project-detail__muted">Загрузка касс...</div>
          )}
          {cashboxesError && (
            <div className="add-product-page__error">
              {String(
                validateResErrors(
                  cashboxesError,
                  "Не удалось загрузить список касс",
                ),
              )}
            </div>
          )}
          {!cashboxesLoading && !cashboxesError && (
            <form onSubmit={handleSaveSettings}>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Касса для ЗП по ЖК
                </label>
                <select
                  className="add-product-page__input"
                  value={salaryCashboxId || ""}
                  onChange={(e) => setSalaryCashboxId(e.target.value)}
                >
                  <option value="">Не выбрана</option>
                  {cashboxes.map((box) => {
                    const bid = box.id ?? box.uuid;
                    if (!bid) return null;
                    const label =
                      box.name ||
                      box.title ||
                      box.display ||
                      box.label ||
                      `Касса ${bid}`;
                    return (
                      <option key={bid} value={bid}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <span className="add-product-page__hint">
                  Из этой кассы будут выплачиваться ЗП сотрудникам, работающим
                  на этом ЖК.
                </span>
              </div>
              <div className="add-product-page__actions">
                <button
                  type="submit"
                  className="add-product-page__submit-btn"
                  disabled={savingSettings}
                >
                  {savingSettings ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="add-product-page__section">
          <div className="add-product-page__section-header">
            <div className="add-product-page__section-number">2</div>
            <h3 className="add-product-page__section-title">
              Сотрудники, назначенные на ЖК
            </h3>
          </div>
          {membersLoading && (
            <div className="project-detail__muted">
              Загрузка сотрудников ЖК...
            </div>
          )}
          {membersError && (
            <div className="add-product-page__error">
              {String(
                validateResErrors(
                  membersError,
                  "Не удалось загрузить сотрудников ЖК",
                ),
              )}
            </div>
          )}
          {!membersLoading && !membersError && (
            <>
              {members.length === 0 ? (
                <div className="project-detail__muted">
                  Пока никто не назначен на этот ЖК.
                </div>
              ) : (
                <ul className="project-detail__list">
                  {members.map((m) => {
                    const emp =
                      employees.find(
                        (e) => String(e.id ?? e.uuid) === String(m.user),
                      ) || {};
                    const fullName =
                      [emp.first_name, emp.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      emp.display ||
                      emp.name ||
                      emp.email ||
                      m.user_display ||
                      "Сотрудник";
                    return (
                      <li key={m.user} className="project-detail__list-item">
                        <span>{fullName}</span>
                        <button
                          type="button"
                          className="add-product-page__cancel-btn"
                          onClick={async () => {
                            try {
                              await api.delete(
                                `/building/objects/${residentialId}/members/${m.user}/`,
                              );
                              setMembers((prev) =>
                                prev.filter(
                                  (x) => String(x.user) !== String(m.user),
                                ),
                              );
                            } catch (err) {
                              alert(
                                validateResErrors(
                                  err,
                                  "Не удалось снять сотрудника",
                                ),
                                true,
                              );
                            }
                          }}
                        >
                          Снять
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!residentialId || !addingMemberId) return;
                  try {
                    await api.post(
                      `/building/objects/${residentialId}/members/`,
                      { user: addingMemberId, is_active: true },
                    );
                    setMembers((prev) => [
                      ...prev,
                      { user: addingMemberId, is_active: true },
                    ]);
                    setAddingMemberId("");
                  } catch (err) {
                    alert(
                      validateResErrors(err, "Не удалось назначить сотрудника"),
                      true,
                    );
                  }
                }}
                style={{ marginTop: 12 }}
              >
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">
                    Назначить сотрудника на ЖК
                  </label>
                  <select
                    className="add-product-page__input"
                    value={addingMemberId}
                    onChange={(e) => setAddingMemberId(e.target.value)}
                  >
                    <option value="">Выберите сотрудника</option>
                    {availableEmployees.map((e) => {
                      const fullName =
                        [e.first_name, e.last_name].filter(Boolean).join(" ") ||
                        e.display ||
                        e.name ||
                        e.email ||
                        "—";
                      return (
                        <option key={e.id ?? e.uuid} value={e.id ?? e.uuid}>
                          {fullName}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div
                  className="add-product-page__actions"
                  style={{ marginTop: 8 }}
                >
                  <button
                    type="submit"
                    className="add-product-page__submit-btn"
                    disabled={!addingMemberId}
                  >
                    Назначить
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="add-product-page__section">
          <div className="add-product-page__section-header">
            <div className="add-product-page__section-number">3</div>
            <h3 className="add-product-page__section-title">Этажи</h3>
          </div>
          {floorsLoading && (
            <div className="project-detail__muted">Загрузка этажей...</div>
          )}
          {floorsError && (
            <div className="add-product-page__error">
              {String(
                validateResErrors(floorsError, "Не удалось загрузить этажи"),
              )}
            </div>
          )}
          {!floorsLoading && !floorsError && floors.length === 0 && (
            <div className="project-detail__muted">
              Информация по этажам пока недоступна.
            </div>
          )}
          {!floorsLoading && !floorsError && floors.length > 0 && (
            <div className="project-detail__floors">
              {floors.map((f) => (
                <div
                  key={f.floor}
                  className={`project-detail__floor-card${String(floor) === String(f.floor) ? " project-detail__floor-card--active" : ""}`}
                  onClick={() => {
                    setPage(1);
                    setFloor(String(f.floor));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPage(1);
                      setFloor(String(f.floor));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="project-detail__floor-title">
                    Этаж {f.floor}
                  </div>
                  <div className="project-detail__floor-stats">
                    <span>Всего: {f.total}</span>
                    <span>Свободно: {f.available}</span>
                    <span>Бронь: {f.reserved}</span>
                    <span>Продано: {f.sold}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="add-product-page__section">
          <div className="add-product-page__section-header mt-4">
            <div className="add-product-page__section-number">4</div>
            <h3 className="add-product-page__section-title">Квартиры</h3>
          </div>
          <div className="project-detail__filters">
            <input
              className="add-product-page__input"
              value={search}
              placeholder="Поиск по номеру/комментарию"
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <select
              className="add-product-page__input"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">Все статусы</option>
              {Object.entries(APARTMENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="add-product-page__error">
              {String(
                validateResErrors(error, "Не удалось загрузить список квартир"),
              )}
            </div>
          )}
          {loading && (
            <div className="project-detail__muted">Загрузка квартир...</div>
          )}
          {!loading && list.length === 0 && (
            <div className="project-detail__muted">
              Квартиры ещё не добавлены.
            </div>
          )}
          {!loading && list.length > 0 && (
            <div className="project-detail__table-wrap">
              <table className="project-detail__table">
                <thead>
                  <tr>
                    <th>Этаж</th>
                    <th>Номер</th>
                    <th>Комнат</th>
                    <th>Площадь, м²</th>
                    <th>Цена</th>
                    <th>Статус</th>
                    <th>Примечание</th>
                    <th style={{ width: 80 }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((apt) => {
                    const aptId = apt?.id ?? apt?.uuid;
                    const busy = busyIds.has(String(aptId));
                    return (
                      <tr key={aptId}>
                        <td>{apt?.floor ?? "—"}</td>
                        <td>{apt?.number ?? "—"}</td>
                        <td>{apt?.rooms ?? "—"}</td>
                        <td>{apt?.area ?? "—"}</td>
                        <td>{asCurrency(apt?.price)}</td>
                        <td>
                          {APARTMENT_STATUS_LABELS[apt?.status] ||
                            apt?.status ||
                            "—"}
                        </td>
                        <td>{apt?.notes || ""}</td>
                        <td>
                          <BuildingActionsMenu
                            actions={[
                              {
                                label: "Изменить",
                                onClick: () => openEdit(apt),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(apt),
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
          <BuildingPagination
            page={page}
            totalPages={totalPages}
            disabled={loading}
            onChange={setPage}
          />
          {actionError && (
            <div className="add-product-page__error" style={{ marginTop: 8 }}>
              {String(
                validateResErrors(
                  actionError,
                  "Ошибка при сохранении/удалении квартиры",
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить квартиру" : "Добавить квартиру"}
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleSubmit}
        >
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Этаж</label>
            <input
              className="add-product-page__input"
              value={form.floor}
              onChange={handleFormChange("floor")}
              type="number"
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Номер квартиры</label>
            <input
              className="add-product-page__input"
              value={form.number}
              onChange={handleFormChange("number")}
              required
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Комнат</label>
            <input
              className="add-product-page__input"
              value={form.rooms}
              onChange={handleFormChange("rooms")}
              type="number"
              min={0}
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Площадь, м²</label>
            <input
              className="add-product-page__input"
              value={form.area}
              onChange={handleFormChange("area")}
              type="number"
              min={0}
              step="0.01"
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Цена</label>
            <input
              className="add-product-page__input"
              value={form.price}
              onChange={handleFormChange("price")}
              type="number"
              min={0}
              step="0.01"
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Статус</label>
            <select
              className="add-product-page__input"
              value={form.status}
              onChange={handleFormChange("status")}
            >
              {Object.entries(APARTMENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Примечание</label>
            <textarea
              className="add-product-page__input"
              rows={3}
              value={form.notes}
              onChange={handleFormChange("notes")}
              style={{ resize: "vertical" }}
            />
          </div>
          {formError && (
            <div className="add-product-page__error">{String(formError)}</div>
          )}
          <div className="add-product-page__actions">
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={closeModal}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
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
