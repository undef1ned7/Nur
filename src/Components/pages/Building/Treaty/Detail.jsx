import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import {
  createBuildingTreaty,
  updateBuildingTreaty,
  fetchBuildingTreatyById,
  createBuildingTreatyFile,
} from "../../../../store/creators/building/treatiesCreators";
import { fetchBuildingClients } from "../../../../store/creators/building/clientsCreators";
import { fetchBuildingApartments } from "../../../../store/creators/building/apartmentsCreators";
import { useBuildingTreaties } from "../../../../store/slices/building/treatiesSlice";
import { useBuildingClients } from "../../../../store/slices/building/clientsSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { useBuildingApartments } from "../../../../store/slices/building/apartmentsSlice";
import InstallmentPaymentsModal from "./InstallmentPaymentsModal";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./Detail.scss";

const STATUS_LABELS = {
  draft: "Черновик",
  active: "Активен",
  signed: "Подписан",
  cancelled: "Отменён",
};

const OPERATION_TYPE_LABELS = {
  sale: "Продажа",
  booking: "Бронь",
};

const PAYMENT_TYPE_LABELS = {
  full: "Полная оплата",
  installment: "Рассрочка",
};

const FORM_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

const getFileUrl = (file) => String(file?.file_url || file?.file || "");

const getFileExtension = (url) => {
  if (!url) return "";
  const clean = url.split("#")[0].split("?")[0];
  const parts = clean.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
};

const getFileTypeLabel = (ext) => {
  if (!ext) return "FILE";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return "IMG";
  }
  if (["pdf"].includes(ext)) return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["zip", "rar", "7z"].includes(ext)) return "ZIP";
  return ext.toUpperCase().slice(0, 4);
};

