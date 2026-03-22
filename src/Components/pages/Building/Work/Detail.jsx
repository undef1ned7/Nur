import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, FilePlus, Pencil, Package, Copy, Banknote, PlayCircle, XCircle, Pause } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingWorkEntries } from "@/store/slices/building/workEntriesSlice";
import {
  fetchBuildingWorkEntryById,
  createBuildingWorkEntryPhoto,
  createBuildingWorkEntryFile,
  createWorkEntryWarehouseRequest,
  updateBuildingWorkEntry,
} from "@/store/creators/building/workEntriesCreators";
import { fetchBuildingWarehouses } from "@/store/creators/building/warehousesCreators";
import { fetchBuildingWarehouseStockItems } from "@/store/creators/building/stockCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import { useBuildingStock } from "@/store/slices/building/stockSlice";
import { asDateTime, statusLabel } from "../shared/constants";
import {
  TREATY_TYPE_LABELS,
  WORK_PROCUREMENT_PAYMENT_MODE_LABELS,
} from "../shared/buildingSpecOptions";
import buildingAPI from "../../../../api/building";
import {
  getBuildingCashboxes,
  getBuildingCashRegisterRequests,
  uploadBuildingCashRegisterRequestFile,
} from "../../../../api/building";
import api from "../../../../api";
import "./Detail.scss";

const CATEGORY_LABELS = {
  note: "Заметка",
  treaty: "По договору",
  defect: "Дефект",
  report: "Отчёт",
  other: "Другое",
};

const WORK_STATUS_LABELS = {
  planned: "Запланировано",
  in_progress: "В работе",
  paused: "Приостановлено",
  completed: "Завершено",
  cancelled: "Отменено",
};

const WAREHOUSE_REQUEST_STATUS_LABELS = {
  pending: "Ожидает склада",
  approved: "Одобрена",
  rejected: "Отклонена",
  partially_approved: "Частично выдано",
  completed: "Всё выдано",
};

const getCashRequestWorkEntryId = (request) => {
  const rawWorkEntryId =
    request?.work_entry_id ??
    request?.work_entry?.id ??
    request?.work_entry?.uuid ??
    request?.work_entry;
  return rawWorkEntryId == null ? "" : String(rawWorkEntryId);
};

const isApprovedAdvanceForWorkEntry = (request, expectedEntryId) => {
  if (!expectedEntryId) return false;
  const requestType = String(request?.request_type ?? "").toLowerCase();
  const status = String(request?.status ?? "").toLowerCase();
  return (
    requestType === "advance" &&
    status === "approved" &&
    getCashRequestWorkEntryId(request) === String(expectedEntryId)
  );
};

const isBarterMode = (paymentMode) =>
  String(paymentMode || "").toLowerCase() === "barter";

