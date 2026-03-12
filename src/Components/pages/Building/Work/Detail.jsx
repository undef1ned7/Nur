import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, FilePlus, Pencil, Package } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingWorkEntries } from "@/store/slices/building/workEntriesSlice";
import {
  fetchBuildingWorkEntryById,
  createBuildingWorkEntryPhoto,
  createBuildingWorkEntryFile,
  createWorkEntryWarehouseRequest,
} from "@/store/creators/building/workEntriesCreators";
import { fetchBuildingWarehouses } from "@/store/creators/building/warehousesCreators";
import { fetchBuildingWarehouseStockItems } from "@/store/creators/building/stockCreators";
import { useBuildingWarehouses } from "@/store/slices/building/warehousesSlice";
import { useBuildingStock } from "@/store/slices/building/stockSlice";
import { asDateTime } from "../shared/constants";
import { Copy } from "lucide-react";
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

export default function BuildingWorkProcessDetail() {
  const { id } = useParams();
  const entryId = id ? String(id) : null;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();

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
    { stock_item: "", quantity: "", unit: "" },
  ]);
  const [warehouseRequestComment, setWarehouseRequestComment] = useState("");
  const [warehouseRequestError, setWarehouseRequestError] = useState(null);
  const [warehouseRequestSubmitting, setWarehouseRequestSubmitting] = useState(false);

  const { list: warehousesList } = useBuildingWarehouses();
  const { items: stockItemsList } = useBuildingStock();

  useEffect(() => {
    if (!entryId) return;
    dispatch(fetchBuildingWorkEntryById(entryId));
  }, [dispatch, entryId]);

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

  const photos = useMemo(
    () => (Array.isArray(entry?.photos) ? entry.photos : []),
    [entry],
  );

  const files = useMemo(
    () => (Array.isArray(entry?.files) ? entry.files : []),
    [entry],
  );

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

  const openWarehouseRequestModal = () => {
    setWarehouseRequestWarehouse("");
    setWarehouseRequestItems([{ stock_item: "", quantity: "", unit: "" }]);
    setWarehouseRequestComment("");
    setWarehouseRequestError(null);
    setOpenWarehouseModal(true);
  };

  const addWarehouseRequestRow = () => {
    setWarehouseRequestItems((prev) => [
      ...prev,
      { stock_item: "", quantity: "", unit: "" },
    ]);
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
        unit: (row.unit || "").trim() || null,
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
              {entry?.work_status && (
                <> • {WORK_STATUS_LABELS[entry.work_status] || entry.work_status}</>
              )}
            </p>
          </div>
        </div>
        <div className="work-detail__section-actions" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
            onClick={handleEditClick}
            disabled={!entry}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Pencil size={18} />
            Редактировать
          </button>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={() => setOpenPhotoModal(true)}
            disabled={!entry}
          >
            Добавить фото
          </button>
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
                <label className="add-product-page__label">Статус работ</label>
                <div className="work-detail__value">
                  {WORK_STATUS_LABELS[entry?.work_status] || entry?.work_status || "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Подрядчик</label>
                <div className="work-detail__value">
                  {entry?.contractor_display ?? entry?.contractor_name ?? "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Клиент</label>
                <div className="work-detail__value">
                  {entry?.client_display ?? entry?.client_name ?? "—"}
                </div>
              </div>
              <div className="add-product-page__form-group">
                <label className="add-product-page__label">Договор</label>
                <div className="work-detail__value">
                  {entry?.treaty_display ?? entry?.treaty_number ?? entry?.treaty_title ?? "—"}
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
            <div className="add-product-page__section-header">
              <div className="add-product-page__section-number">2</div>
              <h3 className="add-product-page__section-title">Фотоотчёт</h3>
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
            <div className="add-product-page__section-header">
              <div className="add-product-page__section-number">3</div>
              <h3 className="add-product-page__section-title">Прикреплённые файлы</h3>
            </div>
            {files.length === 0 ? (
              <div className="work-detail__muted">
                Файлов пока нет. Используйте кнопку «Прикрепить файл» выше.
              </div>
            ) : (
              <ul className="work-detail__file-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {files.map((f) => {
                  const fid = f?.id ?? f?.uuid;
                  const url = getFileUrl(f);
                  const label = f?.title ?? f?.name ?? f?.file_name ?? "Файл";
                  return (
                    <li
                      key={fid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 0",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="work-detail__file-link"
                          style={{ color: "#2563eb", textDecoration: "underline" }}
                        >
                          {label}
                        </a>
                      ) : (
                        <span>{label}</span>
                      )}
                      {f?.created_at && (
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {asDateTime(f.created_at)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
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
                <input
                  type="text"
                  className="add-product-page__input"
                  placeholder="Ед."
                  value={row.unit}
                  onChange={(e) =>
                    updateWarehouseRequestItem(index, "unit", e.target.value)
                  }
                />
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
    </div>
  );
}
