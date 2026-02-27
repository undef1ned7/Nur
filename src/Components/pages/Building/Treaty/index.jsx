import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import {
  fetchBuildingTreaties,
  createBuildingTreaty,
  updateBuildingTreaty,
  deleteBuildingTreaty,
  createBuildingTreatyInErp,
  createBuildingTreatyFile,
} from "../../../../store/creators/building/treatiesCreators";
import { fetchBuildingClients } from "../../../../store/creators/building/clientsCreators";
import { useBuildingTreaties } from "../../../../store/slices/building/treatiesSlice";
import { useBuildingClients } from "../../../../store/slices/building/clientsSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import BuildingActionsMenu from "../shared/ActionsMenu";

const STATUS_LABELS = {
  draft: "Черновик",
  active: "Активен",
  cancelled: "Отменён",
  completed: "Завершён",
};

const ERP_LABELS = {
  not_configured: "ERP не настроена",
  pending: "Ожидает",
  success: "Создано в ERP",
  error: "Ошибка ERP",
};

const FORM_INITIAL = {
  residential_complex: "",
  client: "",
  number: "",
  title: "",
  description: "",
  amount: "",
  status: "draft",
  auto_create_in_erp: false,
};

export default function BuildingTreaty() {
  const dispatch = useDispatch();
  const alert = useAlert();
  const confirm = useConfirm();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const { list: clientsList } = useBuildingClients();
  const {
    list,
    loading,
    error,
    creating,
    updatingId,
    createError,
    updatingError,
    erpCreatingId,
    erpError,
    deletingId,
  } = useBuildingTreaties();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [erpFilter, setErpFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [formError, setFormError] = useState(null);

  const [fileModalTreaty, setFileModalTreaty] = useState(null);
  const [fileForm, setFileForm] = useState({ file: null, title: "" });
  const [fileUploadError, setFileUploadError] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);

  const [createAttachment, setCreateAttachment] = useState({
    file: null,
    title: "",
  });

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const complexesOptions = useMemo(
    () => (Array.isArray(projects) ? projects : []),
    [projects],
  );
  const clientsOptions = useMemo(
    () => (Array.isArray(clientsList) ? clientsList : []),
    [clientsList],
  );

  const fetchParams = useMemo(
    () => ({
      residential_complex: selectedProjectId || undefined,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      erp_sync_status: erpFilter || undefined,
    }),
    [selectedProjectId, search, statusFilter, erpFilter],
  );

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingTreaties(fetchParams));
  }, [
    dispatch,
    selectedProjectId,
    fetchParams.search,
    fetchParams.status,
    fetchParams.erp_sync_status,
  ]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingClients({ residential_complex: selectedProjectId }));
  }, [dispatch, selectedProjectId]);

  const effectiveList = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    if (!search.trim() && !statusFilter && !erpFilter) return arr;
    return arr.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (erpFilter && t.erp_sync_status !== erpFilter) return false;
      if (!search.trim()) return true;
      const hay = `${t.number || ""} ${t.title || ""} ${t.description || ""} ${
        t.client_name || ""
      } ${t.residential_complex_name || ""}`
        .toLowerCase()
        .trim();
      return hay.includes(search.toLowerCase().trim());
    });
  }, [list, search, statusFilter, erpFilter]);

  const openCreate = () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    setEditing(null);
    setForm({
      ...FORM_INITIAL,
      residential_complex: selectedProjectId,
    });
    setCreateAttachment({ file: null, title: "" });
    setFormError(null);
    setOpenModal(true);
  };

  const openEdit = (treaty) => {
    setEditing(treaty);
    setForm({
      residential_complex: treaty?.residential_complex || "",
      client: treaty?.client || "",
      number: treaty?.number || "",
      title: treaty?.title || "",
      description: treaty?.description || "",
      amount: treaty?.amount || "",
      status: treaty?.status || "draft",
      auto_create_in_erp: treaty?.auto_create_in_erp ?? false,
    });
    setFormError(null);
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(FORM_INITIAL);
    setCreateAttachment({ file: null, title: "" });
    setFormError(null);
  };

  const handleFormChange = (key) => (e) => {
    const value =
      key === "auto_create_in_erp" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    if (
      !form.residential_complex ||
      !form.client ||
      !String(form.title || "").trim()
    ) {
      setFormError("Заполните ЖК, клиента и наименование договора");
      return;
    }

    const payload = {
      ...form,
      amount: form.amount ? String(form.amount) : undefined,
    };

    try {
      let res;
      if (editing) {
        const id = editing?.id ?? editing?.uuid;
        if (!id) return;
        res = await dispatch(updateBuildingTreaty({ id, data: payload }));
      } else {
        res = await dispatch(createBuildingTreaty(payload));
      }
      if (res.meta.requestStatus === "fulfilled") {
        const newTreaty = res.payload;
        const newId = newTreaty?.id ?? newTreaty?.uuid;
        if (!editing && createAttachment.file && newId) {
          const fileRes = await dispatch(
            createBuildingTreatyFile({
              treatyId: newId,
              file: createAttachment.file,
              title: createAttachment.title || undefined,
            }),
          );
          if (fileRes.meta.requestStatus === "fulfilled") {
            alert("Договор создан, файл прикреплён");
          } else {
            alert("Договор создан. Не удалось прикрепить файл.", true);
          }
        } else {
          alert(editing ? "Договор обновлён" : "Договор создан");
        }
        closeModal();
        dispatch(fetchBuildingTreaties(fetchParams));
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить договор",
          ),
        );
      }
    } catch (err) {
      setFormError(validateResErrors(err, "Не удалось сохранить договор"));
    }
  };

  const handleErpCreate = (treaty) => {
    const id = treaty?.id ?? treaty?.uuid;
    if (!id) return;
    confirm("Отправить договор на создание в ERP?", async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(createBuildingTreatyInErp(id));
        if (res.meta.requestStatus === "fulfilled") {
          alert("Договор отправлен в ERP");
          dispatch(fetchBuildingTreaties(fetchParams));
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              "Не удалось отправить договор в ERP",
            ),
            true,
          );
        }
      } catch (e) {
        alert(validateResErrors(e, "Не удалось отправить договор в ERP"), true);
      }
    });
  };

  const openFileModal = (treaty) => {
    setFileModalTreaty(treaty);
    setFileForm({ file: null, title: "" });
    setFileUploadError(null);
  };

  const closeFileModal = () => {
    setFileModalTreaty(null);
    setFileForm({ file: null, title: "" });
    setFileUploadError(null);
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!fileModalTreaty) return;
    const id = fileModalTreaty?.id ?? fileModalTreaty?.uuid;
    if (!id || !fileForm.file) {
      setFileUploadError("Выберите файл");
      return;
    }
    setFileUploadError(null);
    setFileUploading(true);
    try {
      const res = await dispatch(
        createBuildingTreatyFile({
          treatyId: id,
          file: fileForm.file,
          title: fileForm.title || undefined,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Файл прикреплён");
        closeFileModal();
      } else {
        setFileUploadError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось загрузить файл",
          ),
        );
      }
    } catch (err) {
      setFileUploadError(validateResErrors(err, "Не удалось загрузить файл"));
    } finally {
      setFileUploading(false);
    }
  };

  const handleDelete = (treaty) => {
    const id = treaty?.id ?? treaty?.uuid;
    if (!id) return;
    confirm(
      `Удалить договор «${treaty?.title || treaty?.number || "договор"}»?`,
      async (ok) => {
        if (!ok) return;
        try {
          const res = await dispatch(deleteBuildingTreaty(id));
          if (res.meta.requestStatus === "fulfilled") {
            alert("Договор удалён");
            dispatch(fetchBuildingTreaties(fetchParams));
          } else {
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось удалить договор",
              ),
              true,
            );
          }
        } catch (err) {
          alert(validateResErrors(err, "Не удалось удалить договор"), true);
        }
      },
    );
  };

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Договоры строительства</h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>. Реестр договоров с фильтрами и
            ERP-синхронизацией.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Новый договор
        </button>
      </div>

      <div className="building-page__card">
        <div className="building-page__filters building-page__filters--3">
          <input
            className="building-page__input"
            value={search}
            placeholder="Поиск по номеру, названию, описанию, клиенту, ЖК"
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="building-page__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Статус: все</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="building-page__select"
            value={erpFilter}
            onChange={(e) => setErpFilter(e.target.value)}
          >
            <option value="">ERP: все</option>
            {Object.entries(ERP_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="building-page__error">
            {String(validateResErrors(error, "Не удалось загрузить договоры"))}
          </div>
        )}
        {erpError && (
          <div className="building-page__error">
            ERP: {String(validateResErrors(erpError, "Ошибка ERP"))}
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
          <div className="building-page__muted">Договоров пока нет.</div>
        )}
        {selectedProjectId && !loading && effectiveList.length > 0 && (
          <div className="building-table building-table--shadow">
            <table>
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Название</th>
                  <th>ЖК</th>
                  <th>Клиент</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>ERP</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {effectiveList.map((t) => {
                  const id = t?.id ?? t?.uuid;
                  const erpBusy = id != null && erpCreatingId === id;
                  const busyUpdate = id != null && updatingId === id;
                  const busyDelete = id != null && deletingId === id;
                  const busy = erpBusy || busyUpdate || busyDelete;
                  const erpStatus = t?.erp_sync_status || "none";
                  return (
                    <tr key={id}>
                      <td>{t?.number || "—"}</td>
                      <td>{t?.title || "—"}</td>
                      <td>
                        {t?.residential_complex_name ||
                          t?.residential_complex ||
                          "—"}
                      </td>
                      <td>{t?.client_name || t?.client || "—"}</td>
                      <td>{t?.amount ?? "—"}</td>
                      <td>
                        <span className="building-page__status">
                          {STATUS_LABELS[t?.status] || t?.status || "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`building-page__status ${
                            erpStatus === "success"
                              ? "is-success"
                              : erpStatus === "error"
                                ? "is-danger"
                                : erpStatus === "pending"
                                  ? "is-warning"
                                  : ""
                          }`}
                        >
                          {ERP_LABELS[t?.erp_sync_status] || "—"}
                        </span>
                      </td>
                      <td>
                        <BuildingActionsMenu
                          actions={[
                            {
                              label: "Изменить",
                              onClick: () => openEdit(t),
                              disabled: busy,
                            },
                            {
                              label: "Прикрепить файл",
                              onClick: () => openFileModal(t),
                              disabled: busy,
                            },
                            {
                              label: "В ERP",
                              onClick: () => handleErpCreate(t),
                              disabled: busy || erpBusy,
                            },
                            {
                              label: "Удалить",
                              onClick: () => handleDelete(t),
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
                "Ошибка при сохранении договора",
              ),
            )}
          </div>
        )}
      </div>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить договор" : "Новый договор"}
      >
        <form className="building-page" onSubmit={handleSubmit}>
          <label>
            <div className="building-page__label">ЖК *</div>
            <select
              className="building-page__select"
              value={form.residential_complex}
              onChange={handleFormChange("residential_complex")}
              required
            >
              <option value="">Выберите ЖК</option>
              {complexesOptions.map((c) => (
                <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                  {c.name || "—"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Клиент *</div>
            <select
              className="building-page__select"
              value={form.client}
              onChange={handleFormChange("client")}
              required
            >
              <option value="">Выберите клиента</option>
              {clientsOptions.map((c) => (
                <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                  {c.name || "—"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Номер договора</div>
            <input
              className="building-page__input"
              value={form.number}
              onChange={handleFormChange("number")}
              placeholder="ДГ-001"
            />
          </label>
          <label>
            <div className="building-page__label">Наименование *</div>
            <input
              className="building-page__input"
              value={form.title}
              onChange={handleFormChange("title")}
              placeholder="Договор подряда"
              required
            />
          </label>
          <label>
            <div className="building-page__label">Описание</div>
            <textarea
              className="building-page__textarea"
              rows={3}
              value={form.description}
              onChange={handleFormChange("description")}
              placeholder="Условия договора..."
            />
          </label>
          <label>
            <div className="building-page__label">Сумма</div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="building-page__input"
              value={form.amount}
              onChange={handleFormChange("amount")}
              placeholder="150000.00"
            />
          </label>
          <label>
            <div className="building-page__label">Статус</div>
            <select
              className="building-page__select"
              value={form.status}
              onChange={handleFormChange("status")}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.auto_create_in_erp}
              onChange={handleFormChange("auto_create_in_erp")}
            />
            <span className="building-page__label">
              Создавать договор в ERP автоматически
            </span>
          </label>
          {!editing && (
            <>
              <div className="building-page__label" style={{ marginTop: 8 }}>
                Прикрепить файл (необязательно)
              </div>
              <label>
                <div className="building-page__label">Файл</div>
                <input
                  type="file"
                  className="building-page__input"
                  onChange={(e) =>
                    setCreateAttachment((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] ?? null,
                    }))
                  }
                />
              </label>
              <label>
                <div className="building-page__label">Название файла</div>
                <input
                  type="text"
                  className="building-page__input"
                  value={createAttachment.title}
                  onChange={(e) =>
                    setCreateAttachment((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Например: Скан договора"
                />
              </label>
            </>
          )}
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

      <Modal
        open={Boolean(fileModalTreaty)}
        onClose={closeFileModal}
        title="Прикрепить файл к договору"
      >
        <form className="building-page" onSubmit={handleFileSubmit}>
          <label>
            <div className="building-page__label">Файл *</div>
            <input
              type="file"
              className="building-page__input"
              onChange={(e) =>
                setFileForm((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] ?? null,
                }))
              }
              required
            />
          </label>
          <label>
            <div className="building-page__label">Название (необязательно)</div>
            <input
              type="text"
              className="building-page__input"
              value={fileForm.title}
              onChange={(e) =>
                setFileForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Например: Скан договора"
            />
          </label>
          {fileUploadError && (
            <div className="building-page__error">
              {String(fileUploadError)}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeFileModal}
              disabled={fileUploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={fileUploading || !fileForm.file}
            >
              {fileUploading ? "Загрузка..." : "Прикрепить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
