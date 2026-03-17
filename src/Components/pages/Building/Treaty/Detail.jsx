import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import {
  createBuildingTreaty,
  updateBuildingTreaty,
  fetchBuildingTreatyById,
  createBuildingTreatyFile,
} from "../../../../store/creators/building/treatiesCreators";
import {
  getBuildingCashboxes,
  createBuildingCashRegisterRequest,
  uploadBuildingCashRegisterRequestFile,
} from "@/api/building";
import {
  fetchBuildingClients,
  createBuildingClient,
} from "../../../../store/creators/building/clientsCreators";
import { fetchBuildingApartments } from "../../../../store/creators/building/apartmentsCreators";
import { useBuildingTreaties } from "../../../../store/slices/building/treatiesSlice";
import { useBuildingClients } from "../../../../store/slices/building/clientsSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { useBuildingApartments } from "../../../../store/slices/building/apartmentsSlice";
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
  other: "Прочее",
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
  const [searchParams] = useSearchParams();
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
  /** Строки графика, где сумму меняли вручную — при перераспределении не трогаем */
  const [installmentManual, setInstallmentManual] = useState({});
  const [formError, setFormError] = useState(null);

  const [firstInstallmentDate, setFirstInstallmentDate] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState(12);

  const [fileForm, setFileForm] = useState({ file: null, title: "" });
  const [fileUploadError, setFileUploadError] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  /** Файлы, прикреплённые до сохранения договора (только для нового договора) */
  const [pendingFiles, setPendingFiles] = useState([]);

  const [openAddClientModal, setOpenAddClientModal] = useState(false);
  const [addClientForm, setAddClientForm] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [addClientError, setAddClientError] = useState(null);
  const [addClientSubmitting, setAddClientSubmitting] = useState(false);

  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signCashboxes, setSignCashboxes] = useState([]);
  const [signCashbox, setSignCashbox] = useState("");
  const [signComment, setSignComment] = useState("");
  const [signFiles, setSignFiles] = useState([]);
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [signError, setSignError] = useState(null);

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

  /** Редактировать данные можно только в режиме черновика (или при создании) */
  const isDraft = isNew || current?.status === "draft";
  const isReadOnly = !isDraft;

  const urlOperationType = searchParams.get("operation_type");

  useEffect(() => {
    if (!isNew && id) {
      dispatch(fetchBuildingTreatyById(id));
    } else if (isNew) {
      const opType = urlOperationType === "booking" || urlOperationType === "other"
        ? urlOperationType
        : "sale";
      setForm((prev) => ({
        ...prev,
        residential_complex: selectedProjectId || "",
        number: prev.number || generateTreatyNumber(),
        operation_type: opType,
      }));
    }
  }, [dispatch, id, isNew, selectedProjectId, urlOperationType]);

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

  useEffect(() => {
    if (!signModalOpen) return;
    const rcId =
      form.residential_complex ||
      current?.residential_complex ||
      selectedProjectId ||
      null;
    let cancelled = false;
    setSignError(null);
    setSignComment("");
    setSignFiles([]);
    setSignCashboxes([]);
    setSignCashbox("");
    getBuildingCashboxes(rcId ? { residential_complex: rcId } : {})
      .then((list) => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setSignCashboxes(arr);
        const first = arr[0];
        const firstId = first?.id ?? first?.uuid ?? "";
        if (firstId) setSignCashbox(firstId);
      })
      .catch(() => {
        if (!cancelled) setSignCashboxes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [
    signModalOpen,
    form.residential_complex,
    current?.residential_complex,
    selectedProjectId,
  ]);

  const updateStatusOnly = async (nextStatus) => {
    if (!current) return false;
    const treatyId = current?.id ?? current?.uuid ?? id;
    if (!treatyId) return false;
    try {
      const res = await dispatch(
        updateBuildingTreaty({ id: treatyId, data: { status: nextStatus } }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Статус договора обновлён");
        setForm((prev) => ({ ...prev, status: nextStatus }));
        dispatch(fetchBuildingTreatyById(treatyId));
        return true;
      }
      alert(
        validateResErrors(
          res.payload || res.error,
          "Не удалось обновить статус договора",
        ),
        true,
      );
      return false;
    } catch (err) {
      alert(validateResErrors(err, "Не удалось обновить статус договора"), true);
      return false;
    }
  };

  const handleCancelTreaty = () => {
    if (!current) return;
    confirm("Отменить договор?", async (ok) => {
      if (!ok) return;
      await updateStatusOnly("cancelled");
    });
  };

  const handleActivateTreaty = () => {
    if (!current) return;
    confirm("Активировать договор?", async (ok) => {
      if (!ok) return;
      await updateStatusOnly("active");
    });
  };

  const openSignModal = () => {
    if (!current) return;
    setSignModalOpen(true);
  };

  const handleSignSubmit = async (e) => {
    e.preventDefault();
    if (!current) return;
    const treatyId = current?.id ?? current?.uuid ?? id;
    if (!treatyId) return;

    const amountTotal = Number(current?.amount ?? form.amount ?? 0);
    const down = Number(current?.down_payment ?? form.down_payment ?? 0);
    const paymentType = current?.payment_type ?? form.payment_type;
    const aptId = current?.apartment ?? form.apartment ?? null;
    const clientId = current?.client ?? form.client ?? null;

    if (!signCashbox) {
      setSignError("Выберите кассу");
      return;
    }

    let requestType = null;
    let requestAmount = null;
    if (paymentType === "full") {
      requestType = "apartment_sale";
      requestAmount = amountTotal;
    } else if (paymentType === "installment" && down > 0) {
      requestType = "installment_initial_payment";
      requestAmount = down;
    }

    setSignSubmitting(true);
    setSignError(null);
    try {
      // 1) создаём заявку в кассу, если требуется
      let createdRequestId = null;
      if (requestType && requestAmount > 0) {
        const created = await createBuildingCashRegisterRequest({
          request_type: requestType,
          treaty: treatyId,
          apartment: aptId || undefined,
          client: clientId || undefined,
          cashbox: signCashbox,
          shift: null,
          amount: Number(requestAmount).toFixed(2),
          comment: signComment.trim() || undefined,
        });
        createdRequestId = created?.id ?? created?.uuid ?? null;

        if (createdRequestId && signFiles.length > 0) {
          // eslint-disable-next-line no-restricted-syntax
          for (const file of signFiles) {
            if (!file) continue;
            // eslint-disable-next-line no-await-in-loop
            await uploadBuildingCashRegisterRequestFile(
              createdRequestId,
              (() => {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("title", file.name || "Файл");
                return fd;
              })(),
            );
          }
        }
      }

      // 2) подписываем договор
      const ok = await updateStatusOnly("signed");
      if (ok) {
        setSignModalOpen(false);
        setSignFiles([]);
      }
    } catch (err) {
      const msg = validateResErrors(
        err?.response?.data ?? err,
        "Не удалось подписать договор / создать заявку в кассу",
      );
      setSignError(String(msg));
      alert(msg, true);
    } finally {
      setSignSubmitting(false);
    }
  };

  const getInstallmentTotalCents = () => {
    const amountTotal = Number(form.amount || 0);
    const down = Number(form.down_payment || 0);
    if (!Number.isFinite(amountTotal) || !Number.isFinite(down)) return null;
    const remain = amountTotal - down;
    const cents = Math.round(remain * 100);
    return cents > 0 ? cents : null;
  };

  const redistributeInstallments = (rows, manualMap, totalCents) => {
    const list = Array.isArray(rows) ? rows : [];
    if (!totalCents || totalCents <= 0 || list.length === 0) return list;
    const isManual = (order) => Boolean(manualMap?.[String(order)]);
    let fixedCents = 0;
    const auto = [];
    list.forEach((r) => {
      const order = r?.order;
      if (order != null && isManual(order)) {
        const v = Number(r?.amount || 0);
        fixedCents += Math.round((Number.isFinite(v) ? v : 0) * 100);
      } else {
        auto.push(r);
      }
    });
    if (auto.length === 0) return list;
    const remainingForAuto = totalCents - fixedCents;
    const safeRemain = remainingForAuto > 0 ? remainingForAuto : 0;
    const baseCents = Math.floor(safeRemain / auto.length);
    let used = 0;
    const lastAutoIdx = auto.length - 1;
    const autoCentsByOrder = {};
    auto.forEach((r, idx) => {
      const isLast = idx === lastAutoIdx;
      const cents = isLast ? safeRemain - used : baseCents;
      used += cents;
      autoCentsByOrder[String(r?.order)] = cents;
    });
    return list.map((r) => {
      const order = r?.order;
      if (order == null || isManual(order)) return r;
      const cents = autoCentsByOrder[String(order)] ?? 0;
      return { ...r, amount: (cents / 100).toFixed(2) };
    });
  };

  const handleInstallmentDueDateChange = (idx, value) => {
    setInstallments((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, due_date: value || "" } : row,
      ),
    );
  };

  const handleInstallmentAmountChange = (idx, value) => {
    const order = installments[idx]?.order ?? idx + 1;
    setInstallmentManual((prev) => ({ ...prev, [String(order)]: true }));
    setInstallments((prev) => {
      const next = prev.map((row, i) =>
        i === idx ? { ...row, amount: value !== "" ? String(value) : "" } : row,
      );
      const totalCents = getInstallmentTotalCents();
      if (!totalCents) return next;
      const manualMap = { ...installmentManual, [String(order)]: true };
      return redistributeInstallments(next, manualMap, totalCents);
    });
  };

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
      setInstallmentManual({});
      return;
    }
    // Для существующего договора с рассрочкой не пересчитываем — даты редактируются вручную
    if (!isNew && current && Array.isArray(current.installments) && current.installments.length > 0) {
      return;
    }
    const amountTotal = Number(form.amount || 0);
    const down = Number(form.down_payment || 0);
    const n = Number(installmentMonths) || 0;
    if (!firstInstallmentDate || !amountTotal || !n || down >= amountTotal) {
      setInstallments([]);
      setInstallmentManual({});
      return;
    }
    const remain = amountTotal - down;
    const totalCents = Math.round(remain * 100);
    if (totalCents <= 0) {
      setInstallments([]);
      setInstallmentManual({});
      return;
    }
    const baseCents = Math.floor(totalCents / n);
    const rows = [];
    let usedCents = 0;
    const start = new Date(firstInstallmentDate);
    if (Number.isNaN(start.getTime())) {
      setInstallments([]);
      setInstallmentManual({});
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
    setInstallmentManual({});
  }, [
    form.payment_type,
    form.amount,
    form.down_payment,
    firstInstallmentDate,
    installmentMonths,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.residential_complex || !String(form.title || "").trim()) {
      setFormError("Заполните ЖК и наименование договора");
      return;
    }
    if (
      form.operation_type !== "other" &&
      !form.client
    ) {
      setFormError("Выберите клиента для договора продажи/брони");
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
        if (isNew && newId && pendingFiles.length > 0) {
          for (const pf of pendingFiles) {
            await dispatch(
              createBuildingTreatyFile({
                treatyId: newId,
                file: pf.file,
                title: pf.title || undefined,
              }),
            );
          }
          setPendingFiles([]);
        }
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
    if (!fileForm.file) {
      setFileUploadError("Выберите файл");
      return;
    }
    setFileUploadError(null);
    if (isNew) {
      setPendingFiles((prev) => [
        ...prev,
        { file: fileForm.file, title: fileForm.title?.trim() || "" },
      ]);
      setFileForm({ file: null, title: "" });
      setFileModalOpen(false);
      return;
    }
    const treatyId = current?.id ?? current?.uuid;
    if (!treatyId) return;
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

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddClientFieldChange = (field) => (e) => {
    setAddClientForm((prev) => ({ ...prev, [field]: e.target.value }));
    setAddClientError(null);
  };

  const handleAddClientSubmit = async (e) => {
    e.preventDefault();
    setAddClientError(null);
    const name = String(addClientForm.name || "").trim();
    if (!name) {
      setAddClientError("Имя / название обязательно");
      return;
    }
    const rcId = form.residential_complex || selectedProjectId;
    if (!rcId) {
      setAddClientError("Сначала выберите жилой комплекс");
      return;
    }
    try {
      setAddClientSubmitting(true);
      const res = await dispatch(
        createBuildingClient({
          name,
          phone: addClientForm.phone?.trim() || undefined,
          email: addClientForm.email?.trim() || undefined,
          is_active: true,
          ...(rcId ? { residential_complex: rcId } : {}),
        }),
      );
      if (res.meta.requestStatus === "fulfilled" && res.payload) {
        const newId = res.payload?.id ?? res.payload?.uuid;
        if (newId) {
          setForm((prev) => ({ ...prev, client: String(newId) }));
          dispatch(
            fetchBuildingClients({
              residential_complex: rcId,
              page_size: 500,
            }),
          );
        }
        setOpenAddClientModal(false);
        setAddClientForm({ name: "", phone: "", email: "" });
        alert("Клиент добавлен");
      } else {
        setAddClientError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось создать клиента",
          ),
        );
      }
    } catch (err) {
      setAddClientError(
        validateResErrors(err, "Не удалось создать клиента"),
      );
    } finally {
      setAddClientSubmitting(false);
    }
  };

  const closeAddClientModal = () => {
    if (!addClientSubmitting) {
      setOpenAddClientModal(false);
      setAddClientForm({ name: "", phone: "", email: "" });
      setAddClientError(null);
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
  const disabled = useMemo(() => !isDraft, [isDraft]);

  const canCancel = !isNew && current && current?.status !== "cancelled";
  const canActivate = !isNew && current && current?.status === "draft";
  const canSign = !isNew && current && current?.status === "active";

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
            {!isNew && current && (
              <div className="treaty-detail__status-block">
                <div className="treaty-detail__status-track">
                  <div className="treaty-detail__status-track-title">
                    Процесс договора
                  </div>
                  <div className="treaty-detail__status-track-row">
                    {current.status === "cancelled" ? (
                      <div className="treaty-detail__status-track-step treaty-detail__status-track-step--cancelled">
                        <div className="treaty-detail__status-track-dot" />
                        <div className="treaty-detail__status-track-label">
                          {STATUS_LABELS.cancelled}
                        </div>
                      </div>
                    ) : (
                      ["draft", "active", "signed"].map((s, idx, arr) => {
                        const isActive = String(current.status) === String(s);
                        const isDone =
                          (s === "draft" && (current.status === "active" || current.status === "signed")) ||
                          (s === "active" && current.status === "signed");
                        const label = STATUS_LABELS[s] || s;
                        return (
                          <React.Fragment key={s}>
                            <div
                              className={`treaty-detail__status-track-step ${isActive ? "treaty-detail__status-track-step--current" : ""} ${isDone ? "treaty-detail__status-track-step--done" : ""}`}
                            >
                              <div className="treaty-detail__status-track-dot" />
                              <div className="treaty-detail__status-track-label">
                                {label}
                              </div>
                              {isActive && (
                                <span className="treaty-detail__status-track-badge">
                                  В работе
                                </span>
                              )}
                            </div>
                            {idx < arr.length - 1 && (
                              <div className="treaty-detail__status-track-connector" />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="treaty-detail__status-actions">
                  <button
                    type="button"
                    className="add-product-page__cancel-btn"
                    onClick={handleCancelTreaty}
                    disabled={!canCancel || currentLoading}
                  >
                    Отменить договор
                  </button>
                  <button
                    type="button"
                    className="add-product-page__submit-btn"
                    onClick={handleActivateTreaty}
                    disabled={!canActivate || currentLoading}
                  >
                    Активировать
                  </button>
                  <button
                    type="button"
                    className="add-product-page__submit-btn"
                    onClick={openSignModal}
                    disabled={!canSign || currentLoading}
                  >
                    Подписать
                  </button>
                </div>
              </div>
            )}
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
                  <label className="add-product-page__label">
                    Клиент{form.operation_type !== "other" ? " *" : ""}
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="add-product-page__input"
                      value={form.client}
                      onChange={handleFormChange("client")}
                      required={form.operation_type !== "other"}
                      disabled={disabled}
                      style={{ flex: "1 1 200px", minWidth: 0 }}
                    >
                      <option value="">Выберите клиента</option>
                      {clientsOptions.map((c) => (
                        <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                          {c.name || "—"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="add-product-page__submit-btn"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() => setOpenAddClientModal(true)}
                      disabled={disabled}
                    >
                      Добавить клиента
                    </button>
                  </div>
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
                      disabled={disabled}
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
                      disabled={disabled}
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
                            <td>
                              {isDraft ? (
                                <input
                                  type="date"
                                  className="add-product-page__input"
                                  value={row.due_date || ""}
                                  onChange={(e) =>
                                    handleInstallmentDueDateChange(
                                      idx,
                                      e.target.value,
                                    )
                                  }
                                  style={{ minWidth: 140 }}
                                />
                              ) : (
                                row.due_date || "—"
                              )}
                            </td>
                            <td>
                              {isDraft ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="add-product-page__input"
                                  value={row.amount || ""}
                                  onChange={(e) =>
                                    handleInstallmentAmountChange(
                                      idx,
                                      e.target.value,
                                    )
                                  }
                                  style={{ minWidth: 100 }}
                                />
                              ) : (
                                row.amount || "—"
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
          {isNew ? (
            pendingFiles.length === 0 ? (
              <div className="treaty-detail__muted">
                Файлы можно прикрепить до или после сохранения договора.
              </div>
            ) : (
              <div className="treaty-detail__table-wrap">
                <table className="treaty-detail__table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Файл</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingFiles.map((pf, index) => (
                      <tr key={index}>
                        <td>{pf.title || pf.file?.name || "Файл"}</td>
                        <td>
                          <span className="treaty-detail__muted">
                            {pf.file?.name ?? "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="add-product-page__cancel-btn"
                            onClick={() => removePendingFile(index)}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : files.length === 0 ? (
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

      <Modal
        open={openAddClientModal}
        onClose={closeAddClientModal}
        title="Добавить клиента"
        wrapperId="treaty-add-client-modal"
        closeOnOverlayClick={!addClientSubmitting}
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleAddClientSubmit}
        >
          <p className="treaty-detail__muted" style={{ marginBottom: 16 }}>
            Укажите минимальные данные. Остальное можно заполнить в карточке клиента позже.
          </p>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Имя / название *</label>
            <input
              type="text"
              className="add-product-page__input"
              value={addClientForm.name}
              onChange={handleAddClientFieldChange("name")}
              placeholder="ФИО или название организации"
              autoFocus
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Телефон</label>
            <input
              type="text"
              className="add-product-page__input"
              value={addClientForm.phone}
              onChange={handleAddClientFieldChange("phone")}
              placeholder="+996..."
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Email</label>
            <input
              type="text"
              className="add-product-page__input"
              value={addClientForm.email}
              onChange={handleAddClientFieldChange("email")}
              placeholder="email@example.com"
            />
          </div>
          {addClientError && (
            <div className="add-product-page__error" style={{ marginBottom: 12 }}>
              {String(addClientError)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={closeAddClientModal}
              disabled={addClientSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={addClientSubmitting}
            >
              {addClientSubmitting ? "Создание..." : "Добавить"}
            </button>
          </div>
        </form>
      </Modal>

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

      <Modal
        open={signModalOpen}
        onClose={() => (signSubmitting ? null : setSignModalOpen(false))}
        title="Подписать договор и создать заявку в кассу"
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleSignSubmit}
        >
          <div className="add-product-page__muted" style={{ marginBottom: 8 }}>
            При подписании будет создана заявка на кассу для одобрения оплаты.
            {current?.payment_type === "installment"
              ? " При рассрочке заявка создаётся только на первоначальный взнос (если он указан)."
              : ""}
          </div>

          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Касса *</label>
            <select
              className="add-product-page__input"
              value={signCashbox}
              onChange={(e) => setSignCashbox(e.target.value)}
              required
              disabled={signSubmitting}
            >
              <option value="">Выберите кассу</option>
              {(signCashboxes || []).map((c) => {
                const cid = c?.id ?? c?.uuid;
                if (!cid) return null;
                return (
                  <option key={cid} value={cid}>
                    {c?.name || "Касса"}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Комментарий (необязательно)</label>
            <textarea
              className="add-product-page__input"
              rows={3}
              value={signComment}
              onChange={(e) => setSignComment(e.target.value)}
              disabled={signSubmitting}
              placeholder="Например: Оплата по договору"
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="add-product-page__form-group">
            <label className="add-product-page__label">
              Файлы для одобрения (необязательно)
            </label>
            <input
              type="file"
              className="add-product-page__input"
              multiple
              onChange={(e) => {
                const added = Array.from(e.target.files || []);
                setSignFiles((prev) => [...(prev || []), ...added]);
                e.target.value = "";
              }}
              disabled={signSubmitting}
            />
            {signFiles.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                {signFiles.map((f, idx) => (
                  <li key={`${f.name}-${idx}`}>
                    {f.name}{" "}
                    <button
                      type="button"
                      className="add-product-page__cancel-btn"
                      style={{ padding: "2px 8px", marginLeft: 8 }}
                      onClick={() =>
                        setSignFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      disabled={signSubmitting}
                    >
                      удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {signError && (
            <div className="add-product-page__error" style={{ marginTop: 8 }}>
              {String(signError)}
            </div>
          )}

          <div className="add-product-page__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => setSignModalOpen(false)}
              disabled={signSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={signSubmitting}
            >
              {signSubmitting ? "Подписание..." : "Подписать"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
