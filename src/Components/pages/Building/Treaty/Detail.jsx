import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
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
import { validateResErrors } from "../../../../../tools/validateResErrors";

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

  const apartmentsOptions = useMemo(
    () =>
      (Array.isArray(apartmentsList) ? apartmentsList : []).filter((a) =>
        form.residential_complex
          ? String(a?.residential_complex) === String(form.residential_complex)
          : !selectedProjectId ||
            String(a?.residential_complex) === String(selectedProjectId),
      ),
    [apartmentsList, form.residential_complex, selectedProjectId],
  );

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
      form.residential_complex || current?.residential_complex || selectedProjectId;
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
    if (!isNew && current) {
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
        down_payment: current?.down_payment || "",
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
    }
  }, [isNew, current]);

  const handleFormChange = (key) => (e) => {
    const value =
      key === "auto_create_in_erp" ? e.target.checked : e.target.value;
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
  }, [form.payment_type, form.amount, form.down_payment, firstInstallmentDate, installmentMonths]);

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
      number: form.number && String(form.number).trim()
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

  return (
    <div className="building-page building-page--treaty-detail">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            {isNew ? "Новый договор" : "Договор строительства"}
          </h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>
          </p>
        </div>
        <button
          type="button"
          className="building-btn"
          onClick={() => navigate("/crm/building/treaty")}
        >
          ← К списку договоров
        </button>
      </div>

      {currentError && !isNew && (
        <div className="building-page__error" style={{ marginBottom: 12 }}>
          {String(
            validateResErrors(currentError, "Не удалось загрузить договор"),
          )}
        </div>
      )}

      <div className="building-page__card">
        {currentLoading && !isNew ? (
          <div className="building-page__muted">Загрузка договора...</div>
        ) : (
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
                disabled
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
              <div className="building-page__label">Квартира</div>
              <select
                className="building-page__select"
                value={form.apartment}
                onChange={handleFormChange("apartment")}
              >
                <option value="">Без выбора квартиры</option>
                {apartmentsOptions.map((a) => (
                  <option key={a.id ?? a.uuid} value={a.id ?? a.uuid}>
                    {a.number || "Квартира"}
                    {a.floor != null ? `, этаж ${a.floor}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Тип операции</div>
              <select
                className="building-page__select"
                value={form.operation_type}
                onChange={handleFormChange("operation_type")}
              >
                {Object.entries(OPERATION_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Тип оплаты</div>
              <select
                className="building-page__select"
                value={form.payment_type}
                onChange={handleFormChange("payment_type")}
              >
                {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
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
            {form.payment_type === "installment" && (
              <label>
                <div className="building-page__label">Первоначальный взнос</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="building-page__input"
                  value={form.down_payment}
                  onChange={handleFormChange("down_payment")}
                  placeholder="30000.00"
                />
              </label>
            )}
            <label>
              <div className="building-page__label">Условия оплаты</div>
              <textarea
                className="building-page__textarea"
                rows={2}
                value={form.payment_terms}
                onChange={handleFormChange("payment_terms")}
                placeholder="Рассрочка на 12 месяцев..."
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

            {form.payment_type === "installment" && (
              <div>
                <div className="building-page__label" style={{ marginTop: 8 }}>
                  График рассрочки
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <label style={{ flex: "0 0 220px" }}>
                    <div className="building-page__label">
                      Дата первого платежа *
                    </div>
                    <input
                      type="date"
                      className="building-page__input"
                      value={firstInstallmentDate}
                      onChange={(e) => setFirstInstallmentDate(e.target.value)}
                    />
                  </label>
                  <label style={{ flex: "0 0 220px" }}>
                    <div className="building-page__label">
                      Количество платежей
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="building-page__input"
                      value={installmentMonths}
                      onChange={(e) =>
                        setInstallmentMonths(
                          Number(e.target.value) > 0
                            ? Number(e.target.value)
                            : 1,
                        )
                      }
                    />
                  </label>
                </div>
                {installments.length === 0 ? (
                  <div className="building-page__muted">
                    Укажите сумму договора, первоначальный взнос и дату первого
                    платежа, чтобы увидеть график рассрочки.
                  </div>
                ) : (
                  <div className="building-table building-table--shadow">
                    <table>
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
              <div className="building-page__error" style={{ marginTop: 8 }}>
                {String(formError)}
              </div>
            )}

            <div className="building-page__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => navigate("/crm/building/treaty")}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
              >
                Сохранить
              </button>
              {form.payment_type === "installment" && installments.length > 0 && (
                <button
                  type="button"
                  className="building-btn"
                  onClick={handleDownloadSchedulePdf}
                >
                  Скачать график (PDF)
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {!isNew && (
        <div className="building-page__card" style={{ marginTop: 16 }}>
          <div className="building-page__header" style={{ marginBottom: 8 }}>
            <h2 className="building-page__title" style={{ fontSize: 18 }}>
              Файлы договора
            </h2>
            <button
              type="button"
              className="building-btn building-btn--primary"
              onClick={() => setFileModalOpen(true)}
            >
              Прикрепить файл
            </button>
          </div>
          {files.length === 0 ? (
            <div className="building-page__muted">
              Файлы ещё не прикреплены.
            </div>
          ) : (
            <div className="building-table building-table--shadow">
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Файл</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id ?? f.uuid ?? f.file}>
                      <td>{f.title || "Файл"}</td>
                      <td>
                        {f.file_url || f.file ? (
                          <a
                            href={f.file_url || f.file}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={fileModalOpen}
        onClose={() => setFileModalOpen(false)}
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
              onClick={() => setFileModalOpen(false)}
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

