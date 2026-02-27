import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  useBuildingWorkEntries,
} from "@/store/slices/building/workEntriesSlice";
import {
  fetchBuildingWorkEntryById,
  createBuildingWorkEntryPhoto,
} from "@/store/creators/building/workEntriesCreators";
import { asDateTime } from "../shared/constants";
import { Copy } from "lucide-react";

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
  const {
    current,
    currentLoading,
    currentError,
  } = useBuildingWorkEntries();

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
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId)
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const entry = current && String(current.id ?? current.uuid) === entryId
    ? current
    : current;

  const photos = useMemo(
    () => (Array.isArray(entry?.photos) ? entry.photos : []),
    [entry]
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
        })
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
            "Не удалось загрузить фото"
          )
        );
      }
    } catch (err) {
      setPhotoError(
        validateResErrors(err, "Не удалось загрузить фото")
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">
            Запись процесса работ
          </h1>
          <p className="building-page__subtitle">
            ЖК: <b>{selectedProjectName}</b>{" "}
            {entry?.category && (
              <>
                • {CATEGORY_LABELS[entry.category] || entry.category}
              </>
            )}
          </p>
          {currentLoading && (
            <div className="building-page__muted">Загрузка записи...</div>
          )}
          {currentError && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  currentError,
                  "Не удалось загрузить запись"
                )
              )}
            </div>
          )}
        </div>
        <div className="building-page__actions">
          <button
            type="button"
            className="building-btn"
            onClick={handleBack}
          >
            Назад к списку
          </button>
          <button
            type="button"
            className="building-btn building-btn--primary"
            onClick={() => setOpenPhotoModal(true)}
            disabled={!entry}
          >
            Добавить фото
          </button>
        </div>
      </div>

      {entry && (
        <div className="building-page__card">
          <h3 className="building-page__cardTitle">Детали записи</h3>
          <div className="building-page__row">
            <div>
              <div className="building-page__label">Название</div>
              <div className="building-page__value" style={{ textAlign: "left" }}>
                {entry.title || "—"}
              </div>
            </div>
          </div>
          <div className="building-page__row">
            <div>
              <div className="building-page__label">Описание</div>
              <div className="building-page__value" style={{ textAlign: "left" }}>
                {entry.description || "—"}
              </div>
            </div>
          </div>
          <div className="building-page__row">
            <div>
              <div className="building-page__label">Автор</div>
              <div className="building-page__value">
                {entry.created_by_display || "—"}
              </div>
            </div>
            <div>
              <div className="building-page__label">Когда произошло</div>
              <div className="building-page__value">
                {asDateTime(entry.occurred_at || entry.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="building-page__card">
        <h3 className="building-page__cardTitle">Фотоотчёт</h3>
        {photos.length === 0 && (
          <div className="building-page__muted">
            Фото пока нет. Добавьте первые фото, используя кнопку выше.
          </div>
        )}
        {photos.length > 0 && (
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
        <form className="building-page" onSubmit={handlePhotoSubmit}>
          <label>
            <div className="building-page__label">Файл изображения</div>
            <input
              type="file"
              accept="image/*"
              className="building-page__input"
              onChange={handleFileChange}
            />
          </label>
          <label>
            <div className="building-page__label">Подпись (необязательно)</div>
            <input
              className="building-page__input"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
            />
          </label>
          {photoPreview && (
            <div>
              <div className="building-page__label">Предпросмотр</div>
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
            <div className="building-page__error">
              {String(photoError)}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
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
              className="building-btn building-btn--primary"
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
          <div className="building-page">
            <div className="building-work-gallery__imageWrapper">
              <img
                src={previewPhoto.src}
                alt={previewPhoto.caption || "Фото"}
                className="building-work-gallery__image"
              />
            </div>
            {previewPhoto.caption && (
              <div className="building-work-gallery__caption" style={{ marginTop: 8 }}>
                {previewPhoto.caption}
              </div>
            )}
            <div className="building-work-gallery__date" style={{ marginTop: 4 }}>
              {asDateTime(previewPhoto.created_at)}
            </div>
            <div className="building-page__actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="building-btn"
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

