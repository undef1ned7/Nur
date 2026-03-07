import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingWorkEntries } from "@/store/slices/building/workEntriesSlice";
import {
  fetchBuildingWorkEntryById,
  createBuildingWorkEntryPhoto,
} from "@/store/creators/building/workEntriesCreators";
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

  const photos = useMemo(
    () => (Array.isArray(entry?.photos) ? entry.photos : []),
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
              ЖК: <b>{selectedProjectName}</b>
              {entry?.category && (
                <> • {CATEGORY_LABELS[entry.category] || entry.category}</>
              )}
            </p>
          </div>
        </div>
        <div className="work-detail__section-actions" style={{ marginTop: 16 }}>
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
            onClick={() => setOpenPhotoModal(true)}
            disabled={!entry}
          >
            Добавить фото
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