const generateTreatyNumber = () => {
  let raw = "";
  try {
    // современный браузер
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      raw = window.crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  if (!raw) {
    // простой fallback UUIDv4-подобной строки
    raw = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const short = String(raw).split("-")[0].toUpperCase();
  return `ДГ-${short}`;
};

const FORM_INITIAL = {
  residential_complex: "",
  client: "",
  number: "",
  title: "",
  description: "",
  amount: "",
  operation_type: "sale",
  payment_type: "full",
  apartment: "",
  down_payment: "",
  payment_terms: "",
  status: "draft",
  auto_create_in_erp: false,
};

export default function BuildingTreatyDetail() {
  const { id } = useParams();
  const isNew = !id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();

  const { current, currentLoading, currentError } = useBuildingTreaties();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const { list: clientsList } = useBuildingClients();
  const { list: apartmentsList } = useBuildingApartments();

  const [form, setForm] = useState(FORM_INITIAL);
  const [installments, setInstallments] = useState([]);
  const [formError, setFormError] = useState(null);

  const [firstInstallmentDate, setFirstInstallmentDate] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState(12);

  const [fileForm, setFileForm] = useState({ file: null, title: "" });
  const [fileUploadError, setFileUploadError] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileModalOpen, setFileModalOpen] = useState(false);

  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [paymentsModalInstallment, setPaymentsModalInstallment] =
    useState(null);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const complexesOptions = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    if (!current?.residential_complex) return list;
    const has = list.some(
      (c) => String(c?.id ?? c?.uuid) === String(current.residential_complex),
    );
    if (has) return list;
    return [
      {
        id: current.residential_complex,
        uuid: current.residential_complex,
        name: current.residential_complex_name || current.residential_complex,
      },
      ...list,
    ];
  }, [projects, current?.residential_complex, current?.residential_complex_name]);

  const clientsOptions = useMemo(() => {
    const list = Array.isArray(clientsList) ? clientsList : [];
    if (!current?.client) return list;
    const has = list.some(
      (c) => String(c?.id ?? c?.uuid) === String(current.client),
    );
    if (has) return list;
    return [
      {
        id: current.client,
        uuid: current.client,
        name: current.client_name || current.client,
      },
      ...list,
    ];
  }, [clientsList, current?.client, current?.client_name]);

  const apartmentsOptions = useMemo(() => {
    const base = (Array.isArray(apartmentsList) ? apartmentsList : []).filter(
      (a) =>
        form.residential_complex
          ? String(a?.residential_complex) === String(form.residential_complex)
          : !selectedProjectId ||
            String(a?.residential_complex) === String(selectedProjectId),
    );
    if (!current?.apartment) return base;
    const has = base.some(
      (a) => String(a?.id ?? a?.uuid) === String(current.apartment),
    );
    if (has) return base;
    const label = [current.apartment_number, current.apartment_floor != null ? `эт. ${current.apartment_floor}` : null]
      .filter(Boolean)
      .join(", ") || current.apartment;
    return [
      {
        id: current.apartment,
        uuid: current.apartment,
        number: current.apartment_number || label,
        floor: current.apartment_floor,
      },
      ...base,
    ];
  }, [
    apartmentsList,
    form.residential_complex,
    selectedProjectId,
    current?.apartment,
    current?.apartment_number,
    current?.apartment_floor,
  ]);

  const isReadOnly =
    !isNew && (current?.status === "signed" || current?.status === "cancelled");

  useEffect(() => {
    if (!isNew && id) {
      dispatch(fetchBuildingTreatyById(id));
    } else if (isNew) {
      setForm((prev) => ({
        ...prev,
        residential_complex: selectedProjectId || "",
        number: prev.number || generateTreatyNumber(),
      }));
    }
  }, [dispatch, id, isNew, selectedProjectId]);

  useEffect(() => {
    const complexId =
      form.residential_complex ||
      current?.residential_complex ||
      selectedProjectId;
    if (!complexId) return;
    dispatch(fetchBuildingClients({ residential_complex: complexId }));
    dispatch(
      fetchBuildingApartments({
        residential_complex: complexId,
        status: "available",
        page: 1,
        page_size: 500,
      }),
    );
  }, [
    dispatch,
    form.residential_complex,
    current?.residential_complex,
    selectedProjectId,
  ]);

  useEffect(() => {
    if (isNew || !current) return;
    const currentId = current?.id ?? current?.uuid;
    if (id && currentId && String(currentId) !== String(id)) return;
    setForm({
      residential_complex: current?.residential_complex || "",
      client: current?.client || "",
      number: current?.number || "",
      title: current?.title || "",
      description: current?.description || "",
      amount: current?.amount || "",
      operation_type: current?.operation_type || "sale",
      payment_type: current?.payment_type || "full",
      apartment: current?.apartment || "",
      down_payment: current?.down_payment ?? "",
      payment_terms: current?.payment_terms || "",
      status: current?.status || "draft",
      auto_create_in_erp: current?.auto_create_in_erp ?? false,
    });
    setInstallments(
      Array.isArray(current?.installments)
        ? current.installments.map((it, idx) => ({
            order: it.order ?? idx + 1,
            due_date: it.due_date ?? "",
            amount: it.amount ?? "",
          }))
        : [],
    );
    if (Array.isArray(current?.installments) && current.installments.length) {
      setFirstInstallmentDate(current.installments[0].due_date || "");
      setInstallmentMonths(current.installments.length);
    }
  }, [isNew, current, id]);

  const handleFormChange = (key) => (e) => {
    const value =
      key === "auto_create_in_erp" ? e.target.checked : e.target.value;

    if (key === "status" && !isNew && current && value !== form.status) {
      const fromLabel =
        STATUS_LABELS[form.status] || form.status || "неизвестен";
      const toLabel = STATUS_LABELS[value] || value || "неизвестен";
      confirm(
        `Изменить статус договора c «${fromLabel}» на «${toLabel}»?`,
        async (ok) => {
          if (!ok) return;
          const treatyId = current.id ?? current.uuid ?? id;
          if (!treatyId) return;
          try {
            const payload = { status: value };
            const res = await dispatch(
              updateBuildingTreaty({ id: treatyId, data: payload }),
            );
            if (res.meta.requestStatus === "fulfilled") {
              alert("Статус договора обновлён");
              setForm((prev) => ({ ...prev, status: value }));
            } else {
              alert(
                validateResErrors(
                  res.payload || res.error,
                  "Не удалось обновить статус договора",
                ),
                true,
              );
            }
          } catch (err) {
            alert(
              validateResErrors(err, "Не удалось обновить статус договора"),
              true,
            );
          }
        },
      );
      return;
    }

    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "payment_type" && value !== "installment") {
        next.down_payment = "";
      }
      return next;
    });
  };

  useEffect(() => {
    if (form.payment_type !== "installment") {
      setInstallments([]);
      return;
    }
    const amountTotal = Number(form.amount || 0);
    const down = Number(form.down_payment || 0);
    const n = Number(installmentMonths) || 0;
    if (!firstInstallmentDate || !amountTotal || !n || down >= amountTotal) {
      setInstallments([]);
      return;
    }
    const remain = amountTotal - down;
    const totalCents = Math.round(remain * 100);
    if (totalCents <= 0) {
      setInstallments([]);
      return;
    }
    const baseCents = Math.floor(totalCents / n);
    const rows = [];
    let usedCents = 0;
    const start = new Date(firstInstallmentDate);
    if (Number.isNaN(start.getTime())) {
      setInstallments([]);
      return;
    }
    for (let i = 0; i < n; i += 1) {
      const isLast = i === n - 1;
      const cents = isLast ? totalCents - usedCents : baseCents;
      usedCents += cents;
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      rows.push({
        order: i + 1,
        due_date: iso,
        amount: (cents / 100).toFixed(2),
      });
    }
    setInstallments(rows);
  }, [
    form.payment_type,
    form.amount,
    form.down_payment,
    firstInstallmentDate,
    installmentMonths,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.residential_complex ||
      !form.client ||
      !String(form.title || "").trim()
    ) {
      setFormError("Заполните ЖК, клиента и наименование договора");
      return;
    }

    if (
      (form.operation_type === "sale" || form.operation_type === "booking") &&
      !form.apartment
    ) {
      setFormError("Выберите квартиру для продажи/брони");
      return;
    }

    let installmentsPayload = undefined;
    if (form.payment_type === "installment") {
      if (!firstInstallmentDate) {
        setFormError("Укажите дату первого платежа рассрочки");
        return;
      }
      const amountTotal = Number(form.amount || 0);
      const down = Number(form.down_payment || 0);
      const insSum = installments.reduce(
        (acc, row) => acc + Number(row.amount || 0),
        0,
      );

      if (
        Number.isFinite(amountTotal) &&
        (down + insSum).toFixed(2) !== amountTotal.toFixed(2)
      ) {
        setFormError(
          "Сумма первоначального взноса и рассрочки должна быть равна сумме договора",
        );
        return;
      }

      installmentsPayload = installments.map((row) => ({
        order: row.order,
        due_date: row.due_date,
        amount: String(row.amount),
      }));
    }

    const payload = {
      ...form,
      number:
        form.number && String(form.number).trim()
          ? String(form.number).trim()
          : generateTreatyNumber(),
      amount: form.amount ? String(form.amount) : undefined,
      down_payment: form.down_payment ? String(form.down_payment) : undefined,
      installments:
        form.payment_type === "installment" ? installmentsPayload : undefined,
    };

    try {
      let res;
      if (isNew) {
        res = await dispatch(createBuildingTreaty(payload));
      } else {
        if (!id) return;
        res = await dispatch(updateBuildingTreaty({ id, data: payload }));
      }
      if (res.meta.requestStatus === "fulfilled") {
        const newTreaty = res.payload;
        const newId = newTreaty?.id ?? newTreaty?.uuid;
        alert(isNew ? "Договор создан" : "Договор обновлён");
        if (newId) {
          navigate(`/crm/building/treaty/${newId}`);
        } else {
          navigate("/crm/building/treaty");
        }
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

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!current) return;
    const treatyId = current?.id ?? current?.uuid;
    if (!treatyId || !fileForm.file) {
      setFileUploadError("Выберите файл");
      return;
    }
    setFileUploadError(null);
    setFileUploading(true);
    try {
      const res = await dispatch(
        createBuildingTreatyFile({
          treatyId,
          file: fileForm.file,
          title: fileForm.title || undefined,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Файл прикреплён");
        setFileForm({ file: null, title: "" });
        setFileModalOpen(false);
        dispatch(fetchBuildingTreatyById(treatyId));
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

  const files = Array.isArray(current?.files) ? current.files : [];

  const openInstallmentPayments = (installment) => {
    if (!installment) return;
    setPaymentsModalInstallment(installment);
    setPaymentsModalOpen(true);
  };

  const handleDownloadSchedulePdf = () => {
    if (!installments.length) {
      alert("Нет графика рассрочки для выгрузки", true);
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      alert("Браузер заблокировал открытие окна для PDF", true);
      return;
    }
    const title = form.title || "Договор";
    const amountTotal = form.amount || "";
    const html = `
<!doctype html>
<html>
<head>
  <meta charSet="utf-8" />
  <title>График платежей - ${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
    th { background: #f3f3f3; }
  </style>
</head>
<body>
  <h1>График платежей по договору</h1>
  <div>Наименование: <b>${title}</b></div>
  <div>Сумма договора: <b>${amountTotal}</b></div>
  <div style="margin-top: 8px;">Тип оплаты: рассрочка</div>
  <h2>Платежи</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Дата платежа</th>
        <th>Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${installments
        .map(
          (row) => `
      <tr>
        <td>${row.order}</td>
        <td>${row.due_date}</td>
        <td>${row.amount}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };
  const disabled = useMemo(() => {
    return !isNew && (current?.status === "signed" || current?.status === "cancelled");
  }, [isNew, current?.status]);
  return (
    <div className="add-product-page treaty-detail">
      <div className="add-product-page__header">
        <button
          type="button"
          className="add-product-page__back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={18} />Назад
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">
              {isNew ? "Новый договор" : "Договор строительства"}
            </h1>
            <p className="add-product-page__subtitle">
              ЖК: <b>{selectedProjectName}</b>
            </p>
          </div>
        </div>
      </div>

      {!isNew && isReadOnly && (
        <div className="treaty-detail__readonly-warn">
          <div className="add-product-page__label" style={{ marginBottom: 4 }}>
            Внимание
          </div>
          <div className="treaty-detail__muted">
            Этот договор имеет статус{" "}
            <b>
              {STATUS_LABELS[current?.status] ||
                current?.status ||
                "неизвестен"}
            </b>
            . Изменение данных недоступно.
          </div>
        </div>
      )}

      {currentError && !isNew && (
        <div className="add-product-page__error" style={{ marginBottom: 12 }}>
          {String(
            validateResErrors(currentError, "Не удалось загрузить договор"),
          )}
        </div>
      )}

      <div className="add-product-page__content">
        {currentLoading && !isNew ? (
          <div className="treaty-detail__muted">Загрузка договора...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="add-product-page__section">
              <div className="add-product-page__section-header mt-4">
                <div className="add-product-page__section-number">1</div>
                <h3 className="add-product-page__section-title">
                  Основная информация
                </h3>
              </div>
              <div style={FORM_GRID_STYLE}>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">ЖК *</label>
                  <select
                    className="add-product-page__input"
                    value={form.residential_complex}
                    onChange={handleFormChange("residential_complex")}
                    required
                    disabled={disabled}
                  >
                    <option value="">Выберите ЖК</option>
                    {complexesOptions.map((c) => (
                      <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                        {c.name || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Клиент *</label>
                  <select
                    className="add-product-page__input"
                    value={form.client}
                    onChange={handleFormChange("client")}
                    required
                    disabled={disabled}
                  >
                    <option value="">Выберите клиента</option>
                    {clientsOptions.map((c) => (
                      <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                        {c.name || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">
                    Номер договора
                  </label>
                  <input
                    className="add-product-page__input"
                    value={form.number}
                    onChange={handleFormChange("number")}
                    placeholder="ДГ-001"
                    disabled={disabled}
                  />
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Статус</label>
                  <select
                    className="add-product-page__input"
                    value={form.status}
                    onChange={handleFormChange("status")}
                    disabled={disabled}
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="add-product-page__section">
              <div className="add-product-page__section-header mt-4">
                <div className="add-product-page__section-number">2</div>
                <h3 className="add-product-page__section-title">
                  Объект и описание
                </h3>
              </div>
              <div style={FORM_GRID_STYLE}>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Квартира</label>
                  <select
                    className="add-product-page__input"
                    value={form.apartment}
                    onChange={handleFormChange("apartment")}
                    disabled={disabled}
                  >
                    <option value="">Без выбора квартиры</option>
                    {apartmentsOptions.map((a) => (
                      <option key={a.id ?? a.uuid} value={a.id ?? a.uuid}>
                        {a.number || "Квартира"}
                        {a.floor != null ? `, этаж ${a.floor}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">
                    Тип операции
                  </label>
                  <select
                    className="add-product-page__input"
                    value={form.operation_type}
                    onChange={handleFormChange("operation_type")}
                    disabled={disabled}
                  >
                    {Object.entries(OPERATION_TYPE_LABELS).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">
                    Наименование *
                  </label>
                  <input
                    className="add-product-page__input"
                    value={form.title}
                    onChange={handleFormChange("title")}
                    placeholder="Договор подряда"
                    required
                    disabled={disabled}
                  />
                </div>
                <div
                  className="add-product-page__form-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label className="add-product-page__label">Описание</label>
                  <textarea
                    className="add-product-page__input"
                    rows={3}
                    value={form.description}
                    onChange={handleFormChange("description")}
                    placeholder="Условия договора..."
                    style={{ resize: "vertical", minHeight: 80 }}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            <div className="add-product-page__section">
              <div className="add-product-page__section-header mt-4">
                <div className="add-product-page__section-number">3</div>
                <h3 className="add-product-page__section-title">Оплата</h3>
              </div>
              <div style={FORM_GRID_STYLE}>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Тип оплаты</label>
                  <select
                    className="add-product-page__input"
                    value={form.payment_type}
                    onChange={handleFormChange("payment_type")}
                    disabled={disabled}
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Сумма</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="add-product-page__input"
                    value={form.amount}
                    onChange={handleFormChange("amount")}
                    placeholder="150000.00"
                    disabled={disabled}
                  />
                </div>
                {form.payment_type === "installment" && (
                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">
                      Первоначальный взнос
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="add-product-page__input"
                      value={form.down_payment}
                      onChange={handleFormChange("down_payment")}
                      placeholder="30000.00"
                      disabled={disabled}
                    />
                  </div>
                )}
                <div
                  className="add-product-page__form-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label className="add-product-page__label">
                    Условия оплаты
                  </label>
                  <textarea
                    className="add-product-page__input"
                    rows={2}
                    value={form.payment_terms}
                    onChange={handleFormChange("payment_terms")}
                    placeholder="Рассрочка на 12 месяцев..."
                    style={{ resize: "vertical", minHeight: 60 }}
                    disabled={disabled}
                  />
                </div>
                <div
                  className="add-product-page__checkbox-label"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <input
                    type="checkbox"
                    checked={form.auto_create_in_erp}
                    onChange={handleFormChange("auto_create_in_erp")}
                    disabled={disabled}
                  />
                  <span>Создавать договор в ERP автоматически</span>
                </div>
              </div>
            </div>

            {form.payment_type === "installment" && (
              <div className="add-product-page__section">
                <div className="add-product-page__section-header mt-4">
                  <div className="add-product-page__section-number">4</div>
                  <h3 className="add-product-page__section-title">
                    График рассрочки
                  </h3>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    className="add-product-page__form-group"
                    style={{ flex: "0 0 220px" }}
                  >
                    <label className="add-product-page__label">
                      Дата первого платежа *
                    </label>
                    <input
                      type="date"
                      className="add-product-page__input"
                      value={firstInstallmentDate}
                      onChange={(e) => setFirstInstallmentDate(e.target.value)}
                    />
                  </div>
                  <div
                    className="add-product-page__form-group"
                    style={{ flex: "0 0 220px" }}
                  >
                    <label className="add-product-page__label">
                      Количество платежей
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="add-product-page__input"
                      value={installmentMonths}
                      onChange={(e) =>
                        setInstallmentMonths(
                          Number(e.target.value) > 0
                            ? Number(e.target.value)
                            : 1,
                        )
                      }
                    />
                  </div>
                </div>
                {installments.length === 0 ? (
                  <div className="treaty-detail__muted">
                    Укажите сумму договора, первоначальный взнос и дату первого
                    платежа, чтобы увидеть график рассрочки.
                  </div>
                ) : (
                  <div className="treaty-detail__table-wrap">
                    <table className="treaty-detail__table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Дата платежа</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.order ?? idx + 1}</td>
                            <td>{row.due_date}</td>
                            <td>{row.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {formError && (
              <div className="add-product-page__error" style={{ marginTop: 8 }}>
                {String(formError)}
              </div>
            )}

            <div
              className="add-product-page__actions"
              style={{ marginTop: 24 }}
            >
              {
                !disabled && (
                  <button type="submit" className="add-product-page__submit-btn">
                    Сохранить
                  </button>
                )
              }
              {form.payment_type === "installment" &&
                installments.length > 0 && (
                  <button
                    type="button"
                    className="add-product-page__cancel-btn"
                    onClick={handleDownloadSchedulePdf}
                  >
                    Скачать график (PDF)
                  </button>
                )}
            </div>
          </form>
        )}
      </div>

      {!isNew &&
        current?.payment_type === "installment" &&
        Array.isArray(current?.installments) &&
        current.installments.length > 0 && (
          <div className="add-product-page__content" style={{ marginTop: 24 }}>
            <div className="add-product-page__section">
              <div className="add-product-page__section-header !mb-0">
                <h3 className="add-product-page__section-title">
                  Рассрочка по договору
                </h3>
              </div>
              <div className="treaty-detail__table-wrap">
                <table className="treaty-detail__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Дата платежа</th>
                      <th>Сумма</th>
                      <th>Оплачено</th>
                      <th>Остаток</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.installments.map((it, idx) => {
                      const total = Number(it.amount || 0);
                      const paid = Number(it.paid_amount || 0);
                      const remain = Number.isFinite(total - paid)
                        ? Math.max(0, total - paid)
                        : 0;
                      const status =
                        it.status || (remain <= 0 ? "paid" : "planned");
                      const isPaid = status === "paid";
                      return (
                        <tr key={it.id ?? it.uuid ?? idx}>
                          <td>{it.order ?? idx + 1}</td>
                          <td>{it.due_date || "—"}</td>
                          <td>{it.amount ?? "0.00"}</td>
                          <td>{it.paid_amount ?? "0.00"}</td>
                          <td>{remain.toFixed(2)}</td>
                          <td>
                            {isPaid ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  backgroundColor: "#dcfce7",
                                  color: "#166534",
                                }}
                              >
                                Оплачен
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  backgroundColor: "#fef3c7",
                                  color: "#92400e",
                                }}
                              >
                                Запланирован
                              </span>
                            )}
                          </td>
                          <td>
                            {!isPaid && remain > 0 ? (
                              <button
                                type="button"
                                className="add-product-page__submit-btn"
                                onClick={() => openInstallmentPayments(it)}
                              >
                                Оплатить
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="add-product-page__cancel-btn"
                                onClick={() => openInstallmentPayments(it)}
                              >
                                Платежи
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      {!isNew && (
        <div className="add-product-page__content" style={{ marginTop: 24 }}>
          <div className="add-product-page__section">
            <div className="treaty-detail__section-actions">
              <h3 className="treaty-detail__section-title-inline">
                Файлы договора
              </h3>
              <button
                type="button"
                className="add-product-page__submit-btn"
                onClick={() => setFileModalOpen(true)}
              >
                Прикрепить файл
              </button>
            </div>
            {files.length === 0 ? (
              <div className="treaty-detail__muted">
                Файлы ещё не прикреплены.
              </div>
            ) : (
              <div className="treaty-detail__table-wrap">
                <table className="treaty-detail__table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Файл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => {
                      const key = f.id ?? f.uuid ?? f.file;
                      const url = getFileUrl(f);
                      const ext = getFileExtension(url);
                      const isImage = IMAGE_EXTENSIONS.includes(ext);
                      const iconLabel = getFileTypeLabel(ext);
                      const title = f.title || "Файл";
                      return (
                        <tr key={key}>
                          <td>{title}</td>
                          <td>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-block",
                                  textDecoration: "none",
                                  color: "inherit",
                                }}
                              >
                                <div
                                  style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    border: "1px solid #d9d9d9",
                                    backgroundColor: isImage
                                      ? "#f0f2f5"
                                      : "#e5e7eb",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {isImage ? (
                                    <img
                                      src={url}
                                      alt={title}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#111827",
                                      }}
                                    >
                                      {iconLabel}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    marginTop: 4,
                                    maxWidth: 140,
                                    fontSize: 12,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {title}
                                </div>
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={fileModalOpen}
        onClose={() => setFileModalOpen(false)}
        title="Прикрепить файл к договору"
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleFileSubmit}
        >
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Файл *</label>
            <input
              type="file"
              className="add-product-page__input"
              onChange={(e) =>
                setFileForm((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] ?? null,
                }))
              }
              required
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">
              Название (необязательно)
            </label>
            <input
              type="text"
              className="add-product-page__input"
              value={fileForm.title}
              onChange={(e) =>
                setFileForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Например: Скан договора"
            />
          </div>
          {fileUploadError && (
            <div className="add-product-page__error">
              {String(fileUploadError)}
            </div>
          )}
          <div className="add-product-page__actions">
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => setFileModalOpen(false)}
              disabled={fileUploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={fileUploading || !fileForm.file}
            >
              {fileUploading ? "Загрузка..." : "Прикрепить"}
            </button>
          </div>
        </form>
      </Modal>

      {!isNew && paymentsModalInstallment && (
        <InstallmentPaymentsModal
          open={paymentsModalOpen}
          onClose={() => setPaymentsModalOpen(false)}
          installment={paymentsModalInstallment}
          treaty={current}
        />
      )}
    </div>
  );
}