export default function BuildingWorkProcessDetail() {
  const { id } = useParams();
  const entryId = id ? String(id) : null;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();

  const { selectedProjectId, items: projects } = useBuildingProjects();
  const { current, currentLoading, currentError } = useBuildingWorkEntries();

  const [openPhotoModal, setOpenPhotoModal] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoError, setPhotoError] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [openPreviewModal, setOpenPreviewModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [openFileModal, setOpenFileModal] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [attachFileTitle, setAttachFileTitle] = useState("");
  const [fileError, setFileError] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);

  const [openWarehouseModal, setOpenWarehouseModal] = useState(false);
  const [warehouseRequestWarehouse, setWarehouseRequestWarehouse] = useState("");
  const [warehouseRequestItems, setWarehouseRequestItems] = useState([
    { stock_item: "", quantity: "" },
  ]);
  const [warehouseRequestComment, setWarehouseRequestComment] = useState("");
  const [warehouseRequestError, setWarehouseRequestError] = useState(null);
  const [warehouseRequestSubmitting, setWarehouseRequestSubmitting] = useState(false);

  const [warehouseRequests, setWarehouseRequests] = useState([]);
  const [warehouseRequestsLoading, setWarehouseRequestsLoading] = useState(false);
  const [warehouseRequestsError, setWarehouseRequestsError] = useState(null);
  const [warehouseReceipts, setWarehouseReceipts] = useState([]);
  const [warehouseReceiptsLoading, setWarehouseReceiptsLoading] = useState(false);
  const [warehouseReceiptsError, setWarehouseReceiptsError] = useState(null);

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceCashbox, setAdvanceCashbox] = useState("");
  const [advanceCashboxes, setAdvanceCashboxes] = useState([]);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [advanceError, setAdvanceError] = useState(null);
  const [advanceCreatedRequestId, setAdvanceCreatedRequestId] = useState(null);
  const [advanceFile, setAdvanceFile] = useState(null);
  const [advanceFileTitle, setAdvanceFileTitle] = useState("");
  const [advanceFileUploading, setAdvanceFileUploading] = useState(false);
  const [advanceFileError, setAdvanceFileError] = useState(null);

  const [approvedAdvanceSum, setApprovedAdvanceSum] = useState(null);
  const [approvedAdvanceLoading, setApprovedAdvanceLoading] = useState(false);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutCashbox, setPayoutCashbox] = useState("");
  const [payoutCreatedRequestId, setPayoutCreatedRequestId] = useState(null);
  const [payoutFile, setPayoutFile] = useState(null);
  const [payoutFileTitle, setPayoutFileTitle] = useState("");
  const [payoutFileUploading, setPayoutFileUploading] = useState(false);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState(null);

  const { list: warehousesList } = useBuildingWarehouses();
  const { items: stockItemsList } = useBuildingStock();

  useEffect(() => {
    if (!entryId) return;
    dispatch(fetchBuildingWorkEntryById(entryId));
  }, [dispatch, entryId]);

  useEffect(() => {
    if (!entryId) return;
    const loadRequests = async () => {
      setWarehouseRequestsLoading(true);
      setWarehouseRequestsError(null);
      try {
        const { data } = await api.get(
          "/building/work-entries/warehouse-requests/",
          {
            params: {
              work_entry: entryId,
              page_size: 50,
            },
          },
        );
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setWarehouseRequests(list);
      } catch (err) {
        setWarehouseRequestsError(
          validateResErrors(
            err,
            "Не удалось загрузить заявки на материалы",
          ),
        );
      } finally {
        setWarehouseRequestsLoading(false);
      }
    };
    loadRequests();
  }, [entryId]);

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    setWarehouseReceiptsLoading(true);
    setWarehouseReceiptsError(null);
    buildingAPI
      .getBuildingWorkEntryWarehouseReceipts(entryId)
      .then((data) => {
        if (!cancelled) {
          setWarehouseReceipts(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWarehouseReceiptsError(
            validateResErrors(err, "Не удалось загрузить полученные материалы"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setWarehouseReceiptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const list = Array.isArray(projects) ? projects : [];
    const found = list.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const entry =
    current && String(current.id ?? current.uuid) === entryId
      ? current
      : current;

  const rcId = entry?.residential_complex ?? entry?.residential_complex_id ?? selectedProjectId;
  useEffect(() => {
    if (!rcId) return;
    dispatch(
      fetchBuildingWarehouses({
        residential_complex: rcId,
        is_active: true,
        page_size: 100,
      }),
    );
  }, [dispatch, rcId]);

  useEffect(() => {
    if (!warehouseRequestWarehouse) return;
    dispatch(
      fetchBuildingWarehouseStockItems({
        warehouse: warehouseRequestWarehouse,
        page_size: 500,
      }),
    );
  }, [dispatch, warehouseRequestWarehouse]);

  const photos = useMemo(() => {
    const raw = entry?.photos;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.results)) return raw.results;
    return [];
  }, [entry]);

  const files = useMemo(() => {
    const raw = entry?.files;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.results)) return raw.results;
    return [];
  }, [entry]);

  const handleBack = () => {
    navigate("/crm/building/work");
  };

  const handleCopyPreviewLink = async () => {
    if (!previewPhoto?.src) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(previewPhoto.src);
        const close = alert("Ссылка на фото скопирована");
        setTimeout(() => {
          close();
        }, 1000);
      } else {
        // fallback
        const textarea = document.createElement("textarea");
        textarea.value = previewPhoto.src;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        const close = alert("Ссылка на фото скопирована");
        setTimeout(() => {
          close();
        }, 1000);
      }
    } catch (err) {
      alert("Не удалось скопировать ссылку", true);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (photoPreview && typeof URL !== "undefined") {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    if (file && typeof URL !== "undefined") {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };

  const handlePhotoSubmit = async (e) => {
    e.preventDefault();
    if (!entryId) return;
    if (!photoFile) {
      setPhotoError("Выберите файл изображения");
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const res = await dispatch(
        createBuildingWorkEntryPhoto({
          id: entryId,
          image: photoFile,
          caption: photoCaption,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Фото добавлено");
        setPhotoFile(null);
        setPhotoCaption("");
        if (photoPreview && typeof URL !== "undefined") {
          URL.revokeObjectURL(photoPreview);
        }
        setPhotoPreview(null);
        setOpenPhotoModal(false);
        // Перезагружаем запись, чтобы список и детали сразу получили актуальные данные с бэка
        dispatch(fetchBuildingWorkEntryById(entryId));
      } else {
        setPhotoError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось загрузить фото",
          ),
        );
      }
    } catch (err) {
      setPhotoError(validateResErrors(err, "Не удалось загрузить фото"));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleFileAttachSubmit = async (e) => {
    e.preventDefault();
    if (!entryId) return;
    if (!attachFile) {
      setFileError("Выберите файл");
      return;
    }
    setFileError(null);
    setFileUploading(true);
    try {
      const res = await dispatch(
        createBuildingWorkEntryFile({
          id: entryId,
          file: attachFile,
          title: attachFileTitle.trim() || undefined,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Файл прикреплён");
        setAttachFile(null);
        setAttachFileTitle("");
        setOpenFileModal(false);
        dispatch(fetchBuildingWorkEntryById(entryId));
      } else {
        setFileError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось прикрепить файл",
          ),
        );
      }
    } catch (err) {
      setFileError(validateResErrors(err, "Не удалось прикрепить файл"));
    } finally {
      setFileUploading(false);
    }
  };

  const closeFileModal = () => {
    setOpenFileModal(false);
    setAttachFile(null);
    setAttachFileTitle("");
    setFileError(null);
  };

  const getFileUrl = (f) =>
    f?.file_url ?? f?.url ?? f?.file ?? (typeof f === "string" ? f : "");

  const getFileName = (f) => {
    if (f?.title) return f.title;
    const url = getFileUrl(f);
    if (!url) return "Файл";
    const clean = url.split("#")[0].split("?")[0];
    const parts = clean.split("/");
    const last = parts[parts.length - 1] || "Файл";
    return last;
  };

  const openWarehouseRequestModal = () => {
    setWarehouseRequestWarehouse("");
    setWarehouseRequestItems([{ stock_item: "", quantity: "" }]);
    setWarehouseRequestComment("");
    setWarehouseRequestError(null);
    setOpenWarehouseModal(true);
  };

  const addWarehouseRequestRow = () => {
    setWarehouseRequestItems((prev) => [
      ...prev,
      { stock_item: "", quantity: "" },
    ]);
  };

  const getUnitForStockItem = (stockItemId) => {
    if (!stockItemId) return "";
    const list = Array.isArray(stockItemsList) ? stockItemsList : [];
    const item = list.find(
      (it) =>
        String(it?.id ?? it?.uuid ?? it?.stock_item) === String(stockItemId)
    );
    return item?.unit ?? item?.unit_name ?? "";
  };

  const updateWarehouseRequestItem = (index, field, value) => {
    setWarehouseRequestItems((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || {}), [field]: value };
      return next;
    });
  };

  const removeWarehouseRequestRow = (index) => {
    setWarehouseRequestItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleWarehouseRequestSubmit = async (e) => {
    e.preventDefault();
    if (!entryId) return;
    if (!warehouseRequestWarehouse) {
      setWarehouseRequestError("Выберите склад");
      return;
    }
    const items = warehouseRequestItems
      .map((row) => ({
        stock_item: row.stock_item || null,
        quantity: row.quantity ? String(row.quantity) : null,
        unit: getUnitForStockItem(row.stock_item) || null,
      }))
      .filter((row) => row.stock_item && row.quantity);
    if (items.length === 0) {
      setWarehouseRequestError("Добавьте хотя бы одну позицию с количеством");
      return;
    }
    setWarehouseRequestError(null);
    setWarehouseRequestSubmitting(true);
    try {
      const res = await dispatch(
        createWorkEntryWarehouseRequest({
          id: entryId,
          payload: {
            warehouse: warehouseRequestWarehouse,
            items,
            comment: warehouseRequestComment.trim() || undefined,
          },
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Заявка на склад создана");
        setOpenWarehouseModal(false);
        // Перезагружаем список заявок для этого процесса работ
        try {
          const { data } = await api.get(
            "/building/work-entries/warehouse-requests/",
            {
              params: {
                work_entry: entryId,
                page_size: 50,
              },
            },
          );
          const list = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
            ? data
            : [];
          setWarehouseRequests(list);
        } catch (err) {
          // тихо игнорируем, форма уже успешно создала заявку
          // и при следующей загрузке страницы данные подтянутся
        }
      } else {
        setWarehouseRequestError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось создать заявку",
          ),
        );
      }
    } catch (err) {
      setWarehouseRequestError(
        validateResErrors(err, "Не удалось создать заявку"),
      );
    } finally {
      setWarehouseRequestSubmitting(false);
    }
  };

  const handleEditClick = () => {
    navigate(`/crm/building/work?edit=${entryId}`, { state: { openEditId: entryId } });
  };

  const isPlanned = entry?.work_status === "planned";
  const isCancelled = entry?.work_status === "cancelled";
  const isCompleted = entry?.work_status === "completed";
  const barterMode = isBarterMode(entry?.payment_mode);
  const remainingContractAmount = Math.max(
    0,
    (Number(entry?.contract_amount) || 0) - (Number(approvedAdvanceSum) || 0),
  );

  const handleStartWork = () => {
    confirm("Перевести процесс работ в статус «В работе»?", async (ok) => {
      if (!ok || !entryId) return;
      setStatusUpdating(true);
      try {
        const res = await dispatch(
          updateBuildingWorkEntry({ id: entryId, payload: { work_status: "in_progress" } }),
        );
        if (res?.meta?.requestStatus === "fulfilled") {
          alert("Процесс переведён в работу");
          dispatch(fetchBuildingWorkEntryById(entryId));
        } else {
          alert(validateResErrors(res?.payload || res?.error, "Не удалось обновить статус"), true);
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось обновить статус"), true);
      } finally {
        setStatusUpdating(false);
      }
    });
  };

  const handleCancelWork = () => {
    confirm("Отменить работы по этому процессу? Статус будет изменён на «Отменено».", async (ok) => {
      if (!ok || !entryId) return;
      setStatusUpdating(true);
      try {
        const res = await dispatch(
          updateBuildingWorkEntry({ id: entryId, payload: { work_status: "cancelled" } }),
        );
        if (res?.meta?.requestStatus === "fulfilled") {
          alert("Работы отменены");
          dispatch(fetchBuildingWorkEntryById(entryId));
        } else {
          alert(validateResErrors(res?.payload || res?.error, "Не удалось отменить"), true);
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось отменить"), true);
      } finally {
        setStatusUpdating(false);
      }
    });
  };

  const isInProgress = entry?.work_status === "in_progress";
  const isPaused = entry?.work_status === "paused";

  const handlePause = () => {
    confirm("Приостановить процесс работ?", async (ok) => {
      if (!ok || !entryId) return;
      setStatusUpdating(true);
      try {
        const res = await dispatch(
          updateBuildingWorkEntry({ id: entryId, payload: { work_status: "paused" } }),
        );
        if (res?.meta?.requestStatus === "fulfilled") {
          alert("Процесс приостановлен");
          dispatch(fetchBuildingWorkEntryById(entryId));
        } else {
          alert(validateResErrors(res?.payload || res?.error, "Не удалось приостановить"), true);
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось приостановить"), true);
      } finally {
        setStatusUpdating(false);
      }
    });
  };

  const handleResume = () => {
    confirm("Возобновить процесс работ (перевести в статус «В работе»)?", async (ok) => {
      if (!ok || !entryId) return;
      setStatusUpdating(true);
      try {
        const res = await dispatch(
          updateBuildingWorkEntry({ id: entryId, payload: { work_status: "in_progress" } }),
        );
        if (res?.meta?.requestStatus === "fulfilled") {
          alert("Процесс возобновлён");
          dispatch(fetchBuildingWorkEntryById(entryId));
        } else {
          alert(validateResErrors(res?.payload || res?.error, "Не удалось возобновить"), true);
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось возобновить"), true);
      } finally {
        setStatusUpdating(false);
      }
    });
  };

  const handleCompleteWork = () => {
    if (!entryId) return;
    const contractorId = entry?.contractor ?? entry?.contractor_id;
    const hasContractAmount = Number(entry?.contract_amount) > 0;

    if (!contractorId || !hasContractAmount) {
      confirm(
        "Завершить процесс работ без оформления выплаты через кассу?",
        async (ok) => {
          if (!ok || !entryId) return;
          setStatusUpdating(true);
          try {
            const res = await dispatch(
              updateBuildingWorkEntry({
                id: entryId,
                payload: { work_status: "completed" },
              }),
            );
            if (res?.meta?.requestStatus === "fulfilled") {
              alert("Работа завершена");
              dispatch(fetchBuildingWorkEntryById(entryId));
            } else {
              alert(
                validateResErrors(
                  res?.payload || res?.error,
                  "Не удалось завершить работу",
                ),
                true,
              );
            }
          } catch (err) {
            alert(validateResErrors(err, "Не удалось завершить работу"), true);
          } finally {
            setStatusUpdating(false);
          }
        },
      );
      return;
    }

    if (barterMode) {
      confirm(
        "Завершить работу в режиме «Бартер» без создания заявки на выплату?",
        async (ok) => {
          if (!ok || !entryId) return;
          setStatusUpdating(true);
          try {
            const res = await dispatch(
              updateBuildingWorkEntry({
                id: entryId,
                payload: { work_status: "completed" },
              }),
            );
            if (res?.meta?.requestStatus === "fulfilled") {
              alert("Работа завершена в режиме бартер");
              dispatch(fetchBuildingWorkEntryById(entryId));
            } else {
              alert(
                validateResErrors(
                  res?.payload || res?.error,
                  "Не удалось завершить работу",
                ),
                true,
              );
            }
          } catch (err) {
            alert(validateResErrors(err, "Не удалось завершить работу"), true);
          } finally {
            setStatusUpdating(false);
          }
        },
      );
      return;
    }
    setPayoutAmount(
      remainingContractAmount > 0 ? String(remainingContractAmount.toFixed(2)) : "",
    );
    setPayoutCashbox("");
    setPayoutError(null);
    setPayoutModalOpen(true);
  };

  useEffect(() => {
    if ((!advanceModalOpen && !payoutModalOpen) || !rcId) return;
    getBuildingCashboxes({ residential_complex: rcId })
      .then((list) => setAdvanceCashboxes(Array.isArray(list) ? list : []))
      .catch(() => setAdvanceCashboxes([]));
  }, [advanceModalOpen, payoutModalOpen, rcId]);

  useEffect(() => {
    if (!entryId) return;
    setApprovedAdvanceLoading(true);
    setApprovedAdvanceSum(null);
    getBuildingCashRegisterRequests({
      work_entry: entryId,
      request_type: "advance",
      status: "approved",
    })
      .then((list) => {
        const currentEntryAdvances = (list || []).filter((request) =>
          isApprovedAdvanceForWorkEntry(request, entryId),
        );
        const sum = currentEntryAdvances.reduce(
          (acc, r) => acc + (parseFloat(r?.amount) || 0),
          0,
        );
        setApprovedAdvanceSum(sum);
      })
      .catch(() => setApprovedAdvanceSum(null))
      .finally(() => setApprovedAdvanceLoading(false));
  }, [entryId]);

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!entryId || !advanceCashbox) {
      setAdvanceError("Выберите кассу");
      return;
    }
    const amount = String(advanceAmount || "").trim();
    if (!amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setAdvanceError("Укажите сумму аванса");
      return;
    }
    if (!advanceFile) {
      setAdvanceError("Прикрепите файл к заявке на аванс");
      return;
    }
    setAdvanceSubmitting(true);
    setAdvanceError(null);
    setAdvanceFileError(null);
    try {
      const { data } = await api.post("/building/cash-register/requests/", {
        request_type: "advance",
        work_entry: entryId,
        amount,
        cashbox: advanceCashbox,
      });
      const createdId = data?.id ?? data?.uuid;
      if (!createdId) {
        setAdvanceError("Не удалось получить ID созданной заявки для прикрепления файла");
        return;
      }
      try {
        const formData = new FormData();
        formData.append("file", advanceFile);
        if (advanceFileTitle.trim()) formData.append("title", advanceFileTitle.trim());
        await uploadBuildingCashRegisterRequestFile(createdId, formData);
        alert("Заявка на аванс создана, файл прикреплен");
        closeAdvanceModal();
      } catch (uploadErr) {
        setAdvanceCreatedRequestId(createdId);
        setAdvanceFileError(
          validateResErrors(
            uploadErr,
            "Заявка создана, но не удалось прикрепить файл. Загрузите файл, чтобы завершить оформление",
          ),
        );
      }
    } catch (err) {
      setAdvanceError(
        validateResErrors(err, "Не удалось создать заявку на аванс"),
      );
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const handleAdvanceFileUpload = async (e) => {
    e.preventDefault();
    if (!advanceCreatedRequestId || !advanceFile) return;
    setAdvanceFileUploading(true);
    setAdvanceFileError(null);
    try {
      const formData = new FormData();
      formData.append("file", advanceFile);
      if (advanceFileTitle.trim()) formData.append("title", advanceFileTitle.trim());
      await uploadBuildingCashRegisterRequestFile(advanceCreatedRequestId, formData);
      alert("Файл прикреплен к заявке на аванс");
      closeAdvanceModal();
    } catch (err) {
      setAdvanceFileError(
        validateResErrors(err, "Не удалось загрузить файл"),
      );
    } finally {
      setAdvanceFileUploading(false);
    }
  };

  const closeAdvanceModal = () => {
    setAdvanceModalOpen(false);
    setAdvanceAmount("");
    setAdvanceCashbox("");
    setAdvanceError(null);
    setAdvanceCreatedRequestId(null);
    setAdvanceFile(null);
    setAdvanceFileTitle("");
    setAdvanceFileError(null);
  };

  const closePayoutModal = () => {
    setPayoutModalOpen(false);
    setPayoutAmount("");
    setPayoutCashbox("");
    setPayoutCreatedRequestId(null);
    setPayoutFile(null);
    setPayoutFileTitle("");
    setPayoutError(null);
  };

  const finalizePayoutCompletion = async () => {
    const res = await dispatch(
      updateBuildingWorkEntry({ id: entryId, payload: { work_status: "completed" } }),
    );
    if (res?.meta?.requestStatus === "fulfilled") {
      alert("Заявка на выплату создана, файл прикреплен, работа завершена");
      closePayoutModal();
      dispatch(fetchBuildingWorkEntryById(entryId));
      return true;
    }
    setPayoutError(
      validateResErrors(
        res?.payload || res?.error,
        "Заявка и файл сохранены, но не удалось завершить работу",
      ),
    );
    return false;
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!entryId || !payoutCashbox) {
      setPayoutError("Выберите кассу");
      return;
    }
    const contractorId = entry?.contractor ?? entry?.contractor_id;
    if (!contractorId) {
      setPayoutError("Подрядчик не указан");
      return;
    }
    const amount = String(payoutAmount || "").trim();
    if (!amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setPayoutError("Укажите сумму выплаты");
      return;
    }
    if (!payoutFile) {
      setPayoutError("Прикрепите файл к заявке на выплату");
      return;
    }
    setPayoutSubmitting(true);
    setPayoutError(null);
    try {
      const { data } = await api.post("/building/cash-register/requests/", {
        request_type: "contractor_payment",
        work_entry: entryId,
        contractor: contractorId,
        amount,
        cashbox: payoutCashbox,
        comment: "Оплата по договору с подрядчиком",
      });
      const createdId = data?.id ?? data?.uuid;
      if (!createdId) {
        setPayoutError("Не удалось получить ID созданной заявки для прикрепления файла");
        return;
      }
      try {
        const formData = new FormData();
        formData.append("file", payoutFile);
        if (payoutFileTitle.trim()) formData.append("title", payoutFileTitle.trim());
        await uploadBuildingCashRegisterRequestFile(createdId, formData);
      } catch (uploadErr) {
        setPayoutCreatedRequestId(createdId);
        setPayoutError(
          validateResErrors(
            uploadErr,
            "Заявка создана, но не удалось прикрепить файл. Загрузите файл, чтобы завершить работу",
          ),
        );
        return;
      }
      await finalizePayoutCompletion();
    } catch (err) {
      setPayoutError(
        validateResErrors(err, "Не удалось создать заявку на выплату"),
      );
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handlePayoutFileUpload = async (e) => {
    e.preventDefault();
    if (!payoutCreatedRequestId || !payoutFile) return;
    setPayoutFileUploading(true);
    setPayoutError(null);
    try {
      const formData = new FormData();
      formData.append("file", payoutFile);
      if (payoutFileTitle.trim()) formData.append("title", payoutFileTitle.trim());
      await uploadBuildingCashRegisterRequestFile(payoutCreatedRequestId, formData);
      await finalizePayoutCompletion();
    } catch (err) {
      setPayoutError(
        validateResErrors(err, "Не удалось прикрепить файл к заявке на выплату"),
      );
    } finally {
      setPayoutFileUploading(false);
    }
  };

  return (
    <div className="add-product-page work-detail">
      <div className="add-product-page__header">
        <button
          type="button"
          className="add-product-page__back"
          onClick={handleBack}
        >
          <ArrowLeft size={18} />
          К списку записей
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">
              Запись процесса работ
            </h1>
            <p className="add-product-page__subtitle">
              ЖК: <b>{entry?.residential_complex_name || selectedProjectName}</b>
              {entry?.category && (
                <> • {CATEGORY_LABELS[entry.category] || entry.category}</>
              )}
            </p>
          </div>
        </div>
        <div className="work-detail__section-actions" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {isPlanned && (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handleEditClick}
              disabled={!entry}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Pencil size={18} />
              Редактировать
            </button>
          )}
          {isPlanned && (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handleStartWork}
              disabled={!entry || statusUpdating}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <PlayCircle size={18} />
              В работу
            </button>
          )}
          {isInProgress && (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handlePause}
              disabled={!entry || statusUpdating}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Pause size={18} />
              Приостановить
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handleResume}
              disabled={!entry || statusUpdating}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <PlayCircle size={18} />
              В работу
            </button>
          )}
          {(isInProgress || isPaused) && !isCancelled && (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handleCompleteWork}
              disabled={!entry || statusUpdating}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ClipboardList size={18} />
              Завершить работу
            </button>
          )}
          {!isCancelled && !isCompleted && (
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={handleCancelWork}
              disabled={!entry || statusUpdating}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--danger, #b91c1c)" }}
            >
              <XCircle size={18} />
              Отменить работы
            </button>
          )}
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={openWarehouseRequestModal}
            disabled={!entry}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Package size={18} />
            Заявка на склад
          </button>
          {!isCancelled && !isCompleted && (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={() => {
                setAdvanceAmount("");
                setAdvanceCashbox("");
                setAdvanceError(null);
                setAdvanceModalOpen(true);
              }}
              disabled={!entry}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Banknote size={18} />
              Получить аванс
            </button>
          )}
        </div>
      </div>

      {currentLoading && (
        <div className="work-detail__muted">Загрузка записи...</div>
      )}
      {currentError && (
        <div className="add-product-page__error" style={{ marginBottom: 16 }}>
          {String(
            validateResErrors(currentError, "Не удалось загрузить запись"),
          )}
        </div>
      )}

      {entry && (
        <div className="add-product-page__content">
          <div
            className="work-detail__status-track"
            style={{
              marginTop: 4,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginBottom: 6,
              }}
            >
              Процесс работ
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {["cancelled", "planned", "in_progress", "paused", "completed"].map(
                (statusKey, index, arr) => {
                  const isActive = entry?.work_status === statusKey;
                  const colors = {
                    cancelled: "#b91c1c",
                    planned: "#6b7280",
                    in_progress: "#2563eb",
                    paused: "#d97706",
                    completed: "#15803d",
                  };
                  const circleColor = colors[statusKey] || "#64748b";
                  return (
                    <React.Fragment key={statusKey}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          minWidth: 0,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "999px",
                            border: "2px solid",
                            borderColor: isActive ? circleColor : "#cbd5e1",
                            backgroundColor: isActive ? circleColor : "#ffffff",
                          }}
                        />
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: isActive ? circleColor : "#94a3b8",
                            maxWidth: 90,
                            lineHeight: 1.25,
                          }}
                        >
                          {WORK_STATUS_LABELS[statusKey] || statusKey}
                        </div>
                      </div>
                      {index < arr.length - 1 && (
                        <div
                          style={{
                            flex: 1,
                            height: 1,
                            background: "#e2e8f0",
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                },
              )}
            </div>
          </div>
          <div className="add-product-page__section">
            <div className="add-product-page__section-header">
              <div className="add-product-page__section-number">1</div>
              <h3 className="add-product-page__section-title">
                Детали записи
              </h3>
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Название</label>
              <div className="work-detail__value">{entry.title || "—"}</div>
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Описание</label>
              <div
                className="work-detail__value"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {entry.description || "—"}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Жилой комплекс</label>
                <div className="work-detail__value">
                  {entry?.residential_complex_name || "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Категория</label>
                <div className="work-detail__value">
                  {CATEGORY_LABELS[entry?.category] || entry?.category || "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Подрядчик</label>
                <div className="work-detail__value">
                  {entry?.contractor_display ?? entry?.contractor_name ?? "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Договор</label>
                <div className="work-detail__value">
                  {entry?.treaty_display ?? entry?.treaty_number ?? entry?.treaty_title ?? "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Режим оплаты</label>
                <div className="work-detail__value">
                  {WORK_PROCUREMENT_PAYMENT_MODE_LABELS[entry?.payment_mode] ||
                    entry?.payment_mode ||
                    "—"}
                </div>
              </div>
              {barterMode && (
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Особенность оплаты</label>
                  <div className="work-detail__value">
                    При завершении работы выплата через кассу не создаётся,
                    сумма попадёт в взаиморасчёты как бартер.
                  </div>
                </div>
              )}
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Автосоздание договора
                </label>
                <div className="work-detail__value">
                  {entry?.treaty_auto_create ? "Да" : "Нет"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Тип договора</label>
                <div className="work-detail__value">
                  {TREATY_TYPE_LABELS[entry?.treaty_type] ||
                    entry?.treaty_type ||
                    "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Сумма договора</label>
                <div className="work-detail__value">
                  {entry?.contract_amount != null && entry.contract_amount !== ""
                    ? Number(entry.contract_amount).toLocaleString("ru-RU")
                    : "—"}
                </div>
              </div>
              {(entry?.contract_amount != null && entry.contract_amount !== "") && (
                <>
                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">− Выдано авансов</label>
                    <div className="work-detail__value">
                      {approvedAdvanceLoading
                        ? "…"
                        : approvedAdvanceSum != null && approvedAdvanceSum > 0
                          ? Number(approvedAdvanceSum).toLocaleString("ru-RU")
                          : "0"}
                    </div>
                  </div>
                  <div className="add-product-page__form-group">
                    <label className="add-product-page__label">= Остаток по договору</label>
                    <div className="work-detail__value">
                      {approvedAdvanceLoading
                        ? "…"
                        : (() => {
                            const total = Number(entry.contract_amount) || 0;
                            const paid = Number(approvedAdvanceSum) || 0;
                            return (total - paid).toLocaleString("ru-RU");
                          })()}
                    </div>
                  </div>
                </>
              )}
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Начало работ</label>
                <div className="work-detail__value">
                  {entry?.contract_term_start
                    ? String(entry.contract_term_start).slice(0, 10)
                    : "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Окончание работ</label>
                <div className="work-detail__value">
                  {entry?.contract_term_end
                    ? String(entry.contract_term_end).slice(0, 10)
                    : "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Автор</label>
                <div className="work-detail__value">
                  {entry.created_by_display || "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">
                  Когда произошло
                </label>
                <div className="work-detail__value">
                  {asDateTime(entry.occurred_at || entry.created_at)}
                </div>
              </div>
            </div>
          </div>

          <div className="add-product-page__section" style={{ marginTop: 24 }}>
            <div
              className="add-product-page__section-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="add-product-page__section-number">2</div>
                <h3 className="add-product-page__section-title">Фотоотчёт</h3>
              </div>
              <button
                type="button"
                className="add-product-page__submit-btn"
                onClick={() => setOpenPhotoModal(true)}
                disabled={!entry}
              >
                Добавить фото
              </button>
            </div>
            {photos.length === 0 ? (
              <div className="work-detail__muted">
                Фото пока нет. Добавьте первые фото, используя кнопку выше.
              </div>
            ) : (
              <div className="building-work-gallery">
                {photos.map((photo) => {
                  const pid = photo?.id ?? photo?.uuid;
                  const src =
                    photo?.image_url ||
                    photo?.image ||
                    photo?.url ||
                    photo?.file ||
                    "";
                  if (!src) return null;
                  return (
                    <div
                      key={pid}
                      className="building-work-gallery__item"
                      onClick={() => {
                        setPreviewPhoto({
                          src,
                          caption: photo?.caption,
                          created_at: photo?.created_at,
                        });
                        setOpenPreviewModal(true);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="building-work-gallery__imageWrapper">
                        <img
                          src={src}
                          alt={photo?.caption || "Фото"}
                          className="building-work-gallery__image"
                        />
                      </div>
                      <div className="building-work-gallery__meta">
                        {photo?.caption && (
                          <div className="building-work-gallery__caption">
                            {photo.caption}
                          </div>
                        )}
                        <div className="building-work-gallery__date">
                          {asDateTime(photo?.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="add-product-page__section" style={{ marginTop: 24 }}>
            <div
              className="add-product-page__section-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="add-product-page__section-number">3</div>
                <h3 className="add-product-page__section-title">
                  Прикреплённые файлы
                </h3>
              </div>
              <button
                type="button"
                className="add-product-page__submit-btn"
                onClick={() => setOpenFileModal(true)}
                disabled={!entry}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FilePlus size={18} />
                Прикрепить файл
              </button>
            </div>
            {files.length === 0 ? (
              <div className="work-detail__muted">
                Файлов пока нет. Используйте кнопку «Прикрепить файл» выше.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "stretch",
                    minHeight: 120,
                  }}
                >
                  {files.map((f) => {
                    const fid = f?.id ?? f?.uuid;
                    const url = getFileUrl(f);
                    const name = getFileName(f);
                    const clean = url ? url.split("#")[0].split("?")[0] : "";
                    const ext =
                      clean && clean.includes(".")
                        ? clean.split(".").pop().toLowerCase()
                        : "";
                    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(
                      ext,
                    );
                    return (
                      <div
                        key={fid}
                        style={{
                          flex: "0 0 200px",
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          padding: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            borderRadius: 8,
                            border: "1px dashed #e2e8f0",
                            background: "#f8fafc",
                            height: 90,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {url && isImage ? (
                            <img
                              src={url}
                              alt={name}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                              }}
                            >
                              {ext ? ext.toUpperCase() : "FILE"}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#2563eb",
                                textDecoration: "underline",
                                wordBreak: "break-all",
                              }}
                            >
                              {name}
                            </a>
                          ) : (
                            <span>{name}</span>
                          )}
                          {f?.created_at && (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                              {asDateTime(f.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="add-product-page__section" style={{ marginTop: 24 }}>
            <div
              className="add-product-page__section-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="add-product-page__section-number">4</div>
                <h3 className="add-product-page__section-title">
                  Склад: заявки на материалы
                </h3>
              </div>
              <button
                type="button"
                className="add-product-page__submit-btn"
                onClick={() => setOpenWarehouseModal(true)}
                disabled={!entry}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Package size={18} />
                Заявка на склад
              </button>
            </div>
            {warehouseRequestsLoading ? (
              <div className="work-detail__muted">
                Загрузка заявок на материалы...
              </div>
            ) : warehouseRequestsError ? (
              <div className="add-product-page__error">
                {String(warehouseRequestsError)}
              </div>
            ) : warehouseRequests.length === 0 ? (
              <div className="work-detail__muted">
                Заявки на материалы для этого процесса ещё не созданы.
              </div>
            ) : (
              <div
                className="building-table building-table--shadow"
                style={{ marginTop: 8 }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Склад</th>
                      <th>Статус</th>
                      <th>Позиции</th>
                      <th>Создана</th>
                      <th>Обновлена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseRequests.map((req, index) => {
                      const items = Array.isArray(req.items) ? req.items : [];
                      const statusText = statusLabel(
                        req.status,
                        WAREHOUSE_REQUEST_STATUS_LABELS,
                      );
                      return (
                        <tr key={req.id ?? req.uuid ?? index}>
                          <td>{index + 1}</td>
                          <td>{req.warehouse_name || req.warehouse || "—"}</td>
                          <td>{statusText}</td>
                          <td>
                            {items.length > 0
                              ? `${items.length} поз.`
                              : "Позиции не заданы"}
                          </td>
                          <td>{asDateTime(req.created_at)}</td>
                          <td>{asDateTime(req.updated_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="add-product-page__section" style={{ marginTop: 24 }}>
            <div
              className="add-product-page__section-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="add-product-page__section-number">5</div>
                <h3 className="add-product-page__section-title">
                  Получено со склада
                </h3>
              </div>
            </div>
            {warehouseReceiptsLoading ? (
              <div className="work-detail__muted">Загрузка полученных материалов...</div>
            ) : warehouseReceiptsError ? (
              <div className="add-product-page__error">
                {String(warehouseReceiptsError)}
              </div>
            ) : warehouseReceipts.length === 0 ? (
              <div className="work-detail__muted">
                По этому процессу работ пока ничего не выдано со склада.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {warehouseReceipts.map((receipt, index) => {
                  const items = Array.isArray(receipt?.items) ? receipt.items : [];
                  const filesList = Array.isArray(receipt?.files) ? receipt.files : [];
                  return (
                    <div
                      key={receipt?.warehouse_movement_id ?? receipt?.id ?? index}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div className="building-page__muted">Склад</div>
                          <div>{receipt?.warehouse_name || receipt?.warehouse || "—"}</div>
                        </div>
                        <div>
                          <div className="building-page__muted">Кому передали</div>
                          <div>{receipt?.issued_to || "—"}</div>
                        </div>
                        <div>
                          <div className="building-page__muted">Дата выдачи</div>
                          <div>{asDateTime(receipt?.issued_at || receipt?.created_at)}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div className="building-page__muted" style={{ marginBottom: 6 }}>
                          Позиции
                        </div>
                        {items.length === 0 ? (
                          <div className="work-detail__muted">Позиции не указаны.</div>
                        ) : (
                          <div className="building-table building-table--shadow">
                            <table>
                              <thead>
                                <tr>
                                  <th>Наименование</th>
                                  <th>Количество</th>
                                  <th>Ед.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, itemIndex) => (
                                  <tr
                                    key={
                                      item?.nomenclature ??
                                      item?.id ??
                                      `${index}-${itemIndex}`
                                    }
                                  >
                                    <td>{item?.name || item?.title || item?.nomenclature || "—"}</td>
                                    <td>{item?.quantity ?? "—"}</td>
                                    <td>{item?.unit || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                      {filesList.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div className="building-page__muted" style={{ marginBottom: 6 }}>
                            Файлы
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {filesList.map((file, fileIndex) => (
                              <a
                                key={file?.id ?? file?.uuid ?? fileIndex}
                                href={getFileUrl(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="building-btn"
                              >
                                {getFileName(file)}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      <Modal
        open={openPhotoModal}
        onClose={() => {
          setOpenPhotoModal(false);
          setPhotoFile(null);
          setPhotoCaption("");
          setPhotoError(null);
          if (photoPreview && typeof URL !== "undefined") {
            URL.revokeObjectURL(photoPreview);
          }
          setPhotoPreview(null);
        }}
        title="Добавить фото"
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handlePhotoSubmit}
        >
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Файл изображения</label>
            <input
              type="file"
              accept="image/*"
              className="add-product-page__input"
              onChange={handleFileChange}
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">
              Подпись (необязательно)
            </label>
            <input
              className="add-product-page__input"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
            />
          </div>
          {photoPreview && (
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Предпросмотр</label>
              <div className="building-work-gallery__imageWrapper">
                <img
                  src={photoPreview}
                  alt="Предпросмотр"
                  className="building-work-gallery__image"
                />
              </div>
            </div>
          )}
          {photoError && (
            <div className="add-product-page__error">{String(photoError)}</div>
          )}
          <div className="add-product-page__actions">
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => {
                setOpenPhotoModal(false);
                setPhotoFile(null);
                setPhotoCaption("");
                setPhotoError(null);
                if (photoPreview && typeof URL !== "undefined") {
                  URL.revokeObjectURL(photoPreview);
                }
                setPhotoPreview(null);
              }}
              disabled={photoUploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={photoUploading}
            >
              {photoUploading ? "Загрузка..." : "Загрузить"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={openFileModal}
        onClose={closeFileModal}
        title="Прикрепить файл"
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleFileAttachSubmit}
        >
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Файл</label>
            <input
              type="file"
              className="add-product-page__input"
              onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Название (необязательно)</label>
            <input
              className="add-product-page__input"
              value={attachFileTitle}
              onChange={(e) => setAttachFileTitle(e.target.value)}
              placeholder="Например: Договор, Акт"
            />
          </div>
          {fileError && (
            <div className="add-product-page__error">{String(fileError)}</div>
          )}
          <div className="add-product-page__actions">
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={closeFileModal}
              disabled={fileUploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={fileUploading}
            >
              {fileUploading ? "Загрузка..." : "Прикрепить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openWarehouseModal}
        onClose={() => {
          setOpenWarehouseModal(false);
          setWarehouseRequestError(null);
        }}
        title="Заявка на склад"
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={handleWarehouseRequestSubmit}
        >
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Склад</label>
            <select
              className="add-product-page__input"
              value={warehouseRequestWarehouse}
              onChange={(e) => setWarehouseRequestWarehouse(e.target.value)}
            >
              <option value="">— Выберите склад —</option>
              {(Array.isArray(warehousesList) ? warehousesList : []).map((w) => {
                const wid = w?.id ?? w?.uuid;
                return (
                  <option key={wid} value={wid}>
                    {w?.name ?? wid}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Позиции</label>
            {warehouseRequestItems.map((row, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 80px auto",
                  gap: 8,
                  alignItems: "end",
                  marginBottom: 8,
                }}
              >
                <select
                  className="add-product-page__input"
                  value={row.stock_item}
                  onChange={(e) =>
                    updateWarehouseRequestItem(index, "stock_item", e.target.value)
                  }
                >
                  <option value="">— Товар —</option>
                  {(Array.isArray(stockItemsList) ? stockItemsList : []).map((item) => {
                    const iid = item?.id ?? item?.uuid ?? item?.stock_item;
                    return (
                      <option key={iid} value={iid}>
                        {item?.name ?? item?.title ?? item?.nomenclature_name ?? iid}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="add-product-page__input"
                  placeholder="Кол-во"
                  value={row.quantity}
                  onChange={(e) =>
                    updateWarehouseRequestItem(index, "quantity", e.target.value)
                  }
                />
                <span
                  className="add-product-page__input"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "var(--bg-secondary, #f5f5f5)",
                    color: "var(--text-secondary, #666)",
                    borderRadius: 4,
                    minHeight: 38,
                  }}
                  title="Единица из склада"
                >
                  {getUnitForStockItem(row.stock_item) || "—"}
                </span>
                <button
                  type="button"
                  className="add-product-page__cancel-btn"
                  onClick={() => removeWarehouseRequestRow(index)}
                  disabled={warehouseRequestItems.length <= 1}
                >
                  Удалить
                </button>
              </div>
            ))}
            <button
              type="button"
              className="add-product-page__submit-btn"
              style={{ marginTop: 4 }}
              onClick={addWarehouseRequestRow}
            >
              Добавить позицию
            </button>
          </div>
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Комментарий</label>
            <textarea
              className="add-product-page__input"
              rows={2}
              value={warehouseRequestComment}
              onChange={(e) => setWarehouseRequestComment(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
          {warehouseRequestError && (
            <div className="add-product-page__error">
              {String(warehouseRequestError)}
            </div>
          )}
          <div className="add-product-page__actions">
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => setOpenWarehouseModal(false)}
              disabled={warehouseRequestSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={warehouseRequestSubmitting}
            >
              {warehouseRequestSubmitting ? "Создание..." : "Создать заявку"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openPreviewModal}
        onClose={() => {
          setOpenPreviewModal(false);
          setPreviewPhoto(null);
        }}
        title="Просмотр фото"
      >
        {previewPhoto && (
          <div className="add-product-page add-product-page--modal-form">
            <div className="building-work-gallery__imageWrapper">
              <img
                src={previewPhoto.src}
                alt={previewPhoto.caption || "Фото"}
                className="building-work-gallery__image"
              />
            </div>
            {previewPhoto.caption && (
              <div
                className="building-work-gallery__caption"
                style={{ marginTop: 8 }}
              >
                {previewPhoto.caption}
              </div>
            )}
            <div
              className="building-work-gallery__date"
              style={{ marginTop: 4 }}
            >
              {asDateTime(previewPhoto.created_at)}
            </div>
            <div className="add-product-page__actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={handleCopyPreviewLink}
                aria-label="Скопировать ссылку"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={advanceModalOpen}
        onClose={() => {
          if (advanceSubmitting || advanceFileUploading) return;
          closeAdvanceModal();
        }}
        title="Получить аванс"
      >
        {advanceCreatedRequestId ? (
          <div className="building-page">
            <p className="building-page__muted" style={{ marginBottom: 16 }}>
              Заявка на аванс уже создана, но файл не прикрепился. Загрузите файл к этой заявке, чтобы завершить оформление.
            </p>
            <form onSubmit={handleAdvanceFileUpload}>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Файл</label>
                <input
                  type="file"
                  className="add-product-page__input"
                  onChange={(e) => setAdvanceFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Подпись (необязательно)</label>
                <input
                  type="text"
                  className="add-product-page__input"
                  value={advanceFileTitle}
                  onChange={(e) => setAdvanceFileTitle(e.target.value)}
                  placeholder="Например: Договор, Акт"
                />
              </div>
              {advanceFileError && (
                <div className="add-product-page__error" style={{ marginBottom: 12 }}>
                  {String(advanceFileError)}
                </div>
              )}
              <div className="add-product-page__actions" style={{ marginTop: 12 }}>
                <button
                  type="submit"
                  className="add-product-page__submit-btn"
                  disabled={advanceFileUploading || !advanceFile}
                >
                  {advanceFileUploading ? "Загрузка..." : "Прикрепить файл к заявке"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form className="building-page" onSubmit={handleAdvanceSubmit}>
            {entry && (entry?.contract_amount != null && entry.contract_amount !== "") && (
              <div className="work-detail__advance-summary" style={{ marginBottom: 16, padding: 12, background: "var(--surface-secondary, #f1f5f9)", borderRadius: 8 }}>
                <div className="add-product-page__form-group" style={{ marginBottom: 8 }}>
                  <label className="add-product-page__label">Сумма договора</label>
                  <div className="work-detail__value">
                    {Number(entry.contract_amount).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="add-product-page__form-group" style={{ marginBottom: 8 }}>
                  <label className="add-product-page__label">− Выдано авансов</label>
                  <div className="work-detail__value">
                    {approvedAdvanceLoading ? "…" : (approvedAdvanceSum != null && approvedAdvanceSum > 0 ? Number(approvedAdvanceSum).toLocaleString("ru-RU") : "0")}
                  </div>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">= Остаток по договору</label>
                  <div className="work-detail__value">
                    {approvedAdvanceLoading ? "…" : ((Number(entry.contract_amount) || 0) - (Number(approvedAdvanceSum) || 0)).toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>
            )}
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Сумма аванса</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="add-product-page__input"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Касса</label>
              <select
                className="add-product-page__input"
                value={advanceCashbox}
                onChange={(e) => setAdvanceCashbox(e.target.value)}
              >
                <option value="">Выберите кассу</option>
                {advanceCashboxes.map((c) => {
                  const cid = c?.id ?? c?.uuid ?? "";
                  return (
                    <option key={cid} value={cid}>
                      {c?.name ?? c?.title ?? cid}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Файл</label>
              <input
                type="file"
                className="add-product-page__input"
                onChange={(e) => setAdvanceFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Подпись файла (необязательно)</label>
              <input
                type="text"
                className="add-product-page__input"
                value={advanceFileTitle}
                onChange={(e) => setAdvanceFileTitle(e.target.value)}
                placeholder="Например: Договор, Акт"
              />
            </div>
            {advanceError && (
              <div className="add-product-page__error" style={{ marginBottom: 12 }}>
                {String(advanceError)}
              </div>
            )}
            {advanceFileError && (
              <div className="add-product-page__error" style={{ marginBottom: 12 }}>
                {String(advanceFileError)}
              </div>
            )}
            <div className="add-product-page__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={closeAdvanceModal}
                disabled={advanceSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="add-product-page__submit-btn"
                disabled={advanceSubmitting}
              >
                {advanceSubmitting ? "Создание..." : "Создать заявку на аванс"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={payoutModalOpen}
        onClose={() => {
          if (payoutSubmitting || payoutFileUploading) return;
          closePayoutModal();
        }}
        title="Выплата подрядчику"
      >
        {payoutCreatedRequestId ? (
          <div className="building-page">
            <p className="building-page__muted" style={{ marginBottom: 16 }}>
              Заявка на выплату уже создана, но файл не прикрепился. Загрузите файл к этой заявке, чтобы завершить работу.
            </p>
            <form onSubmit={handlePayoutFileUpload}>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Файл</label>
                <input
                  type="file"
                  className="add-product-page__input"
                  onChange={(e) => setPayoutFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Подпись файла (необязательно)</label>
                <input
                  type="text"
                  className="add-product-page__input"
                  value={payoutFileTitle}
                  onChange={(e) => setPayoutFileTitle(e.target.value)}
                  placeholder="Например: Акт, Договор"
                />
              </div>
              {payoutError && (
                <div className="add-product-page__error" style={{ marginBottom: 12 }}>
                  {String(payoutError)}
                </div>
              )}
              <div className="add-product-page__actions" style={{ marginTop: 12 }}>
                <button
                  type="submit"
                  className="add-product-page__submit-btn"
                  disabled={payoutFileUploading || !payoutFile}
                >
                  {payoutFileUploading ? "Загрузка..." : "Прикрепить файл и завершить"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form className="building-page" onSubmit={handlePayoutSubmit}>
            {entry && entry?.contract_amount != null && entry.contract_amount !== "" && (
              <div
                className="work-detail__advance-summary"
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "var(--surface-secondary, #f1f5f9)",
                  borderRadius: 8,
                }}
              >
                <div className="add-product-page__form-group" style={{ marginBottom: 8 }}>
                  <label className="add-product-page__label">Сумма договора</label>
                  <div className="work-detail__value">
                    {Number(entry.contract_amount).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="add-product-page__form-group" style={{ marginBottom: 8 }}>
                  <label className="add-product-page__label">− Выдано авансов</label>
                  <div className="work-detail__value">
                    {approvedAdvanceLoading
                      ? "…"
                      : approvedAdvanceSum != null && approvedAdvanceSum > 0
                        ? Number(approvedAdvanceSum).toLocaleString("ru-RU")
                        : "0"}
                  </div>
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">= Остаток к выплате</label>
                  <div className="work-detail__value">
                    {approvedAdvanceLoading ? "…" : remainingContractAmount.toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>
            )}
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Сумма выплаты</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="add-product-page__input"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Касса</label>
              <select
                className="add-product-page__input"
                value={payoutCashbox}
                onChange={(e) => setPayoutCashbox(e.target.value)}
              >
                <option value="">Выберите кассу</option>
                {advanceCashboxes.map((c) => {
                  const cid = c?.id ?? c?.uuid ?? "";
                  return (
                    <option key={cid} value={cid}>
                      {c?.name ?? c?.title ?? cid}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Файл</label>
              <input
                type="file"
                className="add-product-page__input"
                onChange={(e) => setPayoutFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Подпись файла (необязательно)</label>
              <input
                type="text"
                className="add-product-page__input"
                value={payoutFileTitle}
                onChange={(e) => setPayoutFileTitle(e.target.value)}
                placeholder="Например: Акт, Договор"
              />
            </div>
            {payoutError && (
              <div className="add-product-page__error" style={{ marginBottom: 12 }}>
                {String(payoutError)}
              </div>
            )}
            <div className="add-product-page__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={closePayoutModal}
                disabled={payoutSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="add-product-page__submit-btn"
                disabled={payoutSubmitting}
              >
                {payoutSubmitting ? "Создание..." : "Отправить выплату и завершить"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
